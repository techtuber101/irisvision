"""
Fast Gemini 3 Pro Preview Chat Endpoint
Super simple, super fast streaming chat with Gemini
"""
import os
import json
import re
import time
from enum import Enum
from typing import AsyncGenerator, Optional, List, Dict, Any
from fastapi import APIRouter, HTTPException, Depends, Request
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field
import google.generativeai as genai
from core.utils.config import config
from core.utils.logger import logger
from core.utils.auth_utils import verify_and_get_user_id_from_jwt, get_optional_user_id
from core.agentpress.thread_manager import ThreadManager
from core.agentpress.context_manager import ContextManager
from litellm.utils import token_counter

router = APIRouter()

# Configure Gemini
genai.configure(api_key=config.GEMINI_API_KEY)

# Model configuration - can be overridden via FAST_GEMINI_RESEARCH_MODEL environment variable
# This applies to both Quick Chat mode and Adaptive mode
DEFAULT_GEMINI_RESEARCH_MODEL = os.getenv(
    "FAST_GEMINI_RESEARCH_MODEL",
    "gemini-3-pro-preview",
)

# Temperature settings
FAST_CHAT_TEMPERATURE = float(os.getenv("FAST_CHAT_TEMPERATURE", "1"))
ADAPTIVE_TEMPERATURE = float(os.getenv("ADAPTIVE_ROUTER_TEMPERATURE", "1"))

class Attachment(BaseModel):
    mime_type: str
    data: str
    name: Optional[str] = None

class ChatRequest(BaseModel):
    message: str
    model: str = DEFAULT_GEMINI_RESEARCH_MODEL  # Default to Gemini 3 Pro Preview
    system_instructions: Optional[str] = None
    chat_context: Optional[List[Dict[str, str]]] = None
    attachments: Optional[List[Attachment]] = None
    thread_id: Optional[str] = None  # Thread ID to load messages from for context

class ChatResponse(BaseModel):
    response: str
    time_ms: float


class AdaptiveDecisionState(str, Enum):
    AGENT_NEEDED = "agent_needed"
    AGENT_NOT_NEEDED = "agent_not_needed"
    ASK_USER = "ask_user"


class AdaptiveAskUserPrompt(BaseModel):
    prompt: str = "Would you like me to continue in Iris Intelligence mode?"
    yes_label: str = "Yes"
    no_label: str = "No, I'm fine"


class AdaptiveDecision(BaseModel):
    state: AdaptiveDecisionState
    confidence: float = Field(ge=0.0, le=1.0, default=0.5)
    reason: str
    agent_preface: Optional[str] = None
    ask_user: Optional[AdaptiveAskUserPrompt] = None
    metadata: Dict[str, Any] = Field(default_factory=dict)


class AdaptiveChatResponse(BaseModel):
    response: str
    decision: AdaptiveDecision
    time_ms: float


QUICK_CHAT_SYSTEM_PROMPT = """You are Iris Quick Chat.
- Provide concise, beautifully formatted answers with markdown tables/lists as needed.
- NEVER mention internal routing, agent modes, or tool usage.
- Do not promise that you will escalate, call tools, or trigger workflows.
- If the user asks for Iris Intelligence mode, politely suggest switching modes but stay lightweight.
- Keep tone confident, friendly, and focused on the key information the user needs right now."""

