'use client';

import React, { useEffect, useMemo, useRef, useState, useCallback, memo } from 'react';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
    DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { Cpu, Search, Check, ChevronDown, Plus, ExternalLink, Loader2, Brain, Wrench, Database, Zap, Plug2, Sparkles } from 'lucide-react';
import { useAgents } from '@/hooks/react-query/agents/use-agents';
import { IrisLogo } from '@/components/sidebar/iris-logo';
import type { ModelOption } from '@/hooks/use-model-selection';

export type SubscriptionStatus = 'no_subscription' | 'active';

import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { IntegrationsRegistry } from '@/components/agents/integrations-registry';
import { useComposioToolkitIcon } from '@/hooks/react-query/composio/use-composio';
import { Skeleton } from '@/components/ui/skeleton';
import { NewAgentDialog } from '@/components/agents/new-agent-dialog';
import { AgentAvatar } from '@/components/thread/content/agent-avatar';
import { AgentModelSelector } from '@/components/agents/config/model-selector';
import { AgentConfigurationDialog } from '@/components/agents/agent-configuration-dialog';

type UnifiedConfigMenuProps = {
    isLoggedIn?: boolean;

    // Agent
    selectedAgentId?: string;
    onAgentSelect?: (agentId: string | undefined) => void;

    // Model
    selectedModel: string;
    onModelChange: (modelId: string) => void;
    modelOptions: ModelOption[];
    subscriptionStatus: SubscriptionStatus;
    canAccessModel: (modelId: string) => boolean;
    refreshCustomModels?: () => void;
    onUpgradeRequest?: () => void;
    
    // Enhance Vision
    currentInputValue?: string;
    onInputChange?: (value: string) => void;
};


