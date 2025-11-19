import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CircleDashed, Maximize2 } from 'lucide-react';
import { getToolIcon, getUserFriendlyToolName } from '@/components/thread/utils';
import { cn } from '@/lib/utils';

export interface ToolCallInput {
  assistantCall: {
    content?: string;
    name?: string;
    timestamp?: string;
  };
  toolResult?: {
    content?: string;
    isSuccess?: boolean;
    timestamp?: string;
  };
  messages?: any[];
}

interface FloatingToolPreviewProps {
  toolCalls: ToolCallInput[];
  currentIndex: number;
  onExpand: () => void;
  agentName?: string;
  isVisible: boolean;
  // Indicators for multiple notification types (not tool calls)
  showIndicators?: boolean;
  indicatorIndex?: number;
  indicatorTotal?: number;
  onIndicatorClick?: (index: number) => void;
  // Timer props to sync with expanded panel
  agentStatus?: 'idle' | 'running' | 'connecting';
  agentRunId?: string | null;
  threadId?: string;
}

const FLOATING_LAYOUT_ID = 'tool-panel-float';
const CONTENT_LAYOUT_ID = 'tool-panel-content';

const formatDuration = (durationMs: number): string => {
  const safeMs = Number.isFinite(durationMs) ? Math.max(0, Math.floor(durationMs)) : 0;
  const totalSeconds = Math.floor(safeMs / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, '0')}:${seconds
      .toString()
      .padStart(2, '0')}`;
  }

  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
};

const getToolResultStatus = (toolCall: any): boolean => {
  const content = toolCall?.toolResult?.content;
  if (!content) return toolCall?.toolResult?.isSuccess ?? true;

  const safeParse = (data: any) => {
    try { return typeof data === 'string' ? JSON.parse(data) : data; }
    catch { return null; }
  };

  const parsed = safeParse(content);
  if (!parsed) return toolCall?.toolResult?.isSuccess ?? true;

  if (parsed.content) {
    const inner = safeParse(parsed.content);
    if (inner?.tool_execution?.result?.success !== undefined) {
      return inner.tool_execution.result.success;
    }
  }
  const success = parsed.tool_execution?.result?.success ??
    parsed.result?.success ??
    parsed.success;

  return success !== undefined ? success : (toolCall?.toolResult?.isSuccess ?? true);
};

export const FloatingToolPreview: React.FC<FloatingToolPreviewProps> = ({
  toolCalls,
  currentIndex,
  onExpand,
  agentName,
  isVisible,
  showIndicators = false,
  indicatorIndex = 0,
  indicatorTotal = 1,
  onIndicatorClick,
  agentStatus = 'idle',
  agentRunId,
  threadId,
}) => {
  const [isExpanding, setIsExpanding] = React.useState(false);
  const [isHovered, setIsHovered] = React.useState(false);
  const [runStartTime, setRunStartTime] = React.useState<number | null>(null);
  const [runElapsedMs, setRunElapsedMs] = React.useState(0);
  const currentToolCall = toolCalls[currentIndex];
  const totalCalls = toolCalls.length;
  
  // Check if agent is running or streaming
  const isStreaming = currentToolCall?.toolResult?.content === 'STREAMING';
  const isAgentRunning = agentStatus === 'running' || agentStatus === 'connecting';
  const showRunningState = isAgentRunning || isStreaming;
  
  // Get timer storage key (same as tool-call-side-panel)
  const getTimerStorageKey = React.useCallback(() => {
    if (!threadId || !agentRunId) return null;
    return `agent-run-timer-${threadId}-${agentRunId}`;
  }, [threadId, agentRunId]);
  
  // Restore timer from localStorage (same logic as tool-call-side-panel)
  React.useEffect(() => {
    if (!getTimerStorageKey()) return;
    
    try {
      const storageKey = getTimerStorageKey();
      const stored = localStorage.getItem(storageKey!);
      
      if (stored) {
        const data = JSON.parse(stored);
        const storedStartTime = data.startTime;
        
        const now = Date.now();
        const oneDayAgo = now - 24 * 60 * 60 * 1000;
        
        if (storedStartTime && storedStartTime > oneDayAgo) {
          const shouldRestore = isAgentRunning || isStreaming;
          
          if (shouldRestore && runStartTime === null) {
            setRunStartTime(storedStartTime);
            setRunElapsedMs(now - storedStartTime);
          }
        }
      }
    } catch (e) {
      // Silently fail
    }
  }, [getTimerStorageKey, isAgentRunning, isStreaming, runStartTime]);
  
  // Update timer when running
  React.useEffect(() => {
    if (!showRunningState || runStartTime === null) return;

    const updateElapsed = () => {
      setRunElapsedMs(Date.now() - runStartTime);
    };

    updateElapsed();
    const intervalId = window.setInterval(updateElapsed, 1000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [showRunningState, runStartTime]);
  
  // Start timer when agent starts running
  React.useEffect(() => {
    const storageKey = getTimerStorageKey();
    
    if (showRunningState && runStartTime === null) {
      const startTime = Date.now();
      setRunStartTime(startTime);
      setRunElapsedMs(0);
      
      // Save to localStorage
      try {
        if (storageKey) {
          localStorage.setItem(storageKey, JSON.stringify({ startTime }));
        }
      } catch (e) {
        // Silently fail
      }
    } else if (!showRunningState && runStartTime !== null) {
      setRunStartTime(null);
      setRunElapsedMs(0);
      
      // Remove from localStorage
      try {
        if (storageKey) {
          localStorage.removeItem(storageKey);
        }
      } catch (e) {
        // Silently fail
      }
    }
  }, [showRunningState, runStartTime, getTimerStorageKey]);
  
  const runningDurationMs = showRunningState ? runElapsedMs : 0;

  React.useEffect(() => {
    if (isVisible) {
      setIsExpanding(false);
    }
  }, [isVisible]);

  if (!currentToolCall || totalCalls === 0) return null;

  const toolName = currentToolCall.assistantCall?.name || 'Tool Call';
  const CurrentToolIcon = getToolIcon(toolName);
  
  // Check if tool call is completed (has result and not streaming)
  const isCompleted = !isStreaming && !!currentToolCall?.toolResult?.content && 
    currentToolCall.toolResult.content !== 'STREAMING';

  const handleClick = () => {
    setIsExpanding(true);
    requestAnimationFrame(() => {
      onExpand();
    });
  };


  if (!isVisible) {
    return null;
  }

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key="floating-tool-preview"
        layoutId={FLOATING_LAYOUT_ID}
        initial={{ opacity: 0, x: 20 }}
        animate={{ opacity: 1, x: 0 }}
        exit={{ opacity: 0, x: 20 }}
        transition={{ duration: 0.3, ease: 'easeOut' }}
        className="fixed bottom-5 right-[max(1rem,calc((100vw-48rem)/2-12rem))] z-50"
        style={{ pointerEvents: 'auto' }}
      >
          <motion.div
            layoutId={CONTENT_LAYOUT_ID}
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            className={cn(
              "relative rounded-[32px] bg-[rgba(10,14,22,0.55)] dark:bg-[rgba(10,14,22,0.55)] backdrop-blur-2xl shadow-[0_20px_60px_-10px_rgba(0,0,0,0.8),inset_0_1px_0_0_rgba(255,255,255,0.06)] dark:shadow-[0_20px_60px_-10px_rgba(0,0,0,0.8),inset_0_1px_0_0_rgba(255,255,255,0.06)] transition-all duration-300 overflow-hidden cursor-pointer group",
              "light:bg-[rgba(255,255,255,0.4)] light:backdrop-blur-2xl light:shadow-[0_20px_60px_-10px_rgba(0,0,0,0.05),inset_0_1px_0_0_rgba(0,0,0,0.04)]",
              "w-[140px] h-[146px]"
            )}
            onClick={handleClick}
            style={{ opacity: isExpanding ? 0 : 1 }}
          >
            {/* Dark mode gradient rim */}
            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-0 rounded-[32px] dark:opacity-100 opacity-0"
              style={{
                background:
                  "linear-gradient(180deg, rgba(173,216,255,0.18), rgba(255,255,255,0.04) 30%, rgba(150,160,255,0.14) 85%, rgba(255,255,255,0.06))",
                WebkitMask: "linear-gradient(#000,#000) content-box, linear-gradient(#000,#000)",
                WebkitMaskComposite: "xor" as any,
                maskComposite: "exclude",
                padding: 1,
                borderRadius: 32,
              }}
            />
            {/* Light mode gradient rim */}
            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-0 rounded-[32px] light:opacity-100 dark:opacity-0"
              style={{
                background:
                  "linear-gradient(180deg, rgba(0,0,0,0.06), rgba(0,0,0,0.02) 30%, rgba(0,0,0,0.05) 85%, rgba(0,0,0,0.03))",
                WebkitMask: "linear-gradient(#000,#000) content-box, linear-gradient(#000,#000)",
                WebkitMaskComposite: "xor" as any,
                maskComposite: "exclude",
                padding: 1,
                borderRadius: 32,
              }}
            />
            
            {/* Dark mode specular streak */}
            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-x-0 top-0 h-24 dark:opacity-100 opacity-0"
              style={{
                background:
                  "linear-gradient(180deg, rgba(255,255,255,0.22), rgba(255,255,255,0.06) 45%, rgba(255,255,255,0) 100%)",
                filter: "blur(6px)",
                mixBlendMode: "screen",
              }}
            />
            {/* Light mode specular streak */}
            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-x-0 top-0 h-24 light:opacity-100 dark:opacity-0"
              style={{
                background:
                  "linear-gradient(180deg, rgba(0,0,0,0.08), rgba(0,0,0,0.03) 45%, rgba(0,0,0,0) 100%)",
                filter: "blur(6px)",
                mixBlendMode: "screen",
              }}
            />
            
            {/* Fine noise */}
            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-0 opacity-30"
              style={{
                backgroundImage:
                  "url('data:image/svg+xml;utf8,<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"60\" height=\"60\"><filter id=\"n\"><feTurbulence type=\"fractalNoise\" baseFrequency=\"0.8\" numOctaves=\"4\"/><feColorMatrix type=\"saturate\" values=\"0\"/><feComponentTransfer><feFuncA type=\"table\" tableValues=\"0 0.03\"/></feComponentTransfer></filter><rect width=\"100%\" height=\"100%\" filter=\"url(%23n)\" /></svg>')",
                backgroundSize: "100px 100px",
                mixBlendMode: "overlay",
              }}
            />
            
            {/* Content */}
            <div className="relative z-10 h-full p-5">
              {/* Tool Icon - Always centered, never moves */}
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 flex flex-col items-center gap-2 flex-shrink-0">
                <div className="w-12 h-12 rounded-xl flex items-center justify-center bg-white/5 backdrop-blur-sm border border-white/25 shadow-[0_2px_8px_rgba(0,0,0,0.18),inset_0_1px_0_rgba(255,255,255,0.1)] light:bg-white/70 light:border-black/10 light:shadow-[0_2px_8px_rgba(0,0,0,0.08),inset_0_1px_0_rgba(255,255,255,0.8)]">
                  {isStreaming ? (
                    <CircleDashed className="h-6 w-6 text-white/90 light:text-black/80 animate-spin" />
                  ) : (
                    <CurrentToolIcon className="h-6 w-6 text-white/90 light:text-black/80" />
                  )}
                </div>
                {/* Tool name label */}
                <span className="text-[10px] font-medium text-white/70 light:text-black/70 text-center px-1 max-w-[120px] truncate">
                  {getUserFriendlyToolName(toolName, isCompleted)}
                </span>
              </div>

              {/* Running indicator - Fixed at bottom, doesn't affect icon */}
              {showRunningState && (
                <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex items-center gap-3 z-20">
                  <motion.span
                    className="relative flex h-3 w-3 items-center justify-center rounded-full flex-shrink-0"
                    animate={{
                      scale: [1, 1.3, 1],
                      boxShadow: [
                        '0 0 0px rgba(16,185,129,0.4)',
                        '0 0 12px rgba(16,185,129,0.55)',
                        '0 0 0px rgba(16,185,129,0.35)',
                      ],
                      opacity: [0.9, 1, 0.9],
                    }}
                    transition={{
                      duration: 1.8,
                      repeat: Infinity,
                      ease: 'easeInOut',
                    }}
                  >
                    <span className="absolute inline-flex h-full w-full rounded-full bg-emerald-400/35 blur-[5px]" />
                    <span className="relative inline-flex h-2 w-2 rounded-full border border-emerald-200/70 bg-emerald-400 shadow-[0_0_6px_rgba(16,185,129,0.55)]" />
                  </motion.span>
                  <span className="text-[10px] font-mono text-emerald-100 light:text-emerald-600 whitespace-nowrap">
                    {formatDuration(runningDurationMs)}
                  </span>
                </div>
              )}

              {/* Hover overlay - shows expand icon and "Open" */}
              <AnimatePresence>
                {isHovered && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    className="absolute inset-0 bg-[rgba(10,14,22,0.85)] backdrop-blur-sm rounded-[32px] flex flex-col items-center justify-center gap-1.5 light:bg-[rgba(255,255,255,0.9)]"
                  >
                    <Maximize2 className="h-6 w-6 text-white/90 light:text-black/90" />
                    <span className="text-sm font-medium text-white/90 light:text-black/90">Open</span>
                  </motion.div>
                )}
              </AnimatePresence>

            </div>
          </motion.div>
        </motion.div>
    </AnimatePresence>
  );
};
