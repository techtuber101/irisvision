import { SERVER_URL } from '@/constants/Server';
import { useMutation } from '@tanstack/react-query';

export interface QuickChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface QuickChatAttachment {
  name?: string;
  mimeType: string;
  data: string;
}

export interface QuickChatRequest {
  message: string;
  model?: string;
  systemInstructions?: string;
  chatContext?: QuickChatMessage[];
  attachments?: QuickChatAttachment[];
}

export interface QuickChatResponse {
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

export interface AdaptiveChatResponse extends QuickChatResponse {
  decision: AdaptiveDecision;
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
      attachments: payload.attachments?.map((attachment) => ({
        name: attachment.name,
        mime_type: attachment.mimeType,
        data: attachment.data,
      })),
    }),
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(detail || 'Unable to complete quick chat');
  }

  return response.json();
};

export const sendAdaptiveChat = async (payload: QuickChatRequest): Promise<AdaptiveChatResponse> => {
  const endpoint = `${SERVER_URL}/chat/adaptive`;

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
      attachments: payload.attachments?.map((attachment) => ({
        name: attachment.name,
        mime_type: attachment.mimeType,
        data: attachment.data,
      })),
    }),
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(detail || 'Unable to complete adaptive chat');
  }

  return response.json();
};

export const useQuickChat = () =>
  useMutation({
    mutationFn: sendQuickChat,
  });