ADAPTIVE_ROUTER_PROMPT = """You are Iris Adaptive Mode Router. Answer user's question FIRST, then route.

STEP 1: ANSWER BRILLIANTLY
Provide comprehensive, accurate answer fully addressing question. When NOT choosing agent_needed, give exceptional answer.

**Answer Requirements:**
- Direct, complete, accurate (verify facts)
- Include facts, figures, statistics, dates when relevant
- Use rich markdown: tables, headings, lists, emphasis, code blocks
- **TABLES MANDATORY** for: comparisons, structured data, rankings, multi-attribute lists
- Use tables instead of bullet lists when clearer

**Formatting:**
- Tables: | Item | Attribute 1 | Attribute 2 | for comparisons/rankings/data
- Headings: ## main, ### subsections
- Lists: bullets for simple info, numbered for steps
- Emphasis: **bold** key terms, *italics* for emphasis, `code` for technical terms

STEP 2: ROUTING DECISION
After answering, analyze and route. Don't ask when answer is clear.

=== AUTO-TRIGGER AGENT MODE (agent_needed, 0.9+) ===
MUST trigger agent mode - DO NOT ask:
- "create/build/make" + website/app/report/slides → agent_needed (0.95+)
- "create intense research report" / "do deep research" → agent_needed (0.95+)
- "deep"/"intense"/"comprehensive" + research/analysis → agent_needed (0.95+)
- File/code operations: "create file", "write code", "process data" → agent_needed (0.95+)
- Multi-step: "and then", "also", "do X, Y, Z" → agent_needed (0.9+)

=== SIMPLE Q&A (agent_not_needed, 0.8+) ===
Stay in chat mode with BRILLIANT answers:
- "what/how/why/explain" queries → agent_not_needed (0.9+)
- Clarifications, follow-ups → agent_not_needed (0.95+)
- Include facts, figures, tables for comparisons/rankings

=== AMBIGUOUS MODE (ask_user, 0.5-0.7) ===
Grey area where request could be satisfied TWO ways:
1. **Instant Answer**: Quick response (satisfies immediate need)
2. **Agentic Work**: Deep research/analysis (goes beyond simple answer)

**KEY INSIGHT:**
"give me top 5 stocks in each sector" could mean:
- Option A: Quick list (browsing/exploring)
- Option B: Full research report (decision-making)

**WHEN TO USE ask_user (ALL must be true):**
1. Genuinely ambiguous - could be quick answer OR deep work
2. NO "create"/"build"/"make"/"deep"/"intense"/"comprehensive" keywords
3. NO clear deliverable (website/report/slides/app)
4. Instant answer fully satisfies, but agentic work adds value

**APPROACH:**
1. Provide BRILLIANT complete answer (facts, figures, tables)
2. Recognize same question could benefit from agentic work
3. Offer choice via ask_user prompt

**Examples - SHOULD be ask_user:**
- "give me top 5 stocks in each sector" → Quick list OR full research report
- "what are best practices for X?" → Quick summary OR comprehensive guide
- "what are trends in AI?" → Quick overview OR research report

**Examples - NOT ask_user:**
- "create website" → agent_needed (clear deliverable)
- "do deep research" → agent_needed (explicit "deep")
- "what is X?" → agent_not_needed (simple query)

**DECISION TEST:**
"Could this be EITHER quick answer OR extensive agentic work, both equally valid?"
- YES → ask_user
- NO, needs agentic work → agent_needed
- NO, just needs answer → agent_not_needed

=== DECISION LOGIC ===
1. Check deliverables first → agent_needed (0.95+)
2. Check simple Q&A → agent_not_needed (0.9+)
3. If neither → consider ask_user (0.5-0.7)

**Confidence:**
- 0.95-1.0: Crystal clear
- 0.9-0.95: Very clear
- 0.8-0.9: Clear
- 0.5-0.7: Ambiguous (ask_user only)

**ask_user format:**
- `prompt`: "Continue [context] in Iris Intelligence mode?" (under 10 words)
- `reason`: "• Action 1\n• Action 2" (2-5 words each, action-oriented)
- MUST include ask_user object with prompt/yes_label/no_label

CRITICAL JSON FORMAT REQUIREMENTS:
- Return ONLY valid JSON, nothing else
- NO markdown code fences (no ```json or ```)
- NO explanatory text before or after JSON
- NO code examples outside JSON
- Start response with { and end with }
- "answer" field contains markdown-formatted answer as JSON string (properly escaped)

JSON structure (strict JSON, no markdown fences, no extra text):
{"answer": "<beautifully formatted markdown answer with tables/headings/lists>", "decision": {"state": "agent_needed|agent_not_needed|ask_user", "confidence": 0.0-1.0, "reason": "<bullet points>", "agent_preface": "I'll continue in Iris Intelligence mode.", "ask_user": {"prompt": "<short snappy question>", "yes_label": "Yes, continue", "no_label": "No, I'm fine"}, "metadata": {"suggested_tools": [], "urgency": "low|medium|high"}}}

Example of correct response (this is the ONLY format):
{"answer": "# My Answer\n\nHere is the information...", "decision": {"state": "agent_not_needed", "confidence": 0.9, "reason": "Simple information query"}}

**Rules:**
1. Answer FIRST (comprehensive, accurate, facts/figures/tables)
2. Then route (agent_needed/agent_not_needed/ask_user)
3. Use tables for comparisons/rankings/data
4. If ask_user, include ask_user object
5. Default agent_not_needed for follow-ups
6. AUTO-TRIGGER agent_needed for clear deliverables (don't ask!)
7. ONLY ask_user for truly ambiguous cases

**Examples:**
✅ "create website" → agent_needed (0.95)
✅ "top 5 stocks" → ask_user (0.6) - give answer with table, then offer agent mode
❌ "create website" → ask_user (WRONG!)
"""


def _clean_base64_data(data: str) -> str:
    """Remove data URL prefixes and whitespace from base64 payloads."""
    if not data:
        return data
    cleaned = data.strip()
    if cleaned.startswith("data:") and "," in cleaned:
        _, cleaned = cleaned.split(",", 1)
    return cleaned.strip()


def _build_user_parts(message: str, attachments: Optional[List[Attachment]]) -> List[Dict]:
    """Create Gemini-friendly parts list that includes text plus any inline attachments."""
    parts: List[Dict] = []

    if message:
        parts.append({"text": message})

    if attachments:
        for attachment in attachments:
            if not attachment.data:
                continue
            parts.append({
                "inline_data": {
                    "mime_type": attachment.mime_type,
                    "data": _clean_base64_data(attachment.data)
                }
            })

    # Gemini expects at least one part in the message.
    if not parts:
        parts.append({"text": ""})

    return parts


