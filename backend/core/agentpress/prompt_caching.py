"""
Gemini prompt caching orchestration for AgentPress.

This module assembles stable cache blocks for Gemini models while keeping the
latest turns live. It emits detailed diagnostics so we can verify that caching
actually reduces the number of fresh tokens billed on each request.
"""

from __future__ import annotations

import copy
import hashlib
import math
from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional, Tuple, Union

from core.utils.logger import logger

try:  # Import lazily so unit tests can stub token counting
    from litellm import token_counter  # type: ignore
except Exception:  # pragma: no cover - LiteLLM may be unavailable in tests
    token_counter = None  # type: ignore


@dataclass
class CacheChunkDiagnostics:
    index: int
    fingerprint: str
    message_count: int
    token_count: int
    payload_token_count: int
    ttl_seconds: int
    first_message_id: Optional[str] = None
    last_message_id: Optional[str] = None


@dataclass
class GeminiCacheReport:
    model: str
    context_window: int
    total_input_tokens: int
    system_tokens: int
    system_cached: bool
    historical_messages: int
    live_messages: int
    cached_messages: int
    cached_blocks: int
    cached_token_estimate: int
    final_prompt_tokens: int
    estimated_prompt_tokens_after_cache: int
    notes: List[str] = field(default_factory=list)
    chunks: List[CacheChunkDiagnostics] = field(default_factory=list)

    def summary_line(self) -> str:
        ratio = (
            0.0
            if self.final_prompt_tokens == 0
            else 1 - (self.estimated_prompt_tokens_after_cache / max(1, self.final_prompt_tokens))
        )
        return (
            f"system_cached={self.system_cached} | cache_blocks={self.cached_blocks} | "
            f"cached_tokens≈{self.cached_token_estimate:,} | fresh_tokens≈{self.estimated_prompt_tokens_after_cache:,} "
            f"| savings≈{ratio * 100:.1f}%"
        )

    def to_dict(self) -> Dict[str, Any]:
        return {
            "model": self.model,
            "context_window": self.context_window,
            "total_input_tokens": self.total_input_tokens,
            "system_tokens": self.system_tokens,
            "system_cached": self.system_cached,
            "historical_messages": self.historical_messages,
            "live_messages": self.live_messages,
            "cached_messages": self.cached_messages,
            "cached_blocks": self.cached_blocks,
            "cached_token_estimate": self.cached_token_estimate,
            "final_prompt_tokens": self.final_prompt_tokens,
            "estimated_prompt_tokens_after_cache": self.estimated_prompt_tokens_after_cache,
            "notes": self.notes,
            "chunks": [
                {
                    "index": chunk.index,
                    "fingerprint": chunk.fingerprint,
                    "message_count": chunk.message_count,
                    "token_count": chunk.token_count,
                    "payload_token_count": chunk.payload_token_count,
                    "ttl_seconds": chunk.ttl_seconds,
                    "first_message_id": chunk.first_message_id,
                    "last_message_id": chunk.last_message_id,
                }
                for chunk in self.chunks
            ],
        }


@dataclass
class PreparedPrompt:
    messages: List[Dict[str, Any]]
    report: GeminiCacheReport


@dataclass
class CacheBlockPlan:
    messages: List[Dict[str, Any]]
    token_count: int
    payload_text: str
    payload_token_count: int
    fingerprint: str
    ttl_seconds: int


def get_resolved_model_id(model_name: str) -> str:
    """Resolve model name to canonical ID through the registry."""
    try:
        from core.ai_models.registry import ModelRegistry

        registry = ModelRegistry()
        model = registry.get(model_name)
        if model and model.id:
            resolved_id = model.id
            if resolved_id != model_name:
                logger.debug("Resolved model '%s' to '%s'", model_name, resolved_id)
            return resolved_id
    except Exception as exc:  # pragma: no cover - registry failures should not break runtime
        logger.warning("Error resolving model name '%s': %s", model_name, exc)
    return model_name


def is_gemini_model(model_name: str) -> bool:
    """Return True if the supplied model is a Gemini variant."""
    resolved = get_resolved_model_id(model_name).lower()
    model_lower = model_name.lower()
    keywords = ("gemini", "flash", "google")
    return any(keyword in resolved for keyword in keywords) or any(keyword in model_lower for keyword in keywords)


