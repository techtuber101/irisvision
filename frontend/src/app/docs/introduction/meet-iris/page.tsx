'use client';

import * as React from 'react';
import { 
  DocsHeader,
  DocsBody,
} from '@/components/ui/docs-index';
import { ArrowRight, ArrowLeft } from 'lucide-react';
import Link from 'next/link';

const breadcrumbs = [
  { title: 'Documentation', onClick: () => window.location.href = '/docs' },
  { title: 'What is Iris?', onClick: () => window.location.href = '/docs/introduction' },
  { title: 'Meet Iris' }
];

export default function MeetIrisPage() {
  return (
    <>
      <DocsHeader
        title="Iris - Our Flagship Agent"
        subtitle="Meet Iris, our showcase agent"
        breadcrumbs={breadcrumbs}
        lastUpdated="August 2025"
        showSeparator
        size="lg"
        className="mb-8 sm:mb-12"
      />

      <DocsBody className="mb-8">
        <p className="mb-4">
          Iris is our showcase agent that demonstrates what's possible with Iris. It's a generalist AI worker that can:
        </p>
        <ul className="list-disc pl-6 mb-6 space-y-1">
          <li>Research topics and gather information from across the web</li>
          <li>Analyze documents and data files</li>
          <li>Automate browser tasks and web scraping</li>
          <li>Manage files and handle document processing</li>
          <li>Execute complex multi-step workflows</li>
        </ul>
        <p className="mb-6">
          Iris demonstrates what's possible with the Iris platform. It's a generalist AI worker that shows you what you can build.
        </p>
      </DocsBody>

      <div className="mt-8 flex items-center justify-between">
        <Link 
          href="/docs/introduction/overview"
          className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          Previous: Overview
        </Link>
        <Link 
          href="/docs/introduction/build-your-own"
          className="inline-flex items-center gap-2 text-primary hover:underline font-medium"
        >
          Next: Build Your Own Agents
          <ArrowRight className="h-4 w-4" />
        </Link>
      </div>
    </>
  );
}
