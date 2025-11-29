'use client';

import React, { useEffect, useMemo, useState } from 'react';
import {
  Bolt,
  Clock,
  File,
  FileText,
  MessageSquare,
  Search,
  Sparkles,
} from 'lucide-react';
import { useRouter } from 'next/navigation';

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { useProjects, processThreadsWithProjects } from '@/hooks/react-query/sidebar/use-sidebar';
import { useAllThreads } from '@/hooks/react-query/threads/use-thread-queries';
import { useKnowledgeFolders } from '@/hooks/react-query/knowledge-base/use-folders';
import { getMessages, type Message } from '@/lib/api';
import { useGlobalSearch } from '@/contexts/global-search-context';
import { useDebounce } from '@/hooks/use-debounce';
import { ThreadIcon } from '@/components/sidebar/thread-icon';

interface SearchResultItem {
  id: string;
  type: 'chat' | 'message' | 'file' | 'suggestion';
  title: string;
  subtitle?: string;
  snippet?: string;
  href?: string;
  metadata?: string;
  icon: React.ReactNode;
  action?: () => void;
  score: number;
}

function formatDateLabel(dateString?: string) {
  if (!dateString) return '';
  const date = new Date(dateString);
  return date.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
  });
}

function extractMessageText(message: Message): string {
  if (!message?.content) return '';
  try {
    const parsed = JSON.parse(message.content);
    if (typeof parsed === 'string') return parsed;
    if (parsed && typeof parsed === 'object' && 'content' in parsed) {
      return typeof parsed.content === 'string' ? parsed.content : JSON.stringify(parsed.content);
    }
  } catch {
    // Ignore parse errors and fall back to raw content
  }
  return typeof message.content === 'string' ? message.content : '';
}

function highlightText(text: string, query: string) {
  if (!query) return text;
  const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const parts = text.split(new RegExp(`(${escaped})`, 'gi'));
  return parts.map((part, index) =>
    part.toLowerCase() === query.toLowerCase() ? (
      <mark key={`${part}-${index}`} className="rounded bg-primary/10 px-0.5 text-primary">
        {part}
      </mark>
    ) : (
      <React.Fragment key={`${part}-${index}`}>{part}</React.Fragment>
    ),
  );
}

