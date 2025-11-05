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
  { title: 'Text Formatting' }
];

export default function TextFormattingPage() {
  return (
    <>
      <DocsHeader
        title="Text Formatting"
        subtitle="Enhance your text with various formatting options"
        breadcrumbs={breadcrumbs}
        lastUpdated="January 2025"
        showSeparator
        size="lg"
        className="mb-8 sm:mb-12"
      />

      <DocsBody className="mb-8">
        <p className="mb-4">
          Enhance your text with various formatting options:
        </p>

        <div className="space-y-3 mb-6">
          <p><strong>Bold text</strong> - Use double asterisks or double underscores</p>
          <p><em>Italic text</em> - Use single asterisks or single underscores</p>
          <p><u>Underlined text</u> - Use HTML underline tags</p>
          <p><s>Strikethrough text</s> - Use double tildes</p>
          <p>Inline <code>code</code> - Use backticks for code snippets</p>
          <p>This is a paragraph with <strong>bold</strong>, <em>italic</em>, and <code>code</code> formatting.</p>
        </div>

        <h3 className="mb-4">Code Example</h3>
        <div className="mb-6">
          <CodeBlock 
            data={[{
              language: "markdown",
              filename: "text-formatting.md",
              code: `**Bold text** or __Bold text__
*Italic text* or _Italic text_
<u>Underlined text</u>
~~Strikethrough text~~
\`inline code\`

Combine formats: **bold** and *italic* and \`code\``
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
          href="/docs/formatting-showcase/headings"
          className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          Previous: Headings
        </Link>
        <Link 
          href="/docs/formatting-showcase/lists"
          className="inline-flex items-center gap-2 text-primary hover:underline font-medium"
        >
          Next: Lists
          <ArrowRight className="h-4 w-4" />
        </Link>
      </div>
    </>
  );
}
