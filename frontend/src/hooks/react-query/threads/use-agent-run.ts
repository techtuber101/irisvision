import { createMutationHook, createQueryHook } from "@/hooks/use-query";
import { threadKeys } from "./keys";
import { BillingError, AgentRunLimitError, getAgentRuns, startAgent, stopAgent } from "@/lib/api";
import { useQueryClient } from "@tanstack/react-query";
import { threadKeys as sidebarThreadKeys } from "../sidebar/keys";

export const useAgentRunsQuery = (threadId: string) =>
  createQueryHook(
    threadKeys.agentRuns(threadId),
    () => getAgentRuns(threadId),
    {
      enabled: !!threadId,
      retry: 1,
    }
  )();

export const useStartAgentMutation = () => {
  const queryClient = useQueryClient();
  return createMutationHook(
    ({
      threadId,
      options,
    }: {
      threadId: string;
      options?: {
        model_name?: string;
        agent_id?: string;
      };
    }) => startAgent(threadId, options),
    {
      onSuccess: () => {
        // Invalidate threads list to update ordering when agent starts (which implies a message was sent)
        queryClient.invalidateQueries({ queryKey: sidebarThreadKeys.lists() });
      },
      onError: (error) => {
        // Only silently handle BillingError - let AgentRunLimitError bubble up to be handled by the page component
        if (!(error instanceof BillingError)) {
          throw error;
        }
      },
    }
  )();
};

export const useStopAgentMutation = () =>
  createMutationHook((agentRunId: string) => stopAgent(agentRunId))();
