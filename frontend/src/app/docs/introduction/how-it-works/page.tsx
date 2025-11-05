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
  { title: 'How It Works' }
];

export default function HowItWorksPage() {
  return (
    <>
      <DocsHeader
        title="How It Works"
        subtitle="The four main pieces of Iris"
        breadcrumbs={breadcrumbs}
        lastUpdated="August 2025"
        showSeparator
        size="lg"
        className="mb-8 sm:mb-12"
      />

      <DocsBody className="mb-8">
        <p className="mb-4">Iris gives you four main pieces:</p>
        <ul className="list-disc pl-6 mb-6 space-y-2">
          <li><strong>Backend API</strong> - Handles the heavy lifting: talking to AI models, managing tasks, storing data</li>
          <li><strong>Web Dashboard</strong> - Where you build, test, and monitor your agents</li>
          <li><strong>Secure Runtime</strong> - Isolated environments where your agents run safely</li>
          <li><strong>Database</strong> - Stores your agent configs, conversation history, and results</li>
        </ul>
      </DocsBody>

      <div className="mt-8 flex items-center justify-between">
        <Link 
          href="/docs/introduction/build-your-own"
          className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          Previous: Build Your Own Agents
        </Link>
        <Link 
          href="/docs/introduction/why-iris"
          className="inline-flex items-center gap-2 text-primary hover:underline font-medium"
        >
          Next: Why Iris?
          <ArrowRight className="h-4 w-4" />
        </Link>
      </div>
    </>
  );
}
