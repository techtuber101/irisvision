'use client';

import React, { useState, useCallback, useEffect } from 'react';
import {
  FileText,
  CheckCircle,
  AlertTriangle,
  Pen,
  Download,
  ChevronDown,
  Loader2,
  Share,
  ExternalLink,
} from 'lucide-react';
import { ToolViewProps } from '../types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { LoadingState } from '../shared/LoadingState';
import { cn } from '@/lib/utils';
import { FileViewerModal } from '@/components/thread/file-viewer-modal';
import { TipTapDocumentModal } from '@/components/thread/tiptap-document-modal';
import { exportDocument, type ExportFormat } from '@/lib/utils/document-export';
import { createClient } from '@/lib/supabase/client';
import { handleGoogleDocsUpload, checkPendingGoogleDocsUpload } from '@/lib/utils/google-docs-utils';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { 
  DocumentInfo, 
  extractDocsData, 
  extractToolName, 
  extractParametersFromAssistant,
  extractStreamingDocumentContent,
  getActionTitle,
  LiveDocumentViewer,
  DocumentViewer
} from './_utils';
import { fileQueryKeys } from '@/hooks/react-query/files/use-file-queries';

// File type icon mapping
const FILE_TYPE_ICONS: Record<string, string> = {
  pdf: '/filetypes/pdf.png',
  docx: '/filetypes/docx.png',
  docs: '/filetypes/docs.png',
  images: '/filetypes/gallery.png',
  txt: '/filetypes/text-format.png', // Try text-format.png again
  html: '/filetypes/text-format.png', // Try text-format.png for HTML files
  markdown: '/filetypes/text-format.png', // Try text-format.png for markdown files
};