export function GlobalSearchModal() {
  const router = useRouter();
  const { isOpen, closeSearch, query, setQuery } = useGlobalSearch();
  const debouncedQuery = useDebounce(query, 200);

  const { data: projects = [] } = useProjects();
  const { data: threads = [] } = useAllThreads();
  const { recentFiles } = useKnowledgeFolders();

  const [threadMessages, setThreadMessages] = useState<Record<string, Message[]>>({});
  const [isIndexing, setIsIndexing] = useState(false);
  const [hasPrefetched, setHasPrefetched] = useState(false);

  const threadsWithProjects = useMemo(() => processThreadsWithProjects(threads, projects), [threads, projects]);

  useEffect(() => {
    if (!isOpen || hasPrefetched || !threadsWithProjects.length) return;

    const loadMessages = async () => {
      setIsIndexing(true);
      const topThreads = threadsWithProjects.slice(0, 12);
      const results = await Promise.all(
        topThreads.map(async (thread) => {
          try {
            const messages = await getMessages(thread.threadId);
            return { id: thread.threadId, messages };
          } catch (error) {
            console.error('Failed to load messages for search index', error);
            return { id: thread.threadId, messages: [] as Message[] };
          }
        }),
      );

      setThreadMessages((prev) => {
        const next = { ...prev };
        for (const result of results) {
          next[result.id] = result.messages;
        }
        return next;
      });
      setIsIndexing(false);
      setHasPrefetched(true);
    };

    loadMessages();
  }, [hasPrefetched, isOpen, threadsWithProjects]);

  const handleSelect = (item: SearchResultItem) => {
    closeSearch();
    if (item.action) {
      item.action();
      return;
    }
    if (item.href) {
      router.push(item.href);
    }
  };

  const suggestionRows: SearchResultItem[] = useMemo(() => {
    const recentThreads = threadsWithProjects.slice(0, 2).map((thread, index) => ({
      id: `suggestion-chat-${thread.threadId}`,
      type: 'suggestion' as const,
      title: thread.projectName,
      subtitle: 'Recent chat',
      href: thread.url,
      icon: <ThreadIcon iconName={thread.iconName} className="h-4 w-4" size={16} />,
      score: 5 - index,
    }));

    const quickActions: SearchResultItem[] = [
      {
        id: 'suggestion-files',
        type: 'suggestion',
        title: 'Files you recently worked on',
        subtitle: 'Jump back into your knowledge base',
        href: '/knowledge-base',
        icon: <File className="h-4 w-4 text-blue-500" />,
        score: 3,
      },
      {
        id: 'suggestion-settings',
        type: 'suggestion',
        title: 'Common settings',
        subtitle: 'Adjust preferences and integrations',
        href: '/settings',
        icon: <Bolt className="h-4 w-4 text-amber-500" />,
        score: 2,
      },
    ];

    return [...recentThreads, ...quickActions];
  }, [threadsWithProjects]);

  const results: SearchResultItem[] = useMemo(() => {
    if (!debouncedQuery.trim()) return [];
    const normalizedQuery = debouncedQuery.toLowerCase();

    const chatItems: SearchResultItem[] = threadsWithProjects.map((thread) => {
      const snippetMessages = threadMessages[thread.threadId] || [];
      const snippetText = snippetMessages.length > 0 ? extractMessageText(snippetMessages[snippetMessages.length - 1]) : undefined;
      const score = thread.projectName.toLowerCase().includes(normalizedQuery) ? 6 : 1;
      return {
        id: `chat-${thread.threadId}`,
        type: 'chat',
        title: thread.projectName,
        subtitle: 'Chat thread',
        snippet: snippetText,
        href: thread.url,
        metadata: formatDateLabel(thread.updatedAt),
        icon: <ThreadIcon iconName={thread.iconName} className="h-4 w-4" size={16} />,
        score,
      };
    });

    const messageItems: SearchResultItem[] = Object.entries(threadMessages).flatMap(([threadId, messages]) => {
      const thread = threadsWithProjects.find((item) => item.threadId === threadId);
      if (!thread) return [];

      return messages
        .map((message, idx) => ({
          text: extractMessageText(message),
          index: idx,
        }))
        .filter(({ text }) => text.toLowerCase().includes(normalizedQuery))
        .map(({ text, index }) => ({
          id: `message-${threadId}-${index}`,
          type: 'message' as const,
          title: thread.projectName,
          subtitle: 'Chat message',
          snippet: text,
          href: thread.url,
          metadata: formatDateLabel(thread.updatedAt),
          icon: <ThreadIcon iconName={thread.iconName} className="h-4 w-4" size={16} />,
          score: Math.max(1, 10 - index),
        }));
    });

    const fileItems: SearchResultItem[] = recentFiles
      .filter((file) =>
        file.filename.toLowerCase().includes(normalizedQuery) ||
        file.summary?.toLowerCase().includes(normalizedQuery),
      )
      .map((file, index) => ({
        id: `file-${file.entry_id}`,
        type: 'file' as const,
        title: file.filename,
        subtitle: 'Knowledge file',
        snippet: file.summary,
        href: '/knowledge-base',
        metadata: formatDateLabel(file.created_at),
        icon: <FileText className="h-4 w-4 text-emerald-500" />,
        score: Math.max(1, 8 - index),
      }));

    return [...messageItems, ...chatItems, ...fileItems]
      .filter((item) => item.score > 0)
      .sort((a, b) => b.score - a.score);
  }, [debouncedQuery, recentFiles, threadMessages, threadsWithProjects]);

  const renderResultRow = (item: SearchResultItem) => {
    const content = (
      <div
        key={item.id}
        className="group relative flex items-start gap-3 rounded-2xl border border-white/10 bg-[rgba(10,14,22,0.35)] backdrop-blur-xl px-3 py-2.5 transition-all duration-200 hover:-translate-y-px hover:bg-[rgba(10,14,22,0.5)] hover:border-white/15 hover:shadow-[0_4px_12px_rgba(0,0,0,0.3),inset_0_1px_0_rgba(255,255,255,0.08)] dark:border-white/5 dark:bg-white/5 light:border-black/10 light:bg-[rgba(255,255,255,0.15)] light:hover:bg-[rgba(255,255,255,0.25)] light:hover:border-black/15 overflow-hidden"
      >
        {/* Glassy gradient overlay on hover */}
        <div className="absolute inset-0 opacity-0 light:group-hover:opacity-100 dark:opacity-0 pointer-events-none transition-opacity duration-200 rounded-xl" style={{
          background: 'linear-gradient(180deg, rgba(0,0,0,0.04), rgba(0,0,0,0.01) 30%, rgba(0,0,0,0.03) 85%, rgba(0,0,0,0.02))',
        }} />
        <div className="mt-0.5 flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-primary/20 to-primary/5 text-primary shadow-inner backdrop-blur-sm border border-white/5 relative z-10">
          {item.icon}
        </div>
        <div className="flex-1 space-y-1 relative z-10 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-foreground truncate">{highlightText(item.title, debouncedQuery)}</p>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              {item.metadata && (
                <span className="text-[10px] uppercase tracking-wide text-muted-foreground whitespace-nowrap">{item.metadata}</span>
              )}
              <span className="rounded-full bg-primary/10 backdrop-blur-sm border border-primary/20 px-2 py-0.5 text-primary text-[10px] uppercase tracking-wide whitespace-nowrap">{item.type}</span>
              {item.type === 'suggestion' && <Sparkles className="h-3 w-3 flex-shrink-0" />}
            </div>
          </div>
          {item.subtitle && <p className="text-xs text-muted-foreground truncate">{item.subtitle}</p>}
          {item.snippet && (
            <p className="text-sm text-foreground/80 line-clamp-2">{highlightText(item.snippet, debouncedQuery)}</p>
          )}
        </div>
      </div>
    );

    return (
      <button
        key={item.id}
        onClick={() => handleSelect(item)}
        className="w-full text-left transition-transform focus:outline-none focus:ring-2 focus:ring-primary/40 focus:ring-offset-2 focus:ring-offset-background"
      >
        {content}
      </button>
    );
  };

  const showSuggestions = !debouncedQuery.trim();

  return (
    <Dialog open={isOpen} onOpenChange={(open) => (!open ? closeSearch() : undefined)}>
      <DialogContent showClose={false} className="max-w-xl border border-white/10 bg-[rgba(10,14,22,0.55)] backdrop-blur-2xl shadow-[0_20px_60px_-10px_rgba(0,0,0,0.8),inset_0_1px_0_0_rgba(255,255,255,0.06)] p-0 overflow-hidden transition-all duration-300 light:border-white/20 light:bg-[rgba(255,255,255,0.25)] light:shadow-[0_20px_60px_-10px_rgba(0,0,0,0.05)] !rounded-3xl">
        {/* Glassy gradient rim overlay */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 rounded-3xl z-0"
          style={{
            background: 'linear-gradient(180deg, rgba(173,216,255,0.18), rgba(255,255,255,0.04) 30%, rgba(150,160,255,0.14) 85%, rgba(255,255,255,0.06))',
            WebkitMask: 'linear-gradient(#000,#000) content-box, linear-gradient(#000,#000)',
            WebkitMaskComposite: 'xor' as any,
            maskComposite: 'exclude',
            padding: 1,
            borderRadius: 24,
          }}
          data-light-gradient="linear-gradient(180deg, rgba(0,0,0,0.06), rgba(0,0,0,0.02) 30%, rgba(0,0,0,0.05) 85%, rgba(0,0,0,0.03))"
          data-dark-gradient="linear-gradient(180deg, rgba(173,216,255,0.18), rgba(255,255,255,0.04) 30%, rgba(150,160,255,0.14) 85%, rgba(255,255,255,0.06))"
        />
        {/* Specular streak overlay */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 top-0 h-24 rounded-t-3xl z-0"
          style={{
            background: 'linear-gradient(180deg, rgba(255,255,255,0.22), rgba(255,255,255,0.06) 45%, rgba(255,255,255,0) 100%)',
            filter: 'blur(6px)',
            mixBlendMode: 'screen',
          }}
          data-light-streak="linear-gradient(180deg, rgba(0,0,0,0.08), rgba(0,0,0,0.03) 45%, rgba(0,0,0,0) 100%)"
          data-dark-streak="linear-gradient(180deg, rgba(255,255,255,0.22), rgba(255,255,255,0.06) 45%, rgba(255,255,255,0) 100%)"
        />
        
        <DialogHeader className="space-y-3 p-5 pb-4 relative z-10">
          <div className="relative">
            <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground z-10" />
            <Input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search anything…"
              className="relative z-10 h-14 rounded-2xl border border-white/10 bg-[rgba(10,14,22,0.55)] backdrop-blur-2xl shadow-[0_20px_60px_-10px_rgba(0,0,0,0.8),inset_0_1px_0_0_rgba(255,255,255,0.06)] pl-11 pr-4 text-base transition-all duration-300 hover:scale-[1.01] light:border-white/20 light:bg-[rgba(255,255,255,0.25)] light:shadow-[0_20px_60px_-10px_rgba(0,0,0,0.05)] focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:border-white/20 dark:focus-visible:border-white/15"
            />
            {isIndexing && (
              <span className="absolute right-5 top-1/2 -translate-y-1/2 text-xs text-muted-foreground z-10">Indexing…</span>
            )}
          </div>
        </DialogHeader>

        <div className="flex flex-col gap-3 px-5 pb-5 relative z-10">
          {showSuggestions ? (
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-muted-foreground px-1">
                <Sparkles className="h-3 w-3" /> Smart Suggestions
              </div>
              <div className="grid grid-cols-1 gap-2">
                {suggestionRows.map(renderResultRow)}
              </div>
            </div>
          ) : results.length > 0 ? (
            <ScrollArea className="max-h-[50vh] pr-2">
              <div className="grid grid-cols-1 gap-2 pb-2">
                {results.map(renderResultRow)}
              </div>
            </ScrollArea>
          ) : (
            <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-white/10 bg-[rgba(10,14,22,0.35)] backdrop-blur-xl p-6 text-center text-muted-foreground light:border-black/10 light:bg-[rgba(255,255,255,0.15)]">
              <Search className="mb-2 h-5 w-5" />
              <p className="text-sm">No matches yet. Try a different phrase.</p>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
