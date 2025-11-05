'use client';

import * as React from 'react';
import { 
  DocsHeader,
  DocsBody,
  DocsCard,
} from '@/components/ui/docs-index';
import { 
  Zap,
  FileText,
  Search,
  ArrowRight,
  ArrowLeft,
} from 'lucide-react';
import Link from 'next/link';

const breadcrumbs = [
  { title: 'Documentation', onClick: () => window.location.href = '/docs' },
  { title: 'Quick Start Guide', onClick: () => window.location.href = '/docs/quick-start' },
  { title: 'Step 5: Explore Advanced Features' }
];

export default function Step5Page() {
  return (
    <>
      <DocsHeader
        title="Step 5: Explore Advanced Features"
        subtitle="Now that you've mastered the basics, try these advanced features"
        breadcrumbs={breadcrumbs}
        lastUpdated="January 2025"
        showSeparator
        size="lg"
        className="mb-8 sm:mb-12"
      />

      <DocsBody className="mb-8">
        <p className="mb-4">
          Now that you've mastered the basics, try these advanced features:
        </p>

        <div className="grid md:grid-cols-2 gap-4 mb-6">
          <DocsCard
            title="Browser Automation"
            description="Ask Iris to navigate websites and extract data"
            icon={Zap}
            variant="outline"
            hover
            className="h-full"
          >
            <p className="text-sm text-muted-foreground mb-2">
              Example: "Navigate to example.com and extract all headings from the page"
            </p>
          </DocsCard>

          <DocsCard
            title="Code Execution"
            description="Run commands and scripts"
            icon={FileText}
            variant="outline"
            hover
            className="h-full"
          >
            <p className="text-sm text-muted-foreground mb-2">
              Example: "Create a Python script that lists all files in a directory"
            </p>
          </DocsCard>

          <DocsCard
            title="Image Analysis"
            description="Analyze images and extract information"
            icon={Search}
            variant="outline"
            hover
            className="h-full"
          >
            <p className="text-sm text-muted-foreground mb-2">
              Example: "Analyze this screenshot and describe what you see"
            </p>
          </DocsCard>

          <DocsCard
            title="Presentations"
            description="Create beautiful HTML presentations"
            icon={FileText}
            variant="outline"
            hover
            className="h-full"
          >
            <p className="text-sm text-muted-foreground mb-2">
              Example: "Create a 5-slide presentation about AI agents"
            </p>
          </DocsCard>
        </div>

        <div className="mt-8 flex items-center justify-between">
          <Link 
            href="/docs/quick-start/step-4"
            className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" />
            Previous: Step 4
          </Link>
          <Link 
            href="/docs/quick-start/best-practices"
            className="inline-flex items-center gap-2 text-primary hover:underline font-medium"
          >
            Next: Quick Tips for Success
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </DocsBody>
    </>
  );
}
