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
  Presentation,
  Lightbulb,
  CheckCircle2,
  Info,
  Palette,
  Sparkles,
} from 'lucide-react';
import { Separator } from '@/components/ui/separator';

const breadcrumbs = [
  { title: 'Documentation', onClick: () => window.location.href = '/docs' },
  { title: 'Iris Capabilities', onClick: () => window.location.href = '/docs' },
  { title: 'Slides Generation' }
];

export default function SlidesGenerationPage() {
  return (
    <>
      <DocsHeader
        title="Slides Generation"
        subtitle="Create captivating presentations that engage and inspire your audience with Iris's professional slide generation"
        breadcrumbs={breadcrumbs}
        lastUpdated="January 2025"
        showSeparator
        size="lg"
        className="mb-8 sm:mb-12"
      />

      <DocsBody className="mb-8">
        <p className="text-lg mb-6">
          Iris transforms your ideas into visually stunning presentations that capture attention and communicate effectively. With professional themes, intelligent layouts, and seamless content integration, Iris helps you create presentations that look like they were designed by a professional team. Whether you're pitching to investors, presenting to colleagues, or delivering educational content, Iris ensures your message is delivered with impact and style.
        </p>

        <Alert className="mb-6">
          <Info className="h-4 w-4" />
          <AlertDescription>
            <strong>Professional Quality:</strong> Every presentation Iris creates follows professional design principles, ensuring your slides look polished and engaging.
          </AlertDescription>
        </Alert>
      </DocsBody>

      <Separator className="my-8" />

      <DocsBody className="mb-8">
        <h2>Why Iris Presentations Stand Out</h2>
        <p className="mb-6">
          Iris doesn't just create slides—it crafts visual narratives. Each presentation is thoughtfully designed with consistent themes, proper spacing, and professional layouts that enhance your content's impact.
        </p>

        <div className="grid md:grid-cols-2 gap-6 mb-8">
          <DocsCard
            title="Professional Themes"
            description="Choose from multiple beautiful themes that match your style"
            icon={Palette}
            variant="outline"
            hover
            className="h-full"
          >
            <DocsBullets variant="default" spacing="tight">
              <DocsBulletItem icon={CheckCircle2}>Modern, Minimal, Dark, Corporate</DocsBulletItem>
              <DocsBulletItem icon={CheckCircle2}>Consistent visual identity</DocsBulletItem>
              <DocsBulletItem icon={CheckCircle2}>Professional color schemes</DocsBulletItem>
            </DocsBullets>
          </DocsCard>

          <DocsCard
            title="Rich Content Support"
            description="Add text, images, charts, and interactive elements"
            icon={Presentation}
            variant="outline"
            hover
            className="h-full"
          >
            <DocsBullets variant="default" spacing="tight">
              <DocsBulletItem icon={CheckCircle2}>HTML and CSS support</DocsBulletItem>
              <DocsBulletItem icon={CheckCircle2}>Chart.js and D3.js integration</DocsBulletItem>
              <DocsBulletItem icon={CheckCircle2}>Font Awesome icons</DocsBulletItem>
            </DocsBullets>
          </DocsCard>

          <DocsCard
            title="Iterative Editing"
            description="Build your presentation slide by slide with easy updates"
            icon={Sparkles}
            variant="outline"
            hover
            className="h-full"
          >
            <DocsBullets variant="default" spacing="tight">
              <DocsBulletItem icon={CheckCircle2}>Edit individual slides</DocsBulletItem>
              <DocsBulletItem icon={CheckCircle2}>Add or remove slides anytime</DocsBulletItem>
              <DocsBulletItem icon={CheckCircle2}>Real-time preview</DocsBulletItem>
            </DocsBullets>
          </DocsCard>

          <DocsCard
            title="Professional Layouts"
            description="Pre-designed layouts for common slide types"
            icon={Presentation}
            variant="outline"
            hover
            className="h-full"
          >
            <DocsBullets variant="default" spacing="tight">
              <DocsBulletItem icon={CheckCircle2}>Title slides</DocsBulletItem>
              <DocsBulletItem icon={CheckCircle2}>Content slides with bullets</DocsBulletItem>
              <DocsBulletItem icon={CheckCircle2}>Comparison and feature showcases</DocsBulletItem>
            </DocsBullets>
          </DocsCard>
        </div>
      </DocsBody>

      <Separator className="my-8" />

      <DocsBody className="mb-8">
        <h2>How to Create Presentations</h2>
        <p className="mb-4">
          Simply describe what you want to present, and Iris will create a beautiful presentation for you:
        </p>

        <div className="mb-6">
          <CodeBlock 
            data={[{
              language: "markdown",
              filename: "presentation-example.md",
              code: `"Create a 10-slide presentation about AI agents with:
- Title slide introducing the topic
- Overview of what AI agents are
- Key capabilities and use cases
- Real-world examples
- Future trends
- Conclusion slide

Use a modern theme and include relevant images"`
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
            <strong>Tip:</strong> Iris can research your topic first, then create slides based on the findings. Just ask for both!
          </AlertDescription>
        </Alert>
      </DocsBody>

      <Separator className="my-8" />

      <DocsBody className="mb-8">
        <h2>Presentation Best Practices</h2>
        <DocsBullets variant="default" spacing="loose">
          <DocsBulletItem icon={Lightbulb}>
            <strong>Define Your Audience:</strong> Tell Iris who will see the presentation. This helps tailor the content and style appropriately.
          </DocsBulletItem>
          <DocsBulletItem icon={Lightbulb}>
            <strong>Provide Structure:</strong> Outline the main points you want to cover. Iris can expand on these ideas.
          </DocsBulletItem>
          <DocsBulletItem icon={Lightbulb}>
            <strong>Request Visuals:</strong> Ask Iris to include images, charts, or diagrams to make slides more engaging.
          </DocsBulletItem>
          <DocsBulletItem icon={Lightbulb}>
            <strong>Iterate and Refine:</strong> Review the presentation and ask Iris to adjust specific slides or overall design.
          </DocsBulletItem>
        </DocsBullets>
      </DocsBody>

      <Separator className="my-8" />

      <DocsBody className="mb-8">
        <h2>Example Use Cases</h2>
        <div className="space-y-4">
          <DocsCard
            title="Business Presentations"
            description="Create pitches, proposals, and company updates"
            icon={Presentation}
            variant="outline"
            hover
          >
            <p className="text-sm text-muted-foreground">
              "Create a pitch deck for a SaaS product with 12 slides covering problem, solution, market, and business model"
            </p>
          </DocsCard>

          <DocsCard
            title="Educational Content"
            description="Develop teaching materials and course presentations"
            icon={Presentation}
            variant="outline"
            hover
          >
            <p className="text-sm text-muted-foreground">
              "Create a 15-slide presentation about machine learning basics for beginners with examples and diagrams"
            </p>
          </DocsCard>

          <DocsCard
            title="Report Summaries"
            description="Turn research reports into visual presentations"
            icon={Presentation}
            variant="outline"
            hover
          >
            <p className="text-sm text-muted-foreground">
              "Summarize this research report into a 8-slide presentation highlighting key findings and recommendations"
            </p>
          </DocsCard>
        </div>
      </DocsBody>
    </>
  );
}
