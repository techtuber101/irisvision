'use client';

import { useEffect, useState, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowUpRight,
  Link as LinkIcon,
  MoreHorizontal,
  Trash2,
  MessagesSquare,
  Loader2,
  ExternalLink,
  X,
  Check,
  History,
  ChevronRight,
  Zap,
  Folder,
  Sparkles
} from "lucide-react"
import { ThreadIcon } from "./thread-icon"
import { toast } from "sonner"
import { usePathname, useRouter } from "next/navigation"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  SidebarGroup,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuAction,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from '@/components/ui/sidebar';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger
} from "@/components/ui/tooltip"
import Link from "next/link"
import { ShareModal } from "./share-modal"
import { TypewriterText } from '@/components/ui/typewriter-text';
import { DeleteConfirmationDialog } from "@/components/thread/DeleteConfirmationDialog"
import { useDeleteOperation } from '@/contexts/DeleteOperationContext'
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { ThreadWithProject, GroupedThreads } from '@/hooks/react-query/sidebar/use-sidebar';
import { processThreadsWithProjects, useDeleteMultipleThreads, useDeleteThread, useProjects, useThreads, groupThreadsByDate } from '@/hooks/react-query/sidebar/use-sidebar';
import { projectKeys, threadKeys } from '@/hooks/react-query/sidebar/keys';
import { format, formatDistanceToNow } from 'date-fns';
import Image from 'next/image';
import { useTheme } from 'next-themes';
import { getMessages, streamThreadSummary } from '@/lib/api';

// Component for date group headers
const DateGroupHeader: React.FC<{ dateGroup: string; count: number }> = ({ dateGroup, count }) => {
  return (
    <div className="px-2 py-1 mb-1 mt-3 first:mt-0">
      <div className="text-xs font-medium text-muted-foreground/80 uppercase tracking-wider">
        {dateGroup} ({count})
      </div>
    </div>
  );
};

// Glassy hover tooltip component
const GlassyHoverTooltip: React.FC<{
  thread: ThreadWithProject;
  isVisible: boolean;
  onSummarize: () => void;
}> = ({ thread, isVisible, onSummarize }) => {
  const { resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const formatTimestamp = (updatedAt: string) => {
    const date = new Date(updatedAt);
    const now = new Date();
    const diffInMs = now.getTime() - date.getTime();
    const diffInMinutes = Math.floor(diffInMs / (1000 * 60));
    const diffInHours = Math.floor(diffInMs / (1000 * 60 * 60));
    const diffInDays = Math.floor(diffInMs / (1000 * 60 * 60 * 24));

    if (diffInMinutes < 60) {
      return diffInMinutes < 1 ? 'Just now' : `${diffInMinutes}m ago`;
    } else if (diffInHours < 24) {
      return `${diffInHours}h ago`;
    } else if (diffInDays === 1) {
      return 'Yesterday';
    } else if (diffInDays < 7) {
      return `${diffInDays}d ago`;
    } else {
      return format(date, 'MMM d');
    }
  };

  if (!isVisible) return null;

  return (
    <div className="absolute left-full ml-2 top-1/2 -translate-y-1/2 z-50 animate-in fade-in-0 slide-in-from-left-2 duration-200">
      <div className="relative rounded-2xl border border-white/10 bg-[rgba(10,14,22,0.55)] backdrop-blur-2xl shadow-[0_20px_60px_-10px_rgba(0,0,0,0.8),inset_0_1px_0_0_rgba(255,255,255,0.06)] overflow-hidden p-3 w-64 light:bg-[rgba(255,255,255,0.4)] light:backdrop-blur-2xl">
        {/* Gradient rim */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 rounded-2xl"
          style={{
            background:
              "linear-gradient(180deg, rgba(173,216,255,0.18), rgba(255,255,255,0.04) 30%, rgba(150,160,255,0.14) 85%, rgba(255,255,255,0.06))",
            WebkitMask: "linear-gradient(#000,#000) content-box, linear-gradient(#000,#000)",
            WebkitMaskComposite: "xor" as any,
            maskComposite: "exclude",
            padding: 1,
            borderRadius: 16,
          }}
        />
        
        {/* Specular streak */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 top-0 h-16"
          style={{
            background:
              "linear-gradient(180deg, rgba(255,255,255,0.22), rgba(255,255,255,0.06) 45%, rgba(255,255,255,0) 100%)",
            filter: "blur(4px)",
            mixBlendMode: "screen",
          }}
        />
        
        {/* Fine noise */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 rounded-2xl opacity-[0.015]"
          style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 400 400' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")`,
          }}
        />

        <div className="relative z-10 flex items-center space-x-3">
          {/* Small Iris logo in transparent circle */}
          <div className="flex-shrink-0 w-8 h-8 rounded-full bg-white/10 backdrop-blur-sm border border-white/20 flex items-center justify-center">
            <Image
              src="/irissymbolblack.png"
              alt="Iris"
              width={16}
              height={16}
              className="w-4 h-4 dark:hidden"
            />
            <Image
              src="/irissymbolwhite.png"
              alt="Iris"
              width={16}
              height={16}
              className="w-4 h-4 hidden dark:block"
            />
          </div>

          {/* Thread info */}
          <div className="flex-1 min-w-0">
            <div className="text-sm font-medium text-foreground truncate">
              {thread.projectName}
            </div>
            <div className="text-xs text-muted-foreground">
              {formatTimestamp(thread.updatedAt)}
            </div>
          </div>

          {/* Summarize button */}
          <button
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onSummarize();
            }}
            className="flex-shrink-0 w-8 h-8 rounded-full bg-primary/20 hover:bg-primary/30 border border-primary/30 backdrop-blur-sm flex items-center justify-center transition-all duration-200 hover:scale-105 active:scale-95"
          >
            <Sparkles className="w-4 h-4 text-primary" />
          </button>
        </div>
      </div>
    </div>
  );
};

