'use client';

import * as React from 'react';
import { 
  DocsHeader,
  DocsCard,
  DocsBody,
  DocsImage
} from '@/components/ui/docs-index';
import { useTheme } from 'next-themes';
import { ArrowRight, Lightbulb, BookOpen, Bot, Rocket, Sparkles } from 'lucide-react';

const breadcrumbs = [
  { title: 'Documentation', onClick: () => window.location.href = '/docs' },
  { title: 'What is Iris?' }
];

export default function IntroductionPage() {
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
          Iris is a powerful platform where you can build AI agents that handle real work. Learn more about what makes Iris special and how it works.
        </p>
      </DocsBody>

      <div className="grid md:grid-cols-2 gap-6 mb-8">
        <DocsCard
          title="Overview"
          description="What is Iris?"
          icon={Bot}
          variant="default"
          hover
          clickable
          onClick={() => window.location.href = '/docs/introduction/overview'}
        >
          <div className="flex items-center gap-2 mt-2 text-sm text-primary">
            <span>Learn more</span>
            <ArrowRight className="h-4 w-4" />
          </div>
        </DocsCard>

        <DocsCard
          title="Meet Iris"
          description="Our flagship agent"
          icon={Bot}
          variant="default"
          hover
          clickable
          onClick={() => window.location.href = '/docs/introduction/meet-iris'}
        >
          <div className="flex items-center gap-2 mt-2 text-sm text-primary">
            <span>Learn more</span>
            <ArrowRight className="h-4 w-4" />
          </div>
        </DocsCard>

        <DocsCard
          title="Build Your Own Agents"
          description="Create agents for your specific needs"
          icon={Sparkles}
          variant="default"
          hover
          clickable
          onClick={() => window.location.href = '/docs/introduction/build-your-own'}
        >
          <div className="flex items-center gap-2 mt-2 text-sm text-primary">
            <span>Learn more</span>
            <ArrowRight className="h-4 w-4" />
          </div>
        </DocsCard>

        <DocsCard
          title="How It Works"
          description="The four main pieces of Iris"
          icon={Rocket}
          variant="default"
          hover
          clickable
          onClick={() => window.location.href = '/docs/introduction/how-it-works'}
        >
          <div className="flex items-center gap-2 mt-2 text-sm text-primary">
            <span>Learn more</span>
            <ArrowRight className="h-4 w-4" />
          </div>
        </DocsCard>

        <DocsCard
          title="Why Iris?"
          description="Own your agents and your data"
          icon={Lightbulb}
          variant="default"
          hover
          clickable
          onClick={() => window.location.href = '/docs/introduction/why-iris'}
        >
          <div className="flex items-center gap-2 mt-2 text-sm text-primary">
            <span>Learn more</span>
            <ArrowRight className="h-4 w-4" />
          </div>
        </DocsCard>
      </div>

      <div className='grid md:grid-cols-2 gap-4 pb-8'>
        <DocsCard
          title="Quick Start Guide"
          description="Get started in 5 minutes"
          icon={Lightbulb}
          variant="outline"
          hover
          clickable
          onClick={() => window.location.href = '/docs/quick-start'}
        >
          <div className="flex items-center gap-2 mt-2 text-sm text-primary">
            <span>Get started</span>
            <ArrowRight className="h-4 w-4" />
          </div>
        </DocsCard>
        <DocsCard
          title="Iris Capabilities"
          description="All features explained"
          icon={BookOpen}
          variant="outline"
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
          description="See all formatting options"
          icon={Lightbulb}
          variant="outline"
          hover
          clickable
          onClick={() => window.location.href = '/docs/formatting-showcase'}
        >
          <div className="flex items-center gap-2 mt-2 text-sm text-primary">
            <span>View formatting guide</span>
            <ArrowRight className="h-4 w-4" />
          </div>
        </DocsCard>
      </div>
    </>
  );
}