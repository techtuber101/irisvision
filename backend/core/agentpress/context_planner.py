"""
Context planning utilities for Iris.

This module lets the agent make a lightweight LLM call that decides which
instructions, artifacts, or project context should be injected into the next
LLM request. It keeps the main prompt lean while still letting the model
explicitly request the context it needs for the current turn.
"""

from __future__ import annotations

import json
from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional

from core.services.llm import make_llm_api_call
from core.utils.logger import logger
from core.sandbox.kv_store import SandboxKVStore
from core.sandbox.sandbox import get_or_start_sandbox
from core.sandbox.instruction_seeder import INSTRUCTION_FILES


@dataclass
class InstructionCandidate:
    """Instruction set that can be injected into the prompt."""

    tag: str
    description: str
    tokens_estimate: Optional[int] = None
    last_updated: Optional[str] = None
    metadata: Dict[str, Any] = field(default_factory=dict)

    def to_prompt_dict(self) -> Dict[str, Any]:
        return {
            "tag": self.tag,
            "description": self.description,
            "tokens_estimate": self.tokens_estimate,
            "last_updated": self.last_updated,
            "metadata": self.metadata,
        }


@dataclass
class ArtifactCandidate:
    """Cached artifact that can be reloaded for the model."""

    key: str
    scope: str = "artifacts"
    description: Optional[str] = None
    preview: Optional[str] = None
    summary: Optional[str] = None
    created_at: Optional[str] = None
    expires_at: Optional[str] = None
    size_bytes: Optional[int] = None
    size_tokens: Optional[int] = None
    metadata: Dict[str, Any] = field(default_factory=dict)

    def to_prompt_dict(self) -> Dict[str, Any]:
        return {
            "key": self.key,
            "scope": self.scope,
            "description": self.description,
            "preview": self.preview,
            "summary": self.summary,
            "created_at": self.created_at,
            "expires_at": self.expires_at,
            "size_bytes": self.size_bytes,
            "size_tokens": self.size_tokens,
            "metadata": self.metadata,
        }


@dataclass
class ContextArtifactSelection:
    """Artifact the planner explicitly requested."""

    key: str
    scope: str = "artifacts"
    reason: Optional[str] = None


@dataclass
class ContextPlan:
    """Structured output returned by the planner."""

    instruction_tags: List[str] = field(default_factory=list)
    artifacts: List[ContextArtifactSelection] = field(default_factory=list)
    include_project_summary: bool = False
    reasoning: str = ""
    raw_response: Optional[Dict[str, Any]] = None

    def has_context(self) -> bool:
        return bool(self.instruction_tags or self.artifacts or self.include_project_summary)


@dataclass
class PlannerSectionResult:
    """Return value for build_auto_context_section containing content + telemetry."""

    section: str
    telemetry: Dict[str, Any] = field(default_factory=dict)


