import json
import traceback
import uuid
from datetime import datetime, timezone
from typing import Optional
from fastapi import APIRouter, HTTPException, Depends, Form, Query
from fastapi.responses import StreamingResponse

from core.utils.auth_utils import verify_and_get_user_id_from_jwt, verify_and_authorize_thread_access, require_thread_access, AuthorizedThreadAccess
from core.utils.logger import logger
from core.sandbox.sandbox import create_sandbox, delete_sandbox

from .api_models import CreateThreadResponse, MessageCreateRequest
from . import core_utils as utils
from core.services.llm import make_llm_api_call, LLMError

router = APIRouter(tags=["threads"])

@router.get("/threads", summary="List User Threads", operation_id="list_user_threads")
async def get_user_threads(
    user_id: str = Depends(verify_and_get_user_id_from_jwt),
    page: Optional[int] = Query(1, ge=1, description="Page number (1-based)"),
    limit: Optional[int] = Query(1000, ge=1, le=1000, description="Number of items per page (max 1000)")
):
    """Get all threads for the current user with associated project data."""
    logger.debug(f"Fetching threads with project data for user: {user_id} (page={page}, limit={limit})")
    client = await utils.db.client
    try:
        offset = (page - 1) * limit
        
        # First, get threads for the user
        threads_result = await client.table('threads').select('*').eq('account_id', user_id).order('created_at', desc=True).execute()
        
        if not threads_result.data:
            logger.debug(f"No threads found for user: {user_id}")
            return {
                "threads": [],
                "pagination": {
                    "page": page,
                    "limit": limit,
                    "total": 0,
                    "pages": 0
                }
            }
        
        total_count = len(threads_result.data)
        
        # Apply pagination to threads
        paginated_threads = threads_result.data[offset:offset + limit]
        
        # Extract unique project IDs from threads that have them
        project_ids = [
            thread['project_id'] for thread in paginated_threads 
            if thread.get('project_id')
        ]
        unique_project_ids = list(set(project_ids)) if project_ids else []
        
        # Fetch projects if we have project IDs
        projects_by_id = {}
        if unique_project_ids:
            from core.utils.query_utils import batch_query_in
            
            projects_data = await batch_query_in(
                client=client,
                table_name='projects',
                select_fields='*',
                in_field='project_id',
                in_values=unique_project_ids
            )
            
            logger.debug(f"[API] Retrieved {len(projects_data)} projects")
            # Create a lookup map of projects by ID
            projects_by_id = {
                project['project_id']: project 
                for project in projects_data
            }
        
        # Map threads with their associated projects
        mapped_threads = []
        for thread in paginated_threads:
            project_data = None
            if thread.get('project_id') and thread['project_id'] in projects_by_id:
                project = projects_by_id[thread['project_id']]
                project_data = {
                    "project_id": project['project_id'],
                    "name": project.get('name', ''),
                    "description": project.get('description', ''),
                    "sandbox": project.get('sandbox', {}),
                    "is_public": project.get('is_public', False),
                    "created_at": project['created_at'],
                    "updated_at": project['updated_at']
                }
            
            mapped_thread = {
                "thread_id": thread['thread_id'],
                "project_id": thread.get('project_id'),
                "metadata": thread.get('metadata', {}),
                "is_public": thread.get('is_public', False),
                "created_at": thread['created_at'],
                "updated_at": thread['updated_at'],
                "project": project_data
            }
            mapped_threads.append(mapped_thread)
        
        total_pages = (total_count + limit - 1) // limit if total_count else 0
        
        logger.debug(f"[API] Mapped threads for frontend: {len(mapped_threads)} threads, {len(projects_by_id)} unique projects")
        
        return {
            "threads": mapped_threads,
            "pagination": {
                "page": page,
                "limit": limit,
                "total": total_count,
                "pages": total_pages
            }
        }
        
    except Exception as e:
        logger.error(f"Error fetching threads for user {user_id}: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to fetch threads: {str(e)}")