export function DocsToolView({
  name = 'docs',
  assistantContent,
  toolContent,
  assistantTimestamp,
  toolTimestamp,
  isSuccess = true,
  isStreaming = false,
  project,
  onSubmit,
}: ToolViewProps) {
  const [fileViewerOpen, setFileViewerOpen] = useState(false);
  const [selectedDocPath, setSelectedDocPath] = useState<string | null>(null);
  const [editorOpen, setEditorOpen] = useState(false);
  const [editorDocumentData, setEditorDocumentData] = useState<any>(null);
  const [editorFilePath, setEditorFilePath] = useState<string | null>(null);
  const [isExporting, setIsExporting] = useState(false);
  const [isEditLoading, setIsEditLoading] = useState(false);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [documentRefreshToken, setDocumentRefreshToken] = useState(0);
  const [documentPreviewContent, setDocumentPreviewContent] = useState<string | null>(null);
  
  const queryClient = useQueryClient();
  
  // Check for pending Google Docs upload after OAuth callback
  useEffect(() => {
    checkPendingGoogleDocsUpload();
  }, []);
  
  const handleOpenInEditor = useCallback(async (doc: DocumentInfo, content?: string, data?: any) => {
    setIsEditLoading(true);
    
    try {
      let actualContent = content || doc.content || '';
      if (data?.sandbox_id && doc.path) {
        try {
          const supabase = createClient();
          const { data: { session } } = await supabase.auth.getSession();
          
          if (session?.access_token) {
            const response = await fetch(
              `${process.env.NEXT_PUBLIC_BACKEND_URL}/sandboxes/${data.sandbox_id}/files?path=${encodeURIComponent(doc.path)}`,
              {
                headers: {
                  'Authorization': `Bearer ${session.access_token}`,
                },
              }
            );

            if (response.ok) {
              const fileContent = await response.text();
              try {
                const parsedDocument = JSON.parse(fileContent);
                if (parsedDocument.type === 'tiptap_document' && parsedDocument.content) {
                  actualContent = parsedDocument.content;
                }
              } catch {}
            }
          }
        } catch (error) {
          console.error('Failed to fetch latest content:', error);
        }
      }
      if (actualContent === '<p></p>' || actualContent === '<p><br></p>' || actualContent.trim() === '') {
        if (data && data.content) {
          actualContent = data.content;
        }
      }
      
      const documentData = {
        type: 'tiptap_document',
        version: '1.0',
        title: doc.title,
        content: actualContent,
        metadata: doc.metadata || {},
        created_at: doc.created_at,
        updated_at: doc.updated_at || new Date().toISOString(),
        doc_id: doc.id
      };
      
      setEditorDocumentData(documentData);
      setEditorFilePath(doc.path);
      setEditorOpen(true);
      setDocumentPreviewContent(actualContent);
    } finally {
      setIsEditLoading(false);
    }
  }, []);
  
  const toolName = extractToolName(toolContent) || name || 'docs';
  let data = extractDocsData(toolContent);
  
  if (!data?.sandbox_id && project?.id) {
    data = { ...data, sandbox_id: project.id, success: data?.success ?? true };
  }
  
  let streamingContent: { content?: string; title?: string; metadata?: any } | null = null;
  if (isStreaming && !data) {
    streamingContent = extractStreamingDocumentContent(assistantContent, toolName);
  }

  useEffect(() => {
    if (data?.document) {
      const initial = data.content || data.document.content || '';
      setDocumentPreviewContent(initial);
    } else if (!data?.document && streamingContent?.content) {
      setDocumentPreviewContent(streamingContent.content);
    }
  }, [data?.document?.path, data?.document?.content, data?.content, streamingContent?.content]);
  
  useEffect(() => {
    setDocumentRefreshToken(0);
  }, [data?.document?.path]);

  const fetchLatestDocumentContent = useCallback(async (): Promise<string> => {
    let actualContent = documentPreviewContent || data?.content || data?.document?.content || streamingContent?.content || '';

    const sandboxId = data?.sandbox_id || project?.sandbox?.id;
    const docPath = data?.document?.path;

    if (sandboxId && docPath) {
      try {
        const supabase = createClient();
        const { data: sessionData } = await supabase.auth.getSession();
        const accessToken = sessionData.session?.access_token;

        if (accessToken) {
          const response = await fetch(
            `${process.env.NEXT_PUBLIC_BACKEND_URL}/sandboxes/${sandboxId}/files?path=${encodeURIComponent(docPath)}`,
            {
              headers: {
                Authorization: `Bearer ${accessToken}`,
              },
            }
          );

          if (response.ok) {
            const fileContent = await response.text();
            try {
              const parsedDocument = JSON.parse(fileContent);
              if (parsedDocument.type === 'tiptap_document' && parsedDocument.content) {
                actualContent = parsedDocument.content;
              }
            } catch {
              if (fileContent?.trim()) {
                actualContent = fileContent;
              }
            }
          }
        }
      } catch (error) {
        console.error('Failed to fetch latest document content for export:', error);
      }
    }

    if (!actualContent || actualContent === '<p></p>' || actualContent === '<p><br></p>') {
      actualContent = streamingContent?.content || data?.content || data?.document?.content || actualContent || '';
    }

    return actualContent || '';
  }, [data, project?.sandbox?.id, documentPreviewContent, streamingContent]);

  const handleExport = useCallback(async (format: ExportFormat | 'google-docs') => {
    if (format === 'google-docs') {
      // Show "Feature coming soon!" toast for Google Docs export
      toast.info('Feature coming soon!', {
        description: 'Google Docs export will be available in a future update.',
        duration: 3000,
      });
      return;
    } else if (format === 'images') {
      // Show "Feature coming soon!" toast for images export
      toast.info('Feature coming soon!', {
        description: 'Export to images will be available in a future update.',
        duration: 3000,
      });
      return;
    } else if (format === 'pdf') {
      // Send automatic message to Iris for PDF conversion
      if (onSubmit && data?.document?.path) {
        const fileName = data.document.title || data.document.filename || 'document';
        const message = `Iris, convert the ${fileName} to pdf and attach it here and only if that's not possible give me the secure cloud uploaded link for the pdf file.`;
        onSubmit(message, { hidden: true });
      } else {
        console.error('onSubmit function not available or document path missing');
      }
    } else {
      setIsExporting(true);
      try {
        const content = await fetchLatestDocumentContent();
        const fileName = data?.document?.title || streamingContent?.title || 'document';

        await exportDocument({ content, fileName, format });
      } finally {
        setIsExporting(false);
      }
    }
  }, [data, streamingContent, project, onSubmit, fetchLatestDocumentContent]);
  
  const assistantParams = extractParametersFromAssistant(assistantContent);
  
  if (data && assistantParams && (toolName.includes('create') || toolName.includes('update'))) {
    if (!data.content && assistantParams.content) {
      data.content = assistantParams.content;
    }
    if (data.document && !data.document.content && assistantParams.content) {
      data.document.content = assistantParams.content;
    }
  }

  const handleDocumentSave = useCallback((updatedContent: string) => {
    setDocumentPreviewContent(updatedContent);
    setEditorDocumentData((prev: any) =>
      prev ? { ...prev, content: updatedContent, updated_at: new Date().toISOString() } : prev
    );
    setDocumentRefreshToken((prev) => prev + 1);

    const sandboxId = data?.sandbox_id || project?.id;
    const targetPath = editorFilePath || data?.document?.path;
    if (sandboxId && targetPath) {
      const queryKey = fileQueryKeys.content(sandboxId, targetPath, 'text');
      queryClient.invalidateQueries({ queryKey });
      queryClient.refetchQueries({ queryKey });
    }
  }, [data?.sandbox_id, data?.document?.path, editorFilePath, project?.id, queryClient]);

  // Show streaming content if available
  if (isStreaming && streamingContent) {
    // Create a temporary data structure for streaming display
    data = {
      success: true,
      document: {
        id: 'streaming',
        title: streamingContent.title || 'Creating document...',
        filename: 'streaming',
        format: 'doc',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        metadata: streamingContent.metadata || {},
        path: '',
        content: streamingContent.content || ''
      },
      content: streamingContent.content
    };
  } else if (isStreaming || !data) {
    return <LoadingState title="Processing Document..." />;
  }
  
  const getStatusIcon = () => {
    if (!data || !data.success || data.error) {
      return <AlertTriangle className="w-2 h-2 text-rose-500" />;
    }
    return <CheckCircle className="w-2 h-2 text-emerald-500" />;
  };
  
  // Ensure we get the correct sandbox ID - prioritize project's sandbox ID
  const resolvedSandboxId =
    project?.sandbox?.id ||
    data?.sandbox_id ||
    data?._internal?.sandbox_id ||
    project?.id ||
    '';

  const normalizeWorkspacePath = (path?: string | null) => {
    if (!path || typeof path !== 'string') return null;
    return path.startsWith('/workspace') ? path : `/workspace/${path.replace(/^\//, '')}`;
  };

  return (
    <>
    <Card className="gap-0 flex border shadow-none border-t border-b-0 border-x-0 p-0 rounded-none flex-col h-full overflow-hidden bg-[rgba(7,10,17,0.95)] backdrop-blur-xl light:bg-white light:text-zinc-800 light:border-black/10">
      <CardHeader className="h-14 bg-[rgba(7,10,17,0.95)] backdrop-blur-xl border-b border-white/10 p-2 px-4 space-y-2 light:bg-white light:border-black/10">
        <div className="flex flex-row items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="relative p-2 rounded-xl bg-gradient-to-br from-blue-500/20 to-purple-600/10 border border-blue-500/20">
              <FileText className="w-5 h-5 text-blue-500 dark:text-blue-400" />
            </div>
            <div>
              {getActionTitle(toolName)}
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            {isStreaming && (
              <div className="flex items-center gap-1.5 px-2 py-1 bg-blue-50 dark:bg-blue-900/30 rounded-lg">
                <Loader2 className="h-3 w-3 animate-spin text-blue-600 dark:text-blue-400" />
                <span className="text-xs font-medium text-blue-700 dark:text-blue-300">Streaming</span>
              </div>
            )}
            {!isStreaming && data.document?.format === 'doc' && (
              <>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={isEditLoading}
                  className="bg-white/5 border-white/10 text-white/90 hover:bg-white/10 hover:border-white/20 backdrop-blur-sm transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed light:bg-white light:text-zinc-800 light:border-black/10 light:hover:bg-black/5 light:hover:border-black/20"
                  onClick={() => {
                    if (!data.document) return;
                    let content = data.document.content || '';
                    if (typeof content === 'string' && content.includes('"type":"tiptap_document"')) {
                      try {
                        const parsed = JSON.parse(content);
                        if (parsed.type === 'tiptap_document' && parsed.content) {
                          content = parsed.content;
                        }
                      } catch {}
                    }
                    handleOpenInEditor(data.document, content, data);
                  }}
                >
                  {isEditLoading ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : (
                    <Pen className="h-3 w-3" />
                  )}
                  {isEditLoading ? 'Opening Iris Editor...' : 'Edit'}
                </Button>
                
                <DropdownMenu onOpenChange={setIsDropdownOpen}>
                  <DropdownMenuTrigger asChild>
                    <Button 
                      size="sm" 
                      variant="outline" 
                      disabled={isExporting}
                      className="bg-white/5 border-white/10 text-white/90 hover:bg-white/10 hover:border-white/20 backdrop-blur-sm transition-all duration-200 disabled:opacity-50 light:bg-white light:text-zinc-800 light:border-black/10 light:hover:bg-black/5 light:hover:border-black/20"
                    >
                      {isExporting ? (
                        <Loader2 className="h-3 w-3 animate-spin" />
                      ) : (
                        <Download className="h-3 w-3" />
                      )}
                      Export
                      <ChevronDown className="h-3 w-3" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent 
                    align="end"
                    className="bg-[rgba(7,10,17,0.95)] border-white/10 backdrop-blur-xl shadow-[0_20px_60px_-10px_rgba(0,0,0,0.3),inset_0_1px_0_rgba(255,255,255,0.1)] light:bg-white light:border-black/10 light:shadow-none"
                  >
                    {/* First: Export As Text */}
                    <DropdownMenuItem 
                      onClick={() => handleExport('txt')}
                      className="text-white/90 hover:bg-white/10 hover:text-white focus:bg-white/10 focus:text-white light:text-zinc-800 light:hover:bg-white/60 light:hover:text-zinc-900 light:focus:bg-white/60 light:focus:text-zinc-900"
                    >
                      <div className="flex items-center gap-3">
                        <img
                          src={FILE_TYPE_ICONS.txt}
                          alt="Text file icon"
                          className="flex-shrink-0 bg-white rounded-sm p-1 w-5 h-5 light:w-6 light:h-6"
                          onError={(e) => {
                            console.error('Failed to load text icon:', FILE_TYPE_ICONS.txt, e);
                            // Fallback to a different icon
                            e.currentTarget.src = '/filetypes/docs.png';
                          }}
                          onLoad={() => console.log('Text icon loaded:', FILE_TYPE_ICONS.txt)}
                        />
                        <span className="text-sm font-medium">Export as Text</span>
                      </div>
                    </DropdownMenuItem>
                    
                    {/* Second: Export As PDF */}
                    <DropdownMenuItem 
                      onClick={() => handleExport('pdf')}
                      className="text-white/90 hover:bg-white/10 hover:text-white focus:bg-white/10 focus:text-white light:text-zinc-800 light:hover:bg-white/60 light:hover:text-zinc-900 light:focus:bg-white/60 light:focus:text-zinc-900"
                    >
                      <div className="flex items-center gap-3">
                        <img
                          src={FILE_TYPE_ICONS.pdf}
                          alt="PDF file icon"
                          width={20}
                          height={20}
                          className="flex-shrink-0"
                        />
                        <span className="text-sm font-medium">Export as PDF</span>
                      </div>
                    </DropdownMenuItem>
                    
                    {/* Third: Export as DOCX */}
                    <DropdownMenuItem 
                      onClick={() => handleExport('docx')}
                      className="text-white/90 hover:bg-white/10 hover:text-white focus:bg-white/10 focus:text-white light:text-zinc-800 light:hover:bg-white/60 light:hover:text-zinc-900 light:focus:bg-white/60 light:focus:text-zinc-900"
                    >
                      <div className="flex items-center gap-3">
                        <img
                          src={FILE_TYPE_ICONS.docx}
                          alt="DOCX file icon"
                          width={20}
                          height={20}
                          className="flex-shrink-0"
                        />
                        <span className="text-sm font-medium">Export as DOCX</span>
                      </div>
                    </DropdownMenuItem>
                    
                    {/* Fourth: Export as Images */}
                    <DropdownMenuItem 
                      onClick={() => handleExport('images')}
                      disabled={true}
                      className="text-white/50 hover:bg-white/5 hover:text-white/50 focus:bg-white/5 focus:text-white/50 cursor-not-allowed light:text-zinc-400 light:hover:bg-black/5 light:hover:text-zinc-500 light:focus:bg-black/5 light:focus:text-zinc-500"
                    >
                      <div className="flex items-center gap-3">
                        <img
                          src={FILE_TYPE_ICONS.images}
                          alt="Images file icon"
                          width={20}
                          height={20}
                          className="flex-shrink-0 opacity-50"
                        />
                        <span className="text-sm font-medium">Export as Images</span>
                      </div>
                    </DropdownMenuItem>
                    
                    {/* Fifth: Upload to Google Docs (only if sandbox available) */}
                    {project?.sandbox?.sandbox_url && data?.document?.path && (
                      <DropdownMenuItem 
                        onClick={() => handleExport('google-docs')}
                        disabled={true}
                        className="text-white/50 hover:bg-white/5 hover:text-white/50 focus:bg-white/5 focus:text-white/50 cursor-not-allowed light:text-zinc-400 light:hover:bg-black/5 light:hover:text-zinc-500 light:focus:bg-black/5 light:focus:text-zinc-500"
                      >
                        <div className="flex items-center gap-3">
                          <img
                            src={FILE_TYPE_ICONS.docs}
                            alt="Google Docs icon"
                            width={20}
                            height={20}
                            className="flex-shrink-0 opacity-50"
                          />
                          <span className="text-sm font-medium">Upload to Google Docs</span>
                        </div>
                      </DropdownMenuItem>
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>
              </>
            )}
            {!isStreaming && (
              <Badge
                variant="secondary"
                className={cn(
                  data && data.success && !data.error
                    ? "bg-gradient-to-b from-emerald-200 to-emerald-100 text-emerald-700 dark:from-emerald-800/50 dark:to-emerald-900/60 dark:text-emerald-300"
                    : "bg-gradient-to-b from-rose-200 to-rose-100 text-rose-700 dark:from-rose-800/50 dark:to-rose-900/60 dark:text-rose-300"
                )}
              >
                {getStatusIcon()}
                {data && data.success && !data.error ? 'Success' : 'Failed'}
              </Badge>
            )}
          </div>
        </div>
      </CardHeader>
      
        <CardContent className="flex-1 px-0 overflow-hidden flex flex-col min-h-[500px]">
        {data.error ? (
          <div className="space-y-4 p-4">
            <div className="flex items-center gap-2 p-4 bg-rose-50 dark:bg-rose-900/20 rounded-lg">
              <AlertTriangle className="h-5 w-5 text-rose-500" />
              <span className="text-sm text-rose-700 dark:text-rose-300">
                {data.error}
              </span>
            </div>
            {process.env.NODE_ENV === 'development' && toolContent && (
              <details className="text-xs">
                <summary className="cursor-pointer text-muted-foreground">Debug: Raw Response</summary>
                <pre className="mt-2 p-2 bg-muted rounded text-xs overflow-auto">
                  {JSON.stringify(toolContent, null, 2)}
                </pre>
              </details>
            )}
          </div>
        ) : (
          <div className="flex-1 flex flex-col min-h-0">
            {/* PDF Conversion Success Display */}
            {(toolName === 'convert_to_pdf' || toolName === 'convert-to-pdf' || toolName.includes('convert')) && data.pdf_path ? (
              data.success !== false ? (
                <div className="flex-1 flex flex-col items-center justify-center p-10 text-center space-y-8">
                  <div className="relative flex flex-col items-center">
                    <div className="absolute inset-0 blur-[90px] opacity-30 dark:opacity-40 pointer-events-none" style={{ background: 'radial-gradient(circle, rgba(16,185,129,0.35) 0%, rgba(16,185,129,0) 70%)' }} />
                    <div className="relative w-32 h-40 rounded-3xl border border-white/15 dark:border-white/10 bg-gradient-to-br from-emerald-400/15 via-sky-500/10 to-blue-600/15 shadow-[0_20px_50px_-20px_rgba(14,165,233,0.9)] light:border-black/10 light:bg-gradient-to-br light:from-white light:via-slate-100 light:to-slate-200 flex items-center justify-center">
                      <div className="absolute inset-x-4 top-4 h-4 rounded-full bg-white/70 dark:bg-white/10 blur-sm" />
                      <div className="w-20 h-28 rounded-2xl bg-white/95 dark:bg-white/5 border border-white/40 dark:border-white/10 shadow-inner flex flex-col items-center justify-center gap-1">
                        <span className="text-xs font-semibold tracking-[0.25em] text-rose-500 dark:text-rose-300">PDF</span>
                        <div className="w-10 h-px bg-black/10 dark:bg-white/10" />
                        <div className="space-y-1">
                          <div className="w-12 h-1.5 rounded-full bg-emerald-500/70 dark:bg-emerald-400/60" />
                          <div className="w-12 h-1.5 rounded-full bg-sky-400/70 dark:bg-sky-400/50" />
                          <div className="w-8 h-1.5 rounded-full bg-indigo-400/70 dark:bg-indigo-300/60 mx-auto" />
                        </div>
                      </div>
                      <div className="absolute -bottom-4 right-4 h-11 w-11 rounded-full bg-emerald-400 text-white flex items-center justify-center border border-white/40 shadow-[0_10px_25px_rgba(16,185,129,0.65)] dark:bg-emerald-500">
                        <CheckCircle className="h-6 w-6" />
                      </div>
                    </div>
                  </div>
                  <div className="space-y-3 px-6">
                    <h2 className="text-2xl font-semibold text-white light:text-black">
                      PDF ready to open
                    </h2>
                    <p className="text-sm text-white/70 light:text-black/60 max-w-xl mx-auto">
                      {data.title || 'Your document'} has been converted with full formatting intact.
                      Open it instantly or download to keep working offline.
                    </p>
                  </div>
                    <Button
                      size="lg"
                      onClick={() => {
                        const sandboxId = resolvedSandboxId;
                        // Get the PDF path from various possible locations
                        const rawPath = data.pdf_path || 
                                       data?._internal?.pdf_info?.pdf_path ||
                                       data?.pdf_filename;
                        
                        // Normalize the path - ensure it starts with /workspace
                        let pdfPath: string | null = null;
                        if (rawPath) {
                          if (typeof rawPath === 'string') {
                            // If it's already a full path, use it
                            if (rawPath.startsWith('/workspace')) {
                              pdfPath = rawPath;
                            } else if (rawPath.startsWith('/')) {
                              // If it starts with / but not /workspace, prepend /workspace
                              pdfPath = `/workspace${rawPath}`;
                            } else {
                              // If it's just a filename, assume it's in /workspace/docs
                              pdfPath = `/workspace/docs/${rawPath}`;
                            }
                          }
                        }
                        
                        // Ensure we use the project's sandbox ID, not from data
                        const correctSandboxId = project?.sandbox?.id || sandboxId;
                        
                        if (correctSandboxId && pdfPath) {
                          setSelectedDocPath(pdfPath);
                          setFileViewerOpen(true);
                        } else {
                          console.error('Failed to open PDF: missing sandboxId or pdfPath', { 
                            correctSandboxId, 
                            pdfPath, 
                            projectSandboxId: project?.sandbox?.id,
                            resolvedSandboxId: sandboxId,
                            data 
                          });
                        }
                      }}
                    className="h-12 rounded-2xl border border-white/20 bg-white/10 backdrop-blur-sm px-8 text-base font-semibold text-white shadow-[0_8px_30px_rgba(0,0,0,0.25),inset_0_1px_0_rgba(255,255,255,0.15)] transition-all duration-200 hover:border-white/30 hover:bg-white/15 hover:shadow-[0_12px_40px_rgba(0,0,0,0.35),inset_0_1px_0_rgba(255,255,255,0.2)] active:scale-[0.98] light:border-black/10 light:bg-black/5 light:text-black light:shadow-[0_8px_20px_rgba(0,0,0,0.08),inset_0_1px_0_rgba(0,0,0,0.08)] light:hover:border-black/15 light:hover:bg-black/8 light:hover:shadow-[0_12px_30px_rgba(0,0,0,0.12),inset_0_1px_0_rgba(0,0,0,0.12)]"
                  >
                    <ExternalLink className="h-5 w-5 mr-2" />
                    Open PDF
                  </Button>
                </div>
              ) : (
                <div className="flex-1 flex flex-col items-center justify-center p-12">
                  <AlertTriangle className="h-8 w-8 text-rose-500 mb-4" />
                  <p className="text-lg text-muted-foreground">
                    {data.error || 'PDF conversion failed'}
                  </p>
                </div>
              )
            ) : null}
            {data.document && !data.documents && (toolName !== 'convert_to_pdf' && toolName !== 'convert-to-pdf') ? (
              <div className="flex-1 min-h-0">
                {(data.document.path || data.content || data.document.content) && (
                  <div className="h-full overflow-y-auto p-4 scrollbar-thin scrollbar-thumb-white/20 scrollbar-track-transparent">
                    {isStreaming && (
                      <div className="mb-3 flex items-center gap-2 text-sm text-muted-foreground">
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        <span>Content is streaming...</span>
                      </div>
                    )}
                    <div className="w-full max-w-none flex-1 min-h-0">
                      {data.document.path && data.sandbox_id && !isStreaming ? (
                        <LiveDocumentViewer 
                          path={data.document.path}
                          sandboxId={data.sandbox_id}
                          format={data.document.format || 'doc'}
                          fallbackContent={documentPreviewContent || data.content || data.document.content || ''}
                          refreshToken={documentRefreshToken}
                        />
                      ) : (
                        <DocumentViewer 
                          content={documentPreviewContent || data.content || data.document.content || ''} 
                          format={data.document.format || 'doc'} 
                        />
                      )}
                    </div>
                  </div>
                )}
              </div>
            ) : null}
            {data.documents && data.documents.length === 0 && (
              <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                <FileText className="h-12 w-12 mb-4 opacity-50" />
                <p className="text-sm">No documents found</p>
              </div>
            )}
            {data.message && !data.document && !data.documents && !data.sandbox_id && (
              <div className="flex items-center gap-2 p-4 bg-emerald-50 dark:bg-emerald-900/20 rounded-lg mx-4">
                <CheckCircle className="h-5 w-5 text-emerald-500" />
                <span className="text-sm text-emerald-700 dark:text-emerald-300">
                  {data.message}
                </span>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
    {((project?.sandbox?.id || resolvedSandboxId) && selectedDocPath) && (
      <FileViewerModal
        open={fileViewerOpen}
        onOpenChange={setFileViewerOpen}
        sandboxId={project?.sandbox?.id || resolvedSandboxId}
        initialFilePath={selectedDocPath || undefined}
        project={project}
      />
    )}
    {editorFilePath && editorDocumentData && (
      <TipTapDocumentModal
        open={editorOpen}
        onOpenChange={setEditorOpen}
        filePath={editorFilePath}
        documentData={editorDocumentData}
        sandboxId={data?.sandbox_id || project?.id || ''}
        onSave={handleDocumentSave}
        onSubmit={onSubmit}
      />
    )}
    </>
  );
} 
