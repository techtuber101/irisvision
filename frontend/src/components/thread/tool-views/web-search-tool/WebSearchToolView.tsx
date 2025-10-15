import React, { useState } from 'react';
import {
  Search,
  CheckCircle,
  AlertTriangle,
  ExternalLink,
  Image as ImageIcon,
  Globe,
  FileText,
  Clock,
  BookOpen,
  CalendarDays,
  Sparkles,
} from 'lucide-react';
import { ToolViewProps } from '../types';
import { cleanUrl, formatTimestamp, getToolTitle } from '../utils';
import { truncateString } from '@/lib/utils';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from "@/components/ui/scroll-area";
import { LoadingState } from '../shared/LoadingState';
import { extractWebSearchData } from './_utils';

export function WebSearchToolView({
  name = 'web-search',
  assistantContent,
  toolContent,
  assistantTimestamp,
  toolTimestamp,
  isSuccess = true,
  isStreaming = false,
  onSubmit,
  isAgentRunning = false,
  selectedModel,
  getActualModelId,
  selectedAgentId,
  chatMode = 'execute',
  onPopulateChatInput,
}: ToolViewProps) {
  const [expandedResults, setExpandedResults] = useState<Record<number, boolean>>({});

  const {
    query,
    searchResults,
    answer,
    images,
    actualIsSuccess,
    actualToolTimestamp,
    actualAssistantTimestamp
  } = extractWebSearchData(
    assistantContent,
    toolContent,
    isSuccess,
    toolTimestamp,
    assistantTimestamp
  );

  const toolTitle = getToolTitle(name);

  const getFavicon = (url: string) => {
    try {
      const domain = new URL(url).hostname;
      return `https://www.google.com/s2/favicons?domain=${domain}&sz=128`;
    } catch (e) {
      return null;
    }
  };

  const getResultType = (result: any) => {
    const { url, title } = result;

    if (url.includes('news') || url.includes('article') || title.includes('News')) {
      return { icon: FileText, label: 'Article' };
    } else if (url.includes('wiki')) {
      return { icon: BookOpen, label: 'Wiki' };
    } else if (url.includes('blog')) {
      return { icon: CalendarDays, label: 'Blog' };
    } else {
      return { icon: Globe, label: 'Website' };
    }
  };

  return (
    <Card className="gap-0 flex border shadow-none border-b-0 border-x-0 p-0 rounded-none flex-col h-full overflow-hidden bg-transparent relative">
      <CardHeader className="h-14 bg-transparent p-2 px-4 space-y-2 relative z-10 border-t-0">
        <div className="flex flex-row items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="relative p-2 rounded-xl bg-blue-500/10 border border-blue-500/20">
              {/* Gradient rim */}
              <div aria-hidden="true" className="pointer-events-none absolute inset-0 rounded-xl" style={{
                background: 'linear-gradient(180deg, rgba(59,130,246,0.15), rgba(59,130,246,0.05) 30%, rgba(59,130,246,0.10) 85%, rgba(59,130,246,0.08))',
                WebkitMask: 'linear-gradient(#000,#000) content-box, linear-gradient(#000,#000)',
                WebkitMaskComposite: 'xor',
                maskComposite: 'exclude',
                padding: '1px',
                borderRadius: '12px'
              }} />
              {/* Specular streak */}
              <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-0 h-6" style={{
                background: 'linear-gradient(180deg, rgba(59,130,246,0.25), rgba(59,130,246,0.08) 45%, rgba(59,130,246,0) 100%)',
                filter: 'blur(3px)',
                mixBlendMode: 'screen'
              }} />
              {/* Fine noise */}
              <div aria-hidden="true" className="pointer-events-none absolute inset-0 opacity-20" style={{
                backgroundImage: `url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='60' height='60'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.8' numOctaves='4'/><feColorMatrix type='saturate' values='0'/><feComponentTransfer><feFuncA type='table' tableValues='0 0.03'/></feComponentTransfer></filter><rect width='100%' height='100%' filter='url(%23n)' /></svg>")`,
                backgroundSize: '100px 100px',
                mixBlendMode: 'overlay'
              }} />
              <Search className="w-5 h-5 text-blue-400 relative z-10" />
            </div>
            <div>
              <CardTitle className="text-base font-medium text-white/90">
                {toolTitle}
              </CardTitle>
            </div>
          </div>

          {!isStreaming && (
            <Badge
              variant="secondary"
              className={
                actualIsSuccess
                  ? "bg-gradient-to-b from-emerald-200 to-emerald-100 text-emerald-700 dark:from-emerald-800/50 dark:to-emerald-900/60 dark:text-emerald-300"
                  : "bg-gradient-to-b from-rose-200 to-rose-100 text-rose-700 dark:from-rose-800/50 dark:to-rose-900/60 dark:text-rose-300"
              }
            >
              {actualIsSuccess ? (
                <CheckCircle className="h-3.5 w-3.5" />
              ) : (
                <AlertTriangle className="h-3.5 w-3.5" />
              )}
              {actualIsSuccess ? 'Search completed successfully' : 'Search failed'}
            </Badge>
          )}
        </div>
      </CardHeader>

      <CardContent className="p-0 h-full flex-1 overflow-hidden relative z-10">
        {isStreaming && searchResults.length === 0 && !answer ? (
          <LoadingState
            icon={Search}
            iconColor="text-blue-400"
            bgColor="bg-gradient-to-b from-blue-500/20 to-blue-600/10 border border-blue-500/20 backdrop-blur-sm"
            title="Searching the web"
            filePath={query}
            showProgress={true}
          />
        ) : searchResults.length > 0 || answer ? (
          <ScrollArea className="h-full w-full">
            <div className="p-4 py-0 my-4">
              {/* Dynamic Mixed Layout */}
              <div className="space-y-6">
                {(() => {
                  const limitedImages = images.slice(0, 20); // Allow more images
                  const maxResults = Math.min(searchResults.length, 10); // Limit results for better layout
                  
                  const layoutItems: Array<{ type: 'result', data: any, index: number } | { type: 'images', data: any[], startIndex: number }> = [];
                  
                  // Create pattern: result, then 2 images, then result, then 2 images, etc.
                  for (let i = 0; i < maxResults; i++) {
                    // Add search result
                    if (i < searchResults.length) {
                      layoutItems.push({ type: 'result', data: searchResults[i], index: i });
                    }
                    
                    // Add 2 images after each result
                    const imageStartIdx = i * 2;
                    const imageEndIdx = Math.min(imageStartIdx + 2, limitedImages.length);
                    const imagesForThisRow = limitedImages.slice(imageStartIdx, imageEndIdx);
                    
                    if (imagesForThisRow.length > 0) {
                      layoutItems.push({ type: 'images', data: imagesForThisRow, startIndex: imageStartIdx });
                    }
                  }
                  
                  return layoutItems.map((item, globalIdx) => {
                    if (item.type === 'result') {
                      const result = item.data;
                      const { icon: ResultTypeIcon, label: resultTypeLabel } = getResultType(result);
                      const isExpanded = expandedResults[item.index] || false;
                      const favicon = getFavicon(result.url);

                      return (
                        <div
                          key={`result-${item.index}`}
                          className="relative bg-white/5 border border-white/10 rounded-2xl backdrop-blur-sm hover:bg-white/10 transition-colors overflow-hidden"
                        >
                          {/* Gradient rim */}
                          <div aria-hidden="true" className="pointer-events-none absolute inset-0 rounded-2xl" style={{
                            background: 'linear-gradient(180deg, rgba(173,216,255,0.08), rgba(255,255,255,0.02) 30%, rgba(150,160,255,0.06) 85%, rgba(255,255,255,0.03))',
                            WebkitMask: 'linear-gradient(#000,#000) content-box, linear-gradient(#000,#000)',
                            WebkitMaskComposite: 'xor',
                            maskComposite: 'exclude',
                            padding: '1px',
                            borderRadius: '16px'
                          }} />
                          
                          {/* Specular streak */}
                          <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-0 h-8" style={{
                            background: 'linear-gradient(180deg, rgba(255,255,255,0.12), rgba(255,255,255,0.03) 45%, rgba(255,255,255,0) 100%)',
                            filter: 'blur(3px)',
                            mixBlendMode: 'screen'
                          }} />
                          
                          {/* Fine noise */}
                          <div aria-hidden="true" className="pointer-events-none absolute inset-0 opacity-10" style={{
                            backgroundImage: `url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='60' height='60'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.8' numOctaves='4'/><feColorMatrix type='saturate' values='0'/><feComponentTransfer><feFuncA type='table' tableValues='0 0.03'/></feComponentTransfer></filter><rect width='100%' height='100%' filter='url(%23n)' /></svg>")`,
                            backgroundSize: '100px 100px',
                            mixBlendMode: 'overlay'
                          }} />
                          
                          <div className="p-4 relative z-10">
                            <div className="flex items-start gap-3">
                              {favicon && (
                                <img
                                  src={favicon}
                                  alt=""
                                  className="w-5 h-5 mt-1 rounded"
                                  onError={(e) => {
                                    (e.target as HTMLImageElement).style.display = 'none';
                                  }}
                                />
                              )}
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 mb-1">
                                  <Badge variant="outline" className="text-xs px-2 py-0 h-5 font-normal bg-white/10 border-white/20 text-white/80">
                                    <ResultTypeIcon className="h-3 w-3 mr-1 opacity-70" />
                                    {resultTypeLabel}
                                  </Badge>
                                </div>
                                <a
                                  href={result.url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-md font-medium text-blue-400 hover:text-blue-300 hover:underline line-clamp-1 mb-1"
                                >
                                  {truncateString(cleanUrl(result.title), 50)}
                                </a>
                                <div className="text-xs text-white/60 mb-2 flex items-center">
                                  <Globe className="h-3 w-3 mr-1.5 flex-shrink-0 opacity-70" />
                                  {truncateString(cleanUrl(result.url), 70)}
                                </div>
                              </div>
                              
                              {/* Circular Action Buttons */}
                              <div className="flex flex-col gap-2 ml-3">
                                {/* Ask Iris Button */}
                                <div className="group relative">
                                  <button
                                    className="w-8 h-8 rounded-full bg-white/10 border border-white/20 text-white/80 hover:bg-white/20 transition-all duration-200 relative overflow-hidden flex items-center justify-center"
                                    onClick={() => {
                                      if (onSubmit) {
                                        const message = `Iris, analyze this web search you just did and tell me what you found in it and it's significance - ${result.url}`;
                                        
                                        // If agent is running, populate the input but don't send
                                        if (isAgentRunning) {
                                          if (onPopulateChatInput) {
                                            onPopulateChatInput(message);
                                          }
                                        } else {
                                          // Agent is not running, send directly with proper model selection
                                          const baseModelName = getActualModelId ? getActualModelId(selectedModel || '') : selectedModel;
                                          onSubmit(message, {
                                            agent_id: selectedAgentId,
                                            model_name: baseModelName,
                                            chat_mode: chatMode,
                                          });
                                        }
                                      }
                                    }}
                                  >
                                    {/* Gradient rim */}
                                    <div aria-hidden="true" className="pointer-events-none absolute inset-0 rounded-full" style={{
                                      background: 'linear-gradient(180deg, rgba(173,216,255,0.08), rgba(255,255,255,0.02) 30%, rgba(150,160,255,0.06) 85%, rgba(255,255,255,0.03))',
                                      WebkitMask: 'linear-gradient(#000,#000) content-box, linear-gradient(#000,#000)',
                                      WebkitMaskComposite: 'xor',
                                      maskComposite: 'exclude',
                                      padding: '1px',
                                      borderRadius: '50%'
                                    }} />
                                    
                                    {/* Specular streak */}
                                    <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-0 h-4" style={{
                                      background: 'linear-gradient(180deg, rgba(255,255,255,0.12), rgba(255,255,255,0.03) 45%, rgba(255,255,255,0) 100%)',
                                      filter: 'blur(2px)',
                                      mixBlendMode: 'screen'
                                    }} />
                                    
                                    {/* Fine noise */}
                                    <div aria-hidden="true" className="pointer-events-none absolute inset-0 opacity-10" style={{
                                      backgroundImage: `url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='60' height='60'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.8' numOctaves='4'/><feColorMatrix type='saturate' values='0'/><feComponentTransfer><feFuncA type='table' tableValues='0 0.03'/></feComponentTransfer></filter><rect width='100%' height='100%' filter='url(%23n)' /></svg>")`,
                                      backgroundSize: '100px 100px',
                                      mixBlendMode: 'overlay'
                                    }} />
                                    
                                    <Sparkles className="h-4 w-4 relative z-10" />
                                  </button>
                                  
                                  {/* Hover Tooltip */}
                                  <div className="absolute right-full mr-2 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none z-50">
                                    <div className="bg-black/80 text-white text-xs px-2 py-1 rounded whitespace-nowrap">
                                      Ask Iris
                                    </div>
                                  </div>
                                </div>
                                
                                {/* Visit Site Button */}
                                <div className="group relative">
                                  <a
                                    href={result.url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="w-8 h-8 rounded-full bg-white/10 border border-white/20 text-white/80 hover:bg-white/20 transition-all duration-200 relative overflow-hidden flex items-center justify-center block"
                                  >
                                    {/* Gradient rim */}
                                    <div aria-hidden="true" className="pointer-events-none absolute inset-0 rounded-full" style={{
                                      background: 'linear-gradient(180deg, rgba(173,216,255,0.08), rgba(255,255,255,0.02) 30%, rgba(150,160,255,0.06) 85%, rgba(255,255,255,0.03))',
                                      WebkitMask: 'linear-gradient(#000,#000) content-box, linear-gradient(#000,#000)',
                                      WebkitMaskComposite: 'xor',
                                      maskComposite: 'exclude',
                                      padding: '1px',
                                      borderRadius: '50%'
                                    }} />
                                    
                                    {/* Specular streak */}
                                    <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-0 h-4" style={{
                                      background: 'linear-gradient(180deg, rgba(255,255,255,0.12), rgba(255,255,255,0.03) 45%, rgba(255,255,255,0) 100%)',
                                      filter: 'blur(2px)',
                                      mixBlendMode: 'screen'
                                    }} />
                                    
                                    {/* Fine noise */}
                                    <div aria-hidden="true" className="pointer-events-none absolute inset-0 opacity-10" style={{
                                      backgroundImage: `url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='60' height='60'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.8' numOctaves='4'/><feColorMatrix type='saturate' values='0'/><feComponentTransfer><feFuncA type='table' tableValues='0 0.03'/></feComponentTransfer></filter><rect width='100%' height='100%' filter='url(%23n)' /></svg>")`,
                                      backgroundSize: '100px 100px',
                                      mixBlendMode: 'overlay'
                                    }} />
                                    
                                    <ExternalLink className="h-4 w-4 relative z-10" />
                                  </a>
                                  
                                  {/* Hover Tooltip */}
                                  <div className="absolute right-full mr-2 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none z-50">
                                    <div className="bg-black/80 text-white text-xs px-2 py-1 rounded whitespace-nowrap">
                                      Visit Site
                                    </div>
                                  </div>
                                </div>
                              </div>
                            </div>
                          </div>

                          {isExpanded && (
                            <div className="relative bg-white/5 px-4 border-t border-white/10 p-3 flex justify-between items-center overflow-hidden">
                              {/* Gradient rim */}
                              <div aria-hidden="true" className="pointer-events-none absolute inset-0" style={{
                                background: 'linear-gradient(180deg, rgba(173,216,255,0.08), rgba(255,255,255,0.02) 30%, rgba(150,160,255,0.06) 85%, rgba(255,255,255,0.03))',
                                WebkitMask: 'linear-gradient(#000,#000) content-box, linear-gradient(#000,#000)',
                                WebkitMaskComposite: 'xor',
                                maskComposite: 'exclude',
                                padding: '1px',
                                borderRadius: '0 0 16px 16px'
                              }} />
                              
                              {/* Specular streak */}
                              <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-0 h-6" style={{
                                background: 'linear-gradient(180deg, rgba(255,255,255,0.12), rgba(255,255,255,0.03) 45%, rgba(255,255,255,0) 100%)',
                                filter: 'blur(2px)',
                                mixBlendMode: 'screen'
                              }} />
                              
                              {/* Fine noise */}
                              <div aria-hidden="true" className="pointer-events-none absolute inset-0 opacity-10" style={{
                                backgroundImage: `url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='60' height='60'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.8' numOctaves='4'/><feColorMatrix type='saturate' values='0'/><feComponentTransfer><feFuncA type='table' tableValues='0 0.03'/></feComponentTransfer></filter><rect width='100%' height='100%' filter='url(%23n)' /></svg>")`,
                                backgroundSize: '100px 100px',
                                mixBlendMode: 'overlay'
                              }} />
                              
                              <div className="text-xs text-white/60 relative z-10">
                                Source: {cleanUrl(result.url)}
                              </div>
                              <Button
                                variant="outline"
                                size="sm"
                                className="h-7 text-xs bg-white/10 border-white/20 text-white/80 hover:bg-white/20 relative z-10"
                                asChild
                              >
                                <a href={result.url} target="_blank" rel="noopener noreferrer">
                                  <ExternalLink className="h-3 w-3" />
                                  Visit Site
                                </a>
                              </Button>
                            </div>
                          )}
                        </div>
                      );
                    } else {
                      // Images row - render 2 images side by side
                      return (
                        <div key={`images-${item.startIndex}`} className="grid grid-cols-2 gap-3">
                          {item.data.map((image, idx) => {
                            const imageUrl = typeof image === 'string' ? image : (image as any).imageUrl;
                            
                            return (
                              <a
                                key={`image-${item.startIndex + idx}`}
                                href={imageUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="group relative overflow-hidden rounded-2xl border border-white/10 bg-white/5 backdrop-blur-sm hover:bg-white/10 hover:border-white/20 transition-all duration-200 h-32"
                              >
                                {/* Gradient rim */}
                                <div aria-hidden="true" className="pointer-events-none absolute inset-0 rounded-2xl" style={{
                                  background: 'linear-gradient(180deg, rgba(173,216,255,0.08), rgba(255,255,255,0.02) 30%, rgba(150,160,255,0.06) 85%, rgba(255,255,255,0.03))',
                                  WebkitMask: 'linear-gradient(#000,#000) content-box, linear-gradient(#000,#000)',
                                  WebkitMaskComposite: 'xor',
                                  maskComposite: 'exclude',
                                  padding: '1px',
                                  borderRadius: '16px'
                                }} />
                                
                                {/* Specular streak */}
                                <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-0 h-8" style={{
                                  background: 'linear-gradient(180deg, rgba(255,255,255,0.12), rgba(255,255,255,0.03) 45%, rgba(255,255,255,0) 100%)',
                                  filter: 'blur(3px)',
                                  mixBlendMode: 'screen'
                                }} />
                                
                                {/* Fine noise */}
                                <div aria-hidden="true" className="pointer-events-none absolute inset-0 opacity-10" style={{
                                  backgroundImage: `url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='60' height='60'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.8' numOctaves='4'/><feColorMatrix type='saturate' values='0'/><feComponentTransfer><feFuncA type='table' tableValues='0 0.03'/></feComponentTransfer></filter><rect width='100%' height='100%' filter='url(%23n)' /></svg>")`,
                                  backgroundSize: '100px 100px',
                                  mixBlendMode: 'overlay'
                                }} />
                                
                                <img
                                  src={imageUrl}
                                  alt={`Search result ${item.startIndex + idx + 1}`}
                                  className="object-cover w-full h-full group-hover:opacity-90 transition-opacity relative z-10"
                                  onError={(e) => {
                                    const target = e.target as HTMLImageElement;
                                    target.src = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='24' height='24' viewBox='0 0 24 24' fill='none' stroke='%23888' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Crect x='3' y='3' width='18' height='18' rx='2' ry='2'%3E%3C/rect%3E%3Ccircle cx='8.5' cy='8.5' r='1.5'%3E%3C/circle%3E%3Cpolyline points='21 15 16 10 5 21'%3E%3C/polyline%3E%3C/svg%3E";
                                    target.classList.add("p-4");
                                  }}
                                />
                                <div className="absolute top-0 right-0 p-1 z-30">
                                  <Badge variant="secondary" className="bg-black/60 hover:bg-black/70 text-white border-none shadow-md">
                                    <ExternalLink className="h-3 w-3" />
                                  </Badge>
                                </div>
                              </a>
                            );
                          })}
                        </div>
                      );
                    }
                  });
                })()}
              </div>
            </div>
          </ScrollArea>
        ) : (
          <div className="flex flex-col items-center justify-center h-full py-12 px-6 bg-gradient-to-b from-transparent to-white/5">
            <div className="w-20 h-20 rounded-full flex items-center justify-center mb-6 bg-gradient-to-b from-white/10 to-white/5 border border-white/10 backdrop-blur-sm">
              <Search className="h-10 w-10 text-white/40" />
            </div>
            <h3 className="text-xl font-semibold mb-2 text-white/90">
              No Results Found
            </h3>
            <div className="bg-white/10 border border-white/20 rounded-lg p-4 w-full max-w-md text-center mb-4 backdrop-blur-sm">
              <code className="text-sm font-mono text-white/70 break-all">
                {query || 'Unknown query'}
              </code>
            </div>
            <p className="text-sm text-white/60">
              Try refining your search query for better results
            </p>
          </div>
        )}
      </CardContent>

      <div className="px-4 py-2 h-10 bg-white/5 backdrop-blur-sm border-t border-white/10 flex justify-between items-center gap-4 relative z-10">
        <div className="h-full flex items-center gap-2 text-sm text-white/60">
          {!isStreaming && (
            <>
              {name === 'image-search' && images.length > 0 && (
                <Badge variant="outline" className="h-6 py-0.5 bg-white/10 border-white/20 text-white/80">
                  <ImageIcon className="h-3 w-3" />
                  {images.length} images
                </Badge>
              )}
              {name !== 'image-search' && searchResults.length > 0 && (
                <Badge variant="outline" className="h-6 py-0.5 bg-white/10 border-white/20 text-white/80">
                  <Globe className="h-3 w-3" />
                  {searchResults.length} results
                </Badge>
              )}
            </>
          )}
        </div>

        <div className="text-xs text-white/60">
          {actualToolTimestamp && !isStreaming
            ? formatTimestamp(actualToolTimestamp)
            : actualAssistantTimestamp
              ? formatTimestamp(actualAssistantTimestamp)
              : ''}
        </div>
      </div>
    </Card>
  );
} 