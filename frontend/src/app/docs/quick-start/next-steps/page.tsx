'use client';

import * as React from 'react';
import { 
  DocsHeader,
  DocsBody,
  DocsCard,
} from '@/components/ui/docs-index';
import { 
  FileText,
  Zap,
  Rocket,
  ArrowRight,
  ArrowLeft,
} from 'lucide-react';
import Link from 'next/link';

const breadcrumbs = [
  { title: 'Documentation', onClick: () => window.location.href = '/docs' },
  { title: 'Quick Start Guide', onClick: () => window.location.href = '/docs/quick-start' },
  { title: "What's Next?" }
];

export default function NextStepsPage() {
  return (
    <>
      <DocsHeader
        title="What's Next?"
        subtitle="Congratulations! You've completed the quick start guide"
        breadcrumbs={breadcrumbs}
        lastUpdated="January 2025"
        showSeparator
        size="lg"
        className="mb-8 sm:mb-12"
      />

      <DocsBody className="mb-8">
        <p className="mb-6">
          Congratulations! You've completed the quick start guide. Here's what to explore next:
        </p>

        <div className="grid md:grid-cols-2 gap-6">
          <DocsCard
            title="Iris Capabilities"
            description="Learn about all features and capabilities"
            icon={FileText}
            variant="default"
            hover
            clickable
            onClick={() => window.location.href = '/docs/capabilities/research'}
          >
            <div className="flex items-center gap-2 mt-2 text-sm text-primary">
              <span>Explore capabilities</span>
              <ArrowRight className="h-4 w-4" />
            </div>
          </DocsCard>

          <DocsCard
            title="Formatting Showcase"
            description="See all formatting options available"
            icon={FileText}
            variant="default"
            hover
            clickable
            onClick={() => window.location.href = '/docs/formatting-showcase'}
          >
            <div className="flex items-center gap-2 mt-2 text-sm text-primary">
              <span>View formatting guide</span>
              <ArrowRight className="h-4 w-4" />
            </div>
          </DocsCard>

          <DocsCard
            title="Continue Learning"
            description="Keep exploring Iris's capabilities"
            icon={Rocket}
            variant="default"
            hover
            clickable
            onClick={() => window.location.href = '/docs/introduction'}
          >
            <div className="flex items-center gap-2 mt-2 text-sm text-primary">
              <span>Read more</span>
              <ArrowRight className="h-4 w-4" />
            </div>
          </DocsCard>
        </div>

        <div className="mt-8">
          <Link 
            href="/docs/quick-start/best-practices"
            className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" />
            Previous: Quick Tips for Success
          </Link>
        </div>
      </DocsBody>
    </>
  );
}
