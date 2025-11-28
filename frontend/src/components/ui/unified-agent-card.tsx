'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { Check, Plus, Download, CheckCircle, Loader2, Globe, GlobeLock, GitBranch, Trash2, MoreVertical, User, ArrowRight } from 'lucide-react';
import { DynamicIcon } from 'lucide-react/dynamic';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { cn } from '@/lib/utils';
import { AgentAvatar } from '@/components/thread/content/agent-avatar';

// Unified agent card variants
export type AgentCardVariant = 
  | 'onboarding'      // Selection card for onboarding
  | 'marketplace'     // Marketplace template card
  | 'template'        // User template card
  | 'agent'          // User agent card
  | 'showcase'       // Home page showcase
  | 'dashboard'      // Dashboard quick access
  | 'compact';       // Compact version

// Base agent data interface
export interface BaseAgentData {
  id: string;
  name: string;
  description?: string;
  tags?: string[];
  created_at?: string;
  icon?: string;
  role?: string;
  capabilities?: string[];
  
  // Icon/avatar data
  icon_name?: string;
  icon_color?: string;
  icon_background?: string;
  
  // Marketplace specific
  creator_id?: string;
  creator_name?: string;
  is_iris_team?: boolean;
  download_count?: number;
  marketplace_published_at?: string;
  
  // Template specific
  template_id?: string;
  is_public?: boolean;
  
  // Agent specific
  agent_id?: string;
  is_default?: boolean;
  current_version?: {
    version_id: string;
    version_name: string;
    version_number: number;
  };
  metadata?: {
    is_iris_default?: boolean;
    centrally_managed?: boolean;
    restrictions?: Record<string, boolean>;
  };
}

// Action handlers
export interface AgentCardActions {
  onPrimaryAction?: (data: BaseAgentData, e?: React.MouseEvent) => void;
  onSecondaryAction?: (data: BaseAgentData, e?: React.MouseEvent) => void;
  onDeleteAction?: (data: BaseAgentData, e?: React.MouseEvent) => void;
  onClick?: (data: BaseAgentData) => void;
  onToggle?: (agentId: string) => void;
}

// Card state
export interface AgentCardState {
  isSelected?: boolean;
  isRecommended?: boolean;
  isActioning?: boolean;
  isDeleting?: boolean;
}

// Main props interface
export interface UnifiedAgentCardProps {
  variant: AgentCardVariant;
  data: BaseAgentData;
  actions?: AgentCardActions;
  state?: AgentCardState;
  
  // Styling
  className?: string;
  size?: 'sm' | 'md' | 'lg';
  
  // Animation
  delay?: number;
  
  // Context
  currentUserId?: string;
}

// Avatar component
const CardAvatar: React.FC<{ 
  data: BaseAgentData;
  size?: number;
  variant: AgentCardVariant;
}> = ({ data, size = 48, variant }) => {
  const isIrisAgent = data.metadata?.is_iris_default === true;
  
  if (variant === 'showcase') {
    return (
      <motion.div 
        className="text-6xl mb-4 group-hover:scale-110 transition-transform duration-300"
        whileHover={{ rotate: [0, -10, 10, 0] }}
        transition={{ duration: 0.5 }}
      >
        {data.icon}
      </motion.div>
    );
  }
  
  if (isIrisAgent) {
    return (
      <AgentAvatar
        isIrisDefault={true}
        size={size}
        className="border"
      />
    );
  }
  
  if (data.icon_name) {
    return (
      <AgentAvatar
        iconName={data.icon_name}
        iconColor={data.icon_color}
        backgroundColor={data.icon_background}
        agentName={data.name}
        size={size}
      />
    );
  }
  
  // Fallback avatar
  return (
    <AgentAvatar
      agentName={data.name}
      size={size}
      className="border"
    />
  );
};