class ContextPlanner:
    """LLM-powered planner that chooses what context to load."""

    def __init__(
        self,
        model_name: str = "gemini/gemini-2.5-flash-lite",
        max_instructions: int = 3,
        max_artifacts: int = 3,
    ) -> None:
        self.model_name = model_name
        self.max_instructions = max_instructions
        self.max_artifacts = max_artifacts

    async def plan_context(
        self,
        *,
        user_request: str,
        instruction_catalog: List[InstructionCandidate],
        artifact_catalog: List[ArtifactCandidate],
        project_summary_preview: Optional[str] = None,
        recent_context_hint: Optional[str] = None,
        aggressive_mode: bool = False,
    ) -> ContextPlan:
        """Ask the planner model which context objects to load."""
        if not user_request:
            return ContextPlan()

        planner_payload = {
            "user_request": user_request,
            "recent_context_hint": recent_context_hint or "",
            "project_summary_preview": project_summary_preview or "",
            "instruction_catalog": [item.to_prompt_dict() for item in instruction_catalog],
            "artifact_catalog": [item.to_prompt_dict() for item in artifact_catalog],
            "aggressive_mode": aggressive_mode,
            "limits": {
                "max_instructions": self.max_instructions,
                "max_artifacts": self.max_artifacts,
            },
        }

        messages = [
            {
                "role": "system",
                "content": (
                    "You are the Iris Context Planner. Your primary mission is to keep every "
                    "turn as token-efficient and performant as possible while still giving the agent "
                    "the context it truly needs.\n\n"
                    "Rules:\n"
                    "1. Return *pure JSON* in this shape:\n"
                    "{\n"
                    '  \"instructions\": [{\"tag\": \"<instruction_tag>\", \"reason\": \"<why>\"}],\n'
                    '  \"artifacts\": [{\"key\": \"<artifact_key>\", \"scope\": \"<scope>\", \"reason\": \"<why>\"}],\n'
                    '  \"include_project_summary\": true|false,\n'
                    '  \"reasoning\": \"short natural language explanation\"\n'
                    "}\n"
                    f"2. NEVER select more than {self.max_instructions} instructions or "
                    f"{self.max_artifacts} artifacts.\n"
                    "3. Only reference tags/keys that exist in the catalogs provided in the user message.\n"
                    "4. Be ruthless about minimizing tokens: if core instructions already cover the task, "
                    "don't add anything. For simple tool calls (like one web search) usually zero artifacts "
                    "and only the relevant instruction (e.g., web_search) is enough. For comprehensive tasks "
                    "like document or presentation creation, include the specific instruction bundle plus "
                    "ONLY the artifacts that contain essential prior research/results.\n"
                    "5. Never include artifacts just because they exist—each must have a concrete use in the "
                    "upcoming step. If you can't explain why it's required now, leave it out.\n"
                    "6. Only include the project summary when strategic planning or continuity is clearly needed.\n"
                    "7. When the payload marks aggressive_mode=true, behave as if the token budget is nearly "
                    "exhausted: prefer referencing artifacts via their summaries/previews and only request "
                    "full hydration when it is absolutely essential (e.g., verbatim insertion into a deliverable)."
                ),
            },
            {
                "role": "user",
                "content": json.dumps(planner_payload, ensure_ascii=False, indent=2),
            },
        ]

        try:
            response = await make_llm_api_call(
                messages=messages,
                model_name=self.model_name,
                temperature=0.1,
                max_tokens=250,
                stream=False,
            )
            text = self._extract_response_text(response)
            if not text:
                raise ValueError("Planner returned an empty response")
            plan_dict = self._safe_load_json(text)
            return self._plan_from_dict(plan_dict, instruction_catalog, artifact_catalog)
        except Exception as exc:
            logger.warning(f"Context planner failed, using heuristic fallback: {exc}")
            return self._fallback_plan(user_request)

    def _plan_from_dict(
        self,
        data: Dict[str, Any],
        instruction_catalog: List[InstructionCandidate],
        artifact_catalog: List[ArtifactCandidate],
    ) -> ContextPlan:
        instruction_tags: List[str] = []
        artifacts: List[ContextArtifactSelection] = []

        catalog_tags = {item.tag: item for item in instruction_catalog}
        artifact_map = {(item.scope, item.key): item for item in artifact_catalog}

        for entry in data.get("instructions", []):
            tag = (entry.get("tag") or "").strip().lower()
            if not tag or tag not in catalog_tags:
                continue
            if tag not in instruction_tags:
                instruction_tags.append(tag)
            if len(instruction_tags) >= self.max_instructions:
                break

        for entry in data.get("artifacts", []):
            key = (entry.get("key") or "").strip()
            scope = (entry.get("scope") or "artifacts").strip()
            if not key:
                continue
            if (scope, key) not in artifact_map:
                continue
            artifacts.append(
                ContextArtifactSelection(
                    key=key,
                    scope=scope or "artifacts",
                    reason=entry.get("reason"),
                )
            )
            if len(artifacts) >= self.max_artifacts:
                break

        plan = ContextPlan(
            instruction_tags=instruction_tags,
            artifacts=artifacts,
            include_project_summary=bool(data.get("include_project_summary")),
            reasoning=data.get("reasoning", "").strip(),
            raw_response=data,
        )

        if not plan.has_context():
            # Provide at least heuristic coverage when the structured output is empty.
            heuristic = self._fallback_plan(data.get("user_request", ""))
            if heuristic.has_context():
                return heuristic

        return plan

    @staticmethod
    def _safe_load_json(payload: str) -> Dict[str, Any]:
        try:
            return json.loads(payload)
        except json.JSONDecodeError:
            # Try to locate the first JSON object in the string if the model wrapped output.
            start = payload.find("{")
            end = payload.rfind("}")
            if start != -1 and end != -1 and end > start:
                snippet = payload[start : end + 1]
                return json.loads(snippet)
            raise

    @staticmethod
    def _extract_response_text(response: Any) -> str:
        if response is None:
            return ""
        if isinstance(response, str):
            return response.strip()
        if isinstance(response, dict):
            if "choices" in response and response["choices"]:
                message = response["choices"][0].get("message", {})
                content = message.get("content", "")
                if content:
                    return content.strip()
            return response.get("content", "").strip()

        # LiteLLM ModelResponse
        if hasattr(response, "choices") and response.choices:
            first_choice = response.choices[0]
            if hasattr(first_choice, "message"):
                content = getattr(first_choice.message, "content", None)
                if isinstance(content, list):
                    # Gemini may return a list of text chunks
                    texts = [item.get("text", "") for item in content if isinstance(item, dict)]
                    return "\n".join(texts).strip()
                return (content or "").strip()
            if isinstance(first_choice, dict):
                message = first_choice.get("message", {})
                content = message.get("content", "")
                if isinstance(content, list):
                    texts = [item.get("text", "") for item in content if isinstance(item, dict)]
                    return "\n".join(texts).strip()
                return str(content).strip()

        return ""

    def _fallback_plan(self, user_request: str) -> ContextPlan:
        """Simple keyword-based fallback when the planner fails."""
        tags = self._heuristic_instruction_tags(user_request)
        return ContextPlan(
            instruction_tags=tags,
            include_project_summary=False,
            reasoning="Fallback keyword heuristic",
            raw_response=None,
        )

    def _heuristic_instruction_tags(self, user_request: str) -> List[str]:
        if not user_request:
            return []

        message = user_request.lower()
        heuristics = [
            ("presentation", ["presentation", "slide", "deck", "pitch", "ppt", "keynote"]),
            ("document_creation", ["document", "report", "pdf", "write up", "whitepaper"]),
            ("research", ["research", "analyze", "analysis", "investigate", "study"]),
            ("visualization", ["chart", "graph", "visualization", "plot", "infographic"]),
            ("web_development", ["website", "web app", "frontend", "react", "deploy website"]),
        ]

        selected: List[str] = []
        for tag, keywords in heuristics:
            if any(keyword in message for keyword in keywords):
                selected.append(tag)
            if len(selected) >= self.max_instructions:
                break

        return selected


