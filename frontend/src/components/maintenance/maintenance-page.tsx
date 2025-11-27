'use client';

import { useEffect, useState, useRef } from 'react';
import { Loader2, RefreshCw, AlertCircle, Clock } from 'lucide-react';
import { useApiHealth } from '@/hooks/react-query';
import { Button } from '@/components/ui/button';
import { isLocalMode } from '@/lib/config';
import { useScroll } from 'motion/react';
import { FlickeringGrid } from '@/components/home/ui/flickering-grid';
import { useMediaQuery } from '@/hooks/use-media-query';

export function MaintenancePage() {
  const tablet = useMediaQuery('(max-width: 1024px)');
  const [mounted, setMounted] = useState(false);
  const [isScrolling, setIsScrolling] = useState(false);
  const scrollTimeout = useRef<NodeJS.Timeout | null>(null);
  const { scrollY } = useScroll();
  const [lastChecked, setLastChecked] = useState<Date | null>(null);
  
  const { data: healthData, isLoading: isCheckingHealth, refetch } = useApiHealth();

  const checkHealth = async () => {
    try {
      const result = await refetch();
      if (result.data) {
        window.location.reload();
      }
    } catch (error) {
      console.error('API health check failed:', error);
    } finally {
      setLastChecked(new Date());
    }
  };

  useEffect(() => {
    setMounted(true);
    setLastChecked(new Date());
  }, []);

  // Detect when scrolling is active to reduce animation complexity
  useEffect(() => {
    const unsubscribe = scrollY.on('change', () => {
      setIsScrolling(true);

      // Clear any existing timeout
      if (scrollTimeout.current) {
        clearTimeout(scrollTimeout.current);
      }

      // Set a new timeout
      scrollTimeout.current = setTimeout(() => {
        setIsScrolling(false);
      }, 300); // Wait 300ms after scroll stops
    });

    return () => {
      unsubscribe();
      if (scrollTimeout.current) {
        clearTimeout(scrollTimeout.current);
      }
    };
  }, [scrollY]);

  return (
    <section className="w-full relative overflow-hidden min-h-screen flex items-center justify-center">
      <div className="relative flex flex-col items-center w-full px-6">
        {/* Left side flickering grid with gradient fades */}
        <div className="absolute left-0 top-0 h-full w-1/3 -z-10 overflow-hidden">
          {/* Horizontal fade from left to right */}
          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-transparent to-background z-10" />

          {/* Vertical fade from top */}
          <div className="absolute inset-x-0 top-0 h-32 bg-gradient-to-b from-background via-background/90 to-transparent z-10" />

          {/* Vertical fade to bottom */}
          <div className="absolute inset-x-0 bottom-0 h-48 bg-gradient-to-t from-background via-background/90 to-transparent z-10" />

          <FlickeringGrid
            className="h-full w-full"
            squareSize={mounted && tablet ? 2 : 2.5}
            gridGap={mounted && tablet ? 2 : 2.5}
            color="var(--secondary)"
            maxOpacity={0.4}
            flickerChance={isScrolling ? 0.01 : 0.03}
          />
        </div>

        {/* Right side flickering grid with gradient fades */}
        <div className="absolute right-0 top-0 h-full w-1/3 -z-10 overflow-hidden">
          {/* Horizontal fade from right to left */}
          <div className="absolute inset-0 bg-gradient-to-l from-transparent via-transparent to-background z-10" />

          {/* Vertical fade from top */}
          <div className="absolute inset-x-0 top-0 h-32 bg-gradient-to-b from-background via-background/90 to-transparent z-10" />

          {/* Vertical fade to bottom */}
          <div className="absolute inset-x-0 bottom-0 h-48 bg-gradient-to-t from-background via-background/90 to-transparent z-10" />

          <FlickeringGrid
            className="h-full w-full"
            squareSize={mounted && tablet ? 2 : 2.5}
            gridGap={mounted && tablet ? 2 : 2.5}
            color="var(--secondary)"
            maxOpacity={0.4}
            flickerChance={isScrolling ? 0.01 : 0.03}
          />
        </div>

        {/* Center content background with rounded bottom */}
        <div className="absolute inset-x-1/4 top-0 h-full -z-20 bg-background rounded-b-xl"></div>

        <div className="relative z-10 max-w-3xl mx-auto h-full w-full flex flex-col gap-10 items-center justify-center py-12">
          <div className="inline-flex h-10 w-fit items-center justify-center gap-2 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 px-4">
            <AlertCircle className="size-4" />
            <span className="text-sm font-medium">System Maintenance</span>
          </div>

          <div className="flex flex-col items-center justify-center gap-5">
            <h1 className="text-3xl md:text-4xl lg:text-5xl xl:text-6xl font-medium tracking-tighter text-balance text-center text-primary">
              We'll be right back
            </h1>
            <p className="text-base md:text-lg text-center text-muted-foreground font-medium text-balance leading-relaxed tracking-tight max-w-2xl">
              {isLocalMode() ? (
                "The backend server appears to be offline. Please ensure your backend server is running and try again."
              ) : (
                "We're currently performing scheduled maintenance to improve your experience. Our team is working diligently to restore all services."
              )}
            </p>
          </div>

          {/* Status indicator */}
          <div className="flex items-center justify-center gap-3 px-6 py-4 rounded-2xl bg-red-500/10 border border-red-500/20">
            <div className="h-3 w-3 bg-red-500 dark:bg-red-400 rounded-full animate-pulse"></div>
            <div className="flex flex-col items-start gap-0.5">
              <span className="text-sm font-semibold text-red-700 dark:text-red-300">Services Offline</span>
              <span className="text-xs text-red-600 dark:text-red-400">All agent executions are currently paused</span>
            </div>
          </div>

          <div className="flex flex-col items-center w-full max-w-xl gap-4">
            <Button
              onClick={checkHealth}
              disabled={isCheckingHealth}
              className="inline-flex h-12 md:h-14 items-center justify-center gap-2 rounded-full bg-primary text-white px-8 shadow-md hover:bg-primary/90 transition-all duration-200 disabled:opacity-50"
            >
              {isCheckingHealth ? (
                <>
                  <Loader2 className="size-4 md:size-5 animate-spin dark:text-black" />
                  <span className="font-medium dark:text-black">Checking Status...</span>
                </>
              ) : (
                <>
                  <RefreshCw className="size-4 md:size-5 dark:text-black" />
                  <span className="font-medium dark:text-black">Check Status Now</span>
                </>
              )}
            </Button>
            
            {lastChecked && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Clock className="size-4" />
                <span>Last checked: {lastChecked.toLocaleTimeString()}</span>
              </div>
            )}
          </div>

          <div className="pt-4 border-t border-border/50 w-full max-w-xl text-center">
            <p className="text-sm text-muted-foreground">
              <a 
                href="https://status.irisvision.ai" 
                target="_blank" 
                rel="noopener noreferrer"
                className="text-primary hover:underline"
              >
                Check latest status at status.irisvision.ai
              </a>
            </p>
          </div>

          {/* Subtle glow effect */}
          <div className="absolute -bottom-4 inset-x-0 h-6 bg-secondary/20 blur-xl rounded-full -z-10 opacity-70"></div>
        </div>
      </div>
    </section>
  );
}
