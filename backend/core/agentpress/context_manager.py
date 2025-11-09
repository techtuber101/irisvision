"""
Context Management for AgentPress Threads.

This module handles token counting and thread summarization to prevent
reaching the context window limitations of LLM models.
"""

import json
from dataclasses import dataclass, field
from typing import List, Dict, Any, Optional, Union, Tuple

from litellm.utils import token_counter
from core.services.supabase import DBConnection
from core.utils.logger import logger
from core.ai_models import model_manager
from core.services.llm import make_llm_api_call
from core.sandbox.kv_store import SandboxKVStore


@dataclass
class CompressionPhaseStats:
    """Represents a single optimization pass performed on the transcript."""

    name: str
    tokens_before: int
    tokens_after: int
    messages_before: int
    messages_after: int
    details: Dict[str, Any] = field(default_factory=dict)

    @property
    def tokens_saved(self) -> int:
        return max(0, self.tokens_before - self.tokens_after)


@dataclass
class CompressionReport:
    """Structured diagnostics for context compression."""

    model: str
    initial_tokens: int
    final_tokens: int = 0
    summarized_messages: int = 0
    summary_failures: int = 0
    truncated_messages: int = 0
    removed_messages: int = 0
    tool_messages_preserved: int = 0
    tokens_saved: int = 0
    phases: List[CompressionPhaseStats] = field(default_factory=list)

    def add_phase(
        self,
        name: str,
        tokens_before: int,
        tokens_after: int,
        messages_before: int,
        messages_after: int,
        details: Optional[Dict[str, Any]] = None,
    ) -> None:
        details = details or {}
        phase = CompressionPhaseStats(
            name=name,
            tokens_before=tokens_before,
            tokens_after=tokens_after,
            messages_before=messages_before,
            messages_after=messages_after,
            details=details,
        )
        self.phases.append(phase)
        self.tokens_saved += phase.tokens_saved

    def compression_ratio(self) -> float:
        if self.initial_tokens <= 0:
            return 0.0
        return max(0.0, 1 - (self.final_tokens / self.initial_tokens))

    def to_dict(self) -> Dict[str, Any]:
        return {
            "model": self.model,
            "initial_tokens": self.initial_tokens,
            "final_tokens": self.final_tokens,
            "tokens_saved": max(0, self.initial_tokens - self.final_tokens),
            "compression_ratio": round(self.compression_ratio(), 4),
            "summarized_messages": self.summarized_messages,
            "summary_failures": self.summary_failures,
            "truncated_messages": self.truncated_messages,
            "removed_messages": self.removed_messages,
            "tool_messages_preserved": self.tool_messages_preserved,
            "phases": [
                {
                    "name": phase.name,
                    "tokens_before": phase.tokens_before,
                    "tokens_after": phase.tokens_after,
                    "messages_before": phase.messages_before,
                    "messages_after": phase.messages_after,
                    "tokens_saved": phase.tokens_saved,
                    "details": phase.details,
                }
                for phase in self.phases
            ],
        }

    def summary_line(self) -> str:
        delta = max(0, self.initial_tokens - self.final_tokens)
        ratio_pct = self.compression_ratio() * 100
        return (
            f"{self.initial_tokens:,} -> {self.final_tokens:,} tokens "
            f"(saved ~{delta:,} | {ratio_pct:.1f}%); "
            f"summarized={self.summarized_messages}, truncated={self.truncated_messages}, "
            f"removed={self.removed_messages}, failures={self.summary_failures}"
        )

DEFAULT_TOKEN_THRESHOLD = 50_000  # Lowered from 70k to trigger compression earlier
SUMMARIZATION_TOKEN_THRESHOLD = 30_000  # Trigger summarization earlier (~30k tokens)

