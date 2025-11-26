import { create } from 'zustand';

export type SimpleChatStreamStatus = 'streaming' | 'done' | 'error';

export interface SimpleChatStreamEntry {
  threadId: string;
  projectId: string;
  prompt: string;
  content: string;
  status: SimpleChatStreamStatus;
  error?: string;
  startedAt: number;
  updatedAt: number;
  completedAt?: number;
}

interface SimpleChatStreamState {
  streams: Record<string, SimpleChatStreamEntry>;
  startStream: (entry: { threadId: string; projectId: string; prompt: string; content?: string }) => void;
  appendContent: (threadId: string, chunk: string) => void;
  finishStream: (threadId: string) => void;
  failStream: (threadId: string, error?: string) => void;
  clearStream: (threadId: string) => void;
  cleanupExpiredStreams: (ttlMs?: number) => void;
}

export const useSimpleChatStreamStore = create<SimpleChatStreamState>((set) => ({
  streams: {},
  startStream: ({ threadId, projectId, prompt, content = '' }) =>
    set((state) => ({
      streams: {
        ...state.streams,
        [threadId]: {
          threadId,
          projectId,
          prompt,
          content,
          status: 'streaming',
          startedAt: Date.now(),
          updatedAt: Date.now(),
        },
      },
    })),
  appendContent: (threadId, chunk) =>
    set((state) => {
      const current = state.streams[threadId];
      if (!current) {
        return state;
      }
      return {
        streams: {
          ...state.streams,
          [threadId]: {
            ...current,
            content: current.content + chunk,
            startedAt: current.startedAt,
            updatedAt: Date.now(),
          },
        },
      };
    }),
  finishStream: (threadId) =>
    set((state) => {
      const current = state.streams[threadId];
      if (!current) return state;
      return {
        streams: {
          ...state.streams,
          [threadId]: {
            ...current,
            status: 'done',
            startedAt: current.startedAt,
            updatedAt: Date.now(),
            completedAt: Date.now(),
          },
        },
      };
    }),
  failStream: (threadId, error) =>
    set((state) => {
      const current = state.streams[threadId];
      if (!current) return state;
      return {
        streams: {
          ...state.streams,
          [threadId]: {
            ...current,
            status: 'error',
            error: error || current.error,
            startedAt: current.startedAt,
            updatedAt: Date.now(),
            completedAt: Date.now(),
          },
        },
      };
    }),
  clearStream: (threadId) =>
    set((state) => {
      if (!state.streams[threadId]) return state;
      const updated = { ...state.streams };
      delete updated[threadId];
      return { streams: updated };
    }),
  cleanupExpiredStreams: (ttlMs = 5 * 60 * 1000) =>
    set((state) => {
      const now = Date.now();
      const streams = Object.fromEntries(
        Object.entries(state.streams).filter(([_, entry]) => {
          if (entry.status === 'streaming' || !entry.completedAt) {
            return true;
          }
          return now - entry.completedAt < ttlMs;
        }),
      );
      return { streams };
    }),
}));
