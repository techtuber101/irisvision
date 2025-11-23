"""
Fast Gemini 2.5 Flash Chat Endpoint
Super simple, super fast streaming chat with Gemini
"""
import os
import json
import re
import time
from enum import Enum
from typing import AsyncGenerator, Optional, List, Dict, Any
from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field
import google.generativeai as genai
from core.utils.config import config
from core.utils.logger import logger

router = APIRouter()

# Configure Gemini
genai.configure(api_key=config.GEMINI_API_KEY)

class Attachment(BaseModel):
    mime_type: str
    data: str
    name: Optional[str] = None

class ChatRequest(BaseModel):
    message: str
    model: str = "gemini-2.5-flash"  # Default to stable Gemini model
    system_instructions: Optional[str] = None
    chat_context: Optional[List[Dict[str, str]]] = None
    attachments: Optional[List[Attachment]] = None

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

ADAPTIVE_ROUTER_PROMPT = """You are Iris Adaptive Mode Router. Your PRIMARY role is to answer the user's question concisely FIRST, then make a routing decision.

STEP 1: ANSWER THE QUESTION
Provide a concise, focused answer (MAXIMUM 12-16 lines total). Skip lengthy greetings - be direct and helpful.

Answer guidelines:
- **Length**: Maximum 12-16 lines total. Be concise and focused on key information.
- **Greetings**: Keep greetings minimal (1 line max). No lengthy pleasantries.
- **Formatting**: Use markdown formatting ONLY for actual content/explanation, not for greetings:
  - **Tables**: For comparisons, data, lists (| Column 1 | Column 2 |)
  - **Headings**: Use ## for main sections, ### for subsections (skip # for main title)
  - **Lists**: Use bullet points (- or *) and numbered lists (1. 2. 3.)
  - **Emphasis**: Use **bold**, *italics*, and `code` formatting
  - **Code blocks**: Use ```language for code examples
- **Structure**: Organize information clearly but keep it brief
- **Focus**: Answer the question directly with the most important information

Example format:
[Brief 1-line greeting if needed]

## Key Point 1
Explanation...

## Key Point 2
Explanation...

[Use formatting for actual content, not greetings]

STEP 2: ROUTING DECISION
After providing the answer, decide routing:

- `agent_needed`: Clear agentic tasks (build/create/automate with scope, file ops, code, multi-step)
- `agent_not_needed`: Simple Q&A, follow-ups ("what?", "explain"), clarifications, info queries
- `ask_user`: ONLY ambiguous INITIAL requests where quick answer OR deep agentic work both make sense

Analyze for `ask_user`:
1. Task type: Ambiguous scope ("build website" = template or full custom? "analyze data" = summary or deep analysis?)
2. Language/tone: Vague ("help with X"), exploratory ("what can you do"), open-ended prompts
3. Context: First message, unclear if user wants quick info vs full implementation

For `ask_user` state:
- `prompt` field: MUST be short and snappy. Format: "Continue [2-3 word context] in Iris Intelligence mode?"
  Examples: "Continue building website in Iris Intelligence mode?", "Continue analyzing stocks in Iris Intelligence mode?", "Continue creating app in Iris Intelligence mode?"
  Keep it under 10 words. Extract the key task/context from the user's request.
  
- `reason` field: User-facing bullet points (no justification, no "I'll" language). List what WILL be done in short, action-oriented phrases.
  Format: "• Create layout\n• Build all pages\n• Deploy website" or "• Analyze data\n• Generate reports\n• Create visualizations"
  Each bullet should be 2-5 words max. Focus on concrete actions, not explanations.

CRITICAL: When state is "ask_user", you MUST include the "ask_user" object with "prompt", "yes_label", and "no_label" fields.

CRITICAL JSON FORMAT REQUIREMENTS:
- You MUST return ONLY valid JSON, nothing else
- NO markdown code fences (no ```json or ```)
- NO explanatory text before or after the JSON
- NO code examples outside the JSON
- Start your response with { and end with }
- The "answer" field should contain your markdown-formatted answer as a JSON string (properly escaped)

JSON structure (strict JSON, no markdown fences, no extra text):
{"answer": "<beautifully formatted markdown answer with tables/headings/lists>", "decision": {"state": "agent_needed|agent_not_needed|ask_user", "confidence": 0.0-1.0, "reason": "<bullet points>", "agent_preface": "I'll continue in Iris Intelligence mode.", "ask_user": {"prompt": "<short snappy question>", "yes_label": "Yes, continue", "no_label": "No, I'm fine"}, "metadata": {"suggested_tools": [], "urgency": "low|medium|high"}}}

Example of correct response (this is the ONLY format):
{"answer": "# My Answer\n\nHere is the information...", "decision": {"state": "agent_not_needed", "confidence": 0.9, "reason": "Simple information query"}}

Rules: 
1. ALWAYS provide a comprehensive, beautifully formatted answer FIRST (inside the "answer" JSON field)
2. THEN make the routing decision (inside the "decision" JSON field)
3. Use markdown extensively in the answer field (tables, headings, lists, formatting)
4. Be friendly, accurate, and focused on key information
5. If state is ask_user, MUST include ask_user object
6. Default agent_not_needed for follow-ups
7. RETURN ONLY THE JSON OBJECT - NO OTHER TEXT
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


def _build_history(request: ChatRequest, system_instructions: Optional[str] = None) -> List[Dict]:
    """Build the conversation history excluding the current user message."""
    conversation_history: List[Dict] = []

    resolved_instructions = system_instructions or request.system_instructions

    if resolved_instructions:
        conversation_history.append({
            "role": "user",
            "parts": [{"text": f"System Instructions: {resolved_instructions}"}]
        })
        conversation_history.append({
            "role": "model",
            "parts": [{"text": "Understood. I will follow these instructions."}]
        })

    if request.chat_context:
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

@router.post("/fast-gemini-chat")
async def fast_gemini_chat_non_streaming(request: ChatRequest):
    """
    Non-streaming endpoint for quick testing
    """
    try:
        start_time = time.time()

        conversation_history = _build_history(request, system_instructions=QUICK_CHAT_SYSTEM_PROMPT)
        user_parts = _build_user_parts(request.message, request.attachments)

        # Create model and generate response
        model = genai.GenerativeModel(request.model)
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
async def fast_gemini_chat_streaming(request: ChatRequest):
    """
    Streaming endpoint - real-time character-by-character streaming from Gemini
    """
    
    async def generate_stream() -> AsyncGenerator[str, None]:
        try:
            start_time = time.time()
            
            # Send metadata first
            yield f"data: {json.dumps({'type': 'start', 'time': start_time})}\n\n"
            
            conversation_history = _build_history(request, system_instructions=QUICK_CHAT_SYSTEM_PROMPT)
            user_parts = _build_user_parts(request.message, request.attachments)

            model = genai.GenerativeModel(request.model)
            chat = model.start_chat(history=conversation_history)
            
            # Stream response
            response = chat.send_message({
                "role": "user",
                "parts": user_parts
            }, stream=True)
            
            # Stream each token chunk as it arrives from Gemini
            # This gives the true letter-by-letter typewriter effect
            for chunk in response:
                if chunk.text:
                    # Send each character chunk immediately as it arrives
                    # Gemini naturally streams in small token chunks
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
        "model": "gemini-2.5-flash",
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
    """Fix unescaped control characters in JSON strings by properly escaping them."""
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
            # Inside a string, escape control characters that aren't already escaped
            if char == '\n':
                result.append('\\n')
            elif char == '\r':
                result.append('\\r')
            elif char == '\t':
                result.append('\\t')
            elif ord(char) < 32:
                # Other control characters - replace with space to avoid breaking JSON
                result.append(' ')
            else:
                result.append(char)
        else:
            result.append(char)
        
        i += 1
    
    return ''.join(result)


def _parse_adaptive_decision(raw_text: str) -> AdaptiveChatResponse:
    """Parse the adaptive router output into a strongly typed payload."""
    cleaned = _strip_json_wrappers(raw_text)
    
    if not cleaned:
        raise HTTPException(status_code=500, detail="Adaptive router returned empty or invalid response")
    
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
        # Try to extract JSON more aggressively
        try:
            # Look for JSON object in the text
            json_start = fixed_json.find('{')
            json_end = fixed_json.rfind('}') + 1
            if json_start != -1 and json_end > json_start:
                extracted = fixed_json[json_start:json_end]
                # Fix control chars again on extracted portion
                extracted = _fix_json_control_chars(extracted)
                payload = json.loads(extracted)
                logger.info("Successfully extracted and fixed JSON after retry")
            else:
                raise HTTPException(status_code=500, detail=f"Adaptive router returned invalid JSON: {str(exc)}")
        except (json.JSONDecodeError, HTTPException) as retry_exc:
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
    try:
        state = AdaptiveDecisionState(raw_state)
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

    return AdaptiveChatResponse(
        response=payload.get("answer", "").strip(),
        decision=decision,
        time_ms=0.0,
    )


async def run_adaptive_router(request: ChatRequest) -> AdaptiveChatResponse:
    """Shared adaptive router executor that returns parsed decisions."""
    start_time = time.time()
    conversation_history = _build_history(request, system_instructions=ADAPTIVE_ROUTER_PROMPT)
    user_parts = _build_user_parts(request.message, request.attachments)

    model = genai.GenerativeModel(request.model)
    chat = model.start_chat(history=conversation_history)
    response = chat.send_message({
        "role": "user",
        "parts": user_parts
    })

    parsed = _parse_adaptive_decision(response.text or "")
    parsed.time_ms = (time.time() - start_time) * 1000
    return parsed


@router.post("/adaptive", response_model=AdaptiveChatResponse)
async def adaptive_chat_router(request: ChatRequest):
    """
    Adaptive chat endpoint that produces a lightweight answer +
    routing recommendation for Iris Intelligence mode.
    """
    try:
        return await run_adaptive_router(request)
    except HTTPException:
        raise
    except Exception as exc:
        logger.error(f"Adaptive chat error: {exc}")
        raise HTTPException(status_code=500, detail=str(exc))
