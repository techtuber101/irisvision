'use client';

import React from 'react';
import { Search } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

interface SearchBarProps {
  placeholder: string;
  value: string;
  onChange: (value: string) => void;
  className?: string;
}

export const SearchBar = ({ placeholder, value, onChange, className }: SearchBarProps) => {
  return (
    <div className={cn("relative flex-1 max-w-2xl", className)}>
      <div className="relative rounded-2xl border border-white/10 dark:border-white/10 bg-[rgba(255,255,255,0.25)] dark:bg-[rgba(10,14,22,0.55)] backdrop-blur-2xl shadow-[0_20px_60px_-10px_rgba(0,0,0,0.05),inset_0_1px_0_0_rgba(0,0,0,0.06)] dark:shadow-[0_20px_60px_-10px_rgba(0,0,0,0.8),inset_0_1px_0_0_rgba(255,255,255,0.06)] transition-all duration-300 overflow-hidden">
        {/* Dark mode gradient rim */}
        <div className="absolute inset-0 rounded-2xl dark:opacity-100 opacity-0 pointer-events-none" style={{
          background: 'linear-gradient(180deg, rgba(173,216,255,0.18), rgba(255,255,255,0.04) 30%, rgba(150,160,255,0.14) 85%, rgba(255,255,255,0.06))',
          WebkitMask: 'linear-gradient(#000,#000) content-box, linear-gradient(#000,#000)',
          WebkitMaskComposite: 'xor',
          maskComposite: 'exclude',
          padding: '1px',
          borderRadius: '16px'
        }} />
        
        {/* Light mode gradient rim */}
        <div className="absolute inset-0 rounded-2xl light:opacity-100 dark:opacity-0 pointer-events-none" style={{
          background: 'linear-gradient(180deg, rgba(0,0,0,0.06), rgba(0,0,0,0.02) 30%, rgba(0,0,0,0.05) 85%, rgba(0,0,0,0.03))',
          WebkitMask: 'linear-gradient(#000,#000) content-box, linear-gradient(#000,#000)',
          WebkitMaskComposite: 'xor',
          maskComposite: 'exclude',
          padding: '1px',
          borderRadius: '16px'
        }} />
        
        {/* Dark mode specular streak */}
        <div className="absolute inset-x-0 top-0 h-16 rounded-t-2xl dark:opacity-100 opacity-0 pointer-events-none" style={{
          background: 'linear-gradient(180deg, rgba(255,255,255,0.22), rgba(255,255,255,0.06) 45%, rgba(255,255,255,0) 100%)',
          filter: 'blur(4px)',
          mixBlendMode: 'screen',
        }} />
        
        {/* Light mode specular streak */}
        <div className="absolute inset-x-0 top-0 h-16 rounded-t-2xl light:opacity-100 dark:opacity-0 pointer-events-none" style={{
          background: 'linear-gradient(180deg, rgba(0,0,0,0.08), rgba(0,0,0,0.03) 45%, rgba(0,0,0,0) 100%)',
          filter: 'blur(4px)',
          mixBlendMode: 'screen',
        }} />
        
        <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-black/60 dark:text-white/60 z-10" />
        <Input
          placeholder={placeholder}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="relative z-10 pl-12 h-12 rounded-2xl bg-transparent border-0 text-black/90 dark:text-white/90 placeholder:text-black/50 dark:placeholder:text-white/50 focus:outline-none focus:ring-0 transition-all"
        />
      </div>
    </div>
  );
}; 