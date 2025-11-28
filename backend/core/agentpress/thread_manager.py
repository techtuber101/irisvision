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
        
        # Cumulative token tracking for context summarization
        self.cumulative_tokens = 0
        self.summarization_triggered = False
        self.boundary_message_id = None  # Message ID of first message kept fresh (not summarized) - persisted in DB
        self.current_summary = None  # Cache for current summary (loaded from DB when needed)

    def add_tool(self, tool_class: Type[Tool], function_names: Optional[List[str]] = None, **kwargs):
        """Add a tool to the ThreadManager."""
        self.tool_registry.register_tool(tool_class, function_names, **kwargs)
    
    def set_cumulative_tokens(self, cumulative_tokens: int, summarization_triggered: bool):
        """Set cumulative token state from AgentRunner for context summarization."""
        self.cumulative_tokens = cumulative_tokens
        self.summarization_triggered = summarization_triggered
        # Note: boundary_message_id is set when summarization occurs and persisted in DB

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

        data_to_insert = {
            'thread_id': thread_id,
            'type': type,
            'content': content,
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
    
    def _is_summary_message(self, msg: Dict[str, Any]) -> bool:
        """Check if a message is a context summary message."""
        role = msg.get('role', '')
        content = msg.get('content', '')
        
        if role == 'system':
            if isinstance(content, str):
                return content.startswith('[Previous conversation summary]:')
            elif isinstance(content, dict):
                text = content.get('content', '')
                return isinstance(text, str) and text.startswith('[Previous conversation summary]:')
        
        return False
    
    async def _load_summary_from_db(self, thread_id: str) -> Optional[Dict[str, Any]]:
        """
        Load the active summary message from database for a thread.
        Returns summary message dict with metadata, or None if no summary exists.
        """
        try:
            client = await self.db.client
            # Use the helper function from migration (returns a table)
            result = await client.rpc('get_thread_summary', {'thread_uuid': thread_id}).execute()
            
            if result.data and len(result.data) > 0:
                summary_data = result.data[0]
                boundary_message_id = summary_data.get('boundary_message_id')
                content_data = summary_data.get('content', {})
                
                # Extract content - handle both dict and string formats
                if isinstance(content_data, dict):
                    content_text = content_data.get('content', '')
                elif isinstance(content_data, str):
                    # Try to parse as JSON
                    try:
                        parsed = json.loads(content_data)
                        content_text = parsed.get('content', '') if isinstance(parsed, dict) else content_data
                    except:
                        content_text = content_data
                else:
                    content_text = str(content_data)
                
                # Reconstruct summary message in the format expected by the system
                summary_message = {
                    "role": "system",
                    "content": content_text,
                    "message_id": summary_data.get('message_id')
                }
                
                # Store boundary message ID for filtering
                if boundary_message_id:
                    self.boundary_message_id = boundary_message_id
                    logger.debug(f"Loaded summary from DB for thread {thread_id}, boundary_message_id: {boundary_message_id}")
                
                return summary_message
            else:
                logger.debug(f"No summary found in DB for thread {thread_id}")
                return None
        except Exception as e:
            logger.warning(f"Failed to load summary from DB for thread {thread_id}: {e}")
            return None
    
    async def _filter_summarized_messages(self, messages: List[Dict[str, Any]], thread_id: str) -> List[Dict[str, Any]]:
        """
        Filter messages to exclude old messages that have been summarized.
        Uses boundary_message_id from DB to determine which messages to exclude.
        Returns the stored summary + messages after the boundary.
        """
        if not messages:
            return messages
        
        # Load summary from DB if not already cached
        if self.current_summary is None:
            self.current_summary = await self._load_summary_from_db(thread_id)
        
        # If no summarization has occurred, return all messages
        if self.current_summary is None or self.boundary_message_id is None:
            return messages
        
        # Find the index of the boundary message
        boundary_index = None
        for i, msg in enumerate(messages):
            if msg.get('message_id') == self.boundary_message_id:
                boundary_index = i
                break
        
        # If boundary message not found, return all messages (safety fallback)
        if boundary_index is None:
            logger.warning(f"Boundary message {self.boundary_message_id} not found in messages, returning all messages")
            return messages
        
        # Return stored summary + all messages from boundary onwards
        # This ensures no messages are lost between the boundary and new messages
        return [self.current_summary] + messages[boundary_index:]
    
    async def _generate_context_summary(
        self,
        messages: List[Dict[str, Any]],
        llm_model: str,
        thread_id: str
    ) -> Optional[Dict[str, Any]]:
        """
        Generate a summary of old context messages using flash lite model.
        If a previous summary exists, it will be included in what gets summarized.
        
        Args:
            messages: List of all messages (will keep last 2-3 fresh)
            llm_model: The model being used for the run
            
        Returns:
            Summary message dict or None if summarization fails
        """
        if not messages or len(messages) < 5:
            logger.debug("Not enough messages to summarize (need at least 5)")
            return None
        
        # Keep the last 5 messages fresh (not summarized)
        KEEP_FRESH_MESSAGES = 5
        
        if len(messages) <= KEEP_FRESH_MESSAGES:
            logger.debug(f"Only {len(messages)} messages, skipping summarization")
            return None
        
        # Separate old messages (to summarize) from fresh messages (to keep)
        # This includes any previous summary in the old messages
        old_messages = messages[:-KEEP_FRESH_MESSAGES]
        fresh_messages = messages[-KEEP_FRESH_MESSAGES:]
        
        if not old_messages or len(old_messages) < 2:
            logger.debug("Not enough old messages to summarize")
            return None
        
        # Check if there's a previous summary in old_messages
        has_previous_summary = any(self._is_summary_message(msg) for msg in old_messages)
        if has_previous_summary:
            logger.info(
                f"Generating new context summary: {len(old_messages)} old messages (including previous summary), "
                f"keeping {len(fresh_messages)} fresh messages. Previous summary will be included in new summary."
            )
        else:
            logger.info(
                f"Generating context summary: {len(old_messages)} old messages, "
                f"keeping {len(fresh_messages)} fresh messages"
            )
        
        # Build context text for summarization
        # Also extract task IDs from create_tasks tool results to preserve them
        context_parts = []
        extracted_task_ids = []  # Preserve task IDs separately
        
        for msg in old_messages:
            role = msg.get('role', 'unknown')
            content = msg.get('content', '')
            
            # Extract text content
            if isinstance(content, str):
                try:
                    content_dict = json.loads(content)
                    if isinstance(content_dict, dict):
                        text = content_dict.get('content', '') or str(content_dict)
                        # Check if this is a create_tasks tool result
                        tool_exec = content_dict.get('tool_execution', {})
                        if tool_exec.get('function_name') == 'create_tasks':
                            result_output = tool_exec.get('result', {}).get('output', {})
                            if isinstance(result_output, str):
                                try:
                                    result_output = json.loads(result_output)
                                except:
                                    pass
                            if isinstance(result_output, dict):
                                # Extract task IDs from all sections
                                sections = result_output.get('sections', [])
                                for section in sections:
                                    tasks = section.get('tasks', [])
                                    for task in tasks:
                                        task_id = task.get('id')
                                        if task_id:
                                            extracted_task_ids.append({
                                                'id': task_id,
                                                'content': task.get('content', ''),
                                                'status': task.get('status', 'pending')
                                            })
                    else:
                        text = content
                except (json.JSONDecodeError, TypeError):
                    text = content
            elif isinstance(content, dict):
                text = content.get('content', '') or str(content)
                # Check if this is a create_tasks tool result
                tool_exec = content.get('tool_execution', {})
                if tool_exec.get('function_name') == 'create_tasks':
                    result_output = tool_exec.get('result', {}).get('output', {})
                    if isinstance(result_output, str):
                        try:
                            result_output = json.loads(result_output)
                        except:
                            pass
                    if isinstance(result_output, dict):
                        # Extract task IDs from all sections
                        sections = result_output.get('sections', [])
                        for section in sections:
                            tasks = section.get('tasks', [])
                            for task in tasks:
                                task_id = task.get('id')
                                if task_id:
                                    extracted_task_ids.append({
                                        'id': task_id,
                                        'content': task.get('content', ''),
                                        'status': task.get('status', 'pending')
                                    })
            else:
                text = str(content)
            
            # For tool execution messages, preserve more detail
            # Truncate very long messages but keep more for tool results
            if len(text) > 5000:
                text = text[:5000] + "... [truncated - see full context in original messages]"
            
            if text.strip():
                context_parts.append(f"[{role}]: {text}")
        
        context_text = "\n\n".join(context_parts)
        
        # Limit total input to avoid token limits (roughly 100k chars ≈ 25k tokens)
        # Increased limit to preserve more context for comprehensive summarization
        if len(context_text) > 100000:
            context_text = context_text[:100000] + "\n\n... [truncated for summarization - oldest messages may be condensed]"
        
        # Create summarization prompt with task IDs preservation
        task_ids_section = ""
        if extracted_task_ids:
            task_ids_list = [f"- {t['id']}: {t['content'][:100]}... (status: {t['status']})" 
                           for t in extracted_task_ids[:20]]  # Limit to first 20 to avoid token bloat
            task_ids_section = f"""

CRITICAL: The following task IDs were created and MUST be preserved exactly as shown. Include these in your summary:
{chr(10).join(task_ids_list)}
"""
        
        summarization_prompt = f"""You are tasked with creating a comprehensive, detailed summary that condenses all previous conversation context. This summary will REPLACE all the old messages, so it MUST preserve every critical piece of information in a crystal clear, well-organized manner.

CRITICAL REQUIREMENTS:
1. **Preserve ALL Important Information**: Your summary must include:
   - Every tool call that was made (tool name, purpose, key parameters)
   - All tool results and outputs (especially for graph creation, file operations, code generation, web searches)
   - File paths, variable names, IDs, configurations, and any specific identifiers
   - Graph structures created (nodes, edges, relationships, properties)
   - Web search data and findings (summarize effectively but preserve key facts, URLs, sources)
   - Code snippets, functions, classes created (summarize but preserve structure)
   - Task IDs, their status, and what they represent
   - User requirements, constraints, and preferences
   - Decisions made and reasoning behind them
   - Current state of work (what's completed, what's in progress, what remains)

2. **Organization**: Structure your summary clearly:
   - **Overview**: Brief 2-3 sentence summary of the overall task/goal
   - **Tool Executions**: For each important tool call, include:
     * Tool name and what it accomplished
     * Key inputs/parameters
     * Important outputs/results (condense but preserve critical details)
     * Any IDs, paths, or identifiers created
   - **State Information**: Document what exists:
     * Files created/modified with their paths
     * Graph structures (nodes, edges, relationships)
     * Variables, configurations, values
     * Data structures, schemas, models
   - **Web Search Findings**: For any web searches, summarize:
     * Key facts and information discovered
     * Important URLs and sources
     * Relevant data points and statistics
   - **Task Status**: List all task IDs and their current status
   - **Remaining Work**: What still needs to be done

3. **Condensation Strategy**: 
   - Be concise but comprehensive - use as much space as you need (up to 4500 tokens)
   - Condense repetitive information but preserve unique details
   - For web search results: summarize effectively but keep key facts, URLs, and important data
   - For tool results: preserve the essence and critical outputs, condense verbose output
   - For code: preserve structure and key logic, summarize verbose comments
   - Make every word count - be crystal clear and information-dense

4. **Format**:
   - Use clear section headers (## Section Name)
   - Use bullet points for lists
   - Use code blocks for code snippets, file paths, IDs
   - Be specific with names, paths, IDs, and identifiers
   - Preserve relationships and dependencies

REMEMBER: This summary replaces all previous context. If information is not in the summary, it will be lost. Make personal effort to fit as much critical information as possible while maintaining clarity. Use as much space as needed (up to 4500 tokens) to ensure nothing important is lost.

{task_ids_section}

Conversation context to summarize:
{context_text}
"""
        
        try:
            # Use flash lite model for fast, cheap summarization
            logger.info("Calling gemini/gemini-2.5-flash-lite for context summarization...")
            logger.info(f"📝 Summarization prompt length: {len(summarization_prompt)} characters")
            logger.debug(f"📝 Full summarization prompt being sent:\n{summarization_prompt}")
            summary_response = await make_llm_api_call(
                messages=[{"role": "user", "content": summarization_prompt}],
                model_name="gemini/gemini-2.5-flash-lite",
                temperature=0.1,
                max_tokens=4500,  # Allow comprehensive summary with all important details
                stream=False
            )
            
            # Extract summary text
            summary_text = ""
            if isinstance(summary_response, str):
                summary_text = summary_response.strip()
            elif isinstance(summary_response, dict):
                if 'choices' in summary_response and summary_response['choices']:
                    summary_text = summary_response['choices'][0].get('message', {}).get('content', '').strip()
                else:
                    summary_text = summary_response.get('content', '').strip()
            else:
                # Handle LiteLLM ModelResponse object
                if hasattr(summary_response, 'choices') and summary_response.choices:
                    first_choice = summary_response.choices[0]
                    if hasattr(first_choice, 'message'):
                        summary_text = first_choice.message.content.strip()
                    elif isinstance(first_choice, dict):
                        summary_text = first_choice.get('message', {}).get('content', '').strip()
                elif hasattr(summary_response, 'content'):
                    summary_text = str(summary_response.content).strip()
            
            if not summary_text or len(summary_text) < 20:
                logger.warning("Summary too short, keeping original messages")
                return None
            
            # Log the actual summary output from the summarizer
            logger.info(f"📄 Summarizer output ({len(summary_text)} chars):\n{summary_text}")
            
            # Append task IDs explicitly to the summary to ensure they're preserved
            task_ids_append = ""
            if extracted_task_ids:
                task_id_list = [t['id'] for t in extracted_task_ids]
                task_ids_append = f"\n\n[PRESERVED TASK IDs]: {json.dumps(task_id_list)}"
                logger.info(f"Preserving {len(task_id_list)} task IDs in summary")
            
            # Create a summary message content
            summary_content = f"[Previous conversation summary]: {summary_text}{task_ids_append}"
            summary_message_dict = {
                "role": "system",
                "content": summary_content
            }
            
            logger.info(
                f"Context summary generated: {len(old_messages)} messages -> 1 summary "
                f"({len(summary_text)} chars)"
            )
            
            # Persist summary to database (save or update)
            try:
                await self._persist_summary_to_db(
                    thread_id=thread_id,
                    summary_content=summary_message_dict,
                    boundary_message_id=fresh_messages[0].get('message_id') if fresh_messages else None,
                    replaced_count=len(old_messages),
                    version=1  # Will be incremented if updating existing summary
                )
                logger.info(f"Summary persisted to database for thread {thread_id}")
            except Exception as e:
                logger.error(f"Failed to persist summary to DB for thread {thread_id}: {e}", exc_info=True)
                # Continue anyway - summary is still generated, just not persisted
                # This allows the agent to continue even if DB write fails
            
            return summary_message_dict
            
        except Exception as e:
            logger.error(f"Failed to generate context summary: {e}", exc_info=True)
            return None
    
    async def _persist_summary_to_db(
        self,
        thread_id: str,
        summary_content: Dict[str, Any],
        boundary_message_id: Optional[str],
        replaced_count: int,
        version: int = 1
    ) -> Optional[str]:
        """
        Persist summary to database. If summary exists, update it; otherwise create new one.
        Returns the message_id of the summary message.
        """
        try:
            client = await self.db.client
            
            # Check if summary already exists
            existing_summary_result = await client.rpc('find_thread_summary', {'thread_uuid': thread_id}).execute()
            existing_summary_id = None
            if existing_summary_result.data and len(existing_summary_result.data) > 0:
                # The function returns a UUID directly, but Supabase wraps it
                result_value = existing_summary_result.data[0]
                if isinstance(result_value, str):
                    existing_summary_id = result_value
                elif isinstance(result_value, dict):
                    # Handle different return formats
                    existing_summary_id = result_value.get('find_thread_summary') or result_value.get('message_id')
                else:
                    existing_summary_id = str(result_value) if result_value else None
            
            # Prepare metadata
            metadata = {
                "summarization": True,
                "replaced_count": replaced_count,
                "version": version
            }
            if boundary_message_id:
                metadata["boundary_message_id"] = boundary_message_id
            
            if existing_summary_id:
                # Update existing summary
                # Get current version and increment
                current_summary = await client.table('messages').select('metadata').eq('message_id', existing_summary_id).execute()
                if current_summary.data and current_summary.data[0].get('metadata'):
                    current_version = current_summary.data[0]['metadata'].get('version', 1)
                    metadata["version"] = current_version + 1
                
                # Update the summary message
                update_result = await client.table('messages').update({
                    'content': summary_content,
                    'metadata': metadata,
                    'updated_at': datetime.now(timezone.utc).isoformat()
                }).eq('message_id', existing_summary_id).execute()
                
                if update_result.data:
                    logger.info(f"Updated existing summary message {existing_summary_id} for thread {thread_id} (version {metadata['version']})")
                    self.boundary_message_id = boundary_message_id
                    # Update cache with new summary content
                    self.current_summary = summary_content
                    return existing_summary_id
                else:
                    logger.warning(f"Failed to update summary message {existing_summary_id}")
                    return None
            else:
                # Create new summary message
                summary_message = await self.add_message(
                    thread_id=thread_id,
                    type='system',
                    content=summary_content,
                    is_llm_message=True,
                    metadata=metadata
                )
                
                if summary_message and summary_message.get('message_id'):
                    logger.info(f"Created new summary message {summary_message['message_id']} for thread {thread_id}")
                    self.boundary_message_id = boundary_message_id
                    # Update cache with new summary content
                    self.current_summary = summary_content
                    return summary_message['message_id']
                else:
                    logger.warning(f"Failed to create summary message for thread {thread_id}")
                    return None
                    
        except Exception as e:
            logger.error(f"Error persisting summary to DB for thread {thread_id}: {e}", exc_info=True)
            raise
    
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
            all_messages = await self.get_llm_messages(thread_id)
            
            # Check if we need to summarize context (80k token threshold)
            # Allow re-triggering if tokens hit 80k again (even if previously summarized)
            if self.cumulative_tokens >= 80000:
                logger.info(
                    f"Cumulative tokens ({self.cumulative_tokens:,}) crossed 80k threshold. "
                    f"Triggering context summarization..."
                )
                
                # Generate summary of old messages (includes previous summary if it exists)
                summary_message = await self._generate_context_summary(all_messages, llm_model, thread_id)
                
                if summary_message:
                    # Replace old messages with summary, keep last 5 fresh
                    KEEP_FRESH_MESSAGES = 5
                    if len(all_messages) > KEEP_FRESH_MESSAGES:
                        # Get the boundary message ID (first message kept fresh)
                        boundary_msg = all_messages[-KEEP_FRESH_MESSAGES]
                        boundary_message_id = boundary_msg.get('message_id')
                        
                        # Store the summary in cache for reuse when below 80k
                        # Note: Summary is already persisted to DB in _generate_context_summary
                        self.current_summary = summary_message
                        
                        # Replace all old messages with new summary, keep only last 5 fresh
                        messages = [summary_message] + all_messages[-KEEP_FRESH_MESSAGES:]
                        self.summarization_triggered = True
                        logger.info(
                            f"Context summarization complete: replaced {len(all_messages) - KEEP_FRESH_MESSAGES} "
                            f"old messages with summary, keeping {KEEP_FRESH_MESSAGES} fresh messages "
                            f"(boundary message_id: {boundary_message_id})"
                        )
                    else:
                        logger.warning("Not enough messages to replace, keeping all messages")
                        messages = all_messages
                        self.boundary_message_id = None
                        self.current_summary = None  # Clear cache
                else:
                    logger.warning("Context summarization failed, continuing with all messages")
                    messages = all_messages
                    self.boundary_message_id = None
                    self.current_summary = None  # Clear cache
            else:
                # Below 80k threshold - filter out messages that were summarized
                messages = await self._filter_summarized_messages(all_messages, thread_id)
            
            # Handle auto-continue context
            if auto_continue_state['count'] > 0 and auto_continue_state['continuous_state'].get('accumulated_content'):
                partial_content = auto_continue_state['continuous_state']['accumulated_content']
                messages.append({"role": "assistant", "content": partial_content})

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