async def get_project_context(thread_id: str, client) -> Dict[str, Any]:
    """Fetch project_id and KV store for a thread."""
    project_id = None
    kv_store: Optional[SandboxKVStore] = None

    try:
        thread_result = (
            await client.table("threads")
            .select("project_id")
            .eq("thread_id", thread_id)
            .limit(1)
            .execute()
        )
        if thread_result.data:
            project_id = thread_result.data[0].get("project_id")

        if not project_id:
            return {"project_id": project_id, "kv_store": kv_store}

        project_result = (
            await client.table("projects")
            .select("sandbox")
            .eq("project_id", project_id)
            .limit(1)
            .execute()
        )
        sandbox_info = (project_result.data or [{}])[0].get("sandbox", {})
        sandbox_id = sandbox_info.get("id")
        if not sandbox_id:
            return {"project_id": project_id, "kv_store": kv_store}

        sandbox = await get_or_start_sandbox(sandbox_id)
        kv_store = SandboxKVStore(sandbox)
        logger.debug(f"KV cache ready for project {project_id}")
    except Exception as exc:
        logger.debug(f"Could not initialize KV store for thread {thread_id}: {exc}")

    return {"project_id": project_id, "kv_store": kv_store}


async def load_project_summary(
    kv_store: Optional[SandboxKVStore],
) -> Dict[str, Optional[str]]:
    if not kv_store:
        return {"summary": None, "created_at": None}

    try:
        summary = await kv_store.get(scope="project", key="summary", as_type="str")
        metadata = await kv_store.get_metadata(scope="project", key="summary")
        return {
            "summary": summary,
            "created_at": metadata.get("created_at"),
        }
    except Exception:
        return {"summary": None, "created_at": None}


async def build_instruction_candidates(
    kv_store: Optional[SandboxKVStore],
) -> List[InstructionCandidate]:
    candidates: List[InstructionCandidate] = []
    metadata_map: Dict[str, Dict[str, Any]] = {}

    if kv_store:
        try:
            instruction_entries = await kv_store.list_keys(scope="instructions")
            for entry in instruction_entries:
                key = entry.get("key", "")
                if not key.startswith("instruction_"):
                    continue
                tag = key.replace("instruction_", "")
                metadata_map[tag] = entry
        except Exception as exc:
            logger.debug(f"Failed to list instruction cache entries: {exc}")

    for config in INSTRUCTION_FILES.values():
        tag = config["tag"]
        cache_entry = metadata_map.get(tag, {})
        tokens_estimate = None
        size_bytes = cache_entry.get("size_bytes")
        if isinstance(size_bytes, (int, float)):
            tokens_estimate = max(1, int(size_bytes / 2))

        candidates.append(
            InstructionCandidate(
                tag=tag,
                description=config.get("description", "No description provided"),
                tokens_estimate=tokens_estimate,
                last_updated=cache_entry.get("created_at"),
                metadata=cache_entry.get("metadata", {}),
            )
        )

    return candidates


