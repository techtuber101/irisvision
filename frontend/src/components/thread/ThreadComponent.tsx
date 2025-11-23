'use client';

import React, {
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';
import { useSearchParams } from 'next/navigation';
import { BillingError, AgentRunLimitError, ProjectLimitError } from '@/lib/api';
import { toast } from 'sonner';
import { ChatInput } from '@/components/thread/chat-input/chat-input';
import type { ChatMode } from '@/components/thread/chat-input/chat-input';
import { useSidebar } from '@/components/ui/sidebar';
import { useAgentStream } from '@/hooks/useAgentStream';
import { cn } from '@/lib/utils';
import { useIsMobile } from '@/hooks/use-mobile';
import { isLocalMode } from '@/lib/config';
import { ThreadContent } from '@/components/thread/content/ThreadContent';
import { ThreadSkeleton } from '@/components/thread/content/ThreadSkeleton';
import { useAddUserMessageMutation, useAddAssistantMessageMutation } from '@/hooks/react-query/threads/use-messages';
import { useSidebarRefresh } from '@/hooks/use-sidebar-refresh';
import {
  useStartAgentMutation,
  useStopAgentMutation,
  useSendAdaptiveInputMutation,
} from '@/hooks/react-query/threads/use-agent-run';
import { useSharedSubscription } from '@/contexts/SubscriptionContext';
export type SubscriptionStatus = 'no_subscription' | 'active';

import {
  UnifiedMessage,
} from '@/components/thread/types';
import {
  ApiMessageType,
} from '@/app/(dashboard)/projects/[projectId]/thread/_types';
import {
  useThreadData,
  useToolCalls,
  useBilling,
  useKeyboardShortcuts,
} from '@/app/(dashboard)/projects/[projectId]/thread/_hooks';
import { ThreadError, UpgradeDialog, ThreadLayout } from '@/app/(dashboard)/projects/[projectId]/thread/_components';

import {
  useThreadAgent,
  useAgents,
} from '@/hooks/react-query/agents/use-agents';
import { AgentRunLimitDialog } from '@/components/thread/agent-run-limit-dialog';
import { useAgentSelection } from '@/lib/stores/agent-selection-store';
import { useModelSelection } from '@/hooks/use-model-selection';
import { useQueryClient } from '@tanstack/react-query';
import { threadKeys } from '@/hooks/react-query/threads/keys';
import { threadKeys as sidebarThreadKeys } from '@/hooks/react-query/sidebar/keys';
import { useProjectRealtime } from '@/hooks/useProjectRealtime';
import { fastGeminiChatStream, fastGeminiChat, adaptiveChat, type AdaptiveDecision, type AdaptiveChatResponse } from '@/lib/fast-gemini-chat';
import { handleGoogleSlidesUpload } from './tool-views/utils/presentation-utils';
import { FloatingToolPreview, ToolCallInput } from '@/components/thread/chat-input/floating-tool-preview';
import { Check, X } from 'lucide-react';


interface ThreadComponentProps {
  projectId: string;
  threadId: string;
  compact?: boolean;
  configuredAgentId?: string; // When set, only allow selection of this specific agent
}

export function ThreadComponent({ projectId, threadId, compact = false, configuredAgentId }: ThreadComponentProps) {
  const isMobile = useIsMobile();
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();
  const { refreshSidebar } = useSidebarRefresh();

  // State
  const [newMessage, setNewMessage] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [isSimpleChatLoading, setIsSimpleChatLoading] = useState(false);
  const [adaptivePrompt, setAdaptivePrompt] = useState<{
    prompt: string;
    yesLabel: string;
    noLabel: string;
    message: string;
    reason?: string;
    options?: { model_name?: string; hidden?: boolean };
  } | null>(null);
  const [fileViewerOpen, setFileViewerOpen] = useState(false);
  const [fileToView, setFileToView] = useState<string | null>(null);
  const [filePathList, setFilePathList] = useState<string[] | undefined>(
    undefined,
  );
  const [showUpgradeDialog, setShowUpgradeDialog] = useState(false);
  const [debugMode, setDebugMode] = useState(false);
  const [initialPanelOpenAttempted, setInitialPanelOpenAttempted] =
    useState(false);
  // Use Zustand store for agent selection persistence
  const {
    selectedAgentId,
    setSelectedAgent,
    initializeFromAgents,
    getCurrentAgent,
    isIrisAgent,
  } = useAgentSelection();

  // Model selection
  const {
    selectedModel,
    getActualModelId,
  } = useModelSelection();

  const { data: agentsResponse } = useAgents();
  const agents = agentsResponse?.agents || [];
  const [isSidePanelAnimating, setIsSidePanelAnimating] = useState(false);
  const [userInitiatedRun, setUserInitiatedRun] = useState(false);
  const [showScrollToBottom, setShowScrollToBottom] = useState(false);
  const [isUserAtBottom, setIsUserAtBottom] = useState(true);
  const [followNewMessages, setFollowNewMessages] = useState(true);
  const [newMessageCount, setNewMessageCount] = useState(0);
  const [showAgentLimitDialog, setShowAgentLimitDialog] = useState(false);
  const [agentLimitData, setAgentLimitData] = useState<{
    runningCount: number;
    runningThreadIds: string[];
  } | null>(null);
  
  // Track initial chat mode from localStorage
  const [initialChatMode, setInitialChatMode] = useState<ChatMode>('execute');
  const userSelectedModeRef = useRef<ChatMode | null>(null);
  
  // Handle chat mode changes from user interaction
  const handleChatModeChange = useCallback((mode: ChatMode) => {
    userSelectedModeRef.current = mode;
    setInitialChatMode(mode);
  }, []);

  // Handle populating chat input when agent is running
  const handlePopulateChatInput = useCallback((message: string) => {
    setNewMessage(message);
  }, []);

  // Refs - simplified for flex-column-reverse
  const latestMessageRef = useRef<HTMLDivElement>(null);
  const initialLayoutAppliedRef = useRef(false);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const lastStreamStartedRef = useRef<string | null>(null); // Track last runId we started streaming for
  const titleGenerationTriggeredRef = useRef<boolean>(false); // Track if title generation has been triggered
  const previousToolCallCountRef = useRef<number>(0);
  const processedServerAdaptiveMessagesRef = useRef<Set<string>>(new Set());

  // Sidebar
  const { state: leftSidebarState, setOpen: setLeftSidebarOpen } = useSidebar();

  // Custom hooks
  const {
    messages,
    setMessages,
    project,
    sandboxId,
    projectName,
    agentRunId,
    setAgentRunId,
    agentStatus,
    setAgentStatus,
    isLoading,
    error,
    initialLoadCompleted,
    threadQuery,
    messagesQuery,
    projectQuery,
    agentRunsQuery,
  } = useThreadData(threadId, projectId);

  // Trigger title generation after LLM response is complete
  const triggerTitleGeneration = useCallback(async () => {
    try {
      // Only trigger once per thread and if we have a project
      if (project?.project_id && !titleGenerationTriggeredRef.current) {
        titleGenerationTriggeredRef.current = true;
        
        // Get the first user message to use for title generation
        const firstUserMessage = messages.find(msg => msg.type === 'user');
        if (firstUserMessage) {
          let prompt = '';
          if (typeof firstUserMessage.content === 'string') {
            try {
              const parsed = JSON.parse(firstUserMessage.content);
              prompt = parsed.content || parsed;
            } catch {
              prompt = firstUserMessage.content;
            }
          }
          
          if (prompt) {
            // Call the backend to generate title in background
            const formData = new FormData();
            formData.append('project_id', project.project_id);
            formData.append('prompt', prompt);
            
            await fetch('/api/threads/generate-title', {
              method: 'POST',
              body: formData
            });
            
            // Refresh sidebar to show the new title
            refreshSidebar();
          }
        }
      }
    } catch (error) {
      console.error('Failed to trigger title generation:', error);
      // Don't show error to user as this is a background process
    }
  }, [project, messages, refreshSidebar]);

  // Track if we've already set the initial mode for this thread
  const [hasSetInitialMode, setHasSetInitialMode] = useState(false);
  
  // Reset hasSetInitialMode and user selected mode when threadId changes
  useEffect(() => {
    setHasSetInitialMode(false);
    userSelectedModeRef.current = null;
  }, [threadId]);
  
  // Reset title generation trigger when threadId changes
  useEffect(() => {
    titleGenerationTriggeredRef.current = false;
  }, [threadId]);
  
  // Detect chat mode from thread metadata and messages (only once per thread, and only if user hasn't selected)
  useEffect(() => {
    // Don't override if user has manually selected a mode
    if (userSelectedModeRef.current) {
      return;
    }
    
    if (threadQuery.data && initialLoadCompleted && !hasSetInitialMode) {
      // First, check messages for adaptive mode metadata (most recent messages first)
      let detectedMode: ChatMode | null = null;
      if (messages.length > 0) {
        for (let i = messages.length - 1; i >= 0; i--) {
          const message = messages[i];
          if (message.metadata) {
            try {
              const metadata = typeof message.metadata === 'string' 
                ? JSON.parse(message.metadata) 
                : message.metadata;
              if (metadata.chat_mode === 'adaptive' || metadata.chat_mode === 'chat' || metadata.chat_mode === 'simple') {
                detectedMode = metadata.chat_mode === 'simple' ? 'chat' : metadata.chat_mode;
                break;
              }
            } catch (e) {
              // Ignore parse errors
            }
          }
        }
      }
      
      // If found in messages, use it
      if (detectedMode) {
        setInitialChatMode(detectedMode);
        setHasSetInitialMode(true);
        return;
      }
      
      // Otherwise, check thread metadata
      const threadMetadata = threadQuery.data.metadata;
      if (threadMetadata && typeof threadMetadata === 'object') {
        if (threadMetadata.chat_mode === 'simple') {
          setInitialChatMode('chat');
        } else if (threadMetadata.chat_mode === 'adaptive') {
          setInitialChatMode('adaptive');
        } else {
          // Default to execute mode for all other threads
          setInitialChatMode('execute');
        }
      } else {
        // Default to execute mode if no metadata
        setInitialChatMode('execute');
      }
      setHasSetInitialMode(true);
    }
  }, [threadQuery.data, initialLoadCompleted, messages, hasSetInitialMode]);

  const {
    toolCalls,
    setToolCalls,
    currentToolIndex,
    setCurrentToolIndex,
    isSidePanelOpen,
    setIsSidePanelOpen,
    autoOpenedPanel,
    setAutoOpenedPanel,
    externalNavIndex,
    setExternalNavIndex,
    handleToolClick,
    handleStreamingToolCall,
    toggleSidePanel,
    handleSidePanelNavigate,
    userClosedPanelRef,
  } = useToolCalls(messages, setLeftSidebarOpen, agentStatus, compact);

  const {
    showBillingAlert,
    setShowBillingAlert,
    billingData,
    setBillingData,
    checkBillingLimits,
    billingStatusQuery,
  } = useBilling(null, agentStatus, initialLoadCompleted);

  // Real-time project updates (for sandbox creation)
  useProjectRealtime(projectId);

  // Keyboard shortcuts
  useKeyboardShortcuts({
    isSidePanelOpen,
    setIsSidePanelOpen,
    leftSidebarState,
    setLeftSidebarOpen,
    userClosedPanelRef,
  });

  const addUserMessageMutation = useAddUserMessageMutation();
  const addAssistantMessageMutation = useAddAssistantMessageMutation();
  const startAgentMutation = useStartAgentMutation();
  const stopAgentMutation = useStopAgentMutation();
  const sendAdaptiveInputMutation = useSendAdaptiveInputMutation();
  const { data: threadAgentData } = useThreadAgent(threadId);
  const agent = threadAgentData?.agent;

  useEffect(() => {
    queryClient.invalidateQueries({ queryKey: threadKeys.agentRuns(threadId) });
    queryClient.invalidateQueries({ queryKey: threadKeys.messages(threadId) });
  }, [threadId, queryClient]);

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    
    if (urlParams.get('google_auth') === 'success') {
      // Clean up the URL parameters first
      window.history.replaceState({}, '', window.location.pathname);
      
      // Check if there was an intent to upload to Google Slides
      const uploadIntent = sessionStorage.getItem('google_slides_upload_intent');
      if (uploadIntent) {
        sessionStorage.removeItem('google_slides_upload_intent');
        
        try {
          const uploadData = JSON.parse(uploadIntent);
          const { presentation_path, sandbox_url } = uploadData;
          
          if (presentation_path && sandbox_url) {
            // Handle upload in async function
            (async () => {
              const uploadPromise = handleGoogleSlidesUpload(
                sandbox_url,
                presentation_path
              );
              
              // Show loading toast and handle upload
              const loadingToast = toast.loading('Google authentication successful! Uploading presentation...');
              
              try {
                await uploadPromise;
                // Success toast is now handled universally by handleGoogleSlidesUpload
              } catch (error) {
                console.error('Upload failed:', error);
                // Error toast is also handled universally by handleGoogleSlidesUpload
              } finally {
                // Always dismiss loading toast
                toast.dismiss(loadingToast);
              }
            })();
          }
        } catch (error) {
          console.error('Error processing Google Slides upload from session:', error);
          // Error toast is handled universally by handleGoogleSlidesUpload, no need to duplicate
        }
      } else {
        toast.success('Google authentication successful!');
      }
    } else if (urlParams.get('google_auth') === 'error') {
      const error = urlParams.get('error');
      sessionStorage.removeItem('google_slides_upload_intent');
      window.history.replaceState({}, '', window.location.pathname);
      toast.error(`Google authentication failed: ${error || 'Unknown error'}`);
    }
  }, []);

  useEffect(() => {
    if (agents.length > 0) {
      // If configuredAgentId is provided, use it as the forced selection
      // Otherwise, fall back to threadAgentId (existing behavior)
      const threadAgentId = threadAgentData?.agent?.agent_id;
      const agentIdToUse = configuredAgentId || threadAgentId;
      
      console.log(`[ThreadComponent] Agent initialization - configuredAgentId: ${configuredAgentId}, threadAgentId: ${threadAgentId}, selectedAgentId: ${selectedAgentId}`);
      
      initializeFromAgents(agents, agentIdToUse);
      
      // If configuredAgentId is provided, force selection and override any existing selection
      if (configuredAgentId && selectedAgentId !== configuredAgentId) {
        console.log(`[ThreadComponent] Forcing selection to configured agent: ${configuredAgentId} (was: ${selectedAgentId})`);
        setSelectedAgent(configuredAgentId);
      }
    }
  }, [threadAgentData, agents, initializeFromAgents, configuredAgentId, selectedAgentId, setSelectedAgent]);

  const { data: subscriptionData } = useSharedSubscription();
  const subscriptionStatus: SubscriptionStatus =
    subscriptionData?.status === 'active' ||
    subscriptionData?.status === 'trialing'
      ? 'active'
      : 'no_subscription';

  const handleProjectRenamed = useCallback((newName: string) => {}, []);

  // Create restricted agent selection handler when configuredAgentId is provided
  const handleAgentSelect = useCallback((agentId: string | undefined) => {
    // If configuredAgentId is set, only allow selection of that specific agent
    if (configuredAgentId) {
      console.log(`[ThreadComponent] Configured agent mode: ${configuredAgentId}. Attempted selection: ${agentId}`);
      if (agentId === configuredAgentId) {
        setSelectedAgent(agentId);
        console.log(`[ThreadComponent] Allowed selection of configured agent: ${agentId}`);
      } else {
        console.log(`[ThreadComponent] Blocked selection of non-configured agent: ${agentId}`);
      }
      // Ignore attempts to select other agents
      return;
    }
    
    // Normal agent selection behavior
    setSelectedAgent(agentId);
  }, [configuredAgentId, setSelectedAgent]);

  // scrollToBottom for flex-column-reverse layout
  const scrollToBottom = useCallback(() => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollTo({ top: 0, behavior: 'smooth' });
      setFollowNewMessages(true);
      setNewMessageCount(0);
    }
  }, []);

  const scrollToTop = useCallback(() => {
    if (scrollContainerRef.current) {
      const el = scrollContainerRef.current;
      // With flex-col-reverse, older messages are at negative scrollTop
      el.scrollTo({ top: -el.scrollHeight, behavior: 'smooth' });
    }
  }, []);

  const handleNewMessageFromStream = useCallback(
    (message: UnifiedMessage) => {
      if (!message.message_id) {
        console.warn(
          `[STREAM HANDLER] Received message is missing ID: Type=${message.type}`,
        );
      }

      setMessages((prev) => {
        const messageExists = prev.some(
          (m) => m.message_id === message.message_id,
        );
        if (messageExists) {
          return prev.map((m) =>
            m.message_id === message.message_id ? message : m,
          );
        } else {
          // If this is a user message, replace any optimistic user message with temp ID
          if (message.type === 'user') {
            const optimisticIndex = prev.findIndex(
              (m) =>
                m.type === 'user' &&
                m.message_id?.startsWith('temp-') &&
                m.content === message.content,
            );
            if (optimisticIndex !== -1) {
              // Replace the optimistic message with the real one
              return prev.map((m, index) =>
                index === optimisticIndex ? message : m,
              );
            }
          }
          
          // If this is an assistant message, remove any optimistic "Hmm..." messages
          if (message.type === 'assistant') {
            const filteredPrev = prev.filter((m) => !m.message_id?.startsWith('hmm-'));
            return [...filteredPrev, message];
          }
          
          return [...prev, message];
        }
      });

      if (message.type === 'tool') {
        setAutoOpenedPanel(false);
      }

      // Only auto-scroll to bottom if user is at the bottom, otherwise increment counter
      setTimeout(() => {
        if (followNewMessages && scrollContainerRef.current) {
          scrollContainerRef.current.scrollTo({ top: 0, behavior: 'smooth' });
        } else if (!isUserAtBottom) {
          // User is scrolled up, increment new message count
          setNewMessageCount(prev => prev + 1);
        }
      }, 100);
    },
    [setMessages, setAutoOpenedPanel, isUserAtBottom, followNewMessages],
  );

  const handleStreamStatusChange = useCallback(
    (hookStatus: string) => {
      switch (hookStatus) {
        case 'idle':
        case 'completed':
        case 'stopped':
        case 'agent_not_running':
        case 'error':
        case 'failed':
          setAgentStatus('idle');
          setAgentRunId(null);
          setAutoOpenedPanel(false);

          // No scroll needed with flex-column-reverse
          break;
        case 'connecting':
          setAgentStatus('connecting');
          break;
        case 'streaming':
          setAgentStatus('running');
          break;
      }
    },
    [setAgentStatus, setAgentRunId, setAutoOpenedPanel],
  );

  const handleStreamError = useCallback((errorMessage: string) => {
    const lower = errorMessage.toLowerCase();
    const isExpected =
      lower.includes('not found') || lower.includes('agent run is not running');

    // Downgrade log level for expected/benign cases (opening old conversations)
    if (isExpected) {
      console.info(`[PAGE] Stream skipped for inactive run: ${errorMessage}`);
      return;
    }

    console.error(`[PAGE] Stream hook error: ${errorMessage}`);
    toast.error(`Stream Error: ${errorMessage}`);
  }, []);

  const handleStreamClose = useCallback(() => {}, []);

  const handleAssistantStart = useCallback(() => {
    // Remove the optimistic "Hmm..." message when assistant starts streaming
    setMessages((prev) => 
      prev.filter((m) => !m.message_id?.startsWith('hmm-'))
    );
    // Note: We can't clear the timeout here since it's scoped to the handleSubmitMessage function
    // But the message removal is the important part
  }, [setMessages]);

  const {
    status: streamHookStatus,
    textContent: streamingTextContent,
    toolCall: streamingToolCall,
    error: streamError,
    agentRunId: currentHookRunId,
    startStreaming,
    stopStreaming,
  } = useAgentStream(
    {
      onMessage: handleNewMessageFromStream,
      onStatusChange: handleStreamStatusChange,
      onError: handleStreamError,
      onClose: handleStreamClose,
      onAssistantStart: handleAssistantStart,
    },
    threadId,
    setMessages,
    threadAgentData?.agent?.agent_id,
  );

  const startAgentFromAdaptiveDecision = useCallback(async (submitOptions?: { model_name?: string; hidden?: boolean }) => {
    console.log('[Adaptive] Starting agent from adaptive decision with options:', submitOptions);
    
    if (!selectedAgentId) {
      console.error('[Adaptive] No agent selected, cannot start agent');
      toast.error('Please select an agent first');
      return;
    }
    
    try {
      const agentResult = await startAgentMutation.mutateAsync({
        threadId,
        options: {
          ...submitOptions,
          agent_id: selectedAgentId,
        },
      });
      
      console.log('[Adaptive] Agent started successfully, run ID:', agentResult.agent_run_id);
      setUserInitiatedRun(true);
      setAgentRunId(agentResult.agent_run_id);
      triggerTitleGeneration();
    } catch (error) {
      console.error('[Adaptive] Failed to start agent:', error);

      if (error instanceof BillingError) {
        setBillingData({
          currentUsage: error.detail.currentUsage as number | undefined,
          limit: error.detail.limit as number | undefined,
          message:
            error.detail.message ||
            'Monthly usage limit reached. Please upgrade.',
          accountId: null,
        });
        setShowBillingAlert(true);
        return;
      }

      if (error instanceof AgentRunLimitError) {
        const { running_thread_ids, running_count } = error.detail;

        setAgentLimitData({
          runningCount: running_count,
          runningThreadIds: running_thread_ids,
        });
        setShowAgentLimitDialog(true);
        return;
      }

      if (error instanceof ProjectLimitError) {
        setBillingData({
          currentUsage: error.detail.current_count as number,
          limit: error.detail.limit as number,
          message:
            error.detail.message ||
            `You've reached your project limit (${error.detail.current_count}/${error.detail.limit}). Please upgrade to create more projects.`,
          accountId: null,
        });
        setShowBillingAlert(true);
        return;
      }

      toast.error(error instanceof Error ? error.message : 'Failed to start agent');
    }
  }, [startAgentMutation, threadId, selectedAgentId, setUserInitiatedRun, setAgentRunId, triggerTitleGeneration, setBillingData, setShowBillingAlert, setAgentLimitData, setShowAgentLimitDialog]);

  const handleAdaptiveDecisionOutcome = useCallback(async (decision: AdaptiveDecision, originalMessage: string, submitOptions?: { model_name?: string; hidden?: boolean }) => {
    console.log('[Adaptive] Handling decision outcome:', decision);
    
    if (!decision) {
      console.warn('[Adaptive] No decision provided, clearing prompt');
      setAdaptivePrompt(null);
      return;
    }

    // Handle agent_needed - auto-start the agent
    if (decision.state === 'agent_needed') {
      console.log('[Adaptive] Agent needed - auto-starting agent');
      
      // Preserve adaptive mode when agent starts (same as chat mode preservation)
      userSelectedModeRef.current = 'adaptive';
      setInitialChatMode('adaptive');
      
      if (decision.agent_preface) {
        const prefaceMessage: UnifiedMessage = {
          message_id: `adaptive-preface-${Date.now()}`,
          thread_id: threadId,
          type: 'assistant',
          is_llm_message: true,
          content: JSON.stringify({ content: decision.agent_preface }),
          metadata: JSON.stringify({ chat_mode: 'adaptive', source: 'preface' }),
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };

        setMessages((prev) => [...prev, prefaceMessage]);

        try {
          await addAssistantMessageMutation.mutateAsync({
            threadId,
            content: decision.agent_preface,
            metadata: { chat_mode: 'adaptive', source: 'preface' },
          });
        } catch (error) {
          console.error('[Adaptive] Failed to persist adaptive preface:', error);
        }
      }

      // Clear any existing prompt before starting agent
      setAdaptivePrompt(null);
      
      try {
        await startAgentFromAdaptiveDecision(submitOptions);
        console.log('[Adaptive] Agent started successfully');
      } catch (error) {
        console.error('[Adaptive] Failed to start agent:', error);
        toast.error('Failed to start agent. Please try again.');
      }
      return;
    }

    // Handle ask_user - show prompt to user
    if (decision.state === 'ask_user' && decision.ask_user) {
      console.log('[Adaptive] Asking user for confirmation:', decision.ask_user);
      // Preserve adaptive mode when showing prompt
      userSelectedModeRef.current = 'adaptive';
      setInitialChatMode('adaptive');
      setAdaptivePrompt({
        prompt: decision.ask_user.prompt,
        yesLabel: decision.ask_user.yes_label || 'Yes',
        noLabel: decision.ask_user.no_label || "I'm fine",
        message: originalMessage,
        reason: decision.reason,
        options: submitOptions,
      });
      return;
    }

    // Handle agent_not_needed - just clear prompt
    if (decision.state === 'agent_not_needed') {
      console.log('[Adaptive] Agent not needed, clearing prompt');
      // Preserve adaptive mode even when agent not needed
      userSelectedModeRef.current = 'adaptive';
      setInitialChatMode('adaptive');
      setAdaptivePrompt(null);
      return;
    }

    // Fallback - clear prompt
    console.warn('[Adaptive] Unknown decision state, clearing prompt:', decision.state);
    setAdaptivePrompt(null);
  }, [threadId, setMessages, addAssistantMessageMutation, startAgentFromAdaptiveDecision]);

  const handleSubmitMessage = useCallback(
    async (
      message: string,
      options?: { model_name?: string; chat_mode?: ChatMode; hidden?: boolean },
    ) => {
      if (!message.trim()) return;
      setIsSending(true);

      const optimisticUserMessage: UnifiedMessage = {
        message_id: `temp-${Date.now()}`,
        thread_id: threadId,
        type: 'user',
        is_llm_message: false,
        content: message,
        metadata: JSON.stringify({ hidden: options?.hidden || false }),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      // Add optimistic "Hmm..." message to show immediate responsiveness
      const optimisticHmmMessage: UnifiedMessage = {
        message_id: `hmm-${Date.now()}`,
        thread_id: threadId,
        type: 'assistant',
        is_llm_message: true,
        content: JSON.stringify({
          content: 'HMM_THINKING_MESSAGE',
          metadata: { is_optimistic: true, is_thinking: true }
        }),
        metadata: JSON.stringify({ is_optimistic: true, is_thinking: true }),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      setMessages((prev) => [...prev, optimisticUserMessage, optimisticHmmMessage]);
      setNewMessage('');

      // Auto-scroll to bottom when user sends a message
      setTimeout(() => {
        if (scrollContainerRef.current) {
          scrollContainerRef.current.scrollTo({ top: 0, behavior: 'smooth' });
          setFollowNewMessages(true);
        }
      }, 100);

      // Fallback: Remove Hmm message after 10 seconds if no response comes
      const hmmTimeout = setTimeout(() => {
        setMessages((prev) => 
          prev.filter((m) => m.message_id !== optimisticHmmMessage.message_id)
        );
      }, 10000);

      try {
        const persistMessagePromise = addUserMessageMutation.mutateAsync({
          threadId,
          message,
        });

        const runFastMode = async (mode: 'chat' | 'adaptive') => {
          setIsSimpleChatLoading(true);

          const assistantMessageId = `assistant-${Date.now()}`;
          const assistantMessage: UnifiedMessage = {
            message_id: assistantMessageId,
            thread_id: threadId,
            type: 'assistant',
            is_llm_message: true,
            content: JSON.stringify({ content: '' }),
            metadata: JSON.stringify({ chat_mode: mode, is_streaming: true }),
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          };

          setMessages((prev) => [...prev, assistantMessage]);

          try {
            const response =
              mode === 'adaptive'
                ? await adaptiveChat(message)
                : await fastGeminiChat(message);

            const finalContent = response.response?.trim() || 'No response provided.';
            const metadataPayload: Record<string, any> = {
              chat_mode: mode,
              is_streaming: false,
              ...(mode === 'adaptive' && 'decision' in response ? { decision: response.decision } : {}),
            };

            setMessages((prev) =>
              prev.map((m) =>
                m.message_id === assistantMessageId
                  ? {
                      ...m,
                      content: JSON.stringify({ content: finalContent }),
                      metadata: JSON.stringify(metadataPayload),
                    }
                  : m,
              ),
            );

            try {
              await addAssistantMessageMutation.mutateAsync({
                threadId,
                content: finalContent,
                metadata: metadataPayload,
              });
            } catch (error) {
              console.error('Failed to persist assistant response:', error);
            }

            queryClient.invalidateQueries({ queryKey: sidebarThreadKeys.lists() });

            if (mode === 'adaptive' && 'decision' in response) {
              // Don't clear prompt here - let handleAdaptiveDecisionOutcome manage it
              const adaptiveResponse = response as AdaptiveChatResponse;
              await handleAdaptiveDecisionOutcome(adaptiveResponse.decision, message, options);
            } else {
              setAdaptivePrompt(null);
            }
          } catch (error) {
            console.error('Fast chat error:', error);
            toast.error(error instanceof Error ? error.message : 'Chat error');
            setMessages((prev) =>
              prev.filter((msg) => msg.message_id !== assistantMessageId),
            );
          } finally {
            setIsSimpleChatLoading(false);
          }
        };

        if (options?.chat_mode === 'chat' || options?.chat_mode === 'adaptive') {
          setMessages((prev) =>
            prev.filter((m) => m.message_id !== optimisticHmmMessage.message_id),
          );
          clearTimeout(hmmTimeout);

          // Preserve the selected mode (same as chat mode)
          if (options.chat_mode === 'adaptive') {
            userSelectedModeRef.current = 'adaptive';
            setInitialChatMode('adaptive');
          }

          await persistMessagePromise;
          await runFastMode(options.chat_mode);
          return;
        }

        // Handle Execute Mode - Normal agent run
        const agentPromise = startAgentMutation.mutateAsync({
          threadId,
          options: {
            ...options,
            agent_id: selectedAgentId,
          },
        });

        const results = await Promise.allSettled([
          persistMessagePromise,
          agentPromise,
        ]);

        if (results[0].status === 'rejected') {
          const reason = results[0].reason;
          console.error('Failed to send message:', reason);
          throw new Error(
            `Failed to send message: ${reason?.message || reason}`,
          );
        }

        if (results[1].status === 'rejected') {
          const error = results[1].reason;
          console.error('Failed to start agent:', error);

          if (error instanceof BillingError) {
            setBillingData({
              currentUsage: error.detail.currentUsage as number | undefined,
              limit: error.detail.limit as number | undefined,
              message:
                error.detail.message ||
                'Monthly usage limit reached. Please upgrade.',
              accountId: null,
            });
            setShowBillingAlert(true);

            setMessages((prev) =>
              prev.filter(
                (m) => m.message_id !== optimisticUserMessage.message_id && m.message_id !== optimisticHmmMessage.message_id,
              ),
            );
            clearTimeout(hmmTimeout);
            return;
          }

          if (error instanceof AgentRunLimitError) {
            const { running_thread_ids, running_count } = error.detail;

            setAgentLimitData({
              runningCount: running_count,
              runningThreadIds: running_thread_ids,
            });
            setShowAgentLimitDialog(true);

            setMessages((prev) =>
              prev.filter(
                (m) => m.message_id !== optimisticUserMessage.message_id && m.message_id !== optimisticHmmMessage.message_id,
              ),
            );
            clearTimeout(hmmTimeout);
            return;
          }

          if (error instanceof ProjectLimitError) {
            setBillingData({
              currentUsage: error.detail.current_count as number,
              limit: error.detail.limit as number,
              message:
                error.detail.message ||
                `You've reached your project limit (${error.detail.current_count}/${error.detail.limit}). Please upgrade to create more projects.`,
              accountId: null,
            });
            setShowBillingAlert(true);

            setMessages((prev) =>
              prev.filter(
                (m) => m.message_id !== optimisticUserMessage.message_id && m.message_id !== optimisticHmmMessage.message_id,
              ),
            );
            clearTimeout(hmmTimeout);
            return;
          }

          throw new Error(`Failed to start agent: ${error?.message || error}`);
        }

        const agentResult = results[1].value;
        setUserInitiatedRun(true);
        setAgentRunId(agentResult.agent_run_id);
        
        // Trigger title generation for agent mode only
        triggerTitleGeneration();
        
        // Clear the Hmm timeout since we got a successful response
        clearTimeout(hmmTimeout);
      } catch (err) {
        console.error('Error sending message or starting agent:', err);
        if (
          !(err instanceof BillingError) &&
          !(err instanceof AgentRunLimitError)
        ) {
          toast.error(err instanceof Error ? err.message : 'Operation failed');
        }
        setMessages((prev) =>
          prev.filter((m) => m.message_id !== optimisticUserMessage.message_id && m.message_id !== optimisticHmmMessage.message_id),
        );
        clearTimeout(hmmTimeout);
      } finally {
        setIsSending(false);
      }
    },
    [
      threadId,
      project?.account_id,
      addUserMessageMutation,
      addAssistantMessageMutation,
      startAgentMutation,
      setMessages,
      setBillingData,
      setShowBillingAlert,
      setAgentRunId,
      setAgentLimitData,
      setShowAgentLimitDialog,
      queryClient,
      handleAdaptiveDecisionOutcome,
    ],
  );

  const handleStopAgent = useCallback(async () => {
    const runIdToStop = agentRunId;

    setAgentStatus('idle');
    setAgentRunId(null);
    setUserInitiatedRun(false);
    lastStreamStartedRef.current = null;

    try {
      await stopStreaming();
    } catch (error) {
      console.error('Error while stopping stream:', error);
    }

    if (runIdToStop) {
      try {
        await stopAgentMutation.mutateAsync(runIdToStop);
      } catch (error) {
        console.error('Error stopping agent:', error);
      }
    }
  }, [
    agentRunId,
    stopStreaming,
    stopAgentMutation,
    setAgentStatus,
    setAgentRunId,
    setUserInitiatedRun,
  ]);

  const handleSendAdaptiveInput = useCallback(async (message: string) => {
    if (!agentRunId) {
      console.error('Cannot send adaptive input: no agent run ID');
      return;
    }

    try {
      await sendAdaptiveInputMutation.mutateAsync({
        agentRunId,
        message,
        threadId,
      });
      setNewMessage('');
      toast.success('Message sent to agent');
    } catch (error) {
      console.error('Error sending adaptive input:', error);
      toast.error('Failed to send message to agent');
    }
  }, [agentRunId, threadId, sendAdaptiveInputMutation]);

  const handleOpenFileViewer = useCallback(
    (filePath?: string, filePathList?: string[]) => {
      if (filePath) {
        setFileToView(filePath);
      } else {
        setFileToView(null);
      }
      setFilePathList(filePathList);
      setFileViewerOpen(true);
    },
    [],
  );

  const handleAdaptivePromptConfirm = useCallback(async () => {
    if (!adaptivePrompt) {
      console.warn('[Adaptive] Confirm clicked but no prompt available');
      return;
    }
    
    console.log('[Adaptive] User confirmed - starting agent with options:', adaptivePrompt.options);
    const options = adaptivePrompt.options;
    
    // Clear prompt immediately to provide feedback
    setAdaptivePrompt(null);
    
    try {
      await startAgentFromAdaptiveDecision(options);
      console.log('[Adaptive] Agent started successfully after user confirmation');
    } catch (error) {
      console.error('[Adaptive] Failed to start agent after confirmation:', error);
      toast.error('Failed to start agent. Please try again.');
      // Don't restore prompt on error - let user try again if needed
    }
  }, [adaptivePrompt, startAgentFromAdaptiveDecision]);

  const handleAdaptivePromptDecline = useCallback(() => {
    console.log('[Adaptive] User declined - dismissing prompt');
    setAdaptivePrompt(null);
  }, []);

  const toolViewAssistant = useCallback(
    (assistantContent?: string, toolContent?: string) => {
      if (!assistantContent) return null;

      return (
        <div className="space-y-1">
          <div className="text-xs font-medium text-muted-foreground">
            Assistant Message
          </div>
          <div className="rounded-md border bg-muted/50 p-3">
            <div className="text-xs prose prose-xs dark:prose-invert chat-markdown max-w-none">
              {assistantContent}
            </div>
          </div>
        </div>
      );
    },
    [],
  );

  const toolViewResult = useCallback(
    (toolContent?: string, isSuccess?: boolean) => {
      if (!toolContent) return null;

      return (
        <div className="space-y-1">
          <div className="flex justify-between items-center">
            <div className="text-xs font-medium text-white/70">
              Tool Result
            </div>
            <div
              className={`px-2 py-0.5 rounded-full text-xs ${
                isSuccess
                  ? 'bg-green-500/20 text-green-400 border border-green-500/30'
                  : 'bg-red-500/20 text-red-400 border border-red-500/30'
              }`}
            >
              {isSuccess ? 'Success' : 'Failed'}
            </div>
          </div>
          <div className="rounded-2xl border border-white/10 bg-[rgba(10,14,22,0.55)] backdrop-blur-2xl shadow-[0_8px_32px_rgba(0,0,0,0.3),inset_0_1px_0_rgba(255,255,255,0.1)] p-3 relative overflow-hidden">
            {/* Gradient rim */}
            <div aria-hidden="true" className="pointer-events-none absolute inset-0 rounded-2xl" style={{
              background: 'linear-gradient(180deg, rgba(173,216,255,0.18), rgba(255,255,255,0.04) 30%, rgba(150,160,255,0.14) 85%, rgba(255,255,255,0.06))',
              WebkitMask: 'linear-gradient(#000,#000) content-box, linear-gradient(#000,#000)',
              WebkitMaskComposite: 'xor',
              maskComposite: 'exclude',
              padding: '1px',
              borderRadius: '16px'
            }}></div>
            
            {/* Specular streak */}
            <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-0 h-12" style={{
              background: 'linear-gradient(180deg, rgba(255,255,255,0.22), rgba(255,255,255,0.06) 45%, rgba(255,255,255,0) 100%)',
              filter: 'blur(4px)',
              mixBlendMode: 'screen'
            }}></div>
            
            {/* Fine noise */}
            <div aria-hidden="true" className="pointer-events-none absolute inset-0 opacity-20" style={{
              backgroundImage: `url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='60' height='60'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.8' numOctaves='4'/><feColorMatrix type='saturate' values='0'/><feComponentTransfer><feFuncA type='table' tableValues='0 0.03'/></feComponentTransfer></filter><rect width='100%' height='100%' filter='url(%23n)' /></svg>")`,
              backgroundSize: '100px 100px',
              mixBlendMode: 'overlay'
            }}></div>
            
            <div className="text-xs prose prose-xs dark:prose-invert chat-markdown max-w-none text-white/90 relative z-10">
              {toolContent}
            </div>
          </div>
        </div>
      );
    },
    [],
  );

  // Effects
  useEffect(() => {
    if (!initialLayoutAppliedRef.current) {
      setLeftSidebarOpen(false);
      initialLayoutAppliedRef.current = true;
    }
  }, [setLeftSidebarOpen]);

  // Helper function to check if a tool call is create_document
  const isCreateDocumentTool = useCallback((toolCall: ToolCallInput | undefined): boolean => {
    if (!toolCall) return false;
    const toolName = toolCall.assistantCall?.name || '';
    return toolName === 'create-document' || toolName === 'create_document';
  }, []);

  useEffect(() => {
    if (initialLoadCompleted && !initialPanelOpenAttempted) {
      setInitialPanelOpenAttempted(true);

      // Only auto-open when there are tool calls (desktop only, not compact)
      // This is the first tool call in a new chat, so always auto-open
      if (!isMobile && !compact && toolCalls.length > 0) {
        setIsSidePanelOpen(true);
        setCurrentToolIndex(toolCalls.length - 1);
      }
    }
  }, [
    initialPanelOpenAttempted,
    toolCalls,
    initialLoadCompleted,
    setIsSidePanelOpen,
    setCurrentToolIndex,
    isMobile,
    compact,
  ]);

  // Auto-open panel when new tool calls arrive (desktop only, not compact)
  useEffect(() => {
    const prev = previousToolCallCountRef.current;
    const curr = toolCalls.length;
    
    // Reset userClosedPanelRef when a new chat starts (toolCalls goes from 0 to 1)
    if (prev === 0 && curr === 1) {
      userClosedPanelRef.current = false;
    }
    
    // Update the ref for next comparison
    previousToolCallCountRef.current = curr;
    
    if (!isMobile && !compact && !isSidePanelOpen && curr > prev) {
      // Check if user manually closed the panel
      const userClosed = userClosedPanelRef.current;
      
      // Get the latest tool call to check if it's create_document
      const latestToolCall = toolCalls[curr - 1];
      const isCreateDocument = isCreateDocumentTool(latestToolCall);
      
      // Auto-open if:
      // 1. User hasn't manually closed it, OR
      // 2. It's a create_document tool call (exception to the rule)
      if (!userClosed || isCreateDocument) {
        setIsSidePanelOpen(true);
        setCurrentToolIndex(curr - 1);
        // Reset the flag if we auto-opened for create_document
        if (isCreateDocument && userClosed) {
          userClosedPanelRef.current = false;
        }
      }
    }
  }, [toolCalls, isSidePanelOpen, isMobile, compact, setIsSidePanelOpen, setCurrentToolIndex, isCreateDocumentTool]);

  useEffect(() => {
    // Prevent duplicate streaming calls for the same runId
    if (agentRunId && lastStreamStartedRef.current === agentRunId) {
      return;
    }

    // Start streaming if user initiated a run (don't wait for initialLoadCompleted for first-time users)
    if (agentRunId && agentRunId !== currentHookRunId && userInitiatedRun) {
      console.log(`[ThreadComponent] Starting user-initiated stream for runId: ${agentRunId}`);
      startStreaming(agentRunId);
      lastStreamStartedRef.current = agentRunId; // Track that we started this runId
      setUserInitiatedRun(false); // Reset flag after starting
      return;
    }

    // Only auto-start streaming on page load if we know the agent is currently running
    if (
      agentRunId &&
      agentRunId !== currentHookRunId &&
      initialLoadCompleted &&
      !userInitiatedRun &&
      agentStatus === 'running'
    ) {
      console.log(`[ThreadComponent] Starting auto stream for runId: ${agentRunId}`);
      startStreaming(agentRunId);
      lastStreamStartedRef.current = agentRunId; // Track that we started this runId
    }
  }, [
    agentRunId,
    startStreaming,
    currentHookRunId,
    initialLoadCompleted,
    userInitiatedRun,
    agentStatus,
  ]);

  useEffect(() => {
    if (
      (streamHookStatus === 'completed' ||
        streamHookStatus === 'stopped' ||
        streamHookStatus === 'agent_not_running' ||
        streamHookStatus === 'error') &&
      (agentStatus === 'running' || agentStatus === 'connecting')
    ) {
      setAgentStatus('idle');
      setAgentRunId(null);
      // Reset the stream tracking ref when stream completes
      lastStreamStartedRef.current = null;
    }
  }, [streamHookStatus, agentStatus, setAgentStatus, setAgentRunId]);

  // Reset stream tracking ref when threadId changes  
  useEffect(() => {
    lastStreamStartedRef.current = null;
  }, [threadId]);

  // SEO title update
  useEffect(() => {
    if (projectName) {
      document.title = `${projectName}`;

      const metaDescription = document.querySelector(
        'meta[name="description"]',
      );
      if (metaDescription) {
        metaDescription.setAttribute(
          'content',
          `${projectName} - Interactive agent conversation powered by Iris`,
        );
      }

      const ogTitle = document.querySelector('meta[property="og:title"]');
      if (ogTitle) {
        ogTitle.setAttribute('content', `${projectName}`);
      }

      const ogDescription = document.querySelector(
        'meta[property="og:description"]',
      );
      if (ogDescription) {
        ogDescription.setAttribute(
          'content',
          `Interactive AI conversation for ${projectName}`,
        );
      }
    }
  }, [projectName]);

  useEffect(() => {
    const debugParam = searchParams.get('debug');
    setDebugMode(debugParam === 'true');
  }, [searchParams]);


  // Simple chat mode - no special handling needed since conversation is already complete

  const hasCheckedUpgradeDialog = useRef(false);

  useEffect(() => {
    if (
      initialLoadCompleted &&
      subscriptionData &&
      !hasCheckedUpgradeDialog.current
    ) {
      hasCheckedUpgradeDialog.current = true;
      const hasSeenUpgradeDialog = localStorage.getItem(
        'iris_upgrade_dialog_displayed',
      );
      const isFreeTier = subscriptionStatus === 'no_subscription';
      if (!hasSeenUpgradeDialog && isFreeTier && !isLocalMode()) {
        setShowUpgradeDialog(true);
      }
    }
  }, [subscriptionData, subscriptionStatus, initialLoadCompleted]);

  const handleDismissUpgradeDialog = () => {
    setShowUpgradeDialog(false);
    localStorage.setItem('iris_upgrade_dialog_displayed', 'true');
  };

  useEffect(() => {
    if (streamingToolCall) {
      handleStreamingToolCall(streamingToolCall);
    }
  }, [streamingToolCall, handleStreamingToolCall]);

  useEffect(() => {
    setIsSidePanelAnimating(true);
    const timer = setTimeout(() => setIsSidePanelAnimating(false), 200); // Match transition duration
    return () => clearTimeout(timer);
  }, [isSidePanelOpen]);

  // Scroll detection for show/hide scroll-to-bottom button
  useEffect(() => {
    const handleScroll = () => {
      if (!scrollContainerRef.current) return;

      const scrollTop = scrollContainerRef.current.scrollTop;
      const scrollHeight = scrollContainerRef.current.scrollHeight;
      const clientHeight = scrollContainerRef.current.clientHeight;
      const threshold = 100;

      // With flex-column-reverse, scrollTop becomes NEGATIVE when scrolling up
      // Show button when scrollTop < -threshold (scrolled up enough from bottom)
      const shouldShow = scrollTop < -threshold && scrollHeight > clientHeight;
      setShowScrollToBottom(shouldShow);
      
      // Track if user is at bottom (within threshold)
      const atBottom = scrollTop >= -threshold;
      setIsUserAtBottom(atBottom);
      if (!atBottom) {
        // User scrolled up; stop following new messages
        if (followNewMessages) setFollowNewMessages(false);
      } else {
        // User returned to bottom; resume following
        if (!followNewMessages) setFollowNewMessages(true);
      }
      
      // Reset new message count when user scrolls to bottom
      if (atBottom && newMessageCount > 0) {
        setNewMessageCount(0);
      }
    };

    const scrollContainer = scrollContainerRef.current;
    if (scrollContainer) {
      scrollContainer.addEventListener('scroll', handleScroll, {
        passive: true,
      });
      // Check initial state
      setTimeout(() => handleScroll(), 100);

      return () => {
        scrollContainer.removeEventListener('scroll', handleScroll);
      };
    }
  }, [messages, initialLoadCompleted, newMessageCount, followNewMessages]);

  if (!initialLoadCompleted || isLoading) {
    return <ThreadSkeleton isSidePanelOpen={isSidePanelOpen} compact={compact} />;
  }

  if (error) {
    return (
      <ThreadLayout
        threadId={threadId}
        projectName={projectName}
        projectId={project?.id || ''}
        project={project}
        sandboxId={sandboxId}
        isSidePanelOpen={isSidePanelOpen}
        onToggleSidePanel={toggleSidePanel}
        onViewFiles={handleOpenFileViewer}
        fileViewerOpen={fileViewerOpen}
        setFileViewerOpen={setFileViewerOpen}
        fileToView={fileToView}
        filePathList={filePathList}
        toolCalls={toolCalls}
        messages={messages as ApiMessageType[]}
        externalNavIndex={externalNavIndex}
        agentStatus={agentStatus}
        currentToolIndex={currentToolIndex}
        onSidePanelNavigate={handleSidePanelNavigate}
        onSidePanelClose={() => {
          setIsSidePanelOpen(false);
          userClosedPanelRef.current = true;
          setAutoOpenedPanel(true);
        }}
        renderAssistantMessage={toolViewAssistant}
        renderToolResult={toolViewResult}
        isLoading={!initialLoadCompleted || isLoading}
        showBillingAlert={showBillingAlert}
        billingData={billingData}
        onDismissBilling={() => setShowBillingAlert(false)}
        debugMode={debugMode}
        isMobile={isMobile}
        initialLoadCompleted={initialLoadCompleted}
        agentName={agent && agent.name}
        onSubmit={handleSubmitMessage}
        isAgentRunning={agentStatus === 'running' || agentStatus === 'connecting'}
        selectedModel={selectedModel}
        getActualModelId={getActualModelId}
        selectedAgentId={selectedAgentId}
        chatMode={initialChatMode}
        onPopulateChatInput={handlePopulateChatInput}
      >
        <ThreadError error={error} />
      </ThreadLayout>
    );
  }

  const adaptivePromptBubble = adaptivePrompt ? (
    <div className="w-full pointer-events-auto">
      <div 
        className="relative rounded-[32px] bg-[rgba(255,255,255,0.25)] dark:bg-[rgba(10,14,22,0.55)] backdrop-blur-2xl py-5 px-4 space-y-3 overflow-hidden min-h-0"
        style={{ 
          animation: 'breathe-3d 3s ease-in-out infinite',
          transform: 'translateY(0px)'
        }}
      >
        {/* Dark mode gradient rim - inset only */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 rounded-[32px] dark:opacity-100 opacity-0"
          style={{
            background: 'linear-gradient(180deg, rgba(173,216,255,0.18), rgba(255,255,255,0.04) 30%, rgba(150,160,255,0.14) 85%, rgba(255,255,255,0.06))',
            WebkitMask: 'linear-gradient(#000,#000) content-box, linear-gradient(#000,#000)',
            WebkitMaskComposite: 'xor',
            maskComposite: 'exclude',
            padding: '1px',
            borderRadius: '32px',
            clipPath: 'inset(0)'
          }}
        />
        {/* Light mode gradient rim - inset only */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 rounded-[32px] light:opacity-100 dark:opacity-0"
          style={{
            background: 'linear-gradient(180deg, rgba(0,0,0,0.06), rgba(0,0,0,0.02) 30%, rgba(0,0,0,0.05) 85%, rgba(0,0,0,0.03))',
            WebkitMask: 'linear-gradient(#000,#000) content-box, linear-gradient(#000,#000)',
            WebkitMaskComposite: 'xor',
            maskComposite: 'exclude',
            padding: '1px',
            borderRadius: '32px',
            clipPath: 'inset(0)'
          }}
        />
        {/* Dark mode specular streak */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 top-0 h-16 dark:opacity-100 opacity-0"
          style={{
            background: 'linear-gradient(180deg, rgba(255,255,255,0.22), rgba(255,255,255,0.06) 45%, rgba(255,255,255,0) 100%)',
            filter: 'blur(6px)',
            mixBlendMode: 'screen'
          }}
        />
        {/* Light mode specular streak */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 top-0 h-16 light:opacity-100 dark:opacity-0"
          style={{
            background: 'linear-gradient(180deg, rgba(0,0,0,0.08), rgba(0,0,0,0.03) 45%, rgba(0,0,0,0) 100%)',
            filter: 'blur(6px)',
            mixBlendMode: 'screen'
          }}
        />
        {/* Fine noise */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 opacity-20"
          style={{
            backgroundImage: `url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='60' height='60'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.8' numOctaves='4'/><feColorMatrix type='saturate' values='0'/><feComponentTransfer><feFuncA type='table' tableValues='0 0.03'/></feComponentTransfer></filter><rect width='100%' height='100%' filter='url(%23n)' /></svg>")`,
            backgroundSize: '100px 100px',
            mixBlendMode: 'overlay'
          }}
        />
        
        <div className="relative z-10 space-y-3 w-full">
          <div className="w-full">
            <p className="text-sm font-medium text-white/90 dark:text-white/90 light:text-zinc-900 break-words">{adaptivePrompt.prompt}</p>
            {adaptivePrompt.reason && (
              <div className="text-xs text-white/70 mt-1.5 light:text-zinc-600 dark:text-white/70 break-words whitespace-pre-line">
                {adaptivePrompt.reason}
              </div>
            )}
          </div>
          <div className="flex gap-2 pb-2">
            <button
              type="button"
              className="flex-1 group relative rounded-xl border border-green-500/10 dark:border-green-500/10 light:border-white/10 bg-green-500/5 dark:bg-green-500/5 light:bg-[rgba(255,255,255,0.15)] backdrop-blur-sm py-2 px-3 text-xs font-medium text-white/90 dark:text-white/90 light:text-zinc-900 shadow-lg hover:bg-green-500/10 dark:hover:bg-green-500/10 light:hover:bg-green-500/30 transition-all duration-200 cursor-pointer flex items-center justify-center gap-1.5 overflow-hidden"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                handleAdaptivePromptConfirm();
              }}
            >
              {/* Button gradient rim on hover */}
              <div
                aria-hidden="true"
                className="pointer-events-none absolute inset-0 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity dark:opacity-0 light:opacity-0"
                style={{
                  background: 'linear-gradient(180deg, rgba(34,197,94,0.15), rgba(34,197,94,0.05) 30%, rgba(34,197,94,0.1) 85%, rgba(34,197,94,0.08))',
                  WebkitMask: 'linear-gradient(#000,#000) content-box, linear-gradient(#000,#000)',
                  WebkitMaskComposite: 'xor',
                  maskComposite: 'exclude',
                  padding: '1px',
                  borderRadius: '12px'
                }}
              />
              {/* Light mode gradient rim on hover */}
              <div
                aria-hidden="true"
                className="pointer-events-none absolute inset-0 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity light:opacity-0 dark:opacity-0"
                style={{
                  background: 'linear-gradient(180deg, rgba(34,197,94,0.12), rgba(34,197,94,0.04) 30%, rgba(34,197,94,0.08) 85%, rgba(34,197,94,0.06))',
                  WebkitMask: 'linear-gradient(#000,#000) content-box, linear-gradient(#000,#000)',
                  WebkitMaskComposite: 'xor',
                  maskComposite: 'exclude',
                  padding: '1px',
                  borderRadius: '12px'
                }}
              />
              <Check className="w-3.5 h-3.5 text-green-500/70 dark:text-green-500/70 light:text-green-600/80 relative z-10" />
              <span className="relative z-10">{adaptivePrompt.yesLabel}</span>
            </button>
            <button
              type="button"
              className="flex-1 group relative rounded-xl border border-red-500/10 dark:border-red-500/10 light:border-white/10 bg-red-500/5 dark:bg-red-500/5 light:bg-[rgba(255,255,255,0.15)] backdrop-blur-sm py-2 px-3 text-xs font-medium text-white/90 dark:text-white/90 light:text-zinc-900 shadow-lg hover:bg-red-500/10 dark:hover:bg-red-500/10 light:hover:bg-red-500/30 transition-all duration-200 cursor-pointer flex items-center justify-center gap-1.5 overflow-hidden"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                handleAdaptivePromptDecline();
              }}
            >
              {/* Button gradient rim on hover */}
              <div
                aria-hidden="true"
                className="pointer-events-none absolute inset-0 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity dark:opacity-0 light:opacity-0"
                style={{
                  background: 'linear-gradient(180deg, rgba(239,68,68,0.15), rgba(239,68,68,0.05) 30%, rgba(239,68,68,0.1) 85%, rgba(239,68,68,0.08))',
                  WebkitMask: 'linear-gradient(#000,#000) content-box, linear-gradient(#000,#000)',
                  WebkitMaskComposite: 'xor',
                  maskComposite: 'exclude',
                  padding: '1px',
                  borderRadius: '12px'
                }}
              />
              {/* Light mode gradient rim on hover */}
              <div
                aria-hidden="true"
                className="pointer-events-none absolute inset-0 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity light:opacity-0 dark:opacity-0"
                style={{
                  background: 'linear-gradient(180deg, rgba(239,68,68,0.12), rgba(239,68,68,0.04) 30%, rgba(239,68,68,0.08) 85%, rgba(239,68,68,0.06))',
                  WebkitMask: 'linear-gradient(#000,#000) content-box, linear-gradient(#000,#000)',
                  WebkitMaskComposite: 'xor',
                  maskComposite: 'exclude',
                  padding: '1px',
                  borderRadius: '12px'
                }}
              />
              <X className="w-3.5 h-3.5 text-red-500/70 dark:text-red-500/70 light:text-red-600/80 relative z-10" />
              <span className="relative z-10">{adaptivePrompt.noLabel}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  ) : null;

  if (compact) {
    return (
      <>
        <ThreadLayout
          threadId={threadId}
          projectName={projectName}
          projectId={project?.id || ''}
          project={project}
          sandboxId={sandboxId}
          isSidePanelOpen={isSidePanelOpen}
          onToggleSidePanel={toggleSidePanel}
          onProjectRenamed={handleProjectRenamed}
          onViewFiles={handleOpenFileViewer}
          fileViewerOpen={fileViewerOpen}
          setFileViewerOpen={setFileViewerOpen}
          fileToView={fileToView}
          filePathList={filePathList}
          toolCalls={toolCalls}
          messages={messages as ApiMessageType[]}
          externalNavIndex={externalNavIndex}
          agentStatus={agentStatus}
          currentToolIndex={currentToolIndex}
          onSidePanelNavigate={handleSidePanelNavigate}
          onSidePanelClose={() => {
            setIsSidePanelOpen(false);
            userClosedPanelRef.current = true;
            setAutoOpenedPanel(true);
          }}
          renderAssistantMessage={toolViewAssistant}
          renderToolResult={toolViewResult}
          isLoading={!initialLoadCompleted || isLoading}
          showBillingAlert={showBillingAlert}
          billingData={billingData}
          onDismissBilling={() => setShowBillingAlert(false)}
          debugMode={debugMode}
          isMobile={isMobile}
          initialLoadCompleted={initialLoadCompleted}
          agentName={agent && agent.name}
          disableInitialAnimation={!initialLoadCompleted && toolCalls.length > 0}
          compact={true}
          onSubmit={handleSubmitMessage}
          isAgentRunning={agentStatus === 'running' || agentStatus === 'connecting'}
          selectedModel={selectedModel}
          getActualModelId={getActualModelId}
          selectedAgentId={selectedAgentId}
          chatMode={initialChatMode}
          onPopulateChatInput={handlePopulateChatInput}
        >
          {/* Thread Content - Scrollable */}
          <div 
            ref={scrollContainerRef}
            className="flex-1 overflow-y-auto overflow-x-hidden flex flex-col-reverse"
          >
            <div className="flex-shrink-0">
              <ThreadContent
                messages={messages}
                streamingTextContent={streamingTextContent}
                streamingToolCall={streamingToolCall}
                agentStatus={agentStatus}
                handleToolClick={handleToolClick}
                handleOpenFileViewer={handleOpenFileViewer}
                readOnly={false}
                streamHookStatus={streamHookStatus}
                sandboxId={sandboxId}
                project={project}
                debugMode={debugMode}
                agentName={agent && agent.name}
                agentAvatar={undefined}
                agentMetadata={agent?.metadata}
                agentData={agent}
                scrollContainerRef={scrollContainerRef}
                isPreviewMode={true}
                isSimpleChatLoading={isSimpleChatLoading}
                adaptivePromptBubble={adaptivePromptBubble}
              />
            </div>
          </div>

          {/* Compact Chat Input */}
          <div className="flex-shrink-0 border-t border-border/20 bg-background p-4">
            <ChatInput
              value={newMessage}
              onChange={setNewMessage}
              onSubmit={handleSubmitMessage}
              placeholder={`Describe what you need help with...`}
              loading={isSending}
              disabled={
                isSending ||
                agentStatus === 'running' ||
                agentStatus === 'connecting'
              }
              isAgentRunning={
                agentStatus === 'running' || agentStatus === 'connecting'
              }
              onStopAgent={handleStopAgent}
              onSendAdaptiveInput={handleSendAdaptiveInput}
              agentRunId={agentRunId || undefined}
              autoFocus={!isLoading}
              enableAdvancedConfig={false}
              onFileBrowse={handleOpenFileViewer}
              sandboxId={sandboxId || undefined}
              messages={messages}
              agentName={agent && agent.name}
              selectedAgentId={selectedAgentId}
              onAgentSelect={handleAgentSelect}
              hideAgentSelection={!!configuredAgentId}
              toolCalls={toolCalls}
              toolCallIndex={currentToolIndex}
              showToolPreview={!isSidePanelOpen && toolCalls.length > 0}
              onExpandToolPreview={() => {
                setIsSidePanelOpen(true);
                userClosedPanelRef.current = false;
              }}
              defaultShowSnackbar="tokens"
              showScrollToBottomIndicator={showScrollToBottom}
              onScrollToBottom={scrollToBottom}
              onScrollToTop={scrollToTop}
              initialChatMode={initialChatMode}
              onChatModeChange={handleChatModeChange}
            />
          </div>
        </ThreadLayout>

        <UpgradeDialog
          open={showUpgradeDialog}
          onOpenChange={setShowUpgradeDialog}
          onDismiss={handleDismissUpgradeDialog}
        />

        {agentLimitData && (
          <AgentRunLimitDialog
            open={showAgentLimitDialog}
            onOpenChange={setShowAgentLimitDialog}
            runningCount={agentLimitData.runningCount}
            runningThreadIds={agentLimitData.runningThreadIds}
            projectId={projectId}
          />
        )}
      </>
    );
  }

  // Full layout version for dedicated thread pages
  return (
    <>
      <ThreadLayout
        threadId={threadId}
        projectName={projectName}
        projectId={project?.id || ''}
        project={project}
        sandboxId={sandboxId}
        isSidePanelOpen={isSidePanelOpen}
        onToggleSidePanel={toggleSidePanel}
        onProjectRenamed={handleProjectRenamed}
        onViewFiles={handleOpenFileViewer}
        fileViewerOpen={fileViewerOpen}
        setFileViewerOpen={setFileViewerOpen}
        fileToView={fileToView}
        filePathList={filePathList}
        toolCalls={toolCalls}
        messages={messages as ApiMessageType[]}
        externalNavIndex={externalNavIndex}
        agentStatus={agentStatus}
        currentToolIndex={currentToolIndex}
        onSidePanelNavigate={handleSidePanelNavigate}
        onSidePanelClose={() => {
          setIsSidePanelOpen(false);
          userClosedPanelRef.current = true;
          setAutoOpenedPanel(true);
        }}
        renderAssistantMessage={toolViewAssistant}
        renderToolResult={toolViewResult}
        isLoading={!initialLoadCompleted || isLoading}
        showBillingAlert={showBillingAlert}
        billingData={billingData}
        onDismissBilling={() => setShowBillingAlert(false)}
        debugMode={debugMode}
        isMobile={isMobile}
        initialLoadCompleted={initialLoadCompleted}
        agentName={agent && agent.name}
        disableInitialAnimation={!initialLoadCompleted && toolCalls.length > 0}
        onSubmit={handleSubmitMessage}
        isAgentRunning={agentStatus === 'running' || agentStatus === 'connecting'}
        selectedModel={selectedModel}
        getActualModelId={getActualModelId}
        selectedAgentId={selectedAgentId}
        chatMode={initialChatMode}
        onPopulateChatInput={handlePopulateChatInput}
      >
        <ThreadContent
          messages={messages}
          streamingTextContent={streamingTextContent}
          streamingToolCall={streamingToolCall}
          agentStatus={agentStatus}
          handleToolClick={handleToolClick}
          handleOpenFileViewer={handleOpenFileViewer}
          readOnly={false}
          streamHookStatus={streamHookStatus}
          sandboxId={sandboxId}
          project={project}
          debugMode={debugMode}
          agentName={agent && agent.name}
          agentAvatar={undefined}
          agentMetadata={agent?.metadata}
          agentData={agent}
          scrollContainerRef={scrollContainerRef}
          isSimpleChatLoading={isSimpleChatLoading}
          adaptivePromptBubble={adaptivePromptBubble}
        />

        {/* Floating Tool Preview - Right Side Square */}
        {!isMobile && toolCalls.length > 0 && (
          <FloatingToolPreview
            toolCalls={toolCalls}
            currentIndex={currentToolIndex}
            onExpand={() => {
              setIsSidePanelOpen(true);
              userClosedPanelRef.current = false;
            }}
            agentName={agent && agent.name}
            isVisible={!isSidePanelOpen}
            agentStatus={agentStatus}
            agentRunId={agentRunId || undefined}
            threadId={threadId}
          />
        )}

        <div
          className={cn(
            'fixed bottom-0 z-10 bg-gradient-to-t from-background via-background/90 to-transparent px-4 pt-8 pb-5',
            isSidePanelAnimating
              ? ''
              : 'transition-all duration-200 ease-in-out',
            leftSidebarState === 'expanded'
              ? 'left-[72px] md:left-[256px]'
              : 'left-[40px]',
            isSidePanelOpen && !isMobile
              ? 'right-[90%] sm:right-[450px] md:right-[500px] lg:right-[550px] xl:right-[650px]'
              : 'right-0',
            isMobile ? 'left-0 right-0' : '',
          )}
        >
          <div className={cn('mx-auto', isMobile ? 'w-full' : 'max-w-3xl')}>
            <ChatInput
              value={newMessage}
              onChange={setNewMessage}
              onSubmit={handleSubmitMessage}
              placeholder={`Describe what you need help with...`}
              loading={isSending}
              disabled={
                isSending ||
                agentStatus === 'running' ||
                agentStatus === 'connecting'
              }
              isAgentRunning={
                agentStatus === 'running' || agentStatus === 'connecting'
              }
              onStopAgent={handleStopAgent}
              onSendAdaptiveInput={handleSendAdaptiveInput}
              agentRunId={agentRunId || undefined}
              autoFocus={!isLoading}
              enableAdvancedConfig={false}
              onFileBrowse={handleOpenFileViewer}
              sandboxId={sandboxId || undefined}
              messages={messages}
              agentName={agent && agent.name}
              selectedAgentId={selectedAgentId}
              onAgentSelect={handleAgentSelect}
              hideAgentSelection={!!configuredAgentId}
              toolCalls={toolCalls}
              toolCallIndex={currentToolIndex}
              showToolPreview={false}
              onExpandToolPreview={() => {
                setIsSidePanelOpen(true);
                userClosedPanelRef.current = false;
              }}
              defaultShowSnackbar="tokens"
              showScrollToBottomIndicator={showScrollToBottom}
              onScrollToBottom={scrollToBottom}
              onScrollToTop={scrollToTop}
              newMessageCount={newMessageCount}
              initialChatMode={initialChatMode}
              onChatModeChange={handleChatModeChange}
            />
          </div>
        </div>
      </ThreadLayout>

      <UpgradeDialog
        open={showUpgradeDialog}
        onOpenChange={setShowUpgradeDialog}
        onDismiss={handleDismissUpgradeDialog}
      />

      {agentLimitData && (
        <AgentRunLimitDialog
          open={showAgentLimitDialog}
          onOpenChange={setShowAgentLimitDialog}
          runningCount={agentLimitData.runningCount}
          runningThreadIds={agentLimitData.runningThreadIds}
          projectId={projectId}
        />
      )}
    </>
  );
}
