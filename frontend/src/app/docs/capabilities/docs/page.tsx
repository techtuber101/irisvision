'use client';

import * as React from 'react';
import { 
  DocsHeader,
  DocsCard,
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
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  FileText,
  BookOpen,
  Lightbulb,
  CheckCircle2,
  Info,
  Edit,
} from 'lucide-react';
import { Separator } from '@/components/ui/separator';

const breadcrumbs = [
  { title: 'Documentation', onClick: () => window.location.href = '/docs' },
  { title: 'Iris Capabilities', onClick: () => window.location.href = '/docs' },
  { title: 'Docs' }
];

export default function DocsPage() {
  return (
    <>
      <DocsHeader
        title="Docs"
        subtitle="Create beautifully formatted documents with Iris's comprehensive document creation capabilities"
        breadcrumbs={breadcrumbs}
        lastUpdated="January 2025"
        showSeparator
        size="lg"
        className="mb-8 sm:mb-12"
      />

      <DocsBody className="mb-8">
        <p className="text-lg mb-6">
          Iris transforms your ideas into polished, professional documents that communicate effectively. With support for rich formatting, structured layouts, and multiple content types, Iris helps you create documents that look like they were crafted by a professional writer and designer. Whether you're drafting reports, writing documentation, creating guides, or composing any written content, Iris ensures your documents are clear, well-organized, and visually appealing.
        </p>

        <Alert className="mb-6">
          <Info className="h-4 w-4" />
          <AlertDescription>
            <strong>Professional Formatting:</strong> Every document Iris creates follows professional formatting standards, ensuring consistency and readability.
          </AlertDescription>
        </Alert>
      </DocsBody>

      <Separator className="my-8" />

      <DocsBody className="mb-8">
        <h2>Document Creation Features</h2>
        <p className="mb-6">
          Iris offers comprehensive document creation capabilities that cover everything from basic text to complex structured documents with multiple content types.
        </p>

        <div className="grid md:grid-cols-2 gap-6 mb-8">
          <DocsCard
            title="Rich Formatting"
            description="Create documents with professional formatting options"
            icon={Edit}
            variant="outline"
            hover
            className="h-full"
          >
            <DocsBullets variant="default" spacing="tight">
              <DocsBulletItem icon={CheckCircle2}>Headings and subheadings</DocsBulletItem>
              <DocsBulletItem icon={CheckCircle2}>Bold, italic, and emphasis</DocsBulletItem>
              <DocsBulletItem icon={CheckCircle2}>Lists and numbered items</DocsBulletItem>
              <DocsBulletItem icon={CheckCircle2}>Code blocks and syntax highlighting</DocsBulletItem>
            </DocsBullets>
          </DocsCard>

          <DocsCard
            title="Structured Content"
            description="Organize information with tables, sections, and layouts"
            icon={FileText}
            variant="outline"
            hover
            className="h-full"
          >
            <DocsBullets variant="default" spacing="tight">
              <DocsBulletItem icon={CheckCircle2}>Tables and data organization</DocsBulletItem>
              <DocsBulletItem icon={CheckCircle2}>Blockquotes and callouts</DocsBulletItem>
              <DocsBulletItem icon={CheckCircle2}>Links and references</DocsBulletItem>
              <DocsBulletItem icon={CheckCircle2}>Image embedding</DocsBulletItem>
            </DocsBullets>
          </DocsCard>

          <DocsCard
            title="Multiple Formats"
            description="Create documents in various formats"
            icon={BookOpen}
            variant="outline"
            hover
            className="h-full"
          >
            <DocsBullets variant="default" spacing="tight">
              <DocsBulletItem icon={CheckCircle2}>Markdown documents</DocsBulletItem>
              <DocsBulletItem icon={CheckCircle2}>HTML documents</DocsBulletItem>
              <DocsBulletItem icon={CheckCircle2}>Plain text files</DocsBulletItem>
              <DocsBulletItem icon={CheckCircle2}>Formatted reports</DocsBulletItem>
            </DocsBullets>
          </DocsCard>

          <DocsCard
            title="Easy Editing"
            description="Modify and refine documents iteratively"
            icon={Edit}
            variant="outline"
            hover
            className="h-full"
          >
            <DocsBullets variant="default" spacing="tight">
              <DocsBulletItem icon={CheckCircle2}>Edit existing documents</DocsBulletItem>
              <DocsBulletItem icon={CheckCircle2}>Add or remove sections</DocsBulletItem>
              <DocsBulletItem icon={CheckCircle2}>Revise and improve content</DocsBulletItem>
              <DocsBulletItem icon={CheckCircle2}>Reformat and restructure</DocsBulletItem>
            </DocsBullets>
          </DocsCard>
        </div>
      </DocsBody>

      <Separator className="my-8" />

      <DocsBody className="mb-8">
        <h2>How to Create Documents</h2>
        <p className="mb-4">
          Describe what you want to document, and Iris will create it for you:
        </p>

        <div className="mb-6">
          <CodeBlock 
            data={[{
              language: "markdown",
              filename: "document-example.md",
              code: `"Create a user guide document with:
- Title: 'Getting Started with Iris'
- Table of contents
- Introduction section
- Step-by-step instructions with numbered lists
- Code examples in code blocks
- Tips and warnings in callout boxes
- Conclusion section"`
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

        <Alert className="mb-6">
          <Lightbulb className="h-4 w-4" />
          <AlertDescription>
            <strong>Tip:</strong> Be specific about structure and formatting. Tell Iris what sections you want, what format to use, and any special requirements.
          </AlertDescription>
        </Alert>
      </DocsBody>

      <Separator className="my-8" />

      <DocsBody className="mb-8">
        <h2>Document Creation Best Practices</h2>
        <DocsBullets variant="default" spacing="loose">
          <DocsBulletItem icon={Lightbulb}>
            <strong>Define the Purpose:</strong> Tell Iris what the document is for—user guide, report, article, etc. This helps determine the appropriate structure and tone.
          </DocsBulletItem>
          <DocsBulletItem icon={Lightbulb}>
            <strong>Outline the Structure:</strong> Specify the sections and subsections you want. Iris can suggest a structure if you prefer.
          </DocsBulletItem>
          <DocsBulletItem icon={Lightbulb}>
            <strong>Specify Formatting:</strong> Mention if you need tables, code blocks, lists, or other formatting elements.
          </DocsBulletItem>
          <DocsBulletItem icon={Lightbulb}>
            <strong>Request Revisions:</strong> Review the document and ask Iris to adjust specific sections, improve clarity, or add more details.
          </DocsBulletItem>
        </DocsBullets>
      </DocsBody>

      <Separator className="my-8" />

      <DocsBody className="mb-8">
        <h2>Example Use Cases</h2>
        <div className="space-y-4">
          <DocsCard
            title="User Guides"
            description="Create comprehensive guides for products or services"
            icon={BookOpen}
            variant="outline"
            hover
          >
            <p className="text-sm text-muted-foreground">
              "Create a user guide for a mobile app with installation instructions, feature overview, and troubleshooting section"
            </p>
          </DocsCard>

          <DocsCard
            title="Technical Documentation"
            description="Write technical documentation and API references"
            icon={FileText}
            variant="outline"
            hover
          >
            <p className="text-sm text-muted-foreground">
              "Create API documentation with endpoints, request/response examples, and code samples"
            </p>
          </DocsCard>

          <DocsCard
            title="Reports & Summaries"
            description="Generate formatted reports and summaries"
            icon={FileText}
            variant="outline"
            hover
          >
            <p className="text-sm text-muted-foreground">
              "Create a quarterly report with executive summary, metrics, analysis, and recommendations"
            </p>
          </DocsCard>
        </div>
      </DocsBody>
    </>
  );
}
