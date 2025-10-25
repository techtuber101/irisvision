import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface Agent {
  agent_id: string;
  name: string;
  avatar?: string;
  metadata?: {
    is_iris_default?: boolean;
  };
}

interface AgentSelectionState {
  selectedAgentId: string | undefined;
  hasInitialized: boolean;
  
  setSelectedAgent: (agentId: string | undefined) => void;
  initializeFromAgents: (agents: Agent[], threadAgentId?: string, onAgentSelect?: (agentId: string | undefined) => void) => void;
  autoSelectAgent: (agents: Agent[], onAgentSelect?: (agentId: string | undefined) => void, currentSelectedAgentId?: string) => void;
  clearSelection: () => void;
  
  getCurrentAgent: (agents: Agent[]) => Agent | null;
  isIrisAgent: (agents: Agent[]) => boolean;
}

export const useAgentSelectionStore = create<AgentSelectionState>()(
  persist(
    (set, get) => ({
      selectedAgentId: undefined,
      hasInitialized: false,

      setSelectedAgent: (agentId: string | undefined) => {
        set({ selectedAgentId: agentId });
      },

      initializeFromAgents: (agents: Agent[], threadAgentId?: string, onAgentSelect?: (agentId: string | undefined) => void) => {
        if (get().hasInitialized) {
          return;
        }

        let selectedId: string | undefined;

        if (threadAgentId) {
          selectedId = threadAgentId;
        } else if (typeof window !== 'undefined') {
          const urlParams = new URLSearchParams(window.location.search);
          const agentIdFromUrl = urlParams.get('agent_id');
          if (agentIdFromUrl) {
            selectedId = agentIdFromUrl;
          }
        }

        if (!selectedId) {
          const current = get().selectedAgentId;
          
          if (current && agents.some(a => a.agent_id === current)) {
            selectedId = current;
          } else if (agents.length > 0) {
            const defaultIrisAgent = agents.find(agent => agent.metadata?.is_iris_default);
            selectedId = defaultIrisAgent ? defaultIrisAgent.agent_id : agents[0].agent_id;
          }
        }

        if (selectedId) {
          set({ selectedAgentId: selectedId });
        }

        if (selectedId && onAgentSelect) {
          onAgentSelect(selectedId);
        }

        set({ hasInitialized: true });
      },

      autoSelectAgent: (agents: Agent[], onAgentSelect?: (agentId: string | undefined) => void, currentSelectedAgentId?: string) => {
        if (agents.length === 0 || currentSelectedAgentId) {
          return;
        }
        const defaultIrisAgent = agents.find(agent => agent.metadata?.is_iris_default);
        const agentToSelect = defaultIrisAgent || agents[0];
        
        if (agentToSelect) {
          if (onAgentSelect) {
            onAgentSelect(agentToSelect.agent_id);
          } else {
            set({ selectedAgentId: agentToSelect.agent_id });
          }
        }
      },

      clearSelection: () => {
        set({ selectedAgentId: undefined, hasInitialized: false });
      },

      getCurrentAgent: (agents: Agent[]) => {
        const { selectedAgentId } = get();
        return selectedAgentId 
          ? agents.find(agent => agent.agent_id === selectedAgentId) || null
          : null;
      },

      isIrisAgent: (agents: Agent[]) => {
        const { selectedAgentId } = get();
        const currentAgent = selectedAgentId 
          ? agents.find(agent => agent.agent_id === selectedAgentId)
          : null;
        return currentAgent?.metadata?.is_iris_default || selectedAgentId === undefined;
      },
    }),
    {
      name: 'agent-selection-storage',
      partialize: (state) => ({ 
        selectedAgentId: state.selectedAgentId 
      }),
    }
  )
);

export const useAgentSelection = () => {
  const store = useAgentSelectionStore();
  
  return {
    selectedAgentId: store.selectedAgentId,
    hasInitialized: store.hasInitialized,
    setSelectedAgent: store.setSelectedAgent,
    initializeFromAgents: store.initializeFromAgents,
    autoSelectAgent: store.autoSelectAgent,
    clearSelection: store.clearSelection,
    getCurrentAgent: store.getCurrentAgent,
    isIrisAgent: store.isIrisAgent,
  };
}; 