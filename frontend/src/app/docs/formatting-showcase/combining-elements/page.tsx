'use client';

import * as React from 'react';
import { 
  DocsHeader,
  DocsBody,
  DocsCard,
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
import { FileText, CheckCircle2, ArrowRight, ArrowLeft } from 'lucide-react';
import Link from 'next/link';

const breadcrumbs = [
  { title: 'Documentation', onClick: () => window.location.href = '/docs' },
  { title: 'Formatting Showcase', onClick: () => window.location.href = '/docs/formatting-showcase' },
  { title: 'Combining Elements' }
];

export default function CombiningElementsPage() {
  return (
    <>
      <DocsHeader
        title="Combining Elements"
        subtitle="Combine multiple formatting elements for rich, structured documents"
        breadcrumbs={breadcrumbs}
        lastUpdated="January 2025"
        showSeparator
        size="lg"
        className="mb-8 sm:mb-12"
      />

      <DocsBody className="mb-8">
        <p className="mb-4">
          Combine multiple formatting elements for rich, structured documents:
        </p>

        <DocsCard
          title="Complete Example"
          description="A document combining multiple formatting features"
          icon={FileText}
          variant="outline"
          className="mb-6"
        >
          <div className="space-y-4">
            <h3 className="text-lg font-semibold">Section Title</h3>
            <p>This paragraph contains <strong>bold text</strong>, <em>italic text</em>, and inline <code>code</code>.</p>
            
            <DocsBullets variant="default" spacing="tight">
              <DocsBulletItem icon={CheckCircle2}>First feature point</DocsBulletItem>
              <DocsBulletItem icon={CheckCircle2}>Second feature point</DocsBulletItem>
              <DocsBulletItem icon={CheckCircle2}>Third feature point</DocsBulletItem>
            </DocsBullets>

            <div className="mt-4">
              <CodeBlock 
                data={[{
                  language: "python",
                  filename: "example.py",
                  code: `def example():
    return "Combined formatting example"`
                }]}
                defaultValue="python"
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

            <blockquote className="border-l-4 border-border pl-4 italic text-muted-foreground mt-4">
              This is a blockquote within a card, showing how elements can be combined.
            </blockquote>
          </div>
        </DocsCard>
      </DocsBody>

      <div className="mt-8 flex items-center justify-between">
        <Link 
          href="/docs/formatting-showcase/cards"
          className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          Previous: Cards
        </Link>
        <Link 
          href="/docs/formatting-showcase/summary"
          className="inline-flex items-center gap-2 text-primary hover:underline font-medium"
        >
          Next: Summary
          <ArrowRight className="h-4 w-4" />
        </Link>
      </div>
    </>
  );
}
