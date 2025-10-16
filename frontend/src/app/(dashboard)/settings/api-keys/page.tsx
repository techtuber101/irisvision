'use client';

import React from 'react';
import { Shield, Lock } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export default function APIKeysPage() {
  return (
    <div className="container mx-auto max-w-4xl px-6 py-6">
      <div className="space-y-6">
        <div className="space-y-2">
          <div className="flex items-center gap-3">
            <Shield className="w-6 h-6 text-destructive" />
            <h1 className="text-2xl font-bold">Access Denied</h1>
          </div>
          <p className="text-muted-foreground">
            This page is not accessible for security reasons.
          </p>
        </div>

        <Card className="border-destructive/20 bg-destructive/5">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-destructive">
              <Lock className="w-5 h-5" />
              API Keys Management Disabled
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-muted-foreground">
              API key management has been disabled for security purposes. This page is not accessible to prevent unauthorized access to sensitive API credentials.
            </p>
            <div className="rounded-lg bg-muted/50 p-4">
              <p className="text-sm text-muted-foreground">
                <strong>Security Notice:</strong> Direct access to API key management has been restricted to protect your account and prevent potential security breaches.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}