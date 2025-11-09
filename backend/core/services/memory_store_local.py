"""
Local Content-Addressed Storage (CAS) for memory offloading.

Stores large tool outputs and other content in compressed form,
replacing them with pointers in message history to reduce token usage.
"""

import os
import hashlib
import json
import sqlite3
from pathlib import Path
from typing import Optional, Dict, Any, List, Tuple
from datetime import datetime, timezone
import zstandard as zstd
from core.utils.logger import logger

# Compression level for zstd (level 6 for good balance)
ZSTD_LEVEL = 6

# Maximum inline content size (6000 chars ≈ 1500 tokens)
MAX_INLINE_SIZE = 6000


class MemoryStoreLocal:
    """Local CAS-based memory store for offloading large content."""
    
    def __init__(self, base_path: str = "/workspace/.aga_mem"):
        """Initialize the memory store.
        
        Args:
            base_path: Base directory for memory storage
        """
        self.base_path = Path(base_path)
        self.warm_path = self.base_path / "warm"
        self.hot_path = self.base_path / "hot"
        self.manifests_path = self.base_path / "manifests"
        self.logs_path = self.base_path / "logs"
        self.db_path = self.base_path / "meta.sqlite"
        
        # Create directory structure
        self._ensure_directories()
        
        # Initialize SQLite database
        self._init_database()
        
        # Initialize zstd compressor/decompressor
        self.compressor = zstd.ZstdCompressor(level=ZSTD_LEVEL)
        self.decompressor = zstd.ZstdDecompressor()
    
    def _ensure_directories(self):
        """Create all necessary directories."""
        for path in [self.warm_path, self.hot_path, self.manifests_path, self.logs_path]:
            path.mkdir(parents=True, exist_ok=True)
    
    def _init_database(self):
        """Initialize SQLite database with schema."""
        conn = sqlite3.connect(str(self.db_path))
        cursor = conn.cursor()
        
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS memories(
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
    
    def _compute_sha256(self, data: bytes) -> str:
        """Compute SHA256 hash of data."""
        return hashlib.sha256(data).hexdigest()
    
    def _get_cas_path(self, sha256: str) -> Path:
        """Get CAS path for a given SHA256 hash."""
        return self.warm_path / sha256[:2] / f"{sha256}.zst"
    
    def _log_operation(self, operation: str, details: Dict[str, Any]):
        """Log an operation to ops.log."""
        log_file = self.logs_path / "ops.log"
        timestamp = datetime.now(timezone.utc).isoformat()
        log_entry = {
            "timestamp": timestamp,
            "operation": operation,
            **details
        }
        
        with open(log_file, "a", encoding="utf-8") as f:
            f.write(json.dumps(log_entry) + "\n")
    
    def _log_compression(self, original_bytes: int, compressed_bytes: int, memory_id: str):
        """Log compression statistics."""
        log_file = self.logs_path / "compression_report.log"
        timestamp = datetime.now(timezone.utc).isoformat()
        
        ratio = (1 - compressed_bytes / original_bytes) * 100 if original_bytes > 0 else 0
        saved = original_bytes - compressed_bytes
        
        log_entry = {
            "timestamp": timestamp,
            "memory_id": memory_id,
            "original_bytes": original_bytes,
            "compressed_bytes": compressed_bytes,
            "saved_bytes": saved,
            "compression_ratio": f"{ratio:.2f}%"
        }
        
        with open(log_file, "a", encoding="utf-8") as f:
            f.write(json.dumps(log_entry) + "\n")
    
    def put_text(
        self,
        content: str,
        memory_type: str = "TOOL_OUTPUT",
        subtype: Optional[str] = None,
        title: Optional[str] = None,
        tags: Optional[List[str]] = None,
        mime: str = "text/plain"
    ) -> Dict[str, Any]:
        """Store text content in CAS and return memory reference.
        
        Args:
            content: Text content to store
            memory_type: Type of memory (TOOL_OUTPUT, WEB_SCRAPE, FILE_LIST, etc.)
            subtype: Optional subtype (tool name, etc.)
            title: Optional title for the memory
            tags: Optional list of tags
            mime: MIME type (default: text/plain)
            
        Returns:
            Dict with memory_id, mime, path, and other metadata
        """
        # Encode to UTF-8 bytes
        original_bytes = content.encode("utf-8")
        
        # Compress with zstd
        compressed = self.compressor.compress(original_bytes)
        compressed_bytes = len(compressed)
        
        # Compute SHA256 of compressed content
        sha256 = self._compute_sha256(compressed)
        memory_id = sha256  # Use SHA256 as memory_id
        
        # Get CAS path
        cas_path = self._get_cas_path(sha256)
        cas_path.parent.mkdir(parents=True, exist_ok=True)
        
        # Write compressed content
        with open(cas_path, "wb") as f:
            f.write(compressed)
        
        # Store metadata in SQLite
        conn = sqlite3.connect(str(self.db_path))
        cursor = conn.cursor()
        
        tags_json = json.dumps(tags) if tags else None
        created_at = datetime.now(timezone.utc).isoformat()
        
        cursor.execute("""
            INSERT OR REPLACE INTO memories
            (memory_id, type, subtype, mime, bytes, compression, path, sha256, title, tags, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            memory_id,
            memory_type,
            subtype,
            mime,
            compressed_bytes,
            "zstd",
            str(cas_path.relative_to(self.base_path)),
            sha256,
            title,
            tags_json,
            created_at
        ))
        
        conn.commit()
        conn.close()
        
        # Log operation
        self._log_operation("put_text", {
            "memory_id": memory_id,
            "type": memory_type,
            "subtype": subtype,
            "original_bytes": len(original_bytes),
            "compressed_bytes": compressed_bytes
        })
        
        # Log compression stats
        self._log_compression(len(original_bytes), compressed_bytes, memory_id)
        
        return {
            "memory_id": memory_id,
            "mime": mime,
            "path": str(cas_path.relative_to(self.base_path)),
            "bytes": compressed_bytes,
            "original_bytes": len(original_bytes),
            "compression": "zstd",
            "title": title,
            "type": memory_type,
            "subtype": subtype
        }
    
    def get_slice(
        self,
        memory_id: str,
        line_start: int = 1,
        line_end: int = 200
    ) -> str:
        """Retrieve a slice of text content by line numbers.
        
        Args:
            memory_id: Memory ID (SHA256)
            line_start: Starting line number (1-indexed)
            line_end: Ending line number (inclusive)
            
        Returns:
            Text content for the specified line range
        """
        # Get memory metadata
        conn = sqlite3.connect(str(self.db_path))
        cursor = conn.cursor()
        
        cursor.execute("SELECT path, compression FROM memories WHERE memory_id = ?", (memory_id,))
        row = cursor.fetchone()
        conn.close()
        
        if not row:
            raise ValueError(f"Memory {memory_id} not found")
        
        rel_path, compression = row
        cas_path = self.base_path / rel_path
        
        if not cas_path.exists():
            raise ValueError(f"Memory file not found: {cas_path}")
        
        # Read and decompress
        with open(cas_path, "rb") as f:
            compressed_data = f.read()
        
        if compression == "zstd":
            decompressed = self.decompressor.decompress(compressed_data)
        else:
            decompressed = compressed_data
        
        # Decode to text
        try:
            text = decompressed.decode("utf-8")
        except UnicodeDecodeError:
            # Fallback: ignore errors
            text = decompressed.decode("utf-8", errors="ignore")
        
        # Extract line range
        lines = text.splitlines()
        
        # Adjust for 1-indexed line numbers
        start_idx = max(0, line_start - 1)
        end_idx = min(len(lines), line_end)
        
        if start_idx >= len(lines):
            return ""
        
        return "\n".join(lines[start_idx:end_idx])
    
    def get_bytes(
        self,
        memory_id: str,
        offset: int = 0,
        length: Optional[int] = None
    ) -> bytes:
        """Retrieve a byte range from memory.
        
        Args:
            memory_id: Memory ID (SHA256)
            offset: Byte offset to start from
            length: Number of bytes to read (None = to end)
            
        Returns:
            Byte content for the specified range
        """
        # Get memory metadata
        conn = sqlite3.connect(str(self.db_path))
        cursor = conn.cursor()
        
        cursor.execute("SELECT path, compression FROM memories WHERE memory_id = ?", (memory_id,))
        row = cursor.fetchone()
        conn.close()
        
        if not row:
            raise ValueError(f"Memory {memory_id} not found")
        
        rel_path, compression = row
        cas_path = self.base_path / rel_path
        
        if not cas_path.exists():
            raise ValueError(f"Memory file not found: {cas_path}")
        
        # Read and decompress
        with open(cas_path, "rb") as f:
            compressed_data = f.read()
        
        if compression == "zstd":
            decompressed = self.decompressor.decompress(compressed_data)
        else:
            decompressed = compressed_data
        
        # Extract byte range
        end = offset + length if length is not None else len(decompressed)
        return decompressed[offset:end]
    
    def get_metadata(self, memory_id: str) -> Optional[Dict[str, Any]]:
        """Get metadata for a memory.
        
        Args:
            memory_id: Memory ID (SHA256)
            
        Returns:
            Metadata dict or None if not found
        """
        conn = sqlite3.connect(str(self.db_path))
        cursor = conn.cursor()
        
        cursor.execute("""
            SELECT memory_id, type, subtype, mime, bytes, compression, path, sha256, title, tags, created_at
            FROM memories WHERE memory_id = ?
        """, (memory_id,))
        
        row = cursor.fetchone()
        conn.close()
        
        if not row:
            return None
        
        return {
            "memory_id": row[0],
            "type": row[1],
            "subtype": row[2],
            "mime": row[3],
            "bytes": row[4],
            "compression": row[5],
            "path": row[6],
            "sha256": row[7],
            "title": row[8],
            "tags": json.loads(row[9]) if row[9] else [],
            "created_at": row[10]
        }
    
    def list_memories(
        self,
        memory_type: Optional[str] = None,
        limit: int = 100
    ) -> List[Dict[str, Any]]:
        """List memories, optionally filtered by type.
        
        Args:
            memory_type: Optional type filter
            limit: Maximum number of results
            
        Returns:
            List of memory metadata dicts
        """
        conn = sqlite3.connect(str(self.db_path))
        cursor = conn.cursor()
        
        if memory_type:
            cursor.execute("""
                SELECT memory_id, type, subtype, mime, bytes, title, created_at
                FROM memories WHERE type = ?
                ORDER BY created_at DESC
                LIMIT ?
            """, (memory_type, limit))
        else:
            cursor.execute("""
                SELECT memory_id, type, subtype, mime, bytes, title, created_at
                FROM memories
                ORDER BY created_at DESC
                LIMIT ?
            """, (limit,))
        
        rows = cursor.fetchall()
        conn.close()
        
        return [
            {
                "memory_id": row[0],
                "type": row[1],
                "subtype": row[2],
                "mime": row[3],
                "bytes": row[4],
                "title": row[5],
                "created_at": row[6]
            }
            for row in rows
        ]


# Global singleton instance
_memory_store: Optional[MemoryStoreLocal] = None


def get_memory_store() -> MemoryStoreLocal:
    """Get or create the global memory store instance."""
    global _memory_store
    if _memory_store is None:
        _memory_store = MemoryStoreLocal()
    return _memory_store
