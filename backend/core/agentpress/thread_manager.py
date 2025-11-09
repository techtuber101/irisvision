"""
Simplified conversation thread management system for AgentPress.
"""

import base64
import gzip
import json
import time
from collections import deque
from datetime import datetime, timezone, timedelta
from pathlib import Path
from textwrap import shorten
from typing import List, Dict, Any, Optional, Type, Union, AsyncGenerator, Literal, Tuple, cast
from core.services.llm import make_llm_api_call, LLMError
from core.agentpress.prompt_caching import apply_prompt_caching_strategy, validate_cache_blocks
from core.agentpress.tool import Tool
from core.agentpress.tool_registry import ToolRegistry
from core.agentpress.context_manager import ContextManager
from core.agentpress.response_processor import ResponseProcessor, ProcessorConfig
from core.agentpress.error_processor import ErrorProcessor
from core.services.supabase import DBConnection
from core.utils.logger import logger
from langfuse.client import StatefulGenerationClient, StatefulTraceClient
from core.services.langfuse import langfuse
from core.billing.billing_integration import billing_integration
from litellm.utils import token_counter
from core.services.memory_store_local import get_memory_store
from core.services import redis as redis_service

ToolChoice = Literal["auto", "required", "none"]


class RollingTokenUsageTracker:
    """Maintains a 60-second rolling window of Gemini token metrics."""

    WINDOW_SECONDS = 60

    def __init__(self) -> None:
        self._window: deque = deque()  # entries: (timestamp, prompt, completion, cache_read, cache_write)

    def record(
        self,
        prompt_tokens: int,
        completion_tokens: int,
        cache_read_tokens: int,
        cache_creation_tokens: int,
    ) -> Dict[str, int]:
        now = time.time()
        self._window.append((now, prompt_tokens, completion_tokens, cache_read_tokens, cache_creation_tokens))

        cutoff = now - self.WINDOW_SECONDS
        while self._window and self._window[0][0] < cutoff:
            self._window.popleft()

        totals = {
            "events": len(self._window),
            "prompt": 0,
            "completion": 0,
            "cache_read": 0,
            "cache_write": 0,
        }
        for _, p, c, cr, cw in self._window:
            totals["prompt"] += p
            totals["completion"] += c
            totals["cache_read"] += cr
            totals["cache_write"] += cw
        return totals


token_usage_tracker = RollingTokenUsageTracker()


