'use client';

import React from 'react';
import { cn } from '@/lib/utils';

interface WaveformAnimationProps {
  className?: string;
  barCount?: number;
  color?: string;
}

export function WaveformAnimation({ 
  className, 
  barCount = 5,
  color = "bg-emerald-500"
}: WaveformAnimationProps) {
  return (
    <div className={cn("flex items-center justify-center gap-1.5", className)}>
      {Array.from({ length: barCount }).map((_, i) => (
        <div
          key={i}
          className={cn(
            "w-1.5 rounded-full",
            color
          )}
          style={{
            height: '100%',
            maxHeight: '32px',
            animation: `waveform 1.2s ease-in-out infinite`,
            animationDelay: `${i * 0.15}s`,
          }}
        />
      ))}
      <style jsx>{`
        @keyframes waveform {
          0%, 100% {
            height: 12px;
            opacity: 0.4;
          }
          50% {
            height: 32px;
            opacity: 1;
          }
        }
      `}</style>
    </div>
  );
}