async def _load_and_compress_thread_messages(
    thread_id: Optional[str],
    model: str,
    user_id: Optional[str] = None,
    system_instructions: Optional[str] = None
) -> List[Dict[str, Any]]:
    """Load messages from thread and apply context compression using ContextManager."""
    if not thread_id:
        return []
    
    try:
        # Verify thread ownership if user_id is provided
        if user_id:
            from core.services.supabase import DBConnection
            db = DBConnection()
            client = await db.client
            thread_result = await client.table('threads').select('account_id').eq('thread_id', thread_id).execute()
            
            if not thread_result.data:
                logger.warning(f"Thread {thread_id} not found")
                return []
            
            thread_account_id = thread_result.data[0].get('account_id')
            if thread_account_id != user_id:
                logger.warning(f"User {user_id} does not have access to thread {thread_id}")
                return []
        
        thread_manager = ThreadManager()
        all_messages = await thread_manager.get_llm_messages(thread_id)
        
        if not all_messages:
            return []
        
        # Convert messages to format expected by ContextManager
        # ContextManager expects messages with 'role' and 'content' fields
        formatted_messages = []
        for msg in all_messages:
            role = msg.get('role', 'user')
            content = msg.get('content', '')
            
            # Handle different content formats
            if isinstance(content, dict):
                # Extract text from nested content
                text_content = content.get('content', '') or str(content)
            else:
                text_content = str(content)
            
            formatted_messages.append({
                'role': role,
                'content': text_content,
                'message_id': msg.get('message_id')
            })
        
        # Apply context compression using ContextManager (same as agent mode)
        context_manager = ContextManager()
        
        # Create system prompt dict if we have instructions
        system_prompt = None
        if system_instructions:
            system_prompt = {
                "role": "system",
                "content": system_instructions
            }
        
        # Compress messages using the same strategy as agent mode
        compressed_messages, compression_report = await context_manager.compress_messages(
            formatted_messages,
            model,
            max_tokens=None,  # Will be calculated based on context window
            actual_total_tokens=None,
            system_prompt=system_prompt,
            return_report=True,
        )
        
        if compression_report:
            logger.info(f"🧮 Fast chat context compression: {compression_report.summary_line()}")
        
        return compressed_messages
        
    except Exception as e:
        logger.error(f"Failed to load/compress thread messages: {e}", exc_info=True)
        return []


async def _build_history(
    request: ChatRequest, 
    system_instructions: Optional[str] = None,
    user_id: Optional[str] = None
) -> List[Dict]:
    """Build the conversation history excluding the current user message.
    
    If thread_id is provided, loads and compresses messages from the thread.
    Otherwise, uses chat_context if provided.
    
    NOTE: System instructions are NOT added here - they should be passed as
    system_instruction parameter to GenerativeModel, not as user messages.
    """
    conversation_history: List[Dict] = []

    resolved_instructions = system_instructions or request.system_instructions

    # Priority: thread_id > chat_context
    if request.thread_id:
        # Load and compress messages from thread (same strategy as agent mode)
        compressed_messages = await _load_and_compress_thread_messages(
            request.thread_id,
            request.model,
            user_id=user_id,
            system_instructions=resolved_instructions
        )
        
        for msg in compressed_messages:
            role = msg.get("role", "user")
            content = msg.get("content", "")
            
            if role == "user":
                conversation_history.append({
                    "role": "user",
                    "parts": [{"text": content}]
                })
            elif role == "assistant":
                conversation_history.append({
                    "role": "model",
                    "parts": [{"text": content}]
                })
    elif request.chat_context:
        # Fallback to chat_context if no thread_id
        for msg in request.chat_context:
            role = msg.get("role")
            content = msg.get("content", "")
            if role == "user":
                conversation_history.append({
                    "role": "user",
                    "parts": [{"text": content}]
                })
            elif role == "assistant":
                conversation_history.append({
                    "role": "model",
                    "parts": [{"text": content}]
                })

    return conversation_history




def _chunk_text(value: str, size: int = 50) -> List[str]:
    """Yield reasonably sized chunks for smooth streaming."""
    if not value:
        return []
    return [value[i : i + size] for i in range(0, len(value), size)]

def _decode_json_stream_incremental(raw_text: str, start_index: int) -> tuple[str, int, bool]:
    """Decode a JSON string incrementally, returning new decoded text and completion flag.
    
    CRITICAL: This function streams characters as they arrive, NOT waiting for the closing quote.
    This enables zero-latency streaming of answer content.
    """
    decoded_chars: List[str] = []
    i = start_index
    length = len(raw_text)
    completed = False

    while i < length:
        char = raw_text[i]
        if char == '\\':
            if i + 1 >= length:
                break  # Wait for next chunk to complete escape
            next_char = raw_text[i + 1]
            if next_char == 'n':
                decoded_chars.append('\n')
                i += 2
            elif next_char == 't':
                decoded_chars.append('\t')
                i += 2
            elif next_char == 'r':
                decoded_chars.append('\r')
                i += 2
            elif next_char == '"':
                decoded_chars.append('"')
                i += 2
            elif next_char == '\\':
                decoded_chars.append('\\')
                i += 2
            elif next_char == 'u':
                if i + 5 >= length:
                    break  # Incomplete unicode escape, wait for more data
                hex_digits = raw_text[i + 2:i + 6]
                if all(c in "0123456789abcdefABCDEF" for c in hex_digits):
                    decoded_chars.append(chr(int(hex_digits, 16)))
                    i += 6
                else:
                    decoded_chars.append(next_char)
                    i += 2
            else:
                decoded_chars.append(next_char)
                i += 2
        elif char == '"':
            # Found closing quote - mark as completed
            completed = True
            i += 1  # Move past closing quote
            break
        else:
            # Regular character - decode immediately and continue
            # This is the key: we don't wait for closing quote, we stream as we go!
            decoded_chars.append(char)
            i += 1

    # Return whatever we've decoded so far, even if not completed
    # This enables streaming before the closing quote arrives
    return ''.join(decoded_chars), i, completed

