'use client';

import * as React from 'react';
import { 
  DocsHeader,
  DocsCard,
  DocsBody,
} from '@/components/ui/docs-index';
import { 
  Rocket,
  MessageSquare,
  FileText,
  Search,
  Zap,
  Lightbulb,
  ArrowRight,
} from 'lucide-react';
import Link from 'next/link';

const breadcrumbs = [
  { title: 'Documentation', onClick: () => window.location.href = '/docs' },
  { title: 'Quick Start Guide' }
];

export default function QuickStartPage() {
  return (
    <>
      <DocsHeader
        title="Quick Start Guide"
        subtitle="Get started with Iris in 5 minutes - your first AI agent tasks"
        breadcrumbs={breadcrumbs}
        lastUpdated="January 2025"
        showSeparator
        size="lg"
        className="mb-8 sm:mb-12"
      />

      <DocsBody className="mb-8">
        <p className="text-lg mb-6">
          This quick start guide will help you complete your first tasks with Iris in just a few minutes. Follow along with these examples to see Iris in action and understand how to interact with Iris to accomplish real work.
        </p>
      </DocsBody>

      <div className="grid md:grid-cols-2 gap-6 mb-8">
        <DocsCard
          title="Welcome to Iris!"
          description="Get started with an overview"
          icon={Rocket}
          variant="default"
          hover
          clickable
          onClick={() => window.location.href = '/docs/quick-start/welcome'}
        >
          <div className="flex items-center gap-2 mt-2 text-sm text-primary">
            <span>Start here</span>
            <ArrowRight className="h-4 w-4" />
          </div>
        </DocsCard>

        <DocsCard
          title="Step 1: Your First Conversation"
          description="Start chatting with Iris"
          icon={MessageSquare}
          variant="default"
          hover
          clickable
          onClick={() => window.location.href = '/docs/quick-start/step-1'}
        >
          <div className="flex items-center gap-2 mt-2 text-sm text-primary">
            <span>Learn more</span>
            <ArrowRight className="h-4 w-4" />
          </div>
        </DocsCard>

        <DocsCard
          title="Step 2: Create Your First Document"
          description="Learn file creation and formatting"
          icon={FileText}
          variant="default"
          hover
          clickable
          onClick={() => window.location.href = '/docs/quick-start/step-2'}
        >
          <div className="flex items-center gap-2 mt-2 text-sm text-primary">
            <span>Learn more</span>
            <ArrowRight className="h-4 w-4" />
          </div>
        </DocsCard>

        <DocsCard
          title="Step 3: Search the Web"
          description="Discover web search capabilities"
          icon={Search}
          variant="default"
          hover
          clickable
          onClick={() => window.location.href = '/docs/quick-start/step-3'}
        >
          <div className="flex items-center gap-2 mt-2 text-sm text-primary">
            <span>Learn more</span>
            <ArrowRight className="h-4 w-4" />
          </div>
        </DocsCard>

        <DocsCard
          title="Step 4: Try a Multi-Step Task"
          description="Complete complex tasks with multiple steps"
          icon={Zap}
          variant="default"
          hover
          clickable
          onClick={() => window.location.href = '/docs/quick-start/step-4'}
        >
          <div className="flex items-center gap-2 mt-2 text-sm text-primary">
            <span>Learn more</span>
            <ArrowRight className="h-4 w-4" />
          </div>
        </DocsCard>

        <DocsCard
          title="Step 5: Explore Advanced Features"
          description="Discover advanced capabilities"
          icon={Zap}
          variant="default"
          hover
          clickable
          onClick={() => window.location.href = '/docs/quick-start/step-5'}
        >
          <div className="flex items-center gap-2 mt-2 text-sm text-primary">
            <span>Learn more</span>
            <ArrowRight className="h-4 w-4" />
          </div>
        </DocsCard>

        <DocsCard
          title="Quick Tips for Success"
          description="Best practices for using Iris"
          icon={Lightbulb}
          variant="default"
          hover
          clickable
          onClick={() => window.location.href = '/docs/quick-start/best-practices'}
        >
          <div className="flex items-center gap-2 mt-2 text-sm text-primary">
            <span>Learn more</span>
            <ArrowRight className="h-4 w-4" />
          </div>
        </DocsCard>

        <DocsCard
          title="What's Next?"
          description="Continue your learning journey"
          icon={Rocket}
          variant="default"
          hover
          clickable
          onClick={() => window.location.href = '/docs/quick-start/next-steps'}
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