'use client';

import * as React from 'react';
import { 
  DocsHeader,
  DocsCard,
  DocsBody,
  DocsImage,
  DocsBullets,
  DocsBulletItem,
  DocsTable,
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
  Bot, 
  FileText, 
  Search, 
  Globe, 
  Code, 
  Image as ImageIcon,
  Zap,
  Calendar,
  Database,
  Palette,
  Lock,
  Rocket,
  Settings,
  CheckCircle2,
  Info,
  AlertTriangle,
  BookOpen,
  Sparkles,
  Webhook,
  Workflow,
  Eye,
  Presentation,
  Upload,
  Lightbulb,
} from 'lucide-react';
import { Separator } from '@/components/ui/separator';
import { Card } from '@/components/ui/card';

const breadcrumbs = [
  { title: 'Documentation', onClick: () => window.location.href = '/docs' },
  { title: 'User Guide' }
];

export default function UserGuidePage() {
  return (
    <>
      <DocsHeader
        title="Complete User Guide to Iris"
        subtitle="Master all features and capabilities of Iris - your AI agent platform"
        breadcrumbs={breadcrumbs}
        lastUpdated="January 2025"
        showSeparator
        size="lg"
        className="mb-8 sm:mb-12"
      />

      <DocsBody className="mb-8">
        <h2 id="overview">Welcome to Iris</h2>
        <p className="text-lg mb-6">
          This comprehensive guide will help you discover everything Iris can do. From basic chat interactions to advanced automation workflows, you'll learn how to leverage Iris's powerful capabilities to automate your work.
        </p>
        
        <Alert className="mb-6">
          <Info className="h-4 w-4" />
          <AlertDescription>
            <strong>Tip:</strong> This guide covers all features available in Iris. Bookmark this page for quick reference!
          </AlertDescription>
        </Alert>
      </DocsBody>

      <Separator className="my-8" />

      {/* Core Capabilities */}
      <DocsBody className="mb-8">
        <h2 id="core-capabilities">Core Capabilities</h2>
        <p className="mb-6">
          Iris comes with a powerful set of built-in tools that enable your agents to interact with the digital world:
        </p>

        <div className="grid md:grid-cols-2 gap-6 mb-8">
          <DocsCard
            title="File Management"
            description="Create, edit, and organize files and documents"
            icon={FileText}
            variant="outline"
            hover
            className="h-full"
          >
            <DocsBullets variant="default" spacing="tight">
              <DocsBulletItem icon={CheckCircle2}>Create and edit text files</DocsBulletItem>
              <DocsBulletItem icon={CheckCircle2}>Organize files into directories</DocsBulletItem>
              <DocsBulletItem icon={CheckCircle2}>Process and transform documents</DocsBulletItem>
              <DocsBulletItem icon={CheckCircle2}>Generate reports and summaries</DocsBulletItem>
            </DocsBullets>
          </DocsCard>

          <DocsCard
            title="Web Search & Research"
            description="Search the internet and gather information"
            icon={Search}
            variant="outline"
            hover
            className="h-full"
          >
            <DocsBullets variant="default" spacing="tight">
              <DocsBulletItem icon={CheckCircle2}>Real-time web search</DocsBulletItem>
              <DocsBulletItem icon={CheckCircle2}>Multi-source information gathering</DocsBulletItem>
              <DocsBulletItem icon={CheckCircle2}>Image search capabilities</DocsBulletItem>
              <DocsBulletItem icon={CheckCircle2}>People and company search</DocsBulletItem>
            </DocsBullets>
          </DocsCard>

          <DocsCard
            title="Browser Automation"
            description="Navigate websites and interact with web pages"
            icon={Globe}
            variant="outline"
            hover
            className="h-full"
          >
            <DocsBullets variant="default" spacing="tight">
              <DocsBulletItem icon={CheckCircle2}>Navigate complex websites</DocsBulletItem>
              <DocsBulletItem icon={CheckCircle2}>Extract data from web pages</DocsBulletItem>
              <DocsBulletItem icon={CheckCircle2}>Fill forms and submit data</DocsBulletItem>
              <DocsBulletItem icon={CheckCircle2}>Automate web workflows</DocsBulletItem>
            </DocsBullets>
          </DocsCard>

          <DocsCard
            title="Code Execution"
            description="Run commands and execute scripts"
            icon={Code}
            variant="outline"
            hover
            className="h-full"
          >
            <DocsBullets variant="default" spacing="tight">
              <DocsBulletItem icon={CheckCircle2}>Execute shell commands</DocsBulletItem>
              <DocsBulletItem icon={CheckCircle2}>Run Python scripts</DocsBulletItem>
              <DocsBulletItem icon={CheckCircle2}>System administration tasks</DocsBulletItem>
              <DocsBulletItem icon={CheckCircle2}>Development workflows</DocsBulletItem>
            </DocsBullets>
          </DocsCard>

          <DocsCard
            title="Image & Vision"
            description="Analyze images and create visual content"
            icon={ImageIcon}
            variant="outline"
            hover
            className="h-full"
          >
            <DocsBullets variant="default" spacing="tight">
              <DocsBulletItem icon={CheckCircle2}>Analyze images and screenshots</DocsBulletItem>
              <DocsBulletItem icon={CheckCircle2}>Extract text from images</DocsBulletItem>
              <DocsBulletItem icon={CheckCircle2}>Edit and manipulate images</DocsBulletItem>
              <DocsBulletItem icon={CheckCircle2}>Create visual designs</DocsBulletItem>
            </DocsBullets>
          </DocsCard>

          <DocsCard
            title="API Integrations"
            description="Connect with external services and APIs"
            icon={Webhook}
            variant="outline"
            hover
            className="h-full"
          >
            <DocsBullets variant="default" spacing="tight">
              <DocsBulletItem icon={CheckCircle2}>Access 2700+ integrations</DocsBulletItem>
              <DocsBulletItem icon={CheckCircle2}>Gmail, Slack, GitHub, and more</DocsBulletItem>
              <DocsBulletItem icon={CheckCircle2}>Database connections</DocsBulletItem>
              <DocsBulletItem icon={CheckCircle2}>Custom API calls</DocsBulletItem>
            </DocsBullets>
          </DocsCard>
        </div>
      </DocsBody>

      <Separator className="my-8" />

      {/* Image Generation */}
      <DocsBody className="mb-8">
        <h2 id="image-generation">Image Generation & Design</h2>
        <p className="mb-6">
          Iris can generate and edit images using AI, create professional graphics for social media, and design visual content. Perfect for creating images from scratch or editing existing ones.
        </p>

        <h3 id="image-generation-capabilities">What Iris Can Do</h3>
        <DocsBullets variant="default" spacing="loose">
          <DocsBulletItem icon={ImageIcon}>
            <strong>Generate Images:</strong> Create images from text prompts using Google's Imagen 4.0
          </DocsBulletItem>
          <DocsBulletItem icon={ImageIcon}>
            <strong>Edit Images:</strong> Modify existing images by adding, removing, or changing elements
          </DocsBulletItem>
          <DocsBulletItem icon={Palette}>
            <strong>Professional Graphics:</strong> Design social media posts, ads, banners, and marketing materials
          </DocsBulletItem>
          <DocsBulletItem icon={Palette}>
            <strong>Platform-Specific Sizes:</strong> Optimized dimensions for Instagram, Facebook, Twitter, LinkedIn, YouTube, and more
          </DocsBulletItem>
          <DocsBulletItem icon={Palette}>
            <strong>Design Styles:</strong> Modern, minimalist, material, glassmorphism, neomorphism, and 11+ more styles
          </DocsBulletItem>
          <DocsBulletItem icon={ImageIcon}>
            <strong>Custom Dimensions:</strong> Specify exact pixel dimensions (256-4096px range)
          </DocsBulletItem>
        </DocsBullets>

        <h3 id="how-to-use-image-generation">How to Use Image Generation</h3>
        <p className="mb-4">
          Simply describe what you want to create or edit:
        </p>

        <div className="mb-6">
          <CodeBlock 
            data={[{
              language: "markdown",
              filename: "image-examples.md",
              code: `# Generate a new image
"Create an image of a futuristic cityscape at sunset with flying cars"

# Edit an existing image  
"Edit the image at path/to/image.png to add a rainbow in the sky"

# Create social media graphics
"Create an Instagram post graphic for a tech startup launch event:
- Size: Instagram square (1080x1080)
- Style: Modern tech aesthetic
- Content: 'Launching Soon' text with tech visuals
- Colors: Blue and purple gradient"

# Professional design
"Design a LinkedIn banner for a marketing agency:
- Platform: LinkedIn banner
- Style: Professional
- Include: Company logo placement area and tagline space
- Colors: Corporate blue and white"`

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

        <h3 id="comprehensive-image-instructions">Comprehensive Instructions for Image Generation</h3>
        <p className="mb-4">
          For best results, provide detailed instructions:
        </p>

        <DocsTable
          columns={[
            { key: 'element', title: 'Element', width: '150px' },
            { key: 'description', title: 'Description' },
            { key: 'example', title: 'Example' },
          ]}
          data={[
            {
              element: 'Subject',
              description: 'What should be in the image',
              example: 'A coffee shop interior, a robot assistant, a mountain landscape'
            },
            {
              element: 'Style',
              description: 'Visual aesthetic and mood',
              example: 'Modern, minimalist, vintage, professional, playful'
            },
            {
              element: 'Colors',
              description: 'Color palette and scheme',
              example: 'Blue and purple gradient, warm earth tones, corporate navy'
            },
            {
              element: 'Composition',
              description: 'Layout and arrangement',
              example: 'Centered subject, rule of thirds, symmetrical design'
            },
            {
              element: 'Text',
              description: 'Any text or typography needed',
              example: 'Include "Sale 50% Off" text in bold, add tagline at bottom'
            },
            {
              element: 'Dimensions',
              description: 'Size requirements',
              example: 'Instagram square (1080x1080), custom 1920x1080'
            },
          ]}
          variant="default"
          size="default"
        />

        <h3 id="image-generation-tips">Special Tips for Image Generation</h3>
        <Alert className="mb-4">
          <Lightbulb className="h-4 w-4" />
          <AlertDescription>
            <strong>Pro Tips:</strong>
          </AlertDescription>
        </Alert>
        <DocsBullets variant="default" spacing="tight">
          <DocsBulletItem icon={Lightbulb}>
            <strong>Be Specific:</strong> Instead of "a landscape," say "a serene mountain landscape at sunrise with misty valleys and pine trees"
          </DocsBulletItem>
          <DocsBulletItem icon={Lightbulb}>
            <strong>Mention Style:</strong> Specify "modern," "minimalist," or "vintage" to get the aesthetic you want
          </DocsBulletItem>
          <DocsBulletItem icon={Lightbulb}>
            <strong>Platform Optimization:</strong> Use platform presets (Instagram, LinkedIn, etc.) for optimal sizing
          </DocsBulletItem>
          <DocsBulletItem icon={Lightbulb}>
            <strong>Quality Settings:</strong> Use "high" quality for final assets, "auto" for quick iterations
          </DocsBulletItem>
          <DocsBulletItem icon={Lightbulb}>
            <strong>Iterate:</strong> Generate a base image, then ask Iris to edit specific elements
          </DocsBulletItem>
          <DocsBulletItem icon={Lightbulb}>
            <strong>Combine with Design:</strong> Use the designer tool for social media graphics with professional layouts
          </DocsBulletItem>
        </DocsBullets>

        <h3 id="image-editing-examples">Image Editing Examples</h3>
        <div className="mb-6">
          <CodeBlock 
            data={[{
              language: "markdown",
              filename: "edit-examples.md",
              code: `# Simple edits
"Add a sunset sky to the image at path/to/image.png"

# Complex edits
"Edit the product photo to:
- Remove the background and replace with white
- Add a subtle shadow beneath the product
- Enhance the colors to be more vibrant"

# Creative modifications
"Transform this photo into a watercolor painting style while keeping the original composition"`

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
      </DocsBody>

      <Separator className="my-8" />

      {/* Slide/Presentation Generation */}
      <DocsBody className="mb-8">
        <h2 id="slide-generation">Presentation & Slide Generation</h2>
        <p className="mb-6">
          Create professional HTML presentations with beautiful slide designs. Iris can generate multi-slide presentations with rich formatting, animations, and interactive elements.
        </p>

        <h3 id="presentation-capabilities">What Iris Can Do</h3>
        <DocsBullets variant="default" spacing="loose">
          <DocsBulletItem icon={Presentation}>
            <strong>Individual Slides:</strong> Create slides one at a time, each as a standalone HTML file (1920x1080 resolution)
          </DocsBulletItem>
          <DocsBulletItem icon={Presentation}>
            <strong>Multiple Themes:</strong> Choose from 10+ visual styles (modern, minimal, dark, corporate, vibrant, slate, etc.)
          </DocsBulletItem>
          <DocsBulletItem icon={Presentation}>
            <strong>Rich Content:</strong> Text, images, code blocks, tables, charts, and formatted content
          </DocsBulletItem>
          <DocsBulletItem icon={Presentation}>
            <strong>Interactive Elements:</strong> Navigation, animations, D3.js charts, Chart.js visualizations
          </DocsBulletItem>
          <DocsBulletItem icon={Presentation}>
            <strong>Image Integration:</strong> Include images from web search or user uploads
          </DocsBulletItem>
          <DocsBulletItem icon={Presentation}>
            <strong>Iterative Editing:</strong> Update individual slides without affecting others
          </DocsBulletItem>
          <DocsBulletItem icon={Presentation}>
            <strong>Navigation System:</strong> Automatic slide navigation with previews
          </DocsBulletItem>
          <DocsBulletItem icon={Presentation}>
            <strong>Responsive Design:</strong> Scales beautifully to any screen size
          </DocsBulletItem>
        </DocsBullets>

        <h3 id="how-to-use-presentations">How to Use Presentation Generation</h3>
        <p className="mb-4">
          Describe your presentation needs:
        </p>

        <div className="mb-6">
          <CodeBlock 
            data={[{
              language: "markdown",
              filename: "presentation-examples.md",
              code: `# Simple presentation request
"Create a 5-slide presentation about AI agents:
- Slide 1: Title slide with 'AI Agents' 
- Slide 2: What are AI agents?
- Slide 3: Use cases and examples
- Slide 4: Benefits of using agents
- Slide 5: Getting started with Iris"

# Detailed presentation
"Create a professional presentation called 'Product Launch 2024':
- Theme: Modern corporate style
- Slide 1: Title slide with company logo area and tagline
- Slide 2: Problem statement with statistics
- Slide 3: Our solution with feature highlights
- Slide 4: Market opportunity with a chart
- Slide 5: Call to action with contact information
- Include navigation between slides"

# Presentation with specific content
"Create a technical presentation about Python decorators:
- Theme: Dark theme for code-heavy content
- Include code examples with syntax highlighting
- Add diagrams explaining concepts
- Use professional typography
- Make it suitable for a developer audience"`

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

        <h3 id="comprehensive-presentation-instructions">Comprehensive Instructions for Presentations</h3>
        <p className="mb-4">
          Provide detailed specifications for best results:
        </p>

        <DocsTable
          columns={[
            { key: 'element', title: 'Element', width: '150px' },
            { key: 'description', title: 'Description' },
            { key: 'example', title: 'Example' },
          ]}
          data={[
            {
              element: 'Presentation Name',
              description: 'Unique identifier for your presentation',
              example: 'product_launch_2024, company_overview, sales_pitch'
            },
            {
              element: 'Theme',
              description: 'Visual style and color scheme',
              example: 'modern, minimal, dark, corporate, vibrant, slate'
            },
            {
              element: 'Slide Count',
              description: 'Number of slides needed',
              example: '5 slides, 10 slides, 3 slides'
            },
            {
              element: 'Slide Content',
              description: 'What each slide should contain',
              example: 'Title slide, bullet points, charts, code examples'
            },
            {
              element: 'Typography',
              description: 'Text styling preferences',
              example: 'Bold headings, readable body text, professional fonts'
            },
            {
              element: 'Images',
              description: 'Visual elements to include',
              example: 'Company logo, product photos, charts, diagrams'
            },
            {
              element: 'Interactive Elements',
              description: 'Special features needed',
              example: 'Navigation buttons, animated transitions, clickable charts'
            },
          ]}
          variant="default"
          size="default"
        />

        <h3 id="presentation-tips">Special Tips for Presentations</h3>
        <Alert className="mb-4">
          <Lightbulb className="h-4 w-4" />
          <AlertDescription>
            <strong>Pro Tips:</strong>
          </AlertDescription>
        </Alert>
        <DocsBullets variant="default" spacing="tight">
          <DocsBulletItem icon={Lightbulb}>
            <strong>One Idea Per Slide:</strong> Keep slides focused - 1-2 main ideas maximum
          </DocsBulletItem>
          <DocsBulletItem icon={Lightbulb}>
            <strong>Limit Bullet Points:</strong> Use 3-5 bullet points maximum per slide for readability
          </DocsBulletItem>
          <DocsBulletItem icon={Lightbulb}>
            <strong>White Space:</strong> Don't fill every pixel - embrace whitespace for professional look
          </DocsBulletItem>
          <DocsBulletItem icon={Lightbulb}>
            <strong>Visual Hierarchy:</strong> Use different font sizes (48-72px titles, 20-24px body)
          </DocsBulletItem>
          <DocsBulletItem icon={Lightbulb}>
            <strong>Iterative Building:</strong> Create slides one at a time, then refine individual slides
          </DocsBulletItem>
          <DocsBulletItem icon={Lightbulb}>
            <strong>Theme Consistency:</strong> Stick to one theme throughout for professional appearance
          </DocsBulletItem>
          <DocsBulletItem icon={Lightbulb}>
            <strong>Use Charts:</strong> Leverage D3.js and Chart.js for data visualizations
          </DocsBulletItem>
          <DocsBulletItem icon={Lightbulb}>
            <strong>Code Blocks:</strong> Include syntax-highlighted code for technical presentations
          </DocsBulletItem>
        </DocsBullets>

        <h3 id="presentation-structure-example">Example: Structured Presentation Request</h3>
        <div className="mb-6">
          <CodeBlock 
            data={[{
              language: "markdown",
              filename: "structured-presentation.md",
              code: `"Create a professional 7-slide presentation called 'Q4 Results':

Theme: Corporate modern style
Slide dimensions: 1920x1080 (16:9)

Slide 1: Title Slide
- Main title: 'Q4 2024 Results'
- Subtitle: 'Company Name'
- Include logo placement area
- Use gradient background

Slide 2: Executive Summary
- Key metrics overview
- 3-4 main bullet points
- Include icons for visual interest

Slide 3: Revenue Performance
- Title: 'Revenue Growth'
- Include a bar chart showing quarterly growth
- Add percentage changes
- Use Chart.js for visualization

Slide 4: Key Achievements
- List top 5 achievements
- Use checkmark icons
- Bold text for emphasis

Slide 5: Challenges & Solutions
- Two-column layout
- Left: Challenges faced
- Right: Solutions implemented

Slide 6: Team Highlights
- Feature 3 team members
- Include photos (placeholder areas)
- Name, role, contribution

Slide 7: Looking Ahead
- Title: '2025 Roadmap'
- List 3-4 key initiatives
- Call to action at bottom

Requirements:
- Consistent color scheme throughout
- Professional typography
- Navigation between slides
- Responsive design"`

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
      </DocsBody>

      <Separator className="my-8" />

      {/* Research Capabilities */}
      <DocsBody className="mb-8">
        <h2 id="research">Research & Information Gathering</h2>
        <p className="mb-6">
          Iris excels at research tasks. It can search the web, browse websites, extract information, and synthesize findings into comprehensive reports.
        </p>

        <h3 id="research-capabilities">What Iris Can Do</h3>
        <DocsBullets variant="default" spacing="loose">
          <DocsBulletItem icon={Search}>
            <strong>Web Search:</strong> Search the internet using Tavily API with up-to-date results
          </DocsBulletItem>
          <DocsBulletItem icon={Search}>
            <strong>Image Search:</strong> Find relevant images for your research topics
          </DocsBulletItem>
          <DocsBulletItem icon={Search}>
            <strong>People & Company Search:</strong> Look up individuals and organizations
          </DocsBulletItem>
          <DocsBulletItem icon={Globe}>
            <strong>Browser Automation:</strong> Navigate websites, click buttons, fill forms, extract data
          </DocsBulletItem>
          <DocsBulletItem icon={Globe}>
            <strong>Web Scraping:</strong> Extract content from web pages automatically
          </DocsBulletItem>
          <DocsBulletItem icon={FileText}>
            <strong>Academic Papers:</strong> Search and analyze research papers from arXiv, PubMed, IEEE, and more
          </DocsBulletItem>
          <DocsBulletItem icon={Search}>
            <strong>Multi-Source Research:</strong> Gather information from multiple sources and synthesize
          </DocsBulletItem>
          <DocsBulletItem icon={FileText}>
            <strong>Report Generation:</strong> Create comprehensive research reports with citations
          </DocsBulletItem>
        </DocsBullets>

        <h3 id="how-to-use-research">How to Use Research Capabilities</h3>
        <p className="mb-4">
          Ask Iris to research any topic:
        </p>

        <div className="mb-6">
          <CodeBlock 
            data={[{
              language: "markdown",
              filename: "research-examples.md",
              code: `# Simple research
"Search for the latest developments in AI agents and create a summary"

# Comprehensive research
"Research the competitive landscape for AI agent platforms:
- Find top 5 competitors
- Compare their features
- Analyze pricing models
- Create a comparison table
- Include links to sources"

# Multi-step research
"Research Python decorators:
1. Search for recent articles and tutorials
2. Find code examples
3. Identify common use cases
4. Create a comprehensive guide document
5. Include a table comparing different patterns"

# Browser-based research
"Navigate to example.com/product-page and extract:
- Product name
- Price
- Features list
- Customer reviews
- Create a summary document"

# Academic research
"Search for academic papers on transformer architectures published in 2024:
- Include abstracts
- List authors
- Summarize key findings
- Create a bibliography"`

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

        <h3 id="comprehensive-research-instructions">Comprehensive Instructions for Research</h3>
        <p className="mb-4">
          Structure your research requests for best results:
        </p>

        <DocsTable
          columns={[
            { key: 'element', title: 'Element', width: '150px' },
            { key: 'description', title: 'Description' },
            { key: 'example', title: 'Example' },
          ]}
          data={[
            {
              element: 'Research Topic',
              description: 'What to research',
              example: 'AI agents, Python decorators, market trends, competitor analysis'
            },
            {
              element: 'Scope',
              description: 'How broad or narrow',
              example: 'Recent developments, comprehensive overview, specific aspect'
            },
            {
              element: 'Sources',
              description: 'Where to look',
              example: 'Web search, specific websites, academic papers, news articles'
            },
            {
              element: 'Output Format',
              description: 'How to present findings',
              example: 'Summary document, comparison table, detailed report, bullet points'
            },
            {
              element: 'Key Questions',
              description: 'Specific questions to answer',
              example: 'What are the benefits? How does it work? What are the alternatives?'
            },
            {
              element: 'Depth',
              description: 'Level of detail needed',
              example: 'Quick overview, detailed analysis, comprehensive report'
            },
            {
              element: 'Citations',
              description: 'Include source references',
              example: 'Include URLs, authors, publication dates, citations'
            },
          ]}
          variant="default"
          size="default"
        />

        <h3 id="research-tips">Special Tips for Research</h3>
        <Alert className="mb-4">
          <Lightbulb className="h-4 w-4" />
          <AlertDescription>
            <strong>Pro Tips:</strong>
          </AlertDescription>
        </Alert>
        <DocsBullets variant="default" spacing="tight">
          <DocsBulletItem icon={Lightbulb}>
            <strong>Be Specific:</strong> Instead of "research AI," say "research latest AI agent frameworks released in 2024"
          </DocsBulletItem>
          <DocsBulletItem icon={Lightbulb}>
            <strong>Ask for Multiple Sources:</strong> Request 5-10 sources for comprehensive research
          </DocsBulletItem>
          <DocsBulletItem icon={Lightbulb}>
            <strong>Specify Format:</strong> Ask for tables, summaries, or detailed reports based on your needs
          </DocsBulletItem>
          <DocsBulletItem icon={Lightbulb}>
            <strong>Request Citations:</strong> Always ask for source URLs and references
          </DocsBulletItem>
          <DocsBulletItem icon={Lightbulb}>
            <strong>Use Browser for Complex Sites:</strong> For JavaScript-heavy sites, ask Iris to browse and extract
          </DocsBulletItem>
          <DocsBulletItem icon={Lightbulb}>
            <strong>Combine Tools:</strong> Use web search first, then browser automation for specific sites
          </DocsBulletItem>
          <DocsBulletItem icon={Lightbulb}>
            <strong>Ask for Verification:</strong> Request cross-referencing from multiple sources
          </DocsBulletItem>
          <DocsBulletItem icon={Lightbulb}>
            <strong>Set Timeframes:</strong> Specify "recent," "2024," or "latest" for current information
          </DocsBulletItem>
        </DocsBullets>

        <h3 id="advanced-research-example">Example: Comprehensive Research Request</h3>
        <div className="mb-6">
          <CodeBlock 
            data={[{
              language: "markdown",
              filename: "comprehensive-research.md",
              code: `"Conduct comprehensive research on AI agent platforms:

Research Tasks:
1. Search for top 10 AI agent platforms available in 2024
2. For each platform, find:
   - Key features and capabilities
   - Pricing models
   - Target audience
   - Strengths and weaknesses
   - User reviews and ratings

3. Compare features across platforms:
   - Create a comparison table
   - Highlight unique features
   - Identify common capabilities

4. Analyze market trends:
   - Industry growth projections
   - Emerging technologies
   - Investment and funding data

5. Research specific use cases:
   - Customer service automation
   - Content creation
   - Data analysis
   - Integration capabilities

Output Requirements:
- Create a detailed report document
- Include comparison tables
- Add citations with URLs
- Organize by sections with headings
- Include executive summary at the top
- Add recommendations section at the end

Sources:
- Use web search for general information
- Browse specific platform websites
- Look for industry reports
- Check news articles from 2024
- Include academic sources if relevant"`

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
      </DocsBody>

      <Separator className="my-8" />

      {/* Document Creation */}
      <DocsBody className="mb-8">
        <h2 id="document-creation">Document Creation</h2>
        <p className="mb-6">
          Iris can create beautifully formatted documents with rich text, code blocks, tables, and more. Use natural language to describe what you want, and Iris will create professional documents.
        </p>

        <h3 id="document-features">Document Features</h3>
        <DocsTable
          columns={[
            { key: 'feature', title: 'Feature', width: '200px' },
            { key: 'description', title: 'Description' },
            { key: 'example', title: 'Example Usage' },
          ]}
          data={[
            {
              feature: 'Rich Text',
              description: 'Bold, italic, underline, strikethrough formatting',
              example: 'Create a document with **bold** and *italic* text'
            },
            {
              feature: 'Headings',
              description: 'Multiple heading levels (H1-H6) for document structure',
              example: 'Use # Heading 1, ## Heading 2, etc.'
            },
            {
              feature: 'Lists',
              description: 'Ordered and unordered lists with nesting support',
              example: 'Create bullet points or numbered lists'
            },
            {
              feature: 'Code Blocks',
              description: 'Syntax-highlighted code blocks in various languages',
              example: '```python\nprint("Hello World")\n```'
            },
            {
              feature: 'Tables',
              description: 'Create structured data tables',
              example: 'Create a table with columns and rows'
            },
            {
              feature: 'Links',
              description: 'Embed hyperlinks to external resources',
              example: 'Add [link text](URL) to documents'
            },
            {
              feature: 'Images',
              description: 'Embed and display images',
              example: 'Include images in your documents'
            },
          ]}
          variant="default"
          size="default"
        />

        <h3 id="document-capabilities">What Iris Can Do</h3>
        <DocsBullets variant="default" spacing="loose">
          <DocsBulletItem icon={FileText}>
            <strong>Rich Text Formatting:</strong> Bold, italic, underline, strikethrough, and inline code
          </DocsBulletItem>
          <DocsBulletItem icon={FileText}>
            <strong>Structured Content:</strong> Headings (H1-H6), paragraphs, lists (ordered and unordered)
          </DocsBulletItem>
          <DocsBulletItem icon={FileText}>
            <strong>Code Blocks:</strong> Syntax-highlighted code in Python, TypeScript, JavaScript, Bash, and more
          </DocsBulletItem>
          <DocsBulletItem icon={FileText}>
            <strong>Tables:</strong> Create structured data tables with multiple columns and rows
          </DocsBulletItem>
          <DocsBulletItem icon={FileText}>
            <strong>Links:</strong> Embed hyperlinks to external resources and internal references
          </DocsBulletItem>
          <DocsBulletItem icon={FileText}>
            <strong>Images:</strong> Include images from web search or uploads
          </DocsBulletItem>
          <DocsBulletItem icon={FileText}>
            <strong>Blockquotes:</strong> Highlight important information or quotes
          </DocsBulletItem>
          <DocsBulletItem icon={FileText}>
            <strong>Nested Lists:</strong> Create multi-level lists with proper indentation
          </DocsBulletItem>
        </DocsBullets>

        <h3 id="how-to-use-documents">How to Use Document Creation</h3>
        <p className="mb-4">
          Simply describe what you want in your document:
        </p>

        <div className="mb-6">
          <CodeBlock 
            data={[{
              language: "markdown",
              filename: "document-examples.md",
              code: `# Simple document
"Create a document called 'project-notes.md' with my meeting notes from today"

# Technical documentation
"Create a technical guide about Python decorators:
- Introduction explaining what they are
- Code examples showing basic usage
- Advanced patterns section
- A comparison table of different approaches
- Links to official Python documentation"

# Comprehensive document
"Create a detailed project proposal document:
- Title: 'Q4 Marketing Campaign Proposal'
- Executive summary section
- Objectives and goals
- Budget breakdown table
- Timeline with milestones
- Team responsibilities
- Risk assessment
- Appendices section"`

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

        <h3 id="comprehensive-document-instructions">Comprehensive Instructions for Documents</h3>
        <p className="mb-4">
          Provide detailed specifications for best results:
        </p>

        <DocsTable
          columns={[
            { key: 'element', title: 'Element', width: '150px' },
            { key: 'description', title: 'Description' },
            { key: 'example', title: 'Example' },
          ]}
          data={[
            {
              element: 'Document Name',
              description: 'Filename and title',
              example: 'project-proposal.md, meeting-notes.md, technical-guide.md'
            },
            {
              element: 'Structure',
              description: 'How to organize content',
              example: 'Sections with headings, numbered sections, hierarchical structure'
            },
            {
              element: 'Content Type',
              description: 'What kind of content',
              example: 'Technical docs, meeting notes, proposals, guides, reports'
            },
            {
              element: 'Formatting',
              description: 'Text styling needs',
              example: 'Bold headings, bullet points, code blocks, tables'
            },
            {
              element: 'Code Examples',
              description: 'Include code snippets',
              example: 'Python examples, bash commands, configuration files'
            },
            {
              element: 'Visual Elements',
              description: 'Tables, images, diagrams',
              example: 'Comparison tables, data tables, embedded images'
            },
            {
              element: 'References',
              description: 'Links and citations',
              example: 'Links to external resources, internal references, citations'
            },
          ]}
          variant="default"
          size="default"
        />

        <h3 id="document-tips">Special Tips for Document Creation</h3>
        <Alert className="mb-4">
          <Lightbulb className="h-4 w-4" />
          <AlertDescription>
            <strong>Pro Tips:</strong>
          </AlertDescription>
        </Alert>
        <DocsBullets variant="default" spacing="tight">
          <DocsBulletItem icon={Lightbulb}>
            <strong>Specify Structure:</strong> Mention headings, sections, and organization upfront
          </DocsBulletItem>
          <DocsBulletItem icon={Lightbulb}>
            <strong>Request Formatting:</strong> Ask for bold headings, bullet points, or numbered lists explicitly
          </DocsBulletItem>
          <DocsBulletItem icon={Lightbulb}>
            <strong>Include Examples:</strong> Request code examples, use cases, or practical examples
          </DocsBulletItem>
          <DocsBulletItem icon={Lightbulb}>
            <strong>Use Tables:</strong> Ask for comparison tables, data tables, or feature matrices
          </DocsBulletItem>
          <DocsBulletItem icon={Lightbulb}>
            <strong>Add Links:</strong> Request links to relevant resources, documentation, or references
          </DocsBulletItem>
          <DocsBulletItem icon={Lightbulb}>
            <strong>Iterate:</strong> Create a base document, then ask for additions or modifications
          </DocsBulletItem>
          <DocsBulletItem icon={Lightbulb}>
            <strong>Combine with Research:</strong> Ask Iris to research first, then create a document from findings
          </DocsBulletItem>
        </DocsBullets>

        <h3 id="document-example">Example: Comprehensive Document Request</h3>
        <div className="mb-6">
          <CodeBlock 
            data={[{
              language: "markdown",
              filename: "comprehensive-document.md",
              code: `"Create a comprehensive technical documentation file called 'python-decorators-guide.md':

Document Structure:
1. Title: 'Python Decorators: Complete Guide'
2. Table of Contents (auto-generated)
3. Introduction section explaining what decorators are
4. Basic Usage section with code examples
5. Advanced Patterns section
6. Common Use Cases section
7. Best Practices section
8. Comparison table of different decorator patterns
9. References section with links

Content Requirements:
- Use H1 for main title, H2 for sections, H3 for subsections
- Include Python code examples with syntax highlighting
- Use bold text for important concepts
- Create bullet points for lists
- Add a comparison table showing:
  - Decorator pattern name
  - Use case
  - Code complexity
  - Performance impact

Code Examples:
- Basic decorator syntax
- Decorator with arguments
- Class-based decorators
- Decorator chaining
- Real-world examples

Formatting:
- Bold all section headings
- Use code blocks for all code examples
- Include inline code for function names
- Add links to Python official documentation
- Use blockquotes for important notes

Additional Requirements:
- Make it beginner-friendly
- Include practical examples
- Add warnings for common pitfalls
- Provide links to further reading"`

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
      </DocsBody>

      <Separator className="my-8" />

      {/* Presentation Creation */}
      <DocsBody className="mb-8">
        <h2 id="presentations">Presentation Creation</h2>
        <p className="mb-6">
          Create professional HTML presentations with beautiful slide designs. Iris can generate multi-slide presentations with formatted content, images, and animations.
        </p>

        <Alert className="mb-6">
          <Sparkles className="h-4 w-4" />
          <AlertDescription>
            <strong>Pro Tip:</strong> Presentations are interactive HTML files that can be shared or embedded anywhere!
          </AlertDescription>
        </Alert>

        <h3 id="presentation-features">Presentation Features</h3>
        <DocsBullets variant="default" spacing="loose">
          <DocsBulletItem icon={Eye}>
            <strong>Beautiful Slide Designs:</strong> Professional templates with modern aesthetics
          </DocsBulletItem>
          <DocsBulletItem icon={Eye}>
            <strong>Multiple Layouts:</strong> Title slides, content slides, image slides, and more
          </DocsBulletItem>
          <DocsBulletItem icon={Eye}>
            <strong>Rich Content:</strong> Text, images, code blocks, and formatted content
          </DocsBulletItem>
          <DocsBulletItem icon={Eye}>
            <strong>Interactive Navigation:</strong> Click through slides easily
          </DocsBulletItem>
          <DocsBulletItem icon={Eye}>
            <strong>Export Options:</strong> Share as HTML files or embed in websites
          </DocsBulletItem>
        </DocsBullets>

        <h3 id="create-presentation-example">Example: Creating a Presentation</h3>
        <div className="mb-6">
          <CodeBlock 
            data={[{
              language: "markdown",
              filename: "presentation-request.md",
              code: `# Request a Presentation

"Create a 5-slide presentation about AI agents:
- Slide 1: Title slide with 'AI Agents' 
- Slide 2: What are AI agents?
- Slide 3: Use cases and examples
- Slide 4: Benefits of using agents
- Slide 5: Getting started with Iris"

# Iris will generate a beautiful HTML presentation
# that you can view, share, or embed`
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
      </DocsBody>

      <Separator className="my-8" />

      {/* Agent Building */}
      <DocsBody className="mb-8">
        <h2 id="agent-building">Building Custom Agents</h2>
        <p className="mb-6">
          One of Iris's most powerful features is the ability to create specialized agents for specific tasks. You can configure agents with unique personalities, capabilities, and integrations.
        </p>

        <h3 id="agent-configuration">Agent Configuration</h3>
        <DocsBullets variant="default" spacing="loose">
          <DocsBulletItem icon={Bot}>
            <strong>Custom Personality:</strong> Define how your agent communicates and behaves
          </DocsBulletItem>
          <DocsBulletItem icon={Settings}>
            <strong>Tool Selection:</strong> Enable specific capabilities (web search, file management, etc.)
          </DocsBulletItem>
          <DocsBulletItem icon={Database}>
            <strong>MCP Integrations:</strong> Connect to external services (Gmail, Slack, GitHub, etc.)
          </DocsBulletItem>
          <DocsBulletItem icon={Calendar}>
            <strong>Scheduled Triggers:</strong> Automate recurring tasks with cron schedules
          </DocsBulletItem>
          <DocsBulletItem icon={Workflow}>
            <strong>Event Triggers:</strong> Respond to events from connected services
          </DocsBulletItem>
        </DocsBullets>

        <h3 id="example-agent-types">Example Agent Types</h3>
        <div className="grid md:grid-cols-2 gap-4 mb-6">
          <Card className="p-4">
            <h4 className="font-semibold mb-2 flex items-center gap-2">
              <Search className="h-4 w-4" />
              Research Agent
            </h4>
            <p className="text-sm text-muted-foreground mb-2">
              Configured with web search, browser automation, and document creation tools.
            </p>
            <p className="text-xs text-muted-foreground">
              Perfect for: Market research, competitive analysis, information gathering
            </p>
          </Card>

          <Card className="p-4">
            <h4 className="font-semibold mb-2 flex items-center gap-2">
              <FileText className="h-4 w-4" />
              Content Creator
            </h4>
            <p className="text-sm text-muted-foreground mb-2">
              Configured with document creation, presentation tools, and image editing.
            </p>
            <p className="text-xs text-muted-foreground">
              Perfect for: Blog posts, presentations, marketing materials
            </p>
          </Card>

          <Card className="p-4">
            <h4 className="font-semibold mb-2 flex items-center gap-2">
              <Database className="h-4 w-4" />
              Data Analyst
            </h4>
            <p className="text-sm text-muted-foreground mb-2">
              Configured with API integrations, file processing, and data providers.
            </p>
            <p className="text-xs text-muted-foreground">
              Perfect for: Data processing, report generation, analytics
            </p>
          </Card>

          <Card className="p-4">
            <h4 className="font-semibold mb-2 flex items-center gap-2">
              <Webhook className="h-4 w-4" />
              Integration Specialist
            </h4>
            <p className="text-sm text-muted-foreground mb-2">
              Configured with MCP integrations for Gmail, Slack, and other services.
            </p>
            <p className="text-xs text-muted-foreground">
              Perfect for: Workflow automation, cross-platform tasks
            </p>
          </Card>
        </div>
      </DocsBody>

      <Separator className="my-8" />

      {/* Integrations */}
      <DocsBody className="mb-8">
        <h2 id="integrations">External Integrations</h2>
        <p className="mb-6">
          Iris supports integration with over 2700 external services through MCP (Model Context Protocol) servers. Connect your agents to the tools you already use.
        </p>

        <h3 id="popular-integrations">Popular Integrations</h3>
        <DocsTable
          columns={[
            { key: 'service', title: 'Service', width: '150px' },
            { key: 'category', title: 'Category', width: '150px' },
            { key: 'capabilities', title: 'Capabilities' },
          ]}
          data={[
            {
              service: 'Gmail',
              category: 'Communication',
              capabilities: 'Send emails, read inbox, manage messages, attachments'
            },
            {
              service: 'Slack',
              category: 'Communication',
              capabilities: 'Send messages, create channels, manage notifications'
            },
            {
              service: 'GitHub',
              category: 'Development',
              capabilities: 'Manage repositories, create issues, pull requests, code reviews'
            },
            {
              service: 'Notion',
              category: 'Productivity',
              capabilities: 'Create pages, databases, manage content, sync data'
            },
            {
              service: 'Google Sheets',
              category: 'Data',
              capabilities: 'Read/write spreadsheets, formulas, data analysis'
            },
            {
              service: 'PostgreSQL',
              category: 'Database',
              capabilities: 'Query databases, manage schemas, execute SQL'
            },
          ]}
          variant="default"
          size="default"
        />

        <Alert className="mb-6 mt-6">
          <Info className="h-4 w-4" />
          <AlertDescription>
            <strong>Finding Integrations:</strong> Ask Iris to search for integrations by name or category. For example: "Search for email integrations" or "Find GitHub integrations"
          </AlertDescription>
        </Alert>
      </DocsBody>

      <Separator className="my-8" />

      {/* Automation & Triggers */}
      <DocsBody className="mb-8">
        <h2 id="automation">Automation & Triggers</h2>
        <p className="mb-6">
          Make your agents work automatically with scheduled triggers and event-based automation.
        </p>

        <h3 id="scheduled-triggers">Scheduled Triggers</h3>
        <p className="mb-4">
          Run agents automatically on a schedule using cron expressions:
        </p>
        <DocsBullets variant="default" spacing="tight">
          <DocsBulletItem icon={Calendar}>
            <strong>Daily:</strong> Run every day at a specific time (e.g., "0 9 * * *" for 9 AM daily)
          </DocsBulletItem>
          <DocsBulletItem icon={Calendar}>
            <strong>Weekly:</strong> Run on specific days of the week
          </DocsBulletItem>
          <DocsBulletItem icon={Calendar}>
            <strong>Custom:</strong> Any cron schedule you need
          </DocsBulletItem>
        </DocsBullets>

        <h3 id="event-triggers">Event Triggers</h3>
        <p className="mb-4">
          Respond to events from connected services:
        </p>
        <DocsBullets variant="default" spacing="tight">
          <DocsBulletItem icon={Zap}>
            <strong>Email Received:</strong> Trigger when new emails arrive in Gmail
          </DocsBulletItem>
          <DocsBulletItem icon={Zap}>
            <strong>GitHub Activity:</strong> Trigger on new issues, PRs, or commits
          </DocsBulletItem>
          <DocsBulletItem icon={Zap}>
            <strong>Database Changes:</strong> Trigger on data updates
          </DocsBulletItem>
          <DocsBulletItem icon={Zap}>
            <strong>Custom Events:</strong> Any event from connected services
          </DocsBulletItem>
        </DocsBullets>

        <h3 id="trigger-example">Example: Creating a Scheduled Trigger</h3>
        <div className="mb-6">
          <CodeBlock 
            data={[{
              language: "bash",
              filename: "trigger-setup.sh",
              code: `# Ask Iris to create a scheduled trigger
"Create a daily trigger that runs at 9 AM to:
1. Check my email for important messages
2. Generate a summary of tasks
3. Send a morning briefing report"

# Iris will:
# - Set up the cron schedule (0 9 * * *)
# - Configure the agent to run automatically
# - Test the trigger to ensure it works`
            }]}
            defaultValue="bash"
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
      </DocsBody>

      <Separator className="my-8" />

      {/* Best Practices */}
      <DocsBody className="mb-8">
        <h2 id="best-practices">Best Practices</h2>
        <p className="mb-6">
          Get the most out of Iris by following these best practices:
        </p>

        <h3 id="communication-tips">Communication Tips</h3>
        <DocsBullets variant="default" spacing="loose">
          <DocsBulletItem icon={Lightbulb}>
            <strong>Be Specific:</strong> The more details you provide, the better Iris can help you
          </DocsBulletItem>
          <DocsBulletItem icon={Lightbulb}>
            <strong>Break Down Tasks:</strong> Complex tasks work better when broken into steps
          </DocsBulletItem>
          <DocsBulletItem icon={Lightbulb}>
            <strong>Provide Context:</strong> Share relevant information about your goals
          </DocsBulletItem>
          <DocsBulletItem icon={Lightbulb}>
            <strong>Iterate:</strong> Refine requests based on results
          </DocsBulletItem>
        </DocsBullets>

        <h3 id="security">Security Considerations</h3>
        <Alert className="mb-4">
          <Lock className="h-4 w-4" />
          <AlertDescription>
            <strong>Important:</strong> Credentials for integrations are encrypted and stored securely. Only connect services you trust.
          </AlertDescription>
        </Alert>
        <DocsBullets variant="default" spacing="tight">
          <DocsBulletItem icon={AlertTriangle}>
            Review what permissions integrations request
          </DocsBulletItem>
          <DocsBulletItem icon={AlertTriangle}>
            Use credential profiles to manage access
          </DocsBulletItem>
          <DocsBulletItem icon={AlertTriangle}>
            Regularly review and update integrations
          </DocsBulletItem>
        </DocsBullets>
      </DocsBody>

      <Separator className="my-8" />

      {/* Next Steps */}
      <DocsBody className="mb-8">
        <h2 id="next-steps">Next Steps</h2>
        <p className="mb-6">
          Now that you understand Iris's capabilities, here's what to do next:
        </p>

        <div className="grid md:grid-cols-2 gap-6">
          <DocsCard
            title="Try Your First Task"
            description="Start with a simple task to see Iris in action"
            icon={Rocket}
            variant="default"
            hover
            clickable
            onClick={() => window.location.href = '/docs/introduction'}
          >
            <p className="text-sm text-muted-foreground">
              Ask Iris to create a document, search for information, or help with a simple automation task.
            </p>
          </DocsCard>

          <DocsCard
            title="Explore Formatting"
            description="See all the formatting options available"
            icon={BookOpen}
            variant="default"
            hover
            clickable
            onClick={() => window.location.href = '/docs/formatting-showcase'}
          >
            <p className="text-sm text-muted-foreground">
              Check out the formatting showcase to see how documents can be styled and structured.
            </p>
          </DocsCard>
        </div>
      </DocsBody>
    </>
  );
}

