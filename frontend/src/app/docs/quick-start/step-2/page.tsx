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
  CheckCircle2,
  ArrowRight,
  ArrowLeft,
} from 'lucide-react';
import Link from 'next/link';

const breadcrumbs = [
  { title: 'Documentation', onClick: () => window.location.href = '/docs' },
  { title: 'Quick Start Guide', onClick: () => window.location.href = '/docs/quick-start' },
  { title: 'Step 2: Create Your First Document' }
];

export default function Step2Page() {
  return (
    <>
      <DocsHeader
        title="Step 2: Create Your First Document"
        subtitle="Ask Iris to create a document"
        breadcrumbs={breadcrumbs}
        lastUpdated="January 2025"
        showSeparator
        size="lg"
        className="mb-8 sm:mb-12"
      />

      <DocsBody className="mb-8">
        <p className="mb-4">
          Ask Iris to create a document. This demonstrates file creation and formatting capabilities:
        </p>

        <div className="mb-6">
          <CodeBlock 
            data={[{
              language: "markdown",
              filename: "example-request.md",
              code: `"Create a document called 'my-first-doc.md' with:
- A title: 'My First Document'
- Three sections about:
  1. What I learned today
  2. Questions I have
  3. Next steps
- Use formatting like bold text and lists"`
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
          Iris will create a beautifully formatted document with all the requested elements. You can then:
        </p>
        <DocsBullets variant="default" spacing="tight">
          <DocsBulletItem icon={CheckCircle2}>View the document in the chat</DocsBulletItem>
          <DocsBulletItem icon={CheckCircle2}>Edit it by asking Iris to make changes</DocsBulletItem>
          <DocsBulletItem icon={CheckCircle2}>Download or share it</DocsBulletItem>
        </DocsBullets>

        <div className="mt-8 flex items-center justify-between">
          <Link 
            href="/docs/quick-start/step-1"
            className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" />
            Previous: Step 1
          </Link>
          <Link 
            href="/docs/quick-start/step-3"
            className="inline-flex items-center gap-2 text-primary hover:underline font-medium"
          >
            Next: Step 3 - Search the Web
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </DocsBody>
    </>
  );
}