// Badge components
const MarketplaceBadge: React.FC<{ 
  isIrisTeam?: boolean; 
  isOwner?: boolean;
}> = ({ isIrisTeam, isOwner }) => (
  <div className="flex gap-1 flex-wrap">
    {isIrisTeam && (
      <Badge variant="secondary" className="bg-blue-100 text-blue-700 border-0 dark:bg-blue-950 dark:text-blue-300">
        <CheckCircle className="h-3 w-3 mr-1" />
        Verified
      </Badge>
    )}
    {isOwner && (
      <Badge variant="secondary" className="bg-green-100 text-green-700 border-0 dark:bg-green-950 dark:text-green-300">
        Owner
      </Badge>
    )}
  </div>
);

const TemplateBadge: React.FC<{ isPublic?: boolean }> = ({ isPublic }) => {
  if (isPublic) {
    return (
      <Badge variant="default" className="bg-green-100 text-green-700 border-0 dark:bg-green-950 dark:text-green-300">
        <Globe className="h-3 w-3" />
        Public
      </Badge>
    );
  }
  return (
    <Badge variant="secondary" className="bg-gray-100 text-gray-700 border-0 dark:bg-gray-800 dark:text-gray-300">
      <GlobeLock className="h-3 w-3" />
      Private
    </Badge>
  );
};

const AgentBadges: React.FC<{ data: BaseAgentData, isIrisAgent: boolean }> = ({ data, isIrisAgent }) => (
  <div className="flex gap-1">
    {!isIrisAgent && data.current_version && (
      <Badge variant="outline" className="text-xs">
        <GitBranch className="h-3 w-3 mr-1" />
        {data.current_version.version_name}
      </Badge>
    )}
    {!isIrisAgent && data.is_public && (
      <Badge variant="default" className="bg-green-100 text-green-700 border-0 dark:bg-green-950 dark:text-green-300 text-xs">
        <Globe className="h-3 w-3 mr-1" />
        Published
      </Badge>
    )}
  </div>
);

// Tag list component
const TagList: React.FC<{ tags?: string[]; maxTags?: number }> = ({ tags, maxTags = 3 }) => (
  <div className="flex flex-wrap gap-1 min-h-[1.25rem]">
    {tags && tags.length > 0 && (
      <>
        {tags.slice(0, maxTags).map(tag => (
          <Badge key={tag} variant="outline" className="text-xs border-border/50">
            {tag}
          </Badge>
        ))}
        {tags.length > maxTags && (
          <Badge variant="outline" className="text-xs border-border/50">
            +{tags.length - maxTags}
          </Badge>
        )}
      </>
    )}
  </div>
);

// Capabilities list for onboarding
const CapabilitiesList: React.FC<{ capabilities?: string[]; maxCapabilities?: number }> = ({ 
  capabilities, 
  maxCapabilities = 3 
}) => (
  <div className="flex flex-wrap gap-1">
    {capabilities && capabilities.length > 0 && (
      <>
        {capabilities.slice(0, maxCapabilities).map((capability) => (
          <Badge key={capability} variant="outline" className="text-xs">
            {capability}
          </Badge>
        ))}
        {capabilities.length > maxCapabilities && (
          <Badge variant="outline" className="text-xs">
            +{capabilities.length - maxCapabilities} more
          </Badge>
        )}
      </>
    )}
  </div>
);

