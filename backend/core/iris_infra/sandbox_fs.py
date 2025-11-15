"""
Centralized filesystem abstraction for Iris infrastructure.

This module provides a clean API for all file operations within the .iris/
directory structure, wrapping Daytona sandbox filesystem operations.
"""

import json
from typing import Optional, List, Dict, Any, Union
from daytona_sdk import AsyncSandbox
from core.utils.logger import logger
from core.iris_infra.sandbox_init import IRIS_ROOT


class IrisSandboxFS:
    """
    Filesystem abstraction for Iris infrastructure operations.
    
    Provides high-level methods for reading/writing files in the .iris/
    directory structure with caching and performance optimizations.
    """
    
    def __init__(self, sandbox: AsyncSandbox):
        """
        Initialize the filesystem abstraction.
        
        Args:
            sandbox: The Daytona sandbox instance
        """
        self.sandbox = sandbox
        self._file_index_cache: Optional[Dict[str, Any]] = None
        self._index_dirty = False
    
    async def read_file(self, path: str) -> Union[str, bytes]:
        """
        Read a file from the sandbox.
        
        Args:
            path: Path relative to IRIS_ROOT (e.g., "runtime/state.json")
                  or absolute path starting with "/"
                  
        Returns:
            File contents as string (UTF-8 decoded) or bytes if decode fails
        """
        full_path = self._resolve_path(path)
        try:
            content = await self.sandbox.fs.download_file(full_path)
            try:
                return content.decode('utf-8')
            except UnicodeDecodeError:
                logger.debug(f"File {full_path} is binary, returning bytes")
                return content
        except Exception as e:
            logger.error(f"Failed to read file {full_path}: {e}")
            raise
    
    async def write_file(self, path: str, content: Union[str, bytes]) -> None:
        """
        Write a file to the sandbox.
        
        Args:
            path: Path relative to IRIS_ROOT or absolute path
            content: Content to write (string or bytes)
        """
        full_path = self._resolve_path(path)
        try:
            if isinstance(content, str):
                content = content.encode('utf-8')
            
            await self.sandbox.fs.upload_file(content, full_path)
            logger.debug(f"Wrote file: {full_path}")
        except Exception as e:
            logger.error(f"Failed to write file {full_path}: {e}")
            raise
    
    async def append_file(self, path: str, content: Union[str, bytes]) -> None:
        """
        Append content to a file.
        
        Args:
            path: Path relative to IRIS_ROOT or absolute path
            content: Content to append (string or bytes)
        """
        full_path = self._resolve_path(path)
        try:
            # Read existing content
            try:
                existing = await self.read_file(path)
                if isinstance(existing, bytes):
                    existing = existing.decode('utf-8')
            except Exception:
                existing = ""
            
            # Append new content
            if isinstance(content, bytes):
                content = content.decode('utf-8')
            
            new_content = existing + content
            await self.write_file(path, new_content)
            logger.debug(f"Appended to file: {full_path}")
        except Exception as e:
            logger.error(f"Failed to append to file {full_path}: {e}")
            raise
    
    async def ensure_dir(self, path: str) -> None:
        """
        Ensure a directory exists (create if it doesn't).
        
        Args:
            path: Path relative to IRIS_ROOT or absolute path
        """
        full_path = self._resolve_path(path)
        try:
            try:
                await self.sandbox.fs.get_file_info(full_path)
                logger.debug(f"Directory already exists: {full_path}")
            except Exception:
                await self.sandbox.fs.create_folder(full_path, "755")
                logger.debug(f"Created directory: {full_path}")
        except Exception as e:
            logger.error(f"Failed to ensure directory {full_path}: {e}")
            raise
    
    async def file_exists(self, path: str) -> bool:
        """
        Check if a file exists.
        
        Args:
            path: Path relative to IRIS_ROOT or absolute path
            
        Returns:
            True if file exists, False otherwise
        """
        full_path = self._resolve_path(path)
        try:
            await self.sandbox.fs.get_file_info(full_path)
            return True
        except Exception:
            return False
    
    async def list_files(self, path: str = "") -> List[str]:
        """
        List files in a directory.
        
        Args:
            path: Path relative to IRIS_ROOT or absolute path (default: IRIS_ROOT)
            
        Returns:
            List of file names (not full paths)
        """
        full_path = self._resolve_path(path) if path else IRIS_ROOT
        try:
            files_info = await self.sandbox.fs.list_files(full_path)
            return [f.name for f in files_info]
        except Exception as e:
            logger.error(f"Failed to list files in {full_path}: {e}")
            return []
    
    async def read_json(self, path: str) -> Any:
        """
        Read and parse a JSON file.
        
        Args:
            path: Path relative to IRIS_ROOT or absolute path
            
        Returns:
            Parsed JSON content
        """
        content = await self.read_file(path)
        if isinstance(content, bytes):
            content = content.decode('utf-8')
        return json.loads(content)
    
    async def write_json(self, path: str, data: Any, indent: int = 2) -> None:
        """
        Write data as JSON to a file.
        
        Args:
            path: Path relative to IRIS_ROOT or absolute path
            data: Data to serialize as JSON
            indent: JSON indentation (default: 2)
        """
        content = json.dumps(data, indent=indent)
        await self.write_file(path, content)
    
    async def load_file_index(self) -> Dict[str, Any]:
        """
        Load the file index from runtime/index.json.
        
        Returns cached version if available.
        
        Returns:
            File index as dictionary
        """
        if self._file_index_cache is None:
            try:
                self._file_index_cache = await self.read_json("runtime/index.json")
                logger.debug(f"Loaded file index: {len(self._file_index_cache)} entries")
            except Exception as e:
                logger.warning(f"Failed to load file index, using empty: {e}")
                self._file_index_cache = []
        
        return self._file_index_cache
    
    async def save_file_index(self, index: Optional[Dict[str, Any]] = None) -> None:
        """
        Save the file index to runtime/index.json.
        
        Args:
            index: Index to save (default: use cached version)
        """
        if index is not None:
            self._file_index_cache = index
        
        if self._file_index_cache is not None:
            try:
                await self.write_json("runtime/index.json", self._file_index_cache)
                self._index_dirty = False
                logger.debug(f"Saved file index: {len(self._file_index_cache)} entries")
            except Exception as e:
                logger.error(f"Failed to save file index: {e}")
    
    async def update_file_index_entry(self, entry: Dict[str, Any]) -> None:
        """
        Update or add an entry in the file index.
        
        Args:
            entry: Index entry with at least 'path' field
        """
        index = await self.load_file_index()
        
        # Find and update existing entry, or append new one
        path = entry.get('path')
        found = False
        for i, existing_entry in enumerate(index):
            if existing_entry.get('path') == path:
                index[i] = entry
                found = True
                break
        
        if not found:
            index.append(entry)
        
        self._file_index_cache = index
        self._index_dirty = True
    
    async def flush_index_if_dirty(self) -> None:
        """Save the file index if it has been modified."""
        if self._index_dirty:
            await self.save_file_index()
    
    def _resolve_path(self, path: str) -> str:
        """
        Resolve a path to absolute form.
        
        Args:
            path: Relative path (to IRIS_ROOT) or absolute path
            
        Returns:
            Absolute path
        """
        if path.startswith('/'):
            return path
        return f"{IRIS_ROOT}/{path}"
