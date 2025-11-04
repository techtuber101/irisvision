import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { extractToolData } from '../utils';
import { useFileContentQuery, useDirectoryQuery, fileQueryKeys } from '@/hooks/react-query/files/use-file-queries';
import { Editor } from '@/components/agents/docs-agent/editor';
import { createClient } from '@/lib/supabase/client';
import { Loader2 } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';

// On-demand rendering - no global cache to save storage

export interface DocMetadata {
  description?: string;
  tags?: string[];
  author?: string;
}

export interface DocumentInfo {
  id: string;
  title: string;
  filename: string;
  format: string;
  created_at: string;
  updated_at: string;
  metadata: DocMetadata;
  path: string;
  content?: string;
  preview_url?: string;
}

export interface DocsToolData {
  success: boolean;
  error?: string;
  message?: string;
  document?: DocumentInfo;
  documents?: DocumentInfo[];
  content?: string;
  preview_url?: string;
  download_url?: string;
  export_path?: string;
  count?: number;
  sandbox_id?: string;
  // PDF conversion fields
  pdf_path?: string;
  pdf_filename?: string;
  title?: string;
  _internal?: {
    sandbox_id?: string;
    pdf_info?: {
      pdf_path?: string;
      [key: string]: any;
    };
    [key: string]: any;
  };
}

export function extractDocsData(toolContent?: any): DocsToolData | null {
  if (!toolContent) return null;
  
  try {
    let data: any = null;
    const parsedToolData = extractToolData(toolContent);
    
    if (parsedToolData?.toolResult?.toolOutput) {
      const output = parsedToolData.toolResult.toolOutput;
      if (typeof output === 'string') {
        try {
          data = JSON.parse(output);
        } catch {
          data = { content: output, success: parsedToolData.toolResult.isSuccess };
        }
      } else {
        data = output;
      }
      if (data) {
        data.success = parsedToolData.toolResult.isSuccess;
      }
    }
    else if (typeof toolContent === 'string') {
      try {
        const parsed = JSON.parse(toolContent);
        if (parsed.tool_execution?.result?.output) {
          data = parsed.tool_execution.result.output;
          if (parsed.tool_execution.result.success !== undefined) {
            data.success = parsed.tool_execution.result.success;
          }
          // Check for sandbox_id at different levels
          if (!data.sandbox_id && parsed.tool_execution?.result?.sandbox_id) {
            data.sandbox_id = parsed.tool_execution.result.sandbox_id;
          }
          if (!data.sandbox_id && parsed.sandbox_id) {
            data.sandbox_id = parsed.sandbox_id;
          }
          // Extract sandbox_id from _internal if available (for PDF conversion)
          if (!data.sandbox_id && data._internal?.sandbox_id) {
            data.sandbox_id = data._internal.sandbox_id;
          }
        } else {
          data = parsed;
        }
      } catch {
        data = { content: toolContent, success: true };
      }
    }
    else if (toolContent.content && typeof toolContent.content === 'string') {
      try {
        const parsed = JSON.parse(toolContent.content);
        if (parsed.tool_execution?.result?.output) {
          data = parsed.tool_execution.result.output;
          if (parsed.tool_execution.result.success !== undefined) {
            data.success = parsed.tool_execution.result.success;
          }
          // Check for sandbox_id at different levels
          if (!data.sandbox_id && parsed.tool_execution?.result?.sandbox_id) {
            data.sandbox_id = parsed.tool_execution.result.sandbox_id;
          }
          if (!data.sandbox_id && parsed.sandbox_id) {
            data.sandbox_id = parsed.sandbox_id;
          }
          // Extract sandbox_id from _internal if available (for PDF conversion)
          if (!data.sandbox_id && data._internal?.sandbox_id) {
            data.sandbox_id = data._internal.sandbox_id;
          }
        } else {
          data = parsed;
        }
      } catch {
        data = { content: toolContent.content, success: true };
      }
    }
    else if (toolContent.output !== undefined) {
      if (typeof toolContent.output === 'string') {
        try {
          data = JSON.parse(toolContent.output);
        } catch {
          data = { content: toolContent.output, success: true };
        }
      } else {
        data = toolContent.output;
      }
      if (toolContent.success !== undefined) {
        data.success = toolContent.success;
      }
      // Extract sandbox_id from toolContent if available
      if (!data.sandbox_id && toolContent.sandbox_id) {
        data.sandbox_id = toolContent.sandbox_id;
      }
    }
    else if (toolContent.result) {
      if (toolContent.result.output) {
        data = toolContent.result.output;
        if (toolContent.result.success !== undefined) {
          data.success = toolContent.result.success;
        }
        // Extract sandbox_id from result if available
        if (!data.sandbox_id && toolContent.result.sandbox_id) {
          data.sandbox_id = toolContent.result.sandbox_id;
        }
      } else if (typeof toolContent.result === 'string') {
        try {
          data = JSON.parse(toolContent.result);
        } catch {
          data = { content: toolContent.result, success: true };
        }
      } else {
        data = toolContent.result;
      }
      // Extract sandbox_id from toolContent if available
      if (!data.sandbox_id && toolContent.sandbox_id) {
        data.sandbox_id = toolContent.sandbox_id;
      }
    }
    else if (typeof toolContent === 'object') {
      data = toolContent;
      // Check for sandbox_id at the top level
      if (!data.sandbox_id && toolContent.sandbox_id) {
        data.sandbox_id = toolContent.sandbox_id;
      }
    }
    
    if (data && data.success === undefined) {
      if (data.document || data.documents || data.message || data.content) {
        data.success = true;
      } else {
        data.success = false;
      }
    }
    return data;
  } catch (e) {
    console.error('Error parsing docs tool data:', e, toolContent);
    return { success: false, error: 'Failed to parse tool response' };
  }
}

