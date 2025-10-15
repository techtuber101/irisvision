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
