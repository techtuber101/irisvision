import { SERVER_URL } from '@/constants/Server';
import { useMutation } from '@tanstack/react-query';

export interface QuickChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface QuickChatRequest {
  message: string;
  model?: string;
  systemInstructions?: string;
  chatContext?: QuickChatMessage[];
}

export interface QuickChatResponse {
  response: string;
  time_ms: number;
}

export const sendQuickChat = async (payload: QuickChatRequest): Promise<QuickChatResponse> => {
  const endpoint = `${SERVER_URL}/chat/fast-gemini-chat`;

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      message: payload.message,
      model: payload.model,
      system_instructions: payload.systemInstructions,
      chat_context: payload.chatContext,
    }),
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(detail || 'Unable to complete quick chat');
  }

  return response.json();
};

export const useQuickChat = () =>
  useMutation({
    mutationFn: sendQuickChat,
  });