async def build_artifact_candidates(
    kv_store: Optional[SandboxKVStore],
    max_candidates: int = 8,
) -> List[ArtifactCandidate]:
    candidates: List[ArtifactCandidate] = []
    if not kv_store:
        return candidates

    try:
        entries = await kv_store.list_keys(scope="artifacts")
    except Exception as exc:
        logger.debug(f"Failed to list cached artifacts: {exc}")
        return candidates

    sorted_entries = sorted(
        entries,
        key=lambda item: item.get("created_at") or "",
        reverse=True,
    )

    for entry in sorted_entries[:max_candidates]:
        metadata = entry.get("metadata", {}) or {}
        summary = metadata.get("summary") or metadata.get("description")
        preview = metadata.get("preview")
        size_tokens = metadata.get("size_tokens")
        if not size_tokens and metadata.get("size_chars"):
            try:
                size_tokens = max(1, int(metadata["size_chars"] / 4))
            except Exception:
                size_tokens = None
        candidates.append(
            ArtifactCandidate(
                key=entry.get("key", ""),
                scope="artifacts",
                description=summary or metadata.get("description"),
                preview=preview,
                summary=summary,
                created_at=entry.get("created_at"),
                expires_at=entry.get("expires_at"),
                size_bytes=entry.get("size_bytes"),
                size_tokens=size_tokens,
                metadata=metadata,
            )
        )

    return candidates


def serialize_artifact_content(value: Any, max_chars: int = 4000) -> str:
    if value is None:
        return ""
    if isinstance(value, (dict, list)):
        try:
            rendered = json.dumps(value, ensure_ascii=False, indent=2)
        except Exception:
            rendered = str(value)
    else:
        rendered = str(value)

    if len(rendered) > max_chars:
        return f"{rendered[:max_chars]}...\n[truncated]"
    return rendered


def _format_artifact_stub(
    *,
    metadata_entry: Optional[Dict[str, Any]],
    reason: Optional[str],
    aggressive_mode: bool,
) -> str:
    custom_metadata = (metadata_entry or {}).get("metadata", {}) or {}
    summary = custom_metadata.get("summary")
    preview = custom_metadata.get("preview")
    cached_at = custom_metadata.get("cached_at")
    forced_for_tool = custom_metadata.get("forced_for_tool")
    size_tokens = custom_metadata.get("size_tokens")
    size_chars = custom_metadata.get("size_chars")
    if not summary and preview:
        summary = preview

    limit = 280 if aggressive_mode else 480
    summary_line = trim_text(summary, limit) if summary else "No summary stored."
    lines = [
        f"- summary: {summary_line}",
    ]
    if reason:
        lines.append(f"- planner_reason: {trim_text(reason, 300)}")
    if size_tokens:
        lines.append(f"- est_tokens: {size_tokens:,}")
    if size_chars:
        lines.append(f"- size_chars: {size_chars:,}")
    if cached_at:
        lines.append(f"- cached_at: {cached_at}")
    if forced_for_tool:
        lines.append(f"- origin_tool: {forced_for_tool}")
    lines.append("- note: Full artifact stays cached; planner hydrates the needed slices automatically. No get_artifact tool calls are required.")
    return "\n".join(lines)


def _should_hydrate_full_artifact(
    *,
    metadata_entry: Optional[Dict[str, Any]],
    reason: Optional[str],
    aggressive_mode: bool,
) -> bool:
    custom_metadata = (metadata_entry or {}).get("metadata", {}) or {}
    size_tokens = custom_metadata.get("size_tokens")
    if not size_tokens and custom_metadata.get("size_chars"):
        try:
            size_tokens = max(1, int(custom_metadata["size_chars"] / 4))
        except Exception:
            size_tokens = None

    reason_text = (reason or "").lower()
    keyword_trigger = any(
        token in reason_text
        for token in [
            "insert",
            "include",
            "verbatim",
            "quote",
            "paste",
            "deliverable",
            "final draft",
            "document body",
            "table",
            "chart data",
            "appendix",
        ]
    )

    if custom_metadata.get("forced_for_tool") == "create_document":
        return True

    if size_tokens is None:
        return keyword_trigger and not aggressive_mode

    if aggressive_mode:
        if size_tokens <= 900:
            return True
        return keyword_trigger and size_tokens <= 3200

    if size_tokens <= 2000:
        return True
    return keyword_trigger and size_tokens <= 5000


