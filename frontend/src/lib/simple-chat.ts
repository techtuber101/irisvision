/**
 * Simple Chat Client
 * Ultra-minimal chat functionality - direct API call, no streaming, no complexity
 */

import { createClient } from '@/lib/supabase/client';

const API_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8000/api';

export interface SimpleChatRequest {
  message: string;
}

export interface SimpleChatResponse {
  thread_id: string;
  project_id: string;
  response: string;
  time_ms: number;
}

/**
 * Simple chat - direct API call, no streaming, no complexity
 */
export async function simpleChat(message: string): Promise<SimpleChatResponse> {
  const supabase = createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session?.access_token) {
    throw new Error('No authentication token available');
  }

  const formData = new FormData();
  formData.append('message', message);

  const response = await fetch(`${API_URL}/simple-chat/simple`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${session.access_token}`,
    },
    body: formData,
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.detail || 'Failed to send message');
  }

  return response.json();
}

/**
 * Continue simple chat conversation
 */
export async function continueSimpleChat(threadId: string, message: string): Promise<SimpleChatResponse> {
  const supabase = createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session?.access_token) {
    throw new Error('No authentication token available');
  }

  const formData = new FormData();
  formData.append('thread_id', threadId);
  formData.append('message', message);

  const response = await fetch(`${API_URL}/simple-chat/simple/continue`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${session.access_token}`,
    },
    body: formData,
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.detail || 'Failed to continue chat');
  }

  return response.json();
}

/**
 * Streaming simple chat - creates project/thread and streams response
 */
export async function simpleChatStream(
  message: string,
  callbacks: {
    onMetadata?: (data: { thread_id: string; project_id: string }) => void;
    onContent?: (content: string) => void;
    onDone?: () => void;
    onError?: (error: string) => void;
  },
  options?: {
    projectId?: string;
    threadId?: string;
  }
): Promise<void> {
  const supabase = createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session?.access_token) {
    throw new Error('No authentication token available');
  }

  const formData = new FormData();
  formData.append('message', message);
  if (options?.projectId) {
    formData.append('client_project_id', options.projectId);
  }
  if (options?.threadId) {
    formData.append('client_thread_id', options.threadId);
  }

  const response = await fetch(`${API_URL}/simple-chat/simple/stream`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${session.access_token}`,
    },
    body: formData,
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
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          try {
            const data = JSON.parse(line.slice(6));
            
            switch (data.type) {
              case 'metadata':
                callbacks.onMetadata?.(data);
                break;
              case 'content':
                callbacks.onContent?.(data.content);
                break;
              case 'done':
                callbacks.onDone?.();
                return;
              case 'error':
                callbacks.onError?.(data.error);
                return;
            }
          } catch (e) {
            console.error('Failed to parse SSE data:', line);
          }
        }
      }
    }
  } catch (error) {
    callbacks.onError?.(error instanceof Error ? error.message : 'Streaming error');
  }
}

/**
 * Streaming continue simple chat conversation
 */
export async function continueSimpleChatStream(
  threadId: string,
  message: string,
  callbacks: {
    onContent?: (content: string) => void;
    onDone?: () => void;
    onError?: (error: string) => void;
  }
): Promise<void> {
  const supabase = createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session?.access_token) {
    throw new Error('No authentication token available');
  }

  const formData = new FormData();
  formData.append('thread_id', threadId);
  formData.append('message', message);

  const response = await fetch(`${API_URL}/simple-chat/simple/continue/stream`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${session.access_token}`,
    },
    body: formData,
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
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          try {
            const data = JSON.parse(line.slice(6));
            
            switch (data.type) {
              case 'content':
                console.log('Received content chunk:', data.content.length, 'characters');
                callbacks.onContent?.(data.content);
                break;
              case 'done':
                console.log('Streaming completed');
                callbacks.onDone?.();
                return;
              case 'error':
                console.error('Streaming error:', data.error);
                callbacks.onError?.(data.error);
                return;
            }
          } catch (e) {
            console.error('Failed to parse SSE data:', line);
          }
        }
      }
    }
  } catch (error) {
    callbacks.onError?.(error instanceof Error ? error.message : 'Streaming error');
  }
}

/**
 * Health check for simple chat
 */
export async function simpleChatHealth(): Promise<{
  status: string;
  model: string;
  api_key_configured: boolean;
}> {
  const response = await fetch(`${API_URL}/simple-chat/simple/health`);
  return response.json();
}
