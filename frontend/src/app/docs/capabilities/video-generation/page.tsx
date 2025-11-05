'use client';

import * as React from 'react';
import { 
  DocsHeader,
  DocsCard,
  DocsBody,
  DocsBullets,
  DocsBulletItem,
} from '@/components/ui/docs-index';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  Video,
  Info,
  Clock,
} from 'lucide-react';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';

const breadcrumbs = [
  { title: 'Documentation', onClick: () => window.location.href = '/docs' },
  { title: 'Iris Capabilities', onClick: () => window.location.href = '/docs' },
  { title: 'Video Generation' }
];

export default function VideoGenerationPage() {
  return (
    <>
      <DocsHeader
        title="Video Generation"
        subtitle="Create dynamic videos and motion graphics with Iris's upcoming video generation capabilities"
        breadcrumbs={breadcrumbs}
        lastUpdated="January 2025"
        showSeparator
        size="lg"
        className="mb-8 sm:mb-12"
      />

      <DocsBody className="mb-8">
        <div className="mb-6">
          <Badge className="mb-4 bg-amber-500/20 border-amber-500/60 text-amber-500 text-base px-4 py-2">
            Coming Soon
          </Badge>
        </div>

        <p className="text-lg mb-6">
          Iris is expanding its creative capabilities to include video generation. Soon, you'll be able to create dynamic videos, motion graphics, and animated content directly from text descriptions. Whether you need promotional videos, social media content, educational animations, or custom video projects, Iris will help you bring your video ideas to life with professional-quality results.
        </p>

        <Alert className="mb-6">
          <Info className="h-4 w-4" />
          <AlertDescription>
            <strong>Exciting Feature Coming:</strong> Video generation is currently in development and will be available soon. Stay tuned for updates!
          </AlertDescription>
        </Alert>
      </DocsBody>

      <Separator className="my-8" />

      <DocsBody className="mb-8">
        <h2>Planned Video Generation Features</h2>
        <p className="mb-6">
          When video generation launches, Iris will offer comprehensive video creation capabilities:
        </p>

        <div className="grid md:grid-cols-2 gap-6 mb-8">
          <DocsCard
            title="AI Video Generation"
            description="Generate videos from text descriptions"
            icon={Video}
            variant="outline"
            hover
            className="h-full"
          >
            <DocsBullets variant="default" spacing="tight">
              <DocsBulletItem icon={Clock}>Create videos from prompts</DocsBulletItem>
              <DocsBulletItem icon={Clock}>Multiple video styles</DocsBulletItem>
              <DocsBulletItem icon={Clock}>Customizable duration</DocsBulletItem>
              <DocsBulletItem icon={Clock}>High-quality output</DocsBulletItem>
            </DocsBullets>
          </DocsCard>

          <DocsCard
            title="Motion Graphics"
            description="Create animated graphics and visual effects"
            icon={Video}
            variant="outline"
            hover
            className="h-full"
          >
            <DocsBullets variant="default" spacing="tight">
              <DocsBulletItem icon={Clock}>Animated text and graphics</DocsBulletItem>
              <DocsBulletItem icon={Clock}>Transitions and effects</DocsBulletItem>
              <DocsBulletItem icon={Clock}>Branded motion graphics</DocsBulletItem>
              <DocsBulletItem icon={Clock}>Professional animations</DocsBulletItem>
            </DocsBullets>
          </DocsCard>

          <DocsCard
            title="Social Media Videos"
            description="Optimized video formats for social platforms"
            icon={Video}
            variant="outline"
            hover
            className="h-full"
          >
            <DocsBullets variant="default" spacing="tight">
              <DocsBulletItem icon={Clock}>Platform-specific formats</DocsBulletItem>
              <DocsBulletItem icon={Clock}>Short-form content</DocsBulletItem>
              <DocsBulletItem icon={Clock}>Story and reel videos</DocsBulletItem>
              <DocsBulletItem icon={Clock}>Engaging visual content</DocsBulletItem>
            </DocsBullets>
          </DocsCard>

          <DocsCard
            title="Video Editing"
            description="Edit and enhance video content"
            icon={Video}
            variant="outline"
            hover
            className="h-full"
          >
            <DocsBullets variant="default" spacing="tight">
              <DocsBulletItem icon={Clock}>Trim and cut videos</DocsBulletItem>
              <DocsBulletItem icon={Clock}>Add effects and transitions</DocsBulletItem>
              <DocsBulletItem icon={Clock}>Combine multiple clips</DocsBulletItem>
              <DocsBulletItem icon={Clock}>Add music and audio</DocsBulletItem>
            </DocsBullets>
          </DocsCard>
        </div>
      </DocsBody>

      <Separator className="my-8" />

      <DocsBody className="mb-8">
        <h2>Stay Updated</h2>
        <p className="mb-6">
          Video generation is an exciting new capability that will expand Iris's creative toolkit. We're working hard to bring you professional-quality video generation that matches the quality and ease of use you've come to expect from Iris's other capabilities.
        </p>

        <Alert className="mb-6">
          <Info className="h-4 w-4" />
          <AlertDescription>
            <strong>Coming Soon:</strong> Follow our updates to be notified when video generation becomes available. This feature will integrate seamlessly with Iris's existing capabilities.
          </AlertDescription>
        </Alert>
      </DocsBody>
    </>
  );
}
