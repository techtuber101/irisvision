'use client';

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Loader2, AlertCircle, RefreshCw } from 'lucide-react';
import { useVncPreloader } from '@/hooks/useVncPreloader';

interface HealthCheckedVncIframeProps {
  sandbox: {
    id: string;
    vnc_preview: string;
    pass: string;
  };
  className?: string;
}

export function HealthCheckedVncIframe({ sandbox, className }: HealthCheckedVncIframeProps) {
  const [iframeKey, setIframeKey] = useState(0);
  
  // Use the enhanced VNC preloader hook
  const { status, retryCount, retry, isPreloaded } = useVncPreloader(sandbox, {
    maxRetries: 5,
    initialDelay: 1000,
    timeoutMs: 5000
  });




  // VNC URL received but preloading in progress
  if (status === 'loading') {
    return (
      <div className={`overflow-hidden m-2 sm:m-4 relative ${className || ''}`}>
        <Card className="p-0 overflow-hidden border">
          <div className='relative w-full aspect-[4/3] sm:aspect-[5/3] md:aspect-[16/11] overflow-hidden bg-amber-50 dark:bg-amber-950/30 flex flex-col items-center justify-center'>
            <Loader2 className="h-8 w-8 animate-spin text-amber-600 mb-3" />
            <p className="text-sm font-medium text-center mb-2">Connecting to browser...</p>
            <p className="text-xs text-muted-foreground mb-2 text-center">
              Testing VNC connection
            </p>
            {retryCount > 0 && (
              <p className="text-xs text-amber-600 text-center">
                🔄 Attempt {retryCount + 1}/5
              </p>
            )}
          </div>
        </Card>
      </div>
    );
  }

  // VNC preload failed after retries
  if (status === 'error') {
    return (
      <div className={`overflow-hidden m-2 sm:m-4 relative ${className || ''}`}>
        <Card className="p-0 overflow-hidden border">
          <div className='relative w-full aspect-[4/3] sm:aspect-[5/3] md:aspect-[16/11] overflow-hidden bg-destructive/10 flex flex-col items-center justify-center'>
            <AlertCircle className="h-8 w-8 text-destructive mb-3" />
            <p className="text-sm font-medium text-center mb-2">Connection Failed</p>
            <p className="text-xs text-muted-foreground mb-4 text-center">
              Unable to connect to VNC server after 5 attempts
            </p>
            <Button
              variant="outline"
              size="sm"
              onClick={retry}
            >
              <RefreshCw className="h-4 w-4 mr-1" />
              Try Again
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  if (isPreloaded) {
    return (
      <div className={`overflow-hidden m-2 sm:m-4 relative ${className || ''}`}>
        <div className="relative rounded-2xl border border-white/10 bg-[rgba(7,10,17,0.95)] shadow-[inset_0_0_0_1px_rgba(255,255,255,0.04)] light:border-black/10 light:bg-[rgba(255,255,255,0.25)] light:backdrop-blur-2xl light:shadow-[0_20px_60px_-10px_rgba(0,0,0,0.05)] light:shadow-[inset_0_1px_0_0_rgba(0,0,0,0.06)] overflow-hidden">
          {/* Gradient rim */}
          <div aria-hidden="true" className="pointer-events-none absolute inset-0 rounded-2xl" style={{
            background: 'linear-gradient(180deg, rgba(173,216,255,0.10), rgba(255,255,255,0.04) 30%, rgba(150,160,255,0.10) 85%, rgba(255,255,255,0.06))',
            WebkitMask: 'linear-gradient(#000,#000) content-box, linear-gradient(#000,#000)',
            WebkitMaskComposite: 'xor',
            maskComposite: 'exclude',
            padding: '1px',
            borderRadius: '16px'
          }} 
          data-light-gradient="linear-gradient(180deg, rgba(0,0,0,0.06), rgba(0,0,0,0.02) 30%, rgba(0,0,0,0.05) 85%, rgba(0,0,0,0.03))"
          data-dark-gradient="linear-gradient(180deg, rgba(173,216,255,0.10), rgba(255,255,255,0.04) 30%, rgba(150,160,255,0.10) 85%, rgba(255,255,255,0.06))"
          />
          {/* Specular streak */}
          <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-0 h-16" style={{
            background: 'linear-gradient(180deg, rgba(255,255,255,0.22), rgba(255,255,255,0.06) 45%, rgba(255,255,255,0) 100%)',
            filter: 'blur(6px)',
            mixBlendMode: 'screen'
          }} 
          data-light-streak="linear-gradient(180deg, rgba(0,0,0,0.08), rgba(0,0,0,0.03) 45%, rgba(0,0,0,0) 100%)"
          data-dark-streak="linear-gradient(180deg, rgba(255,255,255,0.22), rgba(255,255,255,0.06) 45%, rgba(255,255,255,0) 100%)"
          />
          {/* Fine noise */}
          <div aria-hidden="true" className="pointer-events-none absolute inset-0 opacity-20" style={{
            backgroundImage: `url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='60' height='60'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.8' numOctaves='4'/><feColorMatrix type='saturate' values='0'/><feComponentTransfer><feFuncA type='table' tableValues='0 0.03'/></feComponentTransfer></filter><rect width='100%' height='100%' filter='url(%23n)' /></svg>")`,
            backgroundSize: '100px 100px',
            mixBlendMode: 'overlay'
          }} />
          
          <div className='relative w-full aspect-[4/3] sm:aspect-[5/3] md:aspect-[16/11] overflow-hidden bg-gray-100 dark:bg-gray-800 light:bg-white/50 rounded-2xl'>
            <iframe
              key={iframeKey}
              src={`${sandbox.vnc_preview}/vnc_lite.html?password=${sandbox.pass}&autoconnect=true&scale=local`}
              title="Browser preview"
              className="absolute inset-0 w-full h-full border-0 md:w-[102%] md:h-[130%] md:-translate-y-[4.4rem] lg:-translate-y-[4.7rem] xl:-translate-y-[5.4rem] md:left-0 md:-translate-x-2 rounded-2xl"
            />
          </div>
        </div>
      </div>
    );
  }

  // Should not reach here
  return null;
}
