# Adaptive Input Feature

## Overview

The Adaptive Input feature allows users to send additional prompts and instructions to a running agent dynamically. The agent will process these inputs in its next iteration, enabling real-time collaboration and guidance during agent execution.

## How It Works

### Architecture

1. **Message Storage**: Adaptive input messages are stored as regular user messages in the `messages` table with special metadata marking them as adaptive input.

2. **Redis Pub/Sub Notification**: When adaptive input is sent, a notification is published to a Redis channel specific to the agent run (`agent_run:{agent_run_id}:adaptive_input`).

3. **Agent Detection**: The running agent checks for new messages at the beginning of each iteration by counting messages in the thread. When new messages are detected, they are automatically incorporated into the next LLM call.

4. **Seamless Integration**: The agent's `ThreadManager.get_llm_messages()` automatically fetches all messages including the new adaptive inputs, so they flow naturally into the conversation context.

### Components Modified

#### 1. `run_agent_background.py`
- Added subscription to `adaptive_input_channel` alongside control channels
- The channel listens for "new_input" signals (though the actual processing happens via message count detection)

#### 2. `core/run.py` - `AgentRunner.run()`
- Added `last_message_count` tracking before the iteration loop
- At the start of each iteration, checks for new messages by comparing current count to last count
- Logs when new adaptive input messages are detected
- New messages are automatically picked up by `thread_manager.get_llm_messages()` in the next iteration

#### 3. `core/agent_runs.py`
- Added new API endpoint: `POST /agent-run/{agent_run_id}/adaptive-input`
- Validates that the agent run is still running
- Inserts the message into the database with metadata marking it as adaptive input
- Publishes a notification to the Redis channel (optional, mainly for future extensions)

## API Usage

### Endpoint

```
POST /agent-run/{agent_run_id}/adaptive-input
```

### Request Body

```json
{
  "message": "Your adaptive input message here"
}
```

### Response

```json
{
  "status": "success",
  "message_id": "uuid-of-created-message",
  "thread_id": "uuid-of-thread",
  "message": "Adaptive input sent successfully. The agent will process it in the next iteration."
}
```

### Error Responses

- **400 Bad Request**: If the agent run is not in "running" status
- **404 Not Found**: If the agent run doesn't exist
- **403 Forbidden**: If the user doesn't have access to the agent run
- **500 Internal Server Error**: If there's an error processing the request

## Example Usage

### Using cURL

```bash
# Start an agent run
curl -X POST "https://your-api.com/thread/{thread_id}/agent/start" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "model_name": "gemini/gemini-2.5-flash",
    "agent_id": null
  }'

# Get the agent_run_id from the response

# Send adaptive input while the agent is running
curl -X POST "https://your-api.com/agent-run/{agent_run_id}/adaptive-input" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "message": "Please also add error handling to the code"
  }'
```

### Using JavaScript/TypeScript

```typescript
// Start agent run
const startResponse = await fetch(`/thread/${threadId}/agent/start`, {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    model_name: 'gemini/gemini-2.5-flash'
  })
});

const { agent_run_id } = await startResponse.json();

// Stream agent responses
const stream = new EventSource(
  `/agent-run/${agent_run_id}/stream?token=${token}`
);

stream.onmessage = (event) => {
  const data = JSON.parse(event.data);
  console.log('Agent response:', data);
};

// Send adaptive input while streaming
setTimeout(async () => {
  const adaptiveResponse = await fetch(
    `/agent-run/${agent_run_id}/adaptive-input`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        message: 'Please also add tests for this functionality'
      })
    }
  );
  
  const result = await adaptiveResponse.json();
  console.log('Adaptive input sent:', result);
}, 5000); // Send after 5 seconds
```

### Using Python

```python
import requests
import json

# Start agent run
start_response = requests.post(
    f'https://your-api.com/thread/{thread_id}/agent/start',
    headers={
        'Authorization': f'Bearer {token}',
        'Content-Type': 'application/json'
    },
    json={
        'model_name': 'gemini/gemini-2.5-flash'
    }
)

agent_run_id = start_response.json()['agent_run_id']

# Send adaptive input
adaptive_response = requests.post(
    f'https://your-api.com/agent-run/{agent_run_id}/adaptive-input',
    headers={
        'Authorization': f'Bearer {token}',
        'Content-Type': 'application/json'
    },
    json={
        'message': 'Please add detailed comments to the code'
    }
)

print(adaptive_response.json())
```

## Use Cases

### 1. Real-time Guidance
While an agent is executing a complex task, provide additional context or corrections:
```
Agent: "I'm creating the database schema..."
User: [via adaptive input] "Also add an index on the email column for faster lookups"
Agent: "Adding index on email column as requested..."
```

