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
import { ArrowRight, ArrowLeft } from 'lucide-react';
import Link from 'next/link';

const breadcrumbs = [
  { title: 'Documentation', onClick: () => window.location.href = '/docs' },
  { title: 'Formatting Showcase', onClick: () => window.location.href = '/docs/formatting-showcase' },
  { title: 'Links' }
];

export default function LinksPage() {
  return (
    <>
      <DocsHeader
        title="Links"
        subtitle="Add hyperlinks to external resources"
        breadcrumbs={breadcrumbs}
        lastUpdated="January 2025"
        showSeparator
        size="lg"
        className="mb-8 sm:mb-12"
      />

      <DocsBody className="mb-8">
        <p className="mb-4">
          Add hyperlinks to external resources:
        </p>

        <div className="space-y-2 mb-6">
          <p>
            <a href="https://irisvision.ai" target="_blank" rel="noopener noreferrer">Visit Iris Website</a> - External link with target="_blank"
          </p>
          <p>
            <a href="/docs/introduction">Introduction Page</a> - Internal link to another docs page
          </p>
          <p>
            <a href="https://irisvision.ai/dashboard">Dashboard</a> - Link to Iris dashboard
          </p>
        </div>

        <h3 className="mb-4">Code Example</h3>
        <div className="mb-6">
          <CodeBlock 
            data={[{
              language: "markdown",
              filename: "links.md",
              code: `[Visit Iris Website](https://irisvision.ai)
[Introduction Page](/docs/introduction)
[Dashboard](https://irisvision.ai/dashboard)`
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
      </DocsBody>

      <div className="mt-8 flex items-center justify-between">
        <Link 
          href="/docs/formatting-showcase/tables"
          className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          Previous: Tables
        </Link>
        <Link 
          href="/docs/formatting-showcase/blockquotes"
          className="inline-flex items-center gap-2 text-primary hover:underline font-medium"
        >
          Next: Blockquotes
          <ArrowRight className="h-4 w-4" />
        </Link>
      </div>
    </>
  );
}
