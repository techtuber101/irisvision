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
  { title: 'Build Your Own Agents' }
];

export default function BuildYourOwnPage() {
  return (
    <>
      <DocsHeader
        title="Build Your Own Agents"
        subtitle="Create agents for your specific needs"
        breadcrumbs={breadcrumbs}
        lastUpdated="August 2025"
        showSeparator
        size="lg"
        className="mb-8 sm:mb-12"
      />

      <DocsBody className="mb-8">
        <p className="mb-6">
          The real power comes when you create agents for your specific needs. Maybe you need an agent that monitors customer support tickets, or one that processes invoices, or handles your social media posting schedule. With Iris, you get the building blocks to create agents that work exactly how you want them to.
        </p>
      </DocsBody>

      <div className="mt-8 flex items-center justify-between">
        <Link 
          href="/docs/introduction/meet-iris"
          className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          Previous: Meet Iris
        </Link>
        <Link 
          href="/docs/introduction/how-it-works"
          className="inline-flex items-center gap-2 text-primary hover:underline font-medium"
        >
          Next: How It Works
          <ArrowRight className="h-4 w-4" />
        </Link>
      </div>
    </>
  );
}
