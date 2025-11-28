'use client';

import React, { useState, Suspense, useCallback, useEffect, useRef, startTransition } from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  ChatInput,
  ChatInputHandles,
} from '@/components/thread/chat-input/chat-input';
import {
  BillingError,
  AgentRunLimitError,
  ProjectLimitError,
} from '@/lib/api';
import { useIsMobile } from '@/hooks/use-mobile';
import { useBillingError } from '@/hooks/useBillingError';
import { BillingErrorAlert } from '@/components/billing/usage-limit-alert';
import { useAccounts } from '@/hooks/use-accounts';
import { useAuth } from '@/components/AuthProvider';
import { config, isLocalMode, isStagingMode } from '@/lib/config';
import { useInitiateAgentWithInvalidation } from '@/hooks/react-query/dashboard/use-initiate-agent';

import { useAgents } from '@/hooks/react-query/agents/use-agents';
import { cn } from '@/lib/utils';
import { BillingModal } from '@/components/billing/billing-modal';
import { useAgentSelection } from '@/lib/stores/agent-selection-store';
import { IrisModesPanel } from './iris-modes-panel';
import { AIWorkerTemplates } from './ai-worker-templates';
import { normalizeFilenameToNFC } from '@/lib/utils/unicode';
import { IrisLogo } from '../sidebar/iris-logo';
import { AgentRunLimitDialog } from '@/components/thread/agent-run-limit-dialog';
import { CustomAgentsSection } from './custom-agents-section';
import { toast } from 'sonner';
import { ReleaseBadge } from '../auth/release-badge';
import { Calendar, MessageSquare, Plus, Sparkles, Zap, Shapes, Settings, Home, Bell, Sun, Moon, Lightbulb } from 'lucide-react';
import { AgentConfigurationDialog } from '@/components/agents/agent-configuration-dialog';
import { fastGeminiChat, adaptiveChatStream, type AdaptiveDecision } from '@/lib/fast-gemini-chat';
import { addAssistantMessage } from '@/lib/api';
import { simpleChatStream } from '@/lib/simple-chat';
import { useTheme } from 'next-themes';
import { useChatSessionManager, type ChatSessionHandle } from '@/hooks/use-chat-session-manager';

const PENDING_PROMPT_KEY = 'pendingAgentPrompt';



