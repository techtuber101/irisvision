import React, { useEffect, useRef, useState } from 'react';
import { CircleDashed } from 'lucide-react';
import { extractToolNameFromStream } from '@/components/thread/tool-views/xml-parser';
import { getToolIcon, getUserFriendlyToolName, extractPrimaryParam } from '@/components/thread/utils';
import { CodeBlockCode } from '@/components/ui/code-block';
import { getLanguageFromFileName } from '../tool-views/file-operation/_utils';

// Define tool categories for different streaming behaviors
const STREAMABLE_TOOLS = {
    // File operation tools - show full content streaming
    FILE_OPERATIONS: new Set([
        'Creating File',
        'Rewriting File',
        'AI File Edit',
        'Editing Text',
        'Editing File',
        'Deleting File',
    ]),
    
    // Command tools - show command output streaming
    COMMAND_TOOLS: new Set([
        'Executing Command',
        'Checking Command Output',
        'Terminating Command',
        'Listing Commands',
    ]),
    
    // Browser tools - show action details streaming
    BROWSER_TOOLS: new Set([
        'Navigating to Page',
        'Performing Action',
        'Extracting Content',
        'Taking Screenshot',
    ]),
    
    // Web tools - show search/crawl results streaming
    WEB_TOOLS: new Set([
        'Searching Web',
        'Crawling Website',
        'Scraping Website',
    ]),
    
    // Other tools that benefit from content streaming
    OTHER_STREAMABLE: new Set([
        'Calling data provider',
        'Getting endpoints',
        'Creating Tasks',
        'Updating Tasks',
        'Viewing Image',
        'Creating Presentation Outline',
        'Creating Presentation',
        'Exposing Port',
        'Getting Agent Config',
        'Searching MCP Servers',
        'Creating Credential Profile',
        'Connecting Credential Profile',
        'Checking Profile Connection',
        'Configuring Profile For Agent',
        'Getting Credential Profiles',
    ])
};

// Check if a tool should show streaming content
const isStreamableTool = (toolName: string) => {
    return Object.values(STREAMABLE_TOOLS).some(toolSet => toolSet.has(toolName));
};

interface ShowToolStreamProps {
    content: string;
    messageId?: string | null;
    onToolClick?: (messageId: string | null, toolName: string) => void;
    showExpanded?: boolean; // Whether to show expanded streaming view
    startTime?: number; // When the tool started running
}

