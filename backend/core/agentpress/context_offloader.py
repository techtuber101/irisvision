"""
Enterprise-Grade Context Offloading System

This module provides a unified, intelligent system for automatically offloading
large content to KV cache storage, dramatically reducing token usage while
maintaining seamless access for the LLM.

ULTRA-AGGRESSIVE CACHING MODE (for high token usage scenarios):
- Cache threshold: >300 tokens or >1.5k chars (was 1k/5k)
- Force cache: tool_output, file_content, view_tasks, terminal_output, assistant_message
- Recent message expansion: Only last 3 messages (was 10)
- Preview size: 200 chars (was 500)
- Assistant messages: Cached if >500 tokens

Expected impact: 60-80% token reduction for high-volume conversations.

Key Features:
- Automatic detection of large content with aggressive thresholds
- Unified caching interface for all content types
- Smart content type detection (tool outputs, files, search results, etc.)
- Seamless retrieval hints for LLM
- Enterprise-grade error handling and fallbacks
"""

import json
import uuid
import asyncio
import re
from typing import Any, Dict, Optional, Union, Tuple, List
from datetime import datetime
from litellm.utils import token_counter

from core.utils.logger import logger
from core.services.langfuse import langfuse
from core.sandbox.kv_store import SandboxKVStore, KVStoreError


# Content size thresholds - ULTRA-AGGRESSIVE caching for high token usage scenarios
# These thresholds cache almost everything to minimize token consumption
TOKEN_THRESHOLD = 300  # Cache if >300 tokens (ultra-aggressive, was 1k)
CHAR_THRESHOLD = 1500  # Cache if >1.5k chars (ultra-aggressive, was 5k)
MIN_CACHE_SIZE = 100  # Don't cache if <100 chars (was 200)


