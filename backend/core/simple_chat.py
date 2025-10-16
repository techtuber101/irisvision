"""
Simple Chat Endpoint
Ultra-minimal chat functionality - just API call, thread creation, and message persistence
"""
import asyncio
import os
import json
import uuid
import time
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional
from fastapi import APIRouter, HTTPException, Form, Depends
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
import google.generativeai as genai
from core.utils.config import config
from core.utils.logger import logger
from core.utils.auth_utils import verify_and_get_user_id_from_jwt
from . import core_utils as utils

router = APIRouter()

# Configure Gemini
genai.configure(api_key=config.GEMINI_API_KEY)

class SimpleChatRequest(BaseModel):
    message: str
    model: str = "gemini-2.5-flash"

class SimpleChatResponse(BaseModel):
    thread_id: str
    project_id: str
    response: str
    time_ms: float


def _deserialize_message_content(raw: Any) -> Optional[Dict[str, Any]]:
    """Convert stored Supabase message content into a dict payload."""
    if raw is None:
        return None
    if isinstance(raw, dict):
        return raw
    if isinstance(raw, str):
        raw = raw.strip()
        if not raw:
            return None
        try:
            return json.loads(raw)
        except json.JSONDecodeError:
            return None
    return None


def _flatten_content(value: Any) -> List[str]:
    """Extract plain text fragments from nested Gemini content structures."""
    texts: List[str] = []
    if isinstance(value, str):
        if value:
            texts.append(value)
    elif isinstance(value, list):
        for item in value:
            texts.extend(_flatten_content(item))
    elif isinstance(value, dict):
        for key in ("text", "content", "value"):
            nested = value.get(key)
            if nested is not None:
                texts.extend(_flatten_content(nested))
        if "parts" in value:
            texts.extend(_flatten_content(value["parts"]))
    return texts


def _record_to_history(entry: Dict[str, Any]) -> Optional[Dict[str, Any]]:
    """Convert a message row into a Gemini chat history entry."""
    payload = _deserialize_message_content(entry.get("content"))
    if not payload or not isinstance(payload, dict):
        return None

    role = payload.get("role")
    if role not in {"user", "assistant"}:
        return None

    content = payload.get("content")
    texts = _flatten_content(content)
    if not texts and isinstance(payload.get("parts"), list):
        texts = _flatten_content(payload["parts"])

    combined = "".join(texts).strip()
    if not combined:
        return None

    gemini_role = "user" if role == "user" else "model"
    return {"role": gemini_role, "parts": [combined]}

@router.post("/simple", response_model=SimpleChatResponse, summary="Simple Chat", operation_id="simple_chat")
async def simple_chat(
    message: str = Form(...),
    user_id: str = Depends(verify_and_get_user_id_from_jwt)
):
    """
    Ultra-simple chat endpoint that only does:
    1. Create project and thread
    2. Save user message
    3. Call Gemini API
    4. Save assistant response
    5. Return thread_id for redirect
    
    No sandbox, no file upload, no agent config, no complex metadata.
    """
    start_time = time.time()
    
    try:
        client = await utils.db.client
        account_id = user_id  # In Basejump, personal account_id is the same as user_id
        
        logger.debug(f"Simple chat initiated for user {user_id} with message: {message[:50]}...")
        
        # 1. Create Project (for URL structure)
        project_id = str(uuid.uuid4())
        project = await client.table('projects').insert({
            "project_id": project_id,
            "account_id": account_id,
            "name": "Quick Chat",
            "created_at": datetime.now(timezone.utc).isoformat()
        }).execute()
        
        logger.debug(f"Created project: {project_id}")
        
        # 2. Create Thread (minimal)
        thread_id = str(uuid.uuid4())
        thread = await client.table('threads').insert({
            "thread_id": thread_id,
            "project_id": project_id,
            "account_id": account_id,
            "created_at": datetime.now(timezone.utc).isoformat(),
            "metadata": {"chat_mode": "simple"}  # Mark as simple chat mode
        }).execute()
        
        logger.debug(f"Created thread: {thread_id}")
        
        # 3. Save User Message
        user_message_id = str(uuid.uuid4())
        user_message_payload = {"role": "user", "content": message}
        await client.table('messages').insert({
            "message_id": user_message_id,
            "thread_id": thread_id,
            "type": "user",
            "is_llm_message": True,
            "content": user_message_payload,
            "created_at": datetime.now(timezone.utc).isoformat()
        }).execute()
        
        logger.debug(f"Saved user message: {user_message_id}")
        
        # 4. Call Gemini API (direct call, no system prompt, no context)
        model = genai.GenerativeModel("gemini-2.5-flash")
        response = model.generate_content(message)
        assistant_response = response.text
        
        elapsed_ms = (time.time() - start_time) * 1000
        logger.debug(f"Gemini API call completed in {elapsed_ms:.2f}ms")
        
        # 5. Save Assistant Response
        assistant_message_id = str(uuid.uuid4())
        assistant_message_payload = {"role": "assistant", "content": assistant_response}
        await client.table('messages').insert({
            "message_id": assistant_message_id,
            "thread_id": thread_id,
            "type": "assistant",
            "is_llm_message": True,
            "content": assistant_message_payload,
            "created_at": datetime.now(timezone.utc).isoformat()
        }).execute()
        
        logger.debug(f"Saved assistant message: {assistant_message_id}")
        
        # 6. Return response with thread_id for redirect
        return SimpleChatResponse(
            thread_id=thread_id,
            project_id=project_id,
            response=assistant_response,
            time_ms=elapsed_ms
        )
        
    except Exception as e:
        logger.error(f"Simple chat error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/simple/continue", response_model=SimpleChatResponse, summary="Continue Simple Chat", operation_id="continue_simple_chat")
