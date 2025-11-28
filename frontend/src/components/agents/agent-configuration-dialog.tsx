'use client';

import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useQueryClient } from '@tanstack/react-query';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import {
  Settings,
  Wrench,
  Server,
  BookOpen,
  Zap,
  Download,
  Loader2,
  Check,
  X,
  Edit3,
  Save,
  Brain,
  ChevronDown,
  Search,
  Info,
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { Alert, AlertDescription } from '@/components/ui/alert';

import { useAgentVersionData } from '@/hooks/use-agent-version-data';
import { useUpdateAgent, useAgents } from '@/hooks/react-query/agents/use-agents';
import { useUpdateAgentMCPs } from '@/hooks/react-query/agents/use-update-agent-mcps';
import { useExportAgent } from '@/hooks/react-query/agents/use-agent-export-import';
import { ExpandableMarkdownEditor } from '@/components/ui/expandable-markdown-editor';
import { AgentModelSelector } from './config/model-selector';
import { GranularToolConfiguration } from './tools/granular-tool-configuration';
import { AgentMCPConfiguration } from './agent-mcp-configuration';
import { AgentKnowledgeBaseManager } from './knowledge-base/agent-kb-tree';
import { AgentTriggersConfiguration } from './triggers/agent-triggers-configuration';
import { AgentAvatar } from '../thread/content/agent-avatar';
import { AgentIconEditorDialog } from './config/agent-icon-editor-dialog';
import { AgentVersionSwitcher } from './agent-version-switcher';
import { PersonalityIntroSection } from './personality-intro-section';

interface AgentConfigurationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  agentId: string;
  initialTab?: 'instructions' | 'tools' | 'integrations' | 'knowledge' | 'triggers';
  onAgentChange?: (agentId: string) => void;
}

