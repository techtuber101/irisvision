'use client';

import * as React from 'react';
import { 
  DocsHeader,
  DocsBody,
  DocsCard,
} from '@/components/ui/docs-index';
import { FileText, Code, ArrowRight, ArrowLeft } from 'lucide-react';
import Link from 'next/link';

const breadcrumbs = [
  { title: 'Documentation', onClick: () => window.location.href = '/docs' },
  { title: 'Formatting Showcase', onClick: () => window.location.href = '/docs/formatting-showcase' },
  { title: 'Cards' }
];

export default function CardsPage() {
  return (
    <>
      <DocsHeader
        title="Cards"
        subtitle="Use cards to organize related information"
        breadcrumbs={breadcrumbs}
        lastUpdated="January 2025"
        showSeparator
        size="lg"
        className="mb-8 sm:mb-12"
      />

      <DocsBody className="mb-8">
        <p className="mb-4">
          Use cards to organize related information:
        </p>

        <div className="grid md:grid-cols-2 gap-4 mb-6">
          <DocsCard
            title="Feature Card"
            description="This is a feature card with an icon and description"
            icon={FileText}
            variant="outline"
            hover
          />

          <DocsCard
            title="Another Card"
            description="Cards can be used to highlight features, tips, or related content"
            icon={Code}
            variant="default"
            hover
          />
        </div>
      </DocsBody>

      <div className="mt-8 flex items-center justify-between">
        <Link 
          href="/docs/formatting-showcase/alerts"
          className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          Previous: Alerts & Callouts
        </Link>
        <Link 
          href="/docs/formatting-showcase/combining-elements"
          className="inline-flex items-center gap-2 text-primary hover:underline font-medium"
        >
          Next: Combining Elements
          <ArrowRight className="h-4 w-4" />
        </Link>
      </div>
    </>
  );
}
