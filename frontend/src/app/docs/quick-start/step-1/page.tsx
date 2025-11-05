'use client';

import * as React from 'react';
import { 
  DocsHeader,
  DocsBody,
} from '@/components/ui/docs-index';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  MessageSquare,
  Bot,
  Info,
  ArrowRight,
  ArrowLeft,
} from 'lucide-react';
import Link from 'next/link';

const breadcrumbs = [
  { title: 'Documentation', onClick: () => window.location.href = '/docs' },
  { title: 'Quick Start Guide', onClick: () => window.location.href = '/docs/quick-start' },
  { title: 'Step 1: Your First Conversation' }
];

export default function Step1Page() {
  return (
    <>
      <DocsHeader
        title="Step 1: Your First Conversation"
        subtitle="Start by simply chatting with Iris"
        breadcrumbs={breadcrumbs}
        lastUpdated="January 2025"
        showSeparator
        size="lg"
        className="mb-8 sm:mb-12"
      />

      <DocsBody className="mb-8">
        <p className="mb-4">
          Start by simply chatting with Iris. Ask questions or request help with a task:
        </p>

        <div className="space-y-4 mb-6">
          <div className="bg-muted/50 p-4 rounded-lg border border-border">
            <div className="flex items-start gap-3">
              <div className="rounded-full bg-primary/10 p-2">
                <MessageSquare className="h-4 w-4 text-primary" />
              </div>
              <div className="flex-1">
                <p className="font-medium mb-1">You:</p>
                <p>"Hello! Can you help me understand what Iris can do?"</p>
              </div>
            </div>
          </div>

          <div className="bg-primary/5 p-4 rounded-lg border border-primary/20">
            <div className="flex items-start gap-3">
              <div className="rounded-full bg-primary p-2">
                <Bot className="h-4 w-4 text-primary-foreground" />
              </div>
              <div className="flex-1">
                <p className="font-medium mb-1">Iris:</p>
                <p>Iris will respond with an overview of capabilities and offer to help with specific tasks.</p>
              </div>
            </div>
          </div>
        </div>

        <Alert className="mb-6">
          <Info className="h-4 w-4" />
          <AlertDescription>
            <strong>Tip:</strong> Be conversational! Iris understands natural language, so ask questions just like you would ask a colleague.
          </AlertDescription>
        </Alert>

        <div className="mt-8 flex items-center justify-between">
          <Link 
            href="/docs/quick-start/welcome"
            className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" />
            Previous: Welcome
          </Link>
          <Link 
            href="/docs/quick-start/step-2"
            className="inline-flex items-center gap-2 text-primary hover:underline font-medium"
          >
            Next: Step 2 - Create Your First Document
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </DocsBody>
    </>
  );
}