@router.post("/fast-gemini-chat")
async def fast_gemini_chat_non_streaming(
    request: ChatRequest,
    user_id: Optional[str] = Depends(get_optional_user_id)
):
    """
    Non-streaming endpoint for quick testing
    """
    try:
        start_time = time.time()

        conversation_history = await _build_history(
            request, 
            system_instructions=QUICK_CHAT_SYSTEM_PROMPT,
            user_id=user_id
        )
        user_parts = _build_user_parts(request.message, request.attachments)

        # Resolve system instructions (request override takes precedence, then default prompt)
        resolved_instructions = request.system_instructions or QUICK_CHAT_SYSTEM_PROMPT

        # Create model with proper system instructions (full prompt passed as system_instruction)
        model = genai.GenerativeModel(
            request.model,
            system_instruction=resolved_instructions,
            generation_config={
                "temperature": FAST_CHAT_TEMPERATURE,
            },
        )
        logger.debug(f"[Quick Chat] Using system instructions (length: {len(resolved_instructions)} chars)")
        chat = model.start_chat(history=conversation_history)
        response = chat.send_message({
            "role": "user",
            "parts": user_parts
        })
        
        elapsed_ms = (time.time() - start_time) * 1000
        
        return ChatResponse(
            response=response.text,
            time_ms=elapsed_ms
        )
    except Exception as e:
        logger.error(f"Fast Gemini chat error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/fast-gemini-chat/stream")
async def fast_gemini_chat_streaming(
    request: ChatRequest,
    user_id: Optional[str] = Depends(get_optional_user_id)
):
    """
    Streaming endpoint - real-time character-by-character streaming from Gemini
    """
    
    async def generate_stream() -> AsyncGenerator[str, None]:
        try:
            start_time = time.time()
            
            # Send metadata first
            yield f"data: {json.dumps({'type': 'start', 'time': start_time})}\n\n"
            
            conversation_history = await _build_history(
                request, 
                system_instructions=QUICK_CHAT_SYSTEM_PROMPT,
                user_id=user_id
            )
            user_parts = _build_user_parts(request.message, request.attachments)

            # Resolve system instructions (request override takes precedence, then default prompt)
            resolved_instructions = request.system_instructions or QUICK_CHAT_SYSTEM_PROMPT

            # Create model with proper system instructions (full prompt passed as system_instruction)
            model = genai.GenerativeModel(
                request.model,
                system_instruction=resolved_instructions,
                generation_config={
                    "temperature": FAST_CHAT_TEMPERATURE,
                },
            )
            logger.debug(f"[Quick Chat Stream] Using system instructions (length: {len(resolved_instructions)} chars)")
            chat = model.start_chat(history=conversation_history)
            
            # Stream response
            response = chat.send_message({
                "role": "user",
                "parts": user_parts
            }, stream=True)
            
            # Stream each token chunk as it arrives from Gemini
            # This gives the true letter-by-letter typewriter effect
            # For very large chunks, split them character-by-character for smooth streaming
            for chunk in response:
                if chunk.text:
                    # If chunk is large, stream it character-by-character for smooth effect
                    if len(chunk.text) > 50:
                        # Stream each character individually for smooth letter-by-letter effect
                        for char in chunk.text:
                            chunk_data = {
                                'type': 'chunk',
                                'content': char
                            }
                            yield f"data: {json.dumps(chunk_data)}\n\n"
                    else:
                        # Send small chunks immediately as they arrive (already smooth)
                        chunk_data = {
                            'type': 'chunk',
                            'content': chunk.text
                        }
                        yield f"data: {json.dumps(chunk_data)}\n\n"
            
            # Send completion
            elapsed_ms = (time.time() - start_time) * 1000
            completion_data = {
                'type': 'done',
                'time_ms': elapsed_ms
            }
            yield f"data: {json.dumps(completion_data)}\n\n"
            
        except Exception as e:
            logger.error(f"Streaming error: {e}")
            error_data = {
                'type': 'error',
                'error': str(e)
            }
            yield f"data: {json.dumps(error_data)}\n\n"
    
    return StreamingResponse(
        generate_stream(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no"  # Disable nginx buffering
        }
    )

@router.get("/fast-gemini-chat/health")
async def health_check():
    """Quick health check"""
    return {
        "status": "ok",
        "model": DEFAULT_GEMINI_RESEARCH_MODEL,
        "api_key_configured": bool(config.GEMINI_API_KEY)
    }


def _strip_json_wrappers(raw_text: str) -> str:
    """Remove Markdown fences or stray commentary from Gemini output."""
    if not raw_text:
        return ""
    
    cleaned = raw_text.strip()
    
    # First, try to extract JSON from markdown code fences (```json ... ``` or ``` ... ```)
    # This handles cases where there's text before/after the code block
    json_pattern = r'```(?:json)?\s*\n?(.*?)\n?```'
    match = re.search(json_pattern, cleaned, re.DOTALL)
    if match:
        cleaned = match.group(1).strip()
    elif cleaned.startswith("```"):
        # Fallback: simple split if it starts with ```
        parts = cleaned.split("```")
        if len(parts) >= 3:
            # Get content between first and second ```
            cleaned = parts[1]
            # Remove language identifier if present (json, python, etc.)
            if cleaned.startswith("json"):
                cleaned = cleaned[4:].lstrip()
            elif cleaned.startswith("python"):
                cleaned = cleaned[6:].lstrip()
            elif cleaned.startswith("javascript"):
                cleaned = cleaned[10:].lstrip()
    
    # Remove any leading/trailing non-JSON text
    # Find the first { which indicates start of JSON object
    first_brace = cleaned.find('{')
    if first_brace == -1:
        # No JSON found - return empty to trigger error
        return ""
    
    # Check if the { is likely part of a code block (like C code) vs JSON
    # JSON should have "answer" or "decision" nearby
    preview = cleaned[first_brace:first_brace+50].lower()
    if '"answer"' not in preview and '"decision"' not in preview:
        # Might be code, look for actual JSON further
        # Try to find JSON-like structure with "answer" or "decision"
        json_like = re.search(r'\{[^{]*"(?:answer|decision)"', cleaned, re.IGNORECASE)
        if json_like:
            first_brace = json_like.start()
            cleaned = cleaned[first_brace:]
        else:
            # No valid JSON found
            return ""
    else:
        # Extract from first { to matching }
        cleaned = cleaned[first_brace:]
    
    # Find the matching closing brace (handle nested objects and strings)
    brace_count = 0
    in_string = False
    escape_next = False
    
    for i, char in enumerate(cleaned):
        if escape_next:
            escape_next = False
            continue
        
        if char == '\\':
            escape_next = True
            continue
        
        if char == '"' and not escape_next:
            in_string = not in_string
            continue
        
        if not in_string:
            if char == '{':
                brace_count += 1
            elif char == '}':
                brace_count -= 1
                if brace_count == 0:
                    cleaned = cleaned[:i+1]
                    break
    
    return cleaned.strip()


