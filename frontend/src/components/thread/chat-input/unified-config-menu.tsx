'use client';

import React, { useEffect, useMemo, useRef, useState, useCallback, memo } from 'react';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
    DropdownMenuSeparator,
    DropdownMenuSub,
    DropdownMenuSubContent,
    DropdownMenuSubTrigger,
    DropdownMenuPortal,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { Cpu, Search, Check, ChevronDown, Plus, ExternalLink, Loader2 } from 'lucide-react';
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

type AgentModelType = 'iris' | 'claude';

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
    const [agentModelType, setAgentModelType] = useState<AgentModelType>('iris');

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
        return <AgentAvatar agentId={agent?.agent_id} size={24} className="flex-shrink-0" fallbackName={agent?.name} />;
    }, []);

    // Find Claude Sonnet 4.5 model from available models
    const findClaudeSonnet45Model = useCallback(() => {
        // First try to find exact Claude Sonnet 4.5 matches
        const exactMatch = modelOptions.find(model => {
            const id = model.id.toLowerCase();
            const label = model.label.toLowerCase();
            return (
                (id.includes('claude') && id.includes('sonnet') && (id.includes('4.5') || id.includes('4-5'))) ||
                (label.includes('claude') && label.includes('sonnet') && (label.includes('4.5') || label.includes('4-5'))) ||
                id.includes('anthropic/claude-sonnet-4.5') ||
                id.includes('anthropic/claude-4.5-sonnet') ||
                id.includes('anthropic/claude-sonnet-4-5')
            );
        });
        
        if (exactMatch) return exactMatch;
        
        // Fallback: try to find any Claude Sonnet model
        return modelOptions.find(model => {
            const id = model.id.toLowerCase();
            const label = model.label.toLowerCase();
            return (
                (id.includes('claude') && id.includes('sonnet')) ||
                (label.includes('claude') && label.includes('sonnet'))
            );
        });
    }, [modelOptions]);

    // Handle agent model type change (Iris Pro vs Claude)
    const handleAgentModelTypeChange = useCallback((type: AgentModelType) => {
        setAgentModelType(type);
        
        if (type === 'claude') {
            // Switch to Claude Sonnet 4.5
            const claudeModel = findClaudeSonnet45Model();
            if (claudeModel && canAccessModel(claudeModel.id)) {
                onModelChange(claudeModel.id);
            } else {
                // Fallback: try to find any Claude model
                const anyClaude = modelOptions.find(m => 
                    m.id.toLowerCase().includes('claude') || m.label.toLowerCase().includes('claude')
                );
                if (anyClaude && canAccessModel(anyClaude.id)) {
                    onModelChange(anyClaude.id);
                }
            }
        } else {
            // Switch back to default/Iris Pro model (use the recommended model or first available)
            const defaultModel = modelOptions.find(m => m.recommended) || modelOptions[0];
            if (defaultModel && canAccessModel(defaultModel.id)) {
                onModelChange(defaultModel.id);
            }
        }
    }, [findClaudeSonnet45Model, modelOptions, canAccessModel, onModelChange]);

    // Determine current agent model type based on selected model
    useEffect(() => {
        const isClaude = selectedModel.toLowerCase().includes('claude');
        setAgentModelType(isClaude ? 'claude' : 'iris');
    }, [selectedModel]);

    return (
        <>
            <div className="flex items-center gap-1">
                {/* Agent Model Type Toggle: Iris Pro / Claude */}
                {onAgentSelect && (
                    <div className="flex items-center gap-0.5 p-0.5 bg-white/5 rounded-xl border border-white/10 backdrop-blur-sm light:bg-black/5 light:border-black/10">
                        <button
                            onClick={() => handleAgentModelTypeChange('iris')}
                            className={cn(
                                "px-2 py-1 rounded-lg text-xs font-medium transition-all duration-200",
                                agentModelType === 'iris'
                                    ? "bg-white/10 text-white light:bg-black/10 light:text-black"
                                    : "text-white/60 hover:text-white/80 hover:bg-white/5 light:text-black/60 light:hover:text-black/80 light:hover:bg-black/5"
                            )}
                        >
                            Iris Pro
                        </button>
                        <button
                            onClick={() => handleAgentModelTypeChange('claude')}
                            className={cn(
                                "px-2 py-1 rounded-lg text-xs font-medium transition-all duration-200",
                                agentModelType === 'claude'
                                    ? "bg-white/10 text-white light:bg-black/10 light:text-black"
                                    : "text-white/60 hover:text-white/80 hover:bg-white/5 light:text-black/60 light:hover:text-black/80 light:hover:bg-black/5"
                            )}
                        >
                            Claude
                        </button>
                    </div>
                )}
                
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
                                    {/* {renderAgentIcon(displayAgent)} */}
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

                <DropdownMenuContent align="end" className="w-80 p-0 rounded-2xl border border-black/20 bg-gradient-to-br from-white/20 via-white/10 to-white/20 backdrop-blur-2xl shadow-[0_25px_50px_-12px_rgba(0,0,0,0.15),inset_0_1px_0_rgba(255,255,255,0.2),inset_0_0_0_1px_rgba(0,0,0,0.1)] dark:border-white/10 dark:bg-gradient-to-br dark:from-white/5 dark:via-white/2 dark:to-white/5 dark:shadow-[0_25px_50px_-12px_rgba(0,0,0,0.8),inset_0_1px_0_rgba(255,255,255,0.1),inset_0_0_0_1px_rgba(255,255,255,0.1)] transition-all duration-300 relative overflow-hidden" sideOffset={6}>
                    {/* Advanced Glassmorphism Effects */}
                    <div className="absolute inset-0 rounded-2xl pointer-events-none">
                        {/* Light mode gradient overlay */}
                        <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-white/30 via-white/15 to-white/25 dark:from-white/10 dark:via-transparent dark:to-white/5" />
                        
                        {/* Light mode specular highlight */}
                        <div className="absolute inset-x-0 top-0 h-16 rounded-t-2xl bg-gradient-to-b from-white/40 via-white/20 to-transparent dark:from-white/20 dark:via-white/5 dark:to-transparent" />
                        
                        {/* Fine noise texture - different for light/dark */}
                        <div 
                            className="absolute inset-0 rounded-2xl opacity-30 dark:opacity-20"
                            style={{
                                backgroundImage: `url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='100' height='100'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4'/><feColorMatrix type='saturate' values='0'/><feComponentTransfer><feFuncA type='table' tableValues='0 0.03'/></feComponentTransfer></filter><rect width='100%' height='100%' filter='url(%23n)' /></svg>")`,
                                backgroundSize: '50px 50px',
                                mixBlendMode: 'overlay'
                            }}
                        />
                        
                        {/* Light mode rim lighting */}
                        <div className="absolute inset-0 rounded-2xl" style={{
                            background: 'linear-gradient(180deg, rgba(255,255,255,0.25), rgba(255,255,255,0.1) 30%, rgba(255,255,255,0.2) 85%, rgba(255,255,255,0.15))',
                            WebkitMask: 'linear-gradient(#000,#000) content-box, linear-gradient(#000,#000)',
                            WebkitMaskComposite: 'xor',
                            maskComposite: 'exclude',
                            padding: '1px',
                            borderRadius: '16px'
                        }} />
                        
                        {/* Dark mode rim lighting */}
                        <div className="absolute inset-0 rounded-2xl dark:block hidden" style={{
                            background: 'linear-gradient(180deg, rgba(255,255,255,0.15), rgba(255,255,255,0.05) 30%, rgba(255,255,255,0.1) 85%, rgba(255,255,255,0.08))',
                            WebkitMask: 'linear-gradient(#000,#000) content-box, linear-gradient(#000,#000)',
                            WebkitMaskComposite: 'xor',
                            maskComposite: 'exclude',
                            padding: '1px',
                            borderRadius: '16px'
                        }} />
                    </div>
                    
                    <div className="p-3 relative z-10" ref={searchContainerRef}>
                        <div className="relative">
                            <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-black/60 dark:text-white/60" />
                            <input
                                ref={searchInputRef}
                                type="text"
                                placeholder="Search..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                onKeyDown={handleSearchInputKeyDown}
                                className="w-full h-10 pl-9 pr-3 rounded-xl text-sm bg-gradient-to-r from-white/25 via-white/15 to-white/25 dark:from-white/5 dark:via-white/2 dark:to-white/5 border border-black/20 dark:border-white/10 text-black/90 dark:text-white/90 placeholder:text-black/50 dark:placeholder:text-white/50 focus:outline-none focus:border-black/30 dark:focus:border-white/20 focus:bg-gradient-to-r focus:from-white/30 focus:via-white/20 focus:to-white/30 dark:focus:from-white/8 dark:focus:via-white/4 dark:focus:to-white/8 backdrop-blur-sm transition-all duration-200 relative overflow-hidden"
                            />
                        </div>
                    </div>

                    {/* Agents */}
                    {onAgentSelect && (
                        <div className="px-3">
                            <div className="px-3 py-2 text-[11px] font-medium text-black/60 dark:text-white/60 flex items-center justify-between">
                                <span>Personalities</span>
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
                                <div className="px-3 py-2 text-xs text-black/60 dark:text-white/60">Loading agents...</div>
                            ) : orderedAgents.length === 0 ? (
                                <div className="px-3 py-2 text-xs text-black/60 dark:text-white/60">
                                    {debouncedSearchQuery ? 'No agents found' : 'No agents'}
                                </div>
                            ) : (
                                <>
                                    <div className="max-h-[200px] overflow-y-auto">
                                        {orderedAgents.map((agent) => (
                                            <DropdownMenuItem
                                                key={agent.agent_id}
                                                className="text-sm px-3 py-2 mx-0 my-0.5 flex items-center justify-between cursor-pointer rounded-xl bg-gradient-to-r from-white/20 via-white/10 to-white/20 dark:from-white/5 dark:via-white/2 dark:to-white/5 border border-black/20 dark:border-white/10 hover:bg-gradient-to-r hover:from-white/25 hover:via-white/15 hover:to-white/25 dark:hover:from-white/8 dark:hover:via-white/4 dark:hover:to-white/8 hover:border-black/30 dark:hover:border-white/20 backdrop-blur-sm transition-all duration-200 relative overflow-hidden"
                                                onClick={() => handleAgentClick(agent.agent_id)}
                                            >
                                                <div className="flex items-center gap-3 min-w-0 flex-1">
                                                    {renderAgentIcon(agent)}
                                                    <span className="truncate font-medium text-black/90 dark:text-white/90">{agent.name}</span>
                                                </div>
                                                {selectedAgentId === agent.agent_id && (
                                                    <Check className="h-4 w-4 text-blue-500 flex-shrink-0" />
                                                )}
                                            </DropdownMenuItem>
                                        ))}
                                    </div>
                                    {canLoadMore && (
                                        <div className="px-3 pb-2">
                                            <Button
                                                size="sm"
                                                variant="ghost"
                                                className="w-full h-8 text-xs text-black/60 dark:text-white/60 hover:text-black/80 dark:hover:text-white/80 hover:bg-black/5 dark:hover:bg-white/5 rounded-lg transition-all duration-200"
                                                onClick={handleLoadMore}
                                                disabled={isFetching}
                                            >
                                                {isFetching ? (
                                                    <>
                                                        <Loader2 className="h-3 w-3 animate-spin mr-1" />
                                                        Loading...
                                                    </>
                                                ) : (
                                                    'Load More'
                                                )}
                                            </Button>
                                        </div>
                                    )}
                                </>
                            )}

                            {/* Agents "see all" removed; scroll container shows all */}
                        </div>
                    )}

                    {onAgentSelect && <DropdownMenuSeparator className="!mt-0" />}

                    {/* Models */}
                    <div className="px-3">
                        <div className="px-3 py-2 text-[11px] font-medium text-black/60 dark:text-white/60">Models</div>
                        <div className="px-3 pb-2">
                            <AgentModelSelector
                                value={selectedModel}
                                onChange={onModelChange}
                                disabled={false}
                                variant="menu-item"
                            />
                        </div>
                    </div>
                    
                    {/* Special Capabilities */}
                    <div className="px-3">
                    </div>
                    
                    <DropdownMenuSeparator className="mx-3" />
                    {onAgentSelect && (selectedAgentId || displayAgent?.agent_id) && (
                        <div className="px-3">
                            <DropdownMenuItem
                                className="text-sm px-3 py-2 mx-0 my-0.5 flex items-center gap-2 cursor-pointer rounded-xl bg-gradient-to-r from-white/20 via-white/10 to-white/20 dark:from-white/5 dark:via-white/2 dark:to-white/5 border border-black/20 dark:border-white/10 hover:bg-gradient-to-r hover:from-white/25 hover:via-white/15 hover:to-white/25 dark:hover:from-white/8 dark:hover:via-white/4 dark:hover:to-white/8 hover:border-black/30 dark:hover:border-white/20 backdrop-blur-sm transition-all duration-200 relative overflow-hidden"
                                onClick={() => handleQuickAction('instructions')}
                            >
                                <span className="font-medium text-black/90 dark:text-white/90">Instructions</span>
                            </DropdownMenuItem>
                            <DropdownMenuItem
                                className="text-sm px-3 py-2 mx-0 my-0.5 flex items-center gap-2 cursor-pointer rounded-xl bg-gradient-to-r from-white/20 via-white/10 to-white/20 dark:from-white/5 dark:via-white/2 dark:to-white/5 border border-black/20 dark:border-white/10 hover:bg-gradient-to-r hover:from-white/25 hover:via-white/15 hover:to-white/25 dark:hover:from-white/8 dark:hover:via-white/4 dark:hover:to-white/8 hover:border-black/30 dark:hover:border-white/20 backdrop-blur-sm transition-all duration-200 relative overflow-hidden"
                                onClick={() => handleQuickAction('tools')}
                            >
                                <span className="font-medium text-black/90 dark:text-white/90">Tools</span>
                            </DropdownMenuItem>
                            <DropdownMenuItem
                                className="text-sm px-3 py-2 mx-0 my-0.5 flex items-center gap-2 cursor-pointer rounded-xl bg-gradient-to-r from-white/20 via-white/10 to-white/20 dark:from-white/5 dark:via-white/2 dark:to-white/5 border border-black/20 dark:border-white/10 hover:bg-gradient-to-r hover:from-white/25 hover:via-white/15 hover:to-white/25 dark:hover:from-white/8 dark:hover:via-white/4 dark:hover:to-white/8 hover:border-black/30 dark:hover:border-white/20 backdrop-blur-sm transition-all duration-200 relative overflow-hidden"
                                onClick={() => handleQuickAction('knowledge')}
                            >
                                <span className="font-medium text-black/90 dark:text-white/90">Knowledge</span>
                            </DropdownMenuItem>
                            <DropdownMenuItem
                                className="text-sm px-3 py-2 mx-0 my-0.5 flex items-center gap-2 cursor-pointer rounded-xl bg-gradient-to-r from-white/20 via-white/10 to-white/20 dark:from-white/5 dark:via-white/2 dark:to-white/5 border border-black/20 dark:border-white/10 hover:bg-gradient-to-r hover:from-white/25 hover:via-white/15 hover:to-white/25 dark:hover:from-white/8 dark:hover:via-white/4 dark:hover:to-white/8 hover:border-black/30 dark:hover:border-white/20 backdrop-blur-sm transition-all duration-200 relative overflow-hidden"
                                onClick={() => handleQuickAction('triggers')}
                            >
                                <span className="font-medium text-black/90 dark:text-white/90">Triggers</span>
                            </DropdownMenuItem>
                            <TooltipProvider>
                                <Tooltip>
                                    <TooltipTrigger asChild>
                                        <DropdownMenuItem
                                            className="text-sm px-3 py-2 mx-0 my-0.5 flex items-center justify-between cursor-pointer rounded-xl bg-gradient-to-r from-white/20 via-white/10 to-white/20 dark:from-white/5 dark:via-white/2 dark:to-white/5 border border-black/20 dark:border-white/10 hover:bg-gradient-to-r hover:from-white/25 hover:via-white/15 hover:to-white/25 dark:hover:from-white/8 dark:hover:via-white/4 dark:hover:to-white/8 hover:border-black/30 dark:hover:border-white/20 backdrop-blur-sm transition-all duration-200 relative overflow-hidden"
                                            onClick={() => setIntegrationsOpen(true)}
                                        >
                                            <span className="font-medium text-black/90 dark:text-white/90">Integrations</span>
                                            <div className="flex items-center gap-1.5">
                                                {googleDriveIcon?.icon_url && slackIcon?.icon_url && notionIcon?.icon_url ? (
                                                    <>
                                                        {/* eslint-disable-next-line @next/next/no-img-element */}
                                                        <img src={googleDriveIcon.icon_url} className="w-4 h-4" alt="Google Drive" />
                                                        {/* eslint-disable-next-line @next/next/no-img-element */}
                                                        <img src={slackIcon.icon_url} className="w-3.5 h-3.5" alt="Slack" />
                                                        {/* eslint-disable-next-line @next/next/no-img-element */}
                                                        <img src={notionIcon.icon_url} className="w-3.5 h-3.5" alt="Notion" />
                                                    </>
                                                ) : (
                                                    <>
                                                        <Skeleton className="w-4 h-4 rounded" />
                                                        <Skeleton className="w-3.5 h-3.5 rounded" />
                                                        <Skeleton className="w-3.5 h-3.5 rounded" />
                                                    </>
                                                )}
                                                <ExternalLink className="h-3.5 w-3.5 text-muted-foreground" />
                                            </div>
                                        </DropdownMenuItem>
                                    </TooltipTrigger>
                                    <TooltipContent side="left" className="text-xs max-w-xs">
                                        <p>Open integrations</p>
                                    </TooltipContent>
                                </Tooltip>
                            </TooltipProvider>
                        </div>
                    )}
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


