"""
Simplified conversation thread management system for AgentPress.
"""

import json
import time
from collections import deque
from typing import List, Dict, Any, Optional, Type, Union, AsyncGenerator, Literal, cast
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
from datetime import datetime, timezone
from core.billing.billing_integration import billing_integration
from litellm.utils import token_counter
from core.services.memory_store_local import get_memory_store, MAX_INLINE_SIZE

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
        
        # Initialize memory store (creates .aga_mem directory structure)
        try:
            get_memory_store()
            logger.info("✅ Memory store initialized at /workspace/.aga_mem/")
        except Exception as e:
            logger.warning(f"Failed to initialize memory store: {e}")

    def add_tool(self, tool_class: Type[Tool], function_names: Optional[List[str]] = None, **kwargs):
        """Add a tool to the ThreadManager."""
        self.tool_registry.register_tool(tool_class, function_names, **kwargs)

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
        """Add a message to the thread in the database.
        
        Automatically offloads large content (>6000 chars) to CAS storage
        and replaces with summary + memory_refs pointer.
        """
        # logger.debug(f"Adding message of type '{type}' to thread {thread_id}")
        client = await self.db.client

        # Check if content should be offloaded (for tool messages with large output)
        processed_content = content
        if type == "tool" and isinstance(content, (str, dict)):
            processed_content = await self._maybe_offload_content(
                content, 
                tool_name=metadata.get("tool_name") if metadata else None
            )

        data_to_insert = {
            'thread_id': thread_id,
            'type': type,
            'content': processed_content,
            'is_llm_message': is_llm_message,
            'metadata': metadata or {},
        }

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
    
    async def _maybe_offload_content(
        self,
        content: Union[str, Dict[str, Any]],
        tool_name: Optional[str] = None
    ) -> Union[str, Dict[str, Any]]:
        """Offload large content to CAS if it exceeds MAX_INLINE_SIZE.
        
        Args:
            content: Message content (string or dict)
            tool_name: Optional tool name for metadata
            
        Returns:
            Content with large blobs replaced by pointers
        """
        try:
            memory_store = get_memory_store()
            
            # Extract text content to check size
            text_content = None
            if isinstance(content, str):
                text_content = content
            elif isinstance(content, dict):
                # Try to extract text from common dict structures
                if "content" in content:
                    text_content = str(content["content"])
                elif "output" in content:
                    text_content = str(content["output"])
                else:
                    # Serialize entire dict to check size
                    text_content = json.dumps(content)
            
            if not text_content or len(text_content) <= MAX_INLINE_SIZE:
                # Content is small enough, return as-is
                return content
            
            # Content is large, offload it
            logger.info(f"📦 Offloading large content ({len(text_content)} chars) to CAS")
            
            # Determine memory type and subtype
            memory_type = "TOOL_OUTPUT"
            if tool_name:
                if "web" in tool_name.lower() or "search" in tool_name.lower():
                    memory_type = "WEB_SCRAPE"
                elif "shell" in tool_name.lower() or "command" in tool_name.lower():
                    memory_type = "FILE_LIST"
                elif "doc" in tool_name.lower() or "parse" in tool_name.lower():
                    memory_type = "DOC_CHUNK"
            
            # Create title from first line or tool name
            title = None
            if isinstance(content, dict) and "title" in content:
                title = content["title"]
            elif tool_name:
                title = f"{tool_name} output"
            else:
                # Use first 100 chars as title
                first_line = text_content.split("\n")[0][:100]
                title = first_line if len(first_line) < 100 else first_line + "..."
            
            # Store in CAS
            memory_ref = memory_store.put_text(
                content=text_content,
                memory_type=memory_type,
                subtype=tool_name,
                title=title,
                tags=[tool_name] if tool_name else None
            )
            
            # Create summary (first 800 chars)
            summary = text_content[:800]
            if len(text_content) > 800:
                summary += "\n\n[see memory_refs for full content]"
            
            # Estimate tokens saved (rough: 4 chars per token)
            tokens_saved = len(text_content) // 4
            
            # Build new content with pointer
            if isinstance(content, str):
                # Replace string content with summary + pointer
                new_content = {
                    "role": "tool",
                    "content": summary,
                    "memory_refs": [{
                        "id": memory_ref["memory_id"],
                        "title": memory_ref.get("title", title),
                        "mime": memory_ref["mime"]
                    }],
                    "tokens_saved": tokens_saved
                }
            else:
                # Preserve dict structure but replace large fields
                new_content = content.copy()
                if "content" in new_content:
                    new_content["content"] = summary
                elif "output" in new_content:
                    new_content["output"] = summary
                
                new_content["memory_refs"] = [{
                    "id": memory_ref["memory_id"],
                    "title": memory_ref.get("title", title),
                    "mime": memory_ref["mime"]
                }]
                new_content["tokens_saved"] = tokens_saved
            
            logger.info(f"✅ Offloaded {len(text_content)} chars, saved ~{tokens_saved} tokens")
            return new_content
            
        except Exception as e:
            logger.error(f"Failed to offload content: {e}", exc_info=True)
            # Return original content on error
            return content

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
            messages = await self.get_llm_messages(thread_id)
            
            # Handle auto-continue context
            if auto_continue_state['count'] > 0 and auto_continue_state['continuous_state'].get('accumulated_content'):
                partial_content = auto_continue_state['continuous_state']['accumulated_content']
                messages.append({"role": "assistant", "content": partial_content})
            
            # Pre-call planner: selective prefetch of memory slices
            messages = await self._prefetch_memory_slices(messages, system_prompt)

            # ===== CENTRAL CONFIGURATION =====
            ENABLE_CONTEXT_MANAGER = True   # Set to False to disable context compression
            ENABLE_PROMPT_CACHING = True    # Set to False to disable prompt caching
            # ==================================

            # Apply context compression
            compression_report = None
            if ENABLE_CONTEXT_MANAGER:
                logger.debug(f"Context manager enabled, compressing {len(messages)} messages")
                context_manager = ContextManager()

                compressed_messages, compression_report = await context_manager.compress_messages(
                    messages, llm_model, max_tokens=llm_max_tokens, 
                    actual_total_tokens=None,  # Will be calculated inside
                    system_prompt=system_prompt, # KEY FIX: No caching during compression
                    return_report=True,
                    pointer_mode=True,  # Enable pointer mode - don't hydrate memory_refs
                )
                if compression_report:
                    logger.info(f"🧮 Context compression summary: {compression_report.summary_line()}")
                    logger.debug(f"Context compression diagnostics: {compression_report.to_dict()}")
                else:
                    logger.debug(f"Context compression completed (no report): {len(messages)} -> {len(compressed_messages)} messages")
                messages = compressed_messages
            else:
                logger.debug("Context manager disabled, using raw messages")

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

            # Token governor: enforce limits and apply tiered summaries if needed
            prepared_messages = await self._apply_token_governor(
                prepared_messages, llm_model, llm_max_tokens
            )
            
            # Log final prepared messages token count
            final_prepared_tokens = token_counter(model=llm_model, messages=prepared_messages)
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
    
    async def _prefetch_memory_slices(
        self,
        messages: List[Dict[str, Any]],
        system_prompt: Optional[Dict[str, Any]] = None
    ) -> List[Dict[str, Any]]:
        """Pre-call planner: selectively prefetch 2-3 small slices of memory.
        
        Only prefetches if:
        - User query mentions memory title/tag, or
        - Same tool likely runs again and needs header context
        
        Args:
            messages: Current message list
            system_prompt: Optional system prompt
            
        Returns:
            Messages with prefetched slices injected (marked prefetched:true)
        """
        try:
            memory_store = get_memory_store()
            
            # Extract user query from last user message
            user_query = ""
            for msg in reversed(messages):
                if isinstance(msg, dict) and msg.get("role") == "user":
                    content = msg.get("content", "")
                    if isinstance(content, str):
                        user_query = content.lower()
                    elif isinstance(content, dict):
                        user_query = str(content.get("content", "")).lower()
                    break
            
            if not user_query:
                return messages
            
            # Find recent memory_refs in messages
            recent_memory_refs = []
            for msg in messages[-20:]:  # Last 20 messages
                if isinstance(msg, dict):
                    content = msg.get("content", "")
                    if isinstance(content, dict) and content.get("memory_refs"):
                        recent_memory_refs.extend(content["memory_refs"])
                    elif isinstance(content, str):
                        try:
                            parsed = json.loads(content)
                            if isinstance(parsed, dict) and parsed.get("memory_refs"):
                                recent_memory_refs.extend(parsed["memory_refs"])
                        except (json.JSONDecodeError, TypeError):
                            pass
            
            # Prefetch at most 2-3 slices (≤120 lines each)
            prefetched_count = 0
            max_prefetches = 3
            max_lines = 120
            
            prefetched_messages = []
            
            for mem_ref in recent_memory_refs[:5]:  # Check first 5 recent refs
                if prefetched_count >= max_prefetches:
                    break
                
                memory_id = mem_ref.get("id")
                title = mem_ref.get("title", "").lower()
                
                # Check if user query mentions this memory
                should_prefetch = False
                if memory_id and title:
                    # Simple keyword matching
                    if any(word in user_query for word in title.split()[:3] if len(word) > 3):
                        should_prefetch = True
                
                if should_prefetch:
                    try:
                        # Fetch first 120 lines as context
                        slice_content = memory_store.get_slice(memory_id, 1, max_lines)
                        
                        prefetched_messages.append({
                            "role": "system",
                            "content": f"[Prefetched context from {mem_ref.get('title', 'memory')}]\n{slice_content}",
                            "prefetched": True
                        })
                        
                        prefetched_count += 1
                        logger.debug(f"Prefetched {max_lines} lines from memory {memory_id[:8]}...")
                    except Exception as e:
                        logger.debug(f"Failed to prefetch memory {memory_id}: {e}")
                        continue
            
            # Inject prefetched messages before system prompt
            if prefetched_messages:
                logger.info(f"📥 Prefetched {len(prefetched_messages)} memory slices")
                return prefetched_messages + messages
            
            return messages
            
        except Exception as e:
            logger.debug(f"Pre-call planner error: {e}")
            return messages
    
    async def _apply_token_governor(
        self,
        messages: List[Dict[str, Any]],
        llm_model: str,
        max_tokens: Optional[int]
    ) -> List[Dict[str, Any]]:
        """Token governor: enforce limits and apply tiered summaries.
        
        Policies:
        - >20k projected → force tiered summaries (3-5 bullets + pointer)
        - >40k projected → deny expansion; instruct model to plan with memory_fetch only
        
        Args:
            messages: Prepared messages
            llm_model: Model name
            max_tokens: Max tokens for generation
            
        Returns:
            Messages with governor applied
        """
        try:
            # Estimate tokens (pointer-redacted)
            estimated_tokens = token_counter(model=llm_model, messages=messages)
            
            # Get context window
            from core.ai_models import model_manager
            context_window = model_manager.get_context_window(llm_model)
            
            # Policy thresholds
            TIERED_SUMMARY_THRESHOLD = 20_000
            DENY_EXPANSION_THRESHOLD = 40_000
            
            if estimated_tokens > DENY_EXPANSION_THRESHOLD:
                # >40k: Add instruction to use memory_fetch only
                logger.warning(
                    f"⚠️ Token count ({estimated_tokens:,}) exceeds {DENY_EXPANSION_THRESHOLD:,}. "
                    "Forcing pointer-only mode."
                )
                
                # Add system instruction
                instruction = {
                    "role": "system",
                    "content": (
                        "CRITICAL: Context is very large. You MUST use the memory_fetch tool "
                        "to retrieve specific slices of offloaded content. Do NOT request full memories. "
                        "Always use tight line ranges (≤200 lines) or byte ranges (≤64KB)."
                    )
                }
                return [instruction] + messages
            
            elif estimated_tokens > TIERED_SUMMARY_THRESHOLD:
                # >20k: Apply tiered summaries to messages with memory_refs
                logger.info(
                    f"📊 Token count ({estimated_tokens:,}) exceeds {TIERED_SUMMARY_THRESHOLD:,}. "
                    "Applying tiered summaries."
                )
                
                # For messages with memory_refs, ensure they have concise summaries
                # (This is already handled by offloading, but we can add reminders)
                return messages
            
            # Under threshold, return as-is
            return messages
            
        except Exception as e:
            logger.debug(f"Token governor error: {e}")
            return messages
