"""
Fast Gemini 2.5 Flash Chat Endpoint
Super simple, super fast streaming chat with Gemini
"""
import os
import json
import time
from typing import AsyncGenerator, Optional, List, Dict
from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
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


def _build_history(request: ChatRequest) -> List[Dict]:
    """Build the conversation history excluding the current user message."""
    conversation_history: List[Dict] = []

    if request.system_instructions:
        conversation_history.append({
            "role": "user",
            "parts": [{"text": f"System Instructions: {request.system_instructions}"}]
        })
        conversation_history.append({
            "role": "model",
            "parts": [{"text": "I understand. I'll follow these system instructions."}]
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

        conversation_history = _build_history(request)
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
            
            conversation_history = _build_history(request)
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
