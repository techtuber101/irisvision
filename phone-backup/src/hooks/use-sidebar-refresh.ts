'use client';

import { useQueryClient } from '@tanstack/react-query';
import { projectKeys, threadKeys } from '@/hooks/react-query/sidebar/keys';

/**
 * Hook to manually refresh sidebar data when needed
 * This is more efficient than automatic polling
 */
export function useSidebarRefresh() {
  const queryClient = useQueryClient();

  const refreshSidebar = () => {
    // Invalidate and refetch sidebar data
    queryClient.invalidateQueries({ queryKey: projectKeys.lists() });
    queryClient.invalidateQueries({ queryKey: threadKeys.lists() });
  };

  const refreshProjects = () => {
    queryClient.invalidateQueries({ queryKey: projectKeys.lists() });
  };

  const refreshThreads = () => {
    queryClient.invalidateQueries({ queryKey: threadKeys.lists() });
  };

  return {
    refreshSidebar,
    refreshProjects,
    refreshThreads,
  };
}
