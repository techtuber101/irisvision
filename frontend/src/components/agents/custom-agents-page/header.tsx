'use client';

import React from 'react';
import { Ripple } from '@/components/ui/ripple';

export const AgentsPageHeader = () => {
  return (
    <div className="relative overflow-hidden rounded-[32px] flex items-center justify-center border border-white/10 dark:border-white/10 bg-[rgba(255,255,255,0.25)] dark:bg-[rgba(10,14,22,0.55)] backdrop-blur-2xl shadow-[0_20px_60px_-10px_rgba(0,0,0,0.05),inset_0_1px_0_0_rgba(0,0,0,0.06)] dark:shadow-[0_20px_60px_-10px_rgba(0,0,0,0.8),inset_0_1px_0_0_rgba(255,255,255,0.06)] transition-all duration-300">
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
      
      <div className="relative z-10 px-6 py-8 text-center">
        <div className="mx-auto max-w-3xl space-y-4">
          <div className="inline-flex items-center justify-center rounded-full bg-white/10 dark:bg-white/5 backdrop-blur-sm border border-white/20 dark:border-white/10 p-2.5">
            <span className="text-xl">✨</span>
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">
            <span className="text-primary">Personalities</span>
          </h1>
          <p className="text-base text-muted-foreground max-w-2xl mx-auto">
            Create custom AI personalities that give Iris different behaviors, capabilities, and ways of thinking.
          </p>
        </div>
      </div>
      <Ripple/>
    </div>
  );
};