async def _render_artifact_block(
    *,
    kv_store: SandboxKVStore,
    artifact: ContextArtifactSelection,
    aggressive_mode: bool,
    stats_collector: Optional[List[Dict[str, Any]]] = None,
) -> Optional[str]:
    scope = artifact.scope or "artifacts"
    metadata_entry: Optional[Dict[str, Any]] = None
    try:
        metadata_entry = await kv_store.get_metadata(scope=scope, key=artifact.key)
    except Exception as exc:
        logger.debug(f"Planner failed to load metadata for {artifact.key}: {exc}")

    hydrate_full = _should_hydrate_full_artifact(
        metadata_entry=metadata_entry,
        reason=artifact.reason,
        aggressive_mode=aggressive_mode,
    )

    reason_line = f"\nReason: {artifact.reason}" if artifact.reason else ""

    stub = _format_artifact_stub(
        metadata_entry=metadata_entry,
        reason=artifact.reason,
        aggressive_mode=aggressive_mode,
    )

    custom_metadata = (metadata_entry or {}).get("metadata", {}) or {}
    size_tokens = custom_metadata.get("size_tokens")
    if not size_tokens and custom_metadata.get("size_chars"):
        try:
            size_tokens = max(1, int(custom_metadata["size_chars"] / 4))
        except Exception:
            size_tokens = None
    size_chars = custom_metadata.get("size_chars")

    stat_record = {
        "key": artifact.key,
        "scope": scope,
        "hydrated": hydrate_full,
        "reason": artifact.reason,
        "size_tokens": size_tokens,
        "size_chars": size_chars,
    }
    if stats_collector is not None:
        stats_collector.append(stat_record)

    if not hydrate_full:
        return f"### Cached Artifact: {artifact.key}{reason_line}\n{stub}"

    try:
        payload = await kv_store.get(scope=scope, key=artifact.key, as_type="auto")
    except Exception as exc:
        logger.debug(f"Planner failed to hydrate artifact {artifact.key}: {exc}")
        return f"### Cached Artifact: {artifact.key}{reason_line}\n{stub}\n- note: full artifact unavailable (cache miss)"

    max_chars = 1500 if aggressive_mode else 4000
    excerpt = serialize_artifact_content(payload, max_chars=max_chars)
    return f"### Cached Artifact: {artifact.key}{reason_line}\n{stub}\n\nHydrated excerpt:\n{excerpt}"


def trim_text(text: Optional[str], max_chars: int = 800) -> Optional[str]:
    if not text:
        return None
    if len(text) <= max_chars:
        return text
    return text[:max_chars] + "\n...[truncated]"


