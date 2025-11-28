import React from 'react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

interface LoadingStateProps {
  viewMode: 'grid' | 'list';
}

export const LoadingState = ({ viewMode }: LoadingStateProps) => {
  const skeletonCount = viewMode === 'grid' ? 4 : 8;
  
  return (
    <div className={viewMode === 'grid' ? "grid gap-6 sm:grid-cols-2 lg:grid-cols-4" : "space-y-4"}>
      {Array.from({ length: skeletonCount }, (_, i) => (
        <div key={i} className="relative rounded-[32px] border border-white/10 dark:border-white/10 bg-[rgba(255,255,255,0.25)] dark:bg-[rgba(10,14,22,0.55)] backdrop-blur-2xl shadow-[0_20px_60px_-10px_rgba(0,0,0,0.05),inset_0_1px_0_0_rgba(0,0,0,0.06)] dark:shadow-[0_20px_60px_-10px_rgba(0,0,0,0.8),inset_0_1px_0_0_rgba(255,255,255,0.06)] overflow-hidden">
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
          
          <Skeleton className="h-50 bg-white/10 dark:bg-white/5" />
          <div className="relative z-10 p-4 space-y-3">
            <Skeleton className="h-5 rounded bg-white/10 dark:bg-white/5" />
            <div className="space-y-2">
              <Skeleton className="h-4 rounded bg-white/10 dark:bg-white/5" />
              <Skeleton className="h-4 rounded w-3/4 bg-white/10 dark:bg-white/5" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}