export function DashboardContent() {
  const [inputValue, setInputValue] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showConfigDialog, setShowConfigDialog] = useState(false);
  const [configAgentId, setConfigAgentId] = useState<string | null>(null);
  // Removed isRedirecting state - we navigate instantly now
  const [autoSubmit, setAutoSubmit] = useState(false);
  const [selectedMode, setSelectedMode] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'super-worker' | 'worker-templates'>('super-worker');
  const [selectedCharts, setSelectedCharts] = useState<string[]>([]);
  const [selectedOutputFormat, setSelectedOutputFormat] = useState<string | null>(null);
  const [currentTime, setCurrentTime] = useState(new Date());
  
  // CRITICAL: Load chat mode from localStorage to match ThreadComponent behavior
  // This ensures Dashboard and ThreadComponent always show the same mode
  const getPersistedChatMode = useCallback((): 'chat' | 'execute' | 'adaptive' => {
    if (typeof window === 'undefined') return 'adaptive';
    try {
      const persisted = localStorage.getItem('iris-chat-mode-preference');
      if (persisted === 'chat' || persisted === 'execute' || persisted === 'adaptive') {
        return persisted as 'chat' | 'execute' | 'adaptive';
      }
    } catch (e) {
      // Ignore localStorage errors
    }
    return 'adaptive';
  }, []);
  
  const [chatMode, setChatMode] = useState<'chat' | 'execute' | 'adaptive'>(() => {
    // Initialize with persisted mode on first render (same as ThreadComponent)
    return getPersistedChatMode();
  });
  
  // Sync with localStorage changes and ensure mode is persisted
  useEffect(() => {
    const persistedMode = getPersistedChatMode();
    if (persistedMode !== chatMode) {
      // If localStorage changed (e.g., from another tab/component), sync it
      setChatMode(persistedMode);
    }
  }, [getPersistedChatMode, chatMode]);
  
  // CRITICAL: Persist mode changes to localStorage (same as ThreadComponent)
  const handleChatModeChange = useCallback((mode: 'chat' | 'execute' | 'adaptive') => {
    setChatMode(mode);
    try {
      localStorage.setItem('iris-chat-mode-preference', mode);
    } catch (e) {
      // Ignore localStorage errors
    }
  }, []);
  const [isFastModeStreaming, setIsFastModeStreaming] = useState(false);
  const [showControlMenu, setShowControlMenu] = useState(false);
  const [menuAnimate, setMenuAnimate] = useState(false);
  const controlMenuRef = useRef<HTMLDivElement>(null);
  const { theme, resolvedTheme, setTheme } = useTheme();
  const { createSession } = useChatSessionManager();
  const simpleChatAbortControllerRef = useRef<AbortController | null>(null);
  const simpleChatStopRequestedRef = useRef(false);
  
  // Update time every minute
  React.useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 60000); // Update every minute
    
    return () => clearInterval(timer);
  }, []);
  
  // Reset data selections when mode changes
  React.useEffect(() => {
    if (selectedMode !== 'data') {
      setSelectedCharts([]);
      setSelectedOutputFormat(null);
    }
  }, [selectedMode]);
  const {
    selectedAgentId,
    setSelectedAgent,
    initializeFromAgents,
    getCurrentAgent
  } = useAgentSelection();
  const { billingError, handleBillingError, clearBillingError } =
    useBillingError();
  const [showAgentLimitDialog, setShowAgentLimitDialog] = useState(false);
  const [agentLimitData, setAgentLimitData] = useState<{
    runningCount: number;
    runningThreadIds: string[];
  } | null>(null);
  const router = useRouter();
  const searchParams = useSearchParams();
  const isMobile = useIsMobile();
  const { user } = useAuth();
  const { data: accounts } = useAccounts({ enabled: !!user });
  const personalAccount = accounts?.find((account) => account.personal_account);
  const chatInputRef = React.useRef<ChatInputHandles>(null);
  const initiateAgentMutation = useInitiateAgentWithInvalidation();
  const [showPaymentModal, setShowPaymentModal] = useState(false);


  // Feature flag for custom agents section

  // Fetch agents to get the selected agent's name
  const { data: agentsResponse } = useAgents({
    limit: 100,
    sort_by: 'name',
    sort_order: 'asc'
  });

  const agents = agentsResponse?.agents || [];
  
  // Get the selected agent's configuration for system prompt
  const selectedAgent = selectedAgentId
    ? agents.find(agent => agent.agent_id === selectedAgentId)
    : null;
  const displayName = selectedAgent?.name || 'Iris';
  const agentAvatar = undefined;
  const isIrisAgent = selectedAgent?.metadata?.is_iris_default || false;

  React.useEffect(() => {
    if (agents.length > 0) {
      initializeFromAgents(agents, undefined, setSelectedAgent);
    }
  }, [agents, initializeFromAgents, setSelectedAgent]);

  // Handle staggered animation trigger for radial menu
  React.useEffect(() => {
    if (showControlMenu) {
      const t = setTimeout(() => setMenuAnimate(true), 0);
      return () => clearTimeout(t);
    } else {
      setMenuAnimate(false);
    }
  }, [showControlMenu]);

  // Handle click outside to close control menu
  React.useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (showControlMenu && controlMenuRef.current && !controlMenuRef.current.contains(event.target as Node)) {
        // Start reverse animation
        setMenuAnimate(false);
        // Close menu after animation completes (match opening animation timing)
        setTimeout(() => setShowControlMenu(false), 480);
      }
    };

    if (showControlMenu) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [showControlMenu]);

  React.useEffect(() => {
    const agentIdFromUrl = searchParams?.get('agent_id');
    if (agentIdFromUrl && agentIdFromUrl !== selectedAgentId) {
      setSelectedAgent(agentIdFromUrl);
      const newUrl = new URL(window.location.href);
      newUrl.searchParams.delete('agent_id');
      router.replace(newUrl.pathname + newUrl.search, { scroll: false });
    }
  }, [searchParams, selectedAgentId, router, setSelectedAgent]);

  // Removed useEffect for threadQuery redirect - we navigate instantly now
  // This was causing delays, now we navigate immediately when we get thread_id


  const handleStopSimpleChat = useCallback(async () => {
    const controller = simpleChatAbortControllerRef.current;
    if (!controller) return;
    simpleChatStopRequestedRef.current = true;
    controller.abort();
    simpleChatAbortControllerRef.current = null;
    setIsSubmitting(false);
    setIsFastModeStreaming(false);
  }, []);


  const handleSubmit = async (
    message: string,
    options?: {
      model_name?: string;
      enable_context_manager?: boolean;
      chat_mode?: 'chat' | 'execute' | 'adaptive';
    },
  ) => {
    if (
      (!message.trim() && !chatInputRef.current?.getPendingFiles().length) ||
      isSubmitting
    )
      return;

    setIsSubmitting(true);

    try {
      const files = chatInputRef.current?.getPendingFiles() || [];
      localStorage.removeItem(PENDING_PROMPT_KEY);

      // Handle Chat Mode - Use streaming simple chat endpoint
      if (options?.chat_mode === 'chat') {
        // Streaming simple chat mode - real-time response
        let threadId: string | null = null;
        let projectId: string | null = null;
        let hasRedirected = false;
        let sessionHandle: ChatSessionHandle | null = null;
        let bufferedContent = '';
        const abortController = new AbortController();
        simpleChatAbortControllerRef.current = abortController;
        simpleChatStopRequestedRef.current = false;
        setIsFastModeStreaming(true);
        let wasAborted = false;

        const ensureSessionHandle = () => {
          if (!sessionHandle && threadId && projectId) {
            sessionHandle = createSession({
              prompt: message,
              projectId,
              threadId,
              initialContent: bufferedContent,
            });
            bufferedContent = '';
          }
        };
        
        // Redirect immediately when we get metadata - use window.location for instant navigation
        try {
          await simpleChatStream(
            message,
            {
              onMetadata: (data) => {
                threadId = data.thread_id;
                projectId = data.project_id;
                ensureSessionHandle();
                // Instant navigation - no loading states, no delays
                if (threadId && projectId && !hasRedirected) {
                  hasRedirected = true;
                  // Use router.replace for instant SPA navigation (no page reload)
                  startTransition(() => {
                    router.replace(`/projects/${projectId}/thread/${threadId}`, { scroll: false });
                  });
                }
              },
              onContent: (content) => {
                if (!threadId || !projectId) {
                  bufferedContent += content;
                  return;
                }
                ensureSessionHandle();
                sessionHandle?.append(content);
              },
              onDone: () => {
                ensureSessionHandle();
                sessionHandle?.finish();
                // If we haven't redirected yet (shouldn't happen), redirect now
                if (!hasRedirected && threadId && projectId) {
                  startTransition(() => {
                    router.replace(`/projects/${projectId}/thread/${threadId}`, { scroll: false });
                  });
                }
                setIsSubmitting(false);
              },
              onError: (error) => {
                ensureSessionHandle();
                sessionHandle?.fail(error);
                setIsSubmitting(false);
                throw new Error(`Simple chat streaming error: ${error}`);
              },
            },
            undefined,
            abortController.signal,
          );
        } catch (error) {
          wasAborted =
            abortController.signal.aborted ||
            simpleChatStopRequestedRef.current ||
            (error instanceof DOMException && error.name === 'AbortError');
          if (!wasAborted) {
            simpleChatAbortControllerRef.current = null;
            setIsFastModeStreaming(false);
            throw error;
          }
        }

        simpleChatAbortControllerRef.current = null;
        setIsFastModeStreaming(false);
        if (!wasAborted) {
          wasAborted =
            abortController.signal.aborted || simpleChatStopRequestedRef.current;
        }
        simpleChatStopRequestedRef.current = false;

        if (wasAborted) {
          ensureSessionHandle();
          sessionHandle?.finish();
          setIsSubmitting(false);
          chatInputRef.current?.clearPendingFiles();
          return;
        }

        chatInputRef.current?.clearPendingFiles();
        return;
      }

      // Handle Adaptive Mode - Create thread first, then call adaptive streaming endpoint
      if (options?.chat_mode === 'adaptive') {
        // First, create a thread by calling initiate agent endpoint
        const formData = new FormData();
        formData.append('prompt', message);
        formData.append('chat_mode', 'adaptive');
        formData.append('stream', 'false'); // We'll handle streaming ourselves

        // Add selected agent if one is chosen
        if (selectedAgentId) {
          formData.append('agent_id', selectedAgentId);
        }

        files.forEach((file, index) => {
          const normalizedName = normalizeFilenameToNFC(file.name);
          formData.append('files', file, normalizedName);
        });

        if (options?.model_name) formData.append('model_name', options.model_name);
        formData.append('enable_context_manager', String(options?.enable_context_manager ?? false));

        const result = await initiateAgentMutation.mutateAsync(formData);

        if (result.thread_id && result.project_id) {
          // Navigate to thread with query parameter to trigger adaptive mode
          startTransition(() => {
            router.replace(`/projects/${result.project_id}/thread/${result.thread_id}?trigger_adaptive=true`, { scroll: false });
          });
          
          // The thread component will detect the query parameter and trigger adaptive streaming
          chatInputRef.current?.clearPendingFiles();
          return;
        } else {
          throw new Error('Failed to create thread for adaptive mode');
        }
      }

      // Handle Execute Mode - Normal agent execution
      const formData = new FormData();
      formData.append('prompt', message);

      // Add selected agent if one is chosen
      if (selectedAgentId) {
        formData.append('agent_id', selectedAgentId);
      }

      files.forEach((file, index) => {
        const normalizedName = normalizeFilenameToNFC(file.name);
        formData.append('files', file, normalizedName);
      });

      if (options?.model_name) formData.append('model_name', options.model_name);
      formData.append('stream', 'true'); // Always stream for better UX
      formData.append('enable_context_manager', String(options?.enable_context_manager ?? false));
      if (options?.chat_mode && options.chat_mode !== 'chat') {
        formData.append('chat_mode', options.chat_mode);
      }

      const result = await initiateAgentMutation.mutateAsync(formData);

      if (result.thread_id) {
        // Instant navigation - use router.replace for zero-delay SPA navigation
        if (result.project_id) {
          // Navigate instantly - no loading states, no delays
          startTransition(() => {
            router.replace(`/projects/${result.project_id}/thread/${result.thread_id}`, { scroll: false });
          });
        } else {
          // Fallback: navigate to agents page
          startTransition(() => {
            router.replace(`/agents/${result.thread_id}`, { scroll: false });
          });
        }
      } else {
        throw new Error('Agent initiation did not return a thread_id.');
      }
      chatInputRef.current?.clearPendingFiles();
    } catch (error: any) {
      console.error('Error during submission process:', error);
      if (error instanceof BillingError) {
        setShowPaymentModal(true);
      } else if (error instanceof AgentRunLimitError) {
        const { running_thread_ids, running_count } = error.detail;
        setAgentLimitData({
          runningCount: running_count,
          runningThreadIds: running_thread_ids,
        });
        setShowAgentLimitDialog(true);
      } else if (error instanceof ProjectLimitError) {
        setShowPaymentModal(true);
      } else {
        const errorMessage = error instanceof Error ? error.message : 'Operation failed';
        toast.error(errorMessage);
      }
      // Only reset loading state if there was an error or no thread_id was returned
      setIsSubmitting(false);
    }
  };

  React.useEffect(() => {
    const timer = setTimeout(() => {
      const pendingPrompt = localStorage.getItem(PENDING_PROMPT_KEY);

      if (pendingPrompt) {
        setInputValue(pendingPrompt);
        setAutoSubmit(true);
      }
    }, 200);

    return () => clearTimeout(timer);
  }, []);

  React.useEffect(() => {
    if (autoSubmit && inputValue && !isSubmitting) {
      const timer = setTimeout(() => {
        handleSubmit(inputValue);
        setAutoSubmit(false);
      }, 500);

      return () => clearTimeout(timer);
    }
  }, [autoSubmit, inputValue, isSubmitting]);

  return (
    <>

      <BillingModal
        open={showPaymentModal}
        onOpenChange={setShowPaymentModal}
        showUsageLimitAlert={true}
      />

      <div className="flex flex-col h-screen w-full overflow-hidden relative bg-[rgba(255,255,255,0.7)] backdrop-blur-2xl dark:bg-[rgba(10,14,22,0.55)] light:bg-[rgba(255,255,255,0.7)]">
        {/* Dark mode checkered pattern background */}
        <div className="absolute inset-0 opacity-[0.04] pointer-events-none dark:opacity-[0.04]" style={{
          backgroundImage: `
            linear-gradient(to right, rgba(255, 255, 255, 0.5) 1px, transparent 1px),
            linear-gradient(to bottom, rgba(255, 255, 255, 0.5) 1px, transparent 1px)
          `,
          backgroundSize: '40px 40px'
        }}></div>
        
        {/* Light mode glassmorphism background */}
        <div className="absolute inset-0 opacity-0 dark:opacity-0 light:opacity-100 pointer-events-none" style={{
          background: 'linear-gradient(135deg, rgba(255, 255, 255, 0.1) 0%, rgba(255, 255, 255, 0.05) 100%)',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
        }}></div>
        
        {/* Light mode checkered pattern background */}
        <div className="absolute inset-0 opacity-0 dark:opacity-0 light:opacity-[0.12] pointer-events-none" style={{
          backgroundImage: `
            linear-gradient(to right, rgba(0, 0, 0, 0.2) 1px, transparent 1px),
            linear-gradient(to bottom, rgba(0, 0, 0, 0.2) 1px, transparent 1px)
          `,
          backgroundSize: '40px 40px'
        }}></div>

        <div className="flex-1 overflow-y-auto relative z-10">
          <div className="min-h-full flex flex-col">

            {/* Date and Time - Top Right (fixed position) */}
            {viewMode === 'super-worker' && (
              <div className="fixed top-8 right-8 z-10" style={{ fontFamily: 'Geist, -apple-system, BlinkMacSystemFont, sans-serif' }}>
                <div className="flex items-center gap-3">
                  <div className="relative" ref={controlMenuRef}>
                    <TooltipProvider delayDuration={0}>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <div
                            className="h-8 w-8 rounded-xl border border-white/10 bg-[rgba(10,14,22,0.55)] backdrop-blur-2xl shadow-[0_10px_30px_-10px_rgba(0,0,0,0.5),inset_0_1px_0_0_rgba(255,255,255,0.06)] flex items-center justify-center text-white/90 light:text-black/80 light:border-black/10 light:bg-[rgba(255,255,255,0.25)]"
                          >
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 cursor-pointer text-inherit"
                              aria-label="Control Center"
                              onClick={() => {
                                if (showControlMenu) {
                                  // Start reverse animation
                                  setMenuAnimate(false);
                                  // Close menu after animation completes (match opening animation timing)
                                  setTimeout(() => setShowControlMenu(false), 480);
                                } else {
                                  setShowControlMenu(true);
                                }
                              }}
                            >
                              <Shapes className="h-4 w-4" />
                            </Button>
                          </div>
                        </TooltipTrigger>
                        <TooltipContent side="bottom">
                          <p>Control Center</p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>

                    {showControlMenu && (
                      <div className="absolute z-20 left-1/2 top-full -translate-x-1/2 mt-2 w-40 h-40 pointer-events-none">
                        {/* Radial menu container centered just below the control button */}
                        <div className="absolute left-1/2 top-0 -translate-x-1/2 w-40 h-40">
                                {(() => {
                                  const ThemeIcon = resolvedTheme === 'dark' ? Sun : Moon;
                                  const items = [
                                    { key: 'home', Icon: Home, label: 'Homepage', onClick: () => router.push('/homepage') },
                                    { key: 'notifications', Icon: Bell, label: 'Notifications', onClick: () => router.push('/notifications') },
                                    { key: 'personalisation', Icon: Lightbulb, label: 'Personalisation', onClick: () => router.push('/personalisation') },
                                    { key: 'theme', Icon: ThemeIcon, label: 'Theme', onClick: () => setTheme(resolvedTheme === 'light' ? 'dark' : 'light') },
                                    { key: 'settings', Icon: Settings, label: 'Settings', onClick: () => router.push('/settings') },
                                  ];
                                  return items.slice().reverse();
                                })().map(({ Icon, label, onClick }, i, arr) => {
                                  // Place buttons on a bottom arc (20° to 160°) so they open below
                                  const start = 20; // degrees
                                  const end = 160; // degrees
                                  const step = arr.length > 1 ? (end - start) / (arr.length - 1) : 0;
                                  const angleDeg = start + i * step;
                                  const radius = 80; // px distance from center (more spacing)
                                  const rad = (angleDeg * Math.PI) / 180;
                                  const x = Math.cos(rad) * radius;
                                  const y = Math.sin(rad) * radius;
                                  return (
                                    <div
                                      key={i}
                                      className="absolute left-1/2 top-0"
                                      style={{ transform: `translate(calc(-50% + ${x}px), ${y}px)` }}
                                    >
                                      <TooltipProvider delayDuration={0}>
                                        <Tooltip>
                                          <TooltipTrigger asChild>
                                            <button
                                              className={`h-[34px] w-[34px] rounded-xl border border-white/10 bg-[rgba(10,14,22,0.55)] backdrop-blur-2xl shadow-[0_10px_30px_-10px_rgba(0,0,0,0.5),inset_0_1px_0_0_rgba(255,255,255,0.06)] flex items-center justify-center text-white/90 hover:text-white transition-all duration-200 cursor-pointer light:text-black/80 light:hover:text-black light:border-black/10 light:bg-[rgba(255,255,255,0.25)] pointer-events-auto ${menuAnimate ? 'opacity-100 scale-100' : 'opacity-0 scale-0'}`}
                                              aria-label={label}
                                              onClick={() => { 
                                                setMenuAnimate(false);
                                                setTimeout(() => setShowControlMenu(false), 480);
                                                onClick(); 
                                              }}
                                              style={{ transitionDelay: `${i * 70}ms` }}
                                            >
                                              <Icon className="h-[18px] w-[18px]" />
                                            </button>
                                          </TooltipTrigger>
                                          <TooltipContent side="bottom">
                                            <p>{label}</p>
                                          </TooltipContent>
                                        </Tooltip>
                                      </TooltipProvider>
                                    </div>
                                  );
                                })}
                        </div>
                      </div>
                    )}
                  </div>
                  <div className="text-[16px] text-foreground/75 font-medium h-8 flex items-center">
                {currentTime.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })} • {currentTime.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                  </div>
                </div>
              </div>
            )}

            {/* Centered content area */}
            <div className="flex-1 flex items-center justify-center">
              {/* Super Worker View - Iris only */}
              {viewMode === 'super-worker' && (
                <div className="w-full animate-in fade-in-0 duration-300">
                  {/* Title and chat input - Fixed position */}
                  <div className="px-4 py-8">
                    <div className="w-full max-w-3xl mx-auto flex flex-col items-center justify-center space-y-4 md:space-y-6 relative">
                      <div className="flex flex-col items-center text-center w-full">
                        <p
                          className="tracking-tight text-2xl md:text-3xl font-normal text-foreground/90 text-center relative z-10"
                          style={{ 
                            fontFamily: 'Geist, -apple-system, BlinkMacSystemFont, sans-serif', 
                            fontWeight: 400
                          }}
                          data-light-shadow
                          data-dark-shadow
                        >
                          Iris is ready, are you?
                        </p>
                      </div>

                      <div className="w-full">
                        <ChatInput
                          ref={chatInputRef}
                          onSubmit={handleSubmit}
                          loading={isSubmitting}
                          onStopAgent={isFastModeStreaming ? handleStopSimpleChat : undefined}
                          placeholder="Describe what you need help with..."
                          value={inputValue}
                          onChange={setInputValue}
                          hideAttachments={false}
                          selectedAgentId={selectedAgentId}
                          onAgentSelect={setSelectedAgent}
                          enableAdvancedConfig={!isStagingMode() && !isLocalMode()}
                          onConfigureAgent={(agentId) => {
                            setConfigAgentId(agentId);
                            setShowConfigDialog(true);
                          }}
                          selectedMode={selectedMode}
                          onModeDeselect={() => setSelectedMode(null)}
                          animatePlaceholder={true}
                          selectedCharts={selectedCharts}
                          selectedOutputFormat={selectedOutputFormat}
                          initialChatMode={chatMode}
                          onChatModeChange={handleChatModeChange}
                        />
                      </div>
                    </div>
                  </div>

                  {/* Modes Panel - Below chat input, doesn't affect its position */}
                  {(isStagingMode() || isLocalMode()) && isIrisAgent && (
                    <div className="px-4 pb-8">
                      <div className="max-w-3xl mx-auto">
                        <IrisModesPanel
                          selectedMode={selectedMode}
                          onModeSelect={setSelectedMode}
                          onSelectPrompt={setInputValue}
                          isMobile={isMobile}
                          selectedCharts={selectedCharts}
                          onChartsChange={setSelectedCharts}
                          selectedOutputFormat={selectedOutputFormat}
                          onOutputFormatChange={setSelectedOutputFormat}
                        />
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Worker Templates View - Available for ALL agents */}
              {(viewMode === 'worker-templates') && (
                <div className="w-full animate-in fade-in-0 duration-300">
                  {/* Title */}
                  <div className="px-4 py-8">
                    <div className="w-full max-w-5xl mx-auto flex flex-col items-center space-y-2">
                      <div className="flex flex-col items-center text-center w-full">
                        <p className="tracking-tight text-2xl md:text-3xl font-normal text-foreground/90">
                          Workers & Workflows
                        </p>
                        <p className="text-sm text-muted-foreground mt-2">
                          Configure and install AI workers from templates
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Templates Grid */}
                  <div className="px-4 pb-8">
                    <div className="max-w-5xl mx-auto">
                      <AIWorkerTemplates
                        onSelectWorker={(worker) => {
                          setInputValue(`Create an AI worker: ${worker.name} - ${worker.description}`);
                          if (isIrisAgent) {
                            setViewMode('super-worker');
                          }
                          toast.success(`Selected ${worker.name} template`);
                        }}
                        isMobile={isMobile}
                      />
                    </div>
                  </div>

                  {(isStagingMode() || isLocalMode()) && (
                    <div className="w-full px-4 pb-8">
                      <div className="max-w-7xl mx-auto">
                        <CustomAgentsSection
                          onAgentSelect={setSelectedAgent}
                        />
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        <BillingErrorAlert
          message={billingError?.message}
          currentUsage={billingError?.currentUsage}
          limit={billingError?.limit}
          accountId={personalAccount?.account_id}
          onDismiss={clearBillingError}
          isOpen={!!billingError}
        />
      </div>

      {agentLimitData && (
        <AgentRunLimitDialog
          open={showAgentLimitDialog}
          onOpenChange={setShowAgentLimitDialog}
          runningCount={agentLimitData.runningCount}
          runningThreadIds={agentLimitData.runningThreadIds}
          projectId={undefined}
        />
      )}

      {configAgentId && (
        <AgentConfigurationDialog
          open={showConfigDialog}
          onOpenChange={setShowConfigDialog}
          agentId={configAgentId}
          onAgentChange={(newAgentId) => {
            setConfigAgentId(newAgentId);
            setSelectedAgent(newAgentId);
          }}
        />
      )}

      
    </>
  );
}