def _safe_token_count(model: str, messages: Optional[List[Dict[str, Any]]] = None, text: Optional[str] = None) -> int:
    if token_counter is None:
        source = text if text is not None else str(messages)
        return int(len(source.split()) * 1.3)
    try:
        if messages is not None:
            return token_counter(model=model, messages=messages)
        if text is not None:
            return token_counter(model=model, text=text)
    except Exception as exc:  # pragma: no cover - fallback path when LiteLLM misbehaves
        logger.warning("Token counting failed for model %s (%s). Falling back to estimate.", model, exc)
        source = text if text is not None else str(messages)
        return int(len(source.split()) * 1.3)
    return 0


def _estimate_token_count(text: str, model: str) -> int:
    if not text:
        return 0
    return _safe_token_count(model=model, text=text)


def get_message_token_count(message: Dict[str, Any], model: str) -> int:
    content = message.get("content", "")

    if isinstance(content, list):
        total = 0
        for item in content:
            if isinstance(item, dict):
                if item.get("type") == "text":
                    total += _estimate_token_count(item.get("text", ""), model)
                elif item.get("type") == "image_url":
                    total += _estimate_token_count(item.get("image_url", {}).get("url", ""), model)
                elif item.get("type") == "input_text":
                    total += _estimate_token_count(item.get("text", ""), model)
                else:
                    total += _estimate_token_count(str(item), model)
            else:
                total += _estimate_token_count(str(item), model)
        return total

    if isinstance(content, dict):
        return _estimate_token_count(str(content), model)

    return _estimate_token_count(str(content), model)


def _extract_plain_text(message: Dict[str, Any]) -> str:
    content = message.get("content", "")

    if isinstance(content, list):
        parts: List[str] = []
        for item in content:
            if isinstance(item, dict):
                if item.get("type") == "text":
                    parts.append(str(item.get("text", "")))
                elif item.get("type") == "input_text":
                    parts.append(str(item.get("text", "")))
                elif "text" in item:
                    parts.append(str(item["text"]))
                elif "content" in item:
                    parts.append(str(item["content"]))
                else:
                    parts.append(str(item))
            else:
                parts.append(str(item))
        collapsed = "\\n".join(segment for segment in parts if segment)
        return collapsed.strip()

    if isinstance(content, dict):
        return str(content).strip()

    return str(content).strip()


def _role_label(role: str) -> str:
    role_map = {
        "user": "User",
        "assistant": "Assistant",
        "tool": "Tool",
        "system": "System",
        "developer": "Developer",
    }
    return role_map.get(role, role.title() if role else "Unknown")


def _with_cache_control(message: Dict[str, Any], directive: Dict[str, Any]) -> Dict[str, Any]:
    message_copy = copy.deepcopy(message)
    content = message_copy.get("content", "")

    if isinstance(content, list):
        new_content: List[Any] = []
        for item in content:
            if isinstance(item, dict) and item.get("type") == "text":
                item_copy = item.copy()
                item_copy["cache_control"] = directive
                new_content.append(item_copy)
            else:
                new_content.append(copy.deepcopy(item))
        message_copy["content"] = new_content
    else:
        message_copy["content"] = [
            {
                "type": "text",
                "text": "" if content is None else str(content),
                "cache_control": directive,
            }
        ]

    return message_copy


def _fingerprint_payload(base_text: str) -> str:
    digest = hashlib.sha1(base_text.encode("utf-8")).hexdigest()
    return digest[:12]


