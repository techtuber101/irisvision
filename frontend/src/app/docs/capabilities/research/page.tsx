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
  Search, 
  Globe,
  FileText,
  Lightbulb,
  CheckCircle2,
  Info,
  BookOpen,
} from 'lucide-react';
import { Separator } from '@/components/ui/separator';

const breadcrumbs = [
  { title: 'Documentation', onClick: () => window.location.href = '/docs' },
  { title: 'Iris Capabilities', onClick: () => window.location.href = '/docs' },
  { title: 'Research' }
];

export default function ResearchPage() {
  return (
    <>
      <DocsHeader
        title="Research"
        subtitle="Transform complex research tasks into comprehensive insights with Iris's powerful research capabilities"
        breadcrumbs={breadcrumbs}
        lastUpdated="January 2025"
        showSeparator
        size="lg"
        className="mb-8 sm:mb-12"
      />

      <DocsBody className="mb-8">
        <p className="text-lg mb-6">
          Iris empowers you to conduct thorough research that goes beyond simple web searches. With advanced tools for discovering information, analyzing sources, and synthesizing findings, Iris transforms the way you gather and understand knowledge. Whether you're exploring academic topics, investigating market trends, or diving deep into any subject, Iris serves as your intelligent research companion that never misses a detail.
        </p>

        <Alert className="mb-6">
          <Info className="h-4 w-4" />
          <AlertDescription>
            <strong>Research Made Simple:</strong> Iris combines multiple research tools to give you comprehensive, well-sourced information in minutes, not hours.
          </AlertDescription>
        </Alert>
      </DocsBody>

      <Separator className="my-8" />

      <DocsBody className="mb-8">
        <h2>What Makes Iris Research Special</h2>
        <p className="mb-6">
          Iris doesn't just search—it researches intelligently. By leveraging multiple specialized tools and advanced search capabilities, Iris delivers research results that are comprehensive, accurate, and well-organized.
        </p>

        <div className="grid md:grid-cols-2 gap-6 mb-8">
          <DocsCard
            title="Web Search"
            description="Search the internet with Tavily API for up-to-date information"
            icon={Search}
            variant="outline"
            hover
            className="h-full"
          >
            <DocsBullets variant="default" spacing="tight">
              <DocsBulletItem icon={CheckCircle2}>Real-time search results</DocsBulletItem>
              <DocsBulletItem icon={CheckCircle2}>Intelligent answer synthesis</DocsBulletItem>
              <DocsBulletItem icon={CheckCircle2}>Multiple source verification</DocsBulletItem>
            </DocsBullets>
          </DocsCard>

          <DocsCard
            title="Image Search"
            description="Find relevant images and visual content for your research"
            icon={Search}
            variant="outline"
            hover
            className="h-full"
          >
            <DocsBullets variant="default" spacing="tight">
              <DocsBulletItem icon={CheckCircle2}>Visual content discovery</DocsBulletItem>
              <DocsBulletItem icon={CheckCircle2}>High-quality image results</DocsBulletItem>
              <DocsBulletItem icon={CheckCircle2}>Batch image searching</DocsBulletItem>
            </DocsBullets>
          </DocsCard>

          <DocsCard
            title="Browser Automation"
            description="Navigate websites, extract data, and interact with web pages"
            icon={Globe}
            variant="outline"
            hover
            className="h-full"
          >
            <DocsBullets variant="default" spacing="tight">
              <DocsBulletItem icon={CheckCircle2}>Automated web navigation</DocsBulletItem>
              <DocsBulletItem icon={CheckCircle2}>Content extraction</DocsBulletItem>
              <DocsBulletItem icon={CheckCircle2}>Multi-page data gathering</DocsBulletItem>
            </DocsBullets>
          </DocsCard>

          <DocsCard
            title="Academic Papers"
            description="Search and analyze research papers from arXiv, PubMed, IEEE, and more"
            icon={BookOpen}
            variant="outline"
            hover
            className="h-full"
          >
            <DocsBullets variant="default" spacing="tight">
              <DocsBulletItem icon={CheckCircle2}>Academic database access</DocsBulletItem>
              <DocsBulletItem icon={CheckCircle2}>Paper analysis and summaries</DocsBulletItem>
              <DocsBulletItem icon={CheckCircle2}>Citation extraction</DocsBulletItem>
            </DocsBullets>
          </DocsCard>
        </div>
      </DocsBody>

      <Separator className="my-8" />

      <DocsBody className="mb-8">
        <h2>How to Use Research Capabilities</h2>
        <p className="mb-4">
          Simply ask Iris to research any topic. Here are some examples:
        </p>

        <div className="mb-6">
          <CodeBlock 
            data={[{
              language: "markdown",
              filename: "research-example.md",
              code: `"Research the latest developments in quantum computing and 
create a comprehensive report with:
- Key breakthroughs in the last year
- Major companies and researchers involved
- Current challenges and future prospects
- Relevant academic papers and citations"`
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
            <strong>Pro Tip:</strong> Be specific about what you need. The more details you provide, the better Iris can tailor the research to your needs.
          </AlertDescription>
        </Alert>
      </DocsBody>

      <Separator className="my-8" />

      <DocsBody className="mb-8">
        <h2>Research Best Practices</h2>
        <DocsBullets variant="default" spacing="loose">
          <DocsBulletItem icon={Lightbulb}>
            <strong>Specify Your Goals:</strong> Tell Iris what you want to achieve with the research. Are you preparing for a presentation? Writing a paper? Making a business decision?
          </DocsBulletItem>
          <DocsBulletItem icon={Lightbulb}>
            <strong>Request Multiple Sources:</strong> Ask Iris to consult multiple sources to ensure comprehensive coverage of your topic.
          </DocsBulletItem>
          <DocsBulletItem icon={Lightbulb}>
            <strong>Ask for Citations:</strong> Request that Iris include citations and sources so you can verify information and reference it properly.
          </DocsBulletItem>
          <DocsBulletItem icon={Lightbulb}>
            <strong>Iterate and Refine:</strong> Don't hesitate to ask follow-up questions or request more specific information after initial research.
          </DocsBulletItem>
        </DocsBullets>
      </DocsBody>

      <Separator className="my-8" />

      <DocsBody className="mb-8">
        <h2>Example Use Cases</h2>
        <div className="space-y-4">
          <DocsCard
            title="Market Research"
            description="Research competitors, market trends, and industry analysis"
            icon={Search}
            variant="outline"
            hover
          >
            <p className="text-sm text-muted-foreground">
              "Research the AI chatbot market, identify top 5 competitors, analyze their features, and create a comparison report"
            </p>
          </DocsCard>

          <DocsCard
            title="Academic Research"
            description="Find and analyze academic papers on specific topics"
            icon={BookOpen}
            variant="outline"
            hover
          >
            <p className="text-sm text-muted-foreground">
              "Find recent papers on neural architecture search, summarize key findings, and extract citations"
            </p>
          </DocsCard>

          <DocsCard
            title="Content Research"
            description="Gather information for articles, blog posts, or presentations"
            icon={FileText}
            variant="outline"
            hover
          >
            <p className="text-sm text-muted-foreground">
              "Research sustainable energy solutions, gather statistics, find expert opinions, and create an outline for a blog post"
            </p>
          </DocsCard>
        </div>
      </DocsBody>
    </>
  );
}
