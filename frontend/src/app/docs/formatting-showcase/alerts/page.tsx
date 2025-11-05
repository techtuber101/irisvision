'use client';

import * as React from 'react';
import { 
  DocsHeader,
  DocsBody,
} from '@/components/ui/docs-index';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Info, CheckCircle2, ArrowRight, ArrowLeft } from 'lucide-react';
import Link from 'next/link';

const breadcrumbs = [
  { title: 'Documentation', onClick: () => window.location.href = '/docs' },
  { title: 'Formatting Showcase', onClick: () => window.location.href = '/docs/formatting-showcase' },
  { title: 'Alerts & Callouts' }
];

export default function AlertsPage() {
  return (
    <>
      <DocsHeader
        title="Alerts & Callouts"
        subtitle="Use alerts to draw attention to important information"
        breadcrumbs={breadcrumbs}
        lastUpdated="January 2025"
        showSeparator
        size="lg"
        className="mb-8 sm:mb-12"
      />

      <DocsBody className="mb-8">
        <p className="mb-4">
          Use alerts to draw attention to important information:
        </p>

        <Alert className="mb-4">
          <Info className="h-4 w-4" />
          <AlertDescription>
            <strong>Info Alert:</strong> This is an informational alert. Use it to provide helpful tips or context.
          </AlertDescription>
        </Alert>

        <Alert className="mb-4" variant="default">
          <CheckCircle2 className="h-4 w-4" />
          <AlertDescription>
            <strong>Success Alert:</strong> This indicates a successful operation or completion.
          </AlertDescription>
        </Alert>

        <Alert className="mb-6" variant="destructive">
          <Info className="h-4 w-4" />
          <AlertDescription>
            <strong>Warning Alert:</strong> This is a warning or error message. Use it sparingly for important warnings.
          </AlertDescription>
        </Alert>
      </DocsBody>

      <div className="mt-8 flex items-center justify-between">
        <Link 
          href="/docs/formatting-showcase/blockquotes"
          className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          Previous: Blockquotes
        </Link>
        <Link 
          href="/docs/formatting-showcase/cards"
          className="inline-flex items-center gap-2 text-primary hover:underline font-medium"
        >
          Next: Cards
          <ArrowRight className="h-4 w-4" />
        </Link>
      </div>
    </>
  );
}
