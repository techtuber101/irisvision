'use client';

import React from 'react';
import { Search } from 'lucide-react';
import { useGlobalSearch } from '@/contexts/global-search-context';
import { useSidebar } from '@/components/ui/sidebar';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

export function SidebarSearchTrigger() {
  const { openSearch } = useGlobalSearch();
  const { state } = useSidebar();

  if (state === 'collapsed') {
    return (
      <div className="px-2 pb-2">
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type="button"
              onClick={openSearch}
              className="flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-white/10 text-foreground shadow-sm backdrop-blur hover:bg-white/20 focus:outline-none focus:ring-2 focus:ring-primary/40"
              aria-label="Open search"
            >
              <Search className="h-4 w-4" />
            </button>
          </TooltipTrigger>
          <TooltipContent>Search (⌘K)</TooltipContent>
        </Tooltip>
      </div>
    );
  }

  return (
    <div className="px-2 pb-2">
      <button
        type="button"
        onClick={openSearch}
        className={cn(
          'relative flex h-10 w-full items-center rounded-xl border border-white/10 bg-white/5 px-3 text-left text-sm text-foreground shadow-inner backdrop-blur transition hover:bg-white/10 focus:outline-none focus:ring-2 focus:ring-primary/30',
        )}
      >
        <Search className="mr-2 h-4 w-4 text-muted-foreground" />
        <span className="flex-1 truncate text-muted-foreground">Search everything</span>
        <span className="text-[10px] uppercase tracking-wide text-muted-foreground">⌘K</span>
      </button>
    </div>
  );
}
