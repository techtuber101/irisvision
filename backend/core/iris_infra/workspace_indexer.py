"""
Workspace file indexer for intelligent context selection.

Scans /workspace/ directory in Daytona sandbox and builds a searchable index
of available files for the context selection agent.
"""

import asyncio
import os
from typing import Dict, List, Optional, Any
from datetime import datetime
from pathlib import Path
from daytona_sdk import AsyncSandbox
from core.utils.logger import logger


class WorkspaceFileIndex:
    """
    Index of workspace files with metadata for context selection.
    """
    
    def __init__(self):
        self.files: List[Dict[str, Any]] = []
        self.last_scan: Optional[datetime] = None
        self._scan_lock = asyncio.Lock()
        
        # Ignore patterns
        self.ignore_patterns = [
            '.git', '__pycache__', 'node_modules', '.venv', 'venv',
            '.pytest_cache', '.mypy_cache', '.tox', 'dist', 'build',
            '.next', '.nuxt', '.cache', 'coverage', '.DS_Store',
            '*.pyc', '*.pyo', '*.so', '*.dylib', '*.exe', '*.dll'
        ]
        
        # File type categories
        self.file_categories = {
            'code': ['.py', '.js', '.ts', '.tsx', '.jsx', '.java', '.cpp', '.c', '.go', '.rs', '.rb', '.php'],
            'config': ['.json', '.yaml', '.yml', '.toml', '.ini', '.conf', '.env'],
            'docs': ['.md', '.txt', '.rst', '.adoc'],
            'data': ['.csv', '.json', '.xml', '.sql'],
            'web': ['.html', '.css', '.scss', '.sass'],
        }
    
    def _should_ignore(self, path: str) -> bool:
        """Check if file/dir should be ignored."""
        parts = Path(path).parts
        
        # Check ignore patterns
        for pattern in self.ignore_patterns:
            if pattern.startswith('*.'):
                # Extension pattern
                if path.endswith(pattern[1:]):
                    return True
            else:
                # Directory/file name pattern
                if pattern in parts:
                    return True
        
        return False
    
    def _categorize_file(self, filename: str) -> str:
        """Categorize file by extension."""
        ext = Path(filename).suffix.lower()
        
        for category, extensions in self.file_categories.items():
            if ext in extensions:
                return category
        
        return 'other'
    
    async def scan_workspace(self, sandbox: AsyncSandbox, max_depth: int = 10) -> Dict[str, Any]:
        """
        Scan workspace directory and build file index.
        
        Args:
            sandbox: Daytona sandbox instance
            max_depth: Maximum directory depth to scan
            
        Returns:
            Scan results with file count and statistics
        """
        async with self._scan_lock:
            try:
                logger.info("=" * 70)
                logger.info("🔍 WORKSPACE INDEXER: Starting file scan")
                logger.info(f"   Workspace path: /workspace")
                logger.info(f"   Max depth: {max_depth}")
                logger.info("=" * 70)
                start_time = datetime.now()
                
                self.files = []
                workspace_path = "/workspace"
                
                # Recursive scan
                logger.debug("📂 Scanning directories recursively...")
                await self._scan_directory(sandbox, workspace_path, depth=0, max_depth=max_depth)
                
                self.last_scan = datetime.now()
                scan_duration = (self.last_scan - start_time).total_seconds()
                
                # Calculate statistics
                stats = self._calculate_stats()
                
                logger.info("=" * 70)
                logger.info("✅ WORKSPACE SCAN COMPLETE")
                logger.info(f"   Files indexed: {len(self.files)}")
                logger.info(f"   Scan duration: {scan_duration:.2f}s")
                logger.info(f"   Total size: {stats.get('total_size_mb', 0):.2f} MB")
                logger.info(f"   By category: {stats.get('by_category', {})}")
                logger.info("=" * 70)
                
                return {
                    "file_count": len(self.files),
                    "scan_duration": scan_duration,
                    "last_scan": self.last_scan.isoformat(),
                    "statistics": stats
                }
                
            except Exception as e:
                logger.error(f"❌ WORKSPACE SCAN FAILED: {e}", exc_info=True)
                return {
                    "file_count": 0,
                    "error": str(e)
                }
    
    async def _scan_directory(self, sandbox: AsyncSandbox, dir_path: str, depth: int, max_depth: int):
        """Recursively scan directory."""
        if depth > max_depth:
            logger.debug(f"⏭️  Skipping {dir_path} (depth {depth} > max {max_depth})")
            return
        
        try:
            # List files in directory
            files = await sandbox.fs.list_files(dir_path)
            logger.debug(f"📁 Scanning {dir_path} (depth {depth}): found {len(files)} items")
            
            files_added = 0
            dirs_found = 0
            
            for file_info in files:
                file_path = f"{dir_path}/{file_info.name}".replace('//', '/')
                
                # Check if should ignore
                if self._should_ignore(file_path):
                    logger.debug(f"   ⏭️  Ignored: {file_info.name}")
                    continue
                
                # Handle directories
                if file_info.is_dir:
                    dirs_found += 1
                    logger.debug(f"   📂 Directory: {file_info.name}")
                    await self._scan_directory(sandbox, file_path, depth + 1, max_depth)
                else:
                    # Add file to index
                    category = self._categorize_file(file_info.name)
                    
                    # Safely get modification time (Daytona SDK uses mod_time, not modified)
                    mod_time = None
                    if hasattr(file_info, 'mod_time'):
                        mod_time = str(file_info.mod_time) if file_info.mod_time else None
                    elif hasattr(file_info, 'modified'):
                        # Fallback for other possible attribute names
                        mod_time_val = getattr(file_info, 'modified', None)
                        if mod_time_val:
                            if hasattr(mod_time_val, 'isoformat'):
                                mod_time = mod_time_val.isoformat()
                            else:
                                mod_time = str(mod_time_val)
                    
                    self.files.append({
                        "path": file_path,
                        "name": file_info.name,
                        "size": file_info.size,
                        "modified": mod_time,
                        "category": category,
                        "extension": Path(file_info.name).suffix.lower(),
                        "relative_path": file_path.replace('/workspace/', '')
                    })
                    files_added += 1
                    logger.debug(f"   ✅ Indexed: {file_info.name} ({category}, {file_info.size} bytes)")
            
            if files_added > 0 or dirs_found > 0:
                logger.debug(f"📊 {dir_path}: +{files_added} files, {dirs_found} subdirs")
        
        except Exception as e:
            logger.warning(f"⚠️  Error scanning directory {dir_path}: {e}")
    
    def _calculate_stats(self) -> Dict[str, Any]:
        """Calculate statistics about indexed files."""
        total_size = sum(f['size'] for f in self.files)
        categories = {}
        extensions = {}
        
        for file in self.files:
            # Count by category
            cat = file['category']
            categories[cat] = categories.get(cat, 0) + 1
            
            # Count by extension
            ext = file['extension'] or 'no_extension'
            extensions[ext] = extensions.get(ext, 0) + 1
        
        return {
            "total_size_bytes": total_size,
            "total_size_mb": round(total_size / (1024 * 1024), 2),
            "by_category": categories,
            "by_extension": dict(sorted(extensions.items(), key=lambda x: x[1], reverse=True)[:10])
        }
    
    def search_files(self, query: str, category: Optional[str] = None, limit: int = 50) -> List[Dict[str, Any]]:
        """
        Search files by name/path.
        
        Args:
            query: Search query (matches filename or path)
            category: Filter by category (code, config, docs, data, web)
            limit: Maximum results to return
            
        Returns:
            List of matching files
        """
        query_lower = query.lower()
        results = []
        
        for file in self.files:
            # Category filter
            if category and file['category'] != category:
                continue
            
            # Search in path and name
            if query_lower in file['path'].lower() or query_lower in file['name'].lower():
                results.append(file)
            
            if len(results) >= limit:
                break
        
        return results
    
    def get_files_by_category(self, category: str, limit: int = 100) -> List[Dict[str, Any]]:
        """Get files filtered by category."""
        return [f for f in self.files if f['category'] == category][:limit]
    
    def get_recently_modified(self, limit: int = 20) -> List[Dict[str, Any]]:
        """Get recently modified files."""
        sorted_files = sorted(
            [f for f in self.files if f['modified']],
            key=lambda x: x['modified'],
            reverse=True
        )
        return sorted_files[:limit]
    
    def get_file_summary(self, max_files: int = 100) -> str:
        """
        Generate a concise summary of workspace files for the context selector.
        
        Returns human-readable summary string.
        """
        if not self.files:
            return "No files indexed yet."
        
        stats = self._calculate_stats()
        
        summary_parts = [
            f"📁 Workspace: {len(self.files)} files ({stats['total_size_mb']} MB)",
            "",
            "📊 By Category:",
        ]
        
        for cat, count in sorted(stats['by_category'].items(), key=lambda x: x[1], reverse=True):
            summary_parts.append(f"  • {cat}: {count} files")
        
        # Add top-level directories
        top_dirs = {}
        for file in self.files:
            parts = file['relative_path'].split('/')
            if len(parts) > 1:
                top_dir = parts[0]
                top_dirs[top_dir] = top_dirs.get(top_dir, 0) + 1
        
        if top_dirs:
            summary_parts.append("")
            summary_parts.append("📂 Top Directories:")
            for dir_name, count in sorted(top_dirs.items(), key=lambda x: x[1], reverse=True)[:10]:
                summary_parts.append(f"  • {dir_name}/ ({count} files)")
        
        # Add recently modified (if available)
        recent = self.get_recently_modified(5)
        if recent:
            summary_parts.append("")
            summary_parts.append("🕐 Recently Modified:")
            for file in recent:
                summary_parts.append(f"  • {file['relative_path']}")
        
        return "\n".join(summary_parts)
    
    def get_available_files_list(self, max_files: int = 200) -> List[str]:
        """
        Get list of available file paths for context selector.
        
        Returns list of relative paths.
        """
        return [f['relative_path'] for f in self.files[:max_files]]


