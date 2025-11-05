'use client';

import * as React from 'react';
import { 
  DocsHeader,
  DocsBody,
  DocsTable,
} from '@/components/ui/docs-index';
import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';

const breadcrumbs = [
  { title: 'Documentation', onClick: () => window.location.href = '/docs' },
  { title: 'Formatting Showcase', onClick: () => window.location.href = '/docs/formatting-showcase' },
  { title: 'Summary' }
];

export default function SummaryPage() {
  return (
    <>
      <DocsHeader
        title="Summary"
        subtitle="Formatting guide summary"
        breadcrumbs={breadcrumbs}
        lastUpdated="January 2025"
        showSeparator
        size="lg"
        className="mb-8 sm:mb-12"
      />

      <DocsBody className="mb-8">
        <p className="mb-4">
          You now know all the formatting options available in Iris documentation:
        </p>

        <DocsTable
          columns={[
            { key: 'element', title: 'Element', width: '150px' },
            { key: 'description', title: 'Description' },
            { key: 'usage', title: 'Usage' },
          ]}
          data={[
            {
              element: 'Headings',
              description: 'Structure documents with H1-H6',
              usage: '# Heading 1, ## Heading 2'
            },
            {
              element: 'Text Formatting',
              description: 'Bold, italic, underline, strikethrough, code',
              usage: '**bold**, *italic*, `code`'
            },
            {
              element: 'Lists',
              description: 'Ordered and unordered lists',
              usage: '- Item or 1. Item'
            },
            {
              element: 'Code Blocks',
              description: 'Syntax-highlighted code',
              usage: '```language\ncode\n```'
            },
            {
              element: 'Tables',
              description: 'Structured data tables',
              usage: '| Column | Column |'
            },
            {
              element: 'Links',
              description: 'Hyperlinks to resources',
              usage: '[text](url)'
            },
            {
              element: 'Blockquotes',
              description: 'Highlighted quotes',
              usage: '> Quote text'
            },
            {
              element: 'Alerts',
              description: 'Important callouts',
              usage: 'Component-based alerts'
            },
            {
              element: 'Cards',
              description: 'Organized content blocks',
              usage: 'Component-based cards'
            },
          ]}
          variant="default"
          size="default"
        />
      </DocsBody>

      <div className="mt-8">
        <Link 
          href="/docs/formatting-showcase/combining-elements"
          className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          Previous: Combining Elements
        </Link>
      </div>
    </>
  );
}
