"""
Local Memory Store with Content-Addressed Storage (CAS).

This module implements aggressive memory offloading for ephemeral Daytona sandboxes:
- Content-addressed storage (CAS) with zstd compression
- SQLite-based index for memory metadata
- Slice-based retrieval (line ranges, byte offsets)
- Zero external dependencies (no Supabase for memory)
"""

import hashlib
import json
import os
import sqlite3
import zstandard as zstd
from dataclasses import dataclass, asdict
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional, List, Dict, Any, Tuple
from core.utils.logger import logger


BASE_DIR = Path("/workspace/.aga_mem")
WARM_DIR = BASE_DIR / "warm"
HOT_DIR = BASE_DIR / "hot"
MANIFESTS_DIR = BASE_DIR / "manifests"
LOGS_DIR = BASE_DIR / "logs"
DB_PATH = BASE_DIR / "meta.sqlite"
OPS_LOG = LOGS_DIR / "ops.log"
COMPRESSION_REPORT = LOGS_DIR / "compression_report.log"

COMPRESSION_LEVEL = 6


@dataclass
class MemoryRef:
    """Reference to a memory entry."""
    memory_id: str
    type: str
    subtype: Optional[str]
    mime: str
    bytes: int
    compression: Optional[str]
    path: str
    sha256: str
    title: Optional[str]
    tags: Optional[List[str]]
    created_at: str


