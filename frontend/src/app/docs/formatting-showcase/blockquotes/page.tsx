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
  { title: 'Blockquotes' }
];

export default function BlockquotesPage() {
  return (
    <>
      <DocsHeader
        title="Blockquotes"
        subtitle="Highlight important information with blockquotes"
        breadcrumbs={breadcrumbs}
        lastUpdated="January 2025"
        showSeparator
        size="lg"
        className="mb-8 sm:mb-12"
      />

      <DocsBody className="mb-8">
        <p className="mb-4">
          Highlight important information with blockquotes:
        </p>

        <blockquote className="border-l-4 border-border pl-4 italic text-muted-foreground mb-6">
          This is a blockquote. Use it to highlight important information, quotes, or callouts in your documents.
        </blockquote>

        <h3 className="mb-4">Code Example</h3>
        <div className="mb-6">
          <CodeBlock 
            data={[{
              language: "markdown",
              filename: "blockquote.md",
              code: `> This is a blockquote. Use it to highlight important information, quotes, or callouts in your documents.`
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
          href="/docs/formatting-showcase/links"
          className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          Previous: Links
        </Link>
        <Link 
          href="/docs/formatting-showcase/alerts"
          className="inline-flex items-center gap-2 text-primary hover:underline font-medium"
        >
          Next: Alerts & Callouts
          <ArrowRight className="h-4 w-4" />
        </Link>
      </div>
    </>
  );
}