class GeminiPromptCachePlanner:
    MIN_SYSTEM_CACHE_TOKENS = 512
    MAX_CONVERSATION_CACHE_BLOCKS = 3
    MIN_CHUNK_TOKENS = 1_024

    def __init__(self, model_name: str, context_window: int):
        self.model_name = model_name
        self.context_window = max(context_window, 128_000)
        self.live_context_min_tokens = 4_096
        self.live_context_fraction = 0.05
        self.live_context_max_tokens = max(18_000, int(self.context_window * 0.10))
        self.min_live_messages = 6
        self.max_chunk_tokens = max(12_000, int(self.context_window * 0.06))

    def assemble(
        self,
        system_prompt: Dict[str, Any],
        conversation_messages: List[Dict[str, Any]],
    ) -> PreparedPrompt:
        if not conversation_messages:
            tokens = get_message_token_count(system_prompt, self.model_name)
            report = GeminiCacheReport(
                model=self.model_name,
                context_window=self.context_window,
                total_input_tokens=tokens,
                system_tokens=tokens,
                system_cached=False,
                historical_messages=0,
                live_messages=0,
                cached_messages=0,
                cached_blocks=0,
                cached_token_estimate=0,
                final_prompt_tokens=tokens,
                estimated_prompt_tokens_after_cache=tokens,
            )
            messages = [copy.deepcopy(system_prompt)]
            return PreparedPrompt(messages=messages, report=report)

        total_input_tokens = _safe_token_count(
            self.model_name,
            messages=[system_prompt] + conversation_messages,
        )
        system_tokens = get_message_token_count(system_prompt, self.model_name)
        system_cached = system_tokens >= self.MIN_SYSTEM_CACHE_TOKENS

        report = GeminiCacheReport(
            model=self.model_name,
            context_window=self.context_window,
            total_input_tokens=total_input_tokens,
            system_tokens=system_tokens,
            system_cached=system_cached,
            historical_messages=0,
            live_messages=0,
            cached_messages=0,
            cached_blocks=1 if system_cached else 0,
            cached_token_estimate=system_tokens if system_cached else 0,
            final_prompt_tokens=0,
            estimated_prompt_tokens_after_cache=0,
        )

        prepared: List[Dict[str, Any]] = []
        if system_cached:
            prepared.append(_with_cache_control(system_prompt, {"type": "PERMANENT"}))
        else:
            prepared.append(copy.deepcopy(system_prompt))

        historical, live = self._split_live_context(conversation_messages)
        report.historical_messages = len(historical)
        report.live_messages = len(live)
        historical_tokens = _safe_token_count(self.model_name, messages=historical) if historical else 0
        report.notes.append(
            f"Historical context: {len(historical)} messages / ~{historical_tokens:,} tokens before caching."
        )

        if not historical:
            report.notes.append("No historical context eligible for caching; live tail consumes budget.")
            prepared.extend(copy.deepcopy(live))
            report.final_prompt_tokens = _safe_token_count(self.model_name, messages=prepared)
            report.estimated_prompt_tokens_after_cache = report.final_prompt_tokens - report.cached_token_estimate
            logger.info("🧊 Gemini caching summary: %s", report.summary_line())
            logger.debug("Gemini caching diagnostics: %s", report.to_dict())
            return PreparedPrompt(messages=prepared, report=report)

        plans = self._build_chunk_plans(historical)
        report.cached_blocks += len(plans)

        if not plans:
            report.notes.append(
                f"Historical payload below caching threshold ({historical_tokens:,} tokens < {self.MIN_CHUNK_TOKENS:,}). Including raw history."
            )
            prepared.extend(copy.deepcopy(historical))
        else:
            for plan in plans:
                prepared.append(self._create_cache_message(plan))
                report.cached_messages += len(plan.messages)
                report.cached_token_estimate += plan.payload_token_count
                report.chunks.append(
                    CacheChunkDiagnostics(
                        index=len(report.chunks) + 1,
                        fingerprint=plan.fingerprint,
                        message_count=len(plan.messages),
                        token_count=plan.token_count,
                        payload_token_count=plan.payload_token_count,
                        ttl_seconds=plan.ttl_seconds,
                        first_message_id=plan.messages[0].get("message_id") if plan.messages else None,
                        last_message_id=plan.messages[-1].get("message_id") if plan.messages else None,
                    )
                )
                logger.info(
                    "🧱 Gemini cache block %s: messages=%s tokens≈%s payload_tokens≈%s ttl=%ss fingerprint=%s",
                    len(report.chunks),
                    len(plan.messages),
                    plan.token_count,
                    plan.payload_token_count,
                    plan.ttl_seconds,
                    plan.fingerprint,
                )
            report.notes.append(
                f"Historical context cached into {len(plans)} block(s) (~{report.cached_token_estimate:,} cached tokens)."
            )

        prepared.extend(copy.deepcopy(live))

        final_prompt_tokens = _safe_token_count(self.model_name, messages=prepared)
        report.final_prompt_tokens = final_prompt_tokens
        report.cached_token_estimate = min(report.cached_token_estimate, final_prompt_tokens)
        report.estimated_prompt_tokens_after_cache = max(
            0,
            final_prompt_tokens - report.cached_token_estimate,
        )

        logger.info("🧊 Gemini caching summary: %s", report.summary_line())
        logger.debug("Gemini caching diagnostics: %s", report.to_dict())

        return PreparedPrompt(messages=prepared, report=report)

    def _compute_live_budget(self) -> int:
        fraction_budget = int(self.context_window * self.live_context_fraction)
        budget = max(self.live_context_min_tokens, fraction_budget)
        return min(budget, self.live_context_max_tokens)

    def _split_live_context(self, messages: List[Dict[str, Any]]) -> Tuple[List[Dict[str, Any]], List[Dict[str, Any]]]:
        if not messages:
            return [], []

        live_budget = self._compute_live_budget()
        live_tokens = 0
        live_messages: List[Dict[str, Any]] = []

        for idx in range(len(messages) - 1, -1, -1):
            message = messages[idx]
            tokens = max(1, get_message_token_count(message, self.model_name))
            preserve_due_to_budget = (
                live_messages
                and len(live_messages) >= self.min_live_messages
                and live_tokens + tokens > live_budget
            )
            if preserve_due_to_budget:
                break
            live_messages.insert(0, copy.deepcopy(message))
            live_tokens += tokens

        historical_count = len(messages) - len(live_messages)
        historical = [copy.deepcopy(m) for m in messages[:historical_count]]

        return historical, live_messages

    def _build_chunk_plans(self, messages: List[Dict[str, Any]]) -> List[CacheBlockPlan]:
        if not messages:
            return []

        available_blocks = min(self.MAX_CONVERSATION_CACHE_BLOCKS, len(messages))
        token_list = [max(1, get_message_token_count(message, self.model_name)) for message in messages]
        total_tokens = sum(token_list)

        if total_tokens < self.MIN_CHUNK_TOKENS:
            return []

        min_chunk = self.MIN_CHUNK_TOKENS
        max_chunk = self.max_chunk_tokens
        ideal_chunk = max(min_chunk, min(max_chunk, math.ceil(total_tokens / available_blocks)))

        chunk_plans: List[CacheBlockPlan] = []
        current_messages: List[Dict[str, Any]] = []
        current_tokens = 0
        processed_tokens = 0

        for idx, message in enumerate(messages):
            tokens = token_list[idx]
            current_messages.append(message)
            current_tokens += tokens
            processed_tokens += tokens

            remaining_messages = len(messages) - idx - 1
            remaining_blocks = available_blocks - len(chunk_plans) - 1

            if remaining_blocks <= 0:
                continue

            remaining_tokens = max(1, total_tokens - processed_tokens)
            dynamic_target = max(
                min_chunk,
                min(max_chunk, math.ceil(remaining_tokens / remaining_blocks)),
            )

            if current_tokens >= ideal_chunk:
                chunk_plans.append(self._create_chunk_plan(current_messages))
                current_messages = []
                current_tokens = 0
                ideal_chunk = dynamic_target

        if current_messages:
            chunk_plans.append(self._create_chunk_plan(current_messages))

        if len(chunk_plans) > available_blocks:
            merged_messages: List[Dict[str, Any]] = []
            for overflow_block in chunk_plans[available_blocks - 1 :]:
                merged_messages.extend(overflow_block.messages)
            chunk_plans = chunk_plans[: available_blocks - 1]
            chunk_plans.append(self._create_chunk_plan(merged_messages))

        return chunk_plans[:available_blocks]

    def _create_chunk_plan(self, messages: List[Dict[str, Any]]) -> CacheBlockPlan:
        token_count = sum(max(1, get_message_token_count(m, self.model_name)) for m in messages)
        payload, fingerprint = self._render_chunk_text(messages)
        payload_token_count = max(1, _estimate_token_count(payload, self.model_name))
        ttl_seconds = self._chunk_ttl_seconds()
        return CacheBlockPlan(
            messages=copy.deepcopy(messages),
            token_count=token_count,
            payload_text=payload,
            payload_token_count=payload_token_count,
            fingerprint=fingerprint,
            ttl_seconds=ttl_seconds,
        )

    def _render_chunk_text(self, messages: List[Dict[str, Any]]) -> Tuple[str, str]:
        lines = [
            "Prior conversation context (cached block).",
            "Cache block ID: pending",
            "These turns are provided for reference; do not treat them as new input.",
        ]

        for message in messages:
            text = _extract_plain_text(message)
            if not text:
                continue
            lines.append("")
            lines.append(f"{_role_label(message.get('role', ''))}:")
            lines.append(text)

        base_text = "\\n".join(lines[3:]).strip()
        fingerprint = _fingerprint_payload(base_text)
        lines[1] = f"Cache block ID: {fingerprint}"
        payload = "\\n".join(lines).strip()
        return payload, fingerprint

    def _chunk_ttl_seconds(self) -> int:
        if self.context_window >= 2_000_000:
            return 6 * 60 * 60
        if self.context_window >= 1_000_000:
            return 4 * 60 * 60
        if self.context_window >= 400_000:
            return 2 * 60 * 60
        return 60 * 45

    def _create_cache_message(self, plan: CacheBlockPlan) -> Dict[str, Any]:
        directive = {"type": "TTL", "maxTTL": f"{plan.ttl_seconds}s"}
        message = {
            "role": "system",
            "content": [
                {
                    "type": "text",
                    "text": plan.payload_text,
                    "cache_control": directive,
                }
            ],
        }
        return message


