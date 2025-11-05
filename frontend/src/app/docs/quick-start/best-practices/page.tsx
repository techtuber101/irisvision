'use client';

import * as React from 'react';
import { 
  DocsHeader,
  DocsBody,
  DocsBullets,
  DocsBulletItem,
} from '@/components/ui/docs-index';
import { 
  Lightbulb,
  ArrowRight,
  ArrowLeft,
} from 'lucide-react';
import Link from 'next/link';

const breadcrumbs = [
  { title: 'Documentation', onClick: () => window.location.href = '/docs' },
  { title: 'Quick Start Guide', onClick: () => window.location.href = '/docs/quick-start' },
  { title: 'Quick Tips for Success' }
];

export default function BestPracticesPage() {
  return (
    <>
      <DocsHeader
        title="Quick Tips for Success"
        subtitle="Follow these tips to get the best results from Iris"
        breadcrumbs={breadcrumbs}
        lastUpdated="January 2025"
        showSeparator
        size="lg"
        className="mb-8 sm:mb-12"
      />

      <DocsBody className="mb-8">
        <p className="mb-4">
          Follow these tips to get the best results from Iris:
        </p>

        <DocsBullets variant="default" spacing="loose">
          <DocsBulletItem icon={Lightbulb}>
            <strong>Be Specific:</strong> The more details you provide, the better Iris can help you. Instead of "create a document," try "create a document about Python decorators with code examples and a comparison table."
          </DocsBulletItem>
          <DocsBulletItem icon={Lightbulb}>
            <strong>Break Down Complex Tasks:</strong> For complex tasks, break them into steps. Iris will handle each step automatically.
          </DocsBulletItem>
          <DocsBulletItem icon={Lightbulb}>
            <strong>Iterate and Refine:</strong> Don't hesitate to ask Iris to modify or improve results. You can say "make it shorter" or "add more examples."
          </DocsBulletItem>
          <DocsBulletItem icon={Lightbulb}>
            <strong>Use Natural Language:</strong> Talk to Iris like you would talk to a colleague. No need for special commands or syntax.
          </DocsBulletItem>
        </DocsBullets>

        <div className="mt-8 flex items-center justify-between">
          <Link 
            href="/docs/quick-start/step-5"
            className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" />
            Previous: Step 5
          </Link>
          <Link 
            href="/docs/quick-start/next-steps"
            className="inline-flex items-center gap-2 text-primary hover:underline font-medium"
          >
            Next: What's Next?
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </DocsBody>
    </>
  );
}
