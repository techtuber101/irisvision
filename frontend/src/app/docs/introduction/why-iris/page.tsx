'use client';

import * as React from 'react';
import { 
  DocsHeader,
  DocsBody,
} from '@/components/ui/docs-index';
import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';

const breadcrumbs = [
  { title: 'Documentation', onClick: () => window.location.href = '/docs' },
  { title: 'What is Iris?', onClick: () => window.location.href = '/docs/introduction' },
  { title: 'Why Iris?' }
];

export default function WhyIrisPage() {
  return (
    <>
      <DocsHeader
        title="Why Iris?"
        subtitle="Own your agents and your data"
        breadcrumbs={breadcrumbs}
        lastUpdated="August 2025"
        showSeparator
        size="lg"
        className="mb-8 sm:mb-12"
      />

      <DocsBody className="mb-8">
        <p className="mb-6">
          We believe you should own your agents and your data. No vendor lock-in, no usage limits based on monthly fees, no mysterious black boxes. You can see exactly how everything works, modify it for your needs, and run it wherever you want.
        </p>
      </DocsBody>

      <div className="mt-8">
        <Link 
          href="/docs/introduction/how-it-works"
          className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          Previous: How It Works
        </Link>
      </div>
    </>
  );
}