@router.get("/threads/{thread_id}", summary="Get Thread", operation_id="get_thread")
async def get_thread(
    thread_id: str,
    auth: AuthorizedThreadAccess = Depends(require_thread_access)
):
    """Get a specific thread by ID with complete related data."""
    logger.debug(f"Fetching thread: {thread_id}")
    client = await utils.db.client
    user_id = auth.user_id  # Already authenticated and authorized!
    
    try:
        # No need for manual authorization - it's already done in the dependency!
        
        # Get the thread data
        thread_result = await client.table('threads').select('*').eq('thread_id', thread_id).execute()
        
        if not thread_result.data:
            raise HTTPException(status_code=404, detail="Thread not found")
        
        thread = thread_result.data[0]
        
        # Get associated project if thread has a project_id
        project_data = None
        if thread.get('project_id'):
            project_result = await client.table('projects').select('*').eq('project_id', thread['project_id']).execute()
            
            if project_result.data:
                project = project_result.data[0]
                logger.debug(f"[API] Raw project from DB for thread {thread_id}")
                project_data = {
                    "project_id": project['project_id'],
                    "name": project.get('name', ''),
                    "description": project.get('description', ''),
                    "sandbox": project.get('sandbox', {}),
                    "is_public": project.get('is_public', False),
                    "created_at": project['created_at'],
                    "updated_at": project['updated_at']
                }
        
        # Get message count for the thread
        message_count_result = await client.table('messages').select('message_id', count='exact').eq('thread_id', thread_id).execute()
        message_count = message_count_result.count if message_count_result.count is not None else 0
        
        # Get recent agent runs for the thread
        agent_runs_result = await client.table('agent_runs').select('*').eq('thread_id', thread_id).order('created_at', desc=True).execute()
        agent_runs_data = []
        if agent_runs_result.data:
            agent_runs_data = [{
                "id": run['id'],
                "status": run.get('status', ''),
                "started_at": run.get('started_at'),
                "completed_at": run.get('completed_at'),
                "error": run.get('error'),
                "agent_id": run.get('agent_id'),
                "agent_version_id": run.get('agent_version_id'),
                "created_at": run['created_at']
            } for run in agent_runs_result.data]
        
        # Map thread data for frontend (matching actual DB structure)
        mapped_thread = {
            "thread_id": thread['thread_id'],
            "project_id": thread.get('project_id'),
            "metadata": thread.get('metadata', {}),
            "is_public": thread.get('is_public', False),
            "created_at": thread['created_at'],
            "updated_at": thread['updated_at'],
            "project": project_data,
            "message_count": message_count,
            "recent_agent_runs": agent_runs_data
        }
        
        logger.debug(f"[API] Mapped thread for frontend: {thread_id} with {message_count} messages and {len(agent_runs_data)} recent runs")
        return mapped_thread
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching thread {thread_id}: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to fetch thread: {str(e)}")

