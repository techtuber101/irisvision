import { createMutationHook, createQueryHook } from "@/hooks/use-query";
import { threadKeys } from "./keys";
import { addUserMessage, addAssistantMessage, getMessages } from "@/lib/api";

export const useMessagesQuery = (threadId: string) =>
  createQueryHook(
    threadKeys.messages(threadId),
    () => getMessages(threadId),
    {
      enabled: !!threadId,
      retry: 1,
      refetchOnMount: false,
      refetchOnWindowFocus: false,
      refetchOnReconnect: false,
    }
  )();

export const useAddUserMessageMutation = () =>
  createMutationHook(
    ({
      threadId,
      message,
    }: {
      threadId: string;
      message: string;
    }) => addUserMessage(threadId, message)
  )();

export const useAddAssistantMessageMutation = () =>
  createMutationHook(
    ({
      threadId,
      content,
      metadata,
    }: {
      threadId: string;
      content: string;
      metadata?: any;
    }) => addAssistantMessage(threadId, content, metadata)
  )();
