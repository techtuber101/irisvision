'use client';

import * as React from 'react';
import { 
  DocsHeader,
  DocsCard,
  DocsBody,
} from '@/components/ui/docs-index';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  Info,
  Code,
  FileText,
  Table,
  List,
  Heading1,
  Type,
  Link as LinkIcon,
  Quote,
  AlertTriangle,
  Box,
  Sparkles,
  ArrowRight,
} from 'lucide-react';

const breadcrumbs = [
  { title: 'Documentation', onClick: () => window.location.href = '/docs' },
  { title: 'Formatting Showcase' }
];

export default function FormattingShowcasePage() {
  return (
    <>
      <DocsHeader
        title="Documentation Formatting Guide"
        subtitle="Discover all the formatting features and components available in Iris documentation"
        breadcrumbs={breadcrumbs}
        lastUpdated="January 2025"
        showSeparator
        size="lg"
        className="mb-8 sm:mb-12"
      />

      <DocsBody className="mb-8">
        <p className="text-lg mb-6">
          This guide demonstrates all the formatting options and components available when creating documents with Iris. Each section shows examples of how to use different formatting features.
        </p>
        
        <Alert className="mb-6">
          <Info className="h-4 w-4" />
          <AlertDescription>
            <strong>Documentation System:</strong> Iris uses <strong>shadcn/ui</strong> components built on <strong>Radix UI</strong> and <strong>Tailwind CSS</strong>, with <strong>Shiki</strong> for code syntax highlighting.
          </AlertDescription>
        </Alert>
      </DocsBody>

      <div className="grid md:grid-cols-2 gap-6 mb-8">
        <DocsCard
          title="Overview"
          description="Formatting features overview"
          icon={Info}
          variant="default"
          hover
          clickable
          onClick={() => window.location.href = '/docs/formatting-showcase/overview'}
        >
          <div className="flex items-center gap-2 mt-2 text-sm text-primary">
            <span>Learn more</span>
            <ArrowRight className="h-4 w-4" />
          </div>
        </DocsCard>

        <DocsCard
          title="Headings"
          description="Structure your documents with headings"
          icon={Heading1}
          variant="default"
          hover
          clickable
          onClick={() => window.location.href = '/docs/formatting-showcase/headings'}
        >
          <div className="flex items-center gap-2 mt-2 text-sm text-primary">
            <span>Learn more</span>
            <ArrowRight className="h-4 w-4" />
          </div>
        </DocsCard>

        <DocsCard
          title="Text Formatting"
          description="Bold, italic, and more text styles"
          icon={Type}
          variant="default"
          hover
          clickable
          onClick={() => window.location.href = '/docs/formatting-showcase/text-formatting'}
        >
          <div className="flex items-center gap-2 mt-2 text-sm text-primary">
            <span>Learn more</span>
            <ArrowRight className="h-4 w-4" />
          </div>
        </DocsCard>

        <DocsCard
          title="Lists"
          description="Create organized lists"
          icon={List}
          variant="default"
          hover
          clickable
          onClick={() => window.location.href = '/docs/formatting-showcase/lists'}
        >
          <div className="flex items-center gap-2 mt-2 text-sm text-primary">
            <span>Learn more</span>
            <ArrowRight className="h-4 w-4" />
          </div>
        </DocsCard>

        <DocsCard
          title="Code Blocks"
          description="Display code with syntax highlighting"
          icon={Code}
          variant="default"
          hover
          clickable
          onClick={() => window.location.href = '/docs/formatting-showcase/code-blocks'}
        >
          <div className="flex items-center gap-2 mt-2 text-sm text-primary">
            <span>Learn more</span>
            <ArrowRight className="h-4 w-4" />
          </div>
        </DocsCard>

        <DocsCard
          title="Tables"
          description="Create structured data tables"
          icon={Table}
          variant="default"
          hover
          clickable
          onClick={() => window.location.href = '/docs/formatting-showcase/tables'}
        >
          <div className="flex items-center gap-2 mt-2 text-sm text-primary">
            <span>Learn more</span>
            <ArrowRight className="h-4 w-4" />
          </div>
        </DocsCard>

        <DocsCard
          title="Links"
          description="Add hyperlinks to resources"
          icon={LinkIcon}
          variant="default"
          hover
          clickable
          onClick={() => window.location.href = '/docs/formatting-showcase/links'}
        >
          <div className="flex items-center gap-2 mt-2 text-sm text-primary">
            <span>Learn more</span>
            <ArrowRight className="h-4 w-4" />
          </div>
        </DocsCard>

        <DocsCard
          title="Blockquotes"
          description="Highlight important information"
          icon={Quote}
          variant="default"
          hover
          clickable
          onClick={() => window.location.href = '/docs/formatting-showcase/blockquotes'}
        >
          <div className="flex items-center gap-2 mt-2 text-sm text-primary">
            <span>Learn more</span>
            <ArrowRight className="h-4 w-4" />
          </div>
        </DocsCard>

        <DocsCard
          title="Alerts & Callouts"
          description="Draw attention with alerts"
          icon={AlertTriangle}
          variant="default"
          hover
          clickable
          onClick={() => window.location.href = '/docs/formatting-showcase/alerts'}
        >
          <div className="flex items-center gap-2 mt-2 text-sm text-primary">
            <span>Learn more</span>
            <ArrowRight className="h-4 w-4" />
          </div>
        </DocsCard>

        <DocsCard
          title="Cards"
          description="Organize content with cards"
          icon={Box}
          variant="default"
          hover
          clickable
          onClick={() => window.location.href = '/docs/formatting-showcase/cards'}
        >
          <div className="flex items-center gap-2 mt-2 text-sm text-primary">
            <span>Learn more</span>
            <ArrowRight className="h-4 w-4" />
          </div>
        </DocsCard>

        <DocsCard
          title="Combining Elements"
          description="Mix and match formatting"
          icon={Sparkles}
          variant="default"
          hover
          clickable
          onClick={() => window.location.href = '/docs/formatting-showcase/combining-elements'}
        >
          <div className="flex items-center gap-2 mt-2 text-sm text-primary">
            <span>Learn more</span>
            <ArrowRight className="h-4 w-4" />
          </div>
        </DocsCard>

        <DocsCard
          title="Summary"
          description="Formatting guide summary"
          icon={FileText}
          variant="default"
          hover
          clickable
          onClick={() => window.location.href = '/docs/formatting-showcase/summary'}
        >
          <div className="flex items-center gap-2 mt-2 text-sm text-primary">
            <span>Learn more</span>
            <ArrowRight className="h-4 w-4" />
          </div>
        </DocsCard>
      </div>
    </>
  );
}