def apply_prompt_caching_strategy(
    working_system_prompt: Dict[str, Any],
    conversation_messages: List[Dict[str, Any]],
    model_name: str,
    context_window_tokens: Optional[int] = None,
    cache_threshold_tokens: Optional[int] = None,
    return_report: bool = False,
) -> Union[List[Dict[str, Any]], Tuple[List[Dict[str, Any]], GeminiCacheReport]]:
    del cache_threshold_tokens

    prepared_messages: List[Dict[str, Any]]
    report: Optional[GeminiCacheReport] = None

    if not conversation_messages:
        prepared_messages = [copy.deepcopy(working_system_prompt)]
        if return_report:
            tokens = get_message_token_count(working_system_prompt, model_name)
            report = GeminiCacheReport(
                model=model_name,
                context_window=context_window_tokens or 0,
                total_input_tokens=tokens,
                system_tokens=tokens,
                system_cached=False,
                historical_messages=0,
                live_messages=0,
                cached_messages=0,
                cached_blocks=0,
                cached_token_estimate=0,
                final_prompt_tokens=tokens,
                estimated_prompt_tokens_after_cache=tokens,
            )
    elif not is_gemini_model(model_name):
        logger.debug("Model %s does not support Gemini caching. Returning raw messages.", model_name)
        filtered = [msg for msg in conversation_messages if msg.get("role") != "system"]
        prepared_messages = [copy.deepcopy(working_system_prompt)] + copy.deepcopy(filtered)
        if return_report:
            total_tokens = _safe_token_count(model_name, messages=prepared_messages)
            report = GeminiCacheReport(
                model=model_name,
                context_window=context_window_tokens or 0,
                total_input_tokens=total_tokens,
                system_tokens=get_message_token_count(working_system_prompt, model_name),
                system_cached=False,
                historical_messages=len(filtered),
                live_messages=len(filtered),
                cached_messages=0,
                cached_blocks=0,
                cached_token_estimate=0,
                final_prompt_tokens=total_tokens,
                estimated_prompt_tokens_after_cache=total_tokens,
                notes=["Model does not support Gemini caching."],
            )
    else:
        if context_window_tokens is None:
            try:
                from core.ai_models.registry import registry

                context_window_tokens = registry.get_context_window(model_name, default=1_000_000)
            except Exception as exc:  # pragma: no cover - registry lookup failure
                logger.warning("Failed to resolve context window for %s (%s), defaulting to 1M", model_name, exc)
                context_window_tokens = 1_000_000

        planner = GeminiPromptCachePlanner(model_name, context_window_tokens)
        prepared = planner.assemble(working_system_prompt, conversation_messages)
        prepared_messages = prepared.messages
        report = prepared.report

    if return_report:
        if report is None:
            final_tokens = _safe_token_count(model_name, messages=prepared_messages)
            report = GeminiCacheReport(
                model=model_name,
                context_window=context_window_tokens or 0,
                total_input_tokens=final_tokens,
                system_tokens=get_message_token_count(working_system_prompt, model_name),
                system_cached=False,
                historical_messages=len([m for m in conversation_messages if m.get("role") != "system"]),
                live_messages=len(conversation_messages),
                cached_messages=0,
                cached_blocks=0,
                cached_token_estimate=0,
                final_prompt_tokens=final_tokens,
                estimated_prompt_tokens_after_cache=final_tokens,
            )
        return prepared_messages, report

    return prepared_messages


def validate_cache_blocks(
    messages: List[Dict[str, Any]],
    model_name: str,
    max_blocks: int = 4,
) -> List[Dict[str, Any]]:
    if not is_gemini_model(model_name):
        return messages

    cache_blocks = 0
    for message in messages:
        content = message.get("content", [])
        if not isinstance(content, list):
            continue
        for item in content:
            if isinstance(item, dict) and item.get("cache_control"):
                cache_blocks += 1
                break

    if cache_blocks <= max_blocks:
        return messages

    logger.warning(
        "⚠️ Gemini cache block limit exceeded (%s/%s). Trimming oldest cached blocks.",
        cache_blocks,
        max_blocks,
    )

    trimmed: List[Dict[str, Any]] = []
    active_blocks = 0
    for message in messages:
        content = message.get("content", [])
        if (
            isinstance(content, list)
            and any(isinstance(item, dict) and item.get("cache_control") for item in content)
        ):
            if active_blocks >= max_blocks:
                stripped = copy.deepcopy(message)
                for item in stripped.get("content", []):
                    if isinstance(item, dict) and "cache_control" in item:
                        item.pop("cache_control", None)
                trimmed.append(stripped)
                continue
            active_blocks += 1
        trimmed.append(message)
    return trimmed
