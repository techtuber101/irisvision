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
    const recentThreads = threadsWithProjects.slice(0, 4).map((thread, index) => ({
      id: `suggestion-chat-${thread.threadId}`,
      type: 'suggestion' as const,
      title: thread.projectName,
      subtitle: 'Recent chat',
      href: thread.url,
      icon: <MessageSquare className="h-4 w-4 text-primary" />,
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
        icon: <MessageSquare className="h-4 w-4" />,
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
          icon: <MessageSquare className="h-4 w-4 text-primary" />,
          score: 10 - index,
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
        score: 8 - index,
      }));

    return [...messageItems, ...chatItems, ...fileItems]
      .filter((item) => item.score > 0)
      .sort((a, b) => b.score - a.score);
  }, [debouncedQuery, recentFiles, threadMessages, threadsWithProjects]);

  const renderResultRow = (item: SearchResultItem) => {
    const content = (
      <div
        key={item.id}
        className="group flex items-start gap-3 rounded-xl border border-white/10 bg-white/5 px-3 py-2 transition-all hover:-translate-y-px hover:bg-white/10 dark:border-white/5 dark:bg-white/5"
      >
        <div className="mt-0.5 flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-primary/20 to-primary/5 text-primary shadow-inner">
          {item.icon}
        </div>
        <div className="flex-1 space-y-1">
          <div className="flex items-center justify-between gap-2">
            <p className="text-sm font-medium text-foreground">{highlightText(item.title, debouncedQuery)}</p>
            {item.metadata && (
              <span className="text-[10px] uppercase tracking-wide text-muted-foreground">{item.metadata}</span>
            )}
          </div>
          {item.subtitle && <p className="text-xs text-muted-foreground">{item.subtitle}</p>}
          {item.snippet && (
            <p className="text-sm text-foreground/80 line-clamp-2">{highlightText(item.snippet, debouncedQuery)}</p>
          )}
          <div className="flex items-center gap-2 text-[10px] uppercase tracking-wide text-primary/80">
            <span className="rounded-full bg-primary/10 px-2 py-0.5 text-primary">{item.type}</span>
            {item.type === 'suggestion' && <Sparkles className="h-3 w-3" />}
          </div>
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
      <DialogContent className="max-w-3xl border border-white/15 bg-gradient-to-br from-background/80 via-background/70 to-background/90 p-0 shadow-2xl backdrop-blur-2xl">
        <DialogHeader className="space-y-2 p-6 pb-3">
          <DialogTitle className="flex items-center justify-between text-lg font-semibold text-foreground">
            Global Search
            <Badge variant="outline" className="bg-white/5 text-xs uppercase text-muted-foreground">
              ⌘K / Ctrl+K
            </Badge>
          </DialogTitle>
          <DialogDescription className="text-sm text-muted-foreground">
            Search chats, messages, and files without leaving your flow.
          </DialogDescription>
          <div className="relative mt-2">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search anything…"
              className="h-12 rounded-2xl border border-white/10 bg-white/10 pl-10 text-base shadow-inner backdrop-blur-xl focus-visible:ring-2 focus-visible:ring-primary/40"
            />
            {isIndexing && (
              <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">Indexing…</span>
            )}
          </div>
        </DialogHeader>

        <div className="flex flex-col gap-4 px-6 pb-6">
          {showSuggestions ? (
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-muted-foreground">
                <Clock className="h-3 w-3" /> Recent
              </div>
              <div className="grid grid-cols-1 gap-3">
                {suggestionRows.map(renderResultRow)}
              </div>
            </div>
          ) : results.length > 0 ? (
            <ScrollArea className="max-h-[60vh] pr-3">
              <div className="grid grid-cols-1 gap-3 pb-3">
                {results.map(renderResultRow)}
              </div>
            </ScrollArea>
          ) : (
            <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-white/10 bg-white/5 p-8 text-center text-muted-foreground">
              <Search className="mb-2 h-6 w-6" />
              <p className="text-sm">No matches yet. Try a different phrase.</p>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
