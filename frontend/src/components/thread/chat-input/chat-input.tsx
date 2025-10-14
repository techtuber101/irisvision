'use client';

import React, {
  useState,
  useRef,
  useEffect,
  forwardRef,
  useImperativeHandle,
  useCallback,
  useMemo,
  memo,
} from 'react';
import { useAgents } from '@/hooks/react-query/agents/use-agents';
import { useAgentSelection } from '@/lib/stores/agent-selection-store';

import { Card, CardContent } from '@/components/ui/card';
import { handleFiles, FileUploadHandler } from './file-upload-handler';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Loader2, ArrowUp, X, Image as ImageIcon, Presentation, BarChart3, FileText, Search, Users, Code2, Sparkles, Brain as BrainIcon, MessageSquare, Zap as ZapIcon } from 'lucide-react';
import { VoiceRecorder } from './voice-recorder';
import { UnifiedConfigMenu } from './unified-config-menu';
import { AttachmentGroup } from '../attachment-group';
import { cn } from '@/lib/utils';
import { useModelSelection } from '@/hooks/use-model-selection';
import { useFileDelete } from '@/hooks/react-query/files';
import { useQueryClient } from '@tanstack/react-query';
import { ToolCallInput } from './floating-tool-preview';
import { ChatSnack } from './chat-snack';
import { Brain, Zap, Database, ArrowDown, Wrench } from 'lucide-react';
import { useComposioToolkitIcon } from '@/hooks/react-query/composio/use-composio';
import { Skeleton } from '@/components/ui/skeleton';

import { IntegrationsRegistry } from '@/components/agents/integrations-registry';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useSubscriptionData } from '@/contexts/SubscriptionContext';
import { isStagingMode, isLocalMode } from '@/lib/config';
import { BillingModal } from '@/components/billing/billing-modal';
import { AgentConfigurationDialog } from '@/components/agents/agent-configuration-dialog';

import posthog from 'posthog-js';

// Helper function to get the icon for each mode
const getModeIcon = (mode: string) => {
  const iconClass = "w-4 h-4";
  switch (mode) {
    case 'research':
      return <Search className={iconClass} />;
    case 'people':
      return <Users className={iconClass} />;
    case 'code':
      return <Code2 className={iconClass} />;
    case 'docs':
      return <FileText className={iconClass} />;
    case 'data':
      return <BarChart3 className={iconClass} />;
    case 'slides':
      return <Presentation className={iconClass} />;
    case 'image':
      return <ImageIcon className={iconClass} />;
    default:
      return null;
  }
};

export type SubscriptionStatus = 'no_subscription' | 'active';

export interface ChatInputHandles {
  getPendingFiles: () => File[];
  clearPendingFiles: () => void;
}

export type ChatMode = 'chat' | 'execute';

export interface ChatInputProps {
  onSubmit: (
    message: string,
    options?: {
      model_name?: string;
      agent_id?: string;
      chat_mode?: ChatMode;
    },
  ) => void;
  placeholder?: string;
  loading?: boolean;
  disabled?: boolean;
  isAgentRunning?: boolean;
  onStopAgent?: () => void;
  autoFocus?: boolean;
  value?: string;
  onChange?: (value: string) => void;
  onFileBrowse?: () => void;
  sandboxId?: string;
  hideAttachments?: boolean;
  selectedAgentId?: string;
  onAgentSelect?: (agentId: string | undefined) => void;
  agentName?: string;
  messages?: any[];
  bgColor?: string;
  toolCalls?: ToolCallInput[];
  toolCallIndex?: number;
  showToolPreview?: boolean;
  onExpandToolPreview?: () => void;
  isLoggedIn?: boolean;
  enableAdvancedConfig?: boolean;
  onConfigureAgent?: (agentId: string) => void;
  hideAgentSelection?: boolean;
  defaultShowSnackbar?: 'tokens' | 'upgrade' | false;
  showToLowCreditUsers?: boolean;
  showScrollToBottomIndicator?: boolean;
  onScrollToBottom?: () => void;
  selectedMode?: string | null;
  onModeDeselect?: () => void;
  animatePlaceholder?: boolean;
  selectedCharts?: string[];
  selectedOutputFormat?: string | null;
  initialChatMode?: ChatMode;
  onChatModeChange?: (mode: ChatMode) => void;
}

export interface UploadedFile {
  name: string;
  path: string;
  size: number;
  type: string;
  localUrl?: string;
}



