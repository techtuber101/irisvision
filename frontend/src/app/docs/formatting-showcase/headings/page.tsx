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
  { title: 'Headings' }
];

export default function HeadingsPage() {
  return (
    <>
      <DocsHeader
        title="Headings"
        subtitle="Structure your documents with headings"
        breadcrumbs={breadcrumbs}
        lastUpdated="January 2025"
        showSeparator
        size="lg"
        className="mb-8 sm:mb-12"
      />

      <DocsBody className="mb-8">
        <p className="mb-4">
          Use headings to structure your documents. Iris supports multiple heading levels:
        </p>

        <div className="space-y-2 mb-6">
          <h1>Heading 1 - Main Title</h1>
          <h2>Heading 2 - Section Title</h2>
          <h3>Heading 3 - Subsection</h3>
          <h4>Heading 4 - Minor Section</h4>
          <h5>Heading 5 - Sub-subsection</h5>
          <h6>Heading 6 - Smallest Heading</h6>
        </div>

        <h3 className="mb-4">Code Example</h3>
        <div className="mb-6">
          <CodeBlock 
            data={[{
              language: "markdown",
              filename: "headings.md",
              code: `# Heading 1
## Heading 2
### Heading 3
#### Heading 4
##### Heading 5
###### Heading 6`
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
          href="/docs/formatting-showcase/overview"
          className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          Previous: Overview
        </Link>
        <Link 
          href="/docs/formatting-showcase/text-formatting"
          className="inline-flex items-center gap-2 text-primary hover:underline font-medium"
        >
          Next: Text Formatting
          <ArrowRight className="h-4 w-4" />
        </Link>
      </div>
    </>
  );
}