// Main unified agent card component
export const UnifiedAgentCard: React.FC<UnifiedAgentCardProps> = ({
  variant,
  data,
  actions = {},
  state = {},
  className,
  size = 'md',
  delay = 0,
  currentUserId
}) => {
  const [showDeleteDialog, setShowDeleteDialog] = React.useState(false);
  
  const {
    onPrimaryAction,
    onSecondaryAction,
    onDeleteAction,
    onClick,
    onToggle
  } = actions;
  
  const {
    isSelected = false,
    isRecommended = false,
    isActioning = false,
    isDeleting = false
  } = state;
  
  const isIrisAgent = data.metadata?.is_iris_default === true;
  const isOwner = currentUserId && data.creator_id === currentUserId;
  
  // Handle delete confirmation
  const handleDeleteClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setShowDeleteDialog(true);
  };
  
  const handleConfirmDelete = () => {
    setShowDeleteDialog(false);
    onDeleteAction?.(data);
  };
  
  // Render different variants
  const renderShowcaseCard = () => (
    <motion.div className="flex flex-col items-start justify-end min-h-[400px] relative group cursor-pointer hover:bg-accent/30 transition-colors duration-300">
      <div className="relative flex size-full items-center justify-center h-full overflow-hidden">
        <div className="pointer-events-none absolute bottom-0 left-0 h-20 w-full bg-gradient-to-t from-background to-transparent z-20"></div>
        
        <div className="w-full h-full flex flex-col items-center justify-center gap-6 p-8 text-center">
          <CardAvatar data={data} variant={variant} />
          
          <div className="space-y-3">
            <h3 className="text-xl font-semibold tracking-tighter group-hover:text-primary transition-colors">
              {data.name}
            </h3>
            <p className="text-sm text-primary/70 font-medium uppercase tracking-wider">
              {data.role}
            </p>
            <p className="text-sm text-muted-foreground leading-relaxed max-w-xs">
              {data.description}
            </p>
          </div>

          <motion.button
            className="opacity-0 group-hover:opacity-100 inline-flex items-center gap-2 text-sm font-medium text-primary hover:text-primary/80 transition-all duration-300"
            initial={{ y: 10 }}
            whileHover={{ y: 0 }}
            onClick={() => onClick?.(data)}
          >
            Try {data.name} 
            <ArrowRight className="w-4 h-4" />
          </motion.button>
        </div>
      </div>
    </motion.div>
  );
  
  const renderDashboardCard = () => (
    <div
      className={cn(
        'group relative rounded-[32px] overflow-hidden transition-all duration-300 border cursor-pointer flex flex-col w-full border-white/10 dark:border-white/10 bg-[rgba(255,255,255,0.25)] dark:bg-[rgba(10,14,22,0.55)] backdrop-blur-2xl shadow-[0_20px_60px_-10px_rgba(0,0,0,0.05),inset_0_1px_0_0_rgba(0,0,0,0.06)] dark:shadow-[0_20px_60px_-10px_rgba(0,0,0,0.8),inset_0_1px_0_0_rgba(255,255,255,0.06)] hover:scale-[1.02]',
        className
      )}
      onClick={() => onClick?.(data)}
    >
      {/* Dark mode gradient rim */}
      <div className="absolute inset-0 rounded-[32px] dark:opacity-100 opacity-0 pointer-events-none" style={{
        background: 'linear-gradient(180deg, rgba(173,216,255,0.18), rgba(255,255,255,0.04) 30%, rgba(150,160,255,0.14) 85%, rgba(255,255,255,0.06))',
        WebkitMask: 'linear-gradient(#000,#000) content-box, linear-gradient(#000,#000)',
        WebkitMaskComposite: 'xor',
        maskComposite: 'exclude',
        padding: '1px',
        borderRadius: '32px'
      }} />
      
      {/* Light mode gradient rim */}
      <div className="absolute inset-0 rounded-[32px] light:opacity-100 dark:opacity-0 pointer-events-none" style={{
        background: 'linear-gradient(180deg, rgba(0,0,0,0.06), rgba(0,0,0,0.02) 30%, rgba(0,0,0,0.05) 85%, rgba(0,0,0,0.03))',
        WebkitMask: 'linear-gradient(#000,#000) content-box, linear-gradient(#000,#000)',
        WebkitMaskComposite: 'xor',
        maskComposite: 'exclude',
        padding: '1px',
        borderRadius: '32px'
      }} />
      
      {/* Dark mode specular streak */}
      <div className="absolute inset-x-0 top-0 h-16 rounded-t-[32px] dark:opacity-100 opacity-0 pointer-events-none" style={{
        background: 'linear-gradient(180deg, rgba(255,255,255,0.22), rgba(255,255,255,0.06) 45%, rgba(255,255,255,0) 100%)',
        filter: 'blur(4px)',
        mixBlendMode: 'screen',
      }} />
      
      {/* Light mode specular streak */}
      <div className="absolute inset-x-0 top-0 h-16 rounded-t-[32px] light:opacity-100 dark:opacity-0 pointer-events-none" style={{
        background: 'linear-gradient(180deg, rgba(0,0,0,0.08), rgba(0,0,0,0.03) 45%, rgba(0,0,0,0) 100%)',
        filter: 'blur(4px)',
        mixBlendMode: 'screen',
      }} />
      
      <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
      <div className="h-full relative z-10 flex flex-col overflow-hidden w-full p-4">
        <div className="flex items-center gap-3">
          <div className="flex-shrink-0">
            <CardAvatar data={data} size={40} variant={variant} />
          </div>
          <h3 className="text-base font-semibold text-foreground line-clamp-1 flex-1 min-w-0">
            {data.name}
          </h3>
        </div>
      </div>
    </div>
  );
  
  const renderOnboardingCard = () => (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay }}
      className="relative"
    >
      <Card 
        className={cn(
          'cursor-pointer transition-all duration-200 relative overflow-hidden rounded-[32px] border border-white/10 dark:border-white/10 bg-[rgba(255,255,255,0.25)] dark:bg-[rgba(10,14,22,0.55)] backdrop-blur-2xl shadow-[0_20px_60px_-10px_rgba(0,0,0,0.05),inset_0_1px_0_0_rgba(0,0,0,0.06)] dark:shadow-[0_20px_60px_-10px_rgba(0,0,0,0.8),inset_0_1px_0_0_rgba(255,255,255,0.06)]',
          isSelected 
            ? 'ring-2 ring-primary/50 scale-[1.02]' 
            : 'hover:scale-[1.01]',
          className
        )}
        onClick={() => onToggle?.(data.id)}
      >
        <CardContent className="p-4 space-y-3">
          {/* Header with name and selection */}
          <div className="flex items-start justify-between gap-3">
            <div className="space-y-0.5 flex-1 min-w-0">
              <h3 className="font-semibold text-sm leading-tight">{data.name}</h3>
              <p className="text-xs text-muted-foreground leading-tight">{data.role}</p>
            </div>
            
            {/* Selection indicator */}
            <div className="flex items-center gap-1.5 flex-shrink-0">
              
              {isSelected ? (
                <div className="flex items-center justify-center w-4 h-4 rounded-full bg-foreground text-background">
                  <Check className="h-3 w-3" strokeWidth={3} />
                </div>
              ) : (
                <Plus className="h-4 w-4 text-muted-foreground" />
              )}
            </div>
          </div>
          
          {/* Description */}
          <p className="text-xs text-muted-foreground leading-relaxed line-clamp-2">
            {data.description}
          </p>
          
          {/* Capabilities - compact */}
          {data.capabilities && data.capabilities.length > 0 && (
            <div className="space-y-1">
              {data.capabilities.slice(0, 3).map((capability) => (
                <div key={capability} className="flex items-start gap-1.5 text-[11px] text-muted-foreground">
                  <span className="mt-1 w-0.5 h-0.5 rounded-full bg-muted-foreground/40 flex-shrink-0" />
                  <span className="leading-tight">{capability}</span>
                </div>
              ))}
              {data.capabilities.length > 3 && (
                <div className="text-[11px] text-muted-foreground pl-2">
                  +{data.capabilities.length - 3} more
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
  
  const renderStandardCard = () => {
    const cardClassName = cn(
      'group relative rounded-[32px] overflow-hidden transition-all duration-300 border cursor-pointer flex flex-col border-white/10 dark:border-white/10 bg-[rgba(255,255,255,0.25)] dark:bg-[rgba(10,14,22,0.55)] backdrop-blur-2xl shadow-[0_20px_60px_-10px_rgba(0,0,0,0.05),inset_0_1px_0_0_rgba(0,0,0,0.06)] dark:shadow-[0_20px_60px_-10px_rgba(0,0,0,0.8),inset_0_1px_0_0_rgba(255,255,255,0.06)] hover:scale-[1.02]',
      className
    );
    
    const renderBadge = () => {
      switch (variant) {
        case 'marketplace':
          return <MarketplaceBadge isIrisTeam={data.is_iris_team} isOwner={isOwner} />;
        case 'template':
          return <TemplateBadge isPublic={data.is_public} />;
        case 'agent':
          return <AgentBadges data={data} isIrisAgent={isIrisAgent} />;
        default:
          return null;
      }
    };
    
    const renderMetadata = () => {
      if (variant === 'marketplace') {
        return (
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <div className="flex items-center gap-1">
              <User className="h-3 w-3" />
              <span>{data.creator_name || 'Anonymous'}</span>
            </div>
            <div className="flex items-center gap-1">
              <Download className="h-3 w-3" />
              <span>{data.download_count || 0} installs</span>
            </div>
          </div>
        );
      }
      
      if ((variant === 'template' || variant === 'agent') && data.is_public && data.download_count && data.download_count > 0) {
        return (
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <Download className="h-3 w-3" />
            <span>{data.download_count} downloads</span>
          </div>
        );
      }
      
      return null;
    };
    
    const renderActions = () => {
      if (variant === 'marketplace') {
        return (
          <div className="flex gap-2" onClick={(e) => e.stopPropagation()}>
            <Button 
              onClick={(e) => {
                e.stopPropagation();
                onPrimaryAction?.(data, e);
              }}
              disabled={isActioning}
              className="flex-1"
              size="sm"
            >
              {isActioning ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  Installing...
                </>
              ) : (
                <>
                  <Download className="h-4 w-4 mr-2" />
                  Install
                </>
              )}
            </Button>
            
            {isOwner && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button 
                    variant="outline" 
                    size="sm"
                    className="px-2"
                    disabled={isActioning}
                    onClick={(e) => e.stopPropagation()}
                  >
                    <MoreVertical className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48">
                  <DropdownMenuItem onClick={handleDeleteClick}>
                    <Trash2 className="h-4 w-4" />
                    Delete Template
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>
        );
      }
      
      if (variant === 'template') {
        return (
          <div className="space-y-2">
            <Button
              onClick={(e) => onPrimaryAction?.(data, e)}
              disabled={isActioning}
              variant={data.is_public ? "outline" : "default"}
              className="w-full"
              size="sm"
            >
              {isActioning ? (
                <>
                  <Loader2 className="h-3 w-3 animate-spin" />
                  {data.is_public ? 'Unpublishing...' : 'Publishing...'}
                </>
              ) : (
                <>
                  {data.is_public ? (
                    <>
                      <GlobeLock className="h-3 w-3" />
                      Make Private
                    </>
                  ) : (
                    <>
                      <Globe className="h-3 w-3" />
                      Publish to Marketplace
                    </>
                  )}
                </>
              )}
            </Button>
          </div>
        );
      }
      
      return null;
    };
    
    return (
      <div className={cardClassName} onClick={() => onClick?.(data)}>
        {/* Dark mode gradient rim */}
        <div className="absolute inset-0 rounded-[32px] dark:opacity-100 opacity-0 pointer-events-none" style={{
          background: 'linear-gradient(180deg, rgba(173,216,255,0.18), rgba(255,255,255,0.04) 30%, rgba(150,160,255,0.14) 85%, rgba(255,255,255,0.06))',
          WebkitMask: 'linear-gradient(#000,#000) content-box, linear-gradient(#000,#000)',
          WebkitMaskComposite: 'xor',
          maskComposite: 'exclude',
          padding: '1px',
          borderRadius: '32px'
        }} />
        
        {/* Light mode gradient rim */}
        <div className="absolute inset-0 rounded-[32px] light:opacity-100 dark:opacity-0 pointer-events-none" style={{
          background: 'linear-gradient(180deg, rgba(0,0,0,0.06), rgba(0,0,0,0.02) 30%, rgba(0,0,0,0.05) 85%, rgba(0,0,0,0.03))',
          WebkitMask: 'linear-gradient(#000,#000) content-box, linear-gradient(#000,#000)',
          WebkitMaskComposite: 'xor',
          maskComposite: 'exclude',
          padding: '1px',
          borderRadius: '32px'
        }} />
        
        {/* Dark mode specular streak */}
        <div className="absolute inset-x-0 top-0 h-24 rounded-t-[32px] dark:opacity-100 opacity-0 pointer-events-none" style={{
          background: 'linear-gradient(180deg, rgba(255,255,255,0.22), rgba(255,255,255,0.06) 45%, rgba(255,255,255,0) 100%)',
          filter: 'blur(6px)',
          mixBlendMode: 'screen',
        }} />
        
        {/* Light mode specular streak */}
        <div className="absolute inset-x-0 top-0 h-24 rounded-t-[32px] light:opacity-100 dark:opacity-0 pointer-events-none" style={{
          background: 'linear-gradient(180deg, rgba(0,0,0,0.08), rgba(0,0,0,0.03) 45%, rgba(0,0,0,0) 100%)',
          filter: 'blur(6px)',
          mixBlendMode: 'screen',
        }} />
        
        {/* Fine noise */}
        <div className="absolute inset-0 rounded-[32px] opacity-30 dark:opacity-30 light:opacity-20 pointer-events-none" style={{
          backgroundImage: `url('data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="60" height="60"><filter id="n"><feTurbulence type="fractalNoise" baseFrequency="0.8" numOctaves="4"/><feColorMatrix type="saturate" values="0"/><feComponentTransfer><feFuncA type="table" tableValues="0 0.03"/></feComponentTransfer></filter><rect width="100%" height="100%" filter="url(%23n)" /></svg>')`,
          backgroundSize: '100px 100px',
          mixBlendMode: 'overlay',
        }} />
        
        <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
        <div className="relative z-10 p-6 flex flex-col flex-1">
          <div className="flex items-start justify-between mb-4">
            <CardAvatar data={data} variant={variant} />
            <div className="flex items-center gap-2">
              {renderBadge()}
            </div>
          </div>
          
          <h3 className="text-lg font-semibold text-foreground mb-2 line-clamp-1">
            {data.name}
          </h3>
          
          <div className="flex-1 flex flex-col">
            <div className="min-h-[1.25rem] mb-3">
              <TagList tags={data.tags} />
            </div>
            
            <div className="mt-auto">
              <div className="mb-3">
                {renderMetadata()}
              </div>
              {renderActions()}
            </div>
          </div>
        </div>
        
        {/* Delete confirmation dialog */}
        <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete Template</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to delete "<strong>{data.name}</strong>"? This will permanently remove it from the marketplace and cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel onClick={(e) => e.stopPropagation()}>
                Cancel
              </AlertDialogCancel>
              <AlertDialogAction
                onClick={(e) => {
                  e.stopPropagation();
                  handleConfirmDelete();
                }}
                className="bg-destructive hover:bg-destructive/90 text-white"
              >
                {isActioning ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Deleting...
                  </>
                ) : (
                  'Delete Template'
                )}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    );
  };
  
  // Render based on variant
  switch (variant) {
    case 'showcase':
      return renderShowcaseCard();
    case 'dashboard':
    case 'compact':
      return renderDashboardCard();
    case 'onboarding':
      return renderOnboardingCard();
    default:
      return renderStandardCard();
  }
};

// Export legacy component names for backward compatibility
export const AgentCard = UnifiedAgentCard;
export default UnifiedAgentCard;
