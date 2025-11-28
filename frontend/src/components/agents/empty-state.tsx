import React from 'react';
import { Bot, Search, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface EmptyStateProps {
  hasAgents: boolean;
  onCreateAgent: () => void;
  onClearFilters: () => void;
}

export const EmptyState = ({ hasAgents, onCreateAgent, onClearFilters }: EmptyStateProps) => {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-4">
      <div className="relative rounded-[32px] border border-white/10 dark:border-white/10 bg-[rgba(255,255,255,0.25)] dark:bg-[rgba(10,14,22,0.55)] backdrop-blur-2xl shadow-[0_20px_60px_-10px_rgba(0,0,0,0.05),inset_0_1px_0_0_rgba(0,0,0,0.06)] dark:shadow-[0_20px_60px_-10px_rgba(0,0,0,0.8),inset_0_1px_0_0_rgba(255,255,255,0.06)] transition-all duration-300 overflow-hidden p-8">
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
        
        <div className="relative z-10 flex flex-col items-center text-center max-w-md space-y-6">
          <div className="rounded-full bg-white/10 dark:bg-white/5 backdrop-blur-sm border border-white/20 dark:border-white/10 p-6">
            {!hasAgents ? (
              <Bot className="h-12 w-12 text-black/70 dark:text-white/70" />
            ) : (
              <Search className="h-12 w-12 text-black/70 dark:text-white/70" />
            )}
          </div>
          <div className="space-y-3">
            <h2 className="text-2xl font-semibold text-foreground">
            {!hasAgents ? 'No personalities yet' : 'No personalities found'}
          </h2>
          <p className="text-muted-foreground leading-relaxed">
            {!hasAgents ? (
              'Create your first personality to start automating tasks with custom instructions and tools. Configure custom AgentPress capabilities to fine tune personality according to your needs.'
            ) : (
              'No personalities match your current search and filter criteria. Try adjusting your filters or search terms.'
            )}
          </p>
        </div>
        {!hasAgents ? (
          <Button 
            size="lg" 
            onClick={onCreateAgent}
            className="mt-4"
          >
            <Plus className="h-5 w-5" />
            Create your first personality
          </Button>
          ) : (
            <Button 
              variant="outline"
              onClick={onClearFilters}
              className="mt-4"
            >
              Clear filters
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}