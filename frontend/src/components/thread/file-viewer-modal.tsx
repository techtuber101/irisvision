'use client';

import { useState, useEffect, useRef, Fragment, useCallback, useMemo } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import {
  File,
  Folder,
  Upload,
  Download,
  ChevronRight,
  Home,
  ChevronLeft,
  Loader,
  AlertTriangle,
  FileText,
  ChevronDown,
  Archive,
  Copy,
  Check,
  Edit,
  FileText as MarkdownIcon,
  FileImage,
  Database,
  FileArchive,
} from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  FileRenderer,
} from '@/components/file-renderers';
import {
  listSandboxFiles,
  type FileInfo,
  Project,
} from '@/lib/api';
import { toast } from 'sonner';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/components/AuthProvider';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from '@/components/ui/dropdown-menu';
import {
  useDirectoryQuery,
  useFileContentQuery,
  FileCache
} from '@/hooks/react-query/files';
import JSZip from 'jszip';
import { normalizeFilenameToNFC } from '@/lib/utils/unicode';
import { TipTapDocumentModal } from './tiptap-document-modal';

// Define API_URL
const API_URL = process.env.NEXT_PUBLIC_BACKEND_URL || '';

interface FileViewerModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sandboxId: string;
  initialFilePath?: string | null;
  project?: Project;
  filePathList?: string[];
}