def _fix_json_control_chars(json_str: str) -> str:
    """Fix unescaped control characters and special chars in JSON strings by properly escaping them."""
    result = []
    i = 0
    in_string = False
    escape_next = False
    
    while i < len(json_str):
        char = json_str[i]
        
        if escape_next:
            # After backslash, just copy the next char (already escaped)
            result.append(char)
            escape_next = False
            i += 1
            continue
        
        if char == '\\':
            result.append(char)
            escape_next = True
            i += 1
            continue
        
        if char == '"':
            in_string = not in_string
            result.append(char)
            i += 1
            continue
        
        if in_string:
            # Inside a string, escape control characters and problematic chars that aren't already escaped
            if char == '\n':
                result.append('\\n')
            elif char == '\r':
                result.append('\\r')
            elif char == '\t':
                result.append('\\t')
            elif char == '`':
                # Escape backticks (common in markdown code blocks)
                result.append('\\`')
            elif char == '\b':
                result.append('\\b')
            elif char == '\f':
                result.append('\\f')
            elif ord(char) < 32:
                # Other control characters - escape as unicode or replace with space
                result.append(f'\\u{ord(char):04x}')
            else:
                result.append(char)
        else:
            result.append(char)
        
        i += 1
    
    return ''.join(result)


def _parse_adaptive_decision(raw_text: str) -> AdaptiveChatResponse:
    """Parse the adaptive router output into a strongly typed payload."""
    if not raw_text or not raw_text.strip():
        logger.error("Adaptive router returned empty response")
        raise HTTPException(status_code=500, detail="Adaptive router returned empty response")
    
    cleaned = _strip_json_wrappers(raw_text)
    
    if not cleaned:
        # Log the raw response to help debug
        logger.error(f"Could not extract JSON from adaptive router response")
        logger.error(f"Raw response (first 1000 chars): {raw_text[:1000]}")
        # Try one more time with a more aggressive search
        # Look for JSON object that contains "answer" and "decision" fields (not CSS or other code)
        # First try to find JSON with both required fields
        json_match = re.search(r'\{[^{}]*"(?:answer|decision)"[^{}]*(?:\{[^{}]*\}[^{}]*)*\}', raw_text, re.DOTALL | re.IGNORECASE)
        if json_match:
            # Verify it has both fields
            match_text = json_match.group(0)
            if '"answer"' in match_text.lower() and '"decision"' in match_text.lower():
                cleaned = match_text
                logger.info("Found JSON using aggressive regex search with answer and decision fields")
            else:
                # Try to find the outermost JSON object that contains both fields
                # Look for JSON starting with { and containing both answer and decision
                start_idx = raw_text.find('{')
                if start_idx != -1:
                    # Find matching closing brace by counting braces
                    brace_count = 0
                    in_string = False
                    escape_next = False
                    for i in range(start_idx, len(raw_text)):
                        char = raw_text[i]
                        if escape_next:
                            escape_next = False
                            continue
                        if char == '\\':
                            escape_next = True
                            continue
                        if char == '"':
                            in_string = not in_string
                            continue
                        if not in_string:
                            if char == '{':
                                brace_count += 1
                            elif char == '}':
                                brace_count -= 1
                                if brace_count == 0:
                                    candidate = raw_text[start_idx:i+1]
                                    if '"answer"' in candidate.lower() and '"decision"' in candidate.lower():
                                        cleaned = candidate
                                        logger.info("Found JSON by matching braces with answer and decision fields")
                                        break
                    if not cleaned:
                        # Fallback: use the regex match anyway
                        cleaned = match_text
                        logger.info("Found JSON using aggressive regex search (fallback)")
        else:
            raise HTTPException(status_code=500, detail="Adaptive router returned empty or invalid response. Expected JSON format with 'answer' and 'decision' fields.")
    
    # Always fix control characters before parsing (LLM often returns unescaped newlines)
    fixed_json = _fix_json_control_chars(cleaned)
    
    # Try to parse JSON with better error handling
    try:
        payload = json.loads(fixed_json)
    except json.JSONDecodeError as exc:
        logger.error(f"Adaptive router JSON parse error: {exc}")
        logger.error(f"Fixed JSON (first 500 chars): {fixed_json[:500]}")
        logger.error(f"Cleaned text (first 500 chars): {cleaned[:500]}")
        logger.error(f"Raw text (first 500 chars): {raw_text[:500]}")
        # Try to extract JSON more aggressively using brace matching
        try:
            # Find the outermost JSON object by matching braces properly
            json_start = fixed_json.find('{')
            if json_start == -1:
                raise HTTPException(status_code=500, detail=f"Adaptive router returned invalid JSON: {str(exc)}")
            
            # Find matching closing brace by counting braces (respecting strings)
            brace_count = 0
            in_string = False
            escape_next = False
            json_end = -1
            
            for i in range(json_start, len(fixed_json)):
                char = fixed_json[i]
                if escape_next:
                    escape_next = False
                    continue
                if char == '\\':
                    escape_next = True
                    continue
                if char == '"':
                    in_string = not in_string
                    continue
                if not in_string:
                    if char == '{':
                        brace_count += 1
                    elif char == '}':
                        brace_count -= 1
                        if brace_count == 0:
                            json_end = i + 1
                            break
            
            if json_end > json_start:
                extracted = fixed_json[json_start:json_end]
                # Fix control chars again on extracted portion
                extracted = _fix_json_control_chars(extracted)
                # Verify it contains required fields before trying to parse
                if '"answer"' in extracted.lower() and '"decision"' in extracted.lower():
                    payload = json.loads(extracted)
                    logger.info("Successfully extracted and fixed JSON after retry with brace matching")
                else:
                    raise HTTPException(status_code=500, detail=f"Adaptive router returned invalid JSON: extracted JSON missing required fields (answer/decision)")
            else:
                raise HTTPException(status_code=500, detail=f"Adaptive router returned invalid JSON: {str(exc)}")
        except (json.JSONDecodeError, HTTPException) as retry_exc:
            # If it's already an HTTPException, re-raise it
            if isinstance(retry_exc, HTTPException):
                raise retry_exc
            raise HTTPException(status_code=500, detail=f"Adaptive router returned invalid JSON: {str(exc)}")

    if not isinstance(payload, dict):
        logger.error(f"Payload is not a dict: {type(payload)}")
        raise HTTPException(status_code=500, detail="Adaptive router response is not a valid object")
    
    if "answer" not in payload:
        logger.error(f"Missing 'answer' field. Payload keys: {payload.keys()}")
        raise HTTPException(status_code=500, detail="Adaptive router response missing 'answer' field")
    
    if "decision" not in payload:
        logger.error(f"Missing 'decision' field. Payload keys: {payload.keys()}")
        raise HTTPException(status_code=500, detail="Adaptive router response missing 'decision' field")

    decision_payload = payload.get("decision") or {}
    if not isinstance(decision_payload, dict):
        logger.error(f"Decision is not a dict: {type(decision_payload)}")
        decision_payload = {}

    ask_user_payload = decision_payload.get("ask_user")

    raw_state = decision_payload.get("state")
    logger.info(f"[Adaptive] Raw state from payload: {raw_state} (type: {type(raw_state)})")
    try:
        state = AdaptiveDecisionState(raw_state)
        logger.info(f"[Adaptive] Parsed state: {state} (type: {type(state)})")
    except Exception as e:
        logger.warning(f"Invalid state '{raw_state}', defaulting to AGENT_NOT_NEEDED: {e}")
        state = AdaptiveDecisionState.AGENT_NOT_NEEDED

    confidence = float(decision_payload.get("confidence", 0.5))
    if confidence < 0:
        confidence = 0.0
    if confidence > 1:
        confidence = 1.0

    # Validate ask_user payload if state is ask_user
    ask_user_obj = None
    if state == AdaptiveDecisionState.ASK_USER:
        if ask_user_payload and isinstance(ask_user_payload, dict):
            try:
                # Extract fields with defaults
                prompt = ask_user_payload.get("prompt") or "Would you like me to continue in Iris Intelligence mode?"
                yes_label = ask_user_payload.get("yes_label") or "Yes, continue"
                no_label = ask_user_payload.get("no_label") or "No, I'm fine"
                
                ask_user_obj = AdaptiveAskUserPrompt(
                    prompt=str(prompt),
                    yes_label=str(yes_label),
                    no_label=str(no_label)
                )
            except Exception as e:
                logger.error(f"Invalid ask_user payload: {e}, payload: {ask_user_payload}")
                # Fallback to default
                ask_user_obj = AdaptiveAskUserPrompt(
                    prompt="Would you like me to continue in Iris Intelligence mode?",
                    yes_label="Yes, continue",
                    no_label="No, I'm fine"
                )
        else:
            logger.warning(f"ask_user state but no/invalid ask_user payload (type: {type(ask_user_payload)}), creating default")
            ask_user_obj = AdaptiveAskUserPrompt(
                prompt="Would you like me to continue in Iris Intelligence mode?",
                yes_label="Yes, continue",
                no_label="No, I'm fine"
            )

    # Handle reason field - convert list to string if needed
    reason_value = decision_payload.get("reason") or "No reason provided"
    if isinstance(reason_value, list):
        # Convert list to bullet point string format
        reason_str = "\n".join([f"• {item}" if not item.startswith("•") else item for item in reason_value])
    else:
        reason_str = str(reason_value)
    
    decision = AdaptiveDecision(
        state=state,
        confidence=confidence,
        reason=reason_str,
        agent_preface=decision_payload.get("agent_preface"),
        ask_user=ask_user_obj,
        metadata=decision_payload.get("metadata") or {},
    )

    logger.info(f"[Adaptive] Final decision object: state={decision.state}, confidence={decision.confidence}, reason={decision.reason[:100] if decision.reason else 'None'}")
    logger.info(f"[Adaptive] Decision dict(): {decision.dict()}")

    return AdaptiveChatResponse(
        response=payload.get("answer", "").strip(),
        decision=decision,
        time_ms=0.0,
    )


