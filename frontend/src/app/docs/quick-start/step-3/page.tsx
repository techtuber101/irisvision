'use client';

import * as React from 'react';
import { 
  DocsHeader,
  DocsBody,
} from '@/components/ui/docs-index';
import type { BundledLanguage } from '@/components/ui/shadcn-io/code-block';
import {
  CodeBlock,
  CodeBlockBody,
  CodeBlockContent,
  CodeBlockItem,
} from '@/components/ui/shadcn-io/code-block';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  Search,
  ArrowRight,
  ArrowLeft,
} from 'lucide-react';
import Link from 'next/link';

const breadcrumbs = [
  { title: 'Documentation', onClick: () => window.location.href = '/docs' },
  { title: 'Quick Start Guide', onClick: () => window.location.href = '/docs/quick-start' },
  { title: 'Step 3: Search the Web' }
];

export default function Step3Page() {
  return (
    <>
      <DocsHeader
        title="Step 3: Search the Web"
        subtitle="Ask Iris to search for information"
        breadcrumbs={breadcrumbs}
        lastUpdated="January 2025"
        showSeparator
        size="lg"
        className="mb-8 sm:mb-12"
      />

      <DocsBody className="mb-8">
        <p className="mb-4">
          Ask Iris to search for information. This demonstrates web search capabilities:
        </p>

        <div className="mb-6">
          <CodeBlock 
            data={[{
              language: "markdown",
              filename: "search-example.md",
              code: `"Search for the latest developments in AI agents and 
create a summary of the top 3 findings"`

            }]}
            defaultValue="markdown"
          >
            <CodeBlockBody>
              {(item) => (
                <CodeBlockItem key={item.language} value={item.language}>
                  <CodeBlockContent language={item.language as BundledLanguage}>
                    {item.code}
                  </CodeBlockContent>
                </CodeBlockItem>
              )}
            </CodeBlockBody>
          </CodeBlock>
        </div>

        <Alert className="mb-6">
          <Search className="h-4 w-4" />
          <AlertDescription>
            <strong>Pro Tip:</strong> You can ask Iris to search for specific information, compare sources, or even create reports based on web research.
          </AlertDescription>
        </Alert>

        <div className="mt-8 flex items-center justify-between">
          <Link 
            href="/docs/quick-start/step-2"
            className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" />
            Previous: Step 2
          </Link>
          <Link 
            href="/docs/quick-start/step-4"
            className="inline-flex items-center gap-2 text-primary hover:underline font-medium"
          >
            Next: Step 4 - Try a Multi-Step Task
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </DocsBody>
    </>
  );
}
