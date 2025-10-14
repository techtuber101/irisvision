"""
Fast Gemini 2.5 Flash Chat Endpoint
Super simple, super fast streaming chat with Gemini
"""
import os
import json
import time
from typing import AsyncGenerator
from fastapi import APIRouter, HTTPException, Request
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
import google.generativeai as genai
from core.utils.config import config
from core.utils.logger import logger

router = APIRouter()

# Configure Gemini
genai.configure(api_key=config.GEMINI_API_KEY)

class ChatRequest(BaseModel):
    message: str
    model: str = "gemini-2.0-flash-exp"  # Default to fastest model

class ChatResponse(BaseModel):
    response: str
    time_ms: float

@router.post("/fast-gemini-chat")
async def fast_gemini_chat_non_streaming(request: ChatRequest):
    """
    Non-streaming endpoint for quick testing
    """
    try:
        start_time = time.time()
        
        model = genai.GenerativeModel(request.model)
        response = model.generate_content(request.message)
        
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
            
            # Create model and stream response
            model = genai.GenerativeModel(request.model)
            response = model.generate_content(
                request.message,
                stream=True
            )
            
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
        "model": "gemini-2.0-flash-exp",
        "api_key_configured": bool(config.GEMINI_API_KEY)
    }

