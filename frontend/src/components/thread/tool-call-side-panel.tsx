'use client';

import { Project } from '@/lib/api';
import { getToolIcon, getUserFriendlyToolName } from '@/components/thread/utils';
import React, { memo, useMemo, useCallback } from 'react';
import { Slider } from '@/components/ui/slider';
import { Skeleton } from '@/components/ui/skeleton';
import { ApiMessageType } from '@/components/thread/types';
import { CircleDashed, X, ChevronLeft, ChevronRight, Computer, Minimize2, Globe, Wrench } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useIsMobile } from '@/hooks/use-mobile';
import { Button } from '@/components/ui/button';
import { ToolView } from './tool-views/wrapper';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import { HealthCheckedVncIframe } from './HealthCheckedVncIframe';
import { BrowserHeader } from './tool-views/BrowserToolView';

import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
} from '@/components/ui/drawer';
import { useDocumentModalStore } from '@/lib/stores/use-document-modal-store';

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
  messages?: ApiMessageType[];
}

interface ToolCallSidePanelProps {
  isOpen: boolean;
  onClose: () => void;
  toolCalls: ToolCallInput[];
  currentIndex: number;
  onNavigate: (newIndex: number) => void;
  externalNavigateToIndex?: number;
  messages?: ApiMessageType[];
  agentStatus: string;
  project?: Project;
  renderAssistantMessage?: (
    assistantContent?: string,
    toolContent?: string,
  ) => React.ReactNode;
  renderToolResult?: (
    toolContent?: string,
    isSuccess?: boolean,
  ) => React.ReactNode;
  isLoading?: boolean;
  agentName?: string;
  onFileClick?: (filePath: string) => void;
  disableInitialAnimation?: boolean;
  compact?: boolean;
  onSubmit?: (message: string, options?: { model_name?: string; agent_id?: string; chat_mode?: 'chat' | 'execute' | 'adaptive' }) => void;
  isAgentRunning?: boolean;
  selectedModel?: string;
  getActualModelId?: (modelId: string) => string;
  selectedAgentId?: string;
  chatMode?: 'chat' | 'execute' | 'adaptive';
  onPopulateChatInput?: (message: string) => void;
}

interface ToolCallSnapshot {
  id: string;
  toolCall: ToolCallInput;
  index: number;
  timestamp: number;
}

const FLOATING_LAYOUT_ID = 'tool-panel-float';
const CONTENT_LAYOUT_ID = 'tool-panel-content';

interface ViewToggleProps {
  currentView: 'tools' | 'browser';
  onViewChange: (view: 'tools' | 'browser') => void;
}

const ViewToggle: React.FC<ViewToggleProps> = memo(function ViewToggle({ currentView, onViewChange }) {
  return (
    <div className="relative flex items-center gap-1 bg-muted rounded-3xl px-1 py-1 light:bg-black/5 light:border light:border-black/10">
      {/* Sliding background */}
      <motion.div
        className="absolute h-7 w-7 bg-white rounded-xl shadow-sm light:bg-white/80 light:shadow-[0_2px_8px_rgba(0,0,0,0.1)]"
        initial={false}
        animate={{
          x: currentView === 'tools' ? 0 : 32, // 28px button width + 4px gap
        }}
        transition={{
          type: "spring",
          stiffness: 300,
          damping: 30
        }}
      />
      
      {/* Buttons */}
      <Button
        size="sm"
        onClick={() => onViewChange('tools')}
        className={`relative z-10 h-7 w-7 p-0 rounded-xl bg-transparent hover:bg-transparent shadow-none ${
          currentView === 'tools'
            ? 'text-black light:text-black'
            : 'text-gray-500 dark:text-gray-400 light:text-black/60'
        }`}
        title="Switch to Tool View"
      >
        <Wrench className="h-3.5 w-3.5" />
      </Button>

      <Button
        size="sm"
        onClick={() => onViewChange('browser')}
        className={`relative z-10 h-7 w-7 p-0 rounded-xl bg-transparent hover:bg-transparent shadow-none ${
          currentView === 'browser'
            ? 'text-black light:text-black'
            : 'text-gray-500 dark:text-gray-400 light:text-black/60'
        }`}
        title="Switch to Browser View"
      >
        <Globe className="h-3.5 w-3.5" />
      </Button>
    </div>
  );
});

// Helper function to generate the computer title
const getComputerTitle = (agentName?: string): string => {
  return agentName ? `${agentName}'s Computer` : "Iris's Computer";
};

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

