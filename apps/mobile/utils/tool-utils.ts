import { parseToolResult, ParsedToolResult } from './tool-result-parser';

/**
 * Normalize content to string for parsing
 */
function normalizeContentToString(content: any): string {
  if (typeof content === 'string') {
    return content;
  }
  if (typeof content === 'object' && content !== null) {
    try {
      return JSON.stringify(content);
    } catch {
      return String(content);
    }
  }
  return String(content || '');
}

/**
 * Extract tool data from content using the new parser with backwards compatibility
 */
export function extractToolData(content: any): {
  toolResult: ParsedToolResult | null;
  arguments: Record<string, any>;
  filePath: string | null;
  fileContent: string | null;
  command: string | null;
  url: string | null;
  query: string | null;
} {
  const toolResult = parseToolResult(content);
  
  if (toolResult) {
    const args = toolResult.arguments || {};
    return {
      toolResult,
      arguments: args,
      filePath: args.file_path || args.path || null,
      fileContent: args.file_contents || args.content || null,
      command: args.command || null,
      url: args.url || null,
      query: args.query || null,
    };
  }

  // Fallback to legacy parsing if new format not detected
  return {
    toolResult: null,
    arguments: {},
    filePath: null,
    fileContent: null,
    command: null,
    url: null,
    query: null,
  };
}

/**
 * Get standardized tool title
 */
export function getToolTitle(toolName: string): string {
  // Normalize tool name
  const normalizedName = toolName.toLowerCase();

  // Map of tool names to their display titles
  const toolTitles: Record<string, string> = {
    'execute-command': 'Execute Command',
    'check-command-output': 'Check Command Output',
    'str-replace': 'String Replace',
    'create-file': 'Create File',
    'full-file-rewrite': 'Rewrite File',
    'delete-file': 'Delete File',
    'read-file': 'Read File',
    'edit-file': 'Edit File',
    'web-search': 'Web Search',
    'image-search': 'Image Search',
    'people-search': 'People Search',
    'company-search': 'Company Search',
    'paper-search': 'Paper Search',
    'crawl-webpage': 'Web Crawl',
    'scrape-webpage': 'Web Scrape',
    'browser-navigate-to': 'Browser Navigate',
    'browser-act': 'Browser Action',
    'browser-extract-content': 'Browser Extract',
    'browser-screenshot': 'Browser Screenshot',
    'load-image': 'Load Image',
    'ask': 'Ask',
    'complete': 'Task Complete',
    'execute-data-provider-call': 'Data Provider Call',
    'get-data-provider-endpoints': 'Data Endpoints',
    'expose-port': 'Expose Port',
    'parse-document': 'Parse Document',
    'upload-file': 'Upload File',
    'generic-tool': 'Tool',
    'default': 'Tool',
  };

  // Return the mapped title or a formatted version of the name
  if (toolTitles[normalizedName]) {
    return toolTitles[normalizedName];
  }

  // Format any other tool name
  return toolName
    .split('-')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

/**
 * Format timestamp for display
 */
export function formatTimestamp(isoString?: string): string {
  if (!isoString) return '';
  try {
    const date = new Date(isoString);
    if (isNaN(date.getTime())) return 'Invalid date';
    
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    
    return date.toLocaleString();
  } catch (e) {
    return 'Invalid date';
  }
}