const LoggedInMenu: React.FC<UnifiedConfigMenuProps> = memo(function LoggedInMenu({
    isLoggedIn = true,
    selectedAgentId,
    onAgentSelect,
    selectedModel,
    onModelChange,
    modelOptions,
    canAccessModel,
    subscriptionStatus,
    onUpgradeRequest,
    currentInputValue = '',
    onInputChange,
}) {
    const [isOpen, setIsOpen] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [debouncedSearchQuery, setDebouncedSearchQuery] = useState('');
    const [currentPage, setCurrentPage] = useState(1);
    const [allAgents, setAllAgents] = useState<any[]>([]);
    const searchContainerRef = useRef<HTMLDivElement>(null);
    const [integrationsOpen, setIntegrationsOpen] = useState(false);
    const [showNewAgentDialog, setShowNewAgentDialog] = useState(false);
    const searchInputRef = useRef<HTMLInputElement>(null);
    const [agentConfigDialog, setAgentConfigDialog] = useState<{ open: boolean; tab: 'instructions' | 'knowledge' | 'triggers' | 'tools' | 'integrations' }>({ open: false, tab: 'instructions' });

    // Debounce search query
    useEffect(() => {
        const timer = setTimeout(() => {
            setDebouncedSearchQuery(searchQuery);
            setCurrentPage(1); // Reset to first page when searching
        }, 300);
        return () => clearTimeout(timer);
    }, [searchQuery]);

    // Fetch agents with proper pagination and search
    const agentsParams = useMemo(() => ({
        page: currentPage,
        limit: 50,
        search: debouncedSearchQuery || undefined,
    }), [currentPage, debouncedSearchQuery]);

    const { data: agentsResponse, isLoading, isFetching } = useAgents(agentsParams, { enabled: isLoggedIn });

    // Update agents list when data changes
    useEffect(() => {
        if (agentsResponse?.agents) {
            if (currentPage === 1 || debouncedSearchQuery) {
                // First page or new search - replace all agents
                setAllAgents(agentsResponse.agents);
            } else {
                // Subsequent pages - append to existing agents
                setAllAgents(prev => [...prev, ...agentsResponse.agents]);
            }
        }
    }, [agentsResponse, currentPage, debouncedSearchQuery]);

    const agents: any[] = allAgents;

    // Only fetch integration icons when authenticated AND the menu is open
    const iconsEnabled = isLoggedIn && isOpen;
    const { data: googleDriveIcon } = useComposioToolkitIcon('googledrive', { enabled: iconsEnabled });
    const { data: slackIcon } = useComposioToolkitIcon('slack', { enabled: iconsEnabled });
    const { data: notionIcon } = useComposioToolkitIcon('notion', { enabled: iconsEnabled });

    useEffect(() => {
        if (isOpen) {
            setTimeout(() => searchInputRef.current?.focus(), 30);
        } else {
            setSearchQuery('');
            setDebouncedSearchQuery('');
            setCurrentPage(1);
        }
    }, [isOpen]);

    // Keep focus stable even when list size changes
    useEffect(() => {
        if (isOpen) searchInputRef.current?.focus();
    }, [searchQuery, isOpen]);

    const handleSearchInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        // Prevent Radix dropdown from stealing focus/navigation
        e.stopPropagation();
        if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
            e.preventDefault();
        }
    };

    // Order agents with selected first (server-side search already handles filtering)
    const orderedAgents = useMemo(() => {
        const list = [...agents];
        const selected = selectedAgentId ? list.find(a => a.agent_id === selectedAgentId) : undefined;
        const rest = selected ? list.filter(a => a.agent_id !== selectedAgentId) : list;
        return selected ? [selected, ...rest] : rest;
    }, [agents, selectedAgentId]);

    // Check if we can load more
    const canLoadMore = useMemo(() => {
        if (!agentsResponse?.pagination) return false;
        return agentsResponse.pagination.current_page < agentsResponse.pagination.total_pages;
    }, [agentsResponse?.pagination]);

    const handleLoadMore = useCallback(() => {
        if (canLoadMore && !isFetching) {
            setCurrentPage(prev => prev + 1);
        }
    }, [canLoadMore, isFetching]);

    const handleAgentClick = useCallback((agentId: string | undefined) => {
        onAgentSelect?.(agentId);
        setIsOpen(false);
    }, [onAgentSelect]);

    const displayAgent = useMemo(() => {
        const found = agents.find(a => a.agent_id === selectedAgentId) || agents[0];
        return found;
    }, [agents, selectedAgentId]);

    const handleQuickAction = useCallback((action: 'instructions' | 'knowledge' | 'triggers' | 'tools') => {
        if (!selectedAgentId && !displayAgent?.agent_id) {
            return;
        }
        setAgentConfigDialog({ open: true, tab: action });
        setIsOpen(false);
    }, [selectedAgentId, displayAgent?.agent_id]);

    const renderAgentIcon = useCallback((agent: any) => {
        return <AgentAvatar agentId={agent?.agent_id} size={20} className="flex-shrink-0" fallbackName={agent?.name} />;
    }, []);

    return (
        <>
            <div className="flex items-center gap-2">
                <DropdownMenu open={isOpen} onOpenChange={setIsOpen}>
                    <DropdownMenuTrigger asChild>
                        <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 px-2 bg-transparent border-0 rounded-xl text-muted-foreground hover:text-foreground hover:bg-accent/50 flex items-center gap-1.5"
                            aria-label="Config menu"
                        >
                            {onAgentSelect ? (
                                <div className="flex items-center gap-2 min-w-0 max-w-[180px]">
                                    <span className="truncate text-sm font-medium">
                                        {displayAgent?.name || 'Iris'}
                                    </span>
                                    <ChevronDown size={12} className="opacity-60 flex-shrink-0" />
                                </div>
                            ) : (
                                <div className="flex items-center gap-1.5">
                                    <Cpu className="h-4 w-4" />
                                    <ChevronDown size={12} className="opacity-60" />
                                </div>
                            )}
                        </Button>
                    </DropdownMenuTrigger>

                    <DropdownMenuContent 
                        align="end" 
                        className="w-[520px] p-0 rounded-[32px] border border-black/10 dark:border-white/10 bg-[rgba(255,255,255,0.25)] dark:bg-[rgba(10,14,22,0.55)] backdrop-blur-2xl shadow-[0_20px_60px_-10px_rgba(0,0,0,0.05),inset_0_1px_0_0_rgba(0,0,0,0.06)] dark:shadow-[0_20px_60px_-10px_rgba(0,0,0,0.8),inset_0_1px_0_0_rgba(255,255,255,0.06)] transition-all duration-300 relative overflow-hidden max-h-[70vh] overflow-y-auto scrollbar-thin scrollbar-thumb-black/20 dark:scrollbar-thumb-white/10 scrollbar-track-transparent hover:scrollbar-thumb-black/30 dark:hover:scrollbar-thumb-white/20" 
                        sideOffset={6}
                    >
                        {/* Glassmorphism Effects */}
                        <div className="absolute inset-0 rounded-[32px] pointer-events-none">
                            {/* Dark mode gradient rim */}
                            <div className="absolute inset-0 rounded-[32px] dark:opacity-100 opacity-0" style={{
                                background: 'linear-gradient(180deg, rgba(173,216,255,0.18), rgba(255,255,255,0.04) 30%, rgba(150,160,255,0.14) 85%, rgba(255,255,255,0.06))',
                                WebkitMask: 'linear-gradient(#000,#000) content-box, linear-gradient(#000,#000)',
                                WebkitMaskComposite: 'xor',
                                maskComposite: 'exclude',
                                padding: '1px',
                                borderRadius: '32px'
                            }} />
                            
                            {/* Light mode gradient rim */}
                            <div className="absolute inset-0 rounded-[32px] light:opacity-100 dark:opacity-0" style={{
                                background: 'linear-gradient(180deg, rgba(0,0,0,0.06), rgba(0,0,0,0.02) 30%, rgba(0,0,0,0.05) 85%, rgba(0,0,0,0.03))',
                                WebkitMask: 'linear-gradient(#000,#000) content-box, linear-gradient(#000,#000)',
                                WebkitMaskComposite: 'xor',
                                maskComposite: 'exclude',
                                padding: '1px',
                                borderRadius: '32px'
                            }} />
                            
                            {/* Dark mode specular streak */}
                            <div className="absolute inset-x-0 top-0 h-24 rounded-t-[32px] dark:opacity-100 opacity-0" style={{
                                background: 'linear-gradient(180deg, rgba(255,255,255,0.22), rgba(255,255,255,0.06) 45%, rgba(255,255,255,0) 100%)',
                                filter: 'blur(6px)',
                                mixBlendMode: 'screen',
                            }} />
                            
                            {/* Light mode specular streak */}
                            <div className="absolute inset-x-0 top-0 h-24 rounded-t-[32px] light:opacity-100 dark:opacity-0" style={{
                                background: 'linear-gradient(180deg, rgba(0,0,0,0.08), rgba(0,0,0,0.03) 45%, rgba(0,0,0,0) 100%)',
                                filter: 'blur(6px)',
                                mixBlendMode: 'screen',
                            }} />
                            
                            {/* Fine noise */}
                            <div className="absolute inset-0 rounded-[32px] opacity-30 dark:opacity-30 light:opacity-20" style={{
                                backgroundImage: `url('data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="60" height="60"><filter id="n"><feTurbulence type="fractalNoise" baseFrequency="0.8" numOctaves="4"/><feColorMatrix type="saturate" values="0"/><feComponentTransfer><feFuncA type="table" tableValues="0 0.03"/></feComponentTransfer></filter><rect width="100%" height="100%" filter="url(%23n)" /></svg>')`,
                                backgroundSize: '100px 100px',
                                mixBlendMode: 'overlay',
                            }} />
                        </div>
                        
                        <div className="relative z-10">
                            {/* Search Bar */}
                            <div className="p-3 pb-2.5" ref={searchContainerRef}>
                                <div className="relative">
                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-black/60 dark:text-white/60" />
                                    <input
                                        ref={searchInputRef}
                                        type="text"
                                        placeholder="Search personalities..."
                                        value={searchQuery}
                                        onChange={(e) => setSearchQuery(e.target.value)}
                                        onKeyDown={handleSearchInputKeyDown}
                                        className="w-full h-9 pl-10 pr-3 rounded-xl text-sm bg-black/5 dark:bg-white/5 border border-black/10 dark:border-white/10 text-black/90 dark:text-white/90 placeholder:text-black/50 dark:placeholder:text-white/50 focus:outline-none focus:border-black/20 dark:focus:border-white/20 focus:bg-black/8 dark:focus:bg-white/8 backdrop-blur-sm transition-all duration-200"
                                    />
                                </div>
                            </div>

                            {/* Main Content - Horizontal Layout */}
                            <div className="px-3 pb-3 grid grid-cols-2 gap-3">
                                {/* Left Column: Personalities */}
                                {onAgentSelect && (
                                    <div className="min-w-0">
                                        <div className="flex items-center justify-between mb-2 h-5">
                                            <div className="flex items-center gap-2">
                                                <Sparkles className="h-3.5 w-3.5 text-black/70 dark:text-white/70" />
                                                <span className="text-[10px] font-semibold text-black/80 dark:text-white/80 uppercase tracking-wider">Personalities</span>
                                            </div>
                                            <Button
                                                size="sm"
                                                variant="ghost"
                                                className="h-6 w-6 p-0 text-black/60 dark:text-white/60 hover:text-black/80 dark:hover:text-white/80 hover:bg-black/5 dark:hover:bg-white/5 rounded-lg transition-all duration-200"
                                                onClick={() => { setIsOpen(false); setShowNewAgentDialog(true); }}
                                            >
                                                <Plus className="h-3.5 w-3.5" />
                                            </Button>
                                        </div>

                                        {isLoading && orderedAgents.length === 0 ? (
                                            <div className="px-2 py-3 text-xs text-black/60 dark:text-white/60 text-center">Loading personalities...</div>
                                        ) : orderedAgents.length === 0 ? (
                                            <div className="px-2 py-3 text-xs text-black/60 dark:text-white/60 text-center">
                                                {debouncedSearchQuery ? 'No personalities found' : 'No personalities'}
                                            </div>
                                        ) : (
                                            <div className="space-y-1 max-h-[280px] overflow-y-auto scrollbar-thin scrollbar-thumb-black/20 dark:scrollbar-thumb-white/20 scrollbar-track-transparent hover:scrollbar-thumb-black/30 dark:hover:scrollbar-thumb-white/30 pr-1">
                                                {orderedAgents.map((agent) => (
                                                    <button
                                                        key={agent.agent_id}
                                                        onClick={() => handleAgentClick(agent.agent_id)}
                                                        className={cn(
                                                            "w-full flex items-center justify-between px-2.5 py-2 rounded-lg transition-all duration-200 text-left",
                                                            "bg-black/5 dark:bg-white/5 border border-black/10 dark:border-white/10",
                                                            "hover:bg-black/8 dark:hover:bg-white/8 hover:border-black/15 dark:hover:border-white/15",
                                                            selectedAgentId === agent.agent_id && "bg-black/10 dark:bg-white/10 border-black/20 dark:border-white/20 ring-1 ring-black/10 dark:ring-white/10",
                                                            "min-h-[36px]"
                                                        )}
                                                    >
                                                        <div className="flex items-center gap-2.5 min-w-0 flex-1">
                                                            {renderAgentIcon(agent)}
                                                            <span className="truncate text-xs font-medium text-black/90 dark:text-white/90">{agent.name}</span>
                                                        </div>
                                                        {selectedAgentId === agent.agent_id && (
                                                            <Check className="h-3.5 w-3.5 text-blue-500 dark:text-blue-400 flex-shrink-0" />
                                                        )}
                                                    </button>
                                                ))}
                                            </div>
                                        )}
                                        
                                        {canLoadMore && (
                                            <Button
                                                size="sm"
                                                variant="ghost"
                                                className="w-full h-7 mt-1.5 text-[10px] text-black/60 dark:text-white/60 hover:text-black/80 dark:hover:text-white/80 hover:bg-black/5 dark:hover:bg-white/5 rounded-lg transition-all duration-200"
                                                onClick={handleLoadMore}
                                                disabled={isFetching}
                                            >
                                                {isFetching ? (
                                                    <>
                                                        <Loader2 className="h-3 w-3 animate-spin mr-1.5" />
                                                        Loading...
                                                    </>
                                                ) : (
                                                    'Load More'
                                                )}
                                            </Button>
                                        )}
                                    </div>
                                )}

                                {/* Right Column: Model & Configuration */}
                                <div className="min-w-0 space-y-2">
                                    {/* Models Section */}
                                    <div>
                                        <div className="flex items-center gap-2 mb-2 h-5">
                                            <Cpu className="h-3.5 w-3.5 text-black/70 dark:text-white/70" />
                                            <span className="text-[10px] font-semibold text-black/80 dark:text-white/80 uppercase tracking-wider">Model</span>
                                        </div>
                                        <div className="bg-black/5 dark:bg-white/5 border border-black/10 dark:border-white/10 rounded-lg p-0">
                                            <AgentModelSelector
                                                value={selectedModel}
                                                onChange={onModelChange}
                                                disabled={false}
                                                variant="menu-item"
                                            />
                                        </div>
                                    </div>

                                    {/* Configuration Section */}
                                    {onAgentSelect && (selectedAgentId || displayAgent?.agent_id) && (
                                        <div>
                                            <div className="flex items-center gap-2 mb-1.5">
                                                <Wrench className="h-3.5 w-3.5 text-black/70 dark:text-white/70" />
                                                <span className="text-[10px] font-semibold text-black/80 dark:text-white/80 uppercase tracking-wider">Configuration</span>
                                            </div>
                                            <div className="space-y-1.5">
                                                <button
                                                    onClick={() => handleQuickAction('instructions')}
                                                    className="w-full flex items-center gap-2 px-2.5 py-2 rounded-lg bg-black/5 dark:bg-white/5 border border-black/10 dark:border-white/10 hover:bg-black/8 dark:hover:bg-white/8 hover:border-black/15 dark:hover:border-white/15 transition-all duration-200 text-left group"
                                                >
                                                    <Brain className="h-3.5 w-3.5 text-black/70 dark:text-white/70 group-hover:text-black/90 dark:group-hover:text-white/90 transition-colors" />
                                                    <span className="text-xs font-medium text-black/90 dark:text-white/90">Instructions</span>
                                                </button>
                                                <button
                                                    onClick={() => handleQuickAction('tools')}
                                                    className="w-full flex items-center gap-2 px-2.5 py-2 rounded-lg bg-black/5 dark:bg-white/5 border border-black/10 dark:border-white/10 hover:bg-black/8 dark:hover:bg-white/8 hover:border-black/15 dark:hover:border-white/15 transition-all duration-200 text-left group"
                                                >
                                                    <Wrench className="h-3.5 w-3.5 text-black/70 dark:text-white/70 group-hover:text-black/90 dark:group-hover:text-white/90 transition-colors" />
                                                    <span className="text-xs font-medium text-black/90 dark:text-white/90">Tools</span>
                                                </button>
                                                <button
                                                    onClick={() => handleQuickAction('knowledge')}
                                                    className="w-full flex items-center gap-2 px-2.5 py-2 rounded-lg bg-black/5 dark:bg-white/5 border border-black/10 dark:border-white/10 hover:bg-black/8 dark:hover:bg-white/8 hover:border-black/15 dark:hover:border-white/15 transition-all duration-200 text-left group"
                                                >
                                                    <Database className="h-3.5 w-3.5 text-black/70 dark:text-white/70 group-hover:text-black/90 dark:group-hover:text-white/90 transition-colors" />
                                                    <span className="text-xs font-medium text-black/90 dark:text-white/90">Knowledge</span>
                                                </button>
                                                <button
                                                    onClick={() => handleQuickAction('triggers')}
                                                    className="w-full flex items-center gap-2 px-2.5 py-2 rounded-lg bg-black/5 dark:bg-white/5 border border-black/10 dark:border-white/10 hover:bg-black/8 dark:hover:bg-white/8 hover:border-black/15 dark:hover:border-white/15 transition-all duration-200 text-left group"
                                                >
                                                    <Zap className="h-3.5 w-3.5 text-black/70 dark:text-white/70 group-hover:text-black/90 dark:group-hover:text-white/90 transition-colors" />
                                                    <span className="text-xs font-medium text-black/90 dark:text-white/90">Triggers</span>
                                                </button>
                                            </div>
                                        </div>
                                    )}

                                    {/* Integrations */}
                                    {onAgentSelect && (selectedAgentId || displayAgent?.agent_id) && (
                                        <div className="mt-1.5">
                                            <TooltipProvider>
                                                <Tooltip>
                                                    <TooltipTrigger asChild>
                                                        <button
                                                            onClick={() => setIntegrationsOpen(true)}
                                                            className="w-full flex items-center justify-between px-2.5 py-2 rounded-lg bg-black/5 dark:bg-white/5 border border-black/10 dark:border-white/10 hover:bg-black/8 dark:hover:bg-white/8 hover:border-black/15 dark:hover:border-white/15 transition-all duration-200 group"
                                                        >
                                                            <div className="flex items-center gap-2">
                                                                <Plug2 className="h-3.5 w-3.5 text-black/70 dark:text-white/70 group-hover:text-black/90 dark:group-hover:text-white/90 transition-colors" />
                                                                <span className="text-xs font-medium text-black/90 dark:text-white/90">Integrations</span>
                                                            </div>
                                                            <div className="flex items-center gap-1.5">
                                                                {googleDriveIcon?.icon_url && slackIcon?.icon_url && notionIcon?.icon_url ? (
                                                                    <>
                                                                        {/* eslint-disable-next-line @next/next/no-img-element */}
                                                                        <img src={googleDriveIcon.icon_url} className="w-3.5 h-3.5 rounded" alt="Google Drive" />
                                                                        {/* eslint-disable-next-line @next/next/no-img-element */}
                                                                        <img src={slackIcon.icon_url} className="w-3 h-3 rounded" alt="Slack" />
                                                                        {/* eslint-disable-next-line @next/next/no-img-element */}
                                                                        <img src={notionIcon.icon_url} className="w-3 h-3 rounded" alt="Notion" />
                                                                    </>
                                                                ) : (
                                                                    <>
                                                                        <Skeleton className="w-3.5 h-3.5 rounded" />
                                                                        <Skeleton className="w-3 h-3 rounded" />
                                                                        <Skeleton className="w-3 h-3 rounded" />
                                                                    </>
                                                                )}
                                                                <ExternalLink className="h-3 w-3 text-black/50 dark:text-white/50" />
                                                            </div>
                                                        </button>
                                                    </TooltipTrigger>
                                                    <TooltipContent side="left" className="text-xs max-w-xs">
                                                        <p>Manage integrations</p>
                                                    </TooltipContent>
                                                </Tooltip>
                                            </TooltipProvider>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    </DropdownMenuContent>
                </DropdownMenu>
            </div>
            
            <Dialog open={integrationsOpen} onOpenChange={setIntegrationsOpen}>
                <DialogContent className="p-0 max-w-6xl h-[90vh] overflow-hidden">
                    <DialogHeader className="sr-only">
                        <DialogTitle>Integrations</DialogTitle>
                    </DialogHeader>
                    <IntegrationsRegistry
                        showAgentSelector={true}
                        selectedAgentId={selectedAgentId}
                        onAgentChange={onAgentSelect}
                        onClose={() => setIntegrationsOpen(false)}
                    />
                </DialogContent>
            </Dialog>
            
            <NewAgentDialog 
                open={showNewAgentDialog} 
                onOpenChange={setShowNewAgentDialog}
                onSuccess={(agentId) => {
                    setShowNewAgentDialog(false);
                    onAgentSelect?.(agentId);
                }}
            />
            
            {(selectedAgentId || displayAgent?.agent_id) && agentConfigDialog.open && (
                <AgentConfigurationDialog
                    open={agentConfigDialog.open}
                    onOpenChange={(open) => setAgentConfigDialog({ ...agentConfigDialog, open })}
                    agentId={selectedAgentId || displayAgent?.agent_id}
                    initialTab={agentConfigDialog.tab}
                    onAgentChange={onAgentSelect}
                />
            )}
        </>
    );
});