// Portal-rendered glassy content using hooks (for attachment bubbles)
const TooltipGlassyContent: React.FC<{
  thread: ThreadWithProject;
  onSummarize: () => void;
  visible: boolean;
}> = ({ thread, onSummarize, visible }) => {
  const [attachmentTypes, setAttachmentTypes] = useState<string[]>([]);

  useEffect(() => {
    let cancelled = false;
    const allowed = new Set(['pdf','doc','docx','md','markdown','ppt','pptx','xls','xlsx','txt']);
    const banned = new Set(['json']);
    const userUploadHints = ['uploads/','user_upload','user-uploads/'];

    async function load() {
      try {
        if (!visible) return;
        const messages = await getMessages(thread.threadId);
        const exts = new Set<string>();
        const fileRegex = /(?:^|\b|[\s'\"\(\[])((?:[\w\-/]+\.)((?:pdf|docx?|md|markdown|pptx?|xlsx?|csv|txt)))(?:\b|[\s'\"\)\]])/gi;
        for (const m of messages) {
          const content = typeof m.content === 'string' ? m.content : '';
          let match: RegExpExecArray | null;
          while ((match = fileRegex.exec(content)) !== null) {
            const fullPath = match[1] || '';
            const ext = (match[2] || '').toLowerCase();
            if (banned.has(ext)) continue;
            if (!allowed.has(ext)) continue;
            if (userUploadHints.some(h => fullPath.includes(h))) continue;
            exts.add(ext === 'markdown' ? 'md' : ext);
          }
        }
        if (!cancelled) setAttachmentTypes(Array.from(exts).sort());
      } catch (e) {
        if (!cancelled) setAttachmentTypes([]);
      }
    }
    load();
    return () => { cancelled = true; };
  }, [thread.threadId, visible]);

  return (
    <div className="relative rounded-2xl border border-white/10 bg-[rgba(10,14,22,0.55)] backdrop-blur-2xl shadow-[0_20px_60px_-10px_rgba(0,0,0,0.8),inset_0_1px_0_0_rgba(255,255,255,0.06)] overflow-hidden p-4 w-72 light:bg-[rgba(255,255,255,0.4)] light:backdrop-blur-2xl">
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 rounded-2xl" style={{
        background: 'linear-gradient(180deg, rgba(173,216,255,0.18), rgba(255,255,255,0.04) 30%, rgba(150,160,255,0.14) 85%, rgba(255,255,255,0.06))',
        WebkitMask: 'linear-gradient(#000,#000) content-box, linear-gradient(#000,#000)',
        WebkitMaskComposite: 'xor' as any,
        maskComposite: 'exclude',
        padding: 1,
        borderRadius: 16,
      }} />
      <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-0 h-16" style={{
        background: 'linear-gradient(180deg, rgba(255,255,255,0.22), rgba(255,255,255,0.06) 45%, rgba(255,255,255,0) 100%)',
        filter: 'blur(4px)',
        mixBlendMode: 'screen',
      }} />
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 rounded-2xl opacity-[0.015]" style={{
        backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 400 400' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")`,
      }} />

      <div className="relative z-10">
        <div className="flex items-center space-x-3">
          <div className="flex-shrink-0 w-8 h-8 rounded-full bg-white/10 backdrop-blur-sm border border-white/20 flex items-center justify-center">
            <ThreadIcon iconName={thread.iconName} size={16} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-semibold text-foreground truncate">{thread.projectName}</div>
            <div className="text-xs text-muted-foreground">
              {(() => {
                const date = new Date(thread.updatedAt);
                const now = new Date();
                const diff = now.getTime() - date.getTime();
                const mins = Math.floor(diff / 60000);
                const hrs = Math.floor(diff / 3600000);
                const days = Math.floor(diff / 86400000);
                if (mins < 60) return mins < 1 ? 'Just now' : `${mins}m ago`;
                if (hrs < 24) return `${hrs}h ago`;
                if (days === 1) return 'Yesterday';
                if (days < 7) return `${days}d ago`;
                return format(date, 'MMM d');
              })()}
            </div>
          </div>
        </div>

        <div className="mt-3">
          <button
            onClick={(e) => { e.preventDefault(); e.stopPropagation(); onSummarize(); }}
            className="w-full h-9 rounded-xl bg-primary text-primary-foreground border border-primary/40 backdrop-blur-sm flex items-center justify-center gap-2 text-sm font-medium transition-all duration-200 hover:bg-primary/90 active:scale-[0.99]"
          >
            <Sparkles className="w-4 h-4" />
            <span>Summarise</span>
          </button>
        </div>

        {attachmentTypes.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {attachmentTypes.map((ext) => (
              <div key={ext} className="px-2.5 h-6 rounded-full bg-white/10 border border-white/15 backdrop-blur-sm text-xs text-foreground flex items-center">
                {ext.toUpperCase()}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

// Component for individual thread item
const ThreadItem: React.FC<{
  thread: ThreadWithProject;
  isActive: boolean;
  isThreadLoading: boolean;
  isSelected: boolean;
  selectedThreads: Set<string>;
  loadingThreadId: string | null;
  pathname: string | null;
  isMobile: boolean;
  handleThreadClick: (e: React.MouseEvent<HTMLAnchorElement>, threadId: string, url: string) => void;
  toggleThreadSelection: (threadId: string, e?: React.MouseEvent) => void;
  handleDeleteThread: (threadId: string, threadName: string) => void;
  setSelectedItem: (item: { threadId: string; projectId: string } | null) => void;
  setShowShareModal: (show: boolean) => void;
}> = ({ 
  thread, 
  isActive, 
  isThreadLoading, 
  isSelected, 
  handleThreadClick,
  toggleThreadSelection,
  handleDeleteThread,
  setSelectedItem,
  setShowShareModal,
  isMobile 
}) => {
  // State for typewriter effect
  const [previousProjectName, setPreviousProjectName] = useState(thread.projectName);
  const [showTypewriter, setShowTypewriter] = useState(false);
  const [typewriterKey, setTypewriterKey] = useState(0);
  
  // State for hover tooltip
  const [isHovered, setIsHovered] = useState(false);
  const [showTooltip, setShowTooltip] = useState(false);
  const [isSummarizing, setIsSummarizing] = useState(false);
  const [summaryText, setSummaryText] = useState('');

  // Detect when project name changes and trigger typewriter effect
  useEffect(() => {
    if (thread.projectName !== previousProjectName && thread.projectName) {
      setShowTypewriter(true);
      setTypewriterKey(prev => prev + 1);
      setPreviousProjectName(thread.projectName);
    }
  }, [thread.projectName, previousProjectName]);

  // Handle tooltip delay
  useEffect(() => {
    let timeoutId: NodeJS.Timeout;
    
    if (isHovered) {
      timeoutId = setTimeout(() => {
        setShowTooltip(true);
      }, 600); // 1s delay before opening tooltip
    } else {
      setShowTooltip(false);
    }

    return () => {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
    };
  }, [isHovered]);

  const handleTypewriterComplete = () => {
    // Hide typewriter effect after completion
    setTimeout(() => {
      setShowTypewriter(false);
    }, 1000); // Keep cursor blinking for 1 second after completion
  };

  const handleSummarize = async () => {
    if (isSummarizing) return;
    setSummaryText('');
    setIsSummarizing(true);
    try {
      await streamThreadSummary(thread.threadId, {
        onContent: (chunk) => setSummaryText(prev => prev + chunk),
        onDone: () => setIsSummarizing(false),
        onError: (err) => {
          setIsSummarizing(false);
          setSummaryText(`Error: ${err}`);
        }
      });
    } catch (e: any) {
      setIsSummarizing(false);
      setSummaryText(e?.message || 'Failed to start summary');
    }
  };
  return (
    <SidebarMenuItem key={`thread-${thread.threadId}`} className="group/row relative">
      <Tooltip open={showTooltip && !isMobile} delayDuration={0}>
        <TooltipTrigger asChild>
          <SidebarMenuButton
            asChild
            className={`relative ${isActive
              ? 'bg-accent text-accent-foreground font-medium'
              : isSelected
                ? 'bg-primary/10'
                : 'hover:bg-[rgba(99,102,241,0.1)] dark:hover:bg-[rgba(99,102,241,0.15)]'
              }`}
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
          >
            <div className="flex items-center w-full">
          <Link
            href={thread.url}
            onClick={(e) =>
              handleThreadClick(e, thread.threadId, thread.url)
            }
            prefetch={false}
            className="flex items-center flex-1 min-w-0 touch-manipulation"
          >
            {isThreadLoading ? (
              <Loader2 className="h-4 w-4 animate-spin mr-2 flex-shrink-0" />
            ) : (
              <ThreadIcon 
                iconName={thread.iconName} 
                className="mr-2" 
                size={16} 
              />
            )}
            <span className="truncate">
              {showTypewriter ? (
                <TypewriterText
                  key={typewriterKey}
                  text={thread.projectName}
                  speed={40} // Rapid typing - 40ms per character
                  onComplete={handleTypewriterComplete}
                  showCursor={true}
                  cursorBlinkSpeed={500}
                />
              ) : (
                thread.projectName
              )}
            </span>
          </Link>
          
          {/* Checkbox - only visible on hover of this specific area */}
          <div
            className="mr-1 flex-shrink-0 w-4 h-4 flex items-center justify-center group/checkbox relative"
            onClick={(e) => toggleThreadSelection(thread.threadId, e)}
          >
            <div
              className={`h-4 w-4 border rounded cursor-pointer transition-all duration-150 flex items-center justify-center ${isSelected
                ? 'opacity-100 bg-primary/15 border-primary hover:bg-primary/20'
                : 'opacity-0 group-hover/checkbox:opacity-100 border-muted-foreground/30 bg-background hover:bg-muted/50'
                }`}
            >
              <AnimatePresence>
                {isSelected && (
                  <motion.div
                    initial={{ scale: 0, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    exit={{ scale: 0, opacity: 0 }}
                    transition={{ duration: 0.2, type: "spring", stiffness: 300 }}
                    className="absolute -top-2 -right-2 w-5 h-5 bg-primary rounded-full flex items-center justify-center shadow-md z-10"
                  >
                    <Check className="w-3 h-3 text-primary-foreground" strokeWidth={3} />
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                className="cursor-pointer flex-shrink-0 w-4 h-4 flex items-center justify-center hover:bg-muted/50 rounded transition-all duration-150 text-muted-foreground hover:text-foreground opacity-0 group-hover/row:opacity-100"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  document.body.style.pointerEvents = 'auto';
                }}
              >
                <MoreHorizontal className="h-4 w-4" />
                <span className="sr-only">More actions</span>
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              className="w-64 rounded-xl border border-white/10 bg-[rgba(10,14,22,0.95)] backdrop-blur-2xl shadow-[0_20px_60px_-10px_rgba(0,0,0,0.8),inset_0_1px_0_0_rgba(255,255,255,0.06)] overflow-hidden p-2 light:bg-[rgba(255,255,255,0.95)] light:backdrop-blur-2xl"
              side={isMobile ? 'bottom' : 'right'}
              align={isMobile ? 'end' : 'start'}
            >
              {/* Gradient rim */}
              <div
                aria-hidden="true"
                className="pointer-events-none absolute inset-0 rounded-xl"
                style={{
                  background: 'linear-gradient(180deg, rgba(173,216,255,0.18), rgba(255,255,255,0.04) 30%, rgba(150,160,255,0.14) 85%, rgba(255,255,255,0.06))',
                  WebkitMask: 'linear-gradient(#000,#000) content-box, linear-gradient(#000,#000)',
                  WebkitMaskComposite: 'xor' as any,
                  maskComposite: 'exclude',
                  padding: 1,
                  borderRadius: 12,
                }}
              />
              
              {/* Specular streak */}
              <div
                aria-hidden="true"
                className="pointer-events-none absolute inset-x-0 top-0 h-16"
                style={{
                  background: 'linear-gradient(180deg, rgba(255,255,255,0.22), rgba(255,255,255,0.06) 45%, rgba(255,255,255,0) 100%)',
                  filter: 'blur(4px)',
                  mixBlendMode: 'screen',
                }}
              />

              <div className="relative z-10 space-y-1">
                <DropdownMenuItem 
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    handleSummarize();
                  }}
                  className="rounded-lg cursor-pointer"
                >
                  <Sparkles className="h-4 w-4 text-primary" />
                  <span>Auto Summarise</span>
                </DropdownMenuItem>
                <DropdownMenuSeparator className="bg-white/10" />
                <DropdownMenuItem 
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setSelectedItem({ threadId: thread?.threadId, projectId: thread?.projectId })
                    setShowShareModal(true)
                  }}
                  className="rounded-lg cursor-pointer"
                >
                  <ExternalLink className="h-4 w-4 text-muted-foreground" />
                  <span>Share</span>
                </DropdownMenuItem>
                <DropdownMenuItem 
                  asChild
                  className="rounded-lg cursor-pointer"
                >
                  <a
                    href={thread.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={(e) => {
                      e.stopPropagation();
                    }}
                  >
                    <ArrowUpRight className="h-4 w-4 text-muted-foreground" />
                    <span>Open in New Tab</span>
                  </a>
                </DropdownMenuItem>
                <DropdownMenuSeparator className="bg-white/10" />
                <DropdownMenuItem
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    handleDeleteThread(
                      thread.threadId,
                      thread.projectName,
                    )
                  }}
                  className="rounded-lg cursor-pointer text-destructive focus:text-destructive"
                >
                  <Trash2 className="h-4 w-4" />
                  <span>Delete</span>
                </DropdownMenuItem>
              </div>
            </DropdownMenuContent>
          </DropdownMenu>
            </div>
          </SidebarMenuButton>
        </TooltipTrigger>
        <TooltipContent
          side="right"
          align="start"
          sideOffset={8}
          // Hide the default diamond arrow and allow interacting with content
          className="p-0 bg-transparent border-none shadow-none [&>svg]:hidden"
          onMouseEnter={() => setIsHovered(true)}
          onMouseLeave={() => setIsHovered(false)}
        >
          {/* Glassy content (portal, no absolute positioning) */}
          <div className="relative rounded-2xl border border-white/10 bg-[rgba(10,14,22,0.55)] backdrop-blur-2xl shadow-[0_20px_60px_-10px_rgba(0,0,0,0.8),inset_0_1px_0_0_rgba(255,255,255,0.06)] overflow-hidden p-4 w-72 light:bg-[rgba(255,255,255,0.4)] light:backdrop-blur-2xl">
            <div aria-hidden="true" className="pointer-events-none absolute inset-0 rounded-2xl" style={{
              background: 'linear-gradient(180deg, rgba(173,216,255,0.18), rgba(255,255,255,0.04) 30%, rgba(150,160,255,0.14) 85%, rgba(255,255,255,0.06))',
              WebkitMask: 'linear-gradient(#000,#000) content-box, linear-gradient(#000,#000)',
              WebkitMaskComposite: 'xor' as any,
              maskComposite: 'exclude',
              padding: 1,
              borderRadius: 16,
            }} />
            <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-0 h-16" style={{
              background: 'linear-gradient(180deg, rgba(255,255,255,0.22), rgba(255,255,255,0.06) 45%, rgba(255,255,255,0) 100%)',
              filter: 'blur(4px)',
              mixBlendMode: 'screen',
            }} />
            <div aria-hidden="true" className="pointer-events-none absolute inset-0 rounded-2xl opacity-[0.015]" style={{
              backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 400 400' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")`,
            }} />

            <div className="relative z-10">
              {/* Header row */}
              <div className="flex items-center space-x-3">
                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-white/10 backdrop-blur-sm border border-white/20 flex items-center justify-center">
                  <Image
                    src="/irissymbolblack.png"
                    alt="Iris"
                    width={16}
                    height={16}
                    className="w-4 h-4 dark:hidden"
                  />
                  <Image
                    src="/irissymbolwhite.png"
                    alt="Iris"
                    width={16}
                    height={16}
                    className="w-4 h-4 hidden dark:block"
                  />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold text-foreground truncate">{thread.projectName}</div>
                  <div className="text-xs text-muted-foreground">
                    {(() => {
                      const date = new Date(thread.updatedAt);
                      const now = new Date();
                      const diff = now.getTime() - date.getTime();
                      const mins = Math.floor(diff / 60000);
                      const hrs = Math.floor(diff / 3600000);
                      const days = Math.floor(diff / 86400000);
                      if (mins < 60) return mins < 1 ? 'Just now' : `${mins}m ago`;
                      if (hrs < 24) return `${hrs}h ago`;
                      if (days === 1) return 'Yesterday';
                      if (days < 7) return `${days}d ago`;
                      return format(date, 'MMM d');
                    })()}
                  </div>
                </div>
              </div>

              {/* Large action button below */}
              <div className="mt-3">
                <button
                  onClick={(e) => { e.preventDefault(); e.stopPropagation(); handleSummarize(); }}
                  className="w-full h-9 rounded-xl bg-primary text-primary-foreground border border-primary/40 backdrop-blur-sm flex items-center justify-center gap-2 text-sm font-medium transition-all duration-200 hover:bg-primary/90 active:scale-[0.99]"
                  disabled={isSummarizing}
                >
                  <Sparkles className="w-4 h-4" />
                  <span>{isSummarizing ? 'Summarising…' : 'Summarise'}</span>
                </button>
              </div>

              {summaryText && (
                <div className="mt-3 text-xs text-muted-foreground whitespace-pre-wrap max-h-40 overflow-auto">
                  {summaryText}
                </div>
              )}
            </div>
          </div>
        </TooltipContent>
      </Tooltip>
    </SidebarMenuItem>
  );
};

