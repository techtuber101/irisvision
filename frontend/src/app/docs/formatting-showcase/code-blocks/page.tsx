'use client';

import * as React from 'react';
import { 
  DocsHeader,
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
import { Code, ArrowRight, ArrowLeft } from 'lucide-react';
import Link from 'next/link';

const breadcrumbs = [
  { title: 'Documentation', onClick: () => window.location.href = '/docs' },
  { title: 'Formatting Showcase', onClick: () => window.location.href = '/docs/formatting-showcase' },
  { title: 'Code Blocks' }
];

export default function CodeBlocksPage() {
  return (
    <>
      <DocsHeader
        title="Code Blocks"
        subtitle="Display code with syntax highlighting in multiple languages"
        breadcrumbs={breadcrumbs}
        lastUpdated="January 2025"
        showSeparator
        size="lg"
        className="mb-8 sm:mb-12"
      />

      <DocsBody className="mb-8">
        <p className="mb-4">
          Display code with syntax highlighting in multiple languages:
        </p>

        <h3 className="mb-4">Python Example</h3>
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

        <h3 className="mb-4">TypeScript Example</h3>
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

        <h3 className="mb-4">Bash Example</h3>
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

      <div className="mt-8 flex items-center justify-between">
        <Link 
          href="/docs/formatting-showcase/lists"
          className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          Previous: Lists
        </Link>
        <Link 
          href="/docs/formatting-showcase/tables"
          className="inline-flex items-center gap-2 text-primary hover:underline font-medium"
        >
          Next: Tables
          <ArrowRight className="h-4 w-4" />
        </Link>
      </div>
    </>
  );
}
