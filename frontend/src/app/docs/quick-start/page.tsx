'use client';

import * as React from 'react';
import { 
  DocsHeader,
  DocsCard,
  DocsBody,
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
  Rocket,
  MessageSquare,
  FileText,
  Search,
  Bot,
  Zap,
  CheckCircle2,
  ArrowRight,
  Info,
  Lightbulb,
} from 'lucide-react';
import { Separator } from '@/components/ui/separator';

const breadcrumbs = [
  { title: 'Documentation', onClick: () => window.location.href = '/docs' },
  { title: 'Quick Start' }
];

export default function QuickStartPage() {
  return (
    <>
      <DocsHeader
        title="Quick Start Guide"
        subtitle="Get started with Iris in 5 minutes - your first AI agent tasks"
        breadcrumbs={breadcrumbs}
        lastUpdated="January 2025"
        showSeparator
        size="lg"
        className="mb-8 sm:mb-12"
      />

      <DocsBody className="mb-8">
        <h2 id="welcome">Welcome to Iris!</h2>
        <p className="text-lg mb-6">
          This quick start guide will help you complete your first tasks with Iris in just a few minutes. By the end, you'll understand how to interact with Iris and accomplish real work.
        </p>

        <Alert className="mb-6">
          <Rocket className="h-4 w-4" />
          <AlertDescription>
            <strong>Ready to start?</strong> Follow along with these examples to see Iris in action!
          </AlertDescription>
        </Alert>
      </DocsBody>

      <Separator className="my-8" />

      {/* Step 1 */}
      <DocsBody className="mb-8">
        <h2 id="step-1">Step 1: Your First Conversation</h2>
        <p className="mb-4">
          Start by simply chatting with Iris. Ask questions or request help with a task:
        </p>

        <div className="space-y-4 mb-6">
          <div className="bg-muted/50 p-4 rounded-lg border border-border">
            <div className="flex items-start gap-3">
              <div className="rounded-full bg-primary/10 p-2">
                <MessageSquare className="h-4 w-4 text-primary" />
              </div>
              <div className="flex-1">
                <p className="font-medium mb-1">You:</p>
                <p>"Hello! Can you help me understand what Iris can do?"</p>
              </div>
            </div>
          </div>

          <div className="bg-primary/5 p-4 rounded-lg border border-primary/20">
            <div className="flex items-start gap-3">
              <div className="rounded-full bg-primary p-2">
                <Bot className="h-4 w-4 text-primary-foreground" />
              </div>
              <div className="flex-1">
                <p className="font-medium mb-1">Iris:</p>
                <p>Iris will respond with an overview of capabilities and offer to help with specific tasks.</p>
              </div>
            </div>
          </div>
        </div>

        <Alert className="mb-6">
          <Info className="h-4 w-4" />
          <AlertDescription>
            <strong>Tip:</strong> Be conversational! Iris understands natural language, so ask questions just like you would ask a colleague.
          </AlertDescription>
        </Alert>
      </DocsBody>

      <Separator className="my-8" />

      {/* Step 2 */}
      <DocsBody className="mb-8">
        <h2 id="step-2">Step 2: Create Your First Document</h2>
        <p className="mb-4">
          Ask Iris to create a document. This demonstrates file creation and formatting capabilities:
        </p>

        <div className="mb-6">
          <CodeBlock 
            data={[{
              language: "markdown",
              filename: "example-request.md",
              code: `"Create a document called 'my-first-doc.md' with:
- A title: 'My First Document'
- Three sections about:
  1. What I learned today
  2. Questions I have
  3. Next steps
- Use formatting like bold text and lists"`
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

        <p className="mb-4">
          Iris will create a beautifully formatted document with all the requested elements. You can then:
        </p>
        <DocsBullets variant="default" spacing="tight">
          <DocsBulletItem icon={CheckCircle2}>View the document in the chat</DocsBulletItem>
          <DocsBulletItem icon={CheckCircle2}>Edit it by asking Iris to make changes</DocsBulletItem>
          <DocsBulletItem icon={CheckCircle2}>Download or share it</DocsBulletItem>
        </DocsBullets>
      </DocsBody>

      <Separator className="my-8" />

      {/* Step 3 */}
      <DocsBody className="mb-8">
        <h2 id="step-3">Step 3: Search the Web</h2>
        <p className="mb-4">
          Ask Iris to search for information. This demonstrates web search capabilities:
        </p>

        <div className="mb-6">
          <CodeBlock 
            data={[{
              language: "markdown",
              filename: "search-example.md",
              code: `"Search for the latest developments in AI agents and 
create a summary of the top 3 findings"`

// Iris will:
// 1. Search the web for relevant information
// 2. Analyze the results
// 3. Create a concise summary
// 4. Present it in a readable format`
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
          <Search className="h-4 w-4" />
          <AlertDescription>
            <strong>Pro Tip:</strong> You can ask Iris to search for specific information, compare sources, or even create reports based on web research.
          </AlertDescription>
        </Alert>
      </DocsBody>

      <Separator className="my-8" />

      {/* Step 4 */}
      <DocsBody className="mb-8">
        <h2 id="step-4">Step 4: Try a Multi-Step Task</h2>
        <p className="mb-4">
          Ask Iris to complete a task that involves multiple steps:
        </p>

        <div className="mb-6">
          <CodeBlock 
            data={[{
              language: "markdown",
              filename: "multistep-example.md",
              code: `"I need to research Python decorators. Please:
1. Search for information about Python decorators
2. Create a document explaining what they are
3. Include code examples showing basic usage
4. Add a table comparing different decorator patterns"`

// Iris will execute all steps automatically:
// - Web search → Information gathering
// - Document creation → File management
// - Code examples → Formatting and structure
// - Table creation → Data organization`
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

        <p className="mb-4">
          This demonstrates Iris's ability to:
        </p>
        <DocsBullets variant="default" spacing="tight">
          <DocsBulletItem icon={Zap}>Break down complex tasks into steps</DocsBulletItem>
          <DocsBulletItem icon={Zap}>Use multiple tools in sequence</DocsBulletItem>
          <DocsBulletItem icon={Zap}>Create comprehensive results</DocsBulletItem>
        </DocsBullets>
      </DocsBody>

      <Separator className="my-8" />

      {/* Step 5 */}
      <DocsBody className="mb-8">
        <h2 id="step-5">Step 5: Explore Advanced Features</h2>
        <p className="mb-4">
          Now that you've mastered the basics, try these advanced features:
        </p>

        <div className="grid md:grid-cols-2 gap-4 mb-6">
          <DocsCard
            title="Browser Automation"
            description="Ask Iris to navigate websites and extract data"
            icon={Zap}
            variant="outline"
            hover
            className="h-full"
          >
            <p className="text-sm text-muted-foreground mb-2">
              Example: "Navigate to example.com and extract all headings from the page"
            </p>
          </DocsCard>

          <DocsCard
            title="Code Execution"
            description="Run commands and scripts"
            icon={FileText}
            variant="outline"
            hover
            className="h-full"
          >
            <p className="text-sm text-muted-foreground mb-2">
              Example: "Create a Python script that lists all files in a directory"
            </p>
          </DocsCard>

          <DocsCard
            title="Image Analysis"
            description="Analyze images and extract information"
            icon={Search}
            variant="outline"
            hover
            className="h-full"
          >
            <p className="text-sm text-muted-foreground mb-2">
              Example: "Analyze this screenshot and describe what you see"
            </p>
          </DocsCard>

          <DocsCard
            title="Presentations"
            description="Create beautiful HTML presentations"
            icon={FileText}
            variant="outline"
            hover
            className="h-full"
          >
            <p className="text-sm text-muted-foreground mb-2">
              Example: "Create a 5-slide presentation about AI agents"
            </p>
          </DocsCard>
        </div>
      </DocsBody>

      <Separator className="my-8" />

      {/* Best Practices */}
      <DocsBody className="mb-8">
        <h2 id="best-practices">Quick Tips for Success</h2>
        <p className="mb-4">
          Follow these tips to get the best results from Iris:
        </p>

        <DocsBullets variant="default" spacing="loose">
          <DocsBulletItem icon={Lightbulb}>
            <strong>Be Specific:</strong> The more details you provide, the better Iris can help you. Instead of "create a document," try "create a document about Python decorators with code examples and a comparison table."
          </DocsBulletItem>
          <DocsBulletItem icon={Lightbulb}>
            <strong>Break Down Complex Tasks:</strong> For complex tasks, break them into steps. Iris will handle each step automatically.
          </DocsBulletItem>
          <DocsBulletItem icon={Lightbulb}>
            <strong>Iterate and Refine:</strong> Don't hesitate to ask Iris to modify or improve results. You can say "make it shorter" or "add more examples."
          </DocsBulletItem>
          <DocsBulletItem icon={Lightbulb}>
            <strong>Use Natural Language:</strong> Talk to Iris like you would talk to a colleague. No need for special commands or syntax.
          </DocsBulletItem>
        </DocsBullets>
      </DocsBody>

      <Separator className="my-8" />

      {/* Next Steps */}
      <DocsBody className="mb-8">
        <h2 id="next-steps">What's Next?</h2>
        <p className="mb-6">
          Congratulations! You've completed the quick start guide. Here's what to explore next:
        </p>

        <div className="grid md:grid-cols-2 gap-6">
          <DocsCard
            title="Complete User Guide"
            description="Learn about all features and capabilities"
            icon={FileText}
            variant="default"
            hover
            clickable
            onClick={() => window.location.href = '/docs/user-guide'}
          >
            <div className="flex items-center gap-2 mt-2 text-sm text-primary">
              <span>Explore all features</span>
              <ArrowRight className="h-4 w-4" />
            </div>
          </DocsCard>

          <DocsCard
            title="Formatting Showcase"
            description="See all formatting options available"
            icon={FileText}
            variant="default"
            hover
            clickable
            onClick={() => window.location.href = '/docs/formatting-showcase'}
          >
            <div className="flex items-center gap-2 mt-2 text-sm text-primary">
              <span>View formatting guide</span>
              <ArrowRight className="h-4 w-4" />
            </div>
          </DocsCard>

          <DocsCard
            title="Self Hosting"
            description="Set up your own Iris instance"
            icon={Zap}
            variant="default"
            hover
            clickable
            onClick={() => window.location.href = '/docs/self-hosting'}
          >
            <div className="flex items-center gap-2 mt-2 text-sm text-primary">
              <span>Learn self-hosting</span>
              <ArrowRight className="h-4 w-4" />
            </div>
          </DocsCard>

          <DocsCard
            title="Continue Learning"
            description="Keep exploring Iris's capabilities"
            icon={Rocket}
            variant="default"
            hover
            clickable
            onClick={() => window.location.href = '/docs/introduction'}
          >
            <div className="flex items-center gap-2 mt-2 text-sm text-primary">
              <span>Read more</span>
              <ArrowRight className="h-4 w-4" />
            </div>
          </DocsCard>
        </div>
      </DocsBody>
    </>
  );
}