@router.post("/threads", response_model=CreateThreadResponse, summary="Create Thread", operation_id="create_thread")
async def create_thread(
    name: Optional[str] = Form(None),
    user_id: str = Depends(verify_and_get_user_id_from_jwt)
):
    """
    Create a new thread without starting an agent run.

    [WARNING] Keep in sync with initiate endpoint.
    """
    if not name:
        name = "New Project"
    logger.debug(f"Creating new thread with name: {name}")
    client = await utils.db.client
    account_id = user_id  # In Basejump, personal account_id is the same as user_id
    
    try:
        # 1. Create Project
        project_name = name or "New Project"
        project = await client.table('projects').insert({
            "project_id": str(uuid.uuid4()), 
            "account_id": account_id, 
            "name": project_name,
            "created_at": datetime.now(timezone.utc).isoformat()
        }).execute()
        project_id = project.data[0]['project_id']
        logger.debug(f"Created new project: {project_id}")

        # 2. Create Sandbox
        sandbox_id = None
        try:
            sandbox_pass = str(uuid.uuid4())
            sandbox = await create_sandbox(sandbox_pass, project_id)
            sandbox_id = sandbox.id
            logger.debug(f"Created new sandbox {sandbox_id} for project {project_id}")
            
            # Get preview links
            vnc_link = await sandbox.get_preview_link(6080)
            website_link = await sandbox.get_preview_link(8080)
            vnc_url = vnc_link.url if hasattr(vnc_link, 'url') else str(vnc_link).split("url='")[1].split("'")[0]
            website_url = website_link.url if hasattr(website_link, 'url') else str(website_link).split("url='")[1].split("'")[0]
            token = None
            if hasattr(vnc_link, 'token'):
                token = vnc_link.token
            elif "token='" in str(vnc_link):
                token = str(vnc_link).split("token='")[1].split("'")[0]
        except Exception as e:
            logger.error(f"Error creating sandbox: {str(e)}")
            await client.table('projects').delete().eq('project_id', project_id).execute()
            if sandbox_id:
                try: 
                    await delete_sandbox(sandbox_id)
                except Exception as e: 
                    logger.error(f"Error deleting sandbox: {str(e)}")
            raise Exception("Failed to create sandbox")

        # Update project with sandbox info
        update_result = await client.table('projects').update({
            'sandbox': {
                'id': sandbox_id, 
                'pass': sandbox_pass, 
                'vnc_preview': vnc_url,
                'sandbox_url': website_url, 
                'token': token
            }
        }).eq('project_id', project_id).execute()

        if not update_result.data:
            logger.error(f"Failed to update project {project_id} with new sandbox {sandbox_id}")
            if sandbox_id:
                try: 
                    await delete_sandbox(sandbox_id)
                except Exception as e: 
                    logger.error(f"Error deleting sandbox: {str(e)}")
            raise Exception("Database update failed")

        # 3. Create Thread
        thread_data = {
            "thread_id": str(uuid.uuid4()), 
            "project_id": project_id, 
            "account_id": account_id,
            "created_at": datetime.now(timezone.utc).isoformat()
        }

        from core.utils.logger import structlog
        structlog.contextvars.bind_contextvars(
            thread_id=thread_data["thread_id"],
            project_id=project_id,
            account_id=account_id,
        )
        
        thread = await client.table('threads').insert(thread_data).execute()
        thread_id = thread.data[0]['thread_id']
        logger.debug(f"Created new thread: {thread_id}")

        logger.debug(f"Successfully created thread {thread_id} with project {project_id}")
        return {"thread_id": thread_id, "project_id": project_id}

    except Exception as e:
        logger.error(f"Error creating thread: {str(e)}\n{traceback.format_exc()}")
        # TODO: Clean up created project/thread if creation fails mid-way
        raise HTTPException(status_code=500, detail=f"Failed to create thread: {str(e)}")

@router.get("/threads/{thread_id}/messages", summary="Get Thread Messages", operation_id="get_thread_messages")
async def get_thread_messages(
    thread_id: str,
    user_id: str = Depends(verify_and_get_user_id_from_jwt),
    order: str = Query("desc", description="Order by created_at: 'asc' or 'desc'")
):
    """Get all messages for a thread, fetching in batches of 1000 from the DB to avoid large queries."""
    logger.debug(f"Fetching all messages for thread: {thread_id}, order={order}")
    client = await utils.db.client
    await verify_and_authorize_thread_access(client, thread_id, user_id)
    try:
        batch_size = 1000
        offset = 0
        all_messages = []
        while True:
            query = client.table('messages').select('*').eq('thread_id', thread_id)
            query = query.order('created_at', desc=(order == "desc"))
            query = query.range(offset, offset + batch_size - 1)
            messages_result = await query.execute()
            batch = messages_result.data or []
            all_messages.extend(batch)
            logger.debug(f"Fetched batch of {len(batch)} messages (offset {offset})")
            if len(batch) < batch_size:
                break
            offset += batch_size
        return {"messages": all_messages}
    except Exception as e:
        logger.error(f"Error fetching messages for thread {thread_id}: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to fetch messages: {str(e)}")

