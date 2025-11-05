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
import { 
  Zap,
  ArrowRight,
  ArrowLeft,
} from 'lucide-react';
import Link from 'next/link';

const breadcrumbs = [
  { title: 'Documentation', onClick: () => window.location.href = '/docs' },
  { title: 'Quick Start Guide', onClick: () => window.location.href = '/docs/quick-start' },
  { title: 'Step 4: Try a Multi-Step Task' }
];

export default function Step4Page() {
  return (
    <>
      <DocsHeader
        title="Step 4: Try a Multi-Step Task"
        subtitle="Ask Iris to complete a task that involves multiple steps"
        breadcrumbs={breadcrumbs}
        lastUpdated="January 2025"
        showSeparator
        size="lg"
        className="mb-8 sm:mb-12"
      />

      <DocsBody className="mb-8">
        <p className="mb-4">
          Ask Iris to complete a task that involves multiple steps:
        </p>

        <div className="mb-6">
          <CodeBlock 
            data={[{
              language: "markdown",
              filename: "multistep-example.md",
              code: `"I need to research Python decorators. Please:
1. Search for information about Python decorators
2. Create a document explaining what they are
3. Include code examples showing basic usage
4. Add a table comparing different decorator patterns"`
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

        <p className="mb-4">
          This demonstrates Iris's ability to:
        </p>
        <DocsBullets variant="default" spacing="tight">
          <DocsBulletItem icon={Zap}>Break down complex tasks into steps</DocsBulletItem>
          <DocsBulletItem icon={Zap}>Use multiple tools in sequence</DocsBulletItem>
          <DocsBulletItem icon={Zap}>Create comprehensive results</DocsBulletItem>
        </DocsBullets>

        <div className="mt-8 flex items-center justify-between">
          <Link 
            href="/docs/quick-start/step-3"
            className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" />
            Previous: Step 3
          </Link>
          <Link 
            href="/docs/quick-start/step-5"
            className="inline-flex items-center gap-2 text-primary hover:underline font-medium"
          >
            Next: Step 5 - Explore Advanced Features
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </DocsBody>
    </>
  );
}