async def continue_simple_chat(
    thread_id: str = Form(...),
    message: str = Form(...),
    user_id: str = Depends(verify_and_get_user_id_from_jwt)
):
    """
    Continue a simple chat conversation by adding a new message and getting a response
    """
    start_time = time.time()
    
    try:
        client = await utils.db.client
        
        # Verify thread exists and user has access
        thread_result = await client.table('threads').select('*').eq('thread_id', thread_id).execute()
        if not thread_result.data:
            raise HTTPException(status_code=404, detail="Thread not found")
        
        thread_data = thread_result.data[0]
        if thread_data.get('account_id') != user_id:
            raise HTTPException(status_code=403, detail="Access denied")
        
        # Check if this is a simple chat thread
        metadata = thread_data.get('metadata', {})
        if metadata.get('chat_mode') != 'simple':
            raise HTTPException(status_code=400, detail="This endpoint is only for simple chat threads")
        
        logger.debug(f"Continuing simple chat for thread {thread_id} with message: {message[:50]}...")
        
        # Save user message
        user_message_id = str(uuid.uuid4())
        user_message_payload = {"role": "user", "content": message}
        await client.table('messages').insert({
            "message_id": user_message_id,
            "thread_id": thread_id,
            "type": "user",
            "is_llm_message": True,
            "content": user_message_payload,
            "created_at": datetime.now(timezone.utc).isoformat()
        }).execute()
        
        # Call Gemini API
        model = genai.GenerativeModel("gemini-2.5-flash")
        response = model.generate_content(message)
        assistant_response = response.text
        
        elapsed_ms = (time.time() - start_time) * 1000
        logger.debug(f"Gemini API call completed in {elapsed_ms:.2f}ms")
        
        # Save assistant response
        assistant_message_id = str(uuid.uuid4())
        assistant_message_payload = {"role": "assistant", "content": assistant_response}
        await client.table('messages').insert({
            "message_id": assistant_message_id,
            "thread_id": thread_id,
            "type": "assistant",
            "is_llm_message": True,
            "content": assistant_message_payload,
            "created_at": datetime.now(timezone.utc).isoformat()
        }).execute()
        
        return SimpleChatResponse(
            thread_id=thread_id,
            project_id=thread_data.get('project_id'),
            response=assistant_response,
            time_ms=elapsed_ms
        )
        
    except Exception as e:
        logger.error(f"Continue simple chat error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/simple/stream")
async def simple_chat_streaming(
    message: str = Form(...),
    user_id: str = Depends(verify_and_get_user_id_from_jwt)
):
    """
    Streaming simple chat endpoint that creates project/thread and streams response
    """
    async def generate_stream():
        try:
            client = await utils.db.client
            account_id = user_id
            
            logger.debug(f"Streaming simple chat initiated for user {user_id} with message: {message[:50]}...")
            
            # 1. Create Project (for URL structure)
            project_id = str(uuid.uuid4())
            project = await client.table('projects').insert({
                "project_id": project_id,
                "account_id": account_id,
                "name": "Quick Chat",
                "created_at": datetime.now(timezone.utc).isoformat()
            }).execute()
            
            logger.debug(f"Created project: {project_id}")
            
            # 2. Create Thread (minimal)
            thread_id = str(uuid.uuid4())
            thread = await client.table('threads').insert({
                "thread_id": thread_id,
                "project_id": project_id,
                "account_id": account_id,
                "created_at": datetime.now(timezone.utc).isoformat(),
                "metadata": {"chat_mode": "simple"}  # Mark as simple chat mode
            }).execute()
            
            logger.debug(f"Created thread: {thread_id}")
            
            # 3. Send metadata immediately so the frontend can redirect without delay
            yield f"data: {json.dumps({'type': 'metadata', 'thread_id': thread_id, 'project_id': project_id})}\n\n"
            
            # 4. Persist user message asynchronously to avoid blocking the first model token
            user_message_id = str(uuid.uuid4())
            user_message_payload = {"role": "user", "content": message}
            user_message_task = asyncio.create_task(client.table('messages').insert({
                "message_id": user_message_id,
                "thread_id": thread_id,
                "type": "user",
                "is_llm_message": True,
                "content": user_message_payload,
                "created_at": datetime.now(timezone.utc).isoformat()
            }).execute())
            
            logger.debug(f"Saving user message asynchronously: {user_message_id}")
            
            # 5. Call Gemini API with streaming
            model = genai.GenerativeModel("gemini-2.5-flash")
            response = model.generate_content(message, stream=True)
            
            # 6. Stream response chunks
            full_response = ""
            for chunk in response:
                if chunk.text:
                    full_response += chunk.text
                    yield f"data: {json.dumps({'type': 'content', 'content': chunk.text})}\n\n"
            
            # Ensure the user message write has completed
            try:
                await user_message_task
                logger.debug(f"Saved user message: {user_message_id}")
            except Exception as insert_error:
                logger.error(f"Failed to persist user message {user_message_id}: {insert_error}")
            
            # 7. Save complete assistant response
            assistant_message_id = str(uuid.uuid4())
            assistant_message_payload = {"role": "assistant", "content": full_response}
            await client.table('messages').insert({
                "message_id": assistant_message_id,
                "thread_id": thread_id,
                "type": "assistant",
                "is_llm_message": True,
                "content": assistant_message_payload,
                "created_at": datetime.now(timezone.utc).isoformat()
            }).execute()
            
            logger.debug(f"Saved assistant message: {assistant_message_id}")
            
            # 8. Send completion signal
            yield f"data: {json.dumps({'type': 'done'})}\n\n"
            
        except Exception as e:
            logger.error(f"Streaming simple chat error: {e}")
            yield f"data: {json.dumps({'type': 'error', 'error': str(e)})}\n\n"
    
    return StreamingResponse(
        generate_stream(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no"
        },
    )

