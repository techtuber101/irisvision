import { useCallback, useEffect } from 'react';
import { useSimpleChatStreamStore } from '@/lib/stores/simple-chat-stream-store';

const DEFAULT_TTL = 5 * 60 * 1000;

export const generateClientId = () => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
};

interface CreateSessionParams {
  prompt: string;
  projectId?: string;
  threadId?: string;
  initialContent?: string;
}

export interface ChatSessionHandle {
  projectId: string;
  threadId: string;
  append: (chunk: string) => void;
  finish: () => void;
  fail: (error?: string) => void;
  clear: () => void;
}

export function useChatSessionManager(ttlMs: number = DEFAULT_TTL) {
  const startStream = useSimpleChatStreamStore((state) => state.startStream);
  const appendContent = useSimpleChatStreamStore((state) => state.appendContent);
  const finishStream = useSimpleChatStreamStore((state) => state.finishStream);
  const failStream = useSimpleChatStreamStore((state) => state.failStream);
  const clearStream = useSimpleChatStreamStore((state) => state.clearStream);
  const cleanupExpiredStreams = useSimpleChatStreamStore((state) => state.cleanupExpiredStreams);

  useEffect(() => {
    const interval = setInterval(() => cleanupExpiredStreams(ttlMs), Math.max(15_000, ttlMs / 6));
    return () => clearInterval(interval);
  }, [cleanupExpiredStreams, ttlMs]);

  const createSession = useCallback(
    ({ prompt, projectId, threadId, initialContent = '' }: CreateSessionParams): ChatSessionHandle => {
      const resolvedThreadId = threadId ?? generateClientId();
      const resolvedProjectId = projectId ?? generateClientId();
      startStream({
        threadId: resolvedThreadId,
        projectId: resolvedProjectId,
        prompt,
        content: initialContent,
      });
      return {
        projectId: resolvedProjectId,
        threadId: resolvedThreadId,
        append: (chunk: string) => appendContent(resolvedThreadId, chunk),
        finish: () => finishStream(resolvedThreadId),
        fail: (error?: string) => failStream(resolvedThreadId, error),
        clear: () => clearStream(resolvedThreadId),
      };
    },
    [appendContent, clearStream, failStream, finishStream, startStream],
  );

  return { createSession };
}
