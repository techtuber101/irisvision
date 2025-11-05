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
  Globe,
  Code,
  Lightbulb,
  CheckCircle2,
  Info,
  Sparkles,
} from 'lucide-react';
import { Separator } from '@/components/ui/separator';

const breadcrumbs = [
  { title: 'Documentation', onClick: () => window.location.href = '/docs' },
  { title: 'Iris Capabilities', onClick: () => window.location.href = '/docs' },
  { title: 'Website Creations' }
];

export default function WebsiteCreationsPage() {
  return (
    <>
      <DocsHeader
        title="Website Creations"
        subtitle="Build beautiful, functional websites from scratch with Iris's web development capabilities"
        breadcrumbs={breadcrumbs}
        lastUpdated="January 2025"
        showSeparator
        size="lg"
        className="mb-8 sm:mb-12"
      />

      <DocsBody className="mb-8">
        <p className="text-lg mb-6">
          Iris brings your web ideas to life by creating fully functional websites that are both beautiful and responsive. From simple landing pages to complex interactive applications, Iris leverages modern web technologies to build sites that work seamlessly across all devices. Whether you need a portfolio site, a product landing page, or a custom web application, Iris delivers professional-quality websites that are ready to deploy.
        </p>

        <Alert className="mb-6">
          <Info className="h-4 w-4" />
          <AlertDescription>
            <strong>Full-Stack Development:</strong> Iris creates complete websites with HTML, CSS, and JavaScript, including all necessary files and resources.
          </AlertDescription>
        </Alert>
      </DocsBody>

      <Separator className="my-8" />

      <DocsBody className="mb-8">
        <h2>What Iris Can Build</h2>
        <p className="mb-6">
          Iris uses modern web development practices to create websites that are fast, responsive, and visually appealing. Every website is built with clean code and best practices.
        </p>

        <div className="grid md:grid-cols-2 gap-6 mb-8">
          <DocsCard
            title="Responsive Design"
            description="Websites that look great on all devices"
            icon={Globe}
            variant="outline"
            hover
            className="h-full"
          >
            <DocsBullets variant="default" spacing="tight">
              <DocsBulletItem icon={CheckCircle2}>Mobile-first approach</DocsBulletItem>
              <DocsBulletItem icon={CheckCircle2}>Tablet and desktop optimized</DocsBulletItem>
              <DocsBulletItem icon={CheckCircle2}>Cross-browser compatibility</DocsBulletItem>
            </DocsBullets>
          </DocsCard>

          <DocsCard
            title="Modern Technologies"
            description="Built with HTML5, CSS3, and JavaScript"
            icon={Code}
            variant="outline"
            hover
            className="h-full"
          >
            <DocsBullets variant="default" spacing="tight">
              <DocsBulletItem icon={CheckCircle2}>Semantic HTML structure</DocsBulletItem>
              <DocsBulletItem icon={CheckCircle2}>Modern CSS features</DocsBulletItem>
              <DocsBulletItem icon={CheckCircle2}>Interactive JavaScript</DocsBulletItem>
            </DocsBullets>
          </DocsCard>

          <DocsCard
            title="Professional Styling"
            description="Beautiful designs with attention to detail"
            icon={Sparkles}
            variant="outline"
            hover
            className="h-full"
          >
            <DocsBullets variant="default" spacing="tight">
              <DocsBulletItem icon={CheckCircle2}>Custom color schemes</DocsBulletItem>
              <DocsBulletItem icon={CheckCircle2}>Typography and spacing</DocsBulletItem>
              <DocsBulletItem icon={CheckCircle2}>Visual effects and animations</DocsBulletItem>
            </DocsBullets>
          </DocsCard>

          <DocsCard
            title="Easy Deployment"
            description="Get your website online quickly"
            icon={Globe}
            variant="outline"
            hover
            className="h-full"
          >
            <DocsBullets variant="default" spacing="tight">
              <DocsBulletItem icon={CheckCircle2}>All files packaged in ZIP</DocsBulletItem>
              <DocsBulletItem icon={CheckCircle2}>Public URL for immediate access</DocsBulletItem>
              <DocsBulletItem icon={CheckCircle2}>Ready for any hosting platform</DocsBulletItem>
            </DocsBullets>
          </DocsCard>
        </div>
      </DocsBody>

      <Separator className="my-8" />

      <DocsBody className="mb-8">
        <h2>How to Create Websites</h2>
        <p className="mb-4">
          Describe your website idea, and Iris will build it for you:
        </p>

        <div className="mb-6">
          <CodeBlock 
            data={[{
              language: "markdown",
              filename: "website-example.md",
              code: `"Create a portfolio website with:
- Hero section with my name and tagline
- About section describing my background
- Projects showcase with images and descriptions
- Contact form
- Responsive design
- Modern, clean aesthetic"`
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
            <strong>Tip:</strong> Be specific about features, colors, and layout preferences. The more details you provide, the closer the result will match your vision.
          </AlertDescription>
        </Alert>
      </DocsBody>

      <Separator className="my-8" />

      <DocsBody className="mb-8">
        <h2>Website Creation Best Practices</h2>
        <DocsBullets variant="default" spacing="loose">
          <DocsBulletItem icon={Lightbulb}>
            <strong>Define Your Purpose:</strong> Tell Iris what the website is for—portfolio, product landing page, blog, etc. This helps determine the structure.
          </DocsBulletItem>
          <DocsBulletItem icon={Lightbulb}>
            <strong>Specify Content:</strong> Provide the actual text, images, and information you want on the site. Iris can suggest content if needed.
          </DocsBulletItem>
          <DocsBulletItem icon={Lightbulb}>
            <strong>Choose Style Preferences:</strong> Mention if you want modern, minimalist, bold, or any specific color scheme.
          </DocsBulletItem>
          <DocsBulletItem icon={Lightbulb}>
            <strong>Request Iterations:</strong> After seeing the website, ask Iris to modify specific sections or adjust the design.
          </DocsBulletItem>
        </DocsBullets>
      </DocsBody>

      <Separator className="my-8" />

      <DocsBody className="mb-8">
        <h2>Example Use Cases</h2>
        <div className="space-y-4">
          <DocsCard
            title="Landing Pages"
            description="Create conversion-focused landing pages for products or services"
            icon={Globe}
            variant="outline"
            hover
          >
            <p className="text-sm text-muted-foreground">
              "Create a landing page for a mobile app with hero section, features, pricing, and signup form"
            </p>
          </DocsCard>

          <DocsCard
            title="Portfolio Sites"
            description="Build personal or professional portfolio websites"
            icon={Globe}
            variant="outline"
            hover
          >
            <p className="text-sm text-muted-foreground">
              "Create a creative portfolio website showcasing my photography work with gallery and contact sections"
            </p>
          </DocsCard>

          <DocsCard
            title="Business Websites"
            description="Develop websites for businesses and organizations"
            icon={Globe}
            variant="outline"
            hover
          >
            <p className="text-sm text-muted-foreground">
              "Create a restaurant website with menu, location, hours, and reservation booking form"
            </p>
          </DocsCard>
        </div>
      </DocsBody>
    </>
  );
}