export function AgentConfigurationDialog({
  open,
  onOpenChange,
  agentId,
  initialTab = 'instructions',
  onAgentChange,
}: AgentConfigurationDialogProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();

  const { agent, versionData, isViewingOldVersion, isLoading, error } = useAgentVersionData({ agentId });
  const { data: agentsResponse, refetch: refetchAgents } = useAgents({}, { 
    enabled: !!onAgentChange,
    refetchOnWindowFocus: true,
    refetchOnMount: 'always'
  });
  const agents = agentsResponse?.agents || [];

  const updateAgentMutation = useUpdateAgent();
  const updateAgentMCPsMutation = useUpdateAgentMCPs();
  const exportMutation = useExportAgent();

  const [activeTab, setActiveTab] = useState(initialTab);
  const [isEditingName, setIsEditingName] = useState(false);
  const [editName, setEditName] = useState('');
  const [isIconEditorOpen, setIsIconEditorOpen] = useState(false);
  const [showIntro, setShowIntro] = useState(false);
  
  // Debug state changes
  useEffect(() => {
    console.log('Icon editor open state changed:', isIconEditorOpen);
  }, [isIconEditorOpen]);
  const nameInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open && initialTab) {
      setActiveTab(initialTab);
    }
    // Show intro for new agents or if user hasn't configured anything
    if (open && agent) {
      const hasConfig = formData.system_prompt || 
                       Object.keys(formData.agentpress_tools || {}).length > 0 ||
                       (formData.configured_mcps || []).length > 0;
      setShowIntro(!hasConfig && initialTab === 'instructions');
    }
  }, [open, initialTab, agent]);

  const [formData, setFormData] = useState({
    name: '',
    system_prompt: '',
    model: undefined as string | undefined,
    agentpress_tools: {} as Record<string, any>,
    configured_mcps: [] as any[],
    custom_mcps: [] as any[],
    is_default: false,
    icon_name: null as string | null,
    icon_color: '#000000',
    icon_background: '#e5e5e5',
  });


  const [originalFormData, setOriginalFormData] = useState(formData);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (!agent) return;

    let configSource = agent;
    if (versionData) {
      configSource = {
        ...agent,
        ...versionData,
        icon_name: versionData.icon_name || agent.icon_name,
        icon_color: versionData.icon_color || agent.icon_color,
        icon_background: versionData.icon_background || agent.icon_background,
      };
    }

    const newFormData = {
      name: configSource.name || '',
      system_prompt: configSource.system_prompt || '',
      model: configSource.model || undefined,
      agentpress_tools: configSource.agentpress_tools || {},
      configured_mcps: configSource.configured_mcps || [],
      custom_mcps: configSource.custom_mcps || [],
      is_default: configSource.is_default || false,
      icon_name: configSource.icon_name || null,
      icon_color: configSource.icon_color || '#000000',
      icon_background: configSource.icon_background || '#e5e5e5',
    };

    setFormData(newFormData);
    setOriginalFormData(newFormData);
    setEditName(configSource.name || '');
  }, [agent, versionData]);

  const isIrisAgent = agent?.metadata?.is_iris_default || false;
  const restrictions = agent?.metadata?.restrictions || {};
  const isNameEditable = !isViewingOldVersion && (restrictions.name_editable !== false) && !isIrisAgent;
  const isSystemPromptEditable = !isViewingOldVersion && (restrictions.system_prompt_editable !== false) && !isIrisAgent;
  const areToolsEditable = !isViewingOldVersion && (restrictions.tools_editable !== false) && !isIrisAgent;

  const hasChanges = useMemo(() => {
    return JSON.stringify(formData) !== JSON.stringify(originalFormData);
  }, [formData, originalFormData]);

  const handleSaveAll = async () => {
    if (!hasChanges) return;

    setIsSaving(true);
    try {
      const updateData: any = {
        agentId,
        name: formData.name,
        system_prompt: formData.system_prompt,
        agentpress_tools: formData.agentpress_tools,
      };

      if (formData.model !== undefined && formData.model !== null) updateData.model = formData.model;
      if (formData.icon_name !== undefined) updateData.icon_name = formData.icon_name;
      if (formData.icon_color !== undefined) updateData.icon_color = formData.icon_color;
      if (formData.icon_background !== undefined) updateData.icon_background = formData.icon_background;
      if (formData.is_default !== undefined) updateData.is_default = formData.is_default;

      const updatedAgent = await updateAgentMutation.mutateAsync(updateData);

      const mcpsChanged =
        JSON.stringify(formData.configured_mcps) !== JSON.stringify(originalFormData.configured_mcps) ||
        JSON.stringify(formData.custom_mcps) !== JSON.stringify(originalFormData.custom_mcps);

      if (mcpsChanged) {
        await updateAgentMCPsMutation.mutateAsync({
          agentId,
          configured_mcps: formData.configured_mcps,
          custom_mcps: formData.custom_mcps,
          replace_mcps: true
        });
      }

      queryClient.invalidateQueries({ queryKey: ['versions', 'list', agentId] });
      queryClient.invalidateQueries({ queryKey: ['agents', 'detail', agentId] });

      if (updatedAgent.current_version_id) {
        const params = new URLSearchParams(searchParams.toString());
        params.delete('version');
        const newUrl = params.toString() ? `?${params.toString()}` : window.location.pathname;
        router.push(newUrl);
      }

      setOriginalFormData(formData);
      toast.success('Agent configuration saved successfully');
    } catch (error) {
      console.error('Failed to save changes:', error);
      toast.error('Failed to save changes');
    } finally {
      setIsSaving(false);
    }
  };

  const handleNameSave = () => {
    if (!editName.trim()) {
      setEditName(formData.name);
      setIsEditingName(false);
      return;
    }

    if (!isNameEditable) {
      if (isIrisAgent) {
        toast.error("Name cannot be edited", {
          description: "Iris's name is managed centrally and cannot be changed.",
        });
      }
      setEditName(formData.name);
      setIsEditingName(false);
      return;
    }

    setFormData(prev => ({ ...prev, name: editName }));
    setIsEditingName(false);
  };

  const handleSystemPromptChange = (value: string) => {
    if (!isSystemPromptEditable) {
      if (isIrisAgent) {
        toast.error("System prompt cannot be edited", {
          description: "Iris's system prompt is managed centrally.",
        });
      }
      return;
    }

    setFormData(prev => ({ ...prev, system_prompt: value }));
  };

  const handleModelChange = (model: string) => {
    setFormData(prev => ({ ...prev, model: model || undefined }));
  };

  const handleToolsChange = (tools: Record<string, boolean | { enabled: boolean; description: string }>) => {
    if (!areToolsEditable) {
      if (isIrisAgent) {
        toast.error("Tools cannot be edited", {
          description: "Iris's tools are managed centrally.",
        });
      }
      return;
    }

    setFormData(prev => ({ ...prev, agentpress_tools: tools }));
  };

  const handleMCPChange = async (updates: { configured_mcps: any[]; custom_mcps: any[] }) => {
    // Update local state immediately
    setFormData(prev => ({
      ...prev,
      configured_mcps: updates.configured_mcps || [],
      custom_mcps: updates.custom_mcps || []
    }));

    // Save MCP changes immediately to backend
    try {
      await updateAgentMCPsMutation.mutateAsync({
        agentId,
        configured_mcps: updates.configured_mcps || [],
        custom_mcps: updates.custom_mcps || [],
        replace_mcps: true
      });

      // Update original form data to reflect the save
      setOriginalFormData(prev => ({
        ...prev,
        configured_mcps: updates.configured_mcps || [],
        custom_mcps: updates.custom_mcps || []
      }));

      toast.success('Integration settings updated');
    } catch (error) {
      console.error('Failed to save MCP changes:', error);
      toast.error('Failed to save integration changes');
    }
  };


  const handleIconChange = async (iconName: string | null, iconColor: string, iconBackground: string) => {
    // First update the local state
    setFormData(prev => ({
      ...prev,
      icon_name: iconName,
      icon_color: iconColor,
      icon_background: iconBackground,
    }));

    // Then immediately save to backend
    try {
      const updateData: any = {
        agentId,
        icon_name: iconName,
        icon_color: iconColor,
        icon_background: iconBackground,
      };

      await updateAgentMutation.mutateAsync(updateData);
      
      // Update original form data to reflect the save
      setOriginalFormData(prev => ({
        ...prev,
        icon_name: iconName,
        icon_color: iconColor,
        icon_background: iconBackground,
      }));

      // Invalidate queries to refresh data
      queryClient.invalidateQueries({ queryKey: ['agents', 'detail', agentId] });
      queryClient.invalidateQueries({ queryKey: ['versions', 'list', agentId] });
      
      toast.success('Agent icon updated successfully!');
    } catch (error) {
      console.error('Failed to update agent icon:', error);
      toast.error('Failed to update agent icon. Please try again.');
      
      // Revert the local state on error
      setFormData(prev => ({
        ...prev,
        icon_name: originalFormData.icon_name,
        icon_color: originalFormData.icon_color,
        icon_background: originalFormData.icon_background,
      }));
    }
  };

  const handleExport = () => {
    exportMutation.mutate(agentId);
  };

  const handleClose = (open: boolean) => {
    if (!open && hasChanges) {
      setFormData(originalFormData);
      setEditName(originalFormData.name);
    }
    onOpenChange(open);
  };

  if (error) {
    return null;
  }

  const tabItems = [
    // { id: 'general', label: 'General', icon: Settings, disabled: false },
    { id: 'instructions', label: 'Instructions', icon: Brain, disabled: false },
    { id: 'tools', label: 'Tools', icon: Wrench, disabled: false },
    { id: 'integrations', label: 'Integrations', icon: Server, disabled: false },
    { id: 'knowledge', label: 'Knowledge', icon: BookOpen, disabled: false },
    { id: 'triggers', label: 'Triggers', icon: Zap, disabled: false },
  ];

  return (
    <>
      <Dialog open={open} onOpenChange={handleClose}>
        <DialogContent className="max-w-5xl h-[85vh] overflow-hidden p-0 gap-0 flex flex-col rounded-[32px] border border-white/10 dark:border-white/10 bg-[rgba(255,255,255,0.25)] dark:bg-[rgba(10,14,22,0.55)] backdrop-blur-2xl shadow-[0_20px_60px_-10px_rgba(0,0,0,0.05),inset_0_1px_0_0_rgba(0,0,0,0.06)] dark:shadow-[0_20px_60px_-10px_rgba(0,0,0,0.8),inset_0_1px_0_0_rgba(255,255,255,0.06)] relative">
          {/* Dark mode gradient rim */}
          <div className="absolute inset-0 rounded-[32px] dark:opacity-100 opacity-0 pointer-events-none z-0" style={{
            background: 'linear-gradient(180deg, rgba(173,216,255,0.18), rgba(255,255,255,0.04) 30%, rgba(150,160,255,0.14) 85%, rgba(255,255,255,0.06))',
            WebkitMask: 'linear-gradient(#000,#000) content-box, linear-gradient(#000,#000)',
            WebkitMaskComposite: 'xor',
            maskComposite: 'exclude',
            padding: '1px',
            borderRadius: '32px'
          }} />
          
          {/* Light mode gradient rim */}
          <div className="absolute inset-0 rounded-[32px] light:opacity-100 dark:opacity-0 pointer-events-none z-0" style={{
            background: 'linear-gradient(180deg, rgba(0,0,0,0.06), rgba(0,0,0,0.02) 30%, rgba(0,0,0,0.05) 85%, rgba(0,0,0,0.03))',
            WebkitMask: 'linear-gradient(#000,#000) content-box, linear-gradient(#000,#000)',
            WebkitMaskComposite: 'xor',
            maskComposite: 'exclude',
            padding: '1px',
            borderRadius: '32px'
          }} />
          
          {/* Dark mode specular streak */}
          <div className="absolute inset-x-0 top-0 h-24 rounded-t-[32px] dark:opacity-100 opacity-0 pointer-events-none z-0" style={{
            background: 'linear-gradient(180deg, rgba(255,255,255,0.22), rgba(255,255,255,0.06) 45%, rgba(255,255,255,0) 100%)',
            filter: 'blur(6px)',
            mixBlendMode: 'screen',
          }} />
          
          {/* Light mode specular streak */}
          <div className="absolute inset-x-0 top-0 h-24 rounded-t-[32px] light:opacity-100 dark:opacity-0 pointer-events-none z-0" style={{
            background: 'linear-gradient(180deg, rgba(0,0,0,0.08), rgba(0,0,0,0.03) 45%, rgba(0,0,0,0) 100%)',
            filter: 'blur(6px)',
            mixBlendMode: 'screen',
          }} />
          
          {/* Fine noise */}
          <div className="absolute inset-0 rounded-[32px] opacity-30 dark:opacity-30 light:opacity-20 pointer-events-none z-0" style={{
            backgroundImage: `url('data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="60" height="60"><filter id="n"><feTurbulence type="fractalNoise" baseFrequency="0.8" numOctaves="4"/><feColorMatrix type="saturate" values="0"/><feComponentTransfer><feFuncA type="table" tableValues="0 0.03"/></feComponentTransfer></filter><rect width="100%" height="100%" filter="url(%23n)" /></svg>')`,
            backgroundSize: '100px 100px',
            mixBlendMode: 'overlay',
          }} />
          <DialogHeader className="relative z-10 px-6 pt-6 pb-4 flex-shrink-0 border-b border-white/10 dark:border-white/10">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="flex-shrink-0">
                  {isIrisAgent ? (
                    <AgentAvatar
                      isIrisDefault={true}
                      agentName={formData.name}
                      size={48}
                      className="ring-2 ring-primary/20"
                    />
                  ) : (
                    <button
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        setIsIconEditorOpen(true);
                      }}
                      className="cursor-pointer transition-all hover:scale-105 hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 rounded-xl"
                      type="button"
                      title="Click to customize personality icon"
                    >
                      <AgentAvatar
                        iconName={formData.icon_name}
                        iconColor={formData.icon_color}
                        backgroundColor={formData.icon_background}
                        agentName={formData.name}
                        size={48}
                        className="ring-2 ring-primary/20 hover:ring-primary/40 transition-all"
                      />
                    </button>
                  )}
                </div>

                <div className="flex flex-col gap-1">
                  <div className="flex items-center gap-2">
                    {isEditingName ? (
                      <div className="flex items-center gap-2">
                        <Input
                          ref={nameInputRef}
                          value={editName}
                          onChange={(e) => setEditName(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              handleNameSave();
                            } else if (e.key === 'Escape') {
                              setEditName(formData.name);
                              setIsEditingName(false);
                            }
                          }}
                          className="h-9 w-64 bg-white/10 dark:bg-white/5 border-white/10"
                          maxLength={50}
                        />
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-9 w-9"
                          onClick={handleNameSave}
                        >
                          <Check className="h-4 w-4" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-9 w-9"
                          onClick={() => {
                            setEditName(formData.name);
                            setIsEditingName(false);
                          }}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    ) : onAgentChange ? (
                      <div className="flex items-center gap-2 min-w-0 flex-1">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <button className="flex items-center gap-2 hover:bg-white/5 dark:hover:bg-white/5 rounded-lg px-3 py-1.5 transition-colors group">
                              <DialogTitle className="text-2xl font-bold truncate">
                                {isLoading ? 'Loading...' : formData.name || 'Personality'}
                              </DialogTitle>
                              <ChevronDown className="h-4 w-4 opacity-60 group-hover:opacity-100 transition-opacity flex-shrink-0" />
                            </button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent 
                            className="w-80 p-0 rounded-xl border-white/10 dark:border-white/10 bg-[rgba(255,255,255,0.25)] dark:bg-[rgba(10,14,22,0.55)] backdrop-blur-2xl" 
                            align="start"
                            sideOffset={4}
                          >
                            <div className="p-3 border-b border-white/10">
                              <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                                <Search className="h-4 w-4" />
                                Switch Personality
                              </div>
                            </div>
                            <div className="max-h-60 overflow-y-auto">
                              {agents.map((agent: any) => (
                                <DropdownMenuItem
                                  key={agent.agent_id}
                                  onClick={() => onAgentChange(agent.agent_id)}
                                  className="p-3 flex items-center gap-3 cursor-pointer"
                                >
                                  <AgentAvatar
                                    iconName={agent.icon_name}
                                    iconColor={agent.icon_color}
                                    backgroundColor={agent.icon_background}
                                    agentName={agent.name}
                                    isIrisDefault={agent.metadata?.is_iris_default}
                                    size={24}
                                    className="flex-shrink-0"
                                  />
                                  <div className="flex-1 min-w-0">
                                    <div className="font-medium truncate">{agent.name}</div>
                                    {agent.description && (
                                      <div className="text-xs text-muted-foreground truncate">
                                        {agent.description}
                                      </div>
                                    )}
                                  </div>
                                  {agent.agent_id === agentId && (
                                    <Check className="h-4 w-4 text-primary flex-shrink-0" />
                                  )}
                                </DropdownMenuItem>
                              ))}
                            </div>
                          </DropdownMenuContent>
                        </DropdownMenu>
                        {isNameEditable && (
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-8 w-8 flex-shrink-0"
                            onClick={() => {
                              setIsEditingName(true);
                              setTimeout(() => {
                                nameInputRef.current?.focus();
                                nameInputRef.current?.select();
                              }, 0);
                            }}
                          >
                            <Edit3 className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    ) : (
                      <div className="flex items-center gap-2">
                        <DialogTitle className="text-2xl font-bold">
                          {isLoading ? 'Loading...' : formData.name || 'Personality'}
                        </DialogTitle>
                        {isNameEditable && (
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-8 w-8"
                            onClick={() => {
                              setIsEditingName(true);
                              setTimeout(() => {
                                nameInputRef.current?.focus();
                                nameInputRef.current?.select();
                              }, 0);
                            }}
                          >
                            <Edit3 className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Customize how this personality behaves and what it can do
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <AgentVersionSwitcher
                  agentId={agentId}
                  currentVersionId={agent?.current_version_id || null}
                  currentFormData={{
                    system_prompt: formData.system_prompt,
                    configured_mcps: formData.configured_mcps,
                    custom_mcps: formData.custom_mcps,
                    agentpress_tools: formData.agentpress_tools,
                  }}
                />
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={handleExport}
                  disabled={exportMutation.isPending}
                >
                  {exportMutation.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Download className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </div>
          </DialogHeader>
          {isLoading ? (
            <div className="relative z-10 flex-1 flex items-center justify-center">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <Tabs value={activeTab} onValueChange={(value) => {
              setActiveTab(value as typeof activeTab);
              setShowIntro(false);
            }} className="relative z-10 flex-1 flex flex-col min-h-0">
              <div className='flex items-center justify-center w-full px-6 pt-4'>
                <TabsList className="w-full max-w-4xl flex-shrink-0 bg-white/5 dark:bg-white/5 backdrop-blur-sm border border-white/10 dark:border-white/10 rounded-xl p-1">
                  {tabItems.map((tab) => {
                    const Icon = tab.icon;
                    return (
                      <TabsTrigger
                        key={tab.id}
                        value={tab.id}
                        disabled={tab.disabled}
                        className={cn(
                          "flex-1 data-[state=active]:bg-white/10 dark:data-[state=active]:bg-white/10 data-[state=active]:text-foreground",
                          tab.disabled && "opacity-50 cursor-not-allowed"
                        )}
                      >
                        <Icon className="h-4 w-4 mr-2" />
                        {tab.label}
                      </TabsTrigger>
                    );
                  })}
                </TabsList>
              </div>
              <div className="flex-1 overflow-auto px-6">
                {showIntro && activeTab === 'instructions' ? (
                  <div className="py-6">
                    <PersonalityIntroSection 
                      onGetStarted={() => setShowIntro(false)}
                    />
                  </div>
                ) : (
                  <>
                    <TabsContent value="instructions" className="py-6 mt-0 flex flex-col h-full">
                  <div className="flex flex-col flex-1 min-h-0 space-y-4">
                    {isIrisAgent && (
                      <Alert className="bg-blue-50/50 border-blue-200 dark:bg-blue-950/20 dark:border-blue-900 rounded-xl">
                        <Info className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                        <AlertDescription className="text-sm text-blue-800 dark:text-blue-300">
                          You can't edit the main iris Super Worker, but you can create a new personality that you can modify as you wish.
                        </AlertDescription>
                      </Alert>
                    )}
                    <div className="space-y-2">
                      <Label className="text-lg font-semibold block">Instructions</Label>
                      <p className="text-sm text-muted-foreground">
                        Define how this personality thinks, responds, and behaves. Be specific about its role, tone, and approach.
                      </p>
                    </div>
                    <ExpandableMarkdownEditor
                      value={formData.system_prompt}
                      onSave={handleSystemPromptChange}
                      disabled={!isSystemPromptEditable}
                      placeholder="Example: You are a helpful coding assistant. You explain code clearly, provide examples, and help debug issues. Always format code properly and explain your reasoning..."
                      className="flex-1 min-h-[400px]"
                    />
                  </div>
                </TabsContent>

                <TabsContent value="tools" className="py-6 mt-0 flex flex-col h-full">
                  <div className="flex flex-col flex-1 min-h-0 space-y-4">
                    {isIrisAgent && (
                      <Alert className="bg-blue-50/50 border-blue-200 dark:bg-blue-950/20 dark:border-blue-900 rounded-xl">
                        <Info className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                        <AlertDescription className="text-sm text-blue-800 dark:text-blue-300">
                          You can't edit the main iris Super Worker, but you can create a new personality that you can modify as you wish.
                        </AlertDescription>
                      </Alert>
                    )}
                    <div className="space-y-2">
                      <Label className="text-lg font-semibold block">Tools & Capabilities</Label>
                      <p className="text-sm text-muted-foreground">
                        Enable specific capabilities for this personality. Tools allow it to perform actions like web search, code execution, file operations, and more.
                      </p>
                    </div>
                    <GranularToolConfiguration
                      tools={formData.agentpress_tools}
                      onToolsChange={handleToolsChange}
                      disabled={!areToolsEditable}
                      isIrisAgent={isIrisAgent}
                      isLoading={isLoading}
                    />
                  </div>
                </TabsContent>
                <TabsContent value="integrations" className="py-6 mt-0 flex flex-col h-full">
                  <div className="flex flex-col flex-1 min-h-0 space-y-4">
                    <div className="space-y-2">
                      <Label className="text-lg font-semibold block">Integrations</Label>
                      <p className="text-sm text-muted-foreground">
                        Connect external services and APIs to extend this personality's capabilities. Integrations allow it to interact with third-party tools and services.
                      </p>
                    </div>
                    <AgentMCPConfiguration
                      configuredMCPs={formData.configured_mcps}
                      customMCPs={formData.custom_mcps}
                      onMCPChange={handleMCPChange}
                      agentId={agentId}
                      versionData={{
                        configured_mcps: formData.configured_mcps,
                        custom_mcps: formData.custom_mcps,
                        system_prompt: formData.system_prompt,
                        agentpress_tools: formData.agentpress_tools
                      }}
                      saveMode="callback"
                      isLoading={updateAgentMCPsMutation.isPending}
                    />
                  </div>
                </TabsContent>

                <TabsContent value="knowledge" className="py-6 mt-0 flex flex-col h-full">
                  <div className="flex flex-col flex-1 min-h-0 space-y-4">
                    <div className="space-y-2">
                      <Label className="text-lg font-semibold block">Knowledge Base</Label>
                      <p className="text-sm text-muted-foreground">
                        Upload documents and files to give this personality specialized knowledge. It can reference this information when answering questions.
                      </p>
                    </div>
                    <AgentKnowledgeBaseManager agentId={agentId} agentName={formData.name || 'Personality'} />
                  </div>
                </TabsContent>

                <TabsContent value="triggers" className="py-6 mt-0 flex flex-col h-full">
                  <div className="flex flex-col flex-1 min-h-0 space-y-4">
                    <div className="space-y-2">
                      <Label className="text-lg font-semibold block">Triggers</Label>
                      <p className="text-sm text-muted-foreground">
                        Set up automated triggers that activate this personality based on specific conditions or events.
                      </p>
                    </div>
                    <AgentTriggersConfiguration agentId={agentId} />
                  </div>
                </TabsContent>
                  </>
                )}
              </div>
            </Tabs>
          )}

          <DialogFooter className="relative z-10 px-6 py-4 border-t border-white/10 dark:border-white/10 bg-white/10 dark:bg-white/5 backdrop-blur-sm flex-shrink-0">
            <Button
              variant="outline"
              onClick={() => handleClose(false)}
              disabled={isSaving}
            >
              Cancel
            </Button>
            <Button
              onClick={handleSaveAll}
              disabled={!hasChanges || isSaving}
            >
              {isSaving ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="h-4 w-4" />
                  Save Changes
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AgentIconEditorDialog
        isOpen={isIconEditorOpen}
        onClose={() => {
          console.log('Icon editor dialog closing');
          setIsIconEditorOpen(false);
        }}
        currentIconName={formData.icon_name}
        currentIconColor={formData.icon_color}
        currentBackgroundColor={formData.icon_background}
        agentName={formData.name}
        agentDescription={agent?.description}
        onIconUpdate={handleIconChange}
      />
    </>
  );
}