class ContextOffloader:
    """
    Enterprise-grade context offloading service.
    
    Automatically detects and caches large content to KV storage,
    replacing it with lightweight references that the LLM can retrieve on demand.
    """
    
    def __init__(self, kv_store: Optional[SandboxKVStore] = None, trace=None):
        """Initialize the ContextOffloader.
        
        Args:
            kv_store: KV store instance for caching (if None, offloading disabled)
            trace: Optional Langfuse trace to reuse
        """
        self.kv_store = kv_store
        self.enabled = kv_store is not None
        self.trace = trace if trace is not None else (langfuse.trace(name="context_offloader") if self.enabled else None)
        
        if self.enabled:
            logger.info("✅ ContextOffloader: Enterprise-grade caching enabled")
        else:
            logger.debug("ContextOffloader: Caching disabled (no KV store)")

    def _emit_event(
        self,
        name: str,
        *,
        level: str = "DEFAULT",
        status_message: str = "",
        metadata: Optional[Dict[str, Any]] = None,
    ) -> None:
        """Send structured telemetry via Langfuse (best-effort)."""
        if not self.trace:
            return
        try:
            self.trace.event(
                name=name,
                level=level,
                status_message=status_message,
                metadata=metadata or {},
            )
        except Exception as exc:
            logger.debug(f"ContextOffloader telemetry error ({name}): {exc}")
    
    def _estimate_size(self, content: Any) -> Tuple[int, int]:
        """Estimate content size in tokens and characters.
        
        Args:
            content: Content to measure
            
        Returns:
            Tuple of (token_count, char_count)
        """
        if isinstance(content, (dict, list)):
            content_str = json.dumps(content, ensure_ascii=False)
        elif isinstance(content, str):
            content_str = content
        else:
            content_str = str(content)
        
        char_count = len(content_str)
        
        # Estimate tokens (rough approximation)
        try:
            token_count = token_counter(model="gpt-4", text=content_str)
        except Exception:
            # Fallback: ~4 chars per token
            token_count = char_count // 4
        
        return token_count, char_count
    
    def _should_cache(self, content: Any, content_type: str = "generic", force_cache: bool = False) -> bool:
        """Determine if content should be cached.
        
        Args:
            content: Content to evaluate
            content_type: Type of content (for special rules)
            force_cache: If True, always cache regardless of size
            
        Returns:
            True if content should be cached
        """
        if not self.enabled:
            return False
        
        # MANDATORY: Web search results MUST be cached
        if force_cache or content_type in ["web_search", "websearch", "search"]:
            token_count, char_count = self._estimate_size(content)
            # Only skip if content is extremely small (less than 50 chars)
            if char_count < 50:
                logger.debug(f"Web search result too small to cache: {char_count} chars")
                return False
            return True
        
        # AGGRESSIVE: Force cache these high-volume content types regardless of size
        aggressive_cache_types = [
            "tool_output", "file_content", "browser_output", 
            "view_tasks", "task_list", "terminal_output",
            "assistant_message", "long_response"
        ]
        if content_type in aggressive_cache_types:
            token_count, char_count = self._estimate_size(content)
            # Cache if >100 chars (very aggressive)
            if char_count > 100:
                logger.debug(f"🔴 Aggressive caching: {content_type} ({char_count} chars) - force caching")
                return True
        
        token_count, char_count = self._estimate_size(content)
        
        # Cache if exceeds thresholds AND is large enough to justify overhead
        should_cache = (
            (token_count > TOKEN_THRESHOLD or char_count > CHAR_THRESHOLD) and
            char_count > MIN_CACHE_SIZE
        )
        
        return should_cache
    
    def _generate_artifact_key(
        self, 
        content_type: str, 
        source_id: Optional[str] = None,
        custom_key: Optional[str] = None
    ) -> str:
        """Generate a unique artifact key.
        
        Args:
            content_type: Type of content (e.g., 'tool_output', 'file_content', 'search_result')
            source_id: Optional source identifier (e.g., tool_call_id, file_path)
            custom_key: Optional custom key prefix
            
        Returns:
            Unique artifact key
        """
        if custom_key:
            base_key = custom_key
        else:
            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
            unique_id = str(uuid.uuid4())[:8]
            base_key = f"{content_type}_{timestamp}_{unique_id}"
        
        if source_id:
            # Sanitize source_id for use in key
            safe_source = "".join(c if c.isalnum() or c in "_-" else "_" for c in str(source_id))[:50]
            return f"{base_key}_{safe_source}"
        
        return base_key
    
    def _normalize_content(self, content: Any) -> str:
        """Normalize arbitrary content into a string for preview/summary generation."""
        if isinstance(content, str):
            return content
        if isinstance(content, (dict, list)):
            return json.dumps(content, ensure_ascii=False)
        return str(content)

    def _create_preview(self, content: Any, max_chars: int = 200) -> str:
        """Create a preview of content for reference messages.
        
        Args:
            content: Content to preview
            max_chars: Maximum characters in preview
            
        Returns:
            Preview string
        """
        normalized = self._normalize_content(content)
        preview = normalized[:max_chars]
        if len(normalized) > max_chars:
            preview += "..."
        return preview

    def _create_summary(self, content: Any, max_chars: int = 400) -> str:
        """Create a lightweight summary that can help the planner decide when to hydrate."""
        normalized = self._normalize_content(content)
        normalized = re.sub(r"\s+", " ", normalized).strip()
        if not normalized:
            return ""
        if len(normalized) <= max_chars:
            return normalized

        sentences = re.split(r"(?<=[.!?]) +", normalized)
        summary_parts: List[str] = []
        current_length = 0
        for sentence in sentences:
            if not sentence:
                continue
            sentence = sentence.strip()
            if not sentence:
                continue
            additional_length = len(sentence) + (1 if summary_parts else 0)
            if current_length + additional_length > max_chars:
                break
            summary_parts.append(sentence)
            current_length += additional_length

        summary = " ".join(summary_parts).strip()
        if not summary:
            summary = normalized[:max_chars]
        if len(summary) < len(normalized):
            summary = summary.rstrip() + " ..."
        return summary

    def _build_artifact_reference(
        self,
        *,
        artifact_key: str,
        scope: str,
        content_type: str,
        source_id: Optional[str],
        preview: str,
        summary: str,
        token_count: int,
        char_count: int,
        metadata_snapshot: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        """Create the lightweight reference block shared with the planner/LLM."""
        retrieval_hint = (
            "Full content stored in KV cache. Planner auto-hydrates required sections without "
            "user-facing tool calls."
        )
        return {
            "_cached": True,
            "artifact_key": artifact_key,
            "scope": scope,
            "content_type": content_type,
            "source_id": source_id,
            "preview": preview,
            "summary": summary,
            "size_tokens": token_count,
            "size_chars": char_count,
            "retrieval_hint": retrieval_hint,
            "metadata": metadata_snapshot or {},
        }
    
    async def offload_content(
        self,
        content: Any,
        content_type: str = "generic",
        source_id: Optional[str] = None,
        metadata: Optional[Dict[str, Any]] = None,
        custom_key: Optional[str] = None,
        ttl_hours: Optional[int] = None
    ) -> Optional[Dict[str, Any]]:
        """
        Offload large content to KV cache and return a reference.
        
        Args:
            content: Content to offload
            content_type: Type of content (e.g., 'tool_output', 'file_content', 'search_result')
            source_id: Optional source identifier
            metadata: Optional metadata to store with content
            custom_key: Optional custom key prefix
            ttl_hours: Optional TTL override (default: based on content_type)
            
        Returns:
            Reference dict with artifact_key and preview, or None if not cached
        """
        # Check if content should be cached
        # Check metadata for force_cache flag (for web search)
        force_cache = metadata.get("force_cached", False) if metadata else False
        should_cache = self._should_cache(content, content_type=content_type, force_cache=force_cache)
        token_count, char_count = self._estimate_size(content)
        
        if not should_cache:
            logger.debug(
                f"⏭️  Content not cached ({content_type}): {token_count:,} tokens, {char_count:,} chars - "
                f"below threshold ({TOKEN_THRESHOLD} tokens / {CHAR_THRESHOLD} chars) or caching disabled"
            )
            self._emit_event(
                "context_offloader.cache_skipped",
                metadata={
                    "content_type": content_type,
                    "source_id": source_id,
                    "size_tokens": token_count,
                    "size_chars": char_count,
                    "force_cache": force_cache,
                },
            )
            return None
        
        logger.debug(
            f"✅ Content will be cached ({content_type}): {token_count:,} tokens, {char_count:,} chars - "
            f"exceeds threshold"
        )
        
        try:
            # Check if KV store is available
            if not self.kv_store:
                logger.debug(f"⏭️  KV store not available, skipping cache for {content_type}")
                return None
            
            # Determine scope and TTL based on content type
            scope = "artifacts"  # Default scope
            default_ttl = 48  # 2 days default
            
            if content_type in ["conversation_summary", "context_summary"]:
                scope = "task"
                default_ttl = 72  # 3 days
            elif content_type in ["file_content", "workspace_state"]:
                scope = "artifacts"
                default_ttl = 24  # 1 day
            elif content_type in ["search_result", "web_search", "paper_search"]:
                scope = "artifacts"
                default_ttl = 48  # 2 days
            elif content_type == "tool_output":
                scope = "artifacts"
                default_ttl = 48  # 2 days
            
            ttl = ttl_hours if ttl_hours is not None else default_ttl
            
            # Generate artifact key
            artifact_key = self._generate_artifact_key(content_type, source_id, custom_key)
            
            # Create preview/summary before writing metadata so we can store them
            preview = self._create_preview(content)
            summary = self._create_summary(content)

            # Prepare metadata
            cache_metadata = {
                "content_type": content_type,
                "source_id": source_id,
                "cached_at": datetime.now().isoformat(),
                "size_tokens": token_count,
                "size_chars": char_count,
                "preview": preview,
                "summary": summary,
                **(metadata or {})
            }
            
            # Store in KV cache (this will auto-initialize if needed)
            await self.kv_store.put(
                scope=scope,
                key=artifact_key,
                value=content,
                ttl_hours=ttl,
                metadata=cache_metadata
            )
            
            logger.info(
                f"💾 Offloaded {content_type}: {token_count:,} tokens, {char_count:,} chars -> "
                f"artifact: {artifact_key} (scope: {scope}, TTL: {ttl}h)"
            )
            self._emit_event(
                "context_offloader.cache_write",
                metadata={
                    "artifact_key": artifact_key,
                    "scope": scope,
                    "content_type": content_type,
                    "size_tokens": token_count,
                    "size_chars": char_count,
                    "ttl_hours": ttl,
                    "source_id": source_id,
                },
            )
            
            # Log to help debug why artifacts folder might not be visible
            logger.debug(
                f"📁 KV cache artifact stored: {self.kv_store.root_path}/{scope}/{artifact_key}"
            )
            
            
            # Return reference
            return self._build_artifact_reference(
                artifact_key=artifact_key,
                scope=scope,
                content_type=content_type,
                source_id=source_id,
                preview=preview,
                summary=summary,
                token_count=token_count,
                char_count=char_count,
                metadata_snapshot={
                    "cached_at": cache_metadata["cached_at"],
                    "thread_id": metadata.get("thread_id") if metadata else None,
                    "forced_for_tool": metadata.get("forced_for_tool") if metadata else None,
                },
            )
            
        except KVStoreError as e:
            # Specific KV store errors (quota, permissions, etc.) - log at debug level
            logger.debug(f"⏭️  KV store error for {content_type} (non-critical): {e}")
            self._emit_event(
                "context_offloader.cache_error",
                level="WARNING",
                status_message=str(e),
                metadata={"content_type": content_type, "source_id": source_id},
            )
            return None
        except Exception as e:
            # Check if error is related to sandbox/filesystem not being ready
            error_str = str(e).lower()
            is_sandbox_error = any(keyword in error_str for keyword in [
                'sandbox', 'not found', 'not available', 'not started', 
                'connection', 'timeout', 'filesystem', 'asyncfilesystem',
                'create_folder', 'upload_file', 'make_dir'
            ])
            
            if is_sandbox_error:
                # Sandbox not ready yet - this is expected and will retry automatically
                logger.debug(
                    f"⏭️  Sandbox not ready for caching {content_type} "
                    f"(will retry automatically when sandbox is available): {type(e).__name__}"
                )
            else:
                # Other unexpected errors - log as warning
                logger.warning(f"⚠️  Failed to offload content ({content_type}): {e}")
                self._emit_event(
                    "context_offloader.cache_error",
                    level="ERROR",
                    status_message=str(e),
                    metadata={"content_type": content_type, "source_id": source_id},
                )
            return None
    
    async def offload_tool_output(
        self,
        tool_output: Any,
        tool_name: str,
        tool_call_id: Optional[str] = None,
        metadata: Optional[Dict[str, Any]] = None
    ) -> Optional[Dict[str, Any]]:
        """Convenience method for offloading tool outputs.
        
        Args:
            tool_output: Tool output content
            tool_name: Name of the tool
            tool_call_id: Optional tool call ID
            metadata: Optional additional metadata
            
        Returns:
            Reference dict or None
        """
        # Log size check for debugging
        token_count, char_count = self._estimate_size(tool_output)
        logger.debug(
            f"🔍 Tool output size check: {tool_name} -> {token_count:,} tokens, {char_count:,} chars "
            f"(threshold: {TOKEN_THRESHOLD} tokens or {CHAR_THRESHOLD} chars)"
        )
        
        # MANDATORY: Web search results MUST be cached regardless of size
        # This prevents them from being stored in conversation context
        is_web_search = tool_name in ['web_search', 'websearch', 'search']
        force_cache = is_web_search
        
        if force_cache:
            logger.info(
                f"🔴 MANDATORY CACHING: {tool_name} output MUST be cached "
                f"(size: {token_count:,} tokens, {char_count:,} chars)"
            )
        
        tool_metadata = {
            "tool_name": tool_name,
            "tool_call_id": tool_call_id,
            "force_cached": force_cache,
            **(metadata or {})
        }
        
        source_id = tool_call_id or tool_name
        if tool_call_id:
            safe_tool_call = "".join(c if c.isalnum() or c in "_-" else "_" for c in str(tool_call_id))[:50]
            custom_key = f"tool_output_{tool_name}_{safe_tool_call}"
        else:
            unique_suffix = str(uuid.uuid4())[:8]
            custom_key = f"tool_output_{tool_name}_{unique_suffix}"
        
        # For web search, use lower threshold to ensure caching
        # If it's still below threshold, we'll force cache it anyway
        reference = await self.offload_content(
            content=tool_output,
            content_type="web_search" if is_web_search else "tool_output",
            source_id=source_id,
            metadata=tool_metadata,
            custom_key=custom_key
        )
        
        # If web search wasn't cached (shouldn't happen, but safety check)
        if is_web_search and not reference:
            # Force cache with minimal threshold override
            logger.warning(
                f"⚠️  Web search result not cached (unexpected), attempting force cache: "
                f"{tool_name} ({token_count:,} tokens, {char_count:,} chars)"
            )
            # Try again with explicit content type that has lower threshold
            reference = await self.offload_content(
                content=tool_output,
                content_type="web_search",
                source_id=source_id,
                metadata={**tool_metadata, "force_cached": True},
                custom_key=custom_key
            )
        
        if reference:
            logger.info(
                f"✅ Cached tool output: {tool_name} ({token_count:,} tokens, {char_count:,} chars) -> "
                f"artifact: {reference.get('artifact_key')} in scope: {reference.get('scope')}"
            )
        else:
            if is_web_search:
                logger.error(
                    f"❌ CRITICAL: Failed to cache web search result: {tool_name} "
                    f"({token_count:,} tokens, {char_count:,} chars) - this should not happen!"
                )
            else:
                logger.debug(
                    f"⏭️  Tool output not cached: {tool_name} ({token_count:,} tokens, {char_count:,} chars) - "
                    f"below threshold ({TOKEN_THRESHOLD} tokens / {CHAR_THRESHOLD} chars) or caching disabled"
                )
        
        return reference
    
    async def offload_search_results(
        self,
        search_results: Any,
        search_type: str,
        query: Optional[str] = None,
        metadata: Optional[Dict[str, Any]] = None
    ) -> Optional[Dict[str, Any]]:
        """Convenience method for offloading search results.
        
        Args:
            search_results: Search results content
            search_type: Type of search (e.g., 'web_search', 'paper_search', 'company_search')
            query: Optional search query
            metadata: Optional additional metadata
            
        Returns:
            Reference dict or None
        """
        search_metadata = {
            "search_type": search_type,
            "query": query,
            **(metadata or {})
        }
        
        source_id = query or search_type
        custom_key = f"search_{search_type}"
        
        return await self.offload_content(
            content=search_results,
            content_type=search_type,
            source_id=source_id,
            metadata=search_metadata,
            custom_key=custom_key
        )
    
    async def offload_file_content(
        self,
        file_content: str,
        file_path: str,
        metadata: Optional[Dict[str, Any]] = None
    ) -> Optional[Dict[str, Any]]:
        """Convenience method for offloading file contents.
        
        Args:
            file_content: File content
            file_path: Path to the file
            metadata: Optional additional metadata
            
        Returns:
            Reference dict or None
        """
        file_metadata = {
            "file_path": file_path,
            **(metadata or {})
        }
        
        # Use sanitized file path as source_id
        safe_path = "".join(c if c.isalnum() or c in "/_-." else "_" for c in file_path)[:100]
        custom_key = f"file_content_{safe_path}"
        
        return await self.offload_content(
            content=file_content,
            content_type="file_content",
            source_id=safe_path,
            metadata=file_metadata,
            custom_key=custom_key,
            ttl_hours=24  # Files change, shorter TTL
        )
    
    async def retrieve_content(self, artifact_key: str, scope: str = "artifacts") -> Optional[Any]:
        """Retrieve content from KV cache.
        
        Args:
            artifact_key: Artifact key to retrieve
            scope: Scope to search in (default: 'artifacts')
            
        Returns:
            Retrieved content or None if not found
        """
        if not self.enabled:
            return None
        
        try:
            content = await self.kv_store.get(scope=scope, key=artifact_key, as_type="auto")
            logger.debug(f"✓ Retrieved content from cache: {artifact_key}")
            self._emit_event(
                "context_offloader.retrieve_hit",
                metadata={
                    "artifact_key": artifact_key,
                    "scope": scope,
                    "content_type": type(content).__name__ if content is not None else "None",
                },
            )
            return content
        except Exception as e:
            logger.debug(f"Cache miss for {artifact_key}: {e}")
            self._emit_event(
                "context_offloader.retrieve_miss",
                level="WARNING",
                status_message=str(e),
                metadata={"artifact_key": artifact_key, "scope": scope},
            )
            return None
    
    def create_reference_message(
        self,
        reference: Dict[str, Any],
        original_content: Any = None
    ) -> Union[Dict[str, Any], str]:
        """
        Create a message-friendly reference from a cache reference.
        
        For native tool calls, returns a JSON string.
        For structured results, returns a dict.
        
        Args:
            reference: Reference dict from offload_content
            original_content: Optional original content (for fallback)
            
        Returns:
            Reference message (dict or JSON string)
        """
        if not reference:
            # Fallback to original content if offloading failed
            if original_content is not None:
                if isinstance(original_content, (dict, list)):
                    return json.dumps(original_content) if isinstance(original_content, dict) else original_content
                return str(original_content)
            return ""
        
        # Create compact reference
        ref_message = {
            "_cached": True,
            "artifact_key": reference["artifact_key"],
            "preview": reference["preview"],
            "size_tokens": reference.get("size_tokens", 0),
            "retrieval_hint": reference.get("retrieval_hint", ""),
            "scope": reference.get("scope", "artifacts")
        }
        
        return ref_message
    
    async def expand_cached_references(
        self,
        messages: List[Dict[str, Any]],
        auto_expand: bool = True,
        expand_recent_only: bool = True,
        recent_message_count: int = 10
    ) -> List[Dict[str, Any]]:
        """
        Intelligently expand cached references on-demand.
        
        Strategy:
        - Keep references in older messages (saves tokens)
        - Automatically expand references in recent/active messages (LLM needs them now)
        - This gives LLM instant access without tool calls, while saving tokens
        
        PERFORMANCE: Fast-path check - skip if no cached references found
        
        Args:
            messages: List of messages that may contain cached references
            auto_expand: If True, automatically retrieve and expand cached content
            expand_recent_only: If True, only expand references in recent messages (saves tokens)
            recent_message_count: Number of recent messages to expand (if expand_recent_only=True)
            
        Returns:
            Messages with cached references intelligently expanded
        """
        if not self.enabled or not auto_expand:
            return messages
        
        # FAST PATH: Quick check if any messages have cached references (avoid unnecessary work)
        has_cached_refs = False
        for msg in messages[-recent_message_count:] if expand_recent_only and len(messages) > recent_message_count else messages:
            content = msg.get("content", "")
            if isinstance(content, str):
                if "_cached" in content and "artifact_key" in content:
                    has_cached_refs = True
                    break
            elif isinstance(content, dict):
                if content.get("_cached") is True:
                    has_cached_refs = True
                    break
        
        if not has_cached_refs:
            # No cached references found, return messages as-is (fast path)
            logger.debug("⚡ Fast path: No cached references found, skipping expansion")
            return messages
        
        # Strategy: Expand recent messages (LLM needs them now), keep older as references
        # PERFORMANCE: Expand in parallel for speed
        if expand_recent_only and len(messages) > recent_message_count:
            # Older messages: Keep as references (saves tokens, LLM can retrieve if needed)
            older_messages = messages[:-recent_message_count]
            
            # Recent messages: Expand automatically in PARALLEL (LLM needs them immediately)
            recent_messages = messages[-recent_message_count:]
            # Expand in parallel for speed (non-blocking)
            expansion_tasks = [self._expand_message_cached_content(msg) for msg in recent_messages]
            expanded_recent = await asyncio.gather(*expansion_tasks, return_exceptions=True)
            
            # Filter out exceptions (keep original message if expansion fails)
            expanded_recent = [
                msg if not isinstance(msg, Exception) else recent_messages[i]
                for i, msg in enumerate(expanded_recent)
            ]
            
            # Combine: older messages keep references, recent messages expanded
            logger.debug(f"📦 Smart expansion: {len(older_messages)} messages with references, {len(expanded_recent)} recent messages expanded (parallel)")
            return older_messages + expanded_recent
        else:
            # Expand all messages in parallel (for short conversations)
            expansion_tasks = [self._expand_message_cached_content(msg) for msg in messages]
            expanded_messages = await asyncio.gather(*expansion_tasks, return_exceptions=True)
            
            # Filter out exceptions
            expanded_messages = [
                msg if not isinstance(msg, Exception) else messages[i]
                for i, msg in enumerate(expanded_messages)
            ]
            
            return expanded_messages
    
    async def expand_reference_on_demand(
        self,
        artifact_key: str,
        scope: str = "artifacts"
    ) -> Optional[Any]:
        """
        Instantly retrieve cached content on-demand without tool calls.
        
        This is called automatically when the LLM needs cached content.
        The content is retrieved instantly from KV cache.
        
        Args:
            artifact_key: Artifact key to retrieve
            scope: Scope to search in (default: 'artifacts')
            
        Returns:
            Retrieved content or None if not found
        """
        return await self.retrieve_content(artifact_key, scope)
    
    async def _expand_message_cached_content(self, message: Dict[str, Any]) -> Dict[str, Any]:
        """Expand cached references in a single message.
        
        Args:
            message: Message dict that may contain cached references
            
        Returns:
            Message with cached content expanded
        """
        if not isinstance(message, dict):
            return message
        
        content = message.get("content")
        if not content:
            return message
        
        # Handle string content (may be JSON)
        if isinstance(content, str):
            try:
                parsed = json.loads(content)
                if isinstance(parsed, dict):
                    expanded = await self._expand_cached_dict(parsed)
                    if expanded != parsed:
                        # Content was expanded, update message
                        message = message.copy()
                        message["content"] = json.dumps(expanded) if isinstance(expanded, dict) else str(expanded)
                        logger.debug(f"✓ Expanded cached reference in message")
                return message
            except (json.JSONDecodeError, TypeError):
                # Not JSON, check if it contains cached reference pattern
                if "_cached" in content and "artifact_key" in content:
                    # Try to extract artifact key and expand
                    try:
                        # Simple extraction - look for artifact_key pattern
                        import re
                        match = re.search(r'"artifact_key"\s*:\s*"([^"]+)"', content)
                        if match:
                            artifact_key = match.group(1)
                            # Try to find scope
                            scope_match = re.search(r'"scope"\s*:\s*"([^"]+)"', content)
                            scope = scope_match.group(1) if scope_match else "artifacts"
                            
                            full_content = await self.retrieve_content(artifact_key, scope)
                            if full_content:
                                message = message.copy()
                                message["content"] = json.dumps(full_content) if isinstance(full_content, (dict, list)) else str(full_content)
                                logger.debug(f"✓ Expanded cached reference: {artifact_key}")
                    except Exception as e:
                        logger.debug(f"Could not expand cached reference in string: {e}")
                return message
        
        # Handle dict content
        elif isinstance(content, dict):
            expanded = await self._expand_cached_dict(content)
            if expanded != content:
                message = message.copy()
                message["content"] = expanded
                logger.debug(f"✓ Expanded cached reference in dict message")
            return message
        
        # Handle list content (array of content parts)
        elif isinstance(content, list):
            expanded_list = []
            for item in content:
                if isinstance(item, dict):
                    expanded_item = await self._expand_cached_dict(item)
                    expanded_list.append(expanded_item)
                else:
                    expanded_list.append(item)
            
            if expanded_list != content:
                message = message.copy()
                message["content"] = expanded_list
                logger.debug(f"✓ Expanded cached references in list message")
            return message
        
        return message
    
    async def _expand_cached_dict(self, obj: Any) -> Any:
        """Recursively expand cached references in a dict/list structure.
        
        Args:
            obj: Dict, list, or other object that may contain cached references
            
        Returns:
            Object with cached references expanded
        """
        if isinstance(obj, dict):
            # Check if this is a cached reference
            if obj.get("_cached") is True and "artifact_key" in obj:
                artifact_key = obj.get("artifact_key")
                scope = obj.get("scope", "artifacts")
                
                # Retrieve full content
                full_content = await self.retrieve_content(artifact_key, scope)
                if full_content:
                    logger.info(f"🔄 Auto-expanded cached content: {artifact_key} ({scope})")
                    return full_content
                else:
                    # Cache miss, return original with note
                    logger.warning(f"⚠️ Cache miss for {artifact_key}, keeping reference")
                    return obj
            
            # Recursively process dict
            expanded = {}
            for key, value in obj.items():
                expanded[key] = await self._expand_cached_dict(value)
            return expanded
        
        elif isinstance(obj, list):
            # Recursively process list
            return [await self._expand_cached_dict(item) for item in obj]
        
        else:
            # Primitive type, return as-is
            return obj
