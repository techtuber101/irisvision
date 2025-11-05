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
  Image as ImageIcon,
  Palette,
  Lightbulb,
  CheckCircle2,
  Info,
  Sparkles,
} from 'lucide-react';
import { Separator } from '@/components/ui/separator';

const breadcrumbs = [
  { title: 'Documentation', onClick: () => window.location.href = '/docs' },
  { title: 'Iris Capabilities', onClick: () => window.location.href = '/docs' },
  { title: 'Image Generation' }
];

export default function ImageGenerationPage() {
  return (
    <>
      <DocsHeader
        title="Image Generation"
        subtitle="Create stunning images and designs with Iris's advanced AI-powered image generation capabilities"
        breadcrumbs={breadcrumbs}
        lastUpdated="January 2025"
        showSeparator
        size="lg"
        className="mb-8 sm:mb-12"
      />

      <DocsBody className="mb-8">
        <p className="text-lg mb-6">
          Iris brings your visual ideas to life with professional-quality image generation powered by advanced AI. Whether you need social media graphics, marketing materials, illustrations, or custom artwork, Iris creates images that capture your vision perfectly. With support for multiple design styles, platform-specific sizes, and professional design principles, Iris ensures every image you create looks polished and ready to use.
        </p>

        <Alert className="mb-6">
          <Info className="h-4 w-4" />
          <AlertDescription>
            <strong>Professional Design:</strong> Iris applies professional design principles like proper composition, color theory, and visual hierarchy to every image it creates.
          </AlertDescription>
        </Alert>
      </DocsBody>

      <Separator className="my-8" />

      <DocsBody className="mb-8">
        <h2>Image Generation Features</h2>
        <p className="mb-6">
          Iris offers comprehensive image creation capabilities that cover everything from simple illustrations to complex professional designs.
        </p>

        <div className="grid md:grid-cols-2 gap-6 mb-8">
          <DocsCard
            title="AI Image Generation"
            description="Generate images from text descriptions"
            icon={ImageIcon}
            variant="outline"
            hover
            className="h-full"
          >
            <DocsBullets variant="default" spacing="tight">
              <DocsBulletItem icon={CheckCircle2}>High-quality image generation</DocsBulletItem>
              <DocsBulletItem icon={CheckCircle2}>Multiple style options</DocsBulletItem>
              <DocsBulletItem icon={CheckCircle2}>Customizable dimensions</DocsBulletItem>
              <DocsBulletItem icon={CheckCircle2}>Professional quality output</DocsBulletItem>
            </DocsBullets>
          </DocsCard>

          <DocsCard
            title="Image Editing"
            description="Edit and enhance existing images"
            icon={Palette}
            variant="outline"
            hover
            className="h-full"
          >
            <DocsBullets variant="default" spacing="tight">
              <DocsBulletItem icon={CheckCircle2}>Modify existing images</DocsBulletItem>
              <DocsBulletItem icon={CheckCircle2}>Add or remove elements</DocsBulletItem>
              <DocsBulletItem icon={CheckCircle2}>Style transfer</DocsBulletItem>
              <DocsBulletItem icon={CheckCircle2}>Enhancement and refinement</DocsBulletItem>
            </DocsBullets>
          </DocsCard>

          <DocsCard
            title="Platform-Specific Designs"
            description="Optimized sizes for social media and marketing"
            icon={Sparkles}
            variant="outline"
            hover
            className="h-full"
          >
            <DocsBullets variant="default" spacing="tight">
              <DocsBulletItem icon={CheckCircle2}>Social media presets</DocsBulletItem>
              <DocsBulletItem icon={CheckCircle2}>Advertising formats</DocsBulletItem>
              <DocsBulletItem icon={CheckCircle2}>Presentation graphics</DocsBulletItem>
              <DocsBulletItem icon={CheckCircle2}>Marketing materials</DocsBulletItem>
            </DocsBullets>
          </DocsCard>

          <DocsCard
            title="Design Styles"
            description="Multiple design aesthetics to choose from"
            icon={Palette}
            variant="outline"
            hover
            className="h-full"
          >
            <DocsBullets variant="default" spacing="tight">
              <DocsBulletItem icon={CheckCircle2}>Modern, Minimalist, Professional</DocsBulletItem>
              <DocsBulletItem icon={CheckCircle2}>Bold, Luxury, Tech styles</DocsBulletItem>
              <DocsBulletItem icon={CheckCircle2}>Abstract, Geometric, Organic</DocsBulletItem>
              <DocsBulletItem icon={CheckCircle2}>Custom style combinations</DocsBulletItem>
            </DocsBullets>
          </DocsCard>
        </div>
      </DocsBody>

      <Separator className="my-8" />

      <DocsBody className="mb-8">
        <h2>How to Generate Images</h2>
        <p className="mb-4">
          Describe the image you want, and Iris will create it for you:
        </p>

        <div className="mb-6">
          <CodeBlock 
            data={[{
              language: "markdown",
              filename: "image-example.md",
              code: `"Create a social media post image for Instagram:
- Platform: Instagram square
- Content: Promotional graphic for new product launch
- Style: Modern and bold
- Include product name and tagline
- Use vibrant colors"`
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
            <strong>Tip:</strong> Specify the platform or use case first (Instagram, Facebook, presentation, etc.), then describe the content and style you want.
          </AlertDescription>
        </Alert>
      </DocsBody>

      <Separator className="my-8" />

      <DocsBody className="mb-8">
        <h2>Image Generation Best Practices</h2>
        <DocsBullets variant="default" spacing="loose">
          <DocsBulletItem icon={Lightbulb}>
            <strong>Choose Your Platform:</strong> Tell Iris what platform you're creating for (Instagram, Facebook, presentation, etc.) so it uses the right dimensions and format.
          </DocsBulletItem>
          <DocsBulletItem icon={Lightbulb}>
            <strong>Describe the Content:</strong> Be specific about what you want in the image—subject, text, colors, mood, etc.
          </DocsBulletItem>
          <DocsBulletItem icon={Lightbulb}>
            <strong>Select a Style:</strong> Mention if you want modern, minimalist, bold, or any specific aesthetic style.
          </DocsBulletItem>
          <DocsBulletItem icon={Lightbulb}>
            <strong>Iterate and Refine:</strong> If the first result isn't perfect, ask Iris to adjust specific elements or try a different approach.
          </DocsBulletItem>
        </DocsBullets>
      </DocsBody>

      <Separator className="my-8" />

      <DocsBody className="mb-8">
        <h2>Example Use Cases</h2>
        <div className="space-y-4">
          <DocsCard
            title="Social Media Graphics"
            description="Create eye-catching graphics for social media posts"
            icon={ImageIcon}
            variant="outline"
            hover
          >
            <p className="text-sm text-muted-foreground">
              "Create an Instagram post image promoting a new blog post with title, image, and call-to-action"
            </p>
          </DocsCard>

          <DocsCard
            title="Marketing Materials"
            description="Design promotional materials and advertisements"
            icon={Palette}
            variant="outline"
            hover
          >
            <p className="text-sm text-muted-foreground">
              "Create a Facebook ad image for a product launch with modern design and brand colors"
            </p>
          </DocsCard>

          <DocsCard
            title="Illustrations & Artwork"
            description="Generate custom illustrations and artwork"
            icon={Sparkles}
            variant="outline"
            hover
          >
            <p className="text-sm text-muted-foreground">
              "Create an abstract illustration for a presentation slide with geometric patterns and vibrant colors"
            </p>
          </DocsCard>
        </div>
      </DocsBody>
    </>
  );
}