export function NavAgents() {
  const { isMobile, state, setOpenMobile } = useSidebar()
  const [loadingThreadId, setLoadingThreadId] = useState<string | null>(null)
  const [showShareModal, setShowShareModal] = useState(false)
  const [selectedItem, setSelectedItem] = useState<{ threadId: string, projectId: string } | null>(null)
  const pathname = usePathname()
  const router = useRouter()
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false)
  const [threadToDelete, setThreadToDelete] = useState<{ id: string; name: string } | null>(null)
  const isNavigatingRef = useRef(false)
  const { performDelete } = useDeleteOperation();
  const isPerformingActionRef = useRef(false);
  const queryClient = useQueryClient();

  const [selectedThreads, setSelectedThreads] = useState<Set<string>>(new Set());
  const [deleteProgress, setDeleteProgress] = useState(0);
  const [totalToDelete, setTotalToDelete] = useState(0);

  const {
    data: projects = [],
    isLoading: isProjectsLoading,
    error: projectsError
  } = useProjects();

  const {
    data: threads = [],
    isLoading: isThreadsLoading,
    error: threadsError
  } = useThreads();

  const { mutate: deleteThreadMutation, isPending: isDeletingSingle } = useDeleteThread();
  const {
    mutate: deleteMultipleThreadsMutation,
    isPending: isDeletingMultiple
  } = useDeleteMultipleThreads();

  const combinedThreads: ThreadWithProject[] =
    !isProjectsLoading && !isThreadsLoading ?
      processThreadsWithProjects(threads, projects) : [];

  // Separate trigger threads from regular threads
  const regularThreads = combinedThreads.filter(thread => !thread.projectName?.startsWith('Trigger: '));
  const triggerThreads = combinedThreads.filter(thread => thread.projectName?.startsWith('Trigger: '));
  
  const groupedThreads: GroupedThreads = groupThreadsByDate(regularThreads);
  const groupedTriggerThreads: GroupedThreads = groupThreadsByDate(triggerThreads);

  const handleDeletionProgress = (completed: number, total: number) => {
    const percentage = (completed / total) * 100;
    setDeleteProgress(percentage);
  };

  useEffect(() => {
    const handleProjectUpdate = (event: Event) => {
      const customEvent = event as CustomEvent;
      if (customEvent.detail) {
        const { projectId, updatedData } = customEvent.detail;
        queryClient.invalidateQueries({ queryKey: projectKeys.details(projectId) });
        queryClient.invalidateQueries({ queryKey: projectKeys.lists() });
      }
    };

    window.addEventListener('project-updated', handleProjectUpdate as EventListener);
    return () => {
      window.removeEventListener(
        'project-updated',
        handleProjectUpdate as EventListener,
      );
    };
  }, [queryClient]);

  useEffect(() => {
    setLoadingThreadId(null);
  }, [pathname]);

  useEffect(() => {
    const handleNavigationComplete = () => {
      document.body.style.pointerEvents = 'auto';
      isNavigatingRef.current = false;
    };

    window.addEventListener("popstate", handleNavigationComplete);

    return () => {
      window.removeEventListener('popstate', handleNavigationComplete);
      // Ensure we clean up any leftover styles
      document.body.style.pointerEvents = "auto";
    };
  }, []);

  // Reset isNavigatingRef when pathname changes
  useEffect(() => {
    isNavigatingRef.current = false;
    document.body.style.pointerEvents = 'auto';
  }, [pathname]);

  // Function to handle thread click with loading state
  const handleThreadClick = (e: React.MouseEvent<HTMLAnchorElement>, threadId: string, url: string) => {
    // If thread is selected, prevent navigation 
    if (selectedThreads.has(threadId)) {
      e.preventDefault();
      return;
    }

    // Set loading state for normal clicks (not meta key)
    if (!e.metaKey) {
      setLoadingThreadId(threadId);
    }

    // Close mobile menu on navigation
    if (isMobile) {
      setOpenMobile(false);
    }
  }

  // Toggle thread selection for multi-select
  const toggleThreadSelection = (threadId: string, e?: React.MouseEvent) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }

    setSelectedThreads(prev => {
      const newSelection = new Set(prev);
      if (newSelection.has(threadId)) {
        newSelection.delete(threadId);
      } else {
        newSelection.add(threadId);
      }
      return newSelection;
    });
  };

  // Select all threads
  const selectAllThreads = () => {
    const allThreadIds = combinedThreads.map(thread => thread.threadId);
    setSelectedThreads(new Set(allThreadIds));
  };

  // Deselect all threads
  const deselectAllThreads = () => {
    setSelectedThreads(new Set());
  };

  // Function to handle thread deletion
  const handleDeleteThread = async (threadId: string, threadName: string) => {
    setThreadToDelete({ id: threadId, name: threadName });
    setIsDeleteDialogOpen(true);
  };

  // Function to handle multi-delete
  const handleMultiDelete = () => {
    if (selectedThreads.size === 0) return;

    // Get thread names for confirmation dialog
    const threadsToDelete = combinedThreads.filter(t => selectedThreads.has(t.threadId));
    const threadNames = threadsToDelete.map(t => t.projectName).join(", ");

    setThreadToDelete({
      id: "multiple",
      name: selectedThreads.size > 3
        ? `${selectedThreads.size} conversations`
        : threadNames
    });

    setTotalToDelete(selectedThreads.size);
    setDeleteProgress(0);
    setIsDeleteDialogOpen(true);
  };

  const confirmDelete = async () => {
    if (!threadToDelete || isPerformingActionRef.current) return;

    // Mark action in progress
    isPerformingActionRef.current = true;

    // Close dialog first for immediate feedback
    setIsDeleteDialogOpen(false);

    // Check if it's a single thread or multiple threads
    if (threadToDelete.id !== "multiple") {
      // Single thread deletion
      const threadId = threadToDelete.id;
      const isActive = !!pathname?.includes(threadId);

      // Store threadToDelete in a local variable since it might be cleared
      const deletedThread = { ...threadToDelete };

      // Get sandbox ID from projects data
      const thread = combinedThreads.find(t => t.threadId === threadId);
      const project = projects.find(p => p.id === thread?.projectId);
      const sandboxId = project?.sandbox?.id;

      // Use the centralized deletion system with completion callback
      await performDelete(
        threadId,
        isActive,
        async () => {
          // Delete the thread using the mutation with sandbox ID
          deleteThreadMutation(
            { threadId, sandboxId },
            {
              onSuccess: () => {
                // Invalidate queries to refresh the list
                queryClient.invalidateQueries({ queryKey: threadKeys.lists() });
                toast.success('Conversation deleted successfully');
              },
              onSettled: () => {
                setThreadToDelete(null);
                isPerformingActionRef.current = false;
              }
            }
          );
        },
        // Completion callback to reset local state
        () => {
          setThreadToDelete(null);
          isPerformingActionRef.current = false;
        },
      );
    } else {
      // Multi-thread deletion
      const threadIdsToDelete = Array.from(selectedThreads);
      const isActiveThreadIncluded = threadIdsToDelete.some(id => pathname?.includes(id));

      // Show initial toast
      toast.info(`Deleting ${threadIdsToDelete.length} conversations...`);

      try {
        // If the active thread is included, handle navigation first
        if (isActiveThreadIncluded) {
          // Navigate to dashboard before deleting
          isNavigatingRef.current = true;
          document.body.style.pointerEvents = 'none';
          router.push('/');

          // Wait a moment for navigation to start
          await new Promise(resolve => setTimeout(resolve, 100));
        }

        // Use the mutation for bulk deletion
        deleteMultipleThreadsMutation(
          {
            threadIds: threadIdsToDelete,
            threadSandboxMap: Object.fromEntries(
              threadIdsToDelete.map(threadId => {
                const thread = combinedThreads.find(t => t.threadId === threadId);
                const project = projects.find(p => p.id === thread?.projectId);
                return [threadId, project?.sandbox?.id || ''];
              }).filter(([, sandboxId]) => sandboxId)
            ),
            onProgress: handleDeletionProgress
          },
          {
            onSuccess: (data) => {
              // Invalidate queries to refresh the list
              queryClient.invalidateQueries({ queryKey: threadKeys.lists() });

              // Show success message
              toast.success(`Successfully deleted ${data.successful.length} conversations`);

              // If some deletions failed, show warning
              if (data.failed.length > 0) {
                toast.warning(`Failed to delete ${data.failed.length} conversations`);
              }

              // Reset states
              setSelectedThreads(new Set());
              setDeleteProgress(0);
              setTotalToDelete(0);
            },
            onError: (error) => {
              console.error('Error in bulk deletion:', error);
              toast.error('Error deleting conversations');
            },
            onSettled: () => {
              setThreadToDelete(null);
              isPerformingActionRef.current = false;
              setDeleteProgress(0);
              setTotalToDelete(0);
            }
          }
        );
      } catch (err) {
        console.error('Error initiating bulk deletion:', err);
        toast.error('Error initiating deletion process');

        // Reset states
        setSelectedThreads(new Set());
        setThreadToDelete(null);
        isPerformingActionRef.current = false;
        setDeleteProgress(0);
        setTotalToDelete(0);
      }
    }
  };

  // Loading state or error handling
  const isLoading = isProjectsLoading || isThreadsLoading;
  const hasError = projectsError || threadsError;

  if (hasError) {
    console.error('Error loading data:', { projectsError, threadsError });
  }

  return (
    <SidebarGroup>
      <div className="flex justify-between items-center">
        <SidebarGroupLabel>Tasks</SidebarGroupLabel>
        {(state !== 'collapsed' || isMobile) ? (
          <div className="flex items-center space-x-1">
            {selectedThreads.size > 0 ? (
              <>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={deselectAllThreads}
                  className="h-7 w-7"
                >
                  <X className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={selectAllThreads}
                  disabled={selectedThreads.size === combinedThreads.length}
                  className="h-7 w-7"
                >
                  <Check className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={handleMultiDelete}
                  className="h-7 w-7 text-destructive"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </>
            ) : null}
          </div>
        ) : null}
      </div>

      <SidebarMenu className="overflow-y-auto max-h-[calc(100vh-200px)] [&::-webkit-scrollbar]:hidden [-ms-overflow-style:'none'] [scrollbar-width:'none']">


        {(state !== 'collapsed' || isMobile) && (
          <>
            {isLoading ? (
              Array.from({ length: 3 }).map((_, index) => (
                <SidebarMenuItem key={`skeleton-${index}`}>
                  <SidebarMenuButton>
                    <div className="h-4 w-4 bg-sidebar-foreground/10 rounded-md animate-pulse"></div>
                    <div className="h-3 bg-sidebar-foreground/10 rounded w-3/4 animate-pulse"></div>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))
              ) : (regularThreads.length > 0 || triggerThreads.length > 0) ? (
                <>
                {triggerThreads.length > 0 && (
                  <Collapsible defaultOpen={false} className="group/collapsible w-full mb-3">
                    <SidebarMenuItem>
                      <CollapsibleTrigger asChild>
                        <SidebarMenuButton className="w-full">
                          <ChevronRight className="transition-transform h-4 w-4 group-data-[state=open]/collapsible:rotate-90" />
                          <Folder className="h-4 w-4" />
                          <span className="flex-1 text-left">Trigger Runs ({triggerThreads.length})</span>
                        </SidebarMenuButton>
                      </CollapsibleTrigger>
                    </SidebarMenuItem>
                    <CollapsibleContent>
                      <div className="pl-6">
                        {Object.entries(groupedTriggerThreads).map(([dateGroup, threadsInGroup]) => (
                          <div key={`trigger-${dateGroup}`}>
                            <DateGroupHeader dateGroup={dateGroup} count={threadsInGroup.length} />
                            {threadsInGroup.map((thread) => {
                              const isActive = pathname?.includes(thread.threadId) || false;
                              const isThreadLoading = loadingThreadId === thread.threadId;
                              const isSelected = selectedThreads.has(thread.threadId);

                              return (
                                <ThreadItem
                                  key={`trigger-thread-${thread.threadId}`}
                                  thread={thread}
                                  isActive={isActive}
                                  isThreadLoading={isThreadLoading}
                                  isSelected={isSelected}
                                  selectedThreads={selectedThreads}
                                  loadingThreadId={loadingThreadId}
                                  pathname={pathname}
                                  isMobile={isMobile}
                                  handleThreadClick={handleThreadClick}
                                  toggleThreadSelection={toggleThreadSelection}
                                  handleDeleteThread={handleDeleteThread}
                                  setSelectedItem={setSelectedItem}
                                  setShowShareModal={setShowShareModal}
                                />
                              );
                            })}
                          </div>
                        ))}
                      </div>
                    </CollapsibleContent>
                  </Collapsible>
                )}
                  {Object.entries(groupedThreads).map(([dateGroup, threadsInGroup]) => (
                    <div key={dateGroup}>
                      <DateGroupHeader dateGroup={dateGroup} count={threadsInGroup.length} />
                      {threadsInGroup.map((thread) => {
                        const isActive = pathname?.includes(thread.threadId) || false;
                        const isThreadLoading = loadingThreadId === thread.threadId;
                        const isSelected = selectedThreads.has(thread.threadId);

                        return (
                          <ThreadItem
                            key={`thread-${thread.threadId}`}
                            thread={thread}
                            isActive={isActive}
                            isThreadLoading={isThreadLoading}
                            isSelected={isSelected}
                            selectedThreads={selectedThreads}
                            loadingThreadId={loadingThreadId}
                            pathname={pathname}
                            isMobile={isMobile}
                            handleThreadClick={handleThreadClick}
                            toggleThreadSelection={toggleThreadSelection}
                            handleDeleteThread={handleDeleteThread}
                            setSelectedItem={setSelectedItem}
                            setShowShareModal={setShowShareModal}
                          />
                        );
                      })}
                    </div>
                  ))}
                </>
              ) : (
              <SidebarMenuItem>
                <SidebarMenuButton className="text-sidebar-foreground/70">
                  <span>No tasks yet</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            )}
          </>
        )}
      </SidebarMenu>

      {(isDeletingSingle || isDeletingMultiple) && totalToDelete > 0 && (
        <div className="mt-2 px-2">
          <div className="text-xs text-muted-foreground mb-1">
            Deleting {deleteProgress > 0 ? `(${Math.floor(deleteProgress)}%)` : '...'}
          </div>
          <div className="w-full bg-secondary h-1 rounded-full overflow-hidden">
            <div
              className="bg-primary h-1 transition-all duration-300 ease-in-out"
              style={{ width: `${deleteProgress}%` }}
            />
          </div>
        </div>
      )}

      <ShareModal
        isOpen={showShareModal}
        onClose={() => setShowShareModal(false)}
        threadId={selectedItem?.threadId}
        projectId={selectedItem?.projectId}
      />

      {threadToDelete && (
        <DeleteConfirmationDialog
          isOpen={isDeleteDialogOpen}
          onClose={() => setIsDeleteDialogOpen(false)}
          onConfirm={confirmDelete}
          threadName={threadToDelete.name}
          isDeleting={isDeletingSingle || isDeletingMultiple}
        />
      )}
    </SidebarGroup>
  );
}