### 2. Course Correction
Redirect the agent's focus during execution:
```
Agent: "Working on feature A..."
User: [via adaptive input] "Actually, prioritize feature B first - it's more urgent"
Agent: "Understood, switching to feature B..."
```

### 3. Additional Requirements
Add requirements discovered during execution:
```
Agent: "Building the API endpoint..."
User: [via adaptive input] "Make sure to add rate limiting to this endpoint"
Agent: "Adding rate limiting implementation..."
```

### 4. Clarification
Provide clarification when the agent seems uncertain:
```
Agent: "Should I use REST or GraphQL for this API?"
User: [via adaptive input] "Use REST - we need to maintain consistency with existing services"
Agent: "Proceeding with REST API implementation..."
```

## Message Metadata

Adaptive input messages are stored with special metadata:

```json
{
  "message_id": "uuid",
  "thread_id": "uuid",
  "type": "user",
  "is_llm_message": true,
  "content": {
    "role": "user",
    "content": "The adaptive input text"
  },
  "metadata": {
    "adaptive_input": true,
    "agent_run_id": "uuid-of-agent-run"
  },
  "created_at": "timestamp"
}
```

This metadata allows you to:
- Identify which messages were adaptive inputs vs. initial prompts
- Track which agent run the adaptive input was sent to
- Filter or analyze adaptive input patterns

## Technical Details

### Message Detection
The agent detects new messages by:
1. Storing the initial message count before the iteration loop
2. At each iteration start, querying the current message count
3. If `current_count > last_count`, logging the detection of new adaptive input
4. The `ThreadManager.get_llm_messages()` automatically includes all new messages

### Performance
- Message count queries are lightweight (only fetching `message_id` field)
- Detection happens at iteration boundaries, not during LLM processing
- No performance impact on individual LLM calls

### Thread Safety
- Messages are inserted atomically into the database
- The agent will eventually see all messages in the correct order
- Redis pub/sub is used for optional notification but not required for functionality

## Limitations

1. **Iteration Boundary**: Adaptive input is processed at iteration boundaries, not mid-iteration. If the agent is in the middle of a long-running LLM call, the input won't be seen until the next iteration.

2. **Agent Must Be Running**: You can only send adaptive input to agents with status "running". Completed, failed, or stopped agents cannot receive adaptive input.

3. **Order Preservation**: Multiple adaptive inputs sent rapidly will be processed in the order they were inserted into the database.

4. **Context Window**: All messages (including adaptive inputs) count toward the model's context window. Very long conversations may need context summarization.

## Future Enhancements

Potential improvements to consider:

1. **Priority Messages**: Allow marking certain adaptive inputs as high-priority to interrupt current execution
2. **Input Queue UI**: Show pending adaptive inputs in the UI
3. **Input Acknowledgment**: Provide explicit acknowledgment when adaptive input is processed
4. **Batch Inputs**: Allow sending multiple adaptive inputs at once
5. **Input History**: UI to view all adaptive inputs sent during an agent run
6. **Interrupt Points**: Allow agents to define specific points where they check for adaptive input more frequently

## Testing

To test the adaptive input feature:

1. Start an agent run for a task that takes several iterations (e.g., building a multi-file project)
2. Monitor the agent's progress through the stream endpoint
3. Send adaptive input via the API endpoint
4. Observe that the agent incorporates your input in its next iteration
5. Check the logs for the detection message: "🔄 Detected X new adaptive input message(s)"

## Troubleshooting

### Adaptive input not being processed
- Verify the agent run is still in "running" status
- Check that the message was successfully inserted into the database
- Look for the detection log message in the agent logs
- Ensure the agent is actively iterating (not stuck or waiting)

### "Cannot send adaptive input" error
- The agent run may have already completed or failed
- Verify you have the correct `agent_run_id`
- Check your authentication token

### Message appears but agent doesn't respond to it
- The agent may have already decided to stop before seeing the message
- Check if the agent reached max iterations
- Verify the message is properly formatted as a user message
- Look at the agent's context window - it may be full

## Security Considerations

- Adaptive input respects the same authentication and authorization as other API endpoints
- Only users with access to the thread can send adaptive input to its agent runs
- Messages are validated before insertion to prevent injection attacks
- Rate limiting applies to adaptive input endpoints

## Conclusion

The Adaptive Input feature enables dynamic, real-time interaction with running agents, making agent execution more collaborative and flexible. It seamlessly integrates with the existing message system while providing powerful new capabilities for guiding agent behavior during execution.