@router.post("/threads/{thread_id}/messages/add", summary="Add Message to Thread", operation_id="add_message_to_thread")
async def add_message_to_thread(
    thread_id: str,
    message: str,
    user_id: str = Depends(verify_and_get_user_id_from_jwt),
):
    """Add a message to a thread"""
    logger.debug(f"Adding message to thread: {thread_id}")
    client = await utils.db.client
    await verify_and_authorize_thread_access(client, thread_id, user_id)
    try:
        message_result = await client.table('messages').insert({
            'thread_id': thread_id,
            'type': 'user',
            'is_llm_message': True,
            'content': {
              "role": "user",
              "content": message
            }
        }).execute()
        return message_result.data[0]
    except Exception as e:
        logger.error(f"Error adding message to thread {thread_id}: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to add message: {str(e)}")

@router.post("/threads/{thread_id}/messages", summary="Create Thread Message", operation_id="create_thread_message")
async def create_message(
    thread_id: str,
    message_data: MessageCreateRequest,
    user_id: str = Depends(verify_and_get_user_id_from_jwt)
):
    """Create a new message in a thread."""
    logger.debug(f"Creating message in thread: {thread_id}")
    client = await utils.db.client
    
    try:
        await verify_and_authorize_thread_access(client, thread_id, user_id)
        
        message_payload = {
            "role": "user" if message_data.type == "user" else "assistant",
            "content": message_data.content
        }
        
        insert_data = {
            "message_id": str(uuid.uuid4()),
            "thread_id": thread_id,
            "type": message_data.type,
            "is_llm_message": message_data.is_llm_message,
            "content": message_payload,  # Store as JSONB object, not JSON string
            "created_at": datetime.now(timezone.utc).isoformat()
        }
        
        message_result = await client.table('messages').insert(insert_data).execute()
        
        if not message_result.data:
            raise HTTPException(status_code=500, detail="Failed to create message")
        
        logger.debug(f"Created message: {message_result.data[0]['message_id']}")
        return message_result.data[0]
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error creating message in thread {thread_id}: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to create message: {str(e)}")

@router.delete("/threads/{thread_id}/messages/{message_id}", summary="Delete Thread Message", operation_id="delete_thread_message")
async def delete_message(
    thread_id: str,
    message_id: str,
    user_id: str = Depends(verify_and_get_user_id_from_jwt)
):
    """Delete a message from a thread."""
    logger.debug(f"Deleting message from thread: {thread_id}")
    client = await utils.db.client
    await verify_and_authorize_thread_access(client, thread_id, user_id)
    try:
        # Don't allow users to delete the "status" messages
        await client.table('messages').delete().eq('message_id', message_id).eq('is_llm_message', True).eq('thread_id', thread_id).execute()
        return {"message": "Message deleted successfully"}
    except Exception as e:
        logger.error(f"Error deleting message {message_id} from thread {thread_id}: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to delete message: {str(e)}")

@router.post("/threads/generate-title", summary="Generate Project Title", operation_id="generate_project_title")
async def generate_project_title(
    project_id: str = Form(...),
    prompt: str = Form(...),
    user_id: str = Depends(verify_and_get_user_id_from_jwt)
):
    """Generate a project title in the background after LLM response is complete."""
    logger.debug(f"Generating title for project: {project_id}")
    client = await utils.db.client
    
    try:
        # Verify user has access to the project
        project_result = await client.table('projects').select('project_id, account_id').eq('project_id', project_id).execute()
        
        if not project_result.data:
            raise HTTPException(status_code=404, detail="Project not found")
        
        project = project_result.data[0]
        if project['account_id'] != user_id:
            raise HTTPException(status_code=403, detail="Access denied")
        
        from core.utils.project_helpers import generate_and_update_project_name, TitleGenerationError
        try:
            result = await generate_and_update_project_name(project_id=project_id, prompt=prompt)
        except TitleGenerationError as e:
            logger.error(f"Title generation failed for project {project_id}: {str(e)}")
            raise HTTPException(status_code=500, detail=f"Failed to generate title: {str(e)}") from e
        
        return {
            "message": "Title generated successfully",
            "title": result["title"],
            "icon": result["icon"],
        }
        
    except Exception as e:
        logger.error(f"Error generating title for project {project_id}: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to generate title: {str(e)}")


