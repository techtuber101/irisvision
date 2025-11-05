'use client';

import * as React from 'react';
import { 
  DocsHeader,
  DocsBody,
} from '@/components/ui/docs-index';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Info, ArrowRight, ArrowLeft } from 'lucide-react';
import Link from 'next/link';

const breadcrumbs = [
  { title: 'Documentation', onClick: () => window.location.href = '/docs' },
  { title: 'Formatting Showcase', onClick: () => window.location.href = '/docs/formatting-showcase' },
  { title: 'Overview' }
];

export default function OverviewPage() {
  return (
    <>
      <DocsHeader
        title="Formatting Features Overview"
        subtitle="Discover all the formatting features and components available in Iris documentation"
        breadcrumbs={breadcrumbs}
        lastUpdated="January 2025"
        showSeparator
        size="lg"
        className="mb-8 sm:mb-12"
      />

      <DocsBody className="mb-8">
        <p className="text-lg mb-6">
          This guide demonstrates all the formatting options and components available when creating documents with Iris. Each section shows examples of how to use different formatting features.
        </p>
        
        <Alert className="mb-6">
          <Info className="h-4 w-4" />
          <AlertDescription>
            <strong>Documentation System:</strong> Iris uses <strong>shadcn/ui</strong> components built on <strong>Radix UI</strong> and <strong>Tailwind CSS</strong>, with <strong>Shiki</strong> for code syntax highlighting.
          </AlertDescription>
        </Alert>
      </DocsBody>

      <div className="mt-8">
        <Link 
          href="/docs/formatting-showcase/headings"
          className="inline-flex items-center gap-2 text-primary hover:underline font-medium"
        >
          Continue to: Headings
          <ArrowRight className="h-4 w-4" />
        </Link>
      </div>
    </>
  );
}
