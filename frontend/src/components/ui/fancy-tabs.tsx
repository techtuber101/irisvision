'use client';

import React from 'react';
import { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useTheme } from 'next-themes';

export interface TabConfig {
  value: string;
  icon: LucideIcon;
  label: string;
  shortLabel?: string;
}

interface FancyTabsProps {
  tabs: TabConfig[];
  activeTab: string;
  onTabChange: (value: string) => void;
  className?: string;
}

interface TabButtonProps {
  value: string;
  isActive: boolean;
  onClick: () => void;
  children: React.ReactNode;
}

const TabButton = ({ value, isActive, onClick, children }: TabButtonProps) => {
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  
  return (
    <button
      onClick={onClick}
      className={cn(
        "relative flex items-center justify-center gap-2 rounded-2xl px-4 py-2.5 text-sm font-medium transition-all duration-300 ease-out",
        !isActive && (isDark ? "hover:bg-white/8" : "hover:bg-muted/60"),
        isActive 
          ? isDark ? "text-white" : "text-foreground bg-background border border-border/50"
          : isDark ? "text-white/60 hover:text-white/85" : "text-muted-foreground hover:text-foreground"
      )}
      style={isActive && isDark ? {
        background: 'linear-gradient(135deg, rgba(255, 255, 255, 0.15), rgba(255, 255, 255, 0.08))',
        backdropFilter: 'blur(12px)',
        boxShadow: `
          0 4px 8px rgba(0, 0, 0, 0.1),
          0 0 20px rgba(255, 255, 255, 0.1),
          0 0 40px rgba(255, 255, 255, 0.1),
          inset 0 1px 0 rgba(255, 255, 255, 0.2)
        `
      } : undefined}
    >
      {isActive && isDark && (
        <div 
          className="absolute inset-0 rounded-2xl opacity-40 blur-sm"
          style={{
            background: 'linear-gradient(45deg, rgba(255, 255, 255, 0.2), rgba(255, 255, 255, 0.1))',
            zIndex: -1
          }}
        />
      )}
      {children}
    </button>
  );
};

export const FancyTabs = ({ tabs, activeTab, onTabChange, className }: FancyTabsProps) => {
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  
  return (
    <div 
      className={cn(
        "relative overflow-hidden grid w-full max-w-lg mx-auto rounded-[32px] p-1.5 border border-white/10 dark:border-white/10 bg-[rgba(255,255,255,0.25)] dark:bg-[rgba(10,14,22,0.55)] backdrop-blur-2xl shadow-[0_20px_60px_-10px_rgba(0,0,0,0.05),inset_0_1px_0_0_rgba(0,0,0,0.06)] dark:shadow-[0_20px_60px_-10px_rgba(0,0,0,0.8),inset_0_1px_0_0_rgba(255,255,255,0.06)]",
        className
      )}
      style={{
        gridTemplateColumns: `repeat(${tabs.length}, 1fr)`,
      }}
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
      <div className="relative z-10 contents">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          return (
            <TabButton 
              key={tab.value}
              value={tab.value} 
              isActive={activeTab === tab.value}
              onClick={() => onTabChange(tab.value)}
            >
              <Icon className="h-4 w-4" />
              <span className="hidden sm:inline">{tab.label}</span>
              {tab.shortLabel && (
                <span className="sm:hidden">{tab.shortLabel}</span>
              )}
            </TabButton>
          );
        })}
      </div>
    </div>
  );
}; 