export const ShowToolStream: React.FC<ShowToolStreamProps> = ({
    content,
    messageId,
    onToolClick,
    showExpanded = false,
    startTime
}) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const [shouldShowContent, setShouldShowContent] = useState(false);
    const [shouldAutoScroll, setShouldAutoScroll] = useState(true);
    // Use ref to store stable start time - only set once!
    const stableStartTimeRef = useRef<number | null>(null);

    // Set stable start time only once
    if (showExpanded && !stableStartTimeRef.current) {
        stableStartTimeRef.current = Date.now();
    }

    const rawToolName = extractToolNameFromStream(content);
    const toolName = getUserFriendlyToolName(rawToolName || '');
    const isEditFile = toolName === 'AI File Edit';
    const isCreateFile = toolName === 'Creating File';
    const isFullFileRewrite = toolName === 'Rewriting File';

    // Clean function call XML content but preserve other HTML/XML
    const cleanXMLContent = (rawContent: string): { html: string; plainText: string } => {
        if (!rawContent || typeof rawContent !== 'string') return { html: '', plainText: '' };
        
        // Remove only function call related XML tags: function_calls, invoke, parameter
        const cleaned = rawContent
            .replace(/<function_calls[^>]*>/gi, '')
            .replace(/<\/function_calls>/gi, '')
            .replace(/<invoke[^>]*>/gi, '')
            .replace(/<\/invoke>/gi, '');
        
        // Extract all parameter content with names
        const parameterMatches = cleaned.match(/<parameter\s+name=["'][^"']*["']>([\\s\\S]*?)(<\/parameter>|$)/gi);
        if (parameterMatches) {
            const paramEntries = parameterMatches.map(match => {
                const fullMatch = match.match(/<parameter\s+name=["']([^"']*)["']>([\\s\\S]*?)(<\/parameter>|$)/i);
                if (fullMatch) {
                    const paramName = fullMatch[1];
                    const paramValue = fullMatch[2].trim();
                    
                    if (paramValue) {
                        return {
                            name: paramName,
                            value: paramValue,
                            html: `<strong>${paramName}:</strong> ${paramValue}`,
                            plainText: `${paramName}: ${paramValue}`
                        };
                    }
                }
                return null;
            }).filter(entry => entry !== null);
            
            if (paramEntries.length > 0) {
                return {
                    html: paramEntries.map(entry => entry.html).join('\n\n'),
                    plainText: paramEntries.map(entry => entry.plainText).join('\n\n')
                };
            }
        }
        
        // Fallback: remove only parameter tags but preserve other HTML/XML
        const cleanText = cleaned.replace(/<\/?parameter[^>]*>/gi, '').trim();
        return { html: cleanText, plainText: cleanText };
    };

    // Extract streaming content with parameter names
    const streamingContent = React.useMemo(() => {
        if (!content) return { html: '', plainText: '' };
        
        // For file operations, prioritize showing just the content without param names for cleaner code display
        if (STREAMABLE_TOOLS.FILE_OPERATIONS.has(toolName || '')) {
            let paramName: string | null = null;
            if (isEditFile) paramName = 'code_edit';
            else if (isCreateFile || isFullFileRewrite) paramName = 'file_contents';

            if (paramName) {
                const newMatch = content.match(new RegExp(`<parameter\\s+name=["']${paramName}["']>([\\s\\S]*)`, 'i'));
                if (newMatch && newMatch[1]) {
                    const cleanContent = newMatch[1].replace(/<\/parameter>[\s\S]*$/, '');
                    return { html: cleanContent, plainText: cleanContent };
                }
                // Fallback for old formats
                if (isEditFile) {
                    const oldMatch = content.match(/<code_edit>([\s\S]*)/i);
                    if (oldMatch && oldMatch[1]) {
                        const cleanContent = oldMatch[1].replace(/<\/code_edit>[\s\S]*$/, '');
                        return { html: cleanContent, plainText: cleanContent };
                    }
                }
            }
        }
        
        // For other tools, show parameter names with values
        // Command tools - extract command parameter with name
        if (STREAMABLE_TOOLS.COMMAND_TOOLS.has(toolName || '')) {
            const commandMatch = content.match(/<parameter\s+name=["']command["']>([\\s\\S]*?)(<\/parameter>|$)/i);
            if (commandMatch && commandMatch[1]) {
                const value = commandMatch[1].trim();
                return { 
                    html: `<strong>command:</strong> ${value}`, 
                    plainText: `command: ${value}` 
                };
            }
        }
        
        // Browser tools - extract parameters with names
        if (STREAMABLE_TOOLS.BROWSER_TOOLS.has(toolName || '')) {
            const urlMatch = content.match(/<parameter\s+name=["']url["']>([\\s\\S]*?)(<\/parameter>|$)/i);
            const actionMatch = content.match(/<parameter\s+name=["']action["']>([\\s\\S]*?)(<\/parameter>|$)/i);
            const instructionMatch = content.match(/<parameter\s+name=["']instruction["']>([\\s\\S]*?)(<\/parameter>|$)/i);
            
            if (urlMatch && urlMatch[1]) {
                const value = urlMatch[1].trim();
                return { html: `<strong>url:</strong> ${value}`, plainText: `url: ${value}` };
            }
            if (actionMatch && actionMatch[1]) {
                const value = actionMatch[1].trim();
                return { html: `<strong>action:</strong> ${value}`, plainText: `action: ${value}` };
            }
            if (instructionMatch && instructionMatch[1]) {
                const value = instructionMatch[1].trim();
                return { html: `<strong>instruction:</strong> ${value}`, plainText: `instruction: ${value}` };
            }
        }
        
        // Web tools - extract parameters with names
        if (STREAMABLE_TOOLS.WEB_TOOLS.has(toolName || '')) {
            const queryMatch = content.match(/<parameter\s+name=["']query["']>([\\s\\S]*?)(<\/parameter>|$)/i);
            const urlMatch = content.match(/<parameter\s+name=["']url["']>([\\s\\S]*?)(<\/parameter>|$)/i);
            
            if (queryMatch && queryMatch[1]) {
                const value = queryMatch[1].trim();
                return { html: `<strong>query:</strong> ${value}`, plainText: `query: ${value}` };
            }
            if (urlMatch && urlMatch[1]) {
                const value = urlMatch[1].trim();
                return { html: `<strong>url:</strong> ${value}`, plainText: `url: ${value}` };
            }
        }
        
        // For other streamable tools, try to extract with parameter names
        if (STREAMABLE_TOOLS.OTHER_STREAMABLE.has(toolName || '')) {
            const commonParams = ['text', 'content', 'data', 'config', 'description', 'prompt'];
            for (const param of commonParams) {
                const match = content.match(new RegExp(`<parameter\\s+name=["']${param}["']>([\\s\\S]*?)(<\\/parameter>|$)`, 'i'));
                if (match && match[1]) {
                    const value = match[1].trim();
                    return { html: `<strong>${param}:</strong> ${value}`, plainText: `${param}: ${value}` };
                }
            }
        }
        
        // Fallback: clean all XML and return with parameter names
        return cleanXMLContent(content);
    }, [content, toolName, isEditFile, isCreateFile, isFullFileRewrite]);

    // Show streaming content for all streamable tools with delayed transitions
    useEffect(() => {
        if (showExpanded && isStreamableTool(toolName || '')) {
            // Small delay to allow for smooth opening
            const timer = setTimeout(() => setShouldShowContent(true), 50);
            return () => clearTimeout(timer);
        } else {
            // Immediate close but with smooth animation
            setShouldShowContent(false);
        }
    }, [showExpanded, toolName]);

    useEffect(() => {
        if (containerRef.current && shouldShowContent && shouldAutoScroll) {
            containerRef.current.scrollTop = containerRef.current.scrollHeight;
        }
    }, [content, shouldShowContent, shouldAutoScroll]);

    // Handle scroll events to disable auto-scroll when user scrolls up
    useEffect(() => {
        const container = containerRef.current;
        if (!container) return;

        const handleScroll = () => {
            const { scrollTop, scrollHeight, clientHeight } = container;
            const isAtBottom = scrollTop + clientHeight >= scrollHeight - 5;
            setShouldAutoScroll(isAtBottom);
        };

        container.addEventListener('scroll', handleScroll);
        return () => container.removeEventListener('scroll', handleScroll);
    }, [shouldShowContent]);

    if (!toolName) {
        return null;
    }

    // Check if this is a streamable tool
    const isToolStreamable = isStreamableTool(toolName);

    const IconComponent = getToolIcon(rawToolName || '');
    const displayName = toolName;
    const paramDisplay = extractPrimaryParam(rawToolName || '', content);

    // Always show tool button, conditionally show content below for streamable tools
    if (showExpanded && isToolStreamable) {
        return (
            <div className="my-1">
                {/* Always render the container for smooth transitions */}
                <div className={`border border-white/10 rounded-2xl overflow-hidden transition-all duration-500 ease-in-out transform-gpu ${
                    shouldShowContent ? 'bg-[rgba(10,14,22,0.55)] backdrop-blur-2xl shadow-[0_8px_32px_rgba(0,0,0,0.3),inset_0_1px_0_rgba(255,255,255,0.1)]' : 'bg-[rgba(10,14,22,0.55)] backdrop-blur-2xl scale-95 opacity-80'
                } relative`}>
                    {/* Gradient rim */}
                    <div aria-hidden="true" className="pointer-events-none absolute inset-0 rounded-2xl" style={{
                        background: 'linear-gradient(180deg, rgba(173,216,255,0.18), rgba(255,255,255,0.04) 30%, rgba(150,160,255,0.14) 85%, rgba(255,255,255,0.06))',
                        WebkitMask: 'linear-gradient(#000,#000) content-box, linear-gradient(#000,#000)',
                        WebkitMaskComposite: 'xor',
                        maskComposite: 'exclude',
                        padding: '1px',
                        borderRadius: '16px'
                    }}></div>
                    
                    {/* Specular streak */}
                    <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-0 h-12" style={{
                        background: 'linear-gradient(180deg, rgba(255,255,255,0.22), rgba(255,255,255,0.06) 45%, rgba(255,255,255,0) 100%)',
                        filter: 'blur(4px)',
                        mixBlendMode: 'screen'
                    }}></div>
                    
                    {/* Fine noise */}
                    <div aria-hidden="true" className="pointer-events-none absolute inset-0 opacity-20" style={{
                        backgroundImage: `url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='60' height='60'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.8' numOctaves='4'/><feColorMatrix type='saturate' values='0'/><feComponentTransfer><feFuncA type='table' tableValues='0 0.03'/></feComponentTransfer></filter><rect width='100%' height='100%' filter='url(%23n)' /></svg>")`,
                        backgroundSize: '100px 100px',
                        mixBlendMode: 'overlay'
                    }}></div>
                    {/* Tool name header */}
                    <button
                        onClick={() => onToolClick?.(messageId, toolName)}
                        className={`w-full flex items-center gap-1.5 py-1 px-2 text-xs text-white/90 hover:bg-white/10 transition-all duration-400 ease-in-out cursor-pointer relative z-10 ${
                            shouldShowContent ? 'bg-white/5' : 'bg-white/5 rounded-2xl'
                        }`}
                    >
                        <div className='border border-white/20 bg-white/10 backdrop-blur-sm flex items-center justify-center p-1 rounded-sm'>
                            <CircleDashed className="h-3.5 w-3.5 text-white/90 flex-shrink-0 animate-spin animation-duration-2000" />
                        </div>
                        <span className="font-mono text-white/90" style={{ fontSize: '12px' }}>{displayName}</span>
                        {paramDisplay && <span className="ml-1 text-white/70 truncate max-w-[200px]" title={paramDisplay}>{paramDisplay}</span>}
                    </button>

                    {/* Streaming content below - smooth height transition */}
                    <div className={`transition-all duration-500 ease-in-out overflow-hidden transform-gpu ${
                        shouldShowContent ? 'max-h-[350px] border-t border-white/10 opacity-100' : 'max-h-0 border-t-0 opacity-0 scale-y-95'
                    }`}>
                        <div className="relative">
                            <div
                                ref={containerRef}
                                className={`max-h-[300px] overflow-y-auto scrollbar-none text-xs text-white/90 transition-all duration-400 ease-in-out transform-gpu relative z-10 ${
                                    STREAMABLE_TOOLS.FILE_OPERATIONS.has(toolName || '') || STREAMABLE_TOOLS.COMMAND_TOOLS.has(toolName || '') 
                                        ? 'font-mono whitespace-pre-wrap' 
                                        : 'whitespace-pre-wrap'
                                } ${shouldShowContent ? 'opacity-100 translate-y-0 p-3' : 'opacity-0 translate-y-3 scale-95 p-0'}`}
                                style={{
                                    maskImage: shouldShowContent ? 'linear-gradient(to bottom, transparent 0%, black 8%, black 92%, transparent 100%)' : 'none',
                                    WebkitMaskImage: shouldShowContent ? 'linear-gradient(to bottom, transparent 0%, black 8%, black 92%, transparent 100%)' : 'none'
                                }}
                            >
                                {(() => {
                                    // Get the content to display
                                    const contentToDisplay = typeof streamingContent === 'string' ? streamingContent : streamingContent.plainText;
                                    const htmlContent = typeof streamingContent === 'string' ? streamingContent : streamingContent.html;
                                    
                                    // Format content based on tool type with prefixes
                                    if (STREAMABLE_TOOLS.COMMAND_TOOLS.has(toolName || '')) {
                                        const prefix = '$ ';
                                        // For commands, use plain text with prefix
                                        return prefix + contentToDisplay;
                                    }
                                    if (STREAMABLE_TOOLS.BROWSER_TOOLS.has(toolName || '')) {
                                        const prefix = '🌐 ';
                                        // For browser tools, render HTML if available
                                        if (htmlContent !== contentToDisplay) {
                                            return (
                                                <span>
                                                    {prefix}
                                                    <span dangerouslySetInnerHTML={{ __html: htmlContent }} />
                                                </span>
                                            );
                                        }
                                        return prefix + contentToDisplay;
                                    }
                                    if (STREAMABLE_TOOLS.WEB_TOOLS.has(toolName || '')) {
                                        const prefix = '🔍 ';
                                        // For web tools, render HTML if available
                                        if (htmlContent !== contentToDisplay) {
                                            return (
                                                <span>
                                                    {prefix}
                                                    <span dangerouslySetInnerHTML={{ __html: htmlContent }} />
                                                </span>
                                            );
                                        }
                                        return prefix + contentToDisplay;
                                    }
                                    if (STREAMABLE_TOOLS.OTHER_STREAMABLE.has(toolName || '')) {
                                        // For other tools, render HTML if available
                                        if (htmlContent !== contentToDisplay) {
                                            return <span dangerouslySetInnerHTML={{ __html: htmlContent }} />;
                                        }
                                        return contentToDisplay;
                                    }
                                    // For file operations, just return the content (no param names for cleaner code display)
                                    return contentToDisplay;
                                })()}
                            </div>
                            {/* Top gradient */}
                            <div className={`absolute top-0 left-0 right-0 h-8 pointer-events-none transition-all duration-400 ease-in-out ${
                                shouldShowContent
                                    ? 'opacity-100 bg-gradient-to-b from-[rgba(10,14,22,0.55)] via-[rgba(10,14,22,0.3)] to-transparent'
                                    : 'opacity-0 bg-gradient-to-b from-[rgba(10,14,22,0.55)] via-[rgba(10,14,22,0.3)] to-transparent'
                            }`} />
                            {/* Bottom gradient */}
                            <div className={`absolute bottom-0 left-0 right-0 h-8 pointer-events-none transition-all duration-400 ease-in-out ${
                                shouldShowContent
                                    ? 'opacity-100 bg-gradient-to-t from-[rgba(10,14,22,0.55)] via-[rgba(10,14,22,0.3)] to-transparent'
                                    : 'opacity-0 bg-gradient-to-t from-[rgba(10,14,22,0.55)] via-[rgba(10,14,22,0.3)] to-transparent'
                            }`} />
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    // Show normal tool button (non-streamable tools or non-expanded case)
    return (
        <div className="my-1">
            <button
                onClick={() => onToolClick?.(messageId, toolName)}
                className="inline-flex items-center gap-1.5 py-1 px-1 pr-1.5 text-xs text-white/90 bg-[rgba(10,14,22,0.55)] backdrop-blur-2xl border border-white/10 shadow-[0_8px_32px_rgba(0,0,0,0.3),inset_0_1px_0_rgba(255,255,255,0.1)] rounded-lg transition-all duration-200 hover:border-white/20 hover:bg-[rgba(10,14,22,0.65)] hover:shadow-[0_12px_40px_rgba(0,0,0,0.4),inset_0_1px_0_rgba(255,255,255,0.15)] cursor-pointer relative overflow-hidden"
            >
                {/* Gradient rim */}
                <div aria-hidden="true" className="pointer-events-none absolute inset-0 rounded-lg" style={{
                    background: 'linear-gradient(180deg, rgba(173,216,255,0.18), rgba(255,255,255,0.04) 30%, rgba(150,160,255,0.14) 85%, rgba(255,255,255,0.06))',
                    WebkitMask: 'linear-gradient(#000,#000) content-box, linear-gradient(#000,#000)',
                    WebkitMaskComposite: 'xor',
                    maskComposite: 'exclude',
                    padding: '1px',
                    borderRadius: '8px'
                }}></div>
                
                {/* Specular streak */}
                <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-0 h-12" style={{
                    background: 'linear-gradient(180deg, rgba(255,255,255,0.22), rgba(255,255,255,0.06) 45%, rgba(255,255,255,0) 100%)',
                    filter: 'blur(4px)',
                    mixBlendMode: 'screen'
                }}></div>
                
                {/* Fine noise */}
                <div aria-hidden="true" className="pointer-events-none absolute inset-0 opacity-20" style={{
                    backgroundImage: `url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='60' height='60'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.8' numOctaves='4'/><feColorMatrix type='saturate' values='0'/><feComponentTransfer><feFuncA type='table' tableValues='0 0.03'/></feComponentTransfer></filter><rect width='100%' height='100%' filter='url(%23n)' /></svg>")`,
                    backgroundSize: '100px 100px',
                    mixBlendMode: 'overlay'
                }}></div>
                
                <div className='border border-white/20 bg-white/10 backdrop-blur-sm flex items-center justify-center p-0.5 rounded-sm relative z-10'>
                    <CircleDashed className="h-3.5 w-3.5 text-white/90 flex-shrink-0 animate-spin animation-duration-2000" />
                </div>
                <span className="font-mono text-white/90 relative z-10" style={{ fontSize: '12px' }}>{displayName}</span>
                {paramDisplay && <span className="ml-1 text-white/70 truncate max-w-[200px] relative z-10" title={paramDisplay}>{paramDisplay}</span>}
            </button>
        </div>
    );
}; 