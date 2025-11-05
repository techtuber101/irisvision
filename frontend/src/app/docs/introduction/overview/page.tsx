'use client';

import * as React from 'react';
import { 
  DocsHeader,
  DocsBody,
  DocsImage,
} from '@/components/ui/docs-index';
import { useTheme } from 'next-themes';
import { ArrowRight, ArrowLeft } from 'lucide-react';
import Link from 'next/link';

const breadcrumbs = [
  { title: 'Documentation', onClick: () => window.location.href = '/docs' },
  { title: 'What is Iris?', onClick: () => window.location.href = '/docs/introduction' },
  { title: 'Overview' }
];

export default function OverviewPage() {
  const { theme, resolvedTheme } = useTheme();
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => {
    setMounted(true);
  }, []);

  const imageSrc = !mounted
    ? '/Comingsoon.png'
    : resolvedTheme === 'dark'
      ? '/Comingsoon.png'
      : '/Comingsoon.png';

  return (
    <>
      <DocsHeader
        title="What is Iris?"
        subtitle="A powerful platform for building AI agents that actually get things done"
        breadcrumbs={breadcrumbs}
        lastUpdated="August 2025"
        showSeparator
        size="lg"
        className="mb-8 sm:mb-12"
      />

      <DocsImage
        src={imageSrc}
        alt="Iris Platform Interface"
        size="full"
        aspect="video"
        className="mb-12"
      />
    
      <DocsBody className="mb-8">
        <p className="text-lg mb-6">
          Iris is a powerful platform where you can build AI agents that handle real work. Think of it as the infrastructure and tools you need to create agents that can browse the web, manage files, analyze data, and automate workflows.
        </p>
      </DocsBody>

      <div className="mt-8">
        <Link 
          href="/docs/introduction/meet-iris"
          className="inline-flex items-center gap-2 text-primary hover:underline font-medium"
        >
          Continue to: Meet Iris
          <ArrowRight className="h-4 w-4" />
        </Link>
      </div>
    </>
  );
}
