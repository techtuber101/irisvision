"""
Gemini prompt caching orchestration for AgentPress.

This module focuses on building a reliable prompt payload for Gemini models that
keeps critical instructions intact while minimising fresh token usage. It works
alongside the context manager and thread manager to transform a conversation
into three tiers:

1. **Pinned instructions** (system prompt) - cached permanently when large.
2. **Historical conversation blocks** - grouped, normalised snapshots cached
   with TTL semantics so Gemini can reuse the expensive context.
3. **Live context** - most recent turns kept uncached to avoid accidental cache
   invalidation and preserve full conversational fidelity.
"""

from __future__ import annotations

import copy
import math
from dataclasses import dataclass
from typing import Any, Dict, List, Optional, Tuple

from core.utils.logger import logger


# ---------------------------------------------------------------------------
# Provider + token helpers
# ---------------------------------------------------------------------------

def get_resolved_model_id(model_name: str) -> str:
    """Resolve model name to canonical ID through the registry."""
    try:
        from core.ai_models.registry import ModelRegistry

        registry = ModelRegistry()
        model = registry.get(model_name)
        if model:
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
    return any(keyword in resolved for keyword in ("gemini", "flash"))


def _estimate_token_count(text: str, model: str) -> int:
    """Estimate tokens using LiteLLM token counter when possible."""
    if not text:
        return 0

    try:
        from litellm import token_counter  # type: ignore

        return token_counter(model=model, text=str(text))
    except Exception as exc:  # pragma: no cover - fallback path for environments without LiteLLM
        logger.warning("LiteLLM token counting failed (%s), falling back to estimate", exc)
        return int(len(str(text).split()) * 1.3)


def get_message_token_count(message: Dict[str, Any], model: str) -> int:
    """Compute token count for a single message."""
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
    """Render a message into a deterministic, human-readable string."""
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
        collapsed = "\n".join(segment for segment in parts if segment)
        return collapsed.strip()

    if isinstance(content, dict):
        return str(content).strip()

    return str(content).strip()


def _role_label(role: str) -> str:
    """Map message role to a stable label for cached transcripts."""
    role_map = {
        "user": "User",
        "assistant": "Assistant",
        "tool": "Tool",
        "system": "System",
        "developer": "Developer",
    }
    return role_map.get(role, role.title() if role else "Unknown")


def _with_cache_control(message: Dict[str, Any], directive: Dict[str, Any]) -> Dict[str, Any]:
    """Return a deep-copied message with cache_control applied to text parts."""
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


# ---------------------------------------------------------------------------
# Gemini caching planner
# ---------------------------------------------------------------------------

@dataclass
class CacheBlockPlan:
    messages: List[Dict[str, Any]]
    token_count: int
    payload_text: str


