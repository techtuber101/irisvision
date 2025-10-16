import React, { useState, useEffect } from 'react';
import { Loader2, LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Progress } from '@/components/ui/progress';

interface LoadingStateProps {
  icon?: LucideIcon;
  iconColor?: string;
  bgColor?: string;
  title: string;
  subtitle?: string;
  filePath?: string | null;
  showProgress?: boolean;
  progressText?: string;
  autoProgress?: boolean;
  initialProgress?: number;
}

export function LoadingState({
  icon: Icon = Loader2,
  iconColor = 'text-purple-500 dark:text-purple-400',
  bgColor = 'bg-gradient-to-b from-purple-100 to-purple-50 shadow-inner dark:from-purple-800/40 dark:to-purple-900/60 dark:shadow-purple-950/20',
  title,
  subtitle,
  filePath,
  showProgress = true,
  progressText,
  autoProgress = true,
  initialProgress = 0,
}: LoadingStateProps): JSX.Element {
  const [progress, setProgress] = useState(initialProgress);

  useEffect(() => {
    if (showProgress && autoProgress) {
      setProgress(0);
      const timer = setInterval(() => {
        setProgress((prevProgress) => {
          if (prevProgress >= 95) {
            clearInterval(timer);
            return prevProgress;
          }
          return prevProgress + Math.random() * 10 + 5;
        });
      }, 500);
      return () => clearInterval(timer);
    }
  }, [showProgress, autoProgress]);
  return (
    <div className="flex flex-col items-center justify-center h-full min-h-[400px] overflow-hidden scrollbar-hide py-12 px-6">
      <div className="text-center w-full max-w-sm">
        <div className="w-16 h-16 rounded-full mx-auto mb-6 flex items-center justify-center bg-white/80 backdrop-blur-2xl border border-black/10 shadow-[0_20px_60px_-10px_rgba(0,0,0,0.1),inset_0_1px_0_0_rgba(0,0,0,0.06)] dark:bg-[rgba(10,14,22,0.55)] dark:border-white/10 dark:shadow-[0_20px_60px_-10px_rgba(0,0,0,0.8),inset_0_1px_0_0_rgba(255,255,255,0.06)] relative overflow-hidden">
          {/* Gradient rim */}
          <div aria-hidden="true" className="pointer-events-none absolute inset-0 rounded-full" style={{
            background: 'linear-gradient(180deg, rgba(173,216,255,0.18), rgba(255,255,255,0.04) 30%, rgba(150,160,255,0.14) 85%, rgba(255,255,255,0.06))',
            WebkitMask: 'linear-gradient(#000,#000) content-box, linear-gradient(#000,#000)',
            WebkitMaskComposite: 'xor',
            maskComposite: 'exclude',
            padding: '1px',
            borderRadius: '50%'
          }}></div>
          
          {/* Specular streak */}
          <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-0 h-8" style={{
            background: 'linear-gradient(180deg, rgba(255,255,255,0.22), rgba(255,255,255,0.06) 45%, rgba(255,255,255,0) 100%)',
            filter: 'blur(4px)',
            mixBlendMode: 'screen'
          }}></div>
          
          {/* Fine noise */}
          <div aria-hidden="true" className="pointer-events-none absolute inset-0 opacity-20" style={{
            backgroundImage: `url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='60' height='60'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.8' numOctaves='4'/><feColorMatrix type='saturate' values='0'/><feComponentTransfer><feFuncA type='table' tableValues='0 0.03'/></feComponentTransfer></filter><rect width='100%' height='100%' filter='url(%23n)' /></svg>")`,
            backgroundSize: '100px 100px',
            mixBlendMode: 'overlay'
          }}></div>
          
          <Icon className={cn("h-8 w-8 text-black/80 dark:text-white/90 relative z-10", Icon === Loader2 && "animate-spin")} />
        </div>
        
        <h3 className="text-xl font-semibold mb-4 text-black/90 dark:text-white/90">
          {title}
        </h3>
        
        {filePath && (
          <div className="bg-white/80 backdrop-blur-2xl border border-black/10 shadow-[0_8px_32px_rgba(0,0,0,0.1),inset_0_1px_0_rgba(0,0,0,0.1)] dark:bg-[rgba(10,14,22,0.55)] dark:border-white/10 dark:shadow-[0_8px_32px_rgba(0,0,0,0.3),inset_0_1px_0_rgba(255,255,255,0.1)] rounded-lg p-4 w-full text-center mb-6 relative overflow-hidden">
            {/* Gradient rim */}
            <div aria-hidden="true" className="pointer-events-none absolute inset-0 rounded-lg" style={{
              background: 'linear-gradient(180deg, rgba(173,216,255,0.18), rgba(255,255,255,0.04) 30%, rgba(150,160,255,0.14) 85%, rgba(255,255,255,0.06))',
              WebkitMask: 'linear-gradient(#000,#000) content-box, linear-gradient(#000,#000)',
              WebkitMaskComposite: 'xor',
              maskComposite: 'exclude',
              padding: '1px',
              borderRadius: '8px'
            }}></div>
            
            {/* Specular streak */}
            <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-0 h-6" style={{
              background: 'linear-gradient(180deg, rgba(255,255,255,0.22), rgba(255,255,255,0.06) 45%, rgba(255,255,255,0) 100%)',
              filter: 'blur(3px)',
              mixBlendMode: 'screen'
            }}></div>
            
            {/* Fine noise */}
            <div aria-hidden="true" className="pointer-events-none absolute inset-0 opacity-20" style={{
              backgroundImage: `url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='60' height='60'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.8' numOctaves='4'/><feColorMatrix type='saturate' values='0'/><feComponentTransfer><feFuncA type='table' tableValues='0 0.03'/></feComponentTransfer></filter><rect width='100%' height='100%' filter='url(%23n)' /></svg>")`,
              backgroundSize: '100px 100px',
              mixBlendMode: 'overlay'
            }}></div>
            
            <code className="text-sm font-mono text-black/90 dark:text-white/90 break-all relative z-10">
              {filePath}
            </code>
          </div>
        )}
        
        {showProgress && (
          <div className="space-y-3">
            <Progress value={Math.min(progress, 100)} className="w-full h-1" />
            <div className="flex justify-between items-center text-xs text-black/70 dark:text-white/70">
              <span>{progressText || 'Processing...'}</span>
              <span className="font-mono">{Math.round(Math.min(progress, 100))}%</span>
            </div>
          </div>
        )}
        
        {subtitle && (
          <p className="text-sm text-black/70 dark:text-white/70 mt-4">
            {subtitle}
          </p>
        )}
      </div>
    </div>
  );
} 