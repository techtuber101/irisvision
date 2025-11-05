'use client';

import * as React from 'react';
import { 
  DocsHeader,
  DocsBody,
  DocsTable,
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
  { title: 'Tables' }
];

export default function TablesPage() {
  return (
    <>
      <DocsHeader
        title="Tables"
        subtitle="Create structured data tables with multiple columns"
        breadcrumbs={breadcrumbs}
        lastUpdated="January 2025"
        showSeparator
        size="lg"
        className="mb-8 sm:mb-12"
      />

      <DocsBody className="mb-8">
        <p className="mb-4">
          Create structured data tables with multiple columns:
        </p>

        <h3 className="mb-4">Basic Table</h3>
        <DocsTable
          columns={[
            { key: 'feature', title: 'Feature', width: '200px' },
            { key: 'description', title: 'Description' },
            { key: 'status', title: 'Status', width: '100px', align: 'center' },
          ]}
          data={[
            {
              feature: 'Web Search',
              description: 'Search the internet for information',
              status: '✅ Available'
            },
            {
              feature: 'File Management',
              description: 'Create and edit files',
              status: '✅ Available'
            },
            {
              feature: 'Browser Automation',
              description: 'Navigate and interact with websites',
              status: '✅ Available'
            },
            {
              feature: 'API Integrations',
              description: 'Connect with external services',
              status: '✅ Available'
            },
          ]}
          variant="default"
          size="default"
        />

        <h3 className="mb-4 mt-6">Complex Table</h3>
        <DocsTable
          columns={[
            { key: 'tool', title: 'Tool', width: '150px' },
            { key: 'category', title: 'Category', width: '150px' },
            { key: 'capabilities', title: 'Capabilities' },
            { key: 'example', title: 'Example Usage', width: '200px' },
          ]}
          data={[
            {
              tool: 'sb_files_tool',
              category: 'File Operations',
              capabilities: 'Create, read, edit, delete files and directories',
              example: 'Create a Python script'
            },
            {
              tool: 'web_search_tool',
              category: 'Research',
              capabilities: 'Search web, images, people, companies',
              example: 'Search for AI trends'
            },
            {
              tool: 'browser_tool',
              category: 'Automation',
              capabilities: 'Navigate websites, extract data, fill forms',
              example: 'Scrape product prices'
            },
          ]}
          variant="default"
          size="default"
        />

        <h3 className="mb-4 mt-6">Code Example</h3>
        <div className="mb-6">
          <CodeBlock 
            data={[{
              language: "markdown",
              filename: "table.md",
              code: `| Feature | Description | Status |
|---------|-------------|--------|
| Web Search | Search the internet | ✅ Available |
| File Management | Create and edit files | ✅ Available |
| Browser Automation | Navigate websites | ✅ Available |`
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
          href="/docs/formatting-showcase/code-blocks"
          className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          Previous: Code Blocks
        </Link>
        <Link 
          href="/docs/formatting-showcase/links"
          className="inline-flex items-center gap-2 text-primary hover:underline font-medium"
        >
          Next: Links
          <ArrowRight className="h-4 w-4" />
        </Link>
      </div>
    </>
  );
}
