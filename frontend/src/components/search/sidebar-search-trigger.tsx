'use client';

import React from 'react';
import { Search } from 'lucide-react';
import { useGlobalSearch } from '@/contexts/global-search-context';
import { useSidebar } from '@/components/ui/sidebar';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { SidebarMenuItem, SidebarMenuButton } from '@/components/ui/sidebar';
import { useIsMobile } from '@/hooks/use-mobile';

export function SidebarSearchTrigger() {
  const { openSearch } = useGlobalSearch();
  const { state, setOpenMobile } = useSidebar();
  const isMobile = useIsMobile();

  if (state === 'collapsed') {
    return (
      <SidebarMenuItem>
        <Tooltip>
          <TooltipTrigger asChild>
            <SidebarMenuButton
              onClick={openSearch}
              tooltip="Search (⌘K)"
              className="transition-all duration-200 border border-transparent hover:!bg-white/10 dark:hover:!bg-white/5 hover:backdrop-blur-sm light:hover:!bg-[rgba(255,255,255,0.15)] relative overflow-hidden"
            >
              <Search className="h-4 w-4 relative z-10" />
            </SidebarMenuButton>
          </TooltipTrigger>
          <TooltipContent>Search (⌘K)</TooltipContent>
        </Tooltip>
      </SidebarMenuItem>
    );
  }

  return (
    <SidebarMenuItem className="group/search">
      <SidebarMenuButton
        onClick={() => {
          openSearch();
          if (isMobile) setOpenMobile(false);
        }}
        className="transition-all duration-200 border border-transparent hover:!bg-white/10 dark:hover:!bg-white/5 hover:backdrop-blur-sm light:hover:!bg-[rgba(255,255,255,0.15)] relative overflow-hidden"
      >
        {/* Light mode glassy gradient overlay on hover */}
        <div className="absolute inset-0 opacity-0 light:group-hover/search:opacity-100 dark:opacity-0 pointer-events-none transition-opacity duration-200 rounded-lg" style={{
          background: 'linear-gradient(180deg, rgba(0,0,0,0.04), rgba(0,0,0,0.01) 30%, rgba(0,0,0,0.03) 85%, rgba(0,0,0,0.02))',
        }} />
        <Search className="h-4 w-4 mr-1 relative z-10" />
        <span className="flex items-center justify-between w-full relative z-10">
          Smart Search
        </span>
      </SidebarMenuButton>
    </SidebarMenuItem>
  );
}