async def build_auto_context_section(
    *,
    user_message: Optional[str],
    thread_id: str,
    kv_store: Optional[SandboxKVStore],
    project_summary: Optional[str],
    turn_label: Optional[str] = None,
    aggressive_mode: bool = False,
) -> PlannerSectionResult:
    def _empty_result(reason: str) -> PlannerSectionResult:
        return PlannerSectionResult(
            section="",
            telemetry={
                "aggressive_mode": aggressive_mode,
                "reason": reason,
                "instruction_count": 0,
                "artifact_count": 0,
                "hydrated_count": 0,
                "stub_count": 0,
            },
        )

    if not user_message or not kv_store:
        logger.info(
            "🧭 Context planner skipped | thread=%s | reason=%s | turn=%s",
            thread_id,
            "missing_user_message" if not user_message else "kv_unavailable",
            turn_label,
        )
        return _empty_result("kv_or_message_missing")

    instruction_candidates = await build_instruction_candidates(kv_store)
    artifact_candidates = await build_artifact_candidates(kv_store)

    if not instruction_candidates and not artifact_candidates and not project_summary:
        logger.info(
            "🧭 Context planner skipped | thread=%s | reason=no_candidates | turn=%s",
            thread_id,
            turn_label,
        )
        return _empty_result("no_candidates")

    planner = ContextPlanner()
    logger.info(
        "🧭 Context planner start | thread=%s | instructions=%d | artifacts=%d | turn=%s | aggressive=%s",
        thread_id,
        len(instruction_candidates),
        len(artifact_candidates),
        turn_label,
        aggressive_mode,
    )
    plan = await planner.plan_context(
        user_request=user_message,
        instruction_catalog=instruction_candidates,
        artifact_catalog=artifact_candidates,
        project_summary_preview=trim_text(project_summary, 400),
        aggressive_mode=aggressive_mode,
    )

    if "document_creation" in plan.instruction_tags and "visualization" not in plan.instruction_tags:
        plan.instruction_tags.append("visualization")
        logger.info("🧭 Planner safety: added visualization instructions alongside document_creation")

    if not plan.has_context():
        logger.info(
            "🧭 Context planner returned empty plan | thread=%s | turn=%s | reasoning=%s",
            thread_id,
            turn_label,
            plan.reasoning,
        )
        return _empty_result("empty_plan")

    sections: List[str] = []

    if plan.instruction_tags:
        instruction_blocks: List[str] = []
        for tag in plan.instruction_tags:
            key = f"instruction_{tag}"
            try:
                content = await kv_store.get(scope="instructions", key=key, as_type="str")
            except Exception as exc:
                logger.debug(f"Context planner requested missing instruction '{tag}': {exc}")
                continue
            if content:
                instruction_blocks.append(
                    f"### Instruction: {tag.replace('_', ' ').title()}\n{content}"
                )

        if instruction_blocks:
            sections.append("## Auto-loaded Instructions\n" + "\n\n".join(instruction_blocks))

    artifact_stats: List[Dict[str, Any]] = []

    if plan.artifacts:
        artifact_blocks: List[str] = []
        for artifact in plan.artifacts:
            block = await _render_artifact_block(
                kv_store=kv_store,
                artifact=artifact,
                aggressive_mode=aggressive_mode,
                stats_collector=artifact_stats,
            )
            if block:
                artifact_blocks.append(block)

        if artifact_blocks:
            sections.append("## Cached Artifacts\n" + "\n\n".join(artifact_blocks))

    if plan.include_project_summary and project_summary:
        summary_max = 300 if aggressive_mode else 800
        sections.append("## Project Summary\n" + (trim_text(project_summary, summary_max) or project_summary))

    if not sections:
        return _empty_result("no_sections_generated")

    planner_note = f"Planner rationale: {plan.reasoning}\n" if plan.reasoning else ""

    selected_artifacts = [
        {
            "key": artifact.key,
            "scope": artifact.scope,
            "reason": artifact.reason,
        }
        for artifact in plan.artifacts
    ]
    hydrated_count = sum(1 for stat in artifact_stats if stat.get("hydrated"))
    stub_count = len(artifact_stats) - hydrated_count
    est_tokens_hydrated = sum(
        stat.get("size_tokens") or 0 for stat in artifact_stats if stat.get("hydrated")
    )
    est_tokens_stubbed = sum(
        stat.get("size_tokens") or 0 for stat in artifact_stats if not stat.get("hydrated")
    )

    telemetry = {
        "aggressive_mode": aggressive_mode,
        "instruction_count": len(plan.instruction_tags),
        "artifact_count": len(plan.artifacts),
        "hydrated_count": hydrated_count,
        "stub_count": stub_count,
        "est_tokens_hydrated": est_tokens_hydrated,
        "est_tokens_stubbed": est_tokens_stubbed,
        "artifact_stats": artifact_stats,
        "instructions": plan.instruction_tags,
    }

    analysis_payload = {
        "thread_id": thread_id,
        "turn_label": turn_label,
        "selected_instructions": plan.instruction_tags,
        "selected_artifacts": selected_artifacts,
        "include_project_summary": plan.include_project_summary,
        "reasoning": plan.reasoning,
        "raw_plan": plan.raw_response,
        "telemetry": telemetry,
    }
    try:
        logger.info(
            "🧭 Planner analysis | thread=%s | details=%s",
            thread_id,
            json.dumps(analysis_payload, ensure_ascii=False),
        )
    except Exception as exc:
        logger.debug(f"Failed to serialize planner analysis payload: {exc}")

    section_text = "\n\n# AUTO-LOADED CONTEXT\n" + planner_note + "\n".join(sections)
    return PlannerSectionResult(section=section_text, telemetry=telemetry)
