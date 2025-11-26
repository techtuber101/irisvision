import React, { useState, useCallback } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { cn } from '@/lib/utils';
import { MermaidRenderer } from './mermaid-renderer';
import { isMermaidCode } from '@/lib/mermaid-utils';
import { Copy, Check, ChevronDown, ChevronUp } from 'lucide-react';
import { Button } from './button';
import { toast } from 'sonner';

export type MarkdownProps = {
  children: string;
  className?: string;
};

export const Markdown: React.FC<MarkdownProps> = React.memo(({
  children,
  className = ''
}) => {
  return (
    <div className={cn('prose prose-sm dark:prose-invert max-w-none', className)}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          // Custom styling for markdown elements
          h1: ({ children }) => <h1 className="text-lg font-semibold mb-2">{children}</h1>,
          h2: ({ children }) => <h2 className="text-base font-semibold mb-2">{children}</h2>,
          h3: ({ children }) => <h3 className="text-sm font-semibold mb-1">{children}</h3>,
          p: ({ children }) => <p className="mb-2 last:mb-0">{children}</p>,
          ul: ({ children }) => <ul className="list-disc list-inside mb-2 space-y-1">{children}</ul>,
          ol: ({ children }) => <ol className="list-decimal list-inside mb-2 space-y-1">{children}</ol>,
          li: ({ children }) => <li className="text-sm">{children}</li>,
          code: ({ children, className }) => {
            const match = /language-([\w-]+)/.exec(className || '');
            const language = match ? match[1] : '';
            const code = String(children);
            const isInline = !className?.includes('language-');

            // Skip empty code blocks
            if (!isInline && (!code.trim() || code.trim() === '')) {
              return null;
            }

            if (!isInline && language.startsWith('tool_')) {
              const trimmed = code.trim();
              if (!trimmed) {
                return null;
              }
              return (
                <span
                  data-tool-block
                  className="block whitespace-pre-wrap text-sm leading-6 text-foreground"
                >
                  {trimmed}
                </span>
              );
            }

            if (isInline) {
              return (
                <code className="bg-muted/50 dark:bg-accent/20 border border-border/20 dark:border-white/5 px-1.5 py-0.5 rounded text-xs font-mono shadow-sm dark:shadow-sm">
                  {children}
                </code>
              );
            }

            // Check if this is a Mermaid diagram
            if (isMermaidCode(language, code)) {
              return <MermaidRenderer chart={code} className="my-2" />;
            }

            // Enhanced code block with copy button and language badge
            return (
              <EnhancedCodeBlock 
                code={code} 
                language={language} 
                className={className}
              >
                {children}
              </EnhancedCodeBlock>
            );
          },
          pre: ({ children }) => {
            const childArray = React.Children.toArray(children);

            const toolChild = childArray.find((child) => React.isValidElement(child) && child.props?.['data-tool-block']);
            if (toolChild && React.isValidElement(toolChild)) {
              const toolContent = React.Children.toArray(toolChild.props.children)
                .map((child) => (typeof child === 'string' ? child : ''))
                .join('')
                .trim();

              if (!toolContent) {
                return null;
              }

              return toolChild;
            }

            const hasContent = childArray.some((child) => {
              if (typeof child === 'string') {
                return child.trim().length > 0;
              }

              if (React.isValidElement(child)) {
                const grandChildren = React.Children.toArray(child.props?.children ?? []);
                return grandChildren.some((grandChild) => {
                  if (typeof grandChild === 'string') {
                    return grandChild.trim().length > 0;
                  }
                  return React.isValidElement(grandChild);
                });
              }

              return false;
            });

            if (!hasContent) {
              return null;
            }

            // Pre tag is just a wrapper - styling is handled by the code component inside
            return <pre className="m-0">{children}</pre>;
          },
          blockquote: ({ children }) => <blockquote className="border-l-4 border-muted-foreground/20 pl-4 italic mb-2">{children}</blockquote>,
          strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
          em: ({ children }) => <em className="italic">{children}</em>,
          hr: () => <hr className="my-4 border-muted-foreground/20" />,
          table: ({ children }) => (
            <div className="overflow-x-auto">
              <table className="min-w-full border-collapse border border-border/30 dark:border-white/10 mb-2">
                {children}
              </table>
            </div>
          ),
          th: ({ children }) => (
            <th className="border border-border/30 dark:border-white/10 px-2 py-1 bg-muted/50 dark:bg-accent/30 font-semibold text-left text-xs">
              {children}
            </th>
          ),
          td: ({ children }) => (
            <td className="border border-border/30 dark:border-white/10 px-2 py-1 text-xs">
              {children}
            </td>
          ),
        }}
      >
        {children}
      </ReactMarkdown>
    </div>
  );
});

