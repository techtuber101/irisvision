'use client';

import * as React from 'react';
import { 
  DocsHeader,
  DocsBody,
  DocsBullets,
  DocsBulletItem,
} from '@/components/ui/docs-index';
import type { BundledLanguage } from '@/components/ui/shadcn-io/code-block';
import {
  CodeBlock,
  CodeBlockBody,
  CodeBlockContent,
  CodeBlockItem,
} from '@/components/ui/shadcn-io/code-block';
import { CheckCircle2, ArrowRight, ArrowLeft } from 'lucide-react';
import Link from 'next/link';

const breadcrumbs = [
  { title: 'Documentation', onClick: () => window.location.href = '/docs' },
  { title: 'Formatting Showcase', onClick: () => window.location.href = '/docs/formatting-showcase' },
  { title: 'Lists' }
];

export default function ListsPage() {
  return (
    <>
      <DocsHeader
        title="Lists"
        subtitle="Create organized lists with bullets or numbers"
        breadcrumbs={breadcrumbs}
        lastUpdated="January 2025"
        showSeparator
        size="lg"
        className="mb-8 sm:mb-12"
      />

      <DocsBody className="mb-8">
        <p className="mb-4">
          Create organized lists with bullets or numbers:
        </p>

        <h3 className="mb-4">Unordered Lists</h3>
        <DocsBullets variant="default" spacing="default">
          <DocsBulletItem icon={CheckCircle2}>First item in unordered list</DocsBulletItem>
          <DocsBulletItem icon={CheckCircle2}>Second item with nested content</DocsBulletItem>
          <DocsBulletItem icon={CheckCircle2}>
            Third item
            <DocsBullets variant="default" spacing="tight" className="mt-2 ml-4">
              <DocsBulletItem>Nested item 1</DocsBulletItem>
              <DocsBulletItem>Nested item 2</DocsBulletItem>
            </DocsBullets>
          </DocsBulletItem>
        </DocsBullets>

        <h3 className="mb-4">Ordered Lists</h3>
        <ol className="list-decimal pl-6 mb-6 space-y-2">
          <li>First numbered item</li>
          <li>Second numbered item</li>
          <li>
            Third numbered item with nested list
            <ol className="list-decimal pl-6 mt-2 space-y-1">
              <li>Nested numbered item 1</li>
              <li>Nested numbered item 2</li>
            </ol>
          </li>
        </ol>

        <h3 className="mb-4">Code Example</h3>
        <div className="mb-6">
          <CodeBlock 
            data={[{
              language: "markdown",
              filename: "lists.md",
              code: `<!-- Unordered List -->
- First item
- Second item
  - Nested item
  - Another nested item
- Third item

<!-- Ordered List -->
1. First item
2. Second item
   1. Nested item
   2. Another nested item
3. Third item`
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
          href="/docs/formatting-showcase/text-formatting"
          className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          Previous: Text Formatting
        </Link>
        <Link 
          href="/docs/formatting-showcase/code-blocks"
          className="inline-flex items-center gap-2 text-primary hover:underline font-medium"
        >
          Next: Code Blocks
          <ArrowRight className="h-4 w-4" />
        </Link>
      </div>
    </>
  );
}