class MemoryStoreLocal:
    """Local memory store with content-addressed storage."""
    
    def __init__(self, base_dir: Path = BASE_DIR):
        """Initialize the memory store."""
        self.base_dir = base_dir
        self.warm_dir = base_dir / "warm"
        self.hot_dir = base_dir / "hot"
        self.manifests_dir = base_dir / "manifests"
        self.logs_dir = base_dir / "logs"
        self.db_path = base_dir / "meta.sqlite"
        self.ops_log = self.logs_dir / "ops.log"
        self.compression_report = self.logs_dir / "compression_report.log"
        
        self._ensure_directories()
        self._init_db()
    
    def _ensure_directories(self):
        """Ensure all required directories exist."""
        for dir_path in [self.warm_dir, self.hot_dir, self.manifests_dir, self.logs_dir]:
            dir_path.mkdir(parents=True, exist_ok=True)
    
    def _init_db(self):
        """Initialize SQLite database with schema."""
        conn = sqlite3.connect(str(self.db_path))
        cursor = conn.cursor()
        
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS memories (
                memory_id TEXT PRIMARY KEY,
                type TEXT NOT NULL,
                subtype TEXT,
                mime TEXT NOT NULL DEFAULT 'text/plain',
                bytes INTEGER NOT NULL,
                compression TEXT,
                path TEXT NOT NULL,
                sha256 TEXT NOT NULL,
                title TEXT,
                tags TEXT,
                created_at TEXT NOT NULL
            )
        """)
        
        cursor.execute("""
            CREATE INDEX IF NOT EXISTS idx_memories_type 
            ON memories(type, created_at)
        """)
        
        conn.commit()
        conn.close()
        
        self._log_operation("Database initialized")
    
    def _log_operation(self, message: str, level: str = "INFO"):
        """Log an operation to ops.log."""
        timestamp = datetime.now(timezone.utc).isoformat()
        log_entry = f"[{timestamp}] [{level}] {message}\n"
        
        try:
            with open(self.ops_log, "a") as f:
                f.write(log_entry)
        except Exception as e:
            logger.warning(f"Failed to write to ops log: {e}")
    
    def _log_compression(self, original_bytes: int, compressed_bytes: int, memory_id: str):
        """Log compression statistics."""
        savings = original_bytes - compressed_bytes
        ratio = (1 - compressed_bytes / original_bytes) * 100 if original_bytes > 0 else 0
        
        timestamp = datetime.now(timezone.utc).isoformat()
        report_entry = (
            f"[{timestamp}] memory_id={memory_id}, "
            f"original={original_bytes:,} bytes, "
            f"compressed={compressed_bytes:,} bytes, "
            f"saved={savings:,} bytes ({ratio:.1f}%)\n"
        )
        
        try:
            with open(self.compression_report, "a") as f:
                f.write(report_entry)
        except Exception as e:
            logger.warning(f"Failed to write compression report: {e}")
    
    def _compute_sha256(self, data: bytes) -> str:
        """Compute SHA-256 hash of data."""
        return hashlib.sha256(data).hexdigest()
    
    def _get_cas_path(self, sha256_hash: str) -> Path:
        """Get CAS path for a given SHA-256 hash."""
        prefix = sha256_hash[:2]
        cas_dir = self.warm_dir / prefix
        cas_dir.mkdir(parents=True, exist_ok=True)
        return cas_dir / f"{sha256_hash}.zst"
    
    def put_text(
        self,
        content: str,
        type: str = "TOOL_OUTPUT",
        subtype: Optional[str] = None,
        title: Optional[str] = None,
        tags: Optional[List[str]] = None,
        mime: str = "text/plain"
    ) -> MemoryRef:
        """
        Store text content in CAS with compression.
        
        Args:
            content: Text content to store
            type: Memory type (TOOL_OUTPUT, WEB_SCRAPE, FILE_LIST, etc.)
            subtype: Optional subtype (e.g., tool name)
            title: Optional title/description
            tags: Optional tags for categorization
            mime: MIME type (default: text/plain)
        
        Returns:
            MemoryRef with metadata
        """
        try:
            # Encode content
            content_bytes = content.encode('utf-8')
            original_size = len(content_bytes)
            
            # Compress with zstd
            compressor = zstd.ZstdCompressor(level=COMPRESSION_LEVEL)
            compressed_bytes = compressor.compress(content_bytes)
            compressed_size = len(compressed_bytes)
            
            # Compute hash of compressed data
            sha256_hash = self._compute_sha256(compressed_bytes)
            
            # Write to CAS
            cas_path = self._get_cas_path(sha256_hash)
            with open(cas_path, 'wb') as f:
                f.write(compressed_bytes)
            
            # Store metadata in DB
            memory_id = sha256_hash
            created_at = datetime.now(timezone.utc).isoformat()
            rel_path = str(cas_path.relative_to(self.base_dir))
            
            conn = sqlite3.connect(str(self.db_path))
            cursor = conn.cursor()
            
            cursor.execute("""
                INSERT OR REPLACE INTO memories 
                (memory_id, type, subtype, mime, bytes, compression, path, sha256, title, tags, created_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, (
                memory_id,
                type,
                subtype,
                mime,
                compressed_size,
                'zstd',
                rel_path,
                sha256_hash,
                title,
                json.dumps(tags) if tags else None,
                created_at
            ))
            
            conn.commit()
            conn.close()
            
            # Log operations
            self._log_operation(
                f"Stored {type}/{subtype or 'none'}: memory_id={memory_id}, "
                f"original={original_size:,} bytes, compressed={compressed_size:,} bytes"
            )
            self._log_compression(original_size, compressed_size, memory_id)
            
            # Return memory reference
            return MemoryRef(
                memory_id=memory_id,
                type=type,
                subtype=subtype,
                mime=mime,
                bytes=compressed_size,
                compression='zstd',
                path=rel_path,
                sha256=sha256_hash,
                title=title,
                tags=tags,
                created_at=created_at
            )
        
        except Exception as e:
            self._log_operation(f"Failed to store content: {e}", level="ERROR")
            logger.error(f"Failed to store content in memory: {e}", exc_info=True)
            raise
    
    def get_full(self, memory_id: str) -> Optional[str]:
        """
        Retrieve full content by memory_id.
        
        Args:
            memory_id: Memory identifier (SHA-256 hash)
        
        Returns:
            Full decompressed content as string, or None if not found
        """
        try:
            # Get metadata from DB
            conn = sqlite3.connect(str(self.db_path))
            cursor = conn.cursor()
            
            cursor.execute("""
                SELECT path, compression FROM memories WHERE memory_id = ?
            """, (memory_id,))
            
            row = cursor.fetchone()
            conn.close()
            
            if not row:
                self._log_operation(f"Memory not found: {memory_id}", level="WARNING")
                return None
            
            path, compression = row
            full_path = self.base_dir / path
            
            # Read compressed data
            with open(full_path, 'rb') as f:
                compressed_data = f.read()
            
            # Decompress
            if compression == 'zstd':
                decompressor = zstd.ZstdDecompressor()
                decompressed_data = decompressor.decompress(compressed_data)
                content = decompressed_data.decode('utf-8', errors='ignore')
            else:
                content = compressed_data.decode('utf-8', errors='ignore')
            
            self._log_operation(f"Retrieved full content: memory_id={memory_id}, size={len(content)} chars")
            return content
        
        except Exception as e:
            self._log_operation(f"Failed to retrieve {memory_id}: {e}", level="ERROR")
            logger.error(f"Failed to retrieve memory {memory_id}: {e}", exc_info=True)
            return None
    
    def get_slice(
        self,
        memory_id: str,
        line_start: int = 1,
        line_end: int = 200
    ) -> Optional[str]:
        """
        Retrieve a line-based slice of content.
        
        Args:
            memory_id: Memory identifier
            line_start: Starting line number (1-indexed)
            line_end: Ending line number (inclusive)
        
        Returns:
            Sliced content as string, or None if not found
        """
        try:
            # Get full content
            content = self.get_full(memory_id)
            if content is None:
                return None
            
            # Split into lines
            lines = content.splitlines()
            
            # Validate ranges
            line_start = max(1, line_start)
            line_end = min(len(lines), line_end)
            
            if line_start > len(lines):
                return ""
            
            # Extract slice (convert to 0-indexed)
            sliced_lines = lines[line_start - 1:line_end]
            sliced_content = '\n'.join(sliced_lines)
            
            self._log_operation(
                f"Retrieved slice: memory_id={memory_id}, "
                f"lines {line_start}-{line_end}, size={len(sliced_content)} chars"
            )
            
            return sliced_content
        
        except Exception as e:
            self._log_operation(f"Failed to slice {memory_id}: {e}", level="ERROR")
            logger.error(f"Failed to slice memory {memory_id}: {e}", exc_info=True)
            return None
    
    def get_bytes(
        self,
        memory_id: str,
        offset: int = 0,
        length: int = 4096
    ) -> Optional[str]:
        """
        Retrieve a byte-range slice of content.
        
        Args:
            memory_id: Memory identifier
            offset: Byte offset (0-indexed)
            length: Number of bytes to retrieve
        
        Returns:
            Sliced content as string, or None if not found
        """
        try:
            # Get full content
            content = self.get_full(memory_id)
            if content is None:
                return None
            
            # Validate ranges
            offset = max(0, offset)
            length = max(0, length)
            
            # Extract byte slice
            sliced_content = content[offset:offset + length]
            
            self._log_operation(
                f"Retrieved byte range: memory_id={memory_id}, "
                f"offset={offset}, length={length}, size={len(sliced_content)} chars"
            )
            
            return sliced_content
        
        except Exception as e:
            self._log_operation(f"Failed to get byte range {memory_id}: {e}", level="ERROR")
            logger.error(f"Failed to get byte range for memory {memory_id}: {e}", exc_info=True)
            return None
    
    def get_metadata(self, memory_id: str) -> Optional[MemoryRef]:
        """
        Retrieve metadata for a memory entry.
        
        Args:
            memory_id: Memory identifier
        
        Returns:
            MemoryRef with metadata, or None if not found
        """
        try:
            conn = sqlite3.connect(str(self.db_path))
            cursor = conn.cursor()
            
            cursor.execute("""
                SELECT memory_id, type, subtype, mime, bytes, compression, 
                       path, sha256, title, tags, created_at
                FROM memories WHERE memory_id = ?
            """, (memory_id,))
            
            row = cursor.fetchone()
            conn.close()
            
            if not row:
                return None
            
            # Parse tags
            tags = json.loads(row[9]) if row[9] else None
            
            return MemoryRef(
                memory_id=row[0],
                type=row[1],
                subtype=row[2],
                mime=row[3],
                bytes=row[4],
                compression=row[5],
                path=row[6],
                sha256=row[7],
                title=row[8],
                tags=tags,
                created_at=row[10]
            )
        
        except Exception as e:
            logger.error(f"Failed to get metadata for {memory_id}: {e}", exc_info=True)
            return None
    
    def list_memories(
        self,
        type: Optional[str] = None,
        limit: int = 100
    ) -> List[MemoryRef]:
        """
        List stored memories with optional filtering.
        
        Args:
            type: Optional type filter
            limit: Maximum number of results
        
        Returns:
            List of MemoryRef objects
        """
        try:
            conn = sqlite3.connect(str(self.db_path))
            cursor = conn.cursor()
            
            if type:
                cursor.execute("""
                    SELECT memory_id, type, subtype, mime, bytes, compression,
                           path, sha256, title, tags, created_at
                    FROM memories 
                    WHERE type = ?
                    ORDER BY created_at DESC
                    LIMIT ?
                """, (type, limit))
            else:
                cursor.execute("""
                    SELECT memory_id, type, subtype, mime, bytes, compression,
                           path, sha256, title, tags, created_at
                    FROM memories 
                    ORDER BY created_at DESC
                    LIMIT ?
                """, (limit,))
            
            rows = cursor.fetchall()
            conn.close()
            
            memories = []
            for row in rows:
                tags = json.loads(row[9]) if row[9] else None
                memories.append(MemoryRef(
                    memory_id=row[0],
                    type=row[1],
                    subtype=row[2],
                    mime=row[3],
                    bytes=row[4],
                    compression=row[5],
                    path=row[6],
                    sha256=row[7],
                    title=row[8],
                    tags=tags,
                    created_at=row[10]
                ))
            
            return memories
        
        except Exception as e:
            logger.error(f"Failed to list memories: {e}", exc_info=True)
            return []
    
    def delete_memory(self, memory_id: str) -> bool:
        """
        Delete a memory entry and its associated file.
        
        Args:
            memory_id: Memory identifier
        
        Returns:
            True if successful, False otherwise
        """
        try:
            # Get metadata
            conn = sqlite3.connect(str(self.db_path))
            cursor = conn.cursor()
            
            cursor.execute("SELECT path FROM memories WHERE memory_id = ?", (memory_id,))
            row = cursor.fetchone()
            
            if not row:
                conn.close()
                return False
            
            path = row[0]
            
            # Delete from DB
            cursor.execute("DELETE FROM memories WHERE memory_id = ?", (memory_id,))
            conn.commit()
            conn.close()
            
            # Delete file
            full_path = self.base_dir / path
            if full_path.exists():
                full_path.unlink()
            
            self._log_operation(f"Deleted memory: {memory_id}")
            return True
        
        except Exception as e:
            self._log_operation(f"Failed to delete {memory_id}: {e}", level="ERROR")
            logger.error(f"Failed to delete memory {memory_id}: {e}", exc_info=True)
            return False


# Global instance
_memory_store: Optional[MemoryStoreLocal] = None


def get_memory_store() -> MemoryStoreLocal:
    """Get or create the global memory store instance."""
    global _memory_store
    if _memory_store is None:
        _memory_store = MemoryStoreLocal()
    return _memory_store
