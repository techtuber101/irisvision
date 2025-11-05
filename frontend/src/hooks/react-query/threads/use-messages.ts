import { createMutationHook, createQueryHook } from "@/hooks/use-query";
import { threadKeys } from "./keys";
import { addUserMessage, addAssistantMessage, getMessages } from "@/lib/api";
import { useQueryClient } from "@tanstack/react-query";
import { threadKeys as sidebarThreadKeys } from "../sidebar/keys";

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

export const useAddUserMessageMutation = () => {
  const queryClient = useQueryClient();
  return createMutationHook(
    ({
      threadId,
      message,
    }: {
      threadId: string;
      message: string;
    }) => addUserMessage(threadId, message),
    {
      onSuccess: () => {
        // Invalidate threads list to update ordering when a message is added
        queryClient.invalidateQueries({ queryKey: sidebarThreadKeys.lists() });
      },
    }
  )();
};

export const useAddAssistantMessageMutation = () => {
  const queryClient = useQueryClient();
  return createMutationHook(
    ({
      threadId,
      content,
      metadata,
    }: {
      threadId: string;
      content: string;
      metadata?: any;
    }) => addAssistantMessage(threadId, content, metadata),
    {
      onSuccess: () => {
        // Invalidate threads list to update ordering when a message is added
        queryClient.invalidateQueries({ queryKey: sidebarThreadKeys.lists() });
      },
    }
  )();
};
