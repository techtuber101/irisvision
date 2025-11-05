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
  Users,
  Briefcase,
  Lightbulb,
  CheckCircle2,
  Info,
  Search,
} from 'lucide-react';
import { Separator } from '@/components/ui/separator';

const breadcrumbs = [
  { title: 'Documentation', onClick: () => window.location.href = '/docs' },
  { title: 'Iris Capabilities', onClick: () => window.location.href = '/docs' },
  { title: 'Career & People Research' }
];

export default function CareerPeopleResearchPage() {
  return (
    <>
      <DocsHeader
        title="Career & People Research"
        subtitle="Discover professionals, companies, and career opportunities with Iris's specialized people and career research tools"
        breadcrumbs={breadcrumbs}
        lastUpdated="January 2025"
        showSeparator
        size="lg"
        className="mb-8 sm:mb-12"
      />

      <DocsBody className="mb-8">
        <p className="text-lg mb-6">
          Iris unlocks powerful career and people research capabilities that help you find professionals, explore companies, and discover opportunities. Whether you're recruiting talent, networking, researching competitors, or exploring career paths, Iris provides deep insights into people and organizations. With specialized search tools that go beyond basic web searches, Iris helps you build comprehensive profiles and make informed decisions about careers and connections.
        </p>

        <Alert className="mb-6">
          <Info className="h-4 w-4" />
          <AlertDescription>
            <strong>Professional Intelligence:</strong> Iris uses advanced search capabilities to find detailed information about professionals and companies that standard search engines can't provide.
          </AlertDescription>
        </Alert>
      </DocsBody>

      <Separator className="my-8" />

      <DocsBody className="mb-8">
        <h2>Research Capabilities</h2>
        <p className="mb-6">
          Iris offers specialized tools for finding and researching people and companies, making it easier to discover opportunities and make connections.
        </p>

        <div className="grid md:grid-cols-2 gap-6 mb-8">
          <DocsCard
            title="People Search"
            description="Find professionals with specific skills and backgrounds"
            icon={Users}
            variant="outline"
            hover
            className="h-full"
          >
            <DocsBullets variant="default" spacing="tight">
              <DocsBulletItem icon={CheckCircle2}>Natural language search queries</DocsBulletItem>
              <DocsBulletItem icon={CheckCircle2}>LinkedIn profile enrichment</DocsBulletItem>
              <DocsBulletItem icon={CheckCircle2}>Professional background information</DocsBulletItem>
              <DocsBulletItem icon={CheckCircle2}>Targeted talent discovery</DocsBulletItem>
            </DocsBullets>
          </DocsCard>

          <DocsCard
            title="Company Research"
            description="Explore companies and organizations in detail"
            icon={Briefcase}
            variant="outline"
            hover
            className="h-full"
          >
            <DocsBullets variant="default" spacing="tight">
              <DocsBulletItem icon={CheckCircle2}>Company information and details</DocsBulletItem>
              <DocsBulletItem icon={CheckCircle2}>Industry and market position</DocsBulletItem>
              <DocsBulletItem icon={CheckCircle2}>Key personnel identification</DocsBulletItem>
              <DocsBulletItem icon={CheckCircle2}>Competitive analysis</DocsBulletItem>
            </DocsBullets>
          </DocsCard>

          <DocsCard
            title="Career Exploration"
            description="Research career paths and opportunities"
            icon={Search}
            variant="outline"
            hover
            className="h-full"
          >
            <DocsBullets variant="default" spacing="tight">
              <DocsBulletItem icon={CheckCircle2}>Job market analysis</DocsBulletItem>
              <DocsBulletItem icon={CheckCircle2}>Role requirements research</DocsBulletItem>
              <DocsBulletItem icon={CheckCircle2}>Industry trends</DocsBulletItem>
              <DocsBulletItem icon={CheckCircle2}>Career path insights</DocsBulletItem>
            </DocsBullets>
          </DocsCard>

          <DocsCard
            title="Professional Profiles"
            description="Build comprehensive professional profiles"
            icon={Users}
            variant="outline"
            hover
            className="h-full"
          >
            <DocsBullets variant="default" spacing="tight">
              <DocsBulletItem icon={CheckCircle2}>Profile compilation</DocsBulletItem>
              <DocsBulletItem icon={CheckCircle2}>Experience and education</DocsBulletItem>
              <DocsBulletItem icon={CheckCircle2}>Skills and expertise</DocsBulletItem>
              <DocsBulletItem icon={CheckCircle2}>Contact information</DocsBulletItem>
            </DocsBullets>
          </DocsCard>
        </div>
      </DocsBody>

      <Separator className="my-8" />

      <DocsBody className="mb-8">
        <h2>How to Research People and Careers</h2>
        <p className="mb-4">
          Ask Iris to find professionals or research companies using natural language:
        </p>

        <div className="mb-6">
          <CodeBlock 
            data={[{
              language: "markdown",
              filename: "people-research-example.md",
              code: `"Find senior Python developers with machine learning 
experience at tech companies in San Francisco. Include their 
LinkedIn profiles and key skills."`
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
            <strong>Tip:</strong> Be specific about what you're looking for. Include location, role, skills, experience level, or company type to get better results.
          </AlertDescription>
        </Alert>
      </DocsBody>

      <Separator className="my-8" />

      <DocsBody className="mb-8">
        <h2>Research Best Practices</h2>
        <DocsBullets variant="default" spacing="loose">
          <DocsBulletItem icon={Lightbulb}>
            <strong>Use Natural Language:</strong> Describe what you're looking for in plain English. Iris understands complex queries about roles, skills, and locations.
          </DocsBulletItem>
          <DocsBulletItem icon={Lightbulb}>
            <strong>Specify Your Goals:</strong> Tell Iris why you're researching—recruiting, networking, competitive analysis, etc. This helps tailor the results.
          </DocsBulletItem>
          <DocsBulletItem icon={Lightbulb}>
            <strong>Request Enrichment:</strong> Ask for LinkedIn profiles, contact information, or other specific details you need.
          </DocsBulletItem>
          <DocsBulletItem icon={Lightbulb}>
            <strong>Combine Research:</strong> Ask Iris to research multiple people or companies and create comparative reports.
          </DocsBulletItem>
        </DocsBullets>
      </DocsBody>

      <Separator className="my-8" />

      <DocsBody className="mb-8">
        <h2>Example Use Cases</h2>
        <div className="space-y-4">
          <DocsCard
            title="Talent Acquisition"
            description="Find qualified candidates for open positions"
            icon={Users}
            variant="outline"
            hover
          >
            <p className="text-sm text-muted-foreground">
              "Find CTOs at AI startups in San Francisco with experience in scaling engineering teams"
            </p>
          </DocsCard>

          <DocsCard
            title="Competitive Research"
            description="Research competitors and their key personnel"
            icon={Briefcase}
            variant="outline"
            hover
          >
            <p className="text-sm text-muted-foreground">
              "Find marketing managers at Fortune 500 companies in New York and analyze their backgrounds"
            </p>
          </DocsCard>

          <DocsCard
            title="Career Planning"
            description="Explore career paths and opportunities"
            icon={Search}
            variant="outline"
            hover
          >
            <p className="text-sm text-muted-foreground">
              "Research career paths for data scientists, including required skills, typical roles, and top companies"
            </p>
          </DocsCard>
        </div>
      </DocsBody>
    </>
  );
}
