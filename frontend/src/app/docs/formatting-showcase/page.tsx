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
  createDocsTableColumn,
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
  Info,
  Code,
  FileText,
  Image as ImageIcon,
  Table,
  List,
  Heading1,
  Type,
  Link as LinkIcon,
  CheckCircle2,
} from 'lucide-react';
import { Separator } from '@/components/ui/separator';

const breadcrumbs = [
  { title: 'Documentation', onClick: () => window.location.href = '/docs' },
  { title: 'Formatting Showcase' }
];

export default function FormattingShowcasePage() {
  return (
    <>
      <DocsHeader
        title="Documentation Formatting Guide"
        subtitle="Discover all the formatting features and components available in Iris documentation"
        breadcrumbs={breadcrumbs}
        lastUpdated="January 2025"
        showSeparator
        size="lg"
        className="mb-8 sm:mb-12"
      />

      <DocsBody className="mb-8">
        <h2 id="overview">Formatting Features Overview</h2>
        <p className="text-lg mb-6">
          This page demonstrates all the formatting options and components available when creating documents with Iris. Each section shows examples of how to use different formatting features.
        </p>
        
        <Alert className="mb-6">
          <Info className="h-4 w-4" />
          <AlertDescription>
            <strong>Documentation System:</strong> Iris uses <strong>shadcn/ui</strong> components built on <strong>Radix UI</strong> and <strong>Tailwind CSS</strong>, with <strong>Shiki</strong> for code syntax highlighting.
          </AlertDescription>
        </Alert>
      </DocsBody>

      <Separator className="my-8" />

      {/* Headings */}
      <DocsBody className="mb-8">
        <h2 id="headings">Headings</h2>
        <p className="mb-4">
          Use headings to structure your documents. Iris supports multiple heading levels:
        </p>

        <div className="space-y-2 mb-6">
          <h1>Heading 1 - Main Title</h1>
          <h2>Heading 2 - Section Title</h2>
          <h3>Heading 3 - Subsection</h3>
          <h4>Heading 4 - Minor Section</h4>
          <h5>Heading 5 - Sub-subsection</h5>
          <h6>Heading 6 - Smallest Heading</h6>
        </div>

        <h3 id="heading-code">Code Example</h3>
        <div className="mb-6">
          <CodeBlock 
            data={[{
              language: "markdown",
              filename: "headings.md",
              code: `# Heading 1
## Heading 2
### Heading 3
#### Heading 4
##### Heading 5
###### Heading 6`
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

      {/* Text Formatting */}
      <DocsBody className="mb-8">
        <h2 id="text-formatting">Text Formatting</h2>
        <p className="mb-4">
          Enhance your text with various formatting options:
        </p>

        <div className="space-y-3 mb-6">
          <p><strong>Bold text</strong> - Use double asterisks or double underscores</p>
          <p><em>Italic text</em> - Use single asterisks or single underscores</p>
          <p><u>Underlined text</u> - Use HTML underline tags</p>
          <p><s>Strikethrough text</s> - Use double tildes</p>
          <p>Inline <code>code</code> - Use backticks for code snippets</p>
          <p>This is a paragraph with <strong>bold</strong>, <em>italic</em>, and <code>code</code> formatting.</p>
        </div>

        <h3 id="text-formatting-code">Code Example</h3>
        <div className="mb-6">
          <CodeBlock 
            data={[{
              language: "markdown",
              filename: "text-formatting.md",
              code: `**Bold text** or __Bold text__
*Italic text* or _Italic text_
<u>Underlined text</u>
~~Strikethrough text~~
\`inline code\`

Combine formats: **bold** and *italic* and \`code\``
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

      {/* Lists */}
      <DocsBody className="mb-8">
        <h2 id="lists">Lists</h2>
        <p className="mb-4">
          Create organized lists with bullets or numbers:
        </p>

        <h3 id="unordered-lists">Unordered Lists</h3>
        <DocsBullets variant="default" spacing="default">
          <DocsBulletItem icon={CheckCircle2}>First item in unordered list</DocsBulletItem>
          <DocsBulletItem icon={CheckCircle2}>Second item with nested content</DocsBulletItem>
          <DocsBulletItem icon={CheckCircle2}>
            Third item
            <DocsBullets variant="default" spacing="tight" className="mt-2 ml-4">
              <DocsBulletItem>Nested item 1</DocsBulletItem>
              <DocsBulletItem>Nested item 2</DocsBulletItem>
            </DocsBullets>
          </DocsBulletItem>
        </DocsBullets>

        <h3 id="ordered-lists">Ordered Lists</h3>
        <ol className="list-decimal pl-6 mb-6 space-y-2">
          <li>First numbered item</li>
          <li>Second numbered item</li>
          <li>
            Third numbered item with nested list
            <ol className="list-decimal pl-6 mt-2 space-y-1">
              <li>Nested numbered item 1</li>
              <li>Nested numbered item 2</li>
            </ol>
          </li>
        </ol>

        <h3 id="lists-code">Code Example</h3>
        <div className="mb-6">
          <CodeBlock 
            data={[{
              language: "markdown",
              filename: "lists.md",
              code: `<!-- Unordered List -->
- First item
- Second item
  - Nested item
  - Another nested item
- Third item

<!-- Ordered List -->
1. First item
2. Second item
   1. Nested item
   2. Another nested item
3. Third item`
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

      {/* Code Blocks */}
      <DocsBody className="mb-8">
        <h2 id="code-blocks">Code Blocks</h2>
        <p className="mb-4">
          Display code with syntax highlighting in multiple languages:
        </p>

        <h3 id="python-example">Python Example</h3>
        <div className="mb-6">
          <CodeBlock 
            data={[{
              language: "python",
              filename: "example.py",
              code: `def greet(name: str) -> str:
    """Greet a person by name."""
    return f"Hello, {name}!"

# Example usage
message = greet("Iris")
print(message)  # Output: Hello, Iris!`
            }]}
            defaultValue="python"
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

        <h3 id="typescript-example">TypeScript Example</h3>
        <div className="mb-6">
          <CodeBlock 
            data={[{
              language: "typescript",
              filename: "example.ts",
              code: `interface User {
  id: string;
  name: string;
  email: string;
}

function createUser(name: string, email: string): User {
  return {
    id: crypto.randomUUID(),
    name,
    email,
  };
}

const user = createUser("Alice", "alice@example.com");
console.log(user);`
            }]}
            defaultValue="typescript"
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

        <h3 id="bash-example">Bash Example</h3>
        <div className="mb-6">
          <CodeBlock 
            data={[{
              language: "bash",
              filename: "setup.sh",
              code: `#!/bin/bash

# Install dependencies
npm install

# Build the project
npm run build

# Start the server
npm start`
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

        <Alert className="mb-6">
          <Code className="h-4 w-4" />
          <AlertDescription>
            <strong>Supported Languages:</strong> Python, TypeScript, JavaScript, Bash, HTML, CSS, JSON, SQL, and many more. Syntax highlighting is powered by Shiki.
          </AlertDescription>
        </Alert>
      </DocsBody>

      <Separator className="my-8" />

      {/* Tables */}
      <DocsBody className="mb-8">
        <h2 id="tables">Tables</h2>
        <p className="mb-4">
          Create structured data tables with multiple columns:
        </p>

        <h3 id="basic-table">Basic Table</h3>
        <DocsTable
          columns={createDocsTableColumn([
            { key: 'feature', title: 'Feature', width: '200px' },
            { key: 'description', title: 'Description' },
            { key: 'status', title: 'Status', width: '100px', align: 'center' },
          ])}
          data={[
            {
              feature: 'Web Search',
              description: 'Search the internet for information',
              status: '✅ Available'
            },
            {
              feature: 'File Management',
              description: 'Create and edit files',
              status: '✅ Available'
            },
            {
              feature: 'Browser Automation',
              description: 'Navigate and interact with websites',
              status: '✅ Available'
            },
            {
              feature: 'API Integrations',
              description: 'Connect with external services',
              status: '✅ Available'
            },
          ]}
          variant="default"
          size="default"
        />

        <h3 id="complex-table">Complex Table</h3>
        <DocsTable
          columns={createDocsTableColumn([
            { key: 'tool', title: 'Tool', width: '150px' },
            { key: 'category', title: 'Category', width: '150px' },
            { key: 'capabilities', title: 'Capabilities' },
            { key: 'example', title: 'Example Usage', width: '200px' },
          ])}
          data={[
            {
              tool: 'sb_files_tool',
              category: 'File Operations',
              capabilities: 'Create, read, edit, delete files and directories',
              example: 'Create a Python script'
            },
            {
              tool: 'web_search_tool',
              category: 'Research',
              capabilities: 'Search web, images, people, companies',
              example: 'Search for AI trends'
            },
            {
              tool: 'browser_tool',
              category: 'Automation',
              capabilities: 'Navigate websites, extract data, fill forms',
              example: 'Scrape product prices'
            },
          ]}
          variant="default"
          size="default"
        />

        <h3 id="table-code">Code Example</h3>
        <div className="mb-6">
          <CodeBlock 
            data={[{
              language: "markdown",
              filename: "table.md",
              code: `| Feature | Description | Status |
|---------|-------------|--------|
| Web Search | Search the internet | ✅ Available |
| File Management | Create and edit files | ✅ Available |
| Browser Automation | Navigate websites | ✅ Available |`
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

      {/* Links */}
      <DocsBody className="mb-8">
        <h2 id="links">Links</h2>
        <p className="mb-4">
          Add hyperlinks to external resources:
        </p>

        <div className="space-y-2 mb-6">
          <p>
            <a href="https://irisvision.ai" target="_blank" rel="noopener noreferrer">Visit Iris Website</a> - External link with target="_blank"
          </p>
          <p>
            <a href="/docs/introduction">Introduction Page</a> - Internal link to another docs page
          </p>
          <p>
            <a href="https://github.com/irisvision-ai/iris">GitHub Repository</a> - Link to source code
          </p>
        </div>

        <h3 id="links-code">Code Example</h3>
        <div className="mb-6">
          <CodeBlock 
            data={[{
              language: "markdown",
              filename: "links.md",
              code: `[Visit Iris Website](https://irisvision.ai)
[Introduction Page](/docs/introduction)
[GitHub Repository](https://github.com/irisvision-ai/iris)`
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

      {/* Blockquotes */}
      <DocsBody className="mb-8">
        <h2 id="blockquotes">Blockquotes</h2>
        <p className="mb-4">
          Highlight important information with blockquotes:
        </p>

        <blockquote className="border-l-4 border-border pl-4 italic text-muted-foreground mb-6">
          This is a blockquote. Use it to highlight important information, quotes, or callouts in your documents.
        </blockquote>

        <h3 id="blockquotes-code">Code Example</h3>
        <div className="mb-6">
          <CodeBlock 
            data={[{
              language: "markdown",
              filename: "blockquote.md",
              code: `> This is a blockquote. Use it to highlight important information, quotes, or callouts in your documents.`
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

      {/* Alerts */}
      <DocsBody className="mb-8">
        <h2 id="alerts">Alerts & Callouts</h2>
        <p className="mb-4">
          Use alerts to draw attention to important information:
        </p>

        <Alert className="mb-4">
          <Info className="h-4 w-4" />
          <AlertDescription>
            <strong>Info Alert:</strong> This is an informational alert. Use it to provide helpful tips or context.
          </AlertDescription>
        </Alert>

        <Alert className="mb-4" variant="default">
          <CheckCircle2 className="h-4 w-4" />
          <AlertDescription>
            <strong>Success Alert:</strong> This indicates a successful operation or completion.
          </AlertDescription>
        </Alert>

        <Alert className="mb-6" variant="destructive">
          <Info className="h-4 w-4" />
          <AlertDescription>
            <strong>Warning Alert:</strong> This is a warning or error message. Use it sparingly for important warnings.
          </AlertDescription>
        </Alert>
      </DocsBody>

      <Separator className="my-8" />

      {/* Cards */}
      <DocsBody className="mb-8">
        <h2 id="cards">Cards</h2>
        <p className="mb-4">
          Use cards to organize related information:
        </p>

        <div className="grid md:grid-cols-2 gap-4 mb-6">
          <DocsCard
            title="Feature Card"
            description="This is a feature card with an icon and description"
            icon={FileText}
            variant="outline"
            hover
          />

          <DocsCard
            title="Another Card"
            description="Cards can be used to highlight features, tips, or related content"
            icon={Code}
            variant="default"
            hover
          />
        </div>
      </DocsBody>

      <Separator className="my-8" />

      {/* Combining Elements */}
      <DocsBody className="mb-8">
        <h2 id="combining">Combining Elements</h2>
        <p className="mb-4">
          Combine multiple formatting elements for rich, structured documents:
        </p>

        <DocsCard
          title="Complete Example"
          description="A document combining multiple formatting features"
          icon={FileText}
          variant="outline"
          className="mb-6"
        >
          <div className="space-y-4">
            <h3 className="text-lg font-semibold">Section Title</h3>
            <p>This paragraph contains <strong>bold text</strong>, <em>italic text</em>, and inline <code>code</code>.</p>
            
            <DocsBullets variant="default" spacing="tight">
              <DocsBulletItem icon={CheckCircle2}>First feature point</DocsBulletItem>
              <DocsBulletItem icon={CheckCircle2}>Second feature point</DocsBulletItem>
              <DocsBulletItem icon={CheckCircle2}>Third feature point</DocsBulletItem>
            </DocsBullets>

            <div className="mt-4">
              <CodeBlock 
                data={[{
                  language: "python",
                  filename: "example.py",
                  code: `def example():
    return "Combined formatting example"`
                }]}
                defaultValue="python"
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

            <blockquote className="border-l-4 border-border pl-4 italic text-muted-foreground mt-4">
              This is a blockquote within a card, showing how elements can be combined.
            </blockquote>
          </div>
        </DocsCard>
      </DocsBody>

      <Separator className="my-8" />

      {/* Summary */}
      <DocsBody className="mb-8">
        <h2 id="summary">Summary</h2>
        <p className="mb-4">
          You now know all the formatting options available in Iris documentation:
        </p>

        <DocsTable
          columns={createDocsTableColumn([
            { key: 'element', title: 'Element', width: '150px' },
            { key: 'description', title: 'Description' },
            { key: 'usage', title: 'Usage' },
          ])}
          data={[
            {
              element: 'Headings',
              description: 'Structure documents with H1-H6',
              usage: '# Heading 1, ## Heading 2'
            },
            {
              element: 'Text Formatting',
              description: 'Bold, italic, underline, strikethrough, code',
              usage: '**bold**, *italic*, `code`'
            },
            {
              element: 'Lists',
              description: 'Ordered and unordered lists',
              usage: '- Item or 1. Item'
            },
            {
              element: 'Code Blocks',
              description: 'Syntax-highlighted code',
              usage: '```language\ncode\n```'
            },
            {
              element: 'Tables',
              description: 'Structured data tables',
              usage: '| Column | Column |'
            },
            {
              element: 'Links',
              description: 'Hyperlinks to resources',
              usage: '[text](url)'
            },
            {
              element: 'Blockquotes',
              description: 'Highlighted quotes',
              usage: '> Quote text'
            },
            {
              element: 'Alerts',
              description: 'Important callouts',
              usage: 'Component-based alerts'
            },
            {
              element: 'Cards',
              description: 'Organized content blocks',
              usage: 'Component-based cards'
            },
          ]}
          variant="default"
          size="default"
        />
      </DocsBody>
    </>
  );
}

