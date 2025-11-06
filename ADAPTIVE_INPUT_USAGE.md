# Adaptive Input Feature - Usage Guide

## Overview

The adaptive input feature allows you to send additional prompts to a running agent. This enables real-time interaction and dynamic guidance while the agent is executing.

## How It Works

1. **Start an agent run** using the existing `/api/thread/{thread_id}/agent/start` endpoint
2. **Send adaptive inputs** while the agent is running using the new endpoint
3. **The agent processes** the input at the start of its next iteration
4. **Execution continues** with the new context incorporated

## API Endpoint

### Send Adaptive Input

```http
POST /api/agent-run/{agent_run_id}/adaptive-input
```

**Headers:**
- `Authorization: Bearer <your-jwt-token>`
- `Content-Type: application/json`

**Request Body:**
```json
{
  "prompt": "Your additional instruction or question here"
}
```

**Response (Success - 200):**
```json
{
  "status": "queued",
  "message": "Your input has been sent to the running agent",
  "agent_run_id": "uuid-of-agent-run",
  "thread_id": "uuid-of-thread"
}
```

**Response (Error - 400):**
```json
{
  "detail": "Cannot send input to agent run with status 'completed'. Agent must be running."
}
```

## Usage Example

### Python Example

```python
import requests

# 1. Start an agent run
start_response = requests.post(
    "https://api.iris.so/api/thread/{thread_id}/agent/start",
    headers={"Authorization": f"Bearer {jwt_token}"},
    json={"model_name": "gemini/gemini-2.5-flash"}
)
agent_run_id = start_response.json()["agent_run_id"]

# 2. Wait for agent to start processing...
import time
time.sleep(2)

# 3. Send adaptive input while agent is running
adaptive_input = requests.post(
    f"https://api.iris.so/api/agent-run/{agent_run_id}/adaptive-input",
    headers={"Authorization": f"Bearer {jwt_token}"},
    json={"prompt": "Please also include error handling in your implementation"}
)

print(adaptive_input.json())
```

### JavaScript Example

```javascript
// 1. Start an agent run
const startResponse = await fetch(`/api/thread/${threadId}/agent/start`, {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${jwtToken}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({ model_name: 'gemini/gemini-2.5-flash' })
});
const { agent_run_id } = await startResponse.json();

// 2. Wait for agent to start processing...
await new Promise(resolve => setTimeout(resolve, 2000));

// 3. Send adaptive input while agent is running
const adaptiveInput = await fetch(`/api/agent-run/${agent_run_id}/adaptive-input`, {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${jwtToken}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    prompt: 'Please also include error handling in your implementation'
  })
});

console.log(await adaptiveInput.json());
```

## Use Cases

### 1. Course Correction
Send additional guidance when you see the agent going off track:
```json
{
  "prompt": "Focus on the security aspects first, performance optimization can come later"
}
```

### 2. Additional Requirements
Add requirements that weren't in the original prompt:
```json
{
  "prompt": "Also add unit tests for all the functions you create"
}
```

### 3. Clarification
Provide clarification based on what the agent has done:
```json
{
  "prompt": "The API endpoint should use POST method, not GET"
}
```

### 4. Resource Provision
Provide additional resources or information:
```json
{
  "prompt": "Here's the API documentation you need: https://example.com/api-docs"
}
```

## How Adaptive Inputs Are Processed

1. **Queueing**: Inputs are stored in Redis with a 24-hour TTL
2. **Checking**: Agent checks for new inputs at the start of each iteration
3. **Integration**: New inputs are added as user messages to the thread
4. **Continuation**: Agent processes the new input in its next iteration
5. **Streaming**: You'll see a status message indicating the input was received

## Stream Response

When monitoring the agent stream, you'll see this status when an adaptive input is processed:

```json
{
  "type": "status",
  "status": "adaptive_input_received",
  "message": "Processing new user input..."
}
```

## Limitations

- Agent must be in "running" status to accept adaptive inputs
- Inputs are processed at iteration boundaries (not mid-execution)
- Multiple inputs sent rapidly will be queued and processed sequentially
- Inputs persist for 24 hours in Redis before expiring

## Error Handling

### Agent Not Running
If you try to send input to a stopped/completed agent:
```json
{
  "detail": "Cannot send input to agent run with status 'completed'. Agent must be running."
}
```

### Invalid Agent Run ID
```json
{
  "detail": "Agent run not found"
}
```

### Access Denied
```json
{
  "detail": "You don't have access to this agent run"
}
```

## Implementation Details

### Backend Components Modified

1. **`core/agent_runs.py`**: Added `/adaptive-input` endpoint
2. **`core/run.py`**: Modified agent run loop to check for adaptive inputs
3. **`run_agent_background.py`**: Passes agent_run_id through execution chain

### Redis Keys Used

- **Queue**: `agent_run:{agent_run_id}:adaptive_inputs` (List)
- **Channel**: `agent_run:{agent_run_id}:adaptive_input` (Pub/Sub - reserved for future use)

## Future Enhancements

Potential improvements for future iterations:
- Real-time interrupt capability (pause current tool execution)
- Priority inputs (process immediately vs. next iteration)
- Input history and replay
- Batch input support
- WebSocket notifications when input is processed