Markdown.displayName = 'Markdown';

// Enhanced Code Block Component with copy button, language badge, and expand/collapse
interface EnhancedCodeBlockProps {
  code: string;
  language: string;
  className?: string;
  children: React.ReactNode;
}

const EnhancedCodeBlock: React.FC<EnhancedCodeBlockProps> = ({ 
  code, 
  language, 
  className,
  children 
}) => {
  const [isCopied, setIsCopied] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [showExpandButton, setShowExpandButton] = useState(false);
  const codeRef = React.useRef<HTMLElement>(null);

  // Check if code block is long enough to need expand/collapse
  React.useEffect(() => {
    if (codeRef.current) {
      const height = codeRef.current.scrollHeight;
      const maxHeight = 300; // Show expand button if taller than 300px
      setShowExpandButton(height > maxHeight);
      if (height <= maxHeight) {
        setIsExpanded(true); // Auto-expand if short enough
      }
    }
  }, [code]);

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(code);
      setIsCopied(true);
      toast.success('Code copied to clipboard');
      setTimeout(() => setIsCopied(false), 2000);
    } catch (err) {
      toast.error('Failed to copy code');
    }
  }, [code]);

  const formatLanguage = (lang: string) => {
    if (!lang) return '';
    return lang
      .replace(/^language-/, '')
      .split('-')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  };

  return (
    <div className="relative group my-2">
      <code
        ref={codeRef}
        className={cn(
          'block',
          'bg-muted/50 dark:bg-accent/20',
          'border border-border/20 dark:border-white/10',
          'shadow-[0_1px_3px_rgba(0,0,0,0.1),inset_0_1px_0_rgba(0,0,0,0.02)]',
          'dark:shadow-[0_2px_8px_rgba(0,0,0,0.3),inset_0_1px_0_rgba(255,255,255,0.05)]',
          'p-3 rounded-lg',
          'text-xs font-mono',
          'overflow-x-auto',
          'backdrop-blur-sm',
          'leading-relaxed',
          'relative',
          'transition-all duration-200',
          !isExpanded && showExpandButton && 'max-h-[300px] overflow-y-hidden',
          className
        )}
      >
        {/* Language badge */}
        {language && (
          <div className="absolute top-2 left-3 z-10">
            <span className="px-2 py-0.5 text-[10px] font-medium rounded-md bg-background/80 dark:bg-background/40 border border-border/30 dark:border-white/10 text-muted-foreground backdrop-blur-sm">
              {formatLanguage(language)}
            </span>
          </div>
        )}

        {/* Copy button */}
        <div className="absolute top-2 right-2 z-10 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
          <Button
            variant="ghost"
            size="sm"
            className="h-7 w-7 p-0 bg-background/80 dark:bg-background/40 border border-border/30 dark:border-white/10 backdrop-blur-sm hover:bg-background/90 dark:hover:bg-background/50"
            onClick={handleCopy}
          >
            {isCopied ? (
              <Check className="h-3.5 w-3.5 text-green-600 dark:text-green-400" />
            ) : (
              <Copy className="h-3.5 w-3.5 text-muted-foreground" />
            )}
          </Button>
        </div>

        {/* Code content */}
        <div className={cn(
          'pt-6',
          language && 'pt-8'
        )}>
          {children}
        </div>

        {/* Expand/Collapse button */}
        {showExpandButton && (
          <div className="absolute bottom-0 left-0 right-0 z-10 bg-gradient-to-t from-background/95 dark:from-background/80 to-transparent pt-8 pb-2 flex justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-200">
            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-3 text-xs bg-background/80 dark:bg-background/40 border border-border/30 dark:border-white/10 backdrop-blur-sm hover:bg-background/90 dark:hover:bg-background/50"
              onClick={() => setIsExpanded(!isExpanded)}
            >
              {isExpanded ? (
                <>
                  <ChevronUp className="h-3 w-3 mr-1" />
                  Collapse
                </>
              ) : (
                <>
                  <ChevronDown className="h-3 w-3 mr-1" />
                  Expand
                </>
              )}
            </Button>
          </div>
        )}
      </code>
    </div>
  );
};
