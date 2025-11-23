/**
 * Fast Gemini Chat Client
 * Ultra-fast streaming chat with Gemini 2.5 Flash
 */

const API_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8000/api';

export interface FastGeminiChatRequest {
  message: string;
  model?: string;
  system_instructions?: string;
  chat_context?: Array<{ role: string; content: string }>;
}

export interface FastGeminiChatResponse {
  response: string;
  time_ms: number;
}

export type AdaptiveDecisionState = 'agent_needed' | 'agent_not_needed' | 'ask_user';

export interface AdaptiveAskUserPrompt {
  prompt: string;
  yes_label: string;
  no_label: string;
}

export interface AdaptiveDecision {
  state: AdaptiveDecisionState;
  confidence: number;
  reason: string;
  agent_preface?: string;
  ask_user?: AdaptiveAskUserPrompt;
  metadata?: Record<string, unknown>;
}

export interface AdaptiveChatResponse extends FastGeminiChatResponse {
  decision: AdaptiveDecision;
}

export interface FastGeminiStreamChunk {
  type: 'start' | 'chunk' | 'done' | 'error';
  content?: string;
  time?: number;
  time_ms?: number;
  error?: string;
}

export interface FastGeminiStreamCallbacks {
  onChunk?: (content: string) => void;
  onStart?: (time: number) => void;
  onDone?: (timeMs: number) => void;
  onError?: (error: string) => void;
}

/**
 * Non-streaming chat with Gemini 2.5 Flash
 */
export async function fastGeminiChat(
  message: string,
  model: string = 'gemini-2.5-flash',
  systemInstructions?: string,
  chatContext?: Array<{ role: string; content: string }>
): Promise<FastGeminiChatResponse> {
  const requestBody: FastGeminiChatRequest = { message, model };
  
  if (systemInstructions) {
    requestBody.system_instructions = systemInstructions;
  }
  
  if (chatContext && chatContext.length > 0) {
    requestBody.chat_context = chatContext;
  }

  const response = await fetch(`${API_URL}/chat/fast-gemini-chat`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(requestBody),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.detail || 'Failed to send message');
  }

  return response.json();
}

export async function adaptiveChat(
  message: string,
  model: string = 'gemini-2.5-flash',
  systemInstructions?: string,
  chatContext?: Array<{ role: string; content: string }>
): Promise<AdaptiveChatResponse> {
  const requestBody: FastGeminiChatRequest = { message, model };

  if (systemInstructions) {
    requestBody.system_instructions = systemInstructions;
  }

  if (chatContext && chatContext.length > 0) {
    requestBody.chat_context = chatContext;
  }

  const response = await fetch(`${API_URL}/chat/adaptive`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(requestBody),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.detail || 'Failed to send adaptive message');
  }

  return response.json();
}

/**
 * Streaming chat with Gemini 2.5 Flash
 */
export async function fastGeminiChatStream(
  message: string,
  callbacks: FastGeminiStreamCallbacks,
  model: string = 'gemini-2.5-flash',
  systemInstructions?: string,
  chatContext?: Array<{ role: string; content: string }>
): Promise<void> {
  const requestBody: FastGeminiChatRequest = { message, model };
  
  if (systemInstructions) {
    requestBody.system_instructions = systemInstructions;
  }
  
  if (chatContext && chatContext.length > 0) {
    requestBody.chat_context = chatContext;
  }

  const response = await fetch(`${API_URL}/chat/fast-gemini-chat/stream`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(requestBody),
  });

  if (!response.ok) {
    const error = await response.json();
    callbacks.onError?.(error.detail || 'Failed to stream message');
    return;
  }

  const reader = response.body?.getReader();
  if (!reader) {
    callbacks.onError?.('No response body');
    return;
  }

  const decoder = new TextDecoder();
  let buffer = '';

  try {
    while (true) {
      const { done, value } = await reader.read();
      
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      
      // Process complete lines
      const lines = buffer.split('\n');
      buffer = lines.pop() || ''; // Keep incomplete line in buffer

      for (const line of lines) {
        if (!line.trim() || !line.startsWith('data: ')) continue;

        const dataStr = line.slice(6); // Remove 'data: ' prefix
        try {
          const data: FastGeminiStreamChunk = JSON.parse(dataStr);

          switch (data.type) {
            case 'start':
              callbacks.onStart?.(data.time || Date.now());
              break;
            case 'chunk':
              if (data.content) {
                callbacks.onChunk?.(data.content);
              }
              break;
            case 'done':
              callbacks.onDone?.(data.time_ms || 0);
              break;
            case 'error':
              callbacks.onError?.(data.error || 'Unknown error');
              break;
          }
        } catch (e) {
          console.error('Failed to parse stream chunk:', e);
        }
      }
    }
  } catch (error) {
    callbacks.onError?.(error instanceof Error ? error.message : 'Stream error');
  } finally {
    reader.releaseLock();
  }
}

/**
 * Health check for fast Gemini chat
 */
export async function fastGeminiChatHealth(): Promise<{
  status: string;
  model: string;
  api_key_configured: boolean;
}> {
  const response = await fetch(`${API_URL}/chat/fast-gemini-chat/health`);
  return response.json();
}