const RunningStatusBadge: React.FC<{ durationMs: number; className?: string }> = ({
  durationMs,
  className,
}) => {
  const formatted = formatDuration(durationMs);

  return (
    <div
      className={cn(
        'flex items-center gap-2 text-emerald-200 light:text-emerald-600',
        className,
      )}
    >
      <motion.span
        className="relative flex h-3.5 w-3.5 items-center justify-center rounded-full"
        animate={{
          scale: [1, 1.3, 1],
          boxShadow: [
            '0 0 0px rgba(16,185,129,0.4)',
            '0 0 14px rgba(16,185,129,0.55)',
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
        <span className="absolute inline-flex h-full w-full rounded-full bg-emerald-400/35 blur-[6px]" />
        <span className="relative inline-flex h-2.5 w-2.5 rounded-full border border-emerald-200/70 bg-emerald-400 shadow-[0_0_8px_rgba(16,185,129,0.55)]" />
      </motion.span>
      <span className="text-xs font-semibold uppercase tracking-[0.12em] text-emerald-100 light:text-emerald-600 ml-0.5">
        Running
      </span>
      <span className="rounded-full border border-emerald-400/35 bg-emerald-500/15 px-2 py-0.5 text-xs font-mono text-emerald-100 shadow-[0_0_12px_rgba(16,185,129,0.35)] light:bg-emerald-200/50 light:text-emerald-600">
        {formatted}
      </span>
    </div>
  );
};

const CompletedStatusBadge: React.FC<{ durationMs: number; className?: string }> = ({
  durationMs,
  className,
}) => {
  const formatted = formatDuration(durationMs);

  return (
    <div
      className={cn(
        'flex items-center gap-2 text-amber-200/80 light:text-amber-600/80',
        className,
      )}
    >
      <span className="relative flex h-3.5 w-3.5 items-center justify-center rounded-full">
        <span className="absolute inline-flex h-full w-full rounded-full bg-amber-400/20 blur-[6px]" />
        <span className="relative inline-flex h-2.5 w-2.5 rounded-full border border-amber-200/40 bg-amber-400/70 shadow-[0_0_6px_rgba(251,191,36,0.35)]" />
      </span>
      <span className="text-xs font-semibold uppercase tracking-[0.12em] text-amber-200/80 light:text-amber-600/80">
        Completed
      </span>
      <span className="rounded-full border border-amber-300/30 bg-amber-400/12 px-1.5 py-[2px] text-[10px] font-mono text-amber-100/85 shadow-[0_0_6px_rgba(251,191,36,0.22)] light:bg-amber-200/20 light:text-amber-700/75">
        {formatted}
      </span>
    </div>
  );
};

// Reusable header component for the tool panel
interface PanelHeaderProps {
  agentName?: string;
  onClose: () => void;
  isStreaming?: boolean;
  variant?: 'drawer' | 'desktop' | 'motion';
  showMinimize?: boolean;
  layoutId?: string;
  runningDurationMs?: number;
  completedDurationMs?: number;
}

const PanelHeader: React.FC<PanelHeaderProps> = memo(function PanelHeader({
  agentName,
  onClose,
  isStreaming = false,
  variant = 'desktop',
  showMinimize = false,
  layoutId,
  runningDurationMs = 0,
  completedDurationMs,
}) {
  const title = getComputerTitle(agentName);
  const showRunningIndicator = isStreaming;
  const showCompletedIndicator =
    !isStreaming && typeof completedDurationMs === 'number' && completedDurationMs > 0;
  const runningBadgeDesktop = showRunningIndicator ? (
    <RunningStatusBadge durationMs={runningDurationMs} className="hidden sm:flex" />
  ) : null;
  const runningBadgeMobile = showRunningIndicator ? (
    <RunningStatusBadge durationMs={runningDurationMs} className="sm:hidden" />
  ) : null;
  const completedBadgeDesktop = showCompletedIndicator ? (
    <CompletedStatusBadge durationMs={completedDurationMs} className="hidden sm:flex" />
  ) : null;
  const completedBadgeMobile = showCompletedIndicator ? (
    <CompletedStatusBadge durationMs={completedDurationMs} className="sm:hidden" />
  ) : null;
  
  if (variant === 'drawer') {
    return (
      <DrawerHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <DrawerTitle className="text-lg font-medium">
              {title}
            </DrawerTitle>
            {runningBadgeDesktop}
          </div>
          <div className="flex items-center gap-2">
            {completedBadgeDesktop}
            <Button
              variant="ghost"
              size="icon"
              onClick={onClose}
              className="h-8 w-8"
              title="Minimize to floating preview"
            >
              <Minimize2 className="h-4 w-4" />
            </Button>
          </div>
        </div>
        {(runningBadgeMobile || completedBadgeMobile) && (
          <div className="mt-2">
            {showRunningIndicator ? runningBadgeMobile : completedBadgeMobile}
          </div>
        )}
      </DrawerHeader>
    );
  }

  if (variant === 'motion') {
    return (
      <motion.div
        layoutId={layoutId}
        className="p-3"
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <motion.div layoutId="tool-icon" className="ml-2">
              <h2 className="text-lg font-medium text-zinc-900 dark:text-zinc-100">
                {title}
              </h2>
            </motion.div>
            {runningBadgeDesktop}
          </div>

          <div className="flex items-center gap-2">
            {completedBadgeDesktop}
            {showRunningIndicator ? runningBadgeMobile : completedBadgeMobile}
            <Button
              variant="ghost"
              size="icon"
              onClick={onClose}
              className="h-8 w-8"
              title="Minimize to floating preview"
            >
              <Minimize2 className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </motion.div>
    );
  }

  return (
    <div className="pt-4 pl-4 pr-4">
      <div className="flex items-center justify-between">
        <div className="flex-1"></div>
        <div className="flex items-center gap-3">
          <div className="ml-2">
            <h2 className="text-lg font-medium text-white/90">
              {title}
            </h2>
          </div>
          {runningBadgeDesktop}
        </div>
        <div className="flex-1 flex items-center justify-end gap-2">
          {completedBadgeDesktop}
          {showRunningIndicator ? runningBadgeMobile : completedBadgeMobile}
          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
            className="h-8 w-8"
            title={showMinimize ? "Minimize to floating preview" : "Close"}
          >
            {showMinimize ? <Minimize2 className="h-4 w-4" /> : <X className="h-4 w-4" />}
          </Button>
        </div>
      </div>
    </div>
  );
});

export function ToolCallSidePanel({
  isOpen,
  onClose,
  toolCalls,
  currentIndex,
  onNavigate,
  messages,
  agentStatus,
  project,
  isLoading = false,
  externalNavigateToIndex,
  agentName,
  onFileClick,
  disableInitialAnimation,
  compact = false,
  onSubmit,
  isAgentRunning = false,
  selectedModel,
  getActualModelId,
  selectedAgentId,
  chatMode = 'execute',
  onPopulateChatInput,
}: ToolCallSidePanelProps) {
  const [dots, setDots] = React.useState('');
  const [internalIndex, setInternalIndex] = React.useState(0);
  const [navigationMode, setNavigationMode] = React.useState<'live' | 'manual'>('live');
  const [toolCallSnapshots, setToolCallSnapshots] = React.useState<ToolCallSnapshot[]>([]);
  const [isInitialized, setIsInitialized] = React.useState(false);
  const [runStartTime, setRunStartTime] = React.useState<number | null>(null);
  const [runElapsedMs, setRunElapsedMs] = React.useState(0);
  const [lastRunDurationMs, setLastRunDurationMs] = React.useState<number | null>(null);
  const wasRunningRef = React.useRef(false);
  const hasRestoredTimerRef = React.useRef(false);

  // Generate localStorage key for timer persistence
  const getTimerStorageKey = React.useCallback(() => {
    const projectId = project?.id || 'unknown';
    const agentId = selectedAgentId || 'default';
    return `agent_timer_${projectId}_${agentId}`;
  }, [project?.id, selectedAgentId]);

  // Clean up old timer entries (older than 24 hours)
  React.useEffect(() => {
    try {
      const now = Date.now();
      const oneDayAgo = now - 24 * 60 * 60 * 1000; // 24 hours in milliseconds
      const keysToRemove: string[] = [];

      // Check all localStorage keys
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key?.startsWith('agent_timer_')) {
          try {
            const stored = localStorage.getItem(key);
            if (stored) {
              const data = JSON.parse(stored);
              if (data.startTime && data.startTime < oneDayAgo) {
                keysToRemove.push(key);
              }
            }
          } catch (e) {
            // Invalid data, remove it
            keysToRemove.push(key);
          }
        }
      }

      // Remove old entries
      keysToRemove.forEach(key => localStorage.removeItem(key));
    } catch (e) {
      // Silently fail if localStorage is not available
    }
  }, []); // Run once on mount

  // Restore timer from localStorage on mount or when key changes
  React.useEffect(() => {
    // Only restore once per key, or when key changes
    if (hasRestoredTimerRef.current && runStartTime !== null) {
      return; // Already restored and timer is active
    }

    try {
      const storageKey = getTimerStorageKey();
      const stored = localStorage.getItem(storageKey);
      
      if (stored) {
        const data = JSON.parse(stored);
        const storedStartTime = data.startTime;
        
        // Check if the stored time is valid and not too old (max 24 hours)
        const now = Date.now();
        const oneDayAgo = now - 24 * 60 * 60 * 1000;
        
        if (storedStartTime && storedStartTime > oneDayAgo) {
          // Check if agent appears to still be running (check both isAgentRunning and isStreaming)
          const isCurrentlyStreaming = toolCallSnapshots.some(
            snapshot => snapshot.toolCall.toolResult?.content === 'STREAMING'
          );
          const shouldRestore = isAgentRunning || isCurrentlyStreaming;
          
          if (shouldRestore && runStartTime === null) {
            setRunStartTime(storedStartTime);
            setRunElapsedMs(now - storedStartTime);
            wasRunningRef.current = true;
            hasRestoredTimerRef.current = true;
          } else if (!shouldRestore) {
            // Task completed, remove from storage
            localStorage.removeItem(storageKey);
            hasRestoredTimerRef.current = true;
          }
        } else {
          // Entry is too old, remove it
          localStorage.removeItem(storageKey);
          hasRestoredTimerRef.current = true;
        }
      } else {
        hasRestoredTimerRef.current = true;
      }
    } catch (e) {
      // Silently fail if localStorage is not available or data is corrupted
      hasRestoredTimerRef.current = true;
    }
  }, [getTimerStorageKey, isAgentRunning, toolCallSnapshots, runStartTime]); // Run when key, agent status, or tool calls change

  // Reset restore flag when key changes
  React.useEffect(() => {
    hasRestoredTimerRef.current = false;
  }, [getTimerStorageKey]);

  // Add copy functionality state
  // Add view toggle state  
  const [currentView, setCurrentView] = React.useState<'tools' | 'browser'>('tools');
  const currentViewRef = React.useRef(currentView);
  
  // Update ref when state changes
  React.useEffect(() => {
    currentViewRef.current = currentView;
  }, [currentView]);

  // Keep default view as 'tools' unless user switches

  const isMobile = useIsMobile();
  const { isOpen: isDocumentModalOpen } = useDocumentModalStore();

  const sandbox = project?.sandbox;
  
  // Add refresh key state for VNC iframe
  const [vncRefreshKey, setVncRefreshKey] = React.useState(0);
  
  const handleVncRefresh = useCallback(() => {
    setVncRefreshKey(prev => prev + 1);
  }, []);

  // Broadcast open/close state so layout can react (e.g., adjust sidebar width)
  React.useEffect(() => {
    try {
      window.dispatchEvent(new CustomEvent('tool-panel-open', { detail: { open: isOpen } }));
    } catch {}
  }, [isOpen]);

  const persistentVncIframe = useMemo(() => {
    if (!sandbox || !sandbox.vnc_preview || !sandbox.pass || !sandbox.id) return null;
    
    return (
      <div>
        <HealthCheckedVncIframe 
          key={vncRefreshKey}
          sandbox={{
            id: sandbox.id,
            vnc_preview: sandbox.vnc_preview,
            pass: sandbox.pass
          }}
        />
      </div>
    );
  }, [sandbox, vncRefreshKey]);

  // Helper function to check if a tool is browser-related
  const isBrowserTool = useCallback((toolName: string | undefined): boolean => {
    if (!toolName) return false;
    const lowerName = toolName.toLowerCase();
    return [
      'browser-navigate-to',
      'browser-act', 
      'browser-extract-content',
      'browser-screenshot'
    ].includes(lowerName);
  }, []);

  // Handle view toggle visibility and auto-switching logic
  React.useEffect(() => {
    const safeIndex = Math.min(internalIndex, Math.max(0, toolCallSnapshots.length - 1));
    const currentSnapshot = toolCallSnapshots[safeIndex];
    const isCurrentSnapshotBrowserTool = isBrowserTool(currentSnapshot?.toolCall.assistantCall?.name);
    
    // Handle view switching based on agent status
    if (agentStatus === 'idle') {
      // Switch to tools view when navigating to a non-browser tool
      if (!isCurrentSnapshotBrowserTool && currentViewRef.current === 'browser') {
        setCurrentView('tools');
      }
      // Switch to browser view when navigating to the latest browser tool
      if (isCurrentSnapshotBrowserTool && currentViewRef.current === 'tools' && safeIndex === toolCallSnapshots.length - 1) {
        setCurrentView('browser');
      }
    } else if (agentStatus === 'running') {
      // Auto-switch for streaming tools when agent is actively running
      const streamingSnapshot = toolCallSnapshots.find(snapshot => 
        snapshot.toolCall.toolResult?.content === 'STREAMING'
      );
      
      if (streamingSnapshot) {
        const streamingToolCall = streamingSnapshot.toolCall;
        const toolName = streamingToolCall.assistantCall?.name;
        const isStreamingBrowserTool = isBrowserTool(toolName);
        
        // Switch to browser view when a browser tool starts streaming and we're in tools view
        if (isStreamingBrowserTool && currentViewRef.current === 'tools') {
          setCurrentView('browser');
        }
        
        // Switch to tools view when a non-browser tool starts streaming and we're in browser view
        if (!isStreamingBrowserTool && currentViewRef.current === 'browser') {
          setCurrentView('tools');
        }
      }
    }
  }, [toolCallSnapshots, internalIndex, isBrowserTool, agentStatus]);

  const handleClose = useCallback(() => {
    onClose();
  }, [onClose]);

  // Memoize snapshot creation to prevent unnecessary recalculations
  const newSnapshots = useMemo(() => {
    return toolCalls.map((toolCall, index) => ({
      id: `${index}-${toolCall.assistantCall.timestamp || Date.now()}`,
      toolCall,
      index,
      timestamp: Date.now(),
    }));
  }, [toolCalls]);

  React.useEffect(() => {
    const hadSnapshots = toolCallSnapshots.length > 0;
    const hasNewSnapshots = newSnapshots.length > toolCallSnapshots.length;
    setToolCallSnapshots(newSnapshots);

    if (!isInitialized && newSnapshots.length > 0) {
      const completedCount = newSnapshots.filter(s =>
        s.toolCall.toolResult?.content &&
        s.toolCall.toolResult.content !== 'STREAMING'
      ).length;

      if (completedCount > 0) {
        let lastCompletedIndex = -1;
        for (let i = newSnapshots.length - 1; i >= 0; i--) {
          const snapshot = newSnapshots[i];
          if (snapshot.toolCall.toolResult?.content &&
            snapshot.toolCall.toolResult.content !== 'STREAMING') {
            lastCompletedIndex = i;
            break;
          }
        }
        setInternalIndex(Math.max(0, lastCompletedIndex));
      } else {
        setInternalIndex(Math.max(0, newSnapshots.length - 1));
      }
      setIsInitialized(true);
    } else if (hasNewSnapshots && navigationMode === 'live') {
      // When in live mode and new snapshots arrive, always follow the true latest index.
      // Display stability for streaming is handled separately by displayToolCall logic.
      setInternalIndex(newSnapshots.length - 1);
    } else if (hasNewSnapshots && navigationMode === 'manual') {
      // When in manual mode and new snapshots arrive, check if we should auto-switch to live
      // This happens when the user was at the latest snapshot before new ones arrived
      const wasAtLatest = internalIndex === toolCallSnapshots.length - 1;
      if (wasAtLatest && agentStatus === 'running') {
        // Auto-switch to live mode when new snapshots arrive and we were at the latest
        setNavigationMode('live');
        setInternalIndex(newSnapshots.length - 1);
      }
    }
  }, [toolCalls, navigationMode, toolCallSnapshots.length, isInitialized, internalIndex, agentStatus]);

  React.useEffect(() => {
    // This is used to sync the internal index to the current index
    // Only sync when we're not in live mode, when we're initializing, and when there are tool calls
    if ((!isInitialized || navigationMode === 'manual') && toolCallSnapshots.length > 0) {
      setInternalIndex(Math.min(currentIndex, toolCallSnapshots.length - 1));
    }
  }, [currentIndex, toolCallSnapshots.length, isInitialized, navigationMode]);

  // Memoize expensive calculations
  const { safeInternalIndex, currentSnapshot, currentToolCall, totalCalls, latestIndex, completedToolCalls, totalCompletedCalls } = useMemo(() => {
    const safeIndex = Math.min(internalIndex, Math.max(0, toolCallSnapshots.length - 1));
    const snapshot = toolCallSnapshots[safeIndex];
    const toolCall = snapshot?.toolCall;
    const total = toolCallSnapshots.length;
    const latest = Math.max(0, total - 1);

    const completed = toolCallSnapshots.filter(snapshot =>
      snapshot.toolCall.toolResult?.content &&
      snapshot.toolCall.toolResult.content !== 'STREAMING'
    );
    const completedCount = completed.length;

    return {
      safeInternalIndex: safeIndex,
      currentSnapshot: snapshot,
      currentToolCall: toolCall,
      totalCalls: total,
      latestIndex: latest,
      completedToolCalls: completed,
      totalCompletedCalls: completedCount
    };
  }, [internalIndex, toolCallSnapshots]);

  // Derive a user-facing timeline that is stable and easy to reason about:
  // - If the current tool is STREAMING, show the last completed result content;
  // - Counters/slider always show the full timeline length, but the index snaps to
  //   the last completed step while streaming so the user can still scrub.
  let displayToolCall = currentToolCall;
  let displayIndex = safeInternalIndex;
  const displayTotalCalls = totalCalls;

  const isCurrentToolStreaming = currentToolCall?.toolResult?.content === 'STREAMING';
  if (isCurrentToolStreaming && totalCompletedCalls > 0) {
    const lastCompletedSnapshot = completedToolCalls[completedToolCalls.length - 1];
    displayToolCall = lastCompletedSnapshot.toolCall;
    displayIndex = completedToolCalls.length - 1;
  }

  const isStreaming = displayToolCall?.toolResult?.content === 'STREAMING';
  const showRunningState = isAgentRunning || isStreaming;
  const runningDurationMs = showRunningState ? runElapsedMs : 0;
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

  React.useEffect(() => {
    const wasRunning = wasRunningRef.current;
    const storageKey = getTimerStorageKey();

    if (showRunningState) {
      if (!wasRunning) {
        const startTime = Date.now();
        setRunStartTime(startTime);
        setLastRunDurationMs(null);
        setRunElapsedMs(0);
        
        // Save to localStorage
        try {
          localStorage.setItem(storageKey, JSON.stringify({ startTime }));
        } catch (e) {
          // Silently fail if localStorage is not available
        }
      }
    } else if (wasRunning) {
      setLastRunDurationMs(prev => {
        if (runStartTime !== null) {
          return Date.now() - runStartTime;
        }
        return prev;
      });
      setRunStartTime(null);
      setRunElapsedMs(0);
      
      // Remove from localStorage when task completes
      try {
        localStorage.removeItem(storageKey);
      } catch (e) {
        // Silently fail if localStorage is not available
      }
    }

    wasRunningRef.current = showRunningState;
  }, [showRunningState, runStartTime, getTimerStorageKey]);

  const completedDurationMs =
    !showRunningState && typeof lastRunDurationMs === 'number' && lastRunDurationMs > 0
      ? lastRunDurationMs
      : null;

  // Extract actual success value from tool content with fallbacks
  const getActualSuccess = (toolCall: any): boolean => {
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

  const isSuccess = isStreaming ? true : getActualSuccess(displayToolCall);

  // Copy functions
  const copyToClipboard = React.useCallback(async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch (err) {
      console.error('Failed to copy text: ', err);
      return false;
    }
  }, []);

  const handleCopyContent = React.useCallback(async () => {
    const toolContent = displayToolCall?.toolResult?.content;
    if (!toolContent || toolContent === 'STREAMING') return;

    // Try to extract file content from tool result
    let fileContent = '';

    // If the tool result is JSON, try to extract file content
    try {
      const parsed = JSON.parse(toolContent);
      if (parsed.content && typeof parsed.content === 'string') {
        fileContent = parsed.content;
      } else if (parsed.file_content && typeof parsed.file_content === 'string') {
        fileContent = parsed.file_content;
      } else if (parsed.result && typeof parsed.result === 'string') {
        fileContent = parsed.result;
      } else if (parsed.toolOutput && typeof parsed.toolOutput === 'string') {
        fileContent = parsed.toolOutput;
      } else {
        // If no string content found, stringify the object
        fileContent = JSON.stringify(parsed, null, 2);
      }
    } catch (e) {
      // If it's not JSON, use the content as is
      fileContent = typeof toolContent === 'string' ? toolContent : JSON.stringify(toolContent, null, 2);
    }

    const success = await copyToClipboard(fileContent);
    if (success) {
      toast.success('File content copied to clipboard');
    } else {
      toast.error('Failed to copy file content');
    }
  }, [displayToolCall?.toolResult?.content, copyToClipboard]);

  const internalNavigate = useCallback((newIndex: number, source: string = 'internal') => {
    if (newIndex < 0 || newIndex >= totalCalls) return;

    const isNavigatingToLatest = newIndex === totalCalls - 1;
    setInternalIndex(newIndex);

    if (isNavigatingToLatest) {
      setNavigationMode('live');
    } else {
      setNavigationMode('manual');
    }

    if (source === 'user_explicit') {
      onNavigate(newIndex);
    }
  }, [totalCalls, onNavigate]);

  const isLiveMode = navigationMode === 'live';
  const pointerIndex = isLiveMode ? latestIndex : safeInternalIndex;

  const navigateToPrevious = useCallback(() => {
    if (pointerIndex > 0) {
      setNavigationMode('manual');
      internalNavigate(pointerIndex - 1, 'user_explicit');
    }
  }, [pointerIndex, internalNavigate]);

  const navigateToNext = useCallback(() => {
    if (pointerIndex < latestIndex) {
      const nextIndex = pointerIndex + 1;
      setNavigationMode(nextIndex === latestIndex ? 'live' : 'manual');
      internalNavigate(nextIndex, 'user_explicit');
    }
  }, [pointerIndex, latestIndex, internalNavigate]);

  const jumpToLive = useCallback(() => {
    setNavigationMode('live');
    setInternalIndex(latestIndex);
    internalNavigate(latestIndex, 'user_explicit');
  }, [latestIndex, internalNavigate]);

  const jumpToLatest = useCallback(() => {
    // For idle state: jump to the latest completed (same as latestIndex here)
    setNavigationMode('manual');
    setInternalIndex(latestIndex);
    internalNavigate(latestIndex, 'user_explicit');
  }, [latestIndex, internalNavigate]);

  const renderStatusButton = useCallback(() => {
    const baseClasses = "flex items-center justify-center gap-1.5 px-2 py-0.5 rounded-full w-[116px] border transition-colors cursor-pointer";
    const dotClasses = "w-1.5 h-1.5 rounded-full";
    const textClasses = "text-xs font-medium";

    if (isLiveMode) {
      if (agentStatus === 'running') {
        return (
          <div
            className={`${baseClasses} bg-white/10 border-white/20 hover:bg-white/15 light:bg-white/10 light:border-white/20 light:hover:bg-white/15`}
            onClick={jumpToLive}
            title="Follow live updates"
          >
            <div className={`${dotClasses} bg-emerald-400 animate-pulse`} />
            <span className={`${textClasses} text-white/80 light:text-zinc-700`}>Live Updates</span>
          </div>
        );
      } else {
        return (
          <div className={`${baseClasses} bg-white/10 border-white/20 light:bg-black/5 light:border-black/10`} title="Showing latest tool">
            <div className={`${dotClasses} bg-white/60`} />
            <span className={`${textClasses} text-white/80 light:text-zinc-700`}>Latest Tool</span>
          </div>
        );
      }
    } else {
      if (agentStatus === 'running') {
        return (
          <div
            className={`${baseClasses} bg-white/10 border-white/20 hover:bg-white/15 light:bg-white/10 light:border-white/20 light:hover:bg-white/15`}
            onClick={jumpToLive}
            title="Jump to live"
          >
            <div className={`${dotClasses} bg-emerald-400 animate-pulse`} />
            <span className={`${textClasses} text-white/80 light:text-zinc-700`}>Jump to Live</span>
          </div>
        );
      } else {
        return (
          <div
            className={`${baseClasses} bg-white/10 border-white/20 hover:bg-white/15 light:bg-white/10 light:border-white/20 light:hover:bg-white/15`}
            onClick={jumpToLatest}
            title="Jump to latest"
          >
            <div className={`${dotClasses} bg-white/70`} />
            <span className={`${textClasses} text-white/80 light:text-zinc-700`}>Hop to Latest</span>
          </div>
        );
      }
    }
  }, [isLiveMode, agentStatus, jumpToLive, jumpToLatest]);

  const handleSliderChange = useCallback(([newValue]: [number]) => {
    // Slider maps directly over all snapshots for simplicity and correctness
    const bounded = Math.max(0, Math.min(newValue, latestIndex));
    setNavigationMode(bounded === latestIndex ? 'live' : 'manual');
    internalNavigate(bounded, 'user_explicit');
  }, [latestIndex, internalNavigate]);

  React.useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      // Don't handle side panel shortcuts when document modal is open
      // console.log('Side panel handler - document modal open:', isDocumentModalOpen, 'key:', event.key);
      if (isDocumentModalOpen) return;
      
      if (event.key === 'Tab') {
        event.preventDefault();
        handleClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, handleClose, isDocumentModalOpen]);

  React.useEffect(() => {
    if (!isOpen) return;
    const handleSidebarToggle = (event: CustomEvent) => {
      if (event.detail.expanded) {
        handleClose();
      }
    };

    window.addEventListener(
      'sidebar-left-toggled',
      handleSidebarToggle as EventListener,
    );
    return () =>
      window.removeEventListener(
        'sidebar-left-toggled',
        handleSidebarToggle as EventListener,
      );
  }, [isOpen, handleClose]);

  React.useEffect(() => {
    if (externalNavigateToIndex !== undefined && externalNavigateToIndex >= 0 && externalNavigateToIndex < totalCalls) {
      internalNavigate(externalNavigateToIndex, 'external_click');
    }
  }, [externalNavigateToIndex, totalCalls, internalNavigate]);

  React.useEffect(() => {
    if (!isStreaming) return;
    const interval = setInterval(() => {
      setDots((prev) => {
        if (prev === '...') return '';
        return prev + '.';
      });
    }, 500);

    return () => clearInterval(interval);
  }, [isStreaming]);

  if (!isOpen) {
    return null;
  }

  if (isLoading) {
    if (isMobile) {
      return (
        <Drawer open={isOpen} onOpenChange={(open) => !open && onClose()}>
          <DrawerContent className="h-[85vh]">
            <PanelHeader 
              agentName={agentName}
              onClose={handleClose}
              variant="drawer"
              isStreaming={showRunningState}
              runningDurationMs={runningDurationMs}
              completedDurationMs={completedDurationMs}
            />
            
            <div className="flex-1 p-4 overflow-auto">
              <div className="space-y-4">
                <Skeleton className="h-8 w-32" />
                <Skeleton className="h-20 w-full rounded-md" />
                <Skeleton className="h-40 w-full rounded-md" />
                <Skeleton className="h-20 w-full rounded-md" />
              </div>
            </div>
          </DrawerContent>
        </Drawer>
      );
    }

    return (
      <div className="fixed inset-0 z-30 pointer-events-none">
        <div className="p-4 h-full flex items-stretch justify-end pointer-events-auto">
          <div className="border rounded-2xl flex flex-col shadow-2xl bg-background w-[90%] sm:w-[450px] md:w-[500px] lg:w-[550px] xl:w-[650px]">
            <div className="flex-1 flex flex-col overflow-hidden">
              <div className="flex flex-col h-full">
                <PanelHeader 
                  agentName={agentName}
                  onClose={handleClose}
                  showMinimize={true}
                  isStreaming={showRunningState}
                  runningDurationMs={runningDurationMs}
                  completedDurationMs={completedDurationMs}
                />
                <div className="flex-1 p-4 overflow-auto">
                  <div className="space-y-4">
                    <Skeleton className="h-8 w-32" />
                    <Skeleton className="h-20 w-full rounded-md" />
                    <Skeleton className="h-40 w-full rounded-md" />
                    <Skeleton className="h-20 w-full rounded-md" />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const renderContent = () => {
    if (!displayToolCall && toolCallSnapshots.length === 0) {
      return (
        <div className="flex flex-col h-full">
          {!isMobile && (
            <PanelHeader 
              agentName={agentName}
              onClose={handleClose}
              isStreaming={showRunningState}
              runningDurationMs={runningDurationMs}
              completedDurationMs={completedDurationMs}
            />
          )}
          <div className="flex flex-col items-center justify-center flex-1 p-8">
            <div className="flex flex-col items-center space-y-4 max-w-sm text-center">
              <div className="relative">
                <div className="w-16 h-16 bg-zinc-100 dark:bg-zinc-800 rounded-full flex items-center justify-center">
                  <Computer className="h-8 w-8 text-zinc-400 dark:text-zinc-500" />
                </div>
                <div className="absolute -bottom-1 -right-1 w-6 h-6 bg-zinc-200 dark:bg-zinc-700 rounded-full flex items-center justify-center">
                  <div className="w-2 h-2 bg-zinc-400 dark:text-zinc-500 rounded-full"></div>
                </div>
              </div>
              <div className="space-y-2">
                <h3 className="text-lg font-medium text-zinc-900 dark:text-zinc-100">
                  No tool activity
                </h3>
                <p className="text-sm text-zinc-500 dark:text-zinc-400 leading-relaxed">
                  Tool calls and computer interactions will appear here when they're being executed.
                </p>
              </div>
            </div>
          </div>
        </div>
      );
    }

    if (!displayToolCall && toolCallSnapshots.length > 0) {
      const firstStreamingTool = toolCallSnapshots.find(s => s.toolCall.toolResult?.content === 'STREAMING');
      if (firstStreamingTool && totalCompletedCalls === 0) {
        return (
          <div className="flex flex-col h-full">
            {!isMobile && (
              <PanelHeader 
                agentName={agentName}
                onClose={handleClose}
                isStreaming={showRunningState || !!firstStreamingTool}
                runningDurationMs={runningDurationMs}
                completedDurationMs={completedDurationMs}
              />
            )}
            {isMobile && (
              <div className="px-4 pb-2">
                <div className="flex items-center justify-center">
                  <div className="rounded-full border border-emerald-400/30 bg-emerald-500/15 px-3 py-1 shadow-[0_0_12px_rgba(16,185,129,0.25)] dark:border-emerald-400/35 dark:bg-emerald-500/15">
                    <RunningStatusBadge durationMs={runningDurationMs} />
                  </div>
                </div>
              </div>
            )}
            <div className="flex flex-col items-center justify-center flex-1 p-8">
              <div className="flex flex-col items-center space-y-4 max-w-sm text-center">
                <div className="relative">
                  <div className="w-16 h-16 bg-blue-50 dark:bg-blue-900/20 rounded-full flex items-center justify-center">
                    <CircleDashed className="h-8 w-8 text-blue-500 dark:text-blue-400 animate-spin" />
                  </div>
                </div>
                <div className="space-y-2">
                  <h3 className="text-lg font-medium text-zinc-900 dark:text-zinc-100">
                    Tool is running
                  </h3>
                  <p className="text-sm text-zinc-500 dark:text-zinc-400 leading-relaxed">
                    {getUserFriendlyToolName(firstStreamingTool.toolCall.assistantCall.name || 'Tool')} is currently executing. Results will appear here when complete.
                  </p>
                </div>
              </div>
            </div>
          </div>
        );
      }

      return (
        <div className="flex flex-col h-full">
          {!isMobile && (
            <PanelHeader 
              agentName={agentName}
              onClose={handleClose}
              isStreaming={showRunningState}
              runningDurationMs={runningDurationMs}
              completedDurationMs={completedDurationMs}
            />
          )}
          <div className="flex-1 p-4 overflow-auto">
            <div className="space-y-4">
              <Skeleton className="h-8 w-32" />
              <Skeleton className="h-20 w-full rounded-md" />
            </div>
          </div>
        </div>
      );
    }

    const toolView = (
      <ToolView
        name={displayToolCall.assistantCall.name}
        assistantContent={displayToolCall.assistantCall.content}
        toolContent={displayToolCall.toolResult?.content}
        assistantTimestamp={displayToolCall.assistantCall.timestamp}
        toolTimestamp={displayToolCall.toolResult?.timestamp}
        isSuccess={isSuccess}
        isStreaming={isStreaming}
        project={project}
        messages={messages}
        agentStatus={agentStatus}
        currentIndex={displayIndex}
        totalCalls={displayTotalCalls}
        onFileClick={onFileClick}
        viewToggle={<ViewToggle currentView={currentView} onViewChange={setCurrentView} />}
        onSubmit={onSubmit}
        isAgentRunning={isAgentRunning}
        selectedModel={selectedModel}
        getActualModelId={getActualModelId}
        selectedAgentId={selectedAgentId}
        chatMode={chatMode}
        onPopulateChatInput={onPopulateChatInput}
      />
    );

    return (
      <div className="flex flex-col h-full">
        {!isMobile && (
          <PanelHeader 
            agentName={agentName}
            onClose={handleClose}
            isStreaming={showRunningState}
            variant="motion"
            layoutId={CONTENT_LAYOUT_ID}
            runningDurationMs={runningDurationMs}
            completedDurationMs={completedDurationMs}
          />
        )}

          <div className={`flex-1 ${currentView === 'browser' ? 'overflow-hidden' : 'overflow-hidden'} scrollbar-thin scrollbar-thumb-zinc-300 dark:scrollbar-thumb-zinc-700 scrollbar-track-transparent`}>
          {/* Always render VNC iframe to maintain connection when available */}
          {persistentVncIframe && (
            <div className={`${currentView === 'browser' ? 'h-full flex flex-col' : 'hidden'}`}>
              <BrowserHeader isConnected={true} onRefresh={handleVncRefresh} viewToggle={<ViewToggle currentView={currentView} onViewChange={setCurrentView} />} />
              {/* VNC iframe container - unchanged */}
              <div className="flex-1 overflow-hidden grid items-center">
                {persistentVncIframe}
              </div>
            </div>
          )}
          
          {/* Show browser not available message when no VNC and browser tab is selected */}
          {!persistentVncIframe && currentView === 'browser' && (
            <div className="h-full flex flex-col">
              <BrowserHeader isConnected={false} viewToggle={<ViewToggle currentView={currentView} onViewChange={setCurrentView} />} />
              
              {/* Message content */}
              <div className="flex-1 flex flex-col items-center justify-center p-8 bg-zinc-50 dark:bg-zinc-900/50">
                <div className="flex flex-col items-center space-y-4 max-w-sm text-center">
                  <div className="w-16 h-16 bg-zinc-100 dark:bg-zinc-800 rounded-full flex items-center justify-center border-2 border-zinc-200 dark:border-zinc-700">
                    <Globe className="h-8 w-8 text-zinc-400 dark:text-zinc-500" />
                  </div>
                  <div className="space-y-2">
                    <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
                      Browser not available
                    </h3>
                    <p className="text-sm text-zinc-500 dark:text-zinc-400 leading-relaxed">
                      No active browser session available. The browser will appear here when a sandbox is created and Browser tools are used.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}
          
          {/* Render tool view when tools tab is selected */}
          {currentView === 'tools' && toolView}
        </div>
      </div>
    );
  };

  // Mobile version - use drawer
  if (isMobile) {
    return (
      <Drawer open={isOpen} onOpenChange={(open) => !open && onClose()}>
        <DrawerContent className="h-[85vh]">
          <PanelHeader 
            agentName={agentName}
            onClose={handleClose}
            variant="drawer"
            isStreaming={showRunningState}
            runningDurationMs={runningDurationMs}
            completedDurationMs={completedDurationMs}
          />
          
          <div className="flex-1 flex flex-col overflow-hidden">
            <div className="flex-1 min-h-0">
              {renderContent()}
            </div>
            {(displayTotalCalls > 1 || (isCurrentToolStreaming && totalCompletedCalls > 0)) && (
              <div className="p-3">
                <div className="relative rounded-2xl border border-white/10 bg-white/10 backdrop-blur-sm px-3 py-2">
                  <div aria-hidden className="pointer-events-none absolute inset-0 rounded-2xl" style={{
                    background: 'linear-gradient(180deg, rgba(173,216,255,0.10), rgba(255,255,255,0.04) 30%, rgba(150,160,255,0.10) 85%, rgba(255,255,255,0.06))',
                    WebkitMask: 'linear-gradient(#000,#000) content-box, linear-gradient(#000,#000)',
                    WebkitMaskComposite: 'xor',
                    maskComposite: 'exclude',
                    padding: '1px',
                    borderRadius: '16px'
                  }} />
                  <div className="relative flex items-center justify-between gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={navigateToPrevious}
                      disabled={displayIndex <= 0}
                      className="h-8 px-2.5 text-xs text-white/70 hover:text-white/90 disabled:opacity-40 light:text-black light:hover:text-black"
                    >
                      <ChevronLeft className="h-3.5 w-3.5 mr-1" />
                      <span>Prev</span>
                    </Button>

                    <div className="flex-1 flex items-center gap-2">
                      <span className="text-xs text-white/70 light:text-black font-medium tabular-nums min-w-[44px] text-center">
                        {safeInternalIndex + 1}/{totalCalls}
                      </span>
                      <div className="flex-1">
                        <Slider
                          min={0}
                          max={Math.max(0, totalCalls - 1)}
                          step={1}
                          value={[safeInternalIndex]}
                          onValueChange={handleSliderChange}
                          className="w-full [&>span:first-child]:h-1.5 [&>span:first-child]:bg-white/15 [&>span:first-child>span]:bg-white/60 [&>span:first-child>span]:h-1.5 light:[&>span:first-child]:bg-black/10 light:[&>span:first-child>span]:bg-black/30"
                        />
                      </div>
                      <div className="shrink-0">
                        {renderStatusButton()}
                      </div>
                    </div>

                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={navigateToNext}
                      disabled={displayIndex >= displayTotalCalls - 1}
                      className="h-8 px-2.5 text-xs text-white/70 hover:text-white/90 disabled:opacity-40 light:text-black light:hover:text-black"
                    >
                      <span>Next</span>
                      <ChevronRight className="h-3.5 w-3.5 ml-1" />
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </DrawerContent>
      </Drawer>
    );
  }

  // Desktop version - use fixed panel
  return (
    <AnimatePresence mode="wait">
      {isOpen && (
        <motion.div
          key="sidepanel"
          layoutId={FLOATING_LAYOUT_ID}
          initial={disableInitialAnimation ? { opacity: 1 } : { opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{
            opacity: { duration: disableInitialAnimation ? 0 : 0.15 },
            layout: {
              type: "spring",
              stiffness: 400,
              damping: 35
            }
          }}
          className={compact 
            ? "m-4 h-[calc(100%-2rem)] w-[calc(100%-2rem)] border rounded-3xl flex flex-col z-30"
            : "fixed top-2 right-2 bottom-4 border rounded-3xl flex flex-col z-30 w-[40vw] sm:w-[450px] md:w-[500px] lg:w-[550px] xl:w-[645px]"
          }
          style={{
            overflow: 'hidden',
          }}
        >
          <div className="flex-1 flex flex-col overflow-hidden relative rounded-3xl border border-white/10 bg-[rgba(7,10,17,0.95)] shadow-[inset_0_0_0_1px_rgba(255,255,255,0.04)] light:border-black/10 light:bg-[rgba(255,255,255,0.25)] light:backdrop-blur-2xl light:shadow-[0_20px_60px_-10px_rgba(0,0,0,0.05)] light:shadow-[inset_0_1px_0_0_rgba(0,0,0,0.06)]">
            {/* Gradient rim */}
            <div aria-hidden="true" className="pointer-events-none absolute inset-0 rounded-3xl" style={{
              background: 'linear-gradient(180deg, rgba(173,216,255,0.10), rgba(255,255,255,0.04) 30%, rgba(150,160,255,0.10) 85%, rgba(255,255,255,0.06))',
              WebkitMask: 'linear-gradient(#000,#000) content-box, linear-gradient(#000,#000)',
              WebkitMaskComposite: 'xor',
              maskComposite: 'exclude',
              padding: '1px',
              borderRadius: '24px'
            }} 
            data-light-gradient="linear-gradient(180deg, rgba(0,0,0,0.06), rgba(0,0,0,0.02) 30%, rgba(0,0,0,0.05) 85%, rgba(0,0,0,0.03))"
            data-dark-gradient="linear-gradient(180deg, rgba(173,216,255,0.10), rgba(255,255,255,0.04) 30%, rgba(150,160,255,0.10) 85%, rgba(255,255,255,0.06))"
            />
            {/* Specular streak */}
            <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-0 h-20" style={{
              background: 'linear-gradient(180deg, rgba(255,255,255,0.22), rgba(255,255,255,0.06) 45%, rgba(255,255,255,0) 100%)',
              filter: 'blur(6px)',
              mixBlendMode: 'screen'
            }} 
            data-light-streak="linear-gradient(180deg, rgba(0,0,0,0.08), rgba(0,0,0,0.03) 45%, rgba(0,0,0,0) 100%)"
            data-dark-streak="linear-gradient(180deg, rgba(255,255,255,0.22), rgba(255,255,255,0.06) 45%, rgba(255,255,255,0) 100%)"
            />
            {/* Fine noise */}
            <div aria-hidden="true" className="pointer-events-none absolute inset-0 opacity-20" style={{
              backgroundImage: `url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='60' height='60'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.8' numOctaves='4'/><feColorMatrix type='saturate' values='0'/><feComponentTransfer><feFuncA type='table' tableValues='0 0.03'/></feComponentTransfer></filter><rect width='100%' height='100%' filter='url(%23n)' /></svg>")`,
              backgroundSize: '100px 100px',
              mixBlendMode: 'overlay'
            }} />

            <div className="relative z-10 flex-1 flex flex-col overflow-hidden pb-2">
              <div className="flex-1 min-h-0">
                {renderContent()}
              </div>
              {(displayTotalCalls > 1 || (isCurrentToolStreaming && totalCompletedCalls > 0)) && (
                <div className="mt-auto px-4 py-2.5">
                  <div className="relative rounded-2xl border border-white/10 bg-white/10 backdrop-blur-sm px-3 py-2 light:border-black/10 light:bg-black/5 light:backdrop-blur-sm">
                    {/* subtle inner rim */}
                    <div aria-hidden className="pointer-events-none absolute inset-0 rounded-2xl" style={{
                      background: 'linear-gradient(180deg, rgba(173,216,255,0.10), rgba(255,255,255,0.04) 30%, rgba(150,160,255,0.10) 85%, rgba(255,255,255,0.06))',
                      WebkitMask: 'linear-gradient(#000,#000) content-box, linear-gradient(#000,#000)',
                      WebkitMaskComposite: 'xor',
                      maskComposite: 'exclude',
                      padding: '1px',
                      borderRadius: '16px'
                    }} 
                    data-light-gradient="linear-gradient(180deg, rgba(0,0,0,0.06), rgba(0,0,0,0.02) 30%, rgba(0,0,0,0.05) 85%, rgba(0,0,0,0.03))"
                    data-dark-gradient="linear-gradient(180deg, rgba(173,216,255,0.10), rgba(255,255,255,0.04) 30%, rgba(150,160,255,0.10) 85%, rgba(255,255,255,0.06))"
                    />
                    <div className="relative flex items-center gap-3">
                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={navigateToPrevious}
                          disabled={displayIndex <= 0}
                          className="h-7 w-7 text-white/70 hover:text-white/90 disabled:opacity-40 light:text-black light:hover:text-black"
                          title="Previous"
                        >
                          <ChevronLeft className="h-4 w-4" />
                        </Button>
                        <span className="text-xs text-white/70 font-medium tabular-nums px-1 min-w-[44px] text-center light:text-black">
                          {displayIndex + 1}/{displayTotalCalls}
                        </span>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={navigateToNext}
                          disabled={safeInternalIndex >= latestIndex}
                          className="h-7 w-7 text-white/70 hover:text-white/90 disabled:opacity-40 light:text-black light:hover:text-black"
                          title="Next"
                        >
                          <ChevronRight className="h-4 w-4" />
                        </Button>
                      </div>

                      <div className="flex-1 relative">
                        <Slider
                          min={0}
                          max={Math.max(0, totalCalls - 1)}
                          step={1}
                          value={[safeInternalIndex]}
                          onValueChange={handleSliderChange}
                          className="w-full [&>span:first-child]:h-1.5 [&>span:first-child]:bg-white/15 [&>span:first-child>span]:bg-white/60 [&>span:first-child>span]:h-1.5"
                        />
                      </div>

                      <div className="flex items-center gap-1.5">
                        {renderStatusButton()}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
          {/* Footer timeline moved inside container above */}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
