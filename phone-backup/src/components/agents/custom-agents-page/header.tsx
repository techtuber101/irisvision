'use client';

import React from 'react';
import { Ripple } from '@/components/ui/ripple';

export const AgentsPageHeader = () => {
  return (
    <div className="relative overflow-hidden rounded-3xl flex items-center justify-center border bg-background">
      <div className="relative px-8 py-16 text-center">
        <div className="mx-auto max-w-3xl space-y-6">
          <div className="inline-flex items-center justify-center rounded-full bg-muted p-3">
            <span className="text-2xl">✨</span>
          </div>
          <h1 className="text-4xl font-semibold tracking-tight text-foreground">
            <div className="space-y-4">
              <div className="text-4xl font-semibold tracking-tight">
                <span className="text-primary">Personalities</span>
              </div>
            </div>
          </h1>
        </div>
      </div>
      <Ripple/>
    </div>
  );
};
