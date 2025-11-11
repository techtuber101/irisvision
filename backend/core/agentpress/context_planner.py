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
    created_at: Optional[str] = None
    expires_at: Optional[str] = None
    size_bytes: Optional[int] = None
    metadata: Dict[str, Any] = field(default_factory=dict)

    def to_prompt_dict(self) -> Dict[str, Any]:
        return {
            "key": self.key,
            "scope": self.scope,
            "description": self.description,
            "preview": self.preview,
            "created_at": self.created_at,
            "expires_at": self.expires_at,
            "size_bytes": self.size_bytes,
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
                    "6. Only include the project summary when strategic planning or continuity is clearly needed."
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
        candidates.append(
            ArtifactCandidate(
                key=entry.get("key", ""),
                scope="artifacts",
                description=metadata.get("description"),
                preview=metadata.get("preview"),
                created_at=entry.get("created_at"),
                expires_at=entry.get("expires_at"),
                size_bytes=entry.get("size_bytes"),
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
) -> str:
    if not user_message or not kv_store:
        logger.info(
            "🧭 Context planner skipped | thread=%s | reason=%s | turn=%s",
            thread_id,
            "missing_user_message" if not user_message else "kv_unavailable",
            turn_label,
        )
        return ""

    instruction_candidates = await build_instruction_candidates(kv_store)
    artifact_candidates = await build_artifact_candidates(kv_store)

    if not instruction_candidates and not artifact_candidates and not project_summary:
        logger.info(
            "🧭 Context planner skipped | thread=%s | reason=no_candidates | turn=%s",
            thread_id,
            turn_label,
        )
        return ""

    planner = ContextPlanner()
    logger.info(
        "🧭 Context planner start | thread=%s | instructions=%d | artifacts=%d | turn=%s",
        thread_id,
        len(instruction_candidates),
        len(artifact_candidates),
        turn_label,
    )
    plan = await planner.plan_context(
        user_request=user_message,
        instruction_catalog=instruction_candidates,
        artifact_catalog=artifact_candidates,
        project_summary_preview=trim_text(project_summary, 400),
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
        return ""

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

    if plan.artifacts:
        artifact_blocks: List[str] = []
        for artifact in plan.artifacts:
            try:
                payload = await kv_store.get(
                    scope=artifact.scope or "artifacts",
                    key=artifact.key,
                    as_type="auto",
                )
                serialized = serialize_artifact_content(payload)
                reason_line = (
                    f"\nReason: {artifact.reason}"
                    if artifact.reason
                    else ""
                )
                artifact_blocks.append(
                    f"### Cached Artifact: {artifact.key}{reason_line}\n{serialized}"
                )
            except Exception as exc:
                logger.debug(f"Context planner artifact miss ({artifact.key}): {exc}")

        if artifact_blocks:
            sections.append("## Cached Artifacts\n" + "\n\n".join(artifact_blocks))

    if plan.include_project_summary and project_summary:
        sections.append("## Project Summary\n" + project_summary)

    if not sections:
        return ""

    planner_note = f"Planner rationale: {plan.reasoning}\n" if plan.reasoning else ""

    selected_artifacts = [
        {
            "key": artifact.key,
            "scope": artifact.scope,
            "reason": artifact.reason,
        }
        for artifact in plan.artifacts
    ]
    analysis_payload = {
        "thread_id": thread_id,
        "turn_label": turn_label,
        "selected_instructions": plan.instruction_tags,
        "selected_artifacts": selected_artifacts,
        "include_project_summary": plan.include_project_summary,
        "reasoning": plan.reasoning,
        "raw_plan": plan.raw_response,
    }
    try:
        logger.info(
            "🧭 Planner analysis | thread=%s | details=%s",
            thread_id,
            json.dumps(analysis_payload, ensure_ascii=False),
        )
    except Exception as exc:
        logger.debug(f"Failed to serialize planner analysis payload: {exc}")

    return "\n\n# AUTO-LOADED CONTEXT\n" + planner_note + "\n".join(sections)