export function extractToolName(toolContent?: any): string {
  try {
    // Check metadata first
    if (toolContent?.metadata?.tool_name) {
      return toolContent.metadata.tool_name;
    }
    // Check top-level tool_name
    if (toolContent?.tool_name) {
      return toolContent.tool_name;
    }
    // Check tool_execution format (for convert_to_pdf and other tools)
    if (typeof toolContent === 'string') {
      try {
        const parsed = JSON.parse(toolContent);
        if (parsed.tool_execution?.function_name) {
          return parsed.tool_execution.function_name;
        }
        if (parsed.tool_execution?.xml_tag_name) {
          return parsed.tool_execution.xml_tag_name;
        }
      } catch {}
    }
    // Check object format
    if (toolContent?.tool_execution?.function_name) {
      return toolContent.tool_execution.function_name;
    }
    if (toolContent?.tool_execution?.xml_tag_name) {
      return toolContent.tool_execution.xml_tag_name;
    }
    // Check nested content format
    if (toolContent?.content && typeof toolContent.content === 'string') {
      try {
        const parsed = JSON.parse(toolContent.content);
        if (parsed.tool_execution?.function_name) {
          return parsed.tool_execution.function_name;
        }
        if (parsed.tool_execution?.xml_tag_name) {
          return parsed.tool_execution.xml_tag_name;
        }
      } catch {}
    }
  } catch (e) {
  }
  return 'docs';
}

export function extractParametersFromAssistant(assistantContent?: any) {
  try {
    if (!assistantContent) return null;
    if (typeof assistantContent === 'string' && assistantContent.includes('tool_execution')) {
      try {
        const parsed = JSON.parse(assistantContent);
        if (parsed.content) {
          const innerParsed = JSON.parse(parsed.content);
          if (innerParsed.tool_execution?.arguments) {
            return innerParsed.tool_execution.arguments;
          }
        }
      } catch {}
    }
    const toolUseMatch = assistantContent.match(/<tool_use>[\s\S]*?<\/tool_use>/);
    if (toolUseMatch) {
      const toolUseContent = toolUseMatch[0];
      const paramsMatch = toolUseContent.match(/<parameters>([\s\S]*?)<\/parameters>/);
      if (paramsMatch) {
        return JSON.parse(paramsMatch[1]);
      }
    }
    const jsonMatch = assistantContent.match(/\{[\s\S]*"content"[\s\S]*\}/);
    if (jsonMatch) {
      try {
        return JSON.parse(jsonMatch[0]);
      } catch {}
    }
  } catch (e) {
    console.error('Error extracting parameters:', e);
  }
  return null;
}