class ThreadManager:
    """Manages conversation threads with LLM models and tool execution."""

    def __init__(self, trace: Optional[StatefulTraceClient] = None, agent_config: Optional[dict] = None):
        self.db = DBConnection()
        self.tool_registry = ToolRegistry()
        self.memory_store = get_memory_store()
        self._memory_reference_counts: Dict[str, int] = {}
        self._recent_tool_activity: Dict[str, float] = {}
        self._memory_metadata_cache: Dict[str, Dict[str, Any]] = {}
        self._run_metrics: Dict[str, Any] = self._init_run_metrics()
        
        self.trace = trace
        if not self.trace:
            self.trace = langfuse.trace(name="anonymous:thread_manager")
            
        self.agent_config = agent_config
        self.response_processor = ResponseProcessor(
            tool_registry=self.tool_registry,
            add_message_callback=self.add_message,
            trace=self.trace,
            agent_config=self.agent_config
        )

    def _init_run_metrics(self) -> Dict[str, Any]:
        return {
            "tokens_pre_pointer": 0,
            "tokens_post_pointer": 0,
            "pointer_count_used": 0,
            "memory_fetch_calls": 0,
            "semantic_cache_hits": 0,
        }

    def _reset_run_metrics(self) -> None:
        self._run_metrics = self._init_run_metrics()

    def _log_run_metrics(self, thread_id: str, extra: Optional[Dict[str, Any]] = None) -> None:
        payload = {"thread_id": thread_id, **self._run_metrics}
        if extra:
            payload.update(extra)
        try:
            self.memory_store.log_event("run_metrics", **payload)
        except Exception as exc:
            logger.warning(f"Failed to log run metrics: {exc}")

    def _record_pointer_usage(self, memory_id: str, subtype: Optional[str] = None) -> None:
        current = self._memory_reference_counts.get(memory_id, 0) + 1
        self._memory_reference_counts[memory_id] = current
        if subtype:
            self._recent_tool_activity[subtype] = time.time()
        self._maybe_promote_summary(memory_id)

    def _append_manifest_entry(self, filename: str, entry: Dict[str, Any]) -> None:
        manifest_dir = self.memory_store.base_dir / "manifests"
        manifest_dir.mkdir(parents=True, exist_ok=True)
        path = manifest_dir / filename
        with path.open("a", encoding="utf-8") as fp:
            fp.write(json.dumps(entry, ensure_ascii=False) + "\n")

    def _pointer_uri(self, memory_id: str, line_start: Optional[int] = None, line_end: Optional[int] = None,
                     byte_offset: Optional[int] = None, byte_len: Optional[int] = None) -> str:
        if line_start is not None and line_end is not None:
            return f"mem://{memory_id}#L{line_start}-{line_end}"
        if byte_offset is not None and byte_len is not None:
            return f"mem://{memory_id}?offset={byte_offset}&len={byte_len}"
        return f"mem://{memory_id}"

    def _create_atomic_note(self, memory_id: str, text: str, meta: Dict[str, Any]) -> None:
        lines = [line.strip() for line in text.splitlines() if line.strip()]
        bullets: List[str] = []
        for line in lines[:5]:
            bullets.append(f"- {shorten(line, width=240, placeholder='…')}")
        if not bullets:
            bullets = [f"- {shorten(text, width=240, placeholder='…')}"]
        bullets.append(f"- Pointer: {self._pointer_uri(memory_id, 1, min(len(lines), 120) or 20)}")
        entry = {
            "kind": "atomic_note",
            "memory_id": memory_id,
            "title": meta.get("title"),
            "tags": meta.get("tags") or [],
            "created_at": datetime.now(timezone.utc).isoformat(),
            "content": "\n".join(bullets),
        }
        self._append_manifest_entry("m__atomic_notes.jsonl", entry)
        self.memory_store.log_event("atomic_note", memory_id=memory_id, title=meta.get("title"))

    def _create_section_summary(self, memory_id: str, meta: Dict[str, Any], preview: str) -> None:
        pointer = self._pointer_uri(memory_id, 1, 200)
        summary_text = shorten(preview, width=1200, placeholder="…")
        entry = {
            "kind": "section_summary",
            "memory_id": memory_id,
            "title": meta.get("title"),
            "tags": meta.get("tags") or [],
            "created_at": datetime.now(timezone.utc).isoformat(),
            "content": f"{summary_text}\n\nPointer: {pointer}",
        }
        self._append_manifest_entry("m__section_summaries.jsonl", entry)
        self.memory_store.log_event("section_summary", memory_id=memory_id, title=meta.get("title"))

    def _create_doc_abstract(self, memory_id: str, meta: Dict[str, Any], preview: str) -> None:
        pointer = self._pointer_uri(memory_id)
        summary_text = shorten(preview, width=2400, placeholder="…")
        entry = {
            "kind": "doc_abstract",
            "memory_id": memory_id,
            "title": meta.get("title"),
            "tags": meta.get("tags") or [],
            "created_at": datetime.now(timezone.utc).isoformat(),
            "content": f"{summary_text}\n\nPointer: {pointer}",
        }
        self._append_manifest_entry("m__doc_abstracts.jsonl", entry)
        self.memory_store.log_event("doc_abstract", memory_id=memory_id, title=meta.get("title"))

    def _maybe_promote_summary(self, memory_id: str) -> None:
        count = self._memory_reference_counts.get(memory_id, 0)
        meta = self._memory_metadata_cache.get(memory_id)
        if not meta:
            return
        if count >= 3 and not meta.get("_section_summary"):
            try:
                preview = self.memory_store.get_slice(memory_id, 1, 200)
            except Exception:
                preview = ""
            self._create_section_summary(memory_id, meta, preview)
            meta["_section_summary"] = True
        if count >= 6 and not meta.get("_doc_abstract"):
            try:
                preview = self.memory_store.get_slice(memory_id, 1, 400)
            except Exception:
                preview = ""
            self._create_doc_abstract(memory_id, meta, preview)
            meta["_doc_abstract"] = True

    def _derive_memory_meta(
        self,
        message_type: str,
        content: Union[Dict[str, Any], List[Any], str],
        metadata: Optional[Dict[str, Any]]
    ) -> Dict[str, Any]:
        meta = {
            "type": "SUMMARY",
            "subtype": None,
            "title": None,
            "tags": [],
        }

        if metadata:
            custom_meta = metadata.get("memory_meta") or {}
            meta.update({k: v for k, v in custom_meta.items() if v is not None})
            if metadata.get("memory_tags"):
                meta["tags"] = metadata["memory_tags"]

        if isinstance(content, dict):
            role = content.get("role")
            if role == "tool":
                meta.setdefault("type", "TOOL_OUTPUT")
                meta["type"] = "TOOL_OUTPUT"
                meta.setdefault("subtype", content.get("name"))
                meta.setdefault("title", content.get("name") or content.get("tool_call_id"))
            elif message_type and "web" in message_type.lower():
                meta["type"] = "WEB_SCRAPE"
            elif message_type and "shell" in message_type.lower():
                meta["type"] = "FILE_LIST"
            elif message_type and "document" in message_type.lower():
                meta["type"] = "DOC_CHUNK"
        else:
            if message_type and "tool" in message_type.lower():
                meta["type"] = "TOOL_OUTPUT"

        if not meta.get("title"):
            if isinstance(content, dict):
                meta["title"] = content.get("title") or content.get("name")
            if not meta["title"]:
                meta["title"] = f"{message_type}:{datetime.now(timezone.utc).isoformat()}"
        return meta

    async def _cache_pointer_metadata(self, memory_info: Dict[str, Any]) -> None:
        pointer_key = f"mem:ptr:{memory_info['memory_id']}"
        payload = {
            "mime": memory_info.get("mime"),
            "bytes": memory_info.get("bytes"),
            "rel_path": memory_info.get("path"),
            "compression": memory_info.get("compression"),
        }
        try:
            await redis_service.set(pointer_key, json.dumps(payload), ex=172800)
        except Exception as exc:
            logger.warning(f"Failed to cache pointer metadata for {pointer_key}: {exc}")

    async def _offload_if_large(
        self,
        thread_id: str,
        message_type: str,
        content: Union[Dict[str, Any], List[Any], str],
        metadata: Optional[Dict[str, Any]],
    ) -> Union[Dict[str, Any], List[Any], str]:
        target_text: Optional[str] = None
        updated_content = content
        parsed_from_string: Optional[Dict[str, Any]] = None

        if isinstance(content, dict):
            possible_text = content.get("content")
            if isinstance(possible_text, str):
                target_text = possible_text
        elif isinstance(content, str):
            try:
                parsed = json.loads(content)
            except json.JSONDecodeError:
                parsed = None
            if isinstance(parsed, dict):
                parsed_from_string = parsed
                possible_text = parsed.get("content")
                if isinstance(possible_text, str):
                    target_text = possible_text
                updated_content = parsed
            else:
                target_text = content

        if target_text is None:
            return parsed_from_string or updated_content

        if len(target_text) <= 6000:
            return parsed_from_string or updated_content

        meta = self._derive_memory_meta(message_type, content, metadata)

        memory_info = self.memory_store.put_text(
            target_text,
            type=meta.get("type") or "TOOL_OUTPUT",
            subtype=meta.get("subtype"),
            mime="text/plain",
            title=meta.get("title"),
            tags=meta.get("tags"),
        )

        memory_id = memory_info["memory_id"]
        pointer = {
            "id": memory_id,
            "title": meta.get("title"),
            "mime": memory_info.get("mime", "text/plain"),
        }
        summary = target_text[:800]
        summary_with_pointer = summary + "\n\n[see memory_refs]"

        if isinstance(content, dict):
            updated = dict(content)
            updated["content"] = summary_with_pointer
            existing_refs = updated.get("memory_refs") or []
            updated["memory_refs"] = [*existing_refs, pointer]
            tokens_saved = len(target_text) // 4
            updated["tokens_saved"] = updated.get("tokens_saved", 0) + tokens_saved
            updated_content = updated
        else:
            updated_content = {
                "content": summary_with_pointer,
                "memory_refs": [pointer],
                "tokens_saved": len(target_text) // 4,
            }

        if memory_id not in self._memory_metadata_cache:
            self._memory_metadata_cache[memory_id] = dict(meta)
            self._create_atomic_note(memory_id, target_text, meta)

        self._record_pointer_usage(memory_id, meta.get("subtype"))

        self._run_metrics["tokens_pre_pointer"] += len(target_text) // 4
        self._run_metrics["pointer_count_used"] += 1

        await self._cache_pointer_metadata(memory_info)

        self.memory_store.log_event(
            "pointerized_message",
            thread_id=thread_id,
            memory_id=memory_id,
            message_type=message_type,
            bytes=len(target_text.encode("utf-8")),
        )

        return updated_content

    async def _hydrate_system_prompt(self, system_prompt: Dict[str, Any]) -> Dict[str, Any]:
        if not isinstance(system_prompt, dict):
            return system_prompt
        system_ref = system_prompt.get("system_ref")
        if not system_ref:
            return system_prompt
        cache_key = f"aga:cache:prefix:{system_ref}"
        content = system_prompt.get("content")
        if content:
            try:
                compressed = gzip.compress(content.encode("utf-8"))
                encoded = base64.b64encode(compressed).decode("ascii")
                await redis_service.set(cache_key, encoded, ex=604800)
            except Exception as exc:
                logger.warning(f"Failed to cache system prefix {system_ref}: {exc}")
            return system_prompt
        try:
            encoded = await redis_service.get(cache_key)
        except Exception as exc:
            logger.warning(f"Failed to fetch cached system prefix {system_ref}: {exc}")
            return system_prompt
        if not encoded:
            logger.warning(f"Missing cached system prefix for {system_ref}")
            return system_prompt
        try:
            raw = base64.b64decode(encoded.encode("ascii"))
            hydrated_content = gzip.decompress(raw).decode("utf-8")
            hydrated = dict(system_prompt)
            hydrated["content"] = hydrated_content
            return hydrated
        except Exception as exc:
            logger.error(f"Failed to hydrate system prefix {system_ref}: {exc}")
            return system_prompt

    def _extract_memory_refs_from_message(self, message: Dict[str, Any]) -> List[Dict[str, Any]]:
        refs: List[Dict[str, Any]] = []
        if not isinstance(message, dict):
            return refs
        if isinstance(message.get("content"), dict):
            content_refs = message["content"].get("memory_refs")
            if isinstance(content_refs, list):
                refs.extend(content_refs)
        if isinstance(message.get("memory_refs"), list):
            refs.extend(message["memory_refs"])
        return refs

    async def _plan_prefetch(self, user_text: Optional[str], messages: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        if not user_text:
            user_text = ""
        user_text_lower = user_text.lower()
        prefetched: List[Dict[str, Any]] = []
        visited_ids: set[str] = set()

        for message in reversed(messages[-12:]):  # consider recent history
            refs = self._extract_memory_refs_from_message(message)
            for ref in refs:
                memory_id = ref.get("id")
                if not memory_id or memory_id in visited_ids:
                    continue
                meta = self._memory_metadata_cache.get(memory_id)
                if not meta:
                    try:
                        meta = self.memory_store.get_metadata(memory_id)
                    except Exception as exc:
                        logger.debug(f"Failed to fetch metadata for prefetch {memory_id}: {exc}")
                        meta = None
                    if meta:
                        self._memory_metadata_cache[memory_id] = dict(meta)
                if not meta:
                    continue
                title = (ref.get("title") or meta.get("title") or "").lower()
                tags = meta.get("tags") or []
                subtype = meta.get("subtype")
                should_prefetch = False
                if title and title in user_text_lower:
                    should_prefetch = True
                elif any(isinstance(tag, str) and tag.lower() in user_text_lower for tag in tags):
                    should_prefetch = True
                elif subtype and subtype in self._recent_tool_activity:
                    if time.time() - self._recent_tool_activity[subtype] <= 600:
                        should_prefetch = True

                if should_prefetch:
                    try:
                        snippet = self.memory_store.get_slice(memory_id, 1, 120)
                    except Exception as exc:
                        logger.debug(f"Prefetch slice failed for {memory_id}: {exc}")
                        continue
                    prefetched.append(
                        {
                            "role": "system",
                            "content": f"[prefetched:{ref.get('title') or memory_id}]\n{snippet}",
                            "memory_refs": [ref],
                            "prefetched": True,
                        }
                    )
                    visited_ids.add(memory_id)
                if len(prefetched) >= 3:
                    break
            if len(prefetched) >= 3:
                break

        prefetched.reverse()
        return prefetched

    def _mark_pointer_usage_for_run(self, messages: List[Dict[str, Any]]) -> None:
        seen: set[str] = set()
        for message in messages:
            for ref in self._extract_memory_refs_from_message(message):
                memory_id = ref.get("id")
                if not memory_id or memory_id in seen:
                    continue
                meta = self._memory_metadata_cache.get(memory_id)
                subtype = meta.get("subtype") if meta else None
                self._record_pointer_usage(memory_id, subtype)
                seen.add(memory_id)

    def _extract_user_text(self, messages: List[Dict[str, Any]]) -> str:
        for message in reversed(messages):
            if not isinstance(message, dict):
                continue
            if message.get("role") != "user":
                continue
            content = message.get("content")
            if isinstance(content, dict):
                text = content.get("content")
                if isinstance(text, str):
                    return text
                return json.dumps(content, ensure_ascii=False)
            if isinstance(content, str):
                return content
        return ""

    async def build_messages_for_llm(
        self,
        system_prompt: Dict[str, Any],
        messages: List[Dict[str, Any]],
        llm_model: str,
        llm_max_tokens: Optional[int],
    ) -> Tuple[List[Dict[str, Any]], Optional[Any]]:
        context_manager = ContextManager()
        compressed_messages, compression_report = await context_manager.compress_messages(
            messages,
            llm_model,
            max_tokens=llm_max_tokens,
            system_prompt=system_prompt,
            return_report=True,
            pointer_mode=True,
        )

        user_text = self._extract_user_text(compressed_messages)
        prefetch_messages = await self._plan_prefetch(user_text, compressed_messages)

        final_messages = list(compressed_messages)
        if prefetch_messages:
            insert_idx = len(final_messages)
            for idx in range(len(final_messages) - 1, -1, -1):
                if final_messages[idx].get("role") == "user":
                    insert_idx = idx
                    break
            for offset, prefetched in enumerate(prefetch_messages):
                final_messages.insert(insert_idx + offset, prefetched)

        self._mark_pointer_usage_for_run(final_messages)

        return final_messages, compression_report

    def add_tool(self, tool_class: Type[Tool], function_names: Optional[List[str]] = None, **kwargs):
        """Add a tool to the ThreadManager."""
        self.tool_registry.register_tool(tool_class, function_names, **kwargs)

    def _apply_token_governor(
        self,
        system_prompt: Dict[str, Any],
        messages: List[Dict[str, Any]],
        llm_model: str,
    ) -> List[Dict[str, Any]]:
        try:
            projected_tokens = token_counter(model=llm_model, messages=[system_prompt] + messages)
        except Exception as exc:
            logger.debug(f"Token estimation failed in governor: {exc}")
            projected_tokens = 0

        governor_message: Optional[Dict[str, Any]] = None
        if projected_tokens > 40000:
            governor_message = {
                "role": "system",
                "content": (
                    "Context budget critical (>40k tokens). Do not expand memory pointers. "
                    "Plan actions and rely on memory_fetch with tight byte or line ranges only."
                ),
                "token_governor": True,
            }
        elif projected_tokens > 20000:
            governor_message = {
                "role": "system",
                "content": (
                    "Context budget high (>20k tokens). Summarize next steps in 3-5 bullets and "
                    "reference mem:// pointers instead of expanding them."
                ),
                "token_governor": True,
            }

        result_messages = list(messages)
        if governor_message:
            result_messages.append(governor_message)
            try:
                projected_tokens = token_counter(model=llm_model, messages=[system_prompt] + result_messages)
            except Exception as exc:
                logger.debug(f"Token post-governor estimation failed: {exc}")

        self._run_metrics["tokens_post_pointer"] = projected_tokens
        return result_messages

    def record_memory_fetch(self, count: int = 1) -> None:
        self._run_metrics["memory_fetch_calls"] += max(count, 0)

    async def create_thread(
        self,
        account_id: Optional[str] = None,
        project_id: Optional[str] = None,
        is_public: bool = False,
        metadata: Optional[Dict[str, Any]] = None
    ) -> str:
        """Create a new thread in the database."""
        # logger.debug(f"Creating new thread (account_id: {account_id}, project_id: {project_id})")
        client = await self.db.client

        thread_data = {'is_public': is_public, 'metadata': metadata or {}}
        if account_id:
            thread_data['account_id'] = account_id
        if project_id:
            thread_data['project_id'] = project_id

        try:
            result = await client.table('threads').insert(thread_data).execute()
            if result.data and len(result.data) > 0 and 'thread_id' in result.data[0]:
                thread_id = result.data[0]['thread_id']
                logger.info(f"Successfully created thread: {thread_id}")
                return thread_id
            else:
                raise Exception("Failed to create thread: no thread_id returned")
        except Exception as e:
            logger.error(f"Failed to create thread: {str(e)}", exc_info=True)
            raise Exception(f"Thread creation failed: {str(e)}")

    async def add_message(
        self,
        thread_id: str,
        type: str,
        content: Union[Dict[str, Any], List[Any], str],
        is_llm_message: bool = False,
        metadata: Optional[Dict[str, Any]] = None,
        agent_id: Optional[str] = None,
        agent_version_id: Optional[str] = None
    ):
        """Add a message to the thread in the database."""
        # logger.debug(f"Adding message of type '{type}' to thread {thread_id}")
        client = await self.db.client

        processed_content = await self._offload_if_large(thread_id, type, content, metadata)

        memory_refs = []
        if isinstance(processed_content, dict):
            memory_refs = processed_content.get("memory_refs") or []

        data_to_insert = {
            'thread_id': thread_id,
            'type': type,
            'content': processed_content,
            'is_llm_message': is_llm_message,
            'metadata': metadata or {},
        }

        if memory_refs:
            merged_metadata = dict(data_to_insert['metadata'])
            merged_metadata['memory_refs'] = memory_refs
            data_to_insert['metadata'] = merged_metadata

        if agent_id:
            data_to_insert['agent_id'] = agent_id
        if agent_version_id:
            data_to_insert['agent_version_id'] = agent_version_id

        try:
            result = await client.table('messages').insert(data_to_insert).execute()

            if result.data and len(result.data) > 0 and 'message_id' in result.data[0]:
                saved_message = result.data[0]
                
                if type == "llm_response_end" and isinstance(content, dict):
                    await self._handle_billing(thread_id, content, saved_message)
                
                return saved_message
            else:
                logger.error(f"Insert operation failed for thread {thread_id}")
                return None
        except Exception as e:
            logger.error(f"Failed to add message to thread {thread_id}: {str(e)}", exc_info=True)
            raise

    async def _handle_billing(self, thread_id: str, content: dict, saved_message: dict):
        try:
            llm_response_id = content.get("llm_response_id", "unknown")
            logger.info(f"💰 Processing billing for LLM response: {llm_response_id}")
            
            usage = content.get("usage", {})
            
            prompt_tokens = int(usage.get("prompt_tokens", 0) or 0)
            completion_tokens = int(usage.get("completion_tokens", 0) or 0)
            is_estimated = usage.get("estimated", False)
            is_fallback = usage.get("fallback", False)
            
            cache_read_tokens = int(usage.get("cache_read_input_tokens", 0) or 0)
            if cache_read_tokens == 0:
                cache_read_tokens = int(usage.get("prompt_tokens_details", {}).get("cached_tokens", 0) or 0)
            
            cache_creation_tokens = int(usage.get("cache_creation_input_tokens", 0) or 0)
            model = content.get("model")
            
            usage_type = "FALLBACK ESTIMATE" if is_fallback else ("ESTIMATED" if is_estimated else "EXACT")
            logger.info(f"💰 Usage type: {usage_type} - prompt={prompt_tokens}, completion={completion_tokens}, cache_read={cache_read_tokens}, cache_creation={cache_creation_tokens}")
            uncached_prompt_tokens = max(prompt_tokens - cache_read_tokens, 0)
            logger.debug(
                "🧮 Token breakdown (per call) model=%s prompt=%s (fresh=%s, cached_read=%s) completion=%s cache_write=%s",
                model or "unknown",
                prompt_tokens,
                uncached_prompt_tokens,
                cache_read_tokens,
                completion_tokens,
                cache_creation_tokens,
            )
            
            client = await self.db.client
            thread_row = await client.table('threads').select('account_id').eq('thread_id', thread_id).limit(1).execute()
            user_id = thread_row.data[0]['account_id'] if thread_row.data and len(thread_row.data) > 0 else None
            
            if user_id and (prompt_tokens > 0 or completion_tokens > 0):

                if cache_read_tokens > 0:
                    cache_hit_percentage = (cache_read_tokens / prompt_tokens * 100) if prompt_tokens > 0 else 0
                    logger.info(f"🎯 CACHE HIT: {cache_read_tokens}/{prompt_tokens} tokens ({cache_hit_percentage:.1f}%)")
                elif cache_creation_tokens > 0:
                    logger.info(f"💾 CACHE WRITE: {cache_creation_tokens} tokens stored for future use")
                else:
                    logger.debug(f"❌ NO CACHE: All {prompt_tokens} tokens processed fresh")

                deduct_result = await billing_integration.deduct_usage(
                    account_id=user_id,
                    prompt_tokens=prompt_tokens,
                    completion_tokens=completion_tokens,
                    model=model or "unknown",
                    message_id=saved_message['message_id'],
                    cache_read_tokens=cache_read_tokens,
                    cache_creation_tokens=cache_creation_tokens
                )

                if deduct_result.get('success'):
                    logger.info(f"Successfully deducted ${deduct_result.get('cost', 0):.6f}")
                else:
                    logger.error(f"Failed to deduct credits: {deduct_result}")

            rolling_totals = token_usage_tracker.record(
                prompt_tokens=prompt_tokens,
                completion_tokens=completion_tokens,
                cache_read_tokens=cache_read_tokens,
                cache_creation_tokens=cache_creation_tokens,
            )
            fresh_prompt_window = max(rolling_totals["prompt"] - rolling_totals["cache_read"], 0)
            logger.info(
                "📈 60s token window (events=%s): prompt≈%s (fresh≈%s, cached_read≈%s) | cache_writes≈%s | completion≈%s",
                rolling_totals["events"],
                rolling_totals["prompt"],
                fresh_prompt_window,
                rolling_totals["cache_read"],
                rolling_totals["cache_write"],
                rolling_totals["completion"],
            )
        except Exception as e:
            logger.error(f"Error handling billing: {str(e)}", exc_info=True)

    async def get_llm_messages(self, thread_id: str) -> List[Dict[str, Any]]:
        """Get all messages for a thread."""
        logger.debug(f"Getting messages for thread {thread_id}")
        client = await self.db.client

        try:
            all_messages = []
            batch_size = 1000
            offset = 0
            
            while True:
                result = await client.table('messages').select('message_id, type, content').eq('thread_id', thread_id).eq('is_llm_message', True).order('created_at').range(offset, offset + batch_size - 1).execute()
                
                if not result.data:
                    break
                    
                all_messages.extend(result.data)
                if len(result.data) < batch_size:
                    break
                offset += batch_size

            if not all_messages:
                return []

            messages = []
            for item in all_messages:
                if isinstance(item['content'], str):
                    try:
                        parsed_item = json.loads(item['content'])
                        parsed_item['message_id'] = item['message_id']
                        messages.append(parsed_item)
                    except json.JSONDecodeError:
                        logger.error(f"Failed to parse message: {item['content']}")
                else:
                    content = item['content']
                    content['message_id'] = item['message_id']
                    messages.append(content)

            return messages

        except Exception as e:
            logger.error(f"Failed to get messages for thread {thread_id}: {str(e)}", exc_info=True)
            return []
    
    async def run_thread(
        self,
        thread_id: str,
        system_prompt: Dict[str, Any],
        stream: bool = True,
        temporary_message: Optional[Dict[str, Any]] = None,
        llm_model: str = "gpt-5",
        llm_temperature: float = 0,
        llm_max_tokens: Optional[int] = None,
        processor_config: Optional[ProcessorConfig] = None,
        tool_choice: ToolChoice = "auto",
        native_max_auto_continues: int = 25,
        max_xml_tool_calls: int = 0,
        generation: Optional[StatefulGenerationClient] = None,
    ) -> Union[Dict[str, Any], AsyncGenerator]:
        """Run a conversation thread with LLM integration and tool execution."""
        logger.debug(f"🚀 Starting thread execution for {thread_id} with model {llm_model}")

        # Ensure we have a valid ProcessorConfig object
        if processor_config is None:
            config = ProcessorConfig()
        elif isinstance(processor_config, ProcessorConfig):
            config = processor_config
        else:
            logger.error(f"Invalid processor_config type: {type(processor_config)}, creating default")
            config = ProcessorConfig()
            
        if max_xml_tool_calls > 0 and not config.max_xml_tool_calls:
            config.max_xml_tool_calls = max_xml_tool_calls

        auto_continue_state = {
            'count': 0,
            'active': True,
            'continuous_state': {'accumulated_content': '', 'thread_run_id': None}
        }

        # Single execution if auto-continue is disabled
        if native_max_auto_continues == 0:
            result = await self._execute_run(
                thread_id, system_prompt, llm_model, llm_temperature, llm_max_tokens,
                tool_choice, config, stream,
                generation, auto_continue_state, temporary_message
            )
            
            # If result is an error dict, convert it to a generator that yields the error
            if isinstance(result, dict) and result.get("status") == "error":
                return self._create_single_error_generator(result)
            
            return result

        # Auto-continue execution
        return self._auto_continue_generator(
            thread_id, system_prompt, llm_model, llm_temperature, llm_max_tokens,
            tool_choice, config, stream,
            generation, auto_continue_state, temporary_message,
            native_max_auto_continues
        )

    async def _execute_run(
        self, thread_id: str, system_prompt: Dict[str, Any], llm_model: str,
        llm_temperature: float, llm_max_tokens: Optional[int], tool_choice: ToolChoice,
        config: ProcessorConfig, stream: bool, generation: Optional[StatefulGenerationClient],
        auto_continue_state: Dict[str, Any], temporary_message: Optional[Dict[str, Any]] = None
    ) -> Union[Dict[str, Any], AsyncGenerator]:
        """Execute a single LLM run."""
        
        # CRITICAL: Ensure config is always a ProcessorConfig object
        if not isinstance(config, ProcessorConfig):
            logger.error(f"ERROR: config is {type(config)}, expected ProcessorConfig. Value: {config}")
            config = ProcessorConfig()  # Create new instance as fallback
            
        try:
            # Get and prepare messages
            self._reset_run_metrics()
            system_prompt = await self._hydrate_system_prompt(system_prompt)
            messages = await self.get_llm_messages(thread_id)
            
            # Handle auto-continue context
            if auto_continue_state['count'] > 0 and auto_continue_state['continuous_state'].get('accumulated_content'):
                partial_content = auto_continue_state['continuous_state']['accumulated_content']
                messages.append({"role": "assistant", "content": partial_content})

            # ===== CENTRAL CONFIGURATION =====
            ENABLE_CONTEXT_MANAGER = True   # Set to False to disable context compression
            ENABLE_PROMPT_CACHING = True    # Set to False to disable prompt caching
            # ==================================

            compression_report = None
            if ENABLE_CONTEXT_MANAGER:
                logger.debug(f"Context manager enabled, compressing {len(messages)} messages with pointer mode")
                messages, compression_report = await self.build_messages_for_llm(
                    system_prompt, messages, llm_model, llm_max_tokens
                )
                if compression_report:
                    logger.info(f"🧮 Context compression summary: {compression_report.summary_line()}")
                    logger.debug(f"Context compression diagnostics: {compression_report.to_dict()}")
                else:
                    logger.debug(f"Context compression completed (no report): {len(messages)} messages processed")
            else:
                logger.debug("Context manager disabled, using raw messages")
                self._mark_pointer_usage_for_run(messages)

            messages = self._apply_token_governor(system_prompt, messages, llm_model)

            # Apply caching
            cache_report = None
            if ENABLE_PROMPT_CACHING:
                prepared_messages, cache_report = apply_prompt_caching_strategy(
                    system_prompt,
                    messages,
                    llm_model,
                    return_report=True,
                )
                prepared_messages = validate_cache_blocks(prepared_messages, llm_model)
                if cache_report:
                    logger.info(f"🧊 Gemini caching summary: {cache_report.summary_line()}")
                    logger.debug(f"Gemini caching diagnostics: {cache_report.to_dict()}")
                    min_expected_blocks = 1 if cache_report.system_cached else 0
                    if (
                        cache_report.historical_messages > 0
                        and cache_report.cached_blocks <= min_expected_blocks
                    ):
                        logger.warning(
                            "Gemini caching produced no historical cache blocks despite %s historical messages (~%s tokens). Notes: %s",
                            cache_report.historical_messages,
                            f"{cache_report.total_input_tokens:,}",
                            cache_report.notes,
                        )
                    self._run_metrics["semantic_cache_hits"] = cache_report.cached_blocks
            else:
                prepared_messages = [system_prompt] + messages

            # Get tool schemas if needed
            openapi_tool_schemas = self.tool_registry.get_openapi_schemas() if config.native_tool_calling else None

            # Update generation tracking
            if generation:
                try:
                    generation.update(
                        input=prepared_messages,
                        start_time=datetime.now(timezone.utc),
                        model=llm_model,
                        model_parameters={
                            "max_tokens": llm_max_tokens,
                            "temperature": llm_temperature,
                            "tool_choice": tool_choice,
                            "tools": openapi_tool_schemas,
                        }
                    )
                except Exception as e:
                    logger.warning(f"Failed to update Langfuse generation: {e}")

            # Log final prepared messages token count
            final_prepared_tokens = token_counter(model=llm_model, messages=prepared_messages)
            self._run_metrics["tokens_post_pointer"] = final_prepared_tokens
            logger.info(f"📤 Final prepared messages being sent to LLM: {final_prepared_tokens} tokens")
            if cache_report:
                logger.info(
                    "📉 Estimated fresh tokens after cache reuse: ~%s (raw input %s)",
                    f"{cache_report.estimated_prompt_tokens_after_cache:,}",
                    f"{cache_report.total_input_tokens:,}",
                )

            # Make single LLM call (no automatic flash-lite fallback)
            try:
                llm_response = await make_llm_api_call(
                    prepared_messages,
                    llm_model,
                    temperature=llm_temperature,
                    max_tokens=llm_max_tokens,
                    tools=openapi_tool_schemas,
                    tool_choice=tool_choice if config.native_tool_calling else "none",
                    stream=stream,
                )
            except LLMError as err:
                return {"type": "status", "status": "error", "message": str(err)}

            if isinstance(llm_response, dict) and llm_response.get("status") == "error":
                return llm_response

            # Process response - ensure config is ProcessorConfig object
            # logger.debug(f"Config type before response processing: {type(config)}")
            # if not isinstance(config, ProcessorConfig):
            #     logger.error(f"Config is not ProcessorConfig! Type: {type(config)}, Value: {config}")
            #     config = ProcessorConfig()  # Fallback
                
            if stream and hasattr(llm_response, '__aiter__'):
                return self.response_processor.process_streaming_response(
                    cast(AsyncGenerator, llm_response), thread_id, prepared_messages,
                    llm_model, config, True,
                    auto_continue_state['count'], auto_continue_state['continuous_state'],
                    generation
                )
            else:
                return self.response_processor.process_non_streaming_response(
                    llm_response, thread_id, prepared_messages, llm_model, config, generation
                )

        except Exception as e:
            processed_error = ErrorProcessor.process_system_error(e, context={"thread_id": thread_id})
            ErrorProcessor.log_error(processed_error)
            return processed_error.to_stream_dict()
        finally:
            try:
                self._log_run_metrics(thread_id, {"llm_model": llm_model})
            except Exception as exc:
                logger.debug(f"Run metrics logging failed: {exc}")

    async def _auto_continue_generator(
        self, thread_id: str, system_prompt: Dict[str, Any], llm_model: str,
        llm_temperature: float, llm_max_tokens: Optional[int], tool_choice: ToolChoice,
        config: ProcessorConfig, stream: bool, generation: Optional[StatefulGenerationClient],
        auto_continue_state: Dict[str, Any], temporary_message: Optional[Dict[str, Any]],
        native_max_auto_continues: int
    ) -> AsyncGenerator:
        """Generator that handles auto-continue logic."""
        logger.debug(f"Starting auto-continue generator, max: {native_max_auto_continues}")
        # logger.debug(f"Config type in auto-continue generator: {type(config)}")
        
        # Ensure config is valid ProcessorConfig
        if not isinstance(config, ProcessorConfig):
            logger.error(f"Invalid config type in auto-continue: {type(config)}, creating new one")
            config = ProcessorConfig()
        
        while auto_continue_state['active'] and auto_continue_state['count'] < native_max_auto_continues:
            auto_continue_state['active'] = False  # Reset for this iteration
            
            try:
                response_gen = await self._execute_run(
                    thread_id, system_prompt, llm_model, llm_temperature, llm_max_tokens,
                    tool_choice, config, stream,
                    generation, auto_continue_state,
                    temporary_message if auto_continue_state['count'] == 0 else None
                )

                # Handle error responses
                if isinstance(response_gen, dict) and response_gen.get("status") == "error":
                    yield response_gen
                    break

                # Process streaming response
                if hasattr(response_gen, '__aiter__'):
                    async for chunk in cast(AsyncGenerator, response_gen):
                        # Check for auto-continue triggers
                        should_continue = self._check_auto_continue_trigger(
                            chunk, auto_continue_state, native_max_auto_continues
                        )
                        
                        # Skip finish chunks that trigger auto-continue
                        if should_continue:
                            if chunk.get('type') == 'finish' and chunk.get('finish_reason') == 'tool_calls':
                                continue
                            elif chunk.get('type') == 'status':
                                try:
                                    content = json.loads(chunk.get('content', '{}'))
                                    if content.get('finish_reason') == 'length':
                                        continue
                                except (json.JSONDecodeError, TypeError):
                                    pass
                        
                        yield chunk
                else:
                    yield response_gen

                if not auto_continue_state['active']:
                    break

            except Exception as e:
                processed_error = ErrorProcessor.process_system_error(e, context={"thread_id": thread_id})
                ErrorProcessor.log_error(processed_error)
                yield processed_error.to_stream_dict()
                return

        # Handle max iterations reached
        if auto_continue_state['active'] and auto_continue_state['count'] >= native_max_auto_continues:
            logger.warning(f"Reached maximum auto-continue limit ({native_max_auto_continues})")
            yield {
                "type": "content",
                "content": f"\n[Agent reached maximum auto-continue limit of {native_max_auto_continues}]"
            }

    def _check_auto_continue_trigger(
        self, chunk: Dict[str, Any], auto_continue_state: Dict[str, Any], 
        native_max_auto_continues: int
    ) -> bool:
        """Check if a response chunk should trigger auto-continue."""
        if chunk.get('type') == 'finish':
            if chunk.get('finish_reason') == 'tool_calls':
                if native_max_auto_continues > 0:
                    logger.debug(f"Auto-continuing for tool_calls ({auto_continue_state['count'] + 1}/{native_max_auto_continues})")
                    auto_continue_state['active'] = True
                    auto_continue_state['count'] += 1
                    return True
            elif chunk.get('finish_reason') == 'xml_tool_limit_reached':
                logger.debug("Stopping auto-continue due to XML tool limit")
                auto_continue_state['active'] = False

        elif chunk.get('type') == 'status':
            try:
                content = json.loads(chunk.get('content', '{}'))
                if content.get('finish_reason') == 'length':
                    logger.debug(f"Auto-continuing for length limit ({auto_continue_state['count'] + 1}/{native_max_auto_continues})")
                    auto_continue_state['active'] = True
                    auto_continue_state['count'] += 1
                    return True
            except (json.JSONDecodeError, TypeError):
                pass
                
        return False

    async def _create_single_error_generator(self, error_dict: Dict[str, Any]):
        """Create an async generator that yields a single error message."""
        yield error_dict
