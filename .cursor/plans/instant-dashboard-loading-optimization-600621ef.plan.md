<!-- 600621ef-1a79-4947-b0a3-03ef8b53b15d beb2d5a3-3a05-474d-a116-8d032395a7d3 -->
# Instant Dashboard Loading Optimization Plan

## Goal

Reduce perceived latency from ~5-8 seconds to <500ms by optimizing the thread creation and loading flow, following the pattern of the fast simple_chat endpoint.

## Current Bottlenecks

1. Backend `/agent/initiate` does everything sequentially (agent load, billing check, project creation, sandbox creation, thread creation, file upload, message creation, agent run creation)
2. Frontend waits for full backend response, then fetches thread again, then redirects
3. Thread page waits for all 4 queries (thread, messages, project, agent runs) before showing UI
4. No early return - everything blocks until complete

## Optimization Strategy

### Phase 1: Backend Early Return (Highest Impact)

**File: `backend/core/agent_runs.py`**

1. **Return thread_id + project_id immediately after thread creation**

   - After line 836 (thread created), return immediately with `{"thread_id": thread_id, "project_id": project_id, "status": "initiating"}`
   - Move file upload, agent run creation, and message persistence to background task
   - Use `asyncio.create_task()` for non-blocking background work

2. **Parallelize independent operations**

   - Run agent loading and billing checks in parallel (lines 671-705)
   - Run project creation and limit checks in parallel (lines 720-748)
   - Only create sandbox if files are present (already done, but ensure it's truly lazy)

3. **Update response model**

   - **File: `backend/core/api_models/threads.py`**
   - Add `project_id: str` to `InitiateAgentResponse` model (line 13-16)
   - Add optional `status: Optional[str] = None` field

4. **Create background completion function**

   - New function `_complete_agent_initiation_background()` that:
     - Uploads files (if any)
     - Creates agent run
     - Persists user message
     - Handles errors gracefully with logging

### Phase 2: Frontend Optimistic Redirect (High Impact)

**File: `frontend/src/components/dashboard/dashboard-content.tsx`**

1. **Remove thread query wait**

   - Delete or modify useEffect at lines 172-183 that waits for `threadQuery.data`
   - Redirect immediately after getting `thread_id` and `project_id` from initiate response

2. **Update handleSubmit function (lines 186-286)**

   - After `initiateAgentMutation.mutateAsync()` succeeds:
     - Extract `thread_id` and `project_id` from result
     - Call `router.push()` immediately (don't wait for thread query)
     - Remove `setInitiatedThreadId()` and related state

3. **Pass optimistic data through router state**

   - Include minimal thread data in router.push state to avoid refetch
   - Format: `router.push(path, { state: { optimisticThread: {...} } })`

### Phase 3: Thread Page Optimization (Medium Impact)

**File: `frontend/src/app/(dashboard)/projects/[projectId]/thread/_hooks/useThreadData.ts`**

1. **Use router state for initial data**

   - Check `router.state?.optimisticThread` for initial data
   - Pass to queries as `initialData` option

2. **Progressive loading**

   - Show UI as soon as thread + messages are loaded (lines 145-149)
   - Don't wait for project or agent runs to show content
   - Load project and agent runs in parallel but non-blocking

3. **Optimize query dependencies**

   - Set `enabled: false` for project/agent runs queries initially
   - Enable them after thread loads, but don't block UI

### Phase 4: Backend Streaming Option (Optional, Highest Impact)

**File: `backend/core/agent_runs.py`**

1. **Add streaming endpoint variant**

   - New endpoint `/agent/initiate/stream` that streams SSE events
   - Send metadata event immediately (thread_id, project_id)
   - Stream agent response as it's generated
   - Similar to `simple_chat_streaming` (lines 270-314)

2. **Frontend streaming handler**

   - **File: `frontend/src/lib/api.ts`**
   - Add `initiateAgentStream()` function similar to `simpleChatStream`
   - Handle metadata event for immediate redirect
   - Stream content to thread page

**Note:** Phase 4 is optional but would provide ChatGPT-like instant experience. Can be implemented later.

## Implementation Details

### Backend Changes

**1. Modify `initiate_agent_with_files` function:**

```python
# After thread creation (line 836):
thread_id = thread.data[0]['thread_id']

# Return immediately
return {
    "thread_id": thread_id,
    "project_id": project_id,
    "agent_run_id": None,  # Will be set in background
    "status": "initiating"
}

# Start background task (non-blocking)
asyncio.create_task(_complete_agent_initiation_background(
    thread_id=thread_id,
    project_id=project_id,
    prompt=prompt,
    message_content=message_content,
    model_name=model_name,
    agent_config=agent_config,
    files=files,
    sandbox=sandbox,
    sandbox_id=sandbox_id,
    user_id=user_id
))
```

**2. Parallelize operations:**

```python
# Lines 671-705: Load agent and check billing in parallel
agent_task = asyncio.create_task(_load_agent_async(...))
billing_task = asyncio.create_task(billing_integration.check_model_and_billing_access(...))
agent_data, billing_result = await asyncio.gather(agent_task, billing_task)
```

**3. Background completion function:**

```python
async def _complete_agent_initiation_background(
    thread_id: str,
    project_id: str,
    prompt: str,
    message_content: str,
    model_name: str,
    agent_config: Optional[dict],
    files: List[UploadFile],
    sandbox: Optional[AsyncSandbox],
    sandbox_id: Optional[str],
    user_id: str
):
    """Complete agent initiation in background without blocking response."""
    try:
        client = await utils.db.client
        
        # Upload files if any (already handled if sandbox was created)
        # ... file upload logic ...
        
        # Add user message
        # ... message creation logic ...
        
        # Create agent run
        # ... agent run creation logic ...
        
        # Queue background agent execution
        # ... run_agent_background.send() ...
        
    except Exception as e:
        logger.error(f"Background agent initiation failed: {e}", exc_info=True)
        # Update thread/project status to indicate error
        # Don't raise - already returned to user
```

### Frontend Changes

**1. Update `handleSubmit` in dashboard-content.tsx:**

```typescript
const result = await initiateAgentMutation.mutateAsync(formData);

if (result.thread_id && result.project_id) {
  // Redirect immediately - don't wait for thread query
  router.push(`/projects/${result.project_id}/thread/${result.thread_id}`, {
    state: {
      optimisticThread: {
        thread_id: result.thread_id,
        project_id: result.project_id,
        // Minimal data to avoid refetch
      }
    }
  });
  
  chatInputRef.current?.clearPendingFiles();
  return;
}
```

**2. Remove thread query wait:**

```typescript
// DELETE this useEffect (lines 172-183):
// React.useEffect(() => {
//   if (threadQuery.data && initiatedThreadId) { ... }
// }, [threadQuery.data, initiatedThreadId, router]);
```

**3. Update useThreadData to use router state:**

```typescript
const router = useRouter();
const optimisticData = router.state?.optimisticThread;

const threadQuery = useThreadQuery(threadId, {
  initialData: optimisticData ? {
    thread_id: optimisticData.thread_id,
    project_id: optimisticData.project_id,
    // ... minimal fields
  } : undefined,
  staleTime: 0, // Still refetch for latest data
});
```

## Error Handling & Safety

1. **Backend error handling:**

   - Background task errors are logged but don't affect user response
   - If critical failure in background, update thread status in DB
   - Frontend can poll or use websocket to detect completion/errors

2. **Frontend fallback:**

   - If router state missing, fall back to normal query
   - If thread_id/project_id missing from response, show error
   - Maintain existing error handling for billing/limit errors

3. **Backward compatibility:**

   - Keep existing endpoint working (non-streaming)
   - Add streaming as optional enhancement
   - Ensure agent_run_id is eventually available (via polling or websocket)

## Testing Checklist

1. ✅ Execute mode: Create thread, verify immediate redirect
2. ✅ Chat mode: Verify existing simple chat still works
3. ✅ File upload: Verify files upload correctly in background
4. ✅ Agent run: Verify agent run starts after redirect
5. ✅ Error cases: Billing errors, limit errors still work
6. ✅ Thread page: Verify loads correctly with optimistic data
7. ✅ Background failures: Verify graceful degradation

## Performance Targets

- **Current:** 5-8 seconds perceived latency
- **Target:** <500ms perceived latency (time to redirect)
- **Backend response time:** <300ms (thread creation only)
- **Frontend redirect:** <200ms (immediate after response)

## Rollout Strategy

1. **Phase 1:** Backend early return (can deploy independently)
2. **Phase 2:** Frontend optimistic redirect (requires Phase 1)
3. **Phase 3:** Thread page optimization (can deploy independently)
4. **Phase 4:** Streaming endpoint (optional, can add later)

## Files to Modify

1. `backend/core/agent_runs.py` - Main optimization
2. `backend/core/api_models/threads.py` - Response model update
3. `frontend/src/components/dashboard/dashboard-content.tsx` - Optimistic redirect
4. `frontend/src/app/(dashboard)/projects/[projectId]/thread/_hooks/useThreadData.ts` - Progressive loading
5. `frontend/src/lib/api.ts` - Type updates for InitiateAgentResponse
6. `frontend/src/hooks/react-query/dashboard/use-initiate-agent.ts` - May need updates

## Risk Mitigation

1. **Background task failures:** Log extensively, add monitoring
2. **Race conditions:** Use database transactions where needed
3. **State consistency:** Ensure thread/project always in valid state
4. **User experience:** Show loading states appropriately, handle errors gracefully

### To-dos

- [ ] Modify backend /agent/initiate to return thread_id + project_id immediately after thread creation, move file upload and agent run creation to background task
- [ ] Parallelize agent loading and billing checks, project creation and limit checks in backend
- [ ] Update InitiateAgentResponse model to include project_id and optional status field
- [ ] Create _complete_agent_initiation_background function to handle file upload, message creation, and agent run creation asynchronously
- [ ] Update dashboard handleSubmit to redirect immediately after getting thread_id/project_id, remove thread query wait
- [ ] Pass optimistic thread data through router state to avoid refetch on thread page
- [ ] Update useThreadData to use router state for initial data and show UI as soon as thread+messages load (dont wait for project/agent runs)
- [ ] Update InitiateAgentResponse TypeScript interface to include project_id field
- [ ] Add comprehensive error handling for background tasks and fallback mechanisms
- [ ] Test all scenarios: execute mode, chat mode, file uploads, error cases, background failures