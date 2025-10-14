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
import { useSidebar } from '@/components/ui/sidebar';
import { useAgentStream } from '@/hooks/useAgentStream';
import { cn } from '@/lib/utils';
import { useIsMobile } from '@/hooks/use-mobile';
import { isLocalMode } from '@/lib/config';
import { ThreadContent } from '@/components/thread/content/ThreadContent';
import { ThreadSkeleton } from '@/components/thread/content/ThreadSkeleton';
import { useAddUserMessageMutation, useAddAssistantMessageMutation } from '@/hooks/react-query/threads/use-messages';
import {
  useStartAgentMutation,
  useStopAgentMutation,
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
import { useQueryClient } from '@tanstack/react-query';
import { threadKeys } from '@/hooks/react-query/threads/keys';
import { useProjectRealtime } from '@/hooks/useProjectRealtime';
import { fastGeminiChatStream } from '@/lib/fast-gemini-chat';
import { handleGoogleSlidesUpload } from './tool-views/utils/presentation-utils';

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

  // State
  const [newMessage, setNewMessage] = useState('');
  const [isSending, setIsSending] = useState(false);
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
    isSunaAgent,
  } = useAgentSelection();

  const { data: agentsResponse } = useAgents();
  const agents = agentsResponse?.agents || [];
  const [isSidePanelAnimating, setIsSidePanelAnimating] = useState(false);
  const [userInitiatedRun, setUserInitiatedRun] = useState(false);
  const [showScrollToBottom, setShowScrollToBottom] = useState(false);
  const [showAgentLimitDialog, setShowAgentLimitDialog] = useState(false);
  const [agentLimitData, setAgentLimitData] = useState<{
    runningCount: number;
    runningThreadIds: string[];
  } | null>(null);

  // Refs - simplified for flex-column-reverse
  const latestMessageRef = useRef<HTMLDivElement>(null);
  const initialLayoutAppliedRef = useRef(false);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const lastStreamStartedRef = useRef<string | null>(null); // Track last runId we started streaming for

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

      // Auto-scroll to bottom (top: 0 in flex-col-reverse) when new messages arrive
      setTimeout(() => {
        if (scrollContainerRef.current) {
          scrollContainerRef.current.scrollTo({ top: 0, behavior: 'smooth' });
        }
      }, 100);
    },
    [setMessages, setAutoOpenedPanel],
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

  const handleSubmitMessage = useCallback(
    async (
      message: string,
      options?: { model_name?: string; chat_mode?: 'chat' | 'execute' },
    ) => {
      if (!message.trim()) return;
      setIsSending(true);

      const optimisticUserMessage: UnifiedMessage = {
        message_id: `temp-${Date.now()}`,
        thread_id: threadId,
        type: 'user',
        is_llm_message: false,
        content: message,
        metadata: '{}',
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
        }
      }, 100);

      // Fallback: Remove Hmm message after 10 seconds if no response comes
      const hmmTimeout = setTimeout(() => {
        setMessages((prev) => 
          prev.filter((m) => m.message_id !== optimisticHmmMessage.message_id)
        );
      }, 10000);

      try {
        // Add user message first in both modes
        const messagePromise = addUserMessageMutation.mutateAsync({
          threadId,
          message,
        });

        // Handle Chat Mode - Fast Gemini streaming
        if (options?.chat_mode === 'chat') {
          await messagePromise; // Wait for user message to be saved
          
          // Remove the "Hmm..." message immediately as we'll stream instead
          setMessages((prev) => 
            prev.filter((m) => m.message_id !== optimisticHmmMessage.message_id)
          );
          clearTimeout(hmmTimeout);
          
          // Create assistant message for streaming
          const assistantMessageId = `assistant-${Date.now()}`;
          const assistantMessage: UnifiedMessage = {
            message_id: assistantMessageId,
            thread_id: threadId,
            type: 'assistant',
            is_llm_message: true,
            content: JSON.stringify({ content: '' }),
            metadata: JSON.stringify({ is_streaming: true }),
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          };
          
          setMessages((prev) => [...prev, assistantMessage]);
          
          let streamedContent = '';
          let displayedContent = '';
          let characterQueue: string[] = [];
          let isTyping = false;
          let characterCount = 0;
          
          // Dynamic typewriter effect: Start fast, then accelerate after paragraphs
          const getTypewriterInterval = () => {
            // First ~500 characters: 10ms (super fast start)
            if (characterCount < 500) {
              return 10;
            }
            // After ~500 characters: 1ms (blazing fast, almost instant)
            else {
              return 1;
            }
          };
          
          const typeNextCharacter = () => {
            if (characterQueue.length > 0) {
              const char = characterQueue.shift()!;
              displayedContent += char;
              characterCount++;
              
              setMessages((prev) =>
                prev.map((m) =>
                  m.message_id === assistantMessageId
                    ? {
                        ...m,
                        content: JSON.stringify({ content: displayedContent }),
                        metadata: JSON.stringify({ is_streaming: true }),
                      }
                    : m
                )
              );
              
              if (characterQueue.length > 0) {
                const interval = getTypewriterInterval();
                setTimeout(typeNextCharacter, interval);
              } else {
                isTyping = false;
              }
            } else {
              isTyping = false;
            }
          };
          
          const startTyping = () => {
            if (!isTyping && characterQueue.length > 0) {
              isTyping = true;
              typeNextCharacter();
            }
          };
          
          // Stream response from Fast Gemini
          await fastGeminiChatStream(
            message,
            {
              onChunk: (content) => {
                streamedContent += content;
                
                // Add each character to the queue for typewriter effect
                for (const char of content) {
                  characterQueue.push(char);
                }
                
                // Start typing if not already typing
                startTyping();
              },
              onDone: async (timeMs) => {
                console.log(`Fast Gemini response completed in ${timeMs}ms`);
                
                // Wait for all characters to be typed before marking complete
                const waitForTyping = async () => {
                  if (characterQueue.length > 0 || isTyping) {
                    setTimeout(waitForTyping, 50);
                  } else {
                    // All characters typed, save to database and mark as complete
                    const finalMetadata = { 
                      is_streaming: false, 
                      response_time_ms: timeMs,
                      chat_mode: 'chat' // Mark as chat mode message
                    };
                    
                    // Save assistant message to database
                    try {
                      await addAssistantMessageMutation.mutateAsync({
                        threadId,
                        content: streamedContent,
                        metadata: finalMetadata,
                      });
                      console.log('Assistant message saved to database');
                    } catch (error) {
                      console.error('Failed to save assistant message:', error);
                    }
                    
                    // Update local state
                    setMessages((prev) =>
                      prev.map((m) =>
                        m.message_id === assistantMessageId
                          ? {
                              ...m,
                              content: JSON.stringify({ content: streamedContent }),
                              metadata: JSON.stringify(finalMetadata),
                            }
                          : m
                      )
                    );
                  }
                };
                
                waitForTyping();
              },
              onError: (error) => {
                console.error('Fast Gemini stream error:', error);
                toast.error(`Chat error: ${error}`);
                setMessages((prev) =>
                  prev.filter((m) => m.message_id !== assistantMessageId)
                );
              },
            }
          );
          
          setIsSending(false);
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
          messagePromise,
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
      startAgentMutation,
      setMessages,
      setBillingData,
      setShowBillingAlert,
      setAgentRunId,
    ],
  );

  const handleStopAgent = useCallback(async () => {
    setAgentStatus('idle');

    await stopStreaming();

    if (agentRunId) {
      try {
        await stopAgentMutation.mutateAsync(agentRunId);
      } catch (error) {
        console.error('Error stopping agent:', error);
      }
    }
  }, [stopStreaming, agentRunId, stopAgentMutation, setAgentStatus]);

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

  useEffect(() => {
    if (initialLoadCompleted && !initialPanelOpenAttempted) {
      setInitialPanelOpenAttempted(true);

      // Only auto-open on desktop, not mobile, and not in compact mode
      if (!isMobile && !compact) {
        if (toolCalls.length > 0) {
          setIsSidePanelOpen(true);
          setCurrentToolIndex(toolCalls.length - 1);
        } else {
          if (messages.length > 0) {
            setIsSidePanelOpen(true);
          }
        }
      }
    }
  }, [
    initialPanelOpenAttempted,
    messages,
    toolCalls,
    initialLoadCompleted,
    setIsSidePanelOpen,
    setCurrentToolIndex,
    isMobile,
    compact,
  ]);

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

  const hasCheckedUpgradeDialog = useRef(false);

  useEffect(() => {
    if (
      initialLoadCompleted &&
      subscriptionData &&
      !hasCheckedUpgradeDialog.current
    ) {
      hasCheckedUpgradeDialog.current = true;
      const hasSeenUpgradeDialog = localStorage.getItem(
        'suna_upgrade_dialog_displayed',
      );
      const isFreeTier = subscriptionStatus === 'no_subscription';
      if (!hasSeenUpgradeDialog && isFreeTier && !isLocalMode()) {
        setShowUpgradeDialog(true);
      }
    }
  }, [subscriptionData, subscriptionStatus, initialLoadCompleted]);

  const handleDismissUpgradeDialog = () => {
    setShowUpgradeDialog(false);
    localStorage.setItem('suna_upgrade_dialog_displayed', 'true');
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
  }, [messages, initialLoadCompleted]);

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
      >
        <ThreadError error={error} />
      </ThreadLayout>
    );
  }

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
        />

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