@router.post("/simple/continue/stream")
async def continue_simple_chat_streaming(
    thread_id: str = Form(...),
    message: str = Form(...),
    user_id: str = Depends(verify_and_get_user_id_from_jwt)
):
    """
    Streaming continue simple chat endpoint that adds a new message and streams response
    """
    async def generate_stream():
        try:
            client = await utils.db.client
            
            # Verify thread exists and user has access
            thread_result = await client.table('threads').select('*').eq('thread_id', thread_id).execute()
            if not thread_result.data:
                yield f"data: {json.dumps({'type': 'error', 'error': 'Thread not found'})}\n\n"
                return
            
            thread_data = thread_result.data[0]
            if thread_data.get('account_id') != user_id:
                yield f"data: {json.dumps({'type': 'error', 'error': 'Access denied'})}\n\n"
                return
            
            logger.debug(f"Streaming continue simple chat for thread {thread_id} with message: {message[:50]}...")
            
            # Build chat history from prior messages (before the new user message)
            history: List[Dict[str, Any]] = []
            existing_messages = await client.table('messages') \
                .select('content, type, metadata, created_at') \
                .eq('thread_id', thread_id) \
                .in_('type', ['user', 'assistant']) \
                .order('created_at', desc=False) \
                .execute()
            
            for record in existing_messages.data or []:
                history_entry = _record_to_history(record)
                if history_entry:
                    history.append(history_entry)
            
            # Persist the new user message without blocking streaming
            user_message_id = str(uuid.uuid4())
            user_message_payload = {"role": "user", "content": message}
            user_message_task = asyncio.create_task(client.table('messages').insert({
                "message_id": user_message_id,
                "thread_id": thread_id,
                "type": "user",
                "is_llm_message": True,
                "content": user_message_payload,
                "created_at": datetime.now(timezone.utc).isoformat()
            }).execute())
            
            logger.debug(f"Saving user message asynchronously: {user_message_id}")
            
            # Call Gemini API with true streaming
            model = genai.GenerativeModel("gemini-2.5-flash")
            chat = model.start_chat(history=history)
            response = chat.send_message(message, stream=True)
            full_response = ""
            
            for chunk in response:
                if chunk.text:
                    logger.debug(f"Streaming chunk: {len(chunk.text)} characters")
                    full_response += chunk.text
                    yield f"data: {json.dumps({'type': 'content', 'content': chunk.text})}\n\n"
            
            # Ensure the user message insert has completed
            try:
                await user_message_task
                logger.debug(f"Saved user message: {user_message_id}")
            except Exception as insert_error:
                logger.error(f"Failed to persist user message {user_message_id}: {insert_error}")
            
            # Save complete assistant response
            assistant_message_id = str(uuid.uuid4())
            assistant_message_payload = {"role": "assistant", "content": full_response}
            await client.table('messages').insert({
                "message_id": assistant_message_id,
                "thread_id": thread_id,
                "type": "assistant",
                "is_llm_message": True,
                "content": assistant_message_payload,
                "created_at": datetime.now(timezone.utc).isoformat()
            }).execute()
            
            logger.debug(f"Saved assistant message: {assistant_message_id}")
            
            # Send completion signal
            yield f"data: {json.dumps({'type': 'done'})}\n\n"
            
        except Exception as e:
            logger.error(f"Streaming continue simple chat error: {e}")
            yield f"data: {json.dumps({'type': 'error', 'error': str(e)})}\n\n"
    
    return StreamingResponse(
        generate_stream(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no"
        },
    )

@router.get("/simple/health")
async def simple_chat_health():
    """Health check for simple chat"""
    return {
        "status": "ok",
        "model": "gemini-2.5-flash",
        "api_key_configured": bool(config.GEMINI_API_KEY)
    }
