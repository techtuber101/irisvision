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
  Database,
  BarChart3,
  FileSpreadsheet,
  Lightbulb,
  CheckCircle2,
  Info,
  TrendingUp,
} from 'lucide-react';
import { Separator } from '@/components/ui/separator';

const breadcrumbs = [
  { title: 'Documentation', onClick: () => window.location.href = '/docs' },
  { title: 'Iris Capabilities', onClick: () => window.location.href = '/docs' },
  { title: 'Data' }
];

export default function DataPage() {
  return (
    <>
      <DocsHeader
        title="Data"
        subtitle="Transform raw data into actionable insights with Iris's powerful data analysis and processing capabilities"
        breadcrumbs={breadcrumbs}
        lastUpdated="January 2025"
        showSeparator
        size="lg"
        className="mb-8 sm:mb-12"
      />

      <DocsBody className="mb-8">
        <p className="text-lg mb-6">
          Iris makes data work for you by analyzing, processing, and visualizing information in ways that reveal meaningful patterns and insights. Whether you're working with spreadsheets, databases, or raw data files, Iris can clean, transform, analyze, and present your data in formats that make sense. From simple calculations to complex statistical analysis, Iris handles data tasks with precision and clarity.
        </p>

        <Alert className="mb-6">
          <Info className="h-4 w-4" />
          <AlertDescription>
            <strong>Data Intelligence:</strong> Iris doesn't just process data—it understands it, finds patterns, and presents insights in clear, actionable formats.
          </AlertDescription>
        </Alert>
      </DocsBody>

      <Separator className="my-8" />

      <DocsBody className="mb-8">
        <h2>Data Capabilities</h2>
        <p className="mb-6">
          Iris offers comprehensive data handling capabilities that cover everything from basic processing to advanced analysis and visualization.
        </p>

        <div className="grid md:grid-cols-2 gap-6 mb-8">
          <DocsCard
            title="Data Processing"
            description="Clean, transform, and structure data efficiently"
            icon={Database}
            variant="outline"
            hover
            className="h-full"
          >
            <DocsBullets variant="default" spacing="tight">
              <DocsBulletItem icon={CheckCircle2}>Data cleaning and validation</DocsBulletItem>
              <DocsBulletItem icon={CheckCircle2}>Format conversion</DocsBulletItem>
              <DocsBulletItem icon={CheckCircle2}>Data merging and joining</DocsBulletItem>
            </DocsBullets>
          </DocsCard>

          <DocsCard
            title="Analysis & Insights"
            description="Extract meaningful insights from your data"
            icon={TrendingUp}
            variant="outline"
            hover
            className="h-full"
          >
            <DocsBullets variant="default" spacing="tight">
              <DocsBulletItem icon={CheckCircle2}>Statistical analysis</DocsBulletItem>
              <DocsBulletItem icon={CheckCircle2}>Pattern recognition</DocsBulletItem>
              <DocsBulletItem icon={CheckCircle2}>Trend identification</DocsBulletItem>
            </DocsBullets>
          </DocsCard>

          <DocsCard
            title="Visualization"
            description="Create charts and graphs to visualize data"
            icon={BarChart3}
            variant="outline"
            hover
            className="h-full"
          >
            <DocsBullets variant="default" spacing="tight">
              <DocsBulletItem icon={CheckCircle2}>Multiple chart types</DocsBulletItem>
              <DocsBulletItem icon={CheckCircle2}>Custom styling</DocsBulletItem>
              <DocsBulletItem icon={CheckCircle2}>Interactive visualizations</DocsBulletItem>
            </DocsBullets>
          </DocsCard>

          <DocsCard
            title="Report Generation"
            description="Create comprehensive data reports"
            icon={FileSpreadsheet}
            variant="outline"
            hover
            className="h-full"
          >
            <DocsBullets variant="default" spacing="tight">
              <DocsBulletItem icon={CheckCircle2}>Formatted reports</DocsBulletItem>
              <DocsBulletItem icon={CheckCircle2}>Summary statistics</DocsBulletItem>
              <DocsBulletItem icon={CheckCircle2}>Export capabilities</DocsBulletItem>
            </DocsBullets>
          </DocsCard>
        </div>
      </DocsBody>

      <Separator className="my-8" />

      <DocsBody className="mb-8">
        <h2>How to Work with Data</h2>
        <p className="mb-4">
          Describe your data task, and Iris will handle it:
        </p>

        <div className="mb-6">
          <CodeBlock 
            data={[{
              language: "markdown",
              filename: "data-example.md",
              code: `"Analyze this sales data CSV file:
- Calculate total revenue by month
- Identify top 5 products by sales
- Create a chart showing monthly trends
- Generate a summary report with key insights"`
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
            <strong>Tip:</strong> Upload your data files first, then ask Iris to analyze them. Iris can work with CSV, JSON, Excel, and other common formats.
          </AlertDescription>
        </Alert>
      </DocsBody>

      <Separator className="my-8" />

      <DocsBody className="mb-8">
        <h2>Data Best Practices</h2>
        <DocsBullets variant="default" spacing="loose">
          <DocsBulletItem icon={Lightbulb}>
            <strong>Upload Data First:</strong> Provide Iris with your data files before asking for analysis. Iris can read various file formats.
          </DocsBulletItem>
          <DocsBulletItem icon={Lightbulb}>
            <strong>Specify Your Goals:</strong> Tell Iris what insights you're looking for. Are you trying to find trends? Compare metrics? Identify outliers?
          </DocsBulletItem>
          <DocsBulletItem icon={Lightbulb}>
            <strong>Request Visualizations:</strong> Ask for charts or graphs to make data easier to understand and present.
          </DocsBulletItem>
          <DocsBulletItem icon={Lightbulb}>
            <strong>Ask for Explanations:</strong> Request that Iris explain what the data means, not just what it shows.
          </DocsBulletItem>
        </DocsBullets>
      </DocsBody>

      <Separator className="my-8" />

      <DocsBody className="mb-8">
        <h2>Example Use Cases</h2>
        <div className="space-y-4">
          <DocsCard
            title="Sales Analytics"
            description="Analyze sales data to identify trends and opportunities"
            icon={TrendingUp}
            variant="outline"
            hover
          >
            <p className="text-sm text-muted-foreground">
              "Analyze monthly sales data, identify best-selling products, calculate growth rates, and create visualizations"
            </p>
          </DocsCard>

          <DocsCard
            title="Survey Analysis"
            description="Process and analyze survey responses"
            icon={Database}
            variant="outline"
            hover
          >
            <p className="text-sm text-muted-foreground">
              "Analyze customer satisfaction survey responses, calculate average scores, and identify common themes"
            </p>
          </DocsCard>

          <DocsCard
            title="Financial Reports"
            description="Process financial data and generate reports"
            icon={BarChart3}
            variant="outline"
            hover
          >
            <p className="text-sm text-muted-foreground">
              "Analyze quarterly financial data, calculate key metrics, and create a formatted report with charts"
            </p>
          </DocsCard>
        </div>
      </DocsBody>
    </>
  );
}