const GuestMenu: React.FC<UnifiedConfigMenuProps> = memo(function GuestMenu() {
    return (
        <TooltipProvider>
            <Tooltip>
                <TooltipTrigger asChild>
                    <span className="inline-flex">
                        <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 px-2 bg-transparent border-0 rounded-xl text-muted-foreground hover:text-foreground hover:bg-accent/50 flex items-center gap-1.5 cursor-not-allowed opacity-80 pointer-events-none"
                            disabled
                        >
                            <div className="flex items-center gap-2 min-w-0 max-w-[180px]">
                                <div className="flex-shrink-0">
                                    <IrisLogo size={20} />
                                </div>
                                <span className="truncate text-sm font-medium">Iris</span>
                                <ChevronDown size={12} className="opacity-60 flex-shrink-0" />
                            </div>
                        </Button>
                    </span>
                </TooltipTrigger>
                <TooltipContent side="top" className="text-xs">
                    <p>Log in to change agent</p>
                </TooltipContent>
            </Tooltip>
        </TooltipProvider>
    );
});

export const UnifiedConfigMenu: React.FC<UnifiedConfigMenuProps> = (props) => {
    if (props.isLoggedIn) {
        return <LoggedInMenu {...props} />;
    }
    return <GuestMenu {...props} />;
};

// Export the props type for use in other components
export type { UnifiedConfigMenuProps };

export default UnifiedConfigMenu;