class GeminiPromptCachePlanner:
    """Builds a cached prompt payload tailored for Gemini models."""

    MIN_SYSTEM_CACHE_TOKENS = 512
    MAX_CONVERSATION_CACHE_BLOCKS = 3  # system prompt consumes the fourth slot
    MIN_CHUNK_TOKENS = 2048

    def __init__(self, model_name: str, context_window: int):
        self.model_name = model_name
        self.context_window = max(context_window, 128_000)  # safeguard for registry misconfig

        # Live context budget: keep fresh turns uncached to avoid stale reads.
        self.live_context_min_tokens = 4_096
        self.live_context_fraction = 0.07  # 7% of context window
        self.live_context_max_tokens = max(16_384, int(self.context_window * 0.12))
        self.min_live_messages = 4

        # Cap chunk sizes to avoid ballooning a single cache block.
        self.max_chunk_tokens = max(12_000, int(self.context_window * 0.075))

    # ------------------------------------------------------------------ build
    def build(
        self,
        system_prompt: Dict[str, Any],
        conversation_messages: List[Dict[str, Any]],
    ) -> Tuple[List[Dict[str, Any]], Dict[str, Any]]:
        """Return prepared messages plus debug metadata."""
        prepared: List[Dict[str, Any]] = []
        diagnostics: Dict[str, Any] = {"model": self.model_name}

        # 1. Handle system prompt.
        system_tokens = get_message_token_count(system_prompt, self.model_name)
        diagnostics["system_tokens"] = system_tokens
        diagnostics["system_cached"] = system_tokens >= self.MIN_SYSTEM_CACHE_TOKENS

        if diagnostics["system_cached"]:
            prepared.append(
                _with_cache_control(system_prompt, {"type": "PERMANENT"})
            )
        else:
            prepared.append(copy.deepcopy(system_prompt))

        if not conversation_messages:
            diagnostics["historical_messages"] = 0
            diagnostics["live_messages"] = 0
            diagnostics["cached_blocks"] = 0
            return prepared, diagnostics

        # 2. Split into historical + live context.
        historical, live = self._split_live_context(conversation_messages)
        diagnostics["historical_messages"] = len(historical)
        diagnostics["live_messages"] = len(live)

        # 3. Build cached blocks for historical context.
        cached_blocks = self._build_chunk_plans(historical)
        diagnostics["cached_blocks"] = len(cached_blocks)

        for block in cached_blocks:
            prepared.append(self._create_cache_message(block))

        # 4. Append any remaining historical (should be empty) then live context.
        if len(cached_blocks) == 0 and historical:
            # No caching applied but history exists – include it raw to avoid loss.
            prepared.extend(copy.deepcopy(historical))

        prepared.extend(copy.deepcopy(live))

        return prepared, diagnostics

    # -------------------------------------------------------------- live split
    def _compute_live_budget(self) -> int:
        fraction_budget = int(self.context_window * self.live_context_fraction)
        budget = max(self.live_context_min_tokens, fraction_budget)
        return min(budget, self.live_context_max_tokens)

    def _split_live_context(
        self, messages: List[Dict[str, Any]]
    ) -> Tuple[List[Dict[str, Any]], List[Dict[str, Any]]]:
        """Retain the most recent messages as live (uncached) context."""
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

    # --------------------------------------------------------------- chunk plan
    def _build_chunk_plans(self, messages: List[Dict[str, Any]]) -> List[CacheBlockPlan]:
        if not messages:
            return []

        available_blocks = min(self.MAX_CONVERSATION_CACHE_BLOCKS, len(messages))
        if available_blocks <= 0:
            return []

        token_list = [
            max(1, get_message_token_count(message, self.model_name))
            for message in messages
        ]
        total_tokens = sum(token_list)

        if total_tokens == 0:
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
                chunk_plans.append(
                    self._create_chunk_plan(current_messages)
                )
                current_messages = []
                current_tokens = 0
                ideal_chunk = dynamic_target

        if current_messages:
            chunk_plans.append(self._create_chunk_plan(current_messages))

        if len(chunk_plans) > available_blocks:
            # Merge overflow into final block to respect the limit.
            merged_messages: List[Dict[str, Any]] = []
            for overflow_block in chunk_plans[available_blocks - 1 :]:
                merged_messages.extend(overflow_block.messages)
            chunk_plans = chunk_plans[: available_blocks - 1]
            chunk_plans.append(self._create_chunk_plan(merged_messages))

        return chunk_plans[:available_blocks]

    def _create_chunk_plan(self, messages: List[Dict[str, Any]]) -> CacheBlockPlan:
        token_count = sum(max(1, get_message_token_count(m, self.model_name)) for m in messages)
        payload = self._render_chunk_text(messages)
        return CacheBlockPlan(messages=copy.deepcopy(messages), token_count=token_count, payload_text=payload)

    # --------------------------------------------------------------- rendering
    def _render_chunk_text(self, messages: List[Dict[str, Any]]) -> str:
        lines = [
            "Prior conversation context (cached block).",
            "These turns are provided for reference; do not treat them as new input.",
        ]

        for message in messages:
            text = _extract_plain_text(message)
            if not text:
                continue
            lines.append("")
            lines.append(f"{_role_label(message.get('role', ''))}:")
            lines.append(text)

        return "\n".join(lines).strip()

    def _chunk_ttl_seconds(self) -> int:
        if self.context_window >= 2_000_000:
            return 6 * 60 * 60
        if self.context_window >= 1_000_000:
            return 4 * 60 * 60
        if self.context_window >= 400_000:
            return 2 * 60 * 60
        return 45 * 60

    def _create_cache_message(self, plan: CacheBlockPlan) -> Dict[str, Any]:
        directive = {"type": "TTL", "maxTTL": f"{self._chunk_ttl_seconds()}s"}
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
        logger.info(
            "🔥 Gemini cache block created (%s messages, %s tokens)",
            len(plan.messages),
            plan.token_count,
        )
        return message


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

def apply_prompt_caching_strategy(
    working_system_prompt: Dict[str, Any],
    conversation_messages: List[Dict[str, Any]],
    model_name: str,
    context_window_tokens: Optional[int] = None,
    cache_threshold_tokens: Optional[int] = None,  # retained for compatibility
) -> List[Dict[str, Any]]:
    """
    Build the final prompt payload with Gemini-aware caching.

    Parameters `cache_threshold_tokens` is maintained for backwards compatibility
    with previous callers; it is unused in the new planner.
    """
    del cache_threshold_tokens  # unused in new design

    if not conversation_messages:
        return [copy.deepcopy(working_system_prompt)]

    if not is_gemini_model(model_name):
        logger.debug("Model %s does not support Gemini caching. Returning raw messages.", model_name)
        filtered = [msg for msg in conversation_messages if msg.get("role") != "system"]
        return [copy.deepcopy(working_system_prompt)] + copy.deepcopy(filtered)

    if context_window_tokens is None:
        try:
            from core.ai_models.registry import registry

            context_window_tokens = registry.get_context_window(model_name, default=1_000_000)
        except Exception as exc:  # pragma: no cover - registry lookup failure
            logger.warning("Failed to resolve context window for %s (%s), defaulting to 1M", model_name, exc)
            context_window_tokens = 1_000_000

    planner = GeminiPromptCachePlanner(model_name, context_window_tokens)
    prepared_messages, diagnostics = planner.build(working_system_prompt, conversation_messages)

    logger.info(
        "📦 Gemini prompt caching summary - system_cached=%s, cached_blocks=%s, live_messages=%s",
        diagnostics.get("system_cached"),
        diagnostics.get("cached_blocks"),
        diagnostics.get("live_messages"),
    )
    logger.debug("Caching diagnostics: %s", diagnostics)

    return prepared_messages


def validate_cache_blocks(
    messages: List[Dict[str, Any]],
    model_name: str,
    max_blocks: int = 4,
) -> List[Dict[str, Any]]:
    """Ensure we do not exceed the provider's cache block limit."""
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

    if cache_blocks > max_blocks:
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
                    # Convert to uncached message by removing directives.
                    stripped = copy.deepcopy(message)
                    for item in stripped.get("content", []):
                        if isinstance(item, dict) and "cache_control" in item:
                            item.pop("cache_control", None)
                    trimmed.append(stripped)
                    continue
                active_blocks += 1
            trimmed.append(message)
        return trimmed

    return messages