class WorkspaceIndexer:
    """
    Main workspace indexer coordinating file scanning and querying.
    """
    
    def __init__(self, sandbox: AsyncSandbox):
        self.sandbox = sandbox
        self.index = WorkspaceFileIndex()
        self._auto_rescan_interval = 300  # 5 minutes
        self._last_scan_task: Optional[asyncio.Task] = None
    
    async def initialize(self) -> bool:
        """Initialize the indexer with initial scan."""
        try:
            result = await self.index.scan_workspace(self.sandbox)
            return result.get('file_count', 0) > 0
        except Exception as e:
            logger.error(f"Failed to initialize workspace indexer: {e}")
            return False
    
    async def rescan(self) -> Dict[str, Any]:
        """Force a rescan of the workspace."""
        return await self.index.scan_workspace(self.sandbox)
    
    def get_summary(self) -> str:
        """Get human-readable summary of workspace."""
        return self.index.get_file_summary()
    
    def search(self, query: str, category: Optional[str] = None, limit: int = 50) -> List[Dict[str, Any]]:
        """Search for files."""
        return self.index.search_files(query, category, limit)
    
    def get_available_files(self, max_files: int = 200) -> List[str]:
        """Get list of available file paths."""
        return self.index.get_available_files_list(max_files)
    
    def is_indexed(self) -> bool:
        """Check if workspace has been indexed."""
        return len(self.index.files) > 0