export const ChatInput = memo(forwardRef<ChatInputHandles, ChatInputProps>(
  (
    {
      onSubmit,
      placeholder = 'Describe what you need help with...',
      loading = false,
      disabled = false,
      isAgentRunning = false,
      onStopAgent,
      autoFocus = true,
      value: controlledValue,
      onChange: controlledOnChange,
      onFileBrowse,
      sandboxId,
      hideAttachments = false,
      selectedAgentId,
      onAgentSelect,
      agentName,
      messages = [],
      bgColor = 'bg-card',
      toolCalls = [],
      toolCallIndex = 0,
      showToolPreview = false,
      onExpandToolPreview,
      isLoggedIn = true,
      enableAdvancedConfig = false,
      onConfigureAgent,
      hideAgentSelection = false,
      defaultShowSnackbar = false,
      showToLowCreditUsers = true,
      showScrollToBottomIndicator = false,
      onScrollToBottom,
      selectedMode,
      onModeDeselect,
      animatePlaceholder = false,
      selectedCharts = [],
      selectedOutputFormat = null,
      initialChatMode = 'execute',
      onChatModeChange,
    },
    ref,
  ) => {
    const isControlled =
      controlledValue !== undefined && controlledOnChange !== undefined;

    const [uncontrolledValue, setUncontrolledValue] = useState('');
    const value = isControlled ? controlledValue : uncontrolledValue;

    const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
    const [pendingFiles, setPendingFiles] = useState<File[]>([]);
    const [isUploading, setIsUploading] = useState(false);
    const [isDraggingOver, setIsDraggingOver] = useState(false);

    const [registryDialogOpen, setRegistryDialogOpen] = useState(false);
    const [showSnackbar, setShowSnackbar] = useState(defaultShowSnackbar);
    const [userDismissedUsage, setUserDismissedUsage] = useState(false);
    const [billingModalOpen, setBillingModalOpen] = useState(false);
    const [agentConfigDialog, setAgentConfigDialog] = useState<{ open: boolean; tab: 'instructions' | 'knowledge' | 'triggers' | 'tools' | 'integrations' }>({ open: false, tab: 'instructions' });
    const [mounted, setMounted] = useState(false);
    const [animatedPlaceholder, setAnimatedPlaceholder] = useState('');
    const [isModeDismissing, setIsModeDismissing] = useState(false);
    
    // Suna Agent Modes feature flag
    const ENABLE_SUNA_AGENT_MODES = false;
    const [sunaAgentModes, setSunaAgentModes] = useState<'adaptive' | 'autonomous' | 'chat'>('adaptive');
    
    // Chat Mode state - Chat vs Execute
    const [chatMode, setChatMode] = useState<ChatMode>(initialChatMode);
    
    // Detect macOS for keyboard shortcut labels
    const isMac = typeof window !== 'undefined' && navigator.platform.toUpperCase().indexOf('MAC') >= 0;
    
    // Handle chat mode changes
    const handleChatModeChange = useCallback((mode: ChatMode) => {
      setChatMode(mode);
      onChatModeChange?.(mode);
    }, [onChatModeChange]);

    // Sync chat mode with initialChatMode prop changes
    useEffect(() => {
      if (initialChatMode !== chatMode) {
        setChatMode(initialChatMode);
      }
    }, [initialChatMode]); // Only sync when prop changes, not when internal state changes

    const {
      selectedModel,
      setSelectedModel: handleModelChange,
      subscriptionStatus,
      allModels: modelOptions,
      canAccessModel,
      getActualModelId,
      refreshCustomModels,
    } = useModelSelection();

    const { data: subscriptionData } = useSubscriptionData();
    const deleteFileMutation = useFileDelete();
    const queryClient = useQueryClient();

    // Fetch integration icons only when logged in and advanced config UI is in use
    const shouldFetchIcons = isLoggedIn && !!enableAdvancedConfig;
    const { data: googleDriveIcon } = useComposioToolkitIcon('googledrive', { enabled: shouldFetchIcons });
    const { data: slackIcon } = useComposioToolkitIcon('slack', { enabled: shouldFetchIcons });
    const { data: notionIcon } = useComposioToolkitIcon('notion', { enabled: shouldFetchIcons });

    // Show usage preview logic:
    // - Always show to free users when showToLowCreditUsers is true
    // - For paid users, only show when they're at 70% or more of their cost limit (30% or below remaining)
    const shouldShowUsage = useMemo(() => {
      if (!subscriptionData || !showToLowCreditUsers || isLocalMode()) return false;
      
      // Free users: always show
      if (subscriptionStatus === 'no_subscription') {
        return true;
      }

      // Paid users: only show when at 70% or more of cost limit
      const currentUsage = subscriptionData.current_usage || 0;
      const costLimit = subscriptionData.cost_limit || 0;

      if (costLimit === 0) return false; // No limit set

      return currentUsage >= (costLimit * 0.7); // 70% or more used (30% or less remaining)
    }, [subscriptionData, showToLowCreditUsers, subscriptionStatus]);

    // Auto-show usage preview when we have subscription data
    useEffect(() => {
      if (shouldShowUsage && defaultShowSnackbar !== false && !userDismissedUsage && (showSnackbar === false || showSnackbar === defaultShowSnackbar)) {
        setShowSnackbar('upgrade');
      } else if (!shouldShowUsage && showSnackbar !== false) {
        setShowSnackbar(false);
      }
    }, [subscriptionData, showSnackbar, defaultShowSnackbar, shouldShowUsage, subscriptionStatus, showToLowCreditUsers, userDismissedUsage]);

    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const { data: agentsResponse } = useAgents({}, { enabled: isLoggedIn });
    const agents = agentsResponse?.agents || [];

    // Check if selected agent is Suna based on agent data
    const selectedAgent = agents.find(agent => agent.agent_id === selectedAgentId);
    const isSunaAgent = selectedAgent?.metadata?.is_suna_default || false;

    const { initializeFromAgents } = useAgentSelection();
    useImperativeHandle(ref, () => ({
      getPendingFiles: () => pendingFiles,
      clearPendingFiles: () => setPendingFiles([]),
    }));

    useEffect(() => {
      if (agents.length > 0 && !onAgentSelect) {
        initializeFromAgents(agents);
      }
    }, [agents, onAgentSelect, initializeFromAgents]);

    useEffect(() => {
      setMounted(true);
    }, []);

    // Typewriter effect for placeholder
    useEffect(() => {
      if (!mounted || value || !animatePlaceholder) {
        setAnimatedPlaceholder(placeholder);
        return;
      }

      let currentIndex = 0;
      setAnimatedPlaceholder('');

      const typingInterval = setInterval(() => {
        if (currentIndex < placeholder.length) {
          setAnimatedPlaceholder(placeholder.slice(0, currentIndex + 1));
          currentIndex++;
        } else {
          clearInterval(typingInterval);
        }
      }, 50); // 50ms per character

      return () => clearInterval(typingInterval);
    }, [mounted, placeholder, value, animatePlaceholder]);

    // Reset mode dismissing state when selectedMode changes
    useEffect(() => {
      setIsModeDismissing(false);
    }, [selectedMode]);

    // Keyboard shortcuts for mode switching
    useEffect(() => {
      const handleKeyDown = (e: KeyboardEvent) => {
        const isMod = isMac ? e.metaKey : e.ctrlKey;
        
        // Cmd/Ctrl + E for Execute mode
        if (isMod && e.key === 'e') {
          e.preventDefault();
          handleChatModeChange('execute');
        }
        
        // Cmd/Ctrl + A for Chat mode (Ask)
        if (isMod && e.key === 'a') {
          e.preventDefault();
          handleChatModeChange('chat');
        }
      };

      window.addEventListener('keydown', handleKeyDown);
      return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isMac, handleChatModeChange]);

    // Generate Markdown for selected data options
    const generateDataOptionsMarkdown = useCallback(() => {
      if (selectedMode !== 'data' || (selectedCharts.length === 0 && !selectedOutputFormat)) {
        return '';
      }
      
      let markdown = '\n\n----\n\n**Data Visualization Requirements:**\n';
      
      if (selectedOutputFormat) {
        markdown += `\n- **Output Format:** ${selectedOutputFormat}`;
      }
      
      if (selectedCharts.length > 0) {
        markdown += '\n- **Preferred Charts:**';
        selectedCharts.forEach(chartId => {
          markdown += `\n  - ${chartId}`;
        });
      }
      
      return markdown;
    }, [selectedMode, selectedCharts, selectedOutputFormat]);

    // Handle mode deselection with animation
    const handleModeDeselect = useCallback(() => {
      setIsModeDismissing(true);
      setTimeout(() => {
        onModeDeselect?.();
        setIsModeDismissing(false);
      }, 200); // Match animation duration
    }, [onModeDeselect]);

    // Auto-resize textarea
    useEffect(() => {
      if (!textareaRef.current) return;

      const adjustHeight = () => {
        const el = textareaRef.current;
        if (!el) return;
        el.style.height = 'auto';
        el.style.maxHeight = '200px';
        el.style.overflowY = el.scrollHeight > 200 ? 'auto' : 'hidden';

        const newHeight = Math.min(el.scrollHeight, 200);
        el.style.height = `${newHeight}px`;
      };

      adjustHeight();

      window.addEventListener('resize', adjustHeight);
      return () => window.removeEventListener('resize', adjustHeight);
    }, [value]);



    useEffect(() => {
      if (autoFocus && textareaRef.current) {
        textareaRef.current.focus();
      }
    }, [autoFocus]);

    const handleSubmit = useCallback(async (e: React.FormEvent) => {
      e.preventDefault();
      if (
        (!value.trim() && uploadedFiles.length === 0) ||
        loading ||
        (disabled && !isAgentRunning) ||
        isUploading // Prevent submission while files are uploading
      )
        return;

      if (isAgentRunning && onStopAgent) {
        onStopAgent();
        return;
      }

      let message = value;

      if (uploadedFiles.length > 0) {
        const fileInfo = uploadedFiles
          .map((file) => `[Uploaded File: ${file.path}]`)
          .join('\n');
        message = message ? `${message}\n\n${fileInfo}` : fileInfo;
      }
      
      // Append Markdown for data visualization options
      const dataOptionsMarkdown = generateDataOptionsMarkdown();
      if (dataOptionsMarkdown) {
        message = message + dataOptionsMarkdown;
      }

      const baseModelName = getActualModelId(selectedModel);

      posthog.capture("task_prompt_submitted", { message, chat_mode: chatMode });

      onSubmit(message, {
        agent_id: selectedAgentId,
        model_name: baseModelName,
        chat_mode: chatMode,
      });

      if (!isControlled) {
        setUncontrolledValue('');
      }

      setUploadedFiles([]);
    }, [value, uploadedFiles, loading, disabled, isAgentRunning, isUploading, onStopAgent, generateDataOptionsMarkdown, getActualModelId, selectedModel, onSubmit, selectedAgentId, isControlled]);

    const handleChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
      const newValue = e.target.value;
      if (isControlled) {
        controlledOnChange(newValue);
      } else {
        setUncontrolledValue(newValue);
      }
    }, [isControlled, controlledOnChange]);

    const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
        e.preventDefault();
        if (
          (value.trim() || uploadedFiles.length > 0) &&
          !loading &&
          (!disabled || isAgentRunning) &&
          !isUploading // Prevent submission while files are uploading
        ) {
          handleSubmit(e as unknown as React.FormEvent);
        }
      }
    }, [value, uploadedFiles, loading, disabled, isAgentRunning, isUploading, handleSubmit]);

    const handlePaste = (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
      if (!e.clipboardData) return;
      const items = Array.from(e.clipboardData.items);
      const imageFiles: File[] = [];
      for (const item of items) {
        if (item.kind === 'file' && item.type.startsWith('image/')) {
          const file = item.getAsFile();
          if (file) imageFiles.push(file);
        }
      }
      if (imageFiles.length > 0) {
        e.preventDefault();
        handleFiles(
          imageFiles,
          sandboxId,
          setPendingFiles,
          setUploadedFiles,
          setIsUploading,
          messages,
          queryClient,
        );
      }
    };

    const handleTranscription = useCallback((transcribedText: string) => {
      const currentValue = isControlled ? controlledValue : uncontrolledValue;
      const newValue = currentValue ? `${currentValue} ${transcribedText}` : transcribedText;

      if (isControlled) {
        controlledOnChange(newValue);
      } else {
        setUncontrolledValue(newValue);
      }
    }, [isControlled, controlledValue, uncontrolledValue, controlledOnChange]);

    const removeUploadedFile = useCallback(async (index: number) => {
      const fileToRemove = uploadedFiles[index];

      // Clean up local URL if it exists
      if (fileToRemove.localUrl) {
        URL.revokeObjectURL(fileToRemove.localUrl);
      }

      // Remove from local state immediately for responsive UI
      setUploadedFiles((prev) => prev.filter((_, i) => i !== index));
      if (!sandboxId && pendingFiles.length > index) {
        setPendingFiles((prev) => prev.filter((_, i) => i !== index));
      }

      // Check if file is referenced in existing chat messages before deleting from server
      const isFileUsedInChat = messages.some(message => {
        const content = typeof message.content === 'string' ? message.content : '';
        return content.includes(`[Uploaded File: ${fileToRemove.path}]`);
      });

      // Only delete from server if file is not referenced in chat history
      if (sandboxId && fileToRemove.path && !isFileUsedInChat) {
        deleteFileMutation.mutate({
          sandboxId,
          filePath: fileToRemove.path,
        }, {
          onError: (error) => {
            console.error('Failed to delete file from server:', error);
          }
        });
      } else {
        // File exists in chat history, don't delete from server
      }
    }, [uploadedFiles, sandboxId, pendingFiles, messages, deleteFileMutation]);

    const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDraggingOver(true);
    };

    const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDraggingOver(false);
    };

    const renderConfigDropdown = useMemo(() => {
      // Don't render dropdown components until after hydration to prevent ID mismatches
      if (!mounted) {
        return <div className="flex items-center gap-2 h-8" />; // Placeholder with same height
      }
      // Unified compact menu for both logged and non-logged (non-logged shows only models subset via menu trigger)
      return (
        <UnifiedConfigMenu
          isLoggedIn={isLoggedIn}
          selectedAgentId={!hideAgentSelection ? selectedAgentId : undefined}
          onAgentSelect={!hideAgentSelection ? onAgentSelect : undefined}
          selectedModel={selectedModel}
          onModelChange={handleModelChange}
          modelOptions={modelOptions}
          subscriptionStatus={subscriptionStatus}
          canAccessModel={canAccessModel}
          refreshCustomModels={refreshCustomModels}
        />
      );
    }, [mounted, isLoggedIn, hideAgentSelection, selectedAgentId, onAgentSelect, selectedModel, handleModelChange, modelOptions, subscriptionStatus, canAccessModel, refreshCustomModels]);



    return (
      <div className="mx-auto w-full max-w-4xl relative">
        <div className="relative">
          <ChatSnack
            toolCalls={toolCalls}
            toolCallIndex={toolCallIndex}
            onExpandToolPreview={onExpandToolPreview}
            agentName={agentName}
            showToolPreview={showToolPreview}
            showUsagePreview={showSnackbar}
            subscriptionData={subscriptionData}
            onCloseUsage={() => { setShowSnackbar(false); setUserDismissedUsage(true); }}
            onOpenUpgrade={() => setBillingModalOpen(true)}
            isVisible={showToolPreview || !!showSnackbar}
          />

          {/* Scroll to bottom button */}
          {showScrollToBottomIndicator && onScrollToBottom && (
            <button
              onClick={onScrollToBottom}
              className={`absolute cursor-pointer right-3 z-50 w-8 h-8 rounded-full bg-card border border-border transition-all duration-200 hover:scale-105 flex items-center justify-center ${showToolPreview || !!showSnackbar ? '-top-12' : '-top-5'
                }`}
              title="Scroll to bottom"
            >
              <ArrowDown className="w-4 h-4 text-muted-foreground" />
            </button>
          )}
          
          {/* New integrated chat container with glassmorphism */}
          <div 
            className="relative rounded-[32px] border border-white/10 bg-[rgba(10,14,22,0.55)] backdrop-blur-2xl shadow-[0_20px_60px_-10px_rgba(0,0,0,0.8),inset_0_1px_0_0_rgba(255,255,255,0.06)] transition-all duration-300 overflow-hidden hover:scale-[1.01]"
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setIsDraggingOver(false);
              if (fileInputRef.current && e.dataTransfer.files.length > 0) {
                const files = Array.from(e.dataTransfer.files);
                handleFiles(
                  files,
                  sandboxId,
                  setPendingFiles,
                  setUploadedFiles,
                  setIsUploading,
                  messages,
                  queryClient,
                );
              }
            }}
          >
            {/* Gradient rim (subtle) */}
            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-0 rounded-[32px]"
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
            
            {/* Specular streak */}
            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-x-0 top-0 h-24"
              style={{
                background:
                  "linear-gradient(180deg, rgba(255,255,255,0.22), rgba(255,255,255,0.06) 45%, rgba(255,255,255,0) 100%)",
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
            
            <div className="relative p-3 z-10">
              {/* Attachments */}
              {(uploadedFiles.length > 0 || isUploading) && (
                <div className="relative mb-3">
                  <AttachmentGroup
                    files={uploadedFiles || []}
                    sandboxId={sandboxId}
                    onRemove={removeUploadedFile}
                    layout="inline"
                    maxHeight="216px"
                    showPreviews={true}
                  />
                  {isUploading && pendingFiles.length > 0 && (
                    <div className="absolute inset-0 bg-background/50 backdrop-blur-sm rounded-xl flex items-center justify-center">
                      <div className="flex items-center gap-2 bg-background/90 px-3 py-2 rounded-lg border border-border">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        <span className="text-sm">Uploading {pendingFiles.length} file{pendingFiles.length !== 1 ? 's' : ''}...</span>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Selected Mode Badge */}
              {(selectedMode || isModeDismissing) && onModeDeselect && (
                <div className="mb-3">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      if (!isModeDismissing) {
                        handleModeDeselect();
                      }
                    }}
                    className={cn(
                      "h-8 px-3 py-2 bg-white/5 border border-white/10 rounded-xl text-white/70 hover:text-white hover:bg-white/10 hover:border-white/20 flex items-center gap-1.5 cursor-pointer transition-all duration-200",
                      !isModeDismissing && "animate-in fade-in-0 zoom-in-95",
                      isModeDismissing && "animate-out fade-out-0 zoom-out-95"
                    )}
                  >
                    {selectedMode && getModeIcon(selectedMode)}
                    <span className="text-sm">{selectedMode?.charAt(0).toUpperCase()}{selectedMode?.slice(1)}</span>
                    <X className="w-4 h-4" />
                  </Button>
                </div>
              )}

              {/* Input area with controls - sticky at bottom */}
              <div>
                <form onSubmit={handleSubmit} className="flex flex-col gap-2">
                  {/* Textarea */}
                  <div className="relative py-2">
                    <Textarea
                      ref={textareaRef}
                      value={value}
                      onChange={handleChange}
                      onKeyDown={handleKeyDown}
                      onPaste={handlePaste}
                      placeholder={animatedPlaceholder}
                      className={cn(
                        'w-full bg-transparent dark:bg-transparent border-none shadow-none focus-visible:ring-0 pl-2 pr-0 !text-base min-h-[44px] max-h-[200px] overflow-y-auto resize-none placeholder:text-white/40 text-white',
                        isDraggingOver ? 'opacity-40' : '',
                      )}
                      disabled={loading || (disabled && !isAgentRunning)}
                      rows={1}
                    />
                  </div>
                  
                  {/* Separator line */}
                  <div className="border-t border-white/5 pt-2"></div>
                  
                  {/* Controls row */}
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      {!hideAttachments && (
                        <FileUploadHandler
                          ref={fileInputRef}
                          loading={loading}
                          disabled={disabled}
                          isAgentRunning={isAgentRunning}
                          isUploading={isUploading}
                          sandboxId={sandboxId}
                          setPendingFiles={setPendingFiles}
                          setUploadedFiles={setUploadedFiles}
                          setIsUploading={setIsUploading}
                          messages={messages}
                          isLoggedIn={isLoggedIn}
                        />
                      )}
                      
                      {renderConfigDropdown}
                      
                      {/* Chat/Execute Mode Toggle - Glassy icon-only design */}
                      <TooltipProvider>
                        <div className="flex items-center gap-0 p-1 bg-white/5 rounded-xl border border-white/10 backdrop-blur-sm">
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <button
                                type="button"
                                onClick={() => handleChatModeChange('chat')}
                                className={cn(
                                  "p-1.5 rounded-lg transition-all duration-200 cursor-pointer",
                                  chatMode === 'chat'
                                    ? "opacity-100 text-white"
                                    : "opacity-60 text-white/70 hover:opacity-80"
                                )}
                              >
                                <ZapIcon className="w-4 h-4" />
                              </button>
                            </TooltipTrigger>
                            <TooltipContent side="top">
                              <div className="space-y-1">
                                <p className="font-medium">Ask ({isMac ? '⌘' : 'Ctrl'}+A)</p>
                                <p className="text-xs text-muted-foreground">Lightning-fast responses</p>
                              </div>
                            </TooltipContent>
                          </Tooltip>

                          {/* Separator line */}
                          <div className="w-px h-4 bg-white/20 mx-0.5" />

                          <Tooltip>
                            <TooltipTrigger asChild>
                              <button
                                type="button"
                                onClick={() => handleChatModeChange('execute')}
                                className={cn(
                                  "p-1.5 rounded-lg transition-all duration-200 cursor-pointer",
                                  chatMode === 'execute'
                                    ? "opacity-100 text-white"
                                    : "opacity-60 text-white/70 hover:opacity-80"
                                )}
                              >
                                <Wrench className="w-4 h-4" />
                              </button>
                            </TooltipTrigger>
                            <TooltipContent side="top">
                              <div className="space-y-1">
                                <p className="font-medium">Execute ({isMac ? '⌘' : 'Ctrl'}+E)</p>
                                <p className="text-xs text-muted-foreground">Full agent with tools</p>
                              </div>
                            </TooltipContent>
                          </Tooltip>
                        </div>
                      </TooltipProvider>
                      
                      {/* Agent Mode Switcher - Only for Suna */}
                      {ENABLE_SUNA_AGENT_MODES && (isStagingMode() || isLocalMode()) && isSunaAgent && (
                        <TooltipProvider>
                          <div className="flex items-center gap-1 p-0.5 bg-muted/50 rounded-lg">
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <button
                                  onClick={() => setSunaAgentModes('adaptive')}
                                  className={cn(
                                    "p-1.5 rounded-md transition-all duration-200 cursor-pointer",
                                    sunaAgentModes === 'adaptive'
                                      ? "bg-background text-foreground shadow-sm"
                                      : "text-muted-foreground hover:text-foreground hover:bg-background/50"
                                  )}
                                >
                                  <Sparkles className="w-4 h-4" />
                                </button>
                              </TooltipTrigger>
                              <TooltipContent side="bottom">
                                <div className="space-y-1">
                                  <p className="font-medium text-white">Adaptive</p>
                                  <p className="text-xs text-gray-200">Quick responses with smart context switching</p>
                                </div>
                              </TooltipContent>
                            </Tooltip>

                            <Tooltip>
                              <TooltipTrigger asChild>
                                <button
                                  onClick={() => setSunaAgentModes('autonomous')}
                                  className={cn(
                                    "p-1.5 rounded-md transition-all duration-200 cursor-pointer",
                                    sunaAgentModes === 'autonomous'
                                      ? "bg-background text-foreground shadow-sm"
                                      : "text-muted-foreground hover:text-foreground hover:bg-background/50"
                                  )}
                                >
                                  <BrainIcon className="w-4 h-4" />
                                </button>
                              </TooltipTrigger>
                              <TooltipContent side="bottom">
                                <div className="space-y-1">
                                  <p className="font-medium text-white">Autonomous</p>
                                  <p className="text-xs text-gray-200">Deep work mode for multi-step problem solving</p>
                                </div>
                              </TooltipContent>
                            </Tooltip>

                            <Tooltip>
                              <TooltipTrigger asChild>
                                <button
                                  onClick={() => setSunaAgentModes('chat')}
                                  className={cn(
                                    "p-1.5 rounded-md transition-all duration-200 cursor-pointer",
                                    sunaAgentModes === 'chat'
                                      ? "bg-background text-foreground shadow-sm"
                                      : "text-muted-foreground hover:text-foreground hover:bg-background/50"
                                  )}
                                >
                                  <MessageSquare className="w-4 h-4" />
                                </button>
                              </TooltipTrigger>
                              <TooltipContent side="bottom">
                                <div className="space-y-1">
                                  <p className="font-medium text-white">Chat</p>
                                  <p className="text-xs text-gray-200">Simple back-and-forth conversation</p>
                                </div>
                              </TooltipContent>
                            </Tooltip>
                          </div>
                        </TooltipProvider>
                      )}
                      
                      {isLoggedIn && <VoiceRecorder
                        onTranscription={handleTranscription}
                        disabled={loading || (disabled && !isAgentRunning)}
                      />}
                    </div>

                    <Button
                      type="submit"
                      onClick={isAgentRunning && onStopAgent ? onStopAgent : handleSubmit}
                      disabled={
                        (!value.trim() && uploadedFiles.length === 0 && !isAgentRunning) ||
                        loading ||
                        (disabled && !isAgentRunning) ||
                        isUploading
                      }
                      className={cn(
                        'h-9 rounded-2xl border border-white/20 bg-white/10 backdrop-blur-sm px-4 text-sm font-medium text-white/90 shadow-[0_2px_8px_rgba(0,0,0,0.2),inset_0_1px_0_rgba(255,255,255,0.1)] transition-all duration-200 hover:border-white/30 hover:bg-white/15 hover:shadow-[0_4px_12px_rgba(0,0,0,0.3),inset_0_1px_0_rgba(255,255,255,0.15)] active:scale-[0.98]',
                        ((!value.trim() && uploadedFiles.length === 0 && !isAgentRunning) ||
                          loading ||
                          (disabled && !isAgentRunning) ||
                          isUploading) && 'opacity-[0.55] cursor-not-allowed'
                      )}
                    >
                      {loading || isUploading ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : isAgentRunning ? (
                        <span>Stop</span>
                      ) : (
                        <span>Send</span>
                      )}
                    </Button>
                  </div>
                </form>
              </div>
            </div>
          </div>
          
          <BillingModal
            open={billingModalOpen}
            onOpenChange={setBillingModalOpen}
          />

          {enableAdvancedConfig && selectedAgentId && (
            <div className="w-full max-w-4xl mx-auto -mt-12 relative z-20">
              <div className="bg-gradient-to-b from-transparent via-transparent to-muted/30 pt-8 pb-2 px-4 rounded-b-3xl border border-t-0 border-border/50 transition-all duration-300 ease-out">
                <div className="flex items-center justify-between gap-1 overflow-x-auto scrollbar-none relative">
                  <button
                    onClick={() => setAgentConfigDialog({ open: true, tab: 'integrations' })}
                    className="flex items-center gap-1.5 text-muted-foreground hover:text-foreground transition-all duration-200 px-2.5 py-1.5 rounded-lg hover:bg-muted/50 border border-transparent hover:border-border/30 flex-shrink-0 cursor-pointer relative pointer-events-auto"
                  >
                    <div className="flex items-center -space-x-0.5">
                      {googleDriveIcon?.icon_url && slackIcon?.icon_url && notionIcon?.icon_url ? (
                        <>
                          <div className="w-4 h-4 bg-white dark:bg-muted border border-border rounded-full flex items-center justify-center shadow-sm">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={googleDriveIcon.icon_url} className="w-2.5 h-2.5" alt="Google Drive" />
                          </div>
                          <div className="w-4 h-4 bg-white dark:bg-muted border border-border rounded-full flex items-center justify-center shadow-sm">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={slackIcon.icon_url} className="w-2.5 h-2.5" alt="Slack" />
                          </div>
                          <div className="w-4 h-4 bg-white dark:bg-muted border border-border rounded-full flex items-center justify-center shadow-sm">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={notionIcon.icon_url} className="w-2.5 h-2.5" alt="Notion" />
                          </div>
                        </>
                      ) : (
                        <>
                          <div className="w-4 h-4 bg-white dark:bg-muted border border-border rounded-full flex items-center justify-center shadow-sm">
                            <Skeleton className="w-2.5 h-2.5 rounded" />
                          </div>
                          <div className="w-4 h-4 bg-white dark:bg-muted border border-border rounded-full flex items-center justify-center shadow-sm">
                            <Skeleton className="w-2.5 h-2.5 rounded" />
                          </div>
                          <div className="w-4 h-4 bg-white dark:bg-muted border border-border rounded-full flex items-center justify-center shadow-sm">
                            <Skeleton className="w-2.5 h-2.5 rounded" />
                          </div>
                        </>
                      )}
                    </div>
                    <span className="text-xs font-medium">Integrations</span>
                  </button>
                  <button
                    onClick={() => setAgentConfigDialog({ open: true, tab: 'tools' })}
                    className="flex items-center gap-1.5 text-muted-foreground hover:text-foreground transition-all duration-200 px-2.5 py-1.5 rounded-lg hover:bg-muted/50 border border-transparent hover:border-border/30 flex-shrink-0 cursor-pointer relative pointer-events-auto"
                  >
                    <Wrench className="h-3.5 w-3.5 flex-shrink-0" />
                    <span className="text-xs font-medium">Tools</span>
                  </button>                  
                  <button
                    onClick={() => setAgentConfigDialog({ open: true, tab: 'instructions' })}
                    className="flex items-center gap-1.5 text-muted-foreground hover:text-foreground transition-all duration-200 px-2.5 py-1.5 rounded-lg hover:bg-muted/50 border border-transparent hover:border-border/30 flex-shrink-0 cursor-pointer relative pointer-events-auto"
                  >
                    <Brain className="h-3.5 w-3.5 flex-shrink-0" />
                    <span className="text-xs font-medium">Instructions</span>
                  </button>
                  <button
                    onClick={() => setAgentConfigDialog({ open: true, tab: 'knowledge' })}
                    className="flex items-center gap-1.5 text-muted-foreground hover:text-foreground transition-all duration-200 px-2.5 py-1.5 rounded-lg hover:bg-muted/50 border border-transparent hover:border-border/30 flex-shrink-0 cursor-pointer relative pointer-events-auto"
                  >
                    <Database className="h-3.5 w-3.5 flex-shrink-0" />
                    <span className="text-xs font-medium">Knowledge</span>
                  </button>

                  <button
                    onClick={() => setAgentConfigDialog({ open: true, tab: 'triggers' })}
                    className="flex items-center gap-1.5 text-muted-foreground hover:text-foreground transition-all duration-200 px-2.5 py-1.5 rounded-lg hover:bg-muted/50 border border-transparent hover:border-border/30 flex-shrink-0 cursor-pointer relative pointer-events-auto"
                  >
                    <Zap className="h-3.5 w-3.5 flex-shrink-0" />
                    <span className="text-xs font-medium">Triggers</span>
                  </button>
                </div>
              </div>
            </div>
          )}

          <Dialog open={registryDialogOpen} onOpenChange={setRegistryDialogOpen}>
            <DialogContent className="p-0 max-w-6xl h-[90vh] overflow-hidden">
              <DialogHeader className="sr-only">
                <DialogTitle>Integrations</DialogTitle>
              </DialogHeader>
              <IntegrationsRegistry
                showAgentSelector={true}
                selectedAgentId={selectedAgentId}
                onAgentChange={onAgentSelect}
                onToolsSelected={(profileId, selectedTools, appName, appSlug) => {
                }}
              />
            </DialogContent>
          </Dialog>
          <BillingModal
            open={billingModalOpen}
            onOpenChange={setBillingModalOpen}
          />
          {selectedAgentId && agentConfigDialog.open && (
            <AgentConfigurationDialog
              open={agentConfigDialog.open}
              onOpenChange={(open) => setAgentConfigDialog({ ...agentConfigDialog, open })}
              agentId={selectedAgentId}
              initialTab={agentConfigDialog.tab}
              onAgentChange={onAgentSelect}
            />
          )}
        </div>
      </div>
    );
  },
));

ChatInput.displayName = 'ChatInput';