class ContextManager:
    """Manages thread context including token counting and summarization."""
    
    def __init__(self, token_threshold: int = DEFAULT_TOKEN_THRESHOLD, kv_store: Optional[SandboxKVStore] = None):
        """Initialize the ContextManager.
        
        Args:
            token_threshold: Token count threshold to trigger summarization
            kv_store: Optional KV store for caching summaries (if None, no caching)
        """
        self.db = DBConnection()
        self.token_threshold = token_threshold
        self.kv_store = kv_store
        self._cache_enabled = kv_store is not None
        
        if self._cache_enabled:
            logger.info("ContextManager: KV cache enabled for conversation summaries")

    def _mark_message(self, msg: Dict[str, Any], marker: str) -> None:
        """Annotate a message with the given compression marker."""
        if not isinstance(msg, dict):
            return
        existing = msg.get("_compression_ops")
        if isinstance(existing, list):
            if marker not in existing:
                existing.append(marker)
            msg["_compression_ops"] = existing
        elif existing:
            msg["_compression_ops"] = [existing, marker]
        else:
            msg["_compression_ops"] = [marker]

    def is_tool_result_message(self, msg: Dict[str, Any]) -> bool:
        """Check if a message is a tool result message."""
        if not isinstance(msg, dict) or not ("content" in msg and msg['content']):
            return False
        content = msg['content']
        if isinstance(content, str) and "ToolResult" in content: 
            return True
        if isinstance(content, dict) and "tool_execution" in content: 
            return True
        if isinstance(content, dict) and "interactive_elements" in content: 
            return True
        if isinstance(content, str):
            try:
                parsed_content = json.loads(content)
                if isinstance(parsed_content, dict) and "tool_execution" in parsed_content: 
                    return True
                if isinstance(parsed_content, dict) and "interactive_elements" in content: 
                    return True
            except (json.JSONDecodeError, TypeError):
                pass
        return False
    
    def has_tool_calls(self, msg: Dict[str, Any]) -> bool:
        """Check if a message contains tool calls that must be preserved."""
        if not isinstance(msg, dict):
            return False
        
        # Check for native tool_calls field (OpenAI format)
        if msg.get('tool_calls'):
            return True
        
        content = msg.get('content')
        
        # Handle string content (could be JSON string)
        if isinstance(content, str):
            # Quick check for XML tool calls in string
            if '<function_calls>' in content or '<invoke' in content:
                return True
            # Try to parse as JSON
            try:
                content = json.loads(content)
            except (json.JSONDecodeError, TypeError):
                pass
        
        # Handle dict content
        if isinstance(content, dict):
            # Native format: tool_calls in content
            if content.get('tool_calls'):
                return True
            
            # Tool execution format (already handled by is_tool_result_message)
            if content.get('tool_execution'):
                return True
            
            # Check nested content string for XML
            nested_content = content.get('content', '')
            if isinstance(nested_content, str):
                if '<function_calls>' in nested_content or '<invoke' in nested_content:
                    return True
        
        return False
    
    def is_tool_related_message(self, msg: Dict[str, Any]) -> bool:
        """Check if message contains any tool-related data (calls or results) that must be preserved."""
        return self.has_tool_calls(msg) or self.is_tool_result_message(msg)
    
    async def _get_cached_summary(self, message_id: str) -> Optional[str]:
        """Retrieve cached summary from KV store if available.
        
        Args:
            message_id: Unique identifier for the message
            
        Returns:
            Cached summary string or None if not found
        """
        if not self._cache_enabled or not message_id:
            return None
        
        try:
            result = await self.kv_store.get(scope="task", key=f"summary_{message_id}", as_type="str")
            if result:
                logger.debug(f"✓ Retrieved cached summary for message {message_id}")
            return result
        except Exception as e:
            logger.debug(f"Cache miss for message {message_id}: {e}")
            return None
    
    async def _store_summary_cache(self, message_id: str, summary: str) -> None:
        """Store summary in KV cache for future use.
        
        Args:
            message_id: Unique identifier for the message
            summary: The generated summary
        """
        if not self._cache_enabled or not message_id:
            return
        
        try:
            import datetime
            await self.kv_store.put(
                scope="task",
                key=f"summary_{message_id}",
                value=summary,
                metadata={
                    "type": "conversation_summary",
                    "timestamp": datetime.datetime.now().isoformat(),
                    "version": "1.0"
                }
            )
            logger.debug(f"✓ Stored summary cache for message {message_id}")
        except Exception as e:
            logger.warning(f"Failed to cache summary for message {message_id}: {e}")
    
    async def summarize_message(
        self, 
        message: Dict[str, Any], 
        max_summary_tokens: int = 150
    ) -> str:
        """Summarize a message using Gemini 2.5 Flash Lite, preserving key information.
        
        Uses KV cache to store/retrieve summaries for performance.
        
        Args:
            message: The message dict to summarize
            max_summary_tokens: Maximum tokens for the summary (default 150 to allow 4-5 lines)
            
        Returns:
            Summary string
        """
        # Try to get cached summary first
        message_id = message.get('id') or message.get('message_id')
        if message_id:
            cached = await self._get_cached_summary(message_id)
            if cached:
                return cached
        
        content = message.get('content', '')
        role = message.get('role', 'unknown')
        
        # Parse content if needed
        if isinstance(content, str):
            try:
                content = json.loads(content)
            except (json.JSONDecodeError, TypeError):
                pass
        
        # Extract text content
        text = ""
        if isinstance(content, dict):
            text = content.get('content', '') or str(content)
        else:
            text = str(content)
        
        if not text or len(text.strip()) < 30:
            return text  # Too short to summarize
        
        # Truncate very long content to avoid API limits
        max_input_length = 8000
        if len(text) > max_input_length:
            text = text[:max_input_length] + "... [truncated for summarization]"
        
        prompt = f"""Summarize this {role} message in 4-5 lines (max 150 tokens total). Preserve:
- Main intent, request, or key question
- Important context or information shared
- Key decisions, conclusions, or outcomes
- Essential details that might be needed later

Be concise but comprehensive. Aim for significant reduction while keeping important information.

Message:
{text}
"""
        
        try:
            # Use Gemini 2.5 Flash Lite for fast, cheap summarization
            response = await make_llm_api_call(
                messages=[{"role": "user", "content": prompt}],
                model_name="gemini/gemini-2.5-flash-lite",
                temperature=0.1,
                max_tokens=max_summary_tokens,
                stream=False  # Non-streaming for summarization
            )
            
            # Handle different response formats
            if isinstance(response, str):
                return response.strip()
            elif isinstance(response, dict):
                # Extract content from response
                if 'choices' in response and response['choices']:
                    content = response['choices'][0].get('message', {}).get('content', '')
                    if content:
                        return content.strip()
                # Fallback to direct content field
                return response.get('content', text).strip()
            else:
                # Handle LiteLLM ModelResponse object
                try:
                    # ModelResponse from litellm has choices attribute
                    if hasattr(response, 'choices') and response.choices:
                        first_choice = response.choices[0]
                        if hasattr(first_choice, 'message'):
                            content = first_choice.message.content
                            if content:
                                summary = content.strip()
                                # Cache the successful summary
                                if message_id:
                                    await self._store_summary_cache(message_id, summary)
                                return summary
                        # Try dict-style access
                        elif isinstance(first_choice, dict):
                            content = first_choice.get('message', {}).get('content', '')
                            if content:
                                return content.strip()
                    # Try direct content attribute
                    if hasattr(response, 'content'):
                        content = response.content
                        if content:
                            return str(content).strip()
                except Exception as e:
                    logger.debug(f"Failed to extract content from response object: {e}")
                return text
        except Exception as e:
            logger.warning(f"Summarization failed for message: {e}, using original text")
            return text
    
    def compress_message(self, msg_content: Union[str, dict], message_id: Optional[str] = None, max_length: int = 3000) -> Union[str, dict]:
        """Compress the message content."""
        if isinstance(msg_content, str):
            if len(msg_content) > max_length:
                return msg_content[:max_length] + "... (truncated)" + f"\n\nmessage_id \"{message_id}\"\nUse expand-message tool to see contents"
            else:
                return msg_content
        
    def safe_truncate(self, msg_content: Union[str, dict], max_length: int = 100000) -> Union[str, dict]:
        """Truncate the message content safely by removing the middle portion."""
        max_length = min(max_length, 100000)
        if isinstance(msg_content, str):
            if len(msg_content) > max_length:
                # Calculate how much to keep from start and end
                keep_length = max_length - 150  # Reserve space for truncation message
                start_length = keep_length // 2
                end_length = keep_length - start_length
                
                start_part = msg_content[:start_length]
                end_part = msg_content[-end_length:] if end_length > 0 else ""
                
                return start_part + f"\n\n... (middle truncated) ...\n\n" + end_part + f"\n\nThis message is too long, repeat relevant information in your response to remember it"
            else:
                return msg_content
        elif isinstance(msg_content, dict):
            json_str = json.dumps(msg_content)
            if len(json_str) > max_length:
                # Calculate how much to keep from start and end
                keep_length = max_length - 150  # Reserve space for truncation message
                start_length = keep_length // 2
                end_length = keep_length - start_length
                
                start_part = json_str[:start_length]
                end_part = json_str[-end_length:] if end_length > 0 else ""
                
                return start_part + f"\n\n... (middle truncated) ...\n\n" + end_part + f"\n\nThis message is too long, repeat relevant information in your response to remember it"
            else:
                return msg_content
  
    def compress_tool_result_messages(
        self,
        messages: List[Dict[str, Any]],
        llm_model: str,
        max_tokens: Optional[int],
        token_threshold: int = 768,
        uncompressed_total_token_count: Optional[int] = None,
    ) -> Tuple[List[Dict[str, Any]], int]:
        """Compress the tool result messages except the most recent one.
        
        Compression is deterministic (simple truncation), ensuring consistent results across requests.
        This allows prompt caching (applied later) to produce cache hits on identical compressed content.
        """
        if uncompressed_total_token_count is None:
            uncompressed_total_token_count = token_counter(model=llm_model, messages=messages)

        max_tokens_value = max_tokens or (100 * 1000)
        truncated_count = 0
        if uncompressed_total_token_count > max_tokens_value:
            _i = 0  # Count the number of ToolResult messages
            for msg in reversed(messages):  # Start from the end and work backwards
                if not isinstance(msg, dict):
                    continue  # Skip non-dict messages
                if self.is_tool_result_message(msg):  # Only compress ToolResult messages
                    _i += 1  # Count the number of ToolResult messages
                    msg_token_count = token_counter(model=llm_model, messages=[msg])  # Count the number of tokens in the message
                    if msg_token_count > token_threshold:  # If the message is too long
                        modified = False
                        if _i > 1:  # If this is not the most recent ToolResult message
                            message_id = msg.get('message_id')  # Get the message_id
                            if message_id:
                                new_content = self.compress_message(msg["content"], message_id, token_threshold * 3)
                                if new_content != msg.get("content"):
                                    msg["content"] = new_content
                                    modified = True
                            else:
                                logger.warning(f"UNEXPECTED: Message has no message_id {str(msg)[:100]}")
                        else:
                            new_content = self.safe_truncate(msg["content"], int(max_tokens_value * 2))
                            if new_content != msg.get("content"):
                                msg["content"] = new_content
                                modified = True
                        if modified:
                            truncated_count += 1
                            self._mark_message(msg, "tool_truncate")
        return messages, truncated_count

    def compress_user_messages(
        self,
        messages: List[Dict[str, Any]],
        llm_model: str,
        max_tokens: Optional[int],
        token_threshold: int = 768,
        uncompressed_total_token_count: Optional[int] = None,
    ) -> Tuple[List[Dict[str, Any]], int]:
        """Compress the user messages except the most recent one.
        
        Compression is deterministic (simple truncation), ensuring consistent results across requests.
        This allows prompt caching (applied later) to produce cache hits on identical compressed content.
        """
        if uncompressed_total_token_count is None:
            uncompressed_total_token_count = token_counter(model=llm_model, messages=messages)

        max_tokens_value = max_tokens or (100 * 1000)
        truncated_count = 0
        if uncompressed_total_token_count > max_tokens_value:
            _i = 0  # Count the number of User messages
            for msg in reversed(messages):  # Start from the end and work backwards
                if not isinstance(msg, dict):
                    continue  # Skip non-dict messages
                if msg.get('role') == 'user':  # Only compress User messages
                    _i += 1  # Count the number of User messages
                    msg_token_count = token_counter(model=llm_model, messages=[msg])  # Count the number of tokens in the message
                    if msg_token_count > token_threshold:  # If the message is too long
                        modified = False
                        if _i > 1:  # If this is not the most recent User message
                            message_id = msg.get('message_id')  # Get the message_id
                            if message_id:
                                new_content = self.compress_message(msg["content"], message_id, token_threshold * 3)
                                if new_content != msg.get("content"):
                                    msg["content"] = new_content
                                    modified = True
                            else:
                                logger.warning(f"UNEXPECTED: Message has no message_id {str(msg)[:100]}")
                        else:
                            new_content = self.safe_truncate(msg["content"], int(max_tokens_value * 2))
                            if new_content != msg.get("content"):
                                msg["content"] = new_content
                                modified = True
                        if modified:
                            truncated_count += 1
                            self._mark_message(msg, "user_truncate")
        return messages, truncated_count

    def compress_assistant_messages(
        self,
        messages: List[Dict[str, Any]],
        llm_model: str,
        max_tokens: Optional[int],
        token_threshold: int = 768,
        uncompressed_total_token_count: Optional[int] = None,
    ) -> Tuple[List[Dict[str, Any]], int]:
        """Compress the assistant messages except the most recent one.
        
        Compression is deterministic (simple truncation), ensuring consistent results across requests.
        This allows prompt caching (applied later) to produce cache hits on identical compressed content.
        """
        if uncompressed_total_token_count is None:
            uncompressed_total_token_count = token_counter(model=llm_model, messages=messages)

        max_tokens_value = max_tokens or (100 * 1000)
        truncated_count = 0
        if uncompressed_total_token_count > max_tokens_value:
            _i = 0  # Count the number of Assistant messages
            for msg in reversed(messages):  # Start from the end and work backwards
                if not isinstance(msg, dict):
                    continue  # Skip non-dict messages
                if msg.get('role') == 'assistant':  # Only compress Assistant messages
                    _i += 1  # Count the number of Assistant messages
                    msg_token_count = token_counter(model=llm_model, messages=[msg])  # Count the number of tokens in the message
                    if msg_token_count > token_threshold:  # If the message is too long
                        modified = False
                        if _i > 1:  # If this is not the most recent Assistant message
                            message_id = msg.get('message_id')  # Get the message_id
                            if message_id:
                                new_content = self.compress_message(msg["content"], message_id, token_threshold * 3)
                                if new_content != msg.get("content"):
                                    msg["content"] = new_content
                                    modified = True
                            else:
                                logger.warning(f"UNEXPECTED: Message has no message_id {str(msg)[:100]}")
                        else:
                            new_content = self.safe_truncate(msg["content"], int(max_tokens_value * 2))
                            if new_content != msg.get("content"):
                                msg["content"] = new_content
                                modified = True
                        if modified:
                            truncated_count += 1
                            self._mark_message(msg, "assistant_truncate")
                            
        return messages, truncated_count

    def remove_meta_messages(self, messages: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """Remove meta messages from the messages."""
        result: List[Dict[str, Any]] = []
        for msg in messages:
            msg_content = msg.get('content')
            # Try to parse msg_content as JSON if it's a string
            if isinstance(msg_content, str):
                try: 
                    msg_content = json.loads(msg_content)
                except json.JSONDecodeError: 
                    pass
            if isinstance(msg_content, dict):
                # Create a copy to avoid modifying the original
                msg_content_copy = msg_content.copy()
                if "tool_execution" in msg_content_copy:
                    tool_execution = msg_content_copy["tool_execution"].copy()
                    if "arguments" in tool_execution:
                        del tool_execution["arguments"]
                    msg_content_copy["tool_execution"] = tool_execution
                # Create a new message dict with the modified content
                new_msg = msg.copy()
                new_msg["content"] = json.dumps(msg_content_copy)
                result.append(new_msg)
            else:
                result.append(msg)
        return result

    async def compress_messages(
        self,
        messages: List[Dict[str, Any]],
        llm_model: str,
        max_tokens: Optional[int] = 41000,
        token_threshold: int = 2048,
        max_iterations: int = 5,
        actual_total_tokens: Optional[int] = None,
        system_prompt: Optional[Dict[str, Any]] = None,
        return_report: bool = False,
        report: Optional[CompressionReport] = None,
    ) -> Union[List[Dict[str, Any]], Tuple[List[Dict[str, Any]], CompressionReport]]:
        """Compress the messages WITHOUT applying caching during iterations.

        When token count exceeds SUMMARIZATION_TOKEN_THRESHOLD (100k), this will:
        - Summarize regular messages using Gemini 2.5 Flash Lite (4-5 lines, ~150 tokens max per summary)
        - Preserve ALL tool calls and tool results completely
        - Keep recent messages (last 10) unsummarized for fresh context

        Caching should be applied ONCE at the end by the caller, not during compression.
        """
        context_window = model_manager.get_context_window(llm_model)

        # Reserve tokens for output generation and safety margin
        if context_window >= 1_000_000:
            max_tokens = context_window - 300_000
        elif context_window >= 400_000:
            max_tokens = context_window - 64_000
        elif context_window >= 200_000:
            max_tokens = context_window - 32_000
        elif context_window >= 100_000:
            max_tokens = context_window - 16_000
        else:
            max_tokens = max_tokens or (context_window - 8_000)

        result = self.remove_meta_messages(messages)

        if actual_total_tokens is not None:
            uncompressed_total_token_count = actual_total_tokens
        else:
            if system_prompt:
                uncompressed_total_token_count = token_counter(
                    model=llm_model, messages=[system_prompt] + result
                )
            else:
                uncompressed_total_token_count = token_counter(model=llm_model, messages=result)

        if report is None:
            report = CompressionReport(model=llm_model, initial_tokens=uncompressed_total_token_count)
        elif report.initial_tokens == 0:
            report.initial_tokens = uncompressed_total_token_count

        if not report.phases:
            logger.info(
                "Initial token count (no caching): %s (summarization threshold: %s)",
                f"{uncompressed_total_token_count:,}",
                f"{SUMMARIZATION_TOKEN_THRESHOLD:,}",
            )

        if uncompressed_total_token_count >= SUMMARIZATION_TOKEN_THRESHOLD:
            logger.info(
                "⚠️ Token count (%s) exceeds summarization threshold (%s). Starting summarization.",
                f"{uncompressed_total_token_count:,}",
                f"{SUMMARIZATION_TOKEN_THRESHOLD:,}",
            )

            tool_messages_indices: List[int] = []
            regular_messages_indices: List[int] = []

            for i, msg in enumerate(result):
                if self.is_tool_related_message(msg):
                    tool_messages_indices.append(i)
                else:
                    regular_messages_indices.append(i)

            report.tool_messages_preserved = len(tool_messages_indices)
            logger.info(
                "Summarization scope: %s tool-related messages preserved, %s regular messages eligible.",
                len(tool_messages_indices),
                len(regular_messages_indices),
            )

            RECENT_MESSAGES_TO_KEEP = 10
            if len(regular_messages_indices) > RECENT_MESSAGES_TO_KEEP:
                messages_to_summarize = regular_messages_indices[:-RECENT_MESSAGES_TO_KEEP]
            else:
                messages_to_summarize = []

            logger.info(
                "Will summarize %s historical messages, keep %s recent regular messages fresh.",
                len(messages_to_summarize),
                min(len(regular_messages_indices), RECENT_MESSAGES_TO_KEEP),
            )

            summarized_count = 0
            total_tokens_saved = 0
            failed_count = 0

            for idx in messages_to_summarize:
                msg = result[idx]
                original_role = msg.get('role', 'user')

                if msg.get('_summarized'):
                    continue

                original_tokens = token_counter(model=llm_model, messages=[msg])

                try:
                    summary = await self.summarize_message(msg)
                    if not summary or len(summary.strip()) < 10:
                        logger.warning(
                            "Summary too short for message %s (%s), keeping original",
                            idx,
                            original_role,
                        )
                        failed_count += 1
                        continue

                    if isinstance(msg.get('content'), dict):
                        msg_copy = msg.copy()
                        msg_copy['content'] = {
                            **msg['content'],
                            'content': summary,
                            '_summarized': True,
                        }
                    else:
                        msg_copy = msg.copy()
                        msg_copy['content'] = summary
                        msg_copy['_summarized'] = True

                    self._mark_message(msg_copy, "summarized")
                    result[idx] = msg_copy

                    new_tokens = token_counter(model=llm_model, messages=[msg_copy])
                    tokens_saved = max(0, original_tokens - new_tokens)
                    total_tokens_saved += tokens_saved
                    summarized_count += 1

                    if summarized_count % (10 if len(messages_to_summarize) < 50 else 50) == 0:
                        logger.info(
                            "Summarization progress: %s/%s messages, ~%s tokens saved so far",
                            summarized_count,
                            len(messages_to_summarize),
                            f"{total_tokens_saved:,}",
                        )

                except Exception as exc:
                    logger.error(
                        "Failed to summarize message %s (%s): %s",
                        idx,
                        original_role,
                        exc,
                        exc_info=True,
                    )
                    failed_count += 1
                    continue

            if system_prompt:
                new_token_count = token_counter(model=llm_model, messages=[system_prompt] + result)
            else:
                new_token_count = token_counter(model=llm_model, messages=result)

            logger.info(
                "✅ Summarization complete: summarized=%s, failures=%s, tokens %s -> %s (Δ ~%s)",
                summarized_count,
                failed_count,
                f"{uncompressed_total_token_count:,}",
                f"{new_token_count:,}",
                f"{max(0, uncompressed_total_token_count - new_token_count):,}",
            )

            report.summarized_messages += summarized_count
            report.summary_failures += failed_count
            report.add_phase(
                "summarization",
                tokens_before=uncompressed_total_token_count,
                tokens_after=new_token_count,
                messages_before=len(result),
                messages_after=len(result),
                details={
                    "summarized_messages": summarized_count,
                    "failed_messages": failed_count,
                    "tokens_saved": max(0, uncompressed_total_token_count - new_token_count),
                    "tool_messages_preserved": report.tool_messages_preserved,
                },
            )

            uncompressed_total_token_count = new_token_count
        else:
            if report.tool_messages_preserved == 0:
                report.tool_messages_preserved = sum(
                    1 for msg in result if self.is_tool_related_message(msg)
                )

        trunc_before_tokens = uncompressed_total_token_count
        trunc_before_messages = len(result)

        result, tool_truncated = self.compress_tool_result_messages(
            result,
            llm_model,
            max_tokens,
            token_threshold,
            uncompressed_total_token_count,
        )
        result, user_truncated = self.compress_user_messages(
            result,
            llm_model,
            max_tokens,
            token_threshold,
            uncompressed_total_token_count,
        )
        result, assistant_truncated = self.compress_assistant_messages(
            result,
            llm_model,
            max_tokens,
            token_threshold,
            uncompressed_total_token_count,
        )

        truncated_now = tool_truncated + user_truncated + assistant_truncated

        if system_prompt:
            compressed_total = token_counter(model=llm_model, messages=[system_prompt] + result)
        else:
            compressed_total = token_counter(model=llm_model, messages=result)

        logger.info(
            "Deterministic truncation: tokens %s -> %s (tool=%s, user=%s, assistant=%s)",
            f"{trunc_before_tokens:,}",
            f"{compressed_total:,}",
            tool_truncated,
            user_truncated,
            assistant_truncated,
        )

        report.truncated_messages += truncated_now
        report.add_phase(
            "deterministic_truncation",
            tokens_before=trunc_before_tokens,
            tokens_after=compressed_total,
            messages_before=trunc_before_messages,
            messages_after=len(result),
            details={
                "tool_truncated": tool_truncated,
                "user_truncated": user_truncated,
                "assistant_truncated": assistant_truncated,
            },
        )

        uncompressed_total_token_count = compressed_total

        if max_iterations <= 0:
            logger.warning("Max compression iterations reached; omitting messages.")
            omit_before_messages = len(result)
            result, omit_final_tokens, removed = self.compress_messages_by_omitting_messages(
                result,
                llm_model,
                max_tokens,
                system_prompt=system_prompt,
            )
            report.removed_messages += removed
            report.add_phase(
                "hard_omission",
                tokens_before=uncompressed_total_token_count,
                tokens_after=omit_final_tokens,
                messages_before=omit_before_messages,
                messages_after=len(result),
                details={
                    "removed_messages": removed,
                    "reason": "max_iterations_exhausted",
                },
            )
            final_total = omit_final_tokens
        elif uncompressed_total_token_count > max_tokens:
            logger.warning(
                "Further compression required: %s > %s (tokens). Recursing with tighter thresholds.",
                f"{uncompressed_total_token_count:,}",
                f"{max_tokens:,}",
            )
            recursive_result, recursive_report = await self.compress_messages(
                result,
                llm_model,
                max_tokens,
                max(512, token_threshold // 2),
                max_iterations - 1,
                uncompressed_total_token_count,
                system_prompt,
                return_report=True,
                report=report,
            )
            result = recursive_result
            report = recursive_report
            if system_prompt:
                final_total = token_counter(model=llm_model, messages=[system_prompt] + result)
            else:
                final_total = token_counter(model=llm_model, messages=result)
        else:
            final_total = uncompressed_total_token_count

        capped_before_messages = len(result)
        if capped_before_messages > 320:
            if system_prompt:
                tokens_before_cap = token_counter(model=llm_model, messages=[system_prompt] + result)
            else:
                tokens_before_cap = token_counter(model=llm_model, messages=result)
            capped_result = self.middle_out_messages(result)
            removed = capped_before_messages - len(capped_result)
            if removed > 0:
                report.removed_messages += removed
                if system_prompt:
                    tokens_after_cap = token_counter(model=llm_model, messages=[system_prompt] + capped_result)
                else:
                    tokens_after_cap = token_counter(model=llm_model, messages=capped_result)
                report.add_phase(
                    "middle_out_cap",
                    tokens_before=tokens_before_cap,
                    tokens_after=tokens_after_cap,
                    messages_before=capped_before_messages,
                    messages_after=len(capped_result),
                    details={"removed_messages": removed, "max_messages": 320},
                )
                result = capped_result
                final_total = tokens_after_cap

        report.final_tokens = final_total
        report.tokens_saved = max(0, report.initial_tokens - final_total)

        logger.info("Context compression summary: %s", report.summary_line())

        if return_report:
            return result, report
        return result
    
    def compress_messages_by_omitting_messages(
        self, 
        messages: List[Dict[str, Any]], 
        llm_model: str, 
        max_tokens: Optional[int] = 41000,
        removal_batch_size: int = 10,
        min_messages_to_keep: int = 10,
        system_prompt: Optional[Dict[str, Any]] = None
    ) -> Tuple[List[Dict[str, Any]], int, int]:
        """Compress the messages by omitting messages from the middle.
        
        Args:
            messages: List of messages to compress
            llm_model: Model name for token counting
            max_tokens: Maximum allowed tokens
            removal_batch_size: Number of messages to remove per iteration
            min_messages_to_keep: Minimum number of messages to preserve
        """
        if not messages:
            return messages, 0, 0
            
        result = messages
        result = self.remove_meta_messages(result)

        # Early exit if no compression needed
        if system_prompt:
            initial_token_count = token_counter(model=llm_model, messages=[system_prompt] + result)
        else:
            initial_token_count = token_counter(model=llm_model, messages=result)
        
        max_allowed_tokens = max_tokens or (100 * 1000)
        
        if initial_token_count <= max_allowed_tokens:
            return result, initial_token_count, 0

        # Separate system message (assumed to be first) from conversation messages
        system_message = system_prompt
        conversation_messages = result
        
        safety_limit = 500
        current_token_count = initial_token_count
        
        while current_token_count > max_allowed_tokens and safety_limit > 0:
            safety_limit -= 1
            
            if len(conversation_messages) <= min_messages_to_keep:
                logger.warning(f"Cannot compress further: only {len(conversation_messages)} messages remain (min: {min_messages_to_keep})")
                break

            # Calculate removal strategy based on current message count
            if len(conversation_messages) > (removal_batch_size * 2):
                # Remove from middle, keeping recent and early context
                middle_start = len(conversation_messages) // 2 - (removal_batch_size // 2)
                middle_end = middle_start + removal_batch_size
                conversation_messages = conversation_messages[:middle_start] + conversation_messages[middle_end:]
            else:
                # Remove from earlier messages, preserving recent context
                messages_to_remove = min(removal_batch_size, len(conversation_messages) // 2)
                if messages_to_remove > 0:
                    conversation_messages = conversation_messages[messages_to_remove:]
                else:
                    # Can't remove any more messages
                    break

            # Recalculate token count
            messages_to_count = ([system_message] + conversation_messages) if system_message else conversation_messages
            current_token_count = token_counter(model=llm_model, messages=messages_to_count)

        # Prepare final result - return only conversation messages (matches compress_messages pattern)
        final_messages = conversation_messages
        
        # Log with system prompt included for accurate token reporting
        if system_message:
            final_token_count = token_counter(model=llm_model, messages=[system_message] + final_messages)
        else:
            final_token_count = token_counter(model=llm_model, messages=final_messages)
        
        logger.info(f"Context compression (omit): {initial_token_count} -> {final_token_count} tokens ({len(messages)} -> {len(final_messages)} messages)")
            
        removed_messages = len(messages) - len(final_messages)
        return final_messages, final_token_count, removed_messages
    
    def middle_out_messages(self, messages: List[Dict[str, Any]], max_messages: int = 320) -> List[Dict[str, Any]]:
        """Remove messages from the middle of the list, keeping max_messages total."""
        if len(messages) <= max_messages:
            return messages
        
        # Keep half from the beginning and half from the end
        keep_start = max_messages // 2
        keep_end = max_messages - keep_start
        
        return messages[:keep_start] + messages[-keep_end:] 