export function extractStreamingDocumentContent(
  assistantContent?: any,
  toolName?: string
): { content?: string; title?: string; metadata?: any } | null {
  try {
    if (!assistantContent) return null;
    
    const contentStr = typeof assistantContent === 'string' 
      ? assistantContent 
      : (assistantContent.content || JSON.stringify(assistantContent));
  
    const functionCallsMatch = contentStr.match(/<function_calls>([\s\S]*?)<\/function_calls>/);
    if (functionCallsMatch) {
      const functionContent = functionCallsMatch[1];

      const invokeMatch = functionContent.match(/<invoke[^>]*name=["']([^"']+)["'][^>]*>([\s\S]*?)(?:<\/invoke>|$)/);
      if (invokeMatch) {
        const invokeName = invokeMatch[1];
        const invokeContent = invokeMatch[2];
        
        if (invokeName === 'create_document' || invokeName === 'update_document' || 
            invokeName === 'edit_file' || toolName?.includes('create') || toolName?.includes('update')) {
          
          const result: { content?: string; title?: string; metadata?: any } = {};
          

          const titleMatch = invokeContent.match(/<parameter[^>]*name=["']title["'][^>]*>([\s\S]*?)(?:<\/parameter>|$)/);
          if (titleMatch) {
            result.title = titleMatch[1].trim();
          }
          

          const contentMatch = invokeContent.match(/<parameter[^>]*name=["'](?:content|file_contents)["'][^>]*>([\s\S]*?)(?:<\/parameter>|$)/);
          if (contentMatch) {
            result.content = contentMatch[1];
          }
          

          const metadataMatch = invokeContent.match(/<parameter[^>]*name=["']metadata["'][^>]*>([\s\S]*?)(?:<\/parameter>|$)/);
          if (metadataMatch) {
            try {
              result.metadata = JSON.parse(metadataMatch[1]);
            } catch {
              result.metadata = metadataMatch[1];
            }
          }
          
          return result;
        }
      }
    }
    

    const createDocMatch = contentStr.match(/<create-document[^>]*>([\s\S]*?)(?:<\/create-document>|$)/);
    if (createDocMatch) {
      const docContent = createDocMatch[1];
      const result: { content?: string; title?: string; metadata?: any } = {};
      

      const titleAttrMatch = contentStr.match(/<create-document[^>]*title=["']([^"']+)["']/);
      if (titleAttrMatch) {
        result.title = titleAttrMatch[1];
      }
      
      // Content is the inner text
      if (docContent) {
        result.content = docContent;
      }
      
      return result;
    }
    
    // Try to extract from parameters in assistant content
    const params = extractParametersFromAssistant(assistantContent);
    if (params && (params.content || params.title)) {
      return {
        content: params.content,
        title: params.title,
        metadata: params.metadata
      };
    }
    
  } catch (e) {
    console.error('Error extracting streaming document content:', e);
  }
  
  return null;
}

export function getActionTitle(toolName: string): string {
  const normalizedName = toolName.replace(/-/g, '_');
  switch (normalizedName) {
    case 'create_document': return 'Document Created';
    case 'update_document': return 'Document Updated';
    case 'read_document': return 'Document Retrieved';
    case 'list_documents': return 'Documents Listed';
    case 'delete_document': return 'Document Deleted';
    case 'export_document': return 'Document Exported';
    case 'get_tiptap_format_guide': return 'Format Guide';
    default: return 'Document';
  }
}

export function LiveDocumentViewer({ 
  path, 
  sandboxId, 
  format,
  fallbackContent,
  refreshToken = 0
}: { 
  path?: string; 
  sandboxId?: string; 
  format: string;
  fallbackContent?: string;
  refreshToken?: number;
}) {
  const shouldFetch = Boolean(sandboxId && path);
  const queryClient = useQueryClient();

  const { data: fileContent, isLoading, error } = useFileContentQuery(
    sandboxId || '',
    path || '',
    {
      enabled: shouldFetch,
      contentType: 'text',
      staleTime: Number.POSITIVE_INFINITY,
      refetchOnWindowFocus: false,
      refetchOnReconnect: false,
      refetchOnMount: false,
    }
  );

  const fallback = fallbackContent || '';

  let content: string | null = null;

  if (shouldFetch) {
    if (typeof fileContent === 'string' && fileContent.length > 0) {
      content = fileContent;
    } else if (error && fallback) {
      content = fallback;
    }
  } else if (fallback) {
    content = fallback;
  }

  useEffect(() => {
    if (!shouldFetch || !sandboxId || !path || refreshToken === 0) {
      return;
    }
    const queryKey = fileQueryKeys.content(sandboxId, path, 'text');
    queryClient.invalidateQueries({ queryKey });
    queryClient.refetchQueries({ queryKey });
  }, [refreshToken, shouldFetch, sandboxId, path, queryClient]);

  if (shouldFetch && isLoading && !fileContent && !fallback) {
    return (
      <div className="w-full h-full min-h-[700px] flex flex-col relative">
        <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-[rgba(7,10,17,0.72)] rounded-lg">
          <Loader2 className="h-8 w-8 animate-spin text-white/60" />
          <p className="mt-4 text-sm text-white/60 font-medium">Rendering file...</p>
        </div>
      </div>
    );
  }

  if (error && !content) {
    return (
      <div className="w-full h-full min-h-[700px] flex flex-col relative">
        <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-[rgba(7,10,17,0.72)] rounded-lg">
          <div className="text-sm text-rose-500 font-medium">Failed to load document</div>
        </div>
      </div>
    );
  }

  if (!content) {
    return (
      <div className="w-full h-full min-h-[700px] flex flex-col relative">
        <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-[rgba(7,10,17,0.72)] rounded-lg light:bg-white">
          <div className="text-sm text-white/60 font-medium light:text-gray-600">Loading...</div>
        </div>
      </div>
    );
  }

  let normalizedContent: string = content;

  if (typeof normalizedContent === 'string' && (format === 'doc' || format === 'tiptap')) {
    try {
      const parsed = JSON.parse(normalizedContent);
      if (parsed.type === 'tiptap_document' && parsed.content) {
        normalizedContent = parsed.content;
      }
    } catch {
    }
  }

  return <DocumentViewer content={normalizedContent} format={format} key="live-document" />;
}

const sanitizeDocumentHtml = (html: string): string => {
  if (!html) return '';
  return html
    .replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, '')
    .replace(/on\w+="[^"]*"/gi, '')
    .replace(/on\w+='[^']*'/gi, '')
    .replace(/on\w+=\w+/gi, '');
};

export function DocumentViewer({ content, format }: { content: string; format: string }) {
  const [isRendering, setIsRendering] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);

  if (format === 'doc' || format === 'tiptap') {
    let htmlContent = content;
    try {
      const parsed = typeof content === 'string' ? JSON.parse(content) : content;
      if (parsed.type === 'tiptap_document' && parsed.content) {
        htmlContent = parsed.content;
      }
    } catch {
    }

    // Create a stable content hash to detect changes
    const contentHash = useMemo(() => {
      let hash = 2166136261;
      for (let i = 0; i < htmlContent.length; i++) {
        hash ^= htmlContent.charCodeAt(i);
        hash = Math.imul(hash, 16777619);
      }
      return (hash >>> 0).toString(16);
    }, [htmlContent]);

    const sanitizedHtml = useMemo(() => sanitizeDocumentHtml(htmlContent), [htmlContent]);

    const iframeHtml = useMemo(() => {
      return `
          <!DOCTYPE html>
          <html>
          <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <style>
              body { 
                font-family: 'Geist', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; 
                padding: 1.5rem; 
                max-width: none; 
                margin: 0;
                line-height: 1.6;
                background: #070a11;
                color: #ffffff;
                width: 100%;
                box-sizing: border-box;
                min-height: 100vh;
              }
              
              /* Dark mode styles */
              @media (prefers-color-scheme: dark) {
                body {
                  background: #070a11;
                  color: #ffffff;
                }
                h1, h2, h3, h4, h5, h6 { color: #ffffff; }
                p, li, td, th { color: #e2e8f0; }
                code { 
                  background: rgba(0,0,0,0.3); 
                  border: 1px solid rgba(255,255,255,0.1);
                  color: #e2e8f0;
                }
                pre { 
                  background: rgba(0,0,0,0.3); 
                  border: 1px solid rgba(255,255,255,0.1);
                  color: #e2e8f0;
                }
                blockquote { 
                  border-left: 3px solid #60a5fa; 
                  color: #94a3b8; 
                  background: rgba(255,255,255,0.02);
                }
                table { 
                  border: 1px solid rgba(255,255,255,0.1);
                }
                th, td { 
                  border: 1px solid rgba(255,255,255,0.1); 
                  color: #e2e8f0;
                }
                th { 
                  background-color: rgba(255,255,255,0.05); 
                  color: #ffffff;
                }
                tr:nth-child(even) {
                  background-color: rgba(255,255,255,0.02);
                }
                a { color: #60a5fa; }
                a:hover { color: #93c5fd; }
              }
              
              /* Light mode styles */
              @media (prefers-color-scheme: light) {
                body {
                  background: #ffffff;
                  color: #1f2937;
                }
                h1, h2, h3, h4, h5, h6 { color: #1f2937; }
                p, li, td, th { color: #374151; }
                code { 
                  background: #f3f4f6; 
                  border: 1px solid #e5e7eb;
                  color: #1f2937;
                }
                pre { 
                  background: #f3f4f6; 
                  border: 1px solid #e5e7eb;
                  color: #1f2937;
                }
                blockquote { 
                  border-left: 3px solid #3b82f6; 
                  color: #6b7280; 
                  background: #f9fafb;
                }
                table { 
                  border: 1px solid #e5e7eb;
                }
                th, td { 
                  border: 1px solid #e5e7eb; 
                  color: #374151;
                }
                th { 
                  background-color: #f9fafb; 
                  color: #1f2937;
                }
                tr:nth-child(even) {
                  background-color: #f9fafb;
                }
                a { color: #3b82f6; }
                a:hover { color: #1d4ed8; }
              }
              
              /* Base typography */
              h1, h2, h3, h4, h5, h6 { 
                margin-top: 1.5rem; 
                margin-bottom: 0.75rem; 
                font-weight: 600;
              }
              h1 { font-size: 2rem; }
              h2 { font-size: 1.75rem; }
              h3 { font-size: 1.375rem; }
              h4 { font-size: 1.125rem; }
              h5 { font-size: 1rem; }
              h6 { font-size: 0.875rem; }
              
              p { margin: 1.25rem 0; }
              ul, ol { margin: 1.25rem 0; padding-left: 1.75rem; }
              li { margin-bottom: 0.375rem; }
              
              code { 
                padding: 0.15rem 0.3rem; 
                border-radius: 3px; 
                font-family: 'Geist Mono', 'SF Mono', Monaco, 'Courier New', monospace;
                font-size: 0.8em;
              }
              pre { 
                padding: 1.25rem; 
                border-radius: 8px; 
                overflow-x: auto; 
                font-family: 'Geist Mono', 'SF Mono', Monaco, 'Courier New', monospace;
                font-size: 0.8em;
                margin: 1.25rem 0;
              }
              pre code {
                background: none;
                border: none;
                padding: 0;
              }
              
              blockquote { 
                margin: 1.25rem 0; 
                padding: 1.25rem; 
                border-radius: 8px;
                font-style: italic;
              }
              
              table { 
                border-collapse: collapse; 
                width: 100%; 
                margin: 1.25rem 0; 
                border-radius: 8px;
                overflow: hidden;
              }
              th, td { 
                padding: 0.875rem; 
                text-align: left; 
                vertical-align: top;
              }
              th { 
                font-weight: 600;
              }
              
              img { 
                max-width: 100%; 
                height: auto; 
                border-radius: 8px;
                margin: 1.25rem 0;
                display: block;
                object-fit: contain;
              }
              
              /* Ensure data URI images and external images display properly */
              img[src^="data:"] {
                max-width: 100%;
                height: auto;
              }
              
              img[src^="http://"],
              img[src^="https://"] {
                max-width: 100%;
                height: auto;
              }
              
              hr {
                border: none;
                border-top: 2px solid;
                margin: 2rem 0;
                opacity: 0.3;
              }
              
              /* Strong and emphasis */
              strong, b { font-weight: 600; }
              em, i { font-style: italic; }
              u { text-decoration: underline; }
              s, strike, del { text-decoration: line-through; }
              
              /* Links */
              a { 
                text-decoration: none; 
              }
              a:hover {
                text-decoration: underline;
              }
            </style>
          </head>
          <body>
            ${sanitizedHtml}
          </body>
          </html>
        `;
    }, [sanitizedHtml]);

    useEffect(() => {
      setIsRendering(true);
      setRefreshKey(prev => prev + 1);
    }, [contentHash]);

    const handleLoad = useCallback(() => {
      setIsRendering(false);
    }, []);

    return (
      <div className="w-full h-full min-h-[700px] flex flex-col relative">
        {isRendering && (
          <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-[rgba(7,10,17,0.72)] rounded-lg light:bg-white">
            <Loader2 className="h-8 w-8 animate-spin text-white/60 light:text-gray-600" />
            <p className="mt-4 text-sm text-white/60 font-medium light:text-gray-600">Rendering document...</p>
          </div>
        )}
        <iframe
          key={`document-${refreshKey}-${contentHash}`}
          srcDoc={iframeHtml}
          title="Document Preview"
          className="w-[calc(100%+32px)] -mx-4 flex-1 border-0 rounded-lg min-h-[600px]"
          sandbox="allow-same-origin allow-scripts allow-popups"
          onLoad={handleLoad}
        />
      </div>
    );
  }
  
  if (format === 'html') {
    return (
      <div className="w-full">
        <Editor 
          content={content}
          readOnly={true}
          useStore={false}
          showWordCount={false}
          autoSave={false}
          minHeight="0"
          className="w-full"
          editorClassName="focus:outline-none bg-transparent border-0 w-full prose prose-sm dark:prose-invert max-w-none prose-img:max-w-none prose-img:w-full prose-img:h-auto [&_img]:max-w-full [&_img]:h-auto [&_img]:object-contain [&_img]:block"
        />
      </div>
    );
  }
  
  if (format === 'markdown') {
    return (
      <pre className="whitespace-pre-wrap font-mono text-sm">
        {content}
      </pre>
    );
  }
  
  if (format === 'json') {
    try {
      const parsed = JSON.parse(content);
      return (
        <pre className="whitespace-pre-wrap font-mono text-sm">
          {JSON.stringify(parsed, null, 2)}
        </pre>
      );
    } catch {
      return (
        <pre className="whitespace-pre-wrap font-mono text-sm">
          {content}
        </pre>
      );
    }
  }
  
  return (
    <div className="whitespace-pre-wrap text-sm">
      {content}
    </div>
  );
} 