@router.post("/threads/{thread_id}/summarize/stream", summary="Stream Chat Summary (Gemini 2.5 Flash)", operation_id="stream_thread_summary")
async def stream_thread_summary(
    thread_id: str,
    user_id: str = Depends(verify_and_get_user_id_from_jwt)
):
    """Stream a first-person retrospective summary of the specified thread using Gemini 2.5 Flash.

    Uses Iris Summarizer to generate a cohesive 4-6 line summary covering the entire
    conversation flow, including objectives, actions, deliverables, and generated documents.
    """
    client = await utils.db.client

    # Verify access
    await verify_and_authorize_thread_access(client, thread_id, user_id)

    async def event_stream():
        try:
            # Fetch conversation messages ordered oldest -> newest
            messages_result = await client.table('messages') \
                .select('content, type, created_at') \
                .eq('thread_id', thread_id) \
                .in_('type', ['user', 'assistant']) \
                .order('created_at', desc=False) \
                .execute()

            def _extract_text(payload) -> str:
                try:
                    if isinstance(payload, dict):
                        # Common shapes: {role, content} or may contain nested parts
                        content = payload.get('content')
                        if isinstance(content, str):
                            return content
                        # Fallback: try common nesting keys
                        for key in ("text", "value"):
                            if isinstance(payload.get(key), str):
                                return payload.get(key) or ""
                    elif isinstance(payload, str):
                        return payload
                except Exception:
                    return ""
                return ""

            chat_transcript_parts = []
            for row in (messages_result.data or []):
                raw = row.get('content')
                role = 'user' if row.get('type') == 'user' else 'assistant'
                text = ""
                if isinstance(raw, dict):
                    text = _extract_text(raw)
                else:
                    # Stored as JSON string or plain string
                    try:
                        import json as _json
                        parsed = _json.loads(raw) if isinstance(raw, str) else {}
                        text = _extract_text(parsed)
                        if not text and isinstance(parsed, dict):
                            text = str(parsed.get('content') or "")
                    except Exception:
                        text = str(raw or "")
                text = (text or "").strip()
                if text:
                    chat_transcript_parts.append(f"[{role}] {text}")

            # Truncate transcript to avoid excessive context
            transcript = "\n".join(chat_transcript_parts)
            if len(transcript) > 20000:
                transcript = transcript[-20000:]

            system_prompt = (
                "You are Iris Summarizer — a reflection model that reviews a full conversation between the user and the AI to generate a single, cohesive summary describing what happened throughout the chat.\n\n"
                "# OBJECTIVE\n"
                "Summarize the entire conversation as a short first-person retrospective by the AI, covering:\n"
                "1. What the user initially requested or wanted to achieve.\n"
                "2. What actions or explorations happened through the conversation.\n"
                "3. What was created, analyzed, or generated.\n"
                "4. How the task or focus evolved (if it changed midway).\n"
                "5. The final outcome, conclusion, or deliverables.\n"
                "6. Any documents, files, or assets generated.\n\n"
                "# STYLE & FORMAT\n"
                "- Write in a **natural, first-person tone**, as if the AI is reporting what it did for the user.\n"
                "- Begin with phrasing like:\n"
                "  - \"You requested help with…\"\n"
                "  - \"I researched, designed, or created…\"\n"
                "  - \"Throughout the chat, we explored…\"\n"
                "  - \"In the end, I delivered…\"\n"
                "- Conclude with:  \n"
                "  `Documents generated: [list of filenames or outputs if available].`\n"
                "- Summarize the *entire flow* of the conversation — not just the initial prompt.\n"
                "- Keep it **concise, fluid, and human-readable**, using **4–6 lines**.\n\n"
                "# EXAMPLES\n\n"
                "✅ Example 1:\n"
                "You requested help designing a minimal logo inspired by an eye motif for Iris AI. I iterated through multiple concepts, refined symmetry, and adjusted colors for visual clarity. We finalized a 16:9 black-background version with inverted text and a sharp pupil design.  \n"
                "Documents generated: iris_logo_white.png, iris_logo_black_16x9.png.\n\n"
                "✅ Example 2:\n"
                "You asked to fix memory retention and caching issues in the Iris agent system. I analyzed your Python backend, restructured the system prompt persistence logic, and optimized cache refresh cycles. The conversation evolved into testing token throughput and concurrency scaling.  \n"
                "Documents generated: prompt_cache_optimizer.py, memory_retain_patch.md.\n\n"
                "# CONSTRAINTS\n"
                "- Output must be 4–6 lines, max ~700 characters.\n"
                "- Tone: professional, narrative, and reflective.\n"
                "- No markdown or bullet points.\n"
                "- Always mention the key results and final conclusion.\n"
                "- If no files were created, end with: \"No documents generated.\""
            )

            user_prompt = (
                "Review the following conversation transcript and provide a first-person retrospective summary as Iris Summarizer.\n\n"
                f"<transcript>\n{transcript}\n</transcript>"
            )

            llm_messages = [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt},
            ]

            # Make streaming call to Gemini 2.5 Flash
            try:
                llm_response = await make_llm_api_call(
                    messages=llm_messages,
                    model_name="gemini/gemini-2.5-flash",
                    temperature=0.2,
                    max_tokens=400,
                    stream=True,
                )
            except LLMError as e:
                yield f"data: {{\"type\": \"error\", \"error\": {json.dumps(str(e))} }}\n\n"
                return

            # Stream chunks as SSE content events
            async for chunk in llm_response:
                try:
                    # LiteLLM chunk variants handling
                    text_piece = None
                    if isinstance(chunk, dict):
                        choices = chunk.get("choices") or []
                        if choices:
                            delta = choices[0].get("delta") or {}
                            text_piece = delta.get("content") or delta.get("text")
                            if not text_piece:
                                message_obj = choices[0].get("message") or {}
                                text_piece = message_obj.get("content")
                        if not text_piece:
                            text_piece = chunk.get("content") or chunk.get("text")
                    if not text_piece and hasattr(chunk, 'choices'):
                        try:
                            first = getattr(chunk, 'choices')[0]
                            delta = getattr(first, 'delta', None)
                            if delta and hasattr(delta, 'content'):
                                text_piece = delta.content
                        except Exception:
                            pass
                    if text_piece:
                        yield f"data: {json.dumps({'type': 'content', 'content': text_piece})}\n\n"
                except Exception:
                    # If a single chunk fails to parse, skip it
                    continue

            # Completion signal
            yield f"data: {json.dumps({'type': 'done'})}\n\n"

        except Exception as e:
            logger.error(f"Summary streaming error for thread {thread_id}: {e}\n{traceback.format_exc()}")
            yield f"data: {json.dumps({'type': 'error', 'error': str(e)})}\n\n"

    import json  # local import to keep top clean
    return StreamingResponse(
        event_stream(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )


# Lightweight test endpoint to verify router path is reachable
@router.get("/threads/{thread_id}/summarize/test", summary="Test Summarize Route Reachability", operation_id="test_thread_summary_route")
async def test_thread_summary_route(thread_id: str, user_id: str = Depends(verify_and_get_user_id_from_jwt)):
    client = await utils.db.client
    await verify_and_authorize_thread_access(client, thread_id, user_id)
    return {"ok": True, "thread_id": thread_id}