export function FileViewerModal({
  open,
  onOpenChange,
  sandboxId,
  initialFilePath,
  project,
  filePathList,
}: FileViewerModalProps) {
  // Safely handle initialFilePath to ensure it's a string or null
  const safeInitialFilePath = typeof initialFilePath === 'string' ? initialFilePath : null;

  // Auth for session token
  const { session } = useAuth();

  // File navigation state
  const [currentPath, setCurrentPath] = useState('/workspace');
  const [isInitialLoad, setIsInitialLoad] = useState(true);

  // Add navigation state for file list mode
  const [currentFileIndex, setCurrentFileIndex] = useState<number>(-1);
  const isFileListMode = Boolean(filePathList && filePathList.length > 0);


  // Use React Query for directory listing
  const {
    data: files = [],
    isLoading: isLoadingFiles,
    error: filesError,
    refetch: refetchFiles
  } = useDirectoryQuery(sandboxId, currentPath, {
    enabled: open && !!sandboxId,
    staleTime: 30 * 1000, // 30 seconds
  });

  // Add a navigation lock to prevent race conditions
  const currentNavigationRef = useRef<string | null>(null);

  // File content state
  const [selectedFilePath, setSelectedFilePath] = useState<string | null>(null);
  const [rawContent, setRawContent] = useState<string | Blob | null>(null);
  const [textContentForRenderer, setTextContentForRenderer] = useState<
    string | null
  >(null);
  const [blobUrlForRenderer, setBlobUrlForRenderer] = useState<string | null>(
    null,
  );
  const [contentError, setContentError] = useState<string | null>(null);

  // Use the React Query hook for the selected file instead of useCachedFile
  const {
    data: cachedFileContent,
    isLoading: isCachedFileLoading,
    error: cachedFileError,
  } = useFileContentQuery(
    sandboxId,
    selectedFilePath || undefined,
    {
      // Auto-detect content type consistently with other components
      enabled: !!selectedFilePath,
      staleTime: 5 * 60 * 1000, // 5 minutes
    }
  );

  // Utility state
  const [isUploading, setIsUploading] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // State to track if initial path has been processed
  const [initialPathProcessed, setInitialPathProcessed] = useState(false);

  // Project state
  const [projectWithSandbox, setProjectWithSandbox] = useState<
    Project | undefined
  >(project);

  // Add state for PDF export
  const [isExportingPdf, setIsExportingPdf] = useState(false);
  const markdownRef = useRef<HTMLDivElement>(null);

  // Add a ref to track active download URLs
  const activeDownloadUrls = useRef<Set<string>>(new Set());

  // Add state for download all functionality
  const [isDownloadingAll, setIsDownloadingAll] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState<{
    current: number;
    total: number;
    currentFile: string;
  } | null>(null);

  // Add state for copy functionality
  const [isCopyingPath, setIsCopyingPath] = useState(false);
  const [isCopyingContent, setIsCopyingContent] = useState(false);
  
  // Add state for TipTap document editor
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [editorDocumentData, setEditorDocumentData] = useState<any>(null);

  // Add state for file filtering
  const [activeFilter, setActiveFilter] = useState<string>('all');
  const [allWorkspaceFiles, setAllWorkspaceFiles] = useState<FileInfo[]>([]);

  // File filter definitions
  const fileFilters = [
    { key: 'all', label: 'All', icon: Folder },
    { key: 'markdown', label: 'Markdown', icon: MarkdownIcon, extensions: ['.md', '.txt'] },
    { key: 'docs', label: 'Docs', icon: FileText, extensions: ['.doc', '.docx'] },
    { key: 'pdf', label: 'PDF', icon: FileText, extensions: ['.pdf'] },
    { key: 'images', label: 'Images', icon: FileImage, extensions: ['.jpg', '.jpeg', '.png', '.gif', '.svg', '.webp', '.bmp', '.ico', '.tiff'] },
    { key: 'data', label: 'Data', icon: Database, extensions: ['.json', '.xml', '.csv', '.yaml', '.yml', '.toml', '.ini', '.conf', '.config'] },
    { key: 'archives', label: 'Archives', icon: FileArchive, extensions: ['.zip', '.rar', '.7z', '.tar', '.gz', '.bz2', '.xz'] },
  ];

  // Load all workspace files when modal opens
  useEffect(() => {
    if (!open || !sandboxId) return;

    const loadAllWorkspaceFiles = async () => {
      try {
        const { files: allFiles } = await discoverAllFiles('/workspace');
        setAllWorkspaceFiles(allFiles);
      } catch (error) {
        console.error('Failed to load all workspace files:', error);
        setAllWorkspaceFiles([]);
      }
    };

    loadAllWorkspaceFiles();
  }, [open, sandboxId]);

  // Filter files based on active filter - use all workspace files when filtering
  const filteredFiles = useMemo(() => {
    const filesToFilter = activeFilter === 'all' ? files : allWorkspaceFiles;
    
    if (activeFilter === 'all') return files;
    
    const filter = fileFilters.find(f => f.key === activeFilter);
    if (!filter || !filter.extensions) return filesToFilter;
    
    return filesToFilter.filter(file => {
      const extension = file.name.toLowerCase().substring(file.name.lastIndexOf('.'));
      return filter.extensions!.includes(extension);
    });
  }, [files, allWorkspaceFiles, activeFilter]);

  // Setup project with sandbox URL if not provided directly
  useEffect(() => {
    if (project) {
      setProjectWithSandbox(project);
    }
  }, [project, sandboxId]);

  // Function to ensure a path starts with /workspace - Defined early
  const normalizePath = useCallback((path: unknown): string => {
    // Explicitly check if the path is a non-empty string
    if (typeof path !== 'string' || !path) {
      return '/workspace';
    }
    // Now we know path is a string
    return path.startsWith('/workspace')
      ? path
      : `/workspace/${path.replace(/^\//, '')}`;
  }, []);

  // Recursive function to discover all files in the workspace
  const discoverAllFiles = useCallback(async (
    startPath: string = '/workspace'
  ): Promise<{ files: FileInfo[], totalSize: number }> => {
    const allFiles: FileInfo[] = [];
    let totalSize = 0;
    const visited = new Set<string>();

    const exploreDirectory = async (dirPath: string) => {
      if (visited.has(dirPath)) return;
      visited.add(dirPath);

      try {
        const files = await listSandboxFiles(sandboxId, dirPath);

        for (const file of files) {
          if (file.is_dir) {
            // Recursively explore subdirectories
            await exploreDirectory(file.path);
          } else {
            // Add file to collection
            allFiles.push(file);
            totalSize += file.size || 0;
          }
        }
      } catch (error) {
        toast.error(`Failed to read directory: ${dirPath}`);
      }
    };

    await exploreDirectory(startPath);

    return { files: allFiles, totalSize };
  }, [sandboxId]);

  // Function to download all files as a zip
  const handleDownloadAll = useCallback(async () => {
    if (!session?.access_token || isDownloadingAll) return;

    try {
      setIsDownloadingAll(true);
      setDownloadProgress({ current: 0, total: 0, currentFile: 'Discovering files...' });

      // Step 1: Discover all files
      const { files } = await discoverAllFiles();

      if (files.length === 0) {
        toast.error('No files found to download');
        return;
      }

      // Step 2: Create zip and load files
      const zip = new JSZip();
      setDownloadProgress({ current: 0, total: files.length, currentFile: 'Creating archive...' });

      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const relativePath = file.path.replace(/^\/workspace\//, ''); // Remove /workspace/ prefix

        setDownloadProgress({
          current: i + 1,
          total: files.length,
          currentFile: relativePath
        });

        try {
          // Determine content type for proper loading
          const contentType = FileCache.getContentTypeFromPath(file.path);

          // Check cache first
          const cacheKey = `${sandboxId}:${file.path}:${contentType}`;
          let content = FileCache.get(cacheKey);

          if (!content) {
            // Load from server if not cached
            const response = await fetch(
              `${process.env.NEXT_PUBLIC_BACKEND_URL}/sandboxes/${sandboxId}/files/content?path=${encodeURIComponent(file.path)}`,
              {
                headers: { 'Authorization': `Bearer ${session.access_token}` }
              }
            );

            if (!response.ok) {
              continue; // Skip this file and continue with others
            }

            if (contentType === 'blob') {
              content = await response.blob();
            } else if (contentType === 'json') {
              content = JSON.stringify(await response.json(), null, 2);
            } else {
              content = await response.text();
            }

            // Cache the content
            FileCache.set(cacheKey, content);
          }

          // Add to zip with proper structure
          if (content instanceof Blob) {
            zip.file(relativePath, content);
          } else if (typeof content === 'string') {
            // Handle blob URLs by fetching the actual content
            if (content.startsWith('blob:')) {
              try {
                const blobResponse = await fetch(content);
                const blobContent = await blobResponse.blob();
                zip.file(relativePath, blobContent);
              } catch (blobError) {
                // Fallback: try to fetch from server directly
                const fallbackResponse = await fetch(
                  `${process.env.NEXT_PUBLIC_BACKEND_URL}/sandboxes/${sandboxId}/files/content?path=${encodeURIComponent(file.path)}`,
                  { headers: { 'Authorization': `Bearer ${session.access_token}` } }
                );
                if (fallbackResponse.ok) {
                  const fallbackBlob = await fallbackResponse.blob();
                  zip.file(relativePath, fallbackBlob);
                }
              }
            } else {
              // Regular text content
              zip.file(relativePath, content);
            }
          } else {
            // Handle other content types (convert to JSON string)
            zip.file(relativePath, JSON.stringify(content, null, 2));
          }

        } catch (fileError) {
          // Continue with other files
        }
      }

      // Step 3: Generate and download the zip
      setDownloadProgress({
        current: files.length,
        total: files.length,
        currentFile: 'Generating zip file...'
      });

      const zipBlob = await zip.generateAsync({
        type: 'blob',
        compression: 'DEFLATE',
        compressionOptions: { level: 6 }
      });

      // Download the zip file
      const url = URL.createObjectURL(zipBlob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `workspace-${sandboxId}-${new Date().toISOString().slice(0, 10)}.zip`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      // Clean up
      setTimeout(() => URL.revokeObjectURL(url), 10000);

      toast.success(`Downloaded ${files.length} files as zip archive`);

    } catch (error) {
      toast.error(`Failed to create zip archive: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setIsDownloadingAll(false);
      setDownloadProgress(null);
    }
  }, [sandboxId, session?.access_token, isDownloadingAll, discoverAllFiles]);

  // Helper function to check if a value is a Blob (type-safe version of instanceof)
  const isBlob = (value: any): value is Blob => {
    return value instanceof Blob;
  };

  // Helper function to clear the selected file
  const clearSelectedFile = useCallback(() => {
    setSelectedFilePath(null);
    setRawContent(null);
    setTextContentForRenderer(null); // Clear derived text content
    setBlobUrlForRenderer(null); // Clear derived blob URL
    setContentError(null);
    // Only reset file list mode index when not in file list mode
    if (!isFileListMode) {
      setCurrentFileIndex(-1);
    }
  }, [isFileListMode]);

  // Core file opening function
  const openFile = useCallback(
    async (file: FileInfo) => {
      if (file.is_dir) {
        // For directories, just navigate to that folder
        const normalizedPath = normalizePath(file.path);

        // Clear selected file when navigating
        clearSelectedFile();

        // Update path state - must happen after clearing selection
        setCurrentPath(normalizedPath);
        return;
      }

      // Skip if already selected
      if (selectedFilePath === file.path) {
        return;
      }

      // Clear previous state and set selected file
      clearSelectedFile();
      setSelectedFilePath(file.path);

      // Only reset file index if we're NOT in file list mode or the file is not in the list
      if (!isFileListMode || !filePathList?.includes(file.path)) {
        setCurrentFileIndex(-1);
      }

      // The useFileContentQuery hook will automatically handle loading the content
      // No need to manually fetch here - React Query will handle it
    },
    [
      selectedFilePath,
      clearSelectedFile,
      normalizePath,
      isFileListMode,
      filePathList,
    ],
  );

  // Load files when modal opens or path changes - Refined
  useEffect(() => {
    if (!open || !sandboxId) {
      return; // Don't load if modal is closed or no sandbox ID
    }

    // Skip repeated loads for the same path
    if (isLoadingFiles && currentNavigationRef.current === currentPath) {
      return;
    }

    // Track current navigation
    currentNavigationRef.current = currentPath;

    // React Query handles the loading state automatically

    // After the first load, set isInitialLoad to false
    if (isInitialLoad) {
      setIsInitialLoad(false);
    }

    // Handle any loading errors
    if (filesError) {
      toast.error('Failed to load files');
    }
  }, [open, sandboxId, currentPath, isInitialLoad, isLoadingFiles, filesError]);

  // Helper function to navigate to a folder
  const navigateToFolder = useCallback(
    (folder: FileInfo) => {
      if (!folder.is_dir) return;

      // Ensure the path is properly normalized
      const normalizedPath = normalizePath(folder.path);

      // Clear selected file when navigating
      clearSelectedFile();

      // Update path state - must happen after clearing selection
      setCurrentPath(normalizedPath);
    },
    [normalizePath, clearSelectedFile, currentPath],
  );

  // Navigate to a specific path in the breadcrumb
  const navigateToBreadcrumb = useCallback(
    (path: string) => {
      const normalizedPath = normalizePath(path);

      // Clear selected file and set path
      clearSelectedFile();
      setCurrentPath(normalizedPath);
    },
    [normalizePath, clearSelectedFile],
  );

  // Helper function to navigate to home
  const navigateHome = useCallback(() => {
    clearSelectedFile();
    setCurrentPath('/workspace');
  }, [clearSelectedFile, currentPath]);

  // Function to generate breadcrumb segments from a path
  const getBreadcrumbSegments = useCallback(
    (path: string) => {
      // Ensure we're working with a normalized path
      const normalizedPath = normalizePath(path);

      // Remove /workspace prefix and split by /
      const cleanPath = normalizedPath.replace(/^\/workspace\/?/, '');
      if (!cleanPath) return [];

      const parts = cleanPath.split('/').filter(Boolean);
      let currentPath = '/workspace';

      return parts.map((part, index) => {
        currentPath = `${currentPath}/${part}`;
        return {
          name: part,
          path: currentPath,
          isLast: index === parts.length - 1,
        };
      });
    },
    [normalizePath],
  );

  // Add a helper to directly interact with the raw cache
  const _directlyAccessCache = useCallback(
    (filePath: string): {
      found: boolean;
      content: any;
      contentType: string;
    } => {
      // Normalize the path for consistent cache key
      let normalizedPath = filePath;
      if (!normalizedPath.startsWith('/workspace')) {
        normalizedPath = `/workspace/${normalizedPath.startsWith('/') ? normalizedPath.substring(1) : normalizedPath}`;
      }

      // Detect the appropriate content type based on file extension
      const detectedContentType = FileCache.getContentTypeFromPath(filePath);

      // Create cache key with detected content type
      const cacheKey = `${sandboxId}:${normalizedPath}:${detectedContentType}`;

      if (FileCache.has(cacheKey)) {
        const cachedContent = FileCache.get(cacheKey);
        return { found: true, content: cachedContent, contentType: detectedContentType };
      }

      return { found: false, content: null, contentType: detectedContentType };
    },
    [sandboxId],
  );

  // Navigation functions for file list mode
  const navigateToFileByIndex = useCallback((index: number) => {
    if (!isFileListMode || !filePathList || index < 0 || index >= filePathList.length) {
      return;
    }

    const filePath = filePathList[index];
    setCurrentFileIndex(index);

    // Create a temporary FileInfo object for the file
    const fileName = filePath.split('/').pop() || '';
    const normalizedPath = normalizePath(filePath);

    const fileInfo: FileInfo = {
      name: fileName,
      path: normalizedPath,
      is_dir: false,
      size: 0,
      mod_time: new Date().toISOString(),
    };

    openFile(fileInfo);
  }, [isFileListMode, filePathList, normalizePath, openFile]);

  const navigatePrevious = useCallback(() => {
    if (currentFileIndex > 0) {
      navigateToFileByIndex(currentFileIndex - 1);
    }
  }, [currentFileIndex, navigateToFileByIndex]);

  const navigateNext = useCallback(() => {
    if (isFileListMode && filePathList && currentFileIndex < filePathList.length - 1) {
      navigateToFileByIndex(currentFileIndex + 1);
    }
  }, [currentFileIndex, isFileListMode, filePathList, navigateToFileByIndex]);

  // Handle initial file path - Runs ONLY ONCE on open if initialFilePath is provided
  useEffect(() => {
    // Only run if modal is open, initial path is provided, AND it hasn't been processed yet
    if (open && safeInitialFilePath && !initialPathProcessed) {
      // If we're in file list mode, find the index and navigate to it
      if (isFileListMode && filePathList) {
        const normalizedInitialPath = normalizePath(safeInitialFilePath);
        const index = filePathList.findIndex(path => normalizePath(path) === normalizedInitialPath);
        if (index !== -1) {
          navigateToFileByIndex(index);
          setInitialPathProcessed(true);
          return;
        }
      }

      // Normalize the initial path
      const fullPath = normalizePath(safeInitialFilePath);
      const lastSlashIndex = fullPath.lastIndexOf('/');
      const directoryPath =
        lastSlashIndex > 0
          ? fullPath.substring(0, lastSlashIndex)
          : '/workspace';
      const fileName =
        lastSlashIndex >= 0 ? fullPath.substring(lastSlashIndex + 1) : '';

      // Set the current path to the target directory
      // This will trigger the other useEffect to load files for this directory
      if (currentPath !== directoryPath) {
        setCurrentPath(directoryPath);
      }

      // Try to load the file directly from cache if possible
      if (safeInitialFilePath) {
        // Create a temporary FileInfo object for the initial file
        const initialFile: FileInfo = {
          name: fileName,
          path: fullPath,
          is_dir: false,
          size: 0,
          mod_time: new Date().toISOString(),
        };

        // Now that openFile is defined first, we can call it directly
        openFile(initialFile);
      }

      // Mark the initial path as processed so this doesn't run again
      setInitialPathProcessed(true);
    } else if (!open) {
      // Reset the processed flag when the modal closes
      setInitialPathProcessed(false);
    }
  }, [open, safeInitialFilePath, initialPathProcessed, normalizePath, currentPath, openFile, isFileListMode, filePathList, navigateToFileByIndex]);

  // Effect to handle cached file content updates
  useEffect(() => {
    if (!selectedFilePath) return;

    // Handle errors
    if (cachedFileError) {
      setContentError(`Failed to load file: ${cachedFileError.message}`);
      return;
    }

    // Handle successful content
    if (cachedFileContent !== null && !isCachedFileLoading) {
      // Check file type to determine proper handling
      const isImageFile = FileCache.isImageFile(selectedFilePath);
      const isPdfFile = FileCache.isPdfFile(selectedFilePath);
      const extension = selectedFilePath.split('.').pop()?.toLowerCase();
      const isOfficeFile = ['xlsx', 'xls', 'docx', 'pptx', 'ppt'].includes(extension || '');
      const isBinaryFile = isImageFile || isPdfFile || isOfficeFile;

      // Store raw content
      setRawContent(cachedFileContent);

      // Handle content based on type and file extension
      if (typeof cachedFileContent === 'string') {
        if (cachedFileContent.startsWith('blob:')) {
          // It's already a blob URL
          setTextContentForRenderer(null);
          setBlobUrlForRenderer(cachedFileContent);
        } else if (isBinaryFile) {
          // Binary files should not be displayed as text, even if they come as strings
          setTextContentForRenderer(null);
          setBlobUrlForRenderer(null);
          setContentError('Binary file received in incorrect format. Please try refreshing.');
        } else {
          // Actual text content for text files
          setTextContentForRenderer(cachedFileContent);
          setBlobUrlForRenderer(null);
        }
      } else if (isBlob(cachedFileContent)) {
        // Create blob URL for binary content
        const url = URL.createObjectURL(cachedFileContent);
        setBlobUrlForRenderer(url);
        setTextContentForRenderer(null);
      } else if (typeof cachedFileContent === 'object') {
        // convert to json string if file_contents is a object
        const jsonString = JSON.stringify(cachedFileContent, null, 2);
        setTextContentForRenderer(jsonString);
        setBlobUrlForRenderer(null);
      }
      else {
        // Unknown content type
        setTextContentForRenderer(null);
        setBlobUrlForRenderer(null);
        setContentError('Unknown content type received.');
      }
    }
  }, [selectedFilePath, cachedFileContent, isCachedFileLoading, cachedFileError]);

  // Modify the cleanup effect to respect active downloads
  useEffect(() => {
    return () => {
      if (blobUrlForRenderer && !isDownloading && !activeDownloadUrls.current.has(blobUrlForRenderer)) {
        URL.revokeObjectURL(blobUrlForRenderer);
      }
    };
  }, [blobUrlForRenderer, isDownloading]);

  // Keyboard navigation
  useEffect(() => {
    if (!open || !isFileListMode) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        navigatePrevious();
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        navigateNext();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [open, isFileListMode, navigatePrevious, navigateNext]);

  // Handle modal close
  const handleOpenChange = useCallback(
    (open: boolean) => {
      if (!open) {
        // Only revoke if not downloading and not an active download URL
        if (blobUrlForRenderer && !isDownloading && !activeDownloadUrls.current.has(blobUrlForRenderer)) {
          URL.revokeObjectURL(blobUrlForRenderer);
        }

        clearSelectedFile();
        setCurrentPath('/workspace');
        // React Query will handle clearing the files data
        setInitialPathProcessed(false);
        setIsInitialLoad(true);
        setCurrentFileIndex(-1); // Reset file index

        // Reset download all state
        setIsDownloadingAll(false);
        setDownloadProgress(null);
      }
      onOpenChange(open);
    },
    [onOpenChange, clearSelectedFile, setIsInitialLoad, blobUrlForRenderer, isDownloading],
  );

  // Helper to check if file is markdown
  const isMarkdownFile = useCallback((filePath: string | null) => {
    return filePath ? filePath.toLowerCase().endsWith('.md') : false;
  }, []);
  

  const isDocumentFile = useCallback((filePath: string | null) => {
    if (!filePath) return false;
    const lower = filePath.toLowerCase();
    return lower.endsWith('.doc');
  }, []);
  
  const isTipTapDocumentContent = useCallback((content: string | null) => {
    if (!content) return false;
    try {
      const parsed = JSON.parse(content);
      return parsed.type === 'tiptap_document';
    } catch {
      return false;
    }
  }, []);

  const copyToClipboard = useCallback(async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch (err) {
      return false;
    }
  }, []);

  const handleCopyPath = useCallback(async () => {
    if (!textContentForRenderer) return;
    
    setIsCopyingPath(true);
    const success = await copyToClipboard(textContentForRenderer);
    if (success) {
      toast.success('File content copied to clipboard');
    } else {
      toast.error('Failed to copy file content');
    }
    setTimeout(() => setIsCopyingPath(false), 500);
  }, [textContentForRenderer, copyToClipboard]);

  const handleCopyContent = useCallback(async () => {
    if (!textContentForRenderer) return;
    
    setIsCopyingContent(true);
    const success = await copyToClipboard(textContentForRenderer);
    if (success) {
      toast.success('File content copied to clipboard');
    } else {
      toast.error('Failed to copy file content');
    }
    setTimeout(() => setIsCopyingContent(false), 500);
  }, [textContentForRenderer, copyToClipboard]);
  
  // Handle opening the TipTap document editor
  const handleOpenEditor = useCallback(() => {
    if (!selectedFilePath || !textContentForRenderer || !isDocumentFile(selectedFilePath)) {
      return;
    }
    
    // Check if it's actually a TipTap document by examining content
    if (!isTipTapDocumentContent(textContentForRenderer)) {
      toast.error('This document format is not supported for editing');
      return;
    }
    
    // Parse the TipTap document JSON
    try {
      const documentData = JSON.parse(textContentForRenderer);
      setEditorDocumentData(documentData);
      setIsEditorOpen(true);
    } catch (error) {
      toast.error('Failed to parse document data');
    }
  }, [selectedFilePath, textContentForRenderer, isDocumentFile, isTipTapDocumentContent]);
  
  // Handle document save from editor
  const handleDocumentSave = useCallback(() => {
    // Refresh the file content after saving
    if (selectedFilePath) {
      // Clear cache for this file to force reload
      const normalizedPath = normalizePath(selectedFilePath);
      const contentType = FileCache.getContentTypeFromPath(normalizedPath);
      const cacheKey = `${sandboxId}:${normalizedPath}:${contentType}`;
      FileCache.delete(cacheKey);
      
      // Re-open the file to reload content
      const fileName = selectedFilePath.split('/').pop() || '';
      openFile({
        name: fileName,
        path: normalizedPath,
        is_dir: false,
        size: 0,
        mod_time: new Date().toISOString(),
      });
    }
  }, [selectedFilePath, sandboxId, normalizePath, openFile]);

  // Handle PDF export for markdown files
  const handleExportPdf = useCallback(
    async (orientation: 'portrait' | 'landscape' = 'portrait') => {
      if (
        !selectedFilePath ||
        isExportingPdf ||
        !isMarkdownFile(selectedFilePath)
      )
        return;

      setIsExportingPdf(true);

      try {
        // Use the ref to access the markdown content directly
        if (!markdownRef.current) {
          throw new Error('Markdown content not found');
        }

        // Create a standalone document for printing
        const printWindow = window.open('', '_blank');
        if (!printWindow) {
          throw new Error(
            'Unable to open print window. Please check if popup blocker is enabled.',
          );
        }

        // Get the base URL for resolving relative URLs
        const _baseUrl = window.location.origin;

        // Generate HTML content
        const fileName = selectedFilePath.split('/').pop() || 'document';
        const pdfName = fileName.replace(/\.md$/, '');

        // Extract content
        const markdownContent = markdownRef.current.innerHTML;

        // Generate a full HTML document with controlled styles
        const htmlContent = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="UTF-8">
          <title>${pdfName}</title>
          <style>
            @media print {
              @page { 
                size: ${orientation === 'landscape' ? 'A4 landscape' : 'A4'};
                margin: 15mm;
              }
              body {
                -webkit-print-color-adjust: exact;
                print-color-adjust: exact;
              }
            }
            body {
              font-family: 'Geist', 'Helvetica', 'Arial', sans-serif;
              font-size: 12pt;
              color: #333;
              line-height: 1.5;
              padding: 20px;
              max-width: 100%;
              margin: 0 auto;
              background: white;
            }
            h1 { font-size: 24pt; margin-top: 20pt; margin-bottom: 12pt; }
            h2 { font-size: 20pt; margin-top: 18pt; margin-bottom: 10pt; }
            h3 { font-size: 16pt; margin-top: 16pt; margin-bottom: 8pt; }
            h4, h5, h6 { font-weight: bold; margin-top: 12pt; margin-bottom: 6pt; }
            p { margin: 8pt 0; }
            pre, code {
              font-family: 'Geist Mono', 'Courier New', monospace;
              background-color: #f5f5f5;
              border-radius: 3pt;
              padding: 2pt 4pt;
              font-size: 10pt;
            }
            pre {
              padding: 8pt;
              margin: 8pt 0;
              overflow-x: auto;
              white-space: pre-wrap;
            }
            code {
              white-space: pre-wrap;
            }
            img {
              max-width: 100%;
              height: auto;
            }
            a {
              color: #0066cc;
              text-decoration: underline;
            }
            ul, ol {
              padding-left: 20pt;
              margin: 8pt 0;
            }
            blockquote {
              margin: 8pt 0;
              padding-left: 12pt;
              border-left: 4pt solid #ddd;
              color: #666;
            }
            table {
              border-collapse: collapse;
              width: 100%;
              margin: 12pt 0;
            }
            th, td {
              border: 1pt solid #ddd;
              padding: 6pt;
              text-align: left;
            }
            th {
              background-color: #f5f5f5;
              font-weight: bold;
            }
            /* Syntax highlighting basic styles */
            .hljs-keyword, .hljs-selector-tag { color: #569cd6; }
            .hljs-literal, .hljs-number { color: #b5cea8; }
            .hljs-string { color: #ce9178; }
            .hljs-comment { color: #6a9955; }
            .hljs-attribute, .hljs-attr { color: #9cdcfe; }
            .hljs-function, .hljs-name { color: #dcdcaa; }
            .hljs-title.class_ { color: #4ec9b0; }
            .markdown-content pre { background-color: #f8f8f8; }
          </style>
        </head>
        <body>
          <div class="markdown-content">
            ${markdownContent}
          </div>
          <script>
            // Remove any complex CSS variables or functions that might cause issues
            document.querySelectorAll('[style]').forEach(el => {
              const style = el.getAttribute('style');
              if (style && (style.includes('oklch') || style.includes('var(--') || style.includes('hsl('))) {
                // Replace complex color values with simple ones or remove them
                el.setAttribute('style', style
                  .replace(/color:.*?(;|$)/g, 'color: #333;')
                  .replace(/background-color:.*?(;|$)/g, 'background-color: transparent;')
                );
              }
            });
            
            // Print automatically when loaded
            window.onload = () => {
              setTimeout(() => {
                window.print();
                setTimeout(() => window.close(), 500);
              }, 300);
            };
          </script>
        </body>
        </html>
      `;

        // Write the HTML content to the new window
        printWindow.document.open();
        printWindow.document.write(htmlContent);
        printWindow.document.close();

        toast.success('PDF export initiated. Check your print dialog.');
      } catch (error) {
        toast.error(
          `Failed to export PDF: ${error instanceof Error ? error.message : String(error)}`,
        );
      } finally {
        setIsExportingPdf(false);
      }
    },
    [selectedFilePath, isExportingPdf, isMarkdownFile],
  );

  // Handle file download - streamlined for performance
  const handleDownload = async () => {
    if (!selectedFilePath || isDownloading) return;

    try {
      setIsDownloading(true);

      // Get file metadata
      const fileName = selectedFilePath.split('/').pop() || 'file';
      const mimeType = FileCache.getMimeTypeFromPath?.(selectedFilePath) || 'application/octet-stream';

      // Use rawContent if available
      if (rawContent) {
        let blob: Blob;

        if (typeof rawContent === 'string') {
          if (rawContent.startsWith('blob:')) {
            // If it's a blob URL, get directly from server to avoid CORS issues
            const response = await fetch(
              `${process.env.NEXT_PUBLIC_BACKEND_URL}/sandboxes/${sandboxId}/files/content?path=${encodeURIComponent(selectedFilePath)}`,
              { headers: { 'Authorization': `Bearer ${session?.access_token}` } }
            );

            if (!response.ok) throw new Error(`Server error: ${response.status}`);
            blob = await response.blob();
          } else {
            // Text content
            blob = new Blob([rawContent], { type: mimeType });
          }
        } else if (rawContent instanceof Blob) {
          // Already a blob
          blob = rawContent;
        } else {
          // Unknown format, stringify
          blob = new Blob([JSON.stringify(rawContent)], { type: 'application/json' });
        }

        // Ensure correct MIME type
        if (blob.type !== mimeType) {
          blob = new Blob([blob], { type: mimeType });
        }

        downloadBlob(blob, fileName);
        return;
      }

      // Get from server if no raw content
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_BACKEND_URL}/sandboxes/${sandboxId}/files/content?path=${encodeURIComponent(selectedFilePath)}`,
        { headers: { 'Authorization': `Bearer ${session?.access_token}` } }
      );

      if (!response.ok) throw new Error(`Server error: ${response.status}`);

      const blob = await response.blob();
      const finalBlob = new Blob([blob], { type: mimeType });
      downloadBlob(finalBlob, fileName);

    } catch (error) {
      toast.error(`Failed to download file: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setIsDownloading(false);
    }
  };

  // Helper function to download a blob
  const downloadBlob = (blob: Blob, fileName: string) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);

    // Track URL and schedule cleanup
    activeDownloadUrls.current.add(url);
    setTimeout(() => {
      URL.revokeObjectURL(url);
      activeDownloadUrls.current.delete(url);
    }, 10000);

    toast.success('Download started');
  };

  // Handle file upload - Define after helpers
  const handleUpload = useCallback(() => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  }, []);



  // Process uploaded file - Define after helpers
  const processUpload = useCallback(
    async (event: React.ChangeEvent<HTMLInputElement>) => {
      if (!event.target.files || event.target.files.length === 0) return;

      const file = event.target.files[0];
      setIsUploading(true);

      try {
        // Normalize filename to NFC
        const normalizedName = normalizeFilenameToNFC(file.name);
        const uploadPath = `${currentPath}/${normalizedName}`;

        const formData = new FormData();
        // If the filename was normalized, append with the normalized name in the field name
        // The server will use the path parameter for the actual filename
        formData.append('file', file, normalizedName);
        formData.append('path', uploadPath);

        const supabase = createClient();
        const {
          data: { session },
        } = await supabase.auth.getSession();

        if (!session?.access_token) {
          throw new Error('No access token available');
        }

        const response = await fetch(
          `${API_URL}/sandboxes/${sandboxId}/files`,
          {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${session.access_token}`,
            },
            body: formData,
          },
        );

        if (!response.ok) {
          const error = await response.text();
          throw new Error(error || 'Upload failed');
        }

        // Reload the file list using React Query
        await refetchFiles();

        toast.success(`Uploaded: ${normalizedName}`);
      } catch (error) {
        toast.error(
          `Upload failed: ${error instanceof Error ? error.message : String(error)}`,
        );
      } finally {
        setIsUploading(false);
        if (event.target) event.target.value = '';
      }
    },
    [currentPath, sandboxId, refetchFiles],
  );

  // Reset file list mode when modal opens without filePathList
  useEffect(() => {
    if (open && !filePathList) {
      setCurrentFileIndex(-1);
    }
  }, [open, filePathList]);

  // --- Render --- //
  return (
    <>
      <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent 
        className="sm:max-w-[90vw] md:max-w-[1200px] w-[95vw] h-[90vh] max-h-[900px] flex flex-col p-0 gap-0 overflow-hidden rounded-3xl border border-blue-500/10 bg-[rgba(15,23,42,0.12)] backdrop-blur-md shadow-[0_20px_60px_-10px_rgba(0,0,0,0.1),inset_0_1px_0_0_rgba(59,130,246,0.05)] !top-[50%] !left-[50%] !translate-x-[-50%] !translate-y-[-50%]"
      >
        {/* Gradient rim */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 rounded-3xl"
          style={{
            background:
              "linear-gradient(180deg, rgba(173,216,255,0.18), rgba(255,255,255,0.04) 30%, rgba(150,160,255,0.14) 85%, rgba(255,255,255,0.06))",
            WebkitMask: "linear-gradient(#000,#000) content-box, linear-gradient(#000,#000)",
            WebkitMaskComposite: "xor" as any,
            maskComposite: "exclude",
            padding: 1,
            borderRadius: 24,
          }}
        />
        
        {/* Specular streak */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 top-0 h-24"
          style={{
            background:
              "linear-gradient(180deg, rgba(255,255,255,0.22), rgba(255,255,255,0.06) 45%, rgba(255,255,255,0) 100%)",
            filter: "blur(6px)",
            mixBlendMode: "screen",
          }}
        />
        
        {/* Fine noise */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 opacity-30"
          style={{
            backgroundImage:
              "url('data:image/svg+xml;utf8,<svg xmlns=\'http://www.w3.org/2000/svg\' width=\'60\' height=\'60\'><filter id=\'n\'><feTurbulence type=\'fractalNoise\' baseFrequency=\'0.8\' numOctaves=\'4\'/><feColorMatrix type=\'saturate\' values=\'0\'/><feComponentTransfer><feFuncA type=\'table\' tableValues=\'0 0.03\'/></feComponentTransfer></filter><rect width=\'100%\' height=\'100%\' filter=\'url(%23n)\' /></svg>')",
            backgroundSize: "100px 100px",
            mixBlendMode: "overlay",
          }}
        />

        {/* Header */}
        <DialogHeader className="px-4 py-3 flex-shrink-0 grid grid-cols-[1fr_auto_1fr] items-center gap-4 border-b border-white/10 relative z-10">
          <div className="flex items-center gap-2 text-sm text-white/70 h-8">
            {/* Download progress display */}
            {downloadProgress && (
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-1.5">
                  <Loader className="h-4 w-4 animate-spin text-white/60" />
                  <span>
                    {downloadProgress.total > 0
                      ? `${downloadProgress.current}/${downloadProgress.total}`
                      : 'Preparing...'
                    }
                  </span>
                </div>
                <span className="max-w-[200px] truncate">
                  {downloadProgress.currentFile}
                </span>
              </div>
            )}
          </div>

          <DialogTitle className="text-lg font-semibold text-white/90 text-center">
            Iris's Vault
          </DialogTitle>

          <div className="flex items-center gap-2 justify-end">
            {/* Navigation arrows for file list mode */}
            {(() => {
              return isFileListMode && selectedFilePath && filePathList && filePathList.length > 1 && currentFileIndex >= 0;
            })() && (
                <>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={navigatePrevious}
                    disabled={currentFileIndex <= 0}
                    className="h-8 w-8 p-0 border-white/20 bg-white/5 hover:bg-white/10 hover:border-white/30 text-white/80"
                    title="Previous file (←)"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <div className="text-xs text-white/60 px-2">
                    {currentFileIndex + 1} / {(filePathList?.length || 0)}
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={navigateNext}
                    disabled={currentFileIndex >= (filePathList?.length || 0) - 1}
                    className="h-8 w-8 p-0 border-white/20 bg-white/5 hover:bg-white/10 hover:border-white/30 text-white/80"
                    title="Next file (→)"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </>
              )}
          </div>
        </DialogHeader>

        {/* Breadcrumb Navigation */}
        <div className="px-4 py-2 flex items-center gap-2 border-b border-white/10 relative z-10">
          <Button
            variant="ghost"
            size="icon"
            onClick={navigateHome}
            className="h-8 w-8 text-white/70 hover:text-white/90 hover:bg-white/10"
            title="Go to home directory"
          >
            <Home className="h-4 w-4" />
          </Button>

          <div className="flex items-center overflow-x-auto flex-1 min-w-0 scrollbar-hide whitespace-nowrap">
            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-sm font-medium min-w-fit flex-shrink-0 text-white/70 hover:text-white/90 hover:bg-white/10"
              onClick={navigateHome}
            >
              home
            </Button>

            {currentPath !== '/workspace' && (
              <>
                {getBreadcrumbSegments(currentPath).map((segment) => (
                  <Fragment key={segment.path}>
                    <ChevronRight className="h-4 w-4 mx-1 text-white/40 flex-shrink-0" />
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 px-2 text-sm font-medium truncate max-w-[200px] text-white/70 hover:text-white/90 hover:bg-white/10"
                      onClick={() => navigateToBreadcrumb(segment.path)}
                    >
                      {segment.name}
                    </Button>
                  </Fragment>
                ))}
              </>
            )}

            {selectedFilePath && (
              <>
                <ChevronRight className="h-4 w-4 mx-1 text-white/40 flex-shrink-0" />
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium truncate text-white/90">
                    {selectedFilePath.split('/').pop()}
                  </span>
                </div>
              </>
            )}
          </div>

          <div className="flex items-center gap-2 flex-shrink-0">
            {selectedFilePath && (
              <>
                {/* Copy content button - only show for text files */}
                {textContentForRenderer && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleCopyContent}
                    disabled={isCopyingContent || isCachedFileLoading}
                    className="h-8 gap-1 border-white/20 bg-white/5 hover:bg-white/10 hover:border-white/30 text-white/80"
                  >
                    {isCopyingContent ? (
                      <Check className="h-4 w-4" />
                    ) : (
                      <Copy className="h-4 w-4" />
                    )}
                    <span className="hidden sm:inline">Copy</span>
                  </Button>
                )}
                
                {/* Edit button - only show for document files that are TipTap format */}
                {isDocumentFile(selectedFilePath) && textContentForRenderer && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleOpenEditor}
                    disabled={isCachedFileLoading}
                    className="h-8 gap-1 border-white/20 bg-white/5 hover:bg-white/10 hover:border-white/30 text-white/80"
                  >
                    <Edit className="h-4 w-4" />
                    <span className="hidden sm:inline">Edit</span>
                  </Button>
                )}

                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleDownload}
                  disabled={isDownloading || isCachedFileLoading}
                  className="h-8 gap-1 border-white/20 bg-white/5 hover:bg-white/10 hover:border-white/30 text-white/80"
                >
                  {isDownloading ? (
                    <Loader className="h-4 w-4 animate-spin" />
                  ) : (
                    <Download className="h-4 w-4" />
                  )}
                  <span className="hidden sm:inline">Download</span>
                </Button>

                {isMarkdownFile(selectedFilePath) && (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={
                          isExportingPdf ||
                          isCachedFileLoading ||
                          contentError !== null
                        }
                        className="h-8 gap-1 border-white/20 bg-white/5 hover:bg-white/10 hover:border-white/30 text-white/80"
                      >
                        {isExportingPdf ? (
                          <Loader className="h-4 w-4 animate-spin" />
                        ) : (
                          <FileText className="h-4 w-4" />
                        )}
                        <span className="hidden sm:inline">Export as PDF</span>
                        <ChevronDown className="h-3 w-3 ml-1" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="bg-[rgba(10,14,22,0.95)] border-white/10 backdrop-blur-2xl">
                      <DropdownMenuItem
                        onClick={() => handleExportPdf('portrait')}
                        className="flex items-center gap-2 cursor-pointer text-white/80 hover:bg-white/10"
                      >
                        <span className="rotate-90">⬌</span> Portrait
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => handleExportPdf('landscape')}
                        className="flex items-center gap-2 cursor-pointer text-white/80 hover:bg-white/10"
                      >
                        <span>⬌</span> Landscape
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                )}
              </>
            )}

            {!selectedFilePath && (
              <>
                {/* Download All button - only show when in home directory */}
                {currentPath === '/workspace' && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleDownloadAll}
                    disabled={isDownloadingAll || isLoadingFiles}
                    className="h-8 gap-1 border-white/20 bg-white/5 hover:bg-white/10 hover:border-white/30 text-white/80"
                  >
                    {isDownloadingAll ? (
                      <Loader className="h-4 w-4 animate-spin" />
                    ) : (
                      <Archive className="h-4 w-4" />
                    )}
                    <span className="hidden sm:inline">Download All</span>
                  </Button>
                )}

                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleUpload}
                  disabled={isUploading}
                  className="h-8 gap-1 border-white/20 bg-white/5 hover:bg-white/10 hover:border-white/30 text-white/80"
                >
                  {isUploading ? (
                    <Loader className="h-4 w-4 animate-spin" />
                  ) : (
                    <Upload className="h-4 w-4" />
                  )}
                  <span className="hidden sm:inline">Upload</span>
                </Button>
              </>
            )}

            <input
              type="file"
              ref={fileInputRef}
              className="hidden"
              onChange={processUpload}
              disabled={isUploading}
            />
          </div>
        </div>

        {/* File Type Filter Buttons */}
        {!selectedFilePath && (
          <div className="px-4 py-3 border-b border-blue-500/10 relative z-10">
            <div className="flex items-center gap-2 overflow-x-auto scrollbar-hide">
              {fileFilters.map((filter) => {
                const IconComponent = filter.icon;
                return (
                  <Button
                    key={filter.key}
                    variant="outline"
                    size="sm"
                    onClick={() => setActiveFilter(filter.key)}
                    className={`h-9 px-4 text-xs font-medium whitespace-nowrap transition-all duration-300 rounded-2xl border backdrop-blur-md ${
                      activeFilter === filter.key
                        ? 'bg-[rgba(15,23,42,0.25)] border-blue-400/30 text-blue-300 hover:bg-[rgba(15,23,42,0.35)] shadow-[0_4px_12px_-2px_rgba(59,130,246,0.2)]'
                        : 'border-blue-500/15 bg-[rgba(15,23,42,0.12)] text-white/70 hover:bg-[rgba(15,23,42,0.2)] hover:border-blue-400/25 hover:text-white/90 shadow-[0_2px_8px_-2px_rgba(59,130,246,0.1)]'
                    }`}
                  >
                    <IconComponent className="h-3.5 w-3.5 mr-2 stroke-[1.5]" />
                    {filter.label}
                    {filter.key !== 'all' && (
                      <span className="ml-2 text-xs opacity-60">
                        ({allWorkspaceFiles.filter(file => {
                          const extension = file.name.toLowerCase().substring(file.name.lastIndexOf('.'));
                          return filter.extensions?.includes(extension);
                        }).length})
                      </span>
                    )}
                  </Button>
                );
              })}
            </div>
          </div>
        )}

        {/* Content Area */}
        <div className="flex-1 overflow-hidden relative z-10">
          {selectedFilePath ? (
            /* File Viewer */
            <div className="h-full w-full overflow-auto">
              {isCachedFileLoading ? (
                <div className="h-full w-full flex flex-col items-center justify-center">
                  <Loader className="h-8 w-8 animate-spin text-white/60 mb-3" />
                  <p className="text-sm text-white/70">
                    Loading {selectedFilePath ? selectedFilePath.split('/').pop() : 'file'}
                  </p>
                  <p className="text-xs text-white/50 mt-1">
                        {(() => {
                          // Normalize the path for consistent cache checks
                          if (!selectedFilePath) return "Preparing...";

                          let normalizedPath = selectedFilePath;
                          if (!normalizedPath.startsWith('/workspace')) {
                            normalizedPath = `/workspace/${normalizedPath.startsWith('/') ? normalizedPath.substring(1) : normalizedPath}`;
                          }

                          // Detect the appropriate content type based on file extension
                          const detectedContentType = FileCache.getContentTypeFromPath(normalizedPath);

                          // Check for cache with the correct content type
                          const isCached = FileCache.has(`${sandboxId}:${normalizedPath}:${detectedContentType}`);

                          return isCached
                            ? "Using cached version"
                            : "Fetching from server";
                        })()}
                  </p>
                </div>
              ) : contentError ? (
                <div className="h-full w-full flex items-center justify-center p-4">
                  <div className="max-w-md p-6 text-center border border-white/10 rounded-2xl bg-[rgba(10,14,22,0.8)] backdrop-blur-xl">
                    <AlertTriangle className="h-10 w-10 text-orange-400 mx-auto mb-4" />
                    <h3 className="text-lg font-medium mb-2 text-white/90">
                      Error Loading File
                    </h3>
                    <p className="text-sm text-white/60 mb-4">
                      {contentError}
                    </p>
                    <div className="flex justify-center gap-3">
                      <Button
                        onClick={() => {
                          setContentError(null);
                          openFile({
                            path: selectedFilePath,
                            name: selectedFilePath.split('/').pop() || '',
                            is_dir: false,
                            size: 0,
                            mod_time: new Date().toISOString(),
                          } as FileInfo);
                        }}
                        className="bg-white/10 hover:bg-white/20 text-white/90 border-white/20"
                      >
                        Retry
                      </Button>
                      <Button
                        variant="outline"
                        onClick={() => {
                          clearSelectedFile();
                        }}
                        className="border-white/20 bg-white/5 hover:bg-white/10 text-white/80"
                      >
                        Back to Files
                      </Button>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="h-full w-full relative">
                  {(() => {
                    // Safety check: don't render text content for binary files
                    const isImageFile = FileCache.isImageFile(selectedFilePath);
                    const isPdfFile = FileCache.isPdfFile(selectedFilePath);
                    const extension = selectedFilePath?.split('.').pop()?.toLowerCase();
                    const isOfficeFile = ['xlsx', 'xls', 'docx', 'pptx', 'ppt'].includes(extension || '');
                    const isBinaryFile = isImageFile || isPdfFile || isOfficeFile;

                    // For binary files, only render if we have a blob URL
                    if (isBinaryFile && !blobUrlForRenderer) {
                      return (
                        <div className="h-full w-full flex items-center justify-center">
                          <div className="text-sm text-white/60">
                            Loading {isPdfFile ? 'PDF' : isImageFile ? 'image' : 'file'}...
                          </div>
                        </div>
                      );
                    }

                    return (
                      <FileRenderer
                        key={selectedFilePath}
                        content={isBinaryFile ? null : textContentForRenderer}
                        binaryUrl={blobUrlForRenderer}
                        fileName={selectedFilePath?.split('/').pop() || selectedFilePath}
                        filePath={selectedFilePath}
                        className="h-full w-full"
                        project={projectWithSandbox}
                        markdownRef={
                          isMarkdownFile(selectedFilePath) ? markdownRef : undefined
                        }
                        onDownload={handleDownload}
                        isDownloading={isDownloading}
                      />
                    );
                  })()}
                </div>
              )}
            </div>
          ) : (
            /* File Explorer */
            <div className="h-full w-full">
              {isLoadingFiles ? (
                <div className="h-full w-full flex items-center justify-center">
                  <Loader className="h-6 w-6 animate-spin text-white/60" />
                </div>
              ) : filteredFiles.length === 0 ? (
                <div className="h-full w-full flex flex-col items-center justify-center">
                  <Folder className="h-12 w-12 mb-2 text-white/30 opacity-30" />
                  <p className="text-sm text-white/50">
                    {activeFilter === 'all' ? 'Directory is empty' : `No ${fileFilters.find(f => f.key === activeFilter)?.label.toLowerCase()} files found`}
                  </p>
                </div>
              ) : (
                <ScrollArea className="h-full w-full p-2">
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3 p-4">
                    {filteredFiles.map((file) => (
                      <button
                        key={file.path}
                        className={`group flex flex-col items-center p-3 rounded-2xl border border-blue-500/15 bg-[rgba(15,23,42,0.15)] backdrop-blur-md hover:bg-[rgba(15,23,42,0.25)] hover:border-blue-400/25 hover:scale-[1.02] transition-all duration-300 shadow-[0_4px_12px_-2px_rgba(59,130,246,0.1)] ${selectedFilePath === file.path
                          ? 'bg-[rgba(15,23,42,0.3)] border-blue-400/30 ring-1 ring-blue-400/20 shadow-[0_4px_12px_-2px_rgba(59,130,246,0.2)]'
                          : ''
                          }`}
                        onClick={() => {
                          if (file.is_dir) {
                            navigateToFolder(file);
                          } else {
                            // If we're in filter mode and the file is not in current directory,
                            // navigate to the file's directory first, then open the file
                            if (activeFilter !== 'all' && !file.path.startsWith(currentPath)) {
                              const fileDir = file.path.substring(0, file.path.lastIndexOf('/'));
                              setCurrentPath(fileDir);
                              // Small delay to ensure directory loads before opening file
                              setTimeout(() => openFile(file), 100);
                            } else {
                              openFile(file);
                            }
                          }
                        }}
                      >
                        <div className="w-12 h-12 flex items-center justify-center mb-1">
                          {file.is_dir ? (
                            <Folder className="h-9 w-9 text-blue-400 group-hover:text-blue-300 transition-colors" />
                          ) : (
                            <File className="h-8 w-8 text-white/50 group-hover:text-white/70 transition-colors" />
                          )}
                        </div>
                        <span className="text-xs text-center font-medium truncate max-w-full text-white/80 group-hover:text-white/90 transition-colors">
                          {file.name}
                        </span>
                      </button>
                    ))}
                  </div>
                </ScrollArea>
              )}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
    
    {/* TipTap Document Editor Modal */}
    {selectedFilePath && isDocumentFile(selectedFilePath) && editorDocumentData && (
      <TipTapDocumentModal
        open={isEditorOpen}
        onOpenChange={setIsEditorOpen}
        filePath={selectedFilePath}
        documentData={editorDocumentData}
        sandboxId={sandboxId}
        onSave={handleDocumentSave}
      />
    )}
    </>
  );
}
