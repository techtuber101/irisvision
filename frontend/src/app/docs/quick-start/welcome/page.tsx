'use client';

import * as React from 'react';
import { 
  DocsHeader,
  DocsBody,
} from '@/components/ui/docs-index';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  Rocket,
  ArrowRight,
} from 'lucide-react';
import Link from 'next/link';

const breadcrumbs = [
  { title: 'Documentation', onClick: () => window.location.href = '/docs' },
  { title: 'Quick Start Guide', onClick: () => window.location.href = '/docs/quick-start' },
  { title: 'Welcome to Iris!' }
];

export default function WelcomePage() {
  return (
    <>
      <DocsHeader
        title="Welcome to Iris!"
        subtitle="Get started with Iris in 5 minutes - your first AI agent tasks"
        breadcrumbs={breadcrumbs}
        lastUpdated="January 2025"
        showSeparator
        size="lg"
        className="mb-8 sm:mb-12"
      />

      <DocsBody className="mb-8">
        <p className="text-lg mb-6">
          This quick start guide will help you complete your first tasks with Iris in just a few minutes. By the end, you'll understand how to interact with Iris and accomplish real work.
        </p>

        <Alert className="mb-6">
          <Rocket className="h-4 w-4" />
          <AlertDescription>
            <strong>Ready to start?</strong> Follow along with these examples to see Iris in action!
          </AlertDescription>
        </Alert>

        <div className="mt-8">
          <Link 
            href="/docs/quick-start/step-1"
            className="inline-flex items-center gap-2 text-primary hover:underline font-medium"
          >
            Continue to Step 1: Your First Conversation
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </DocsBody>
    </>
  );
}