async def run_adaptive_router(
    request: ChatRequest,
    user_id: Optional[str] = None
) -> AdaptiveChatResponse:
    """Shared adaptive router executor that returns parsed decisions."""
    start_time = time.time()
    conversation_history = await _build_history(
        request, 
        system_instructions=ADAPTIVE_ROUTER_PROMPT,
        user_id=user_id
    )
    user_parts = _build_user_parts(request.message, request.attachments)

    # Resolve system instructions (request override takes precedence, then default prompt)
    resolved_instructions = request.system_instructions or ADAPTIVE_ROUTER_PROMPT

    # Force JSON output by using response_mime_type
    # Full prompt passed as system_instruction (not as user message)
    # Optimized: removed top_p for faster generation
    model = genai.GenerativeModel(
        request.model,
        system_instruction=resolved_instructions,
        generation_config={
            "temperature": ADAPTIVE_TEMPERATURE,
            # Removed top_p for faster generation
            "response_mime_type": "application/json",
        },
    )
    logger.debug(f"[Adaptive] Using system instructions (length: {len(resolved_instructions)} chars)")
    chat = model.start_chat(history=conversation_history)
    response = chat.send_message({
        "role": "user",
        "parts": user_parts
    })

    response_text = response.text or ""
    if not response_text:
        logger.error("LLM returned empty response")
        raise HTTPException(status_code=500, detail="LLM returned empty response")
    
    # Log the raw response for debugging (first 500 chars)
    logger.debug(f"LLM raw response (first 500 chars): {response_text[:500]}")
    
    parsed = _parse_adaptive_decision(response_text)
    parsed.time_ms = (time.time() - start_time) * 1000
    return parsed


@router.post("/adaptive", response_model=AdaptiveChatResponse)
async def adaptive_chat_router(
    request: ChatRequest,
    user_id: Optional[str] = Depends(get_optional_user_id)
):
    """
    Adaptive chat endpoint that produces a lightweight answer +
    routing recommendation for Iris Intelligence mode.
    """
    try:
        return await run_adaptive_router(request, user_id=user_id)
    except HTTPException:
        raise
    except Exception as exc:
        logger.error(f"Adaptive chat error: {exc}")
        raise HTTPException(status_code=500, detail=str(exc))


@router.post("/adaptive/stream")
async def adaptive_chat_stream(
    request: ChatRequest,
    user_id: Optional[str] = Depends(get_optional_user_id)
):
    """Streaming variant that streams answer content character-by-character as tokens arrive from Gemini."""

    async def generate_stream():
        try:
            import asyncio
            start_time = time.time()
            yield f"data: {json.dumps({'type': 'metadata', 'time': start_time})}\n\n"
            
            # CRITICAL: Start API call IMMEDIATELY - don't wait for anything!
            user_parts = _build_user_parts(request.message, request.attachments)
            
            # Resolve system instructions (request override takes precedence, then default prompt)
            resolved_instructions = request.system_instructions or ADAPTIVE_ROUTER_PROMPT
            
            # Build conversation history (system instructions NOT added as user messages)
            conversation_history = await _build_history(
                request, 
                system_instructions=ADAPTIVE_ROUTER_PROMPT,
                user_id=user_id
            )
            
            # Create model with proper system instructions (full prompt passed as system_instruction, not as user messages)
            # Optimized: removed top_p for faster generation, kept temperature for quality
            # Use JSON mode for reliable parsing (consistent with non-streaming endpoint)
            model = genai.GenerativeModel(
                request.model,
                system_instruction=resolved_instructions,
                generation_config={
                    "temperature": ADAPTIVE_TEMPERATURE,
                    # Removed top_p for faster generation
                    "response_mime_type": "application/json",  # Enable JSON mode for reliable parsing
                },
            )
            logger.debug(f"[Adaptive Stream] Using system instructions (length: {len(resolved_instructions)} chars)")

            # Stream directly from Gemini with JSON mode
            chat = model.start_chat(history=conversation_history)
            
            # Start the API call - this is the critical path for zero latency!
            response = chat.send_message({
                "role": "user",
                "parts": user_parts
            }, stream=True)
            
            # ZERO-LATENCY STREAMING: Stream ALL tokens immediately, filter JSON structure on-the-fly
            full_response = ""
            answer_content_streamed = ""
            answer_start_idx = None
            raw_answer_processed_idx = 0
            in_answer_string = False
            json_structure_buffer = ""  # Buffer for JSON structure we want to skip
            streaming_answer = False
            
            # Stream tokens immediately - this is the key to zero latency!
            for chunk in response:
                if chunk.text:
                    chunk_text = chunk.text
                    full_response += chunk_text
                    
                    # Check if we've found the answer field start
                    if answer_start_idx is None:
                        # Look for "answer" field
                        lower_full = full_response.lower()
                        answer_key_pos = lower_full.rfind('"answer"')
                        if answer_key_pos != -1:
                            # Find colon after "answer"
                            colon_pos = full_response.find(':', answer_key_pos)
                            if colon_pos != -1:
                                # Skip whitespace and find opening quote
                                idx = colon_pos + 1
                                while idx < len(full_response) and full_response[idx].isspace():
                                    idx += 1
                                if idx < len(full_response) and full_response[idx] == '"':
                                    answer_start_idx = idx + 1
                                    raw_answer_processed_idx = 0
                                    in_answer_string = True
                                    streaming_answer = True
                    
                    # If we're in the answer string, extract and stream content IMMEDIATELY
                    if in_answer_string and answer_start_idx is not None:
                        # Extract answer string value using incremental decoder
                        raw_answer = full_response[answer_start_idx:]
                        decoded_delta, raw_answer_processed_idx, completed = _decode_json_stream_incremental(
                            raw_answer, raw_answer_processed_idx
                        )
                        if decoded_delta:
                            # Optimized: Only run regex if we detect potential decision text (check for "decision" keyword first)
                            # This avoids expensive regex on every chunk when decision text isn't present
                            if 'decision' in decoded_delta.lower() or '}' in decoded_delta:
                                # Filter out decision object text only when needed
                                cleaned_delta = re.sub(r',\s*decision\s*:\s*\{[^{}]*(?:\{[^{}]*\}[^{}]*)*\}', '', decoded_delta, flags=re.IGNORECASE)
                                cleaned_delta = re.sub(r'decision\s*:\s*\{[^{}]*(?:\{[^{}]*\}[^{}]*)*\}', '', cleaned_delta, flags=re.IGNORECASE)
                            else:
                                cleaned_delta = decoded_delta
                            
                            if cleaned_delta:
                                # STREAM IMMEDIATELY - zero latency!
                                yield f"data: {json.dumps({'type': 'content', 'content': cleaned_delta})}\n\n"
                                answer_content_streamed += cleaned_delta
                        
                        if completed:
                            in_answer_string = False
                    elif not streaming_answer:
                        # Before we find answer field, we might see JSON structure
                        # Don't stream it, but also don't wait - process quickly
                        # The answer field should appear in the first few tokens
                        pass
            
            # Parse full response to get decision after streaming completes
            try:
                parsed = _parse_adaptive_decision(full_response)
                actual_answer = parsed.response
                
                # If we didn't stream everything, stream the remainder (with decision text filtered)
                if len(actual_answer) > len(answer_content_streamed):
                    remaining = actual_answer[len(answer_content_streamed):]
                    if remaining:
                        # Filter out decision object text
                        cleaned_remaining = re.sub(r',\s*decision\s*:\s*\{[^{}]*(?:\{[^{}]*\}[^{}]*)*\}', '', remaining, flags=re.IGNORECASE)
                        cleaned_remaining = re.sub(r'decision\s*:\s*\{[^{}]*(?:\{[^{}]*\}[^{}]*)*\}', '', cleaned_remaining, flags=re.IGNORECASE)
                        if cleaned_remaining:
                            yield f"data: {json.dumps({'type': 'content', 'content': cleaned_remaining})}\n\n"
                elif answer_start_idx is None:
                    # Never found answer field, stream full answer (fallback)
                    # This shouldn't happen if JSON parsing works, but safety fallback
                    if actual_answer:
                        # Filter out decision object text
                        cleaned_answer = re.sub(r',\s*decision\s*:\s*\{[^{}]*(?:\{[^{}]*\}[^{}]*)*\}', '', actual_answer, flags=re.IGNORECASE)
                        cleaned_answer = re.sub(r'decision\s*:\s*\{[^{}]*(?:\{[^{}]*\}[^{}]*)*\}', '', cleaned_answer, flags=re.IGNORECASE)
                        if cleaned_answer:
                            yield f"data: {json.dumps({'type': 'content', 'content': cleaned_answer})}\n\n"
                
                # Send the decision and completion
                # Use model_dump with mode='json' to ensure enum values are serialized as strings
                decision_dict = parsed.decision.model_dump(mode='json') if hasattr(parsed.decision, 'model_dump') else parsed.decision.dict()
                logger.info(f"[Adaptive Stream] Sending decision: {decision_dict}")
                yield f"data: {json.dumps({'type': 'decision', 'decision': decision_dict})}\n\n"
                
                elapsed_ms = (time.time() - start_time) * 1000
                yield f"data: {json.dumps({'type': 'done', 'time_ms': elapsed_ms})}\n\n"
            except Exception as parse_error:
                logger.error(f"Failed to parse adaptive response: {parse_error}")
                logger.error(f"Full response (first 1000 chars): {full_response[:1000]}")
                # Fallback: use non-streaming method
                result = await run_adaptive_router(request, user_id=user_id)
                # Stream answer in chunks
                chunk_size = 50
                for i in range(0, len(result.response), chunk_size):
                    chunk = result.response[i:i + chunk_size]
                    yield f"data: {json.dumps({'type': 'content', 'content': chunk})}\n\n"
                # Use model_dump with mode='json' to ensure enum values are serialized as strings
                decision_dict = result.decision.model_dump(mode='json') if hasattr(result.decision, 'model_dump') else result.decision.dict()
                logger.info(f"[Adaptive Stream Fallback] Sending decision: {decision_dict}")
                yield f"data: {json.dumps({'type': 'decision', 'decision': decision_dict})}\n\n"
                yield f"data: {json.dumps({'type': 'done', 'time_ms': result.time_ms})}\n\n"
                
        except HTTPException as exc:
            yield f"data: {json.dumps({'type': 'error', 'error': exc.detail})}\n\n"
        except Exception as exc:  # pragma: no cover - defensive
            logger.error(f"Adaptive streaming error: {exc}")
            yield f"data: {json.dumps({'type': 'error', 'error': str(exc)})}\n\n"

    return StreamingResponse(
        generate_stream(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )
