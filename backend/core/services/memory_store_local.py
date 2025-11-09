import hashlib
import json
import os
import sqlite3
import threading
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, Iterable, Optional

import zstandard

DEFAULT_BASE_DIR = Path("/workspace/.aga_mem")
WARM_DIRNAME = "warm"
HOT_DIRNAME = "hot"
MANIFESTS_DIRNAME = "manifests"
LOGS_DIRNAME = "logs"
OPS_LOG_NAME = "ops.log"
COMPRESSION_LOG_NAME = "compression_report.log"
SQLITE_FILENAME = "meta.sqlite"


def _ensure_directory(path: Path) -> None:
    path.mkdir(parents=True, exist_ok=True)


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


class MemoryStoreLocal:
    """Local CAS-backed memory store for Daytona sandboxes."""

    _instance: Optional["MemoryStoreLocal"] = None
    _instance_lock = threading.Lock()

    def __init__(self, base_dir: Path = DEFAULT_BASE_DIR):
        self.base_dir = base_dir
        self.warm_dir = self.base_dir / WARM_DIRNAME
        self.logs_dir = self.base_dir / LOGS_DIRNAME
        self.meta_path = self.base_dir / SQLITE_FILENAME
        self.ops_log_path = self.logs_dir / OPS_LOG_NAME
        self.compression_log_path = self.logs_dir / COMPRESSION_LOG_NAME

        self._dir_lock = threading.Lock()
        self._db_lock = threading.Lock()

        self._prepare_directories()
        self._conn = sqlite3.connect(self.meta_path, check_same_thread=False)
        self._conn.execute("PRAGMA journal_mode=WAL;")
        self._conn.execute("PRAGMA synchronous=NORMAL;")
        self._initialize_schema()

    @classmethod
    def get(cls) -> "MemoryStoreLocal":
        with cls._instance_lock:
            if cls._instance is None:
                cls._instance = cls()
            return cls._instance

    def _prepare_directories(self) -> None:
        _ensure_directory(self.base_dir)
        for dirname in (WARM_DIRNAME, HOT_DIRNAME, MANIFESTS_DIRNAME, LOGS_DIRNAME):
            _ensure_directory(self.base_dir / dirname)
        # Ensure log files exist
        self.ops_log_path.touch(exist_ok=True)
        self.compression_log_path.touch(exist_ok=True)

    def _initialize_schema(self) -> None:
        with self._conn:
            self._conn.execute(
                """
                create table if not exists memories(
                  memory_id  text primary key,
                  type       text not null,
                  subtype    text,
                  mime       text not null default 'text/plain',
                  bytes      integer not null,
                  compression text,
                  path       text not null,
                  sha256     text not null,
                  title      text,
                  tags       text,
                  created_at text not null
                );
                """
            )
            self._conn.execute(
                "create index if not exists idx_memories_type on memories(type, created_at);"
            )

    # Logging helpers -----------------------------------------------------------------

    def _append_log(self, path: Path, payload: Dict[str, Any]) -> None:
        payload["timestamp"] = _now_iso()
        line = json.dumps(payload, ensure_ascii=True)
        with self._dir_lock:
            with path.open("a", encoding="utf-8") as fp:
                fp.write(line + "\n")

    def _log_ops(self, event: str, **kwargs: Any) -> None:
        payload = {"event": event, **kwargs}
        self._append_log(self.ops_log_path, payload)

    def _log_compression(self, **kwargs: Any) -> None:
        self._append_log(self.compression_log_path, kwargs)

    # Metadata helpers ----------------------------------------------------------------

    def _normalize_tags(self, tags: Optional[Iterable[str]]) -> Optional[str]:
        if tags is None:
            return None
        clean = [t for t in tags if t is not None]
        return json.dumps(clean, ensure_ascii=True)

    def _store_row(
        self,
        memory_id: str,
        *,
        type: str,
        subtype: Optional[str],
        mime: str,
        byte_count: int,
        compression: Optional[str],
        path: str,
        sha256: str,
        title: Optional[str],
        tags: Optional[Iterable[str]],
    ) -> None:
        tags_json = self._normalize_tags(tags)
        created_at = _now_iso()
        with self._db_lock, self._conn:
            self._conn.execute(
                """
                insert or replace into memories(
                    memory_id, type, subtype, mime, bytes, compression, path, sha256, title, tags, created_at
                ) values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
                """,
                (
                    memory_id,
                    type,
                    subtype,
                    mime,
                    byte_count,
                    compression,
                    path,
                    sha256,
                    title,
                    tags_json,
                    created_at,
                ),
            )

    def _read_row(self, memory_id: str) -> Optional[Dict[str, Any]]:
        cursor = self._conn.cursor()
        try:
            row = cursor.execute(
                "select memory_id, type, subtype, mime, bytes, compression, path, sha256, title, tags, created_at "
                "from memories where memory_id = ?;",
                (memory_id,),
            ).fetchone()
        finally:
            cursor.close()
        if not row:
            return None
        keys = [
            "memory_id",
            "type",
            "subtype",
            "mime",
            "bytes",
            "compression",
            "path",
            "sha256",
            "title",
            "tags",
            "created_at",
        ]
        record = dict(zip(keys, row))
        if record.get("tags"):
            try:
                record["tags"] = json.loads(record["tags"])
            except json.JSONDecodeError:
                record["tags"] = []
        else:
            record["tags"] = []
        return record

    # Core API ------------------------------------------------------------------------

    def put_text(
        self,
        content: str,
        *,
        type: str,
        subtype: Optional[str] = None,
        mime: str = "text/plain",
        title: Optional[str] = None,
        tags: Optional[Iterable[str]] = None,
        compression_level: int = 6,
    ) -> Dict[str, Any]:
        if not isinstance(content, str):
            raise TypeError("content must be a string")

        raw_bytes = content.encode("utf-8")
        compressor = zstandard.ZstdCompressor(level=compression_level)
        compressed = compressor.compress(raw_bytes)
        sha256_hex = hashlib.sha256(compressed).hexdigest()

        rel_dir = Path(WARM_DIRNAME) / sha256_hex[:2]
        rel_path = rel_dir / f"{sha256_hex}.zst"
        abs_dir = self.base_dir / rel_dir
        abs_path = self.base_dir / rel_path

        _ensure_directory(abs_dir)

        if not abs_path.exists():
            tmp_path = abs_path.with_suffix(".tmp")
            with tmp_path.open("wb") as fp:
                fp.write(compressed)
            os.replace(tmp_path, abs_path)

        self._store_row(
            sha256_hex,
            type=type,
            subtype=subtype,
            mime=mime,
            byte_count=len(raw_bytes),
            compression="zstd",
            path=str(rel_path),
            sha256=sha256_hex,
            title=title,
            tags=tags,
        )

        bytes_saved = len(raw_bytes) - len(compressed)
        self._log_compression(
            memory_id=sha256_hex,
            original_bytes=len(raw_bytes),
            compressed_bytes=len(compressed),
            bytes_saved=bytes_saved,
            ratio=round(len(compressed) / max(len(raw_bytes), 1), 5),
        )
        self._log_ops(
            "put_text",
            memory_id=sha256_hex,
            type=type,
            subtype=subtype,
            mime=mime,
            bytes=len(raw_bytes),
            path=str(rel_path),
            title=title,
            tags=list(tags or []),
        )

        return {
            "memory_id": sha256_hex,
            "mime": mime,
            "path": str(rel_path),
            "compression": "zstd",
            "bytes": len(raw_bytes),
            "title": title,
        }

    def put_bytes(
        self,
        data: bytes,
        *,
        type: str,
        subtype: Optional[str] = None,
        mime: str = "application/octet-stream",
        title: Optional[str] = None,
        tags: Optional[Iterable[str]] = None,
        compress: bool = False,
        compression_level: int = 6,
    ) -> Dict[str, Any]:
        if not isinstance(data, (bytes, bytearray)):
            raise TypeError("data must be bytes-like")

        raw_bytes = bytes(data)
        if compress:
            compressor = zstandard.ZstdCompressor(level=compression_level)
            payload = compressor.compress(raw_bytes)
            compression = "zstd"
        else:
            payload = raw_bytes
            compression = None

        sha256_hex = hashlib.sha256(payload).hexdigest()

        rel_dir = Path(WARM_DIRNAME) / sha256_hex[:2]
        rel_path = rel_dir / (f"{sha256_hex}.zst" if compression == "zstd" else sha256_hex)
        abs_dir = self.base_dir / rel_dir
        abs_path = self.base_dir / rel_path
        _ensure_directory(abs_dir)

        if not abs_path.exists():
            tmp_path = abs_path.with_suffix(".tmp")
            with tmp_path.open("wb") as fp:
                fp.write(payload)
            os.replace(tmp_path, abs_path)

        self._store_row(
            sha256_hex,
            type=type,
            subtype=subtype,
            mime=mime,
            byte_count=len(raw_bytes),
            compression=compression,
            path=str(rel_path),
            sha256=sha256_hex,
            title=title,
            tags=tags,
        )

        if compression == "zstd":
            bytes_saved = len(raw_bytes) - len(payload)
            self._log_compression(
                memory_id=sha256_hex,
                original_bytes=len(raw_bytes),
                compressed_bytes=len(payload),
                bytes_saved=bytes_saved,
                ratio=round(len(payload) / max(len(raw_bytes), 1), 5),
            )

        self._log_ops(
            "put_bytes",
            memory_id=sha256_hex,
            type=type,
            subtype=subtype,
            mime=mime,
            bytes=len(raw_bytes),
            path=str(rel_path),
            title=title,
            tags=list(tags or []),
            compression=compression,
        )

        return {
            "memory_id": sha256_hex,
            "mime": mime,
            "path": str(rel_path),
            "compression": compression,
            "bytes": len(raw_bytes),
            "title": title,
        }

    # Retrieval -----------------------------------------------------------------------

    def _load_payload(self, record: Dict[str, Any]) -> bytes:
        rel_path = record["path"]
        abs_path = self.base_dir / rel_path
        if not abs_path.exists():
            raise FileNotFoundError(f"Memory payload missing: {abs_path}")
        with abs_path.open("rb") as fp:
            payload = fp.read()
        if record.get("compression") == "zstd":
            decompressor = zstandard.ZstdDecompressor()
            payload = decompressor.decompress(payload)
        return payload

    def get_slice(self, memory_id: str, line_start: int, line_end: int) -> str:
        if line_start < 1 or line_end < line_start:
            raise ValueError("Invalid line range")

        record = self._read_row(memory_id)
        if not record:
            raise KeyError(f"memory_id {memory_id} not found")

        if not record["mime"].startswith("text/"):
            raise ValueError(f"Cannot return line slice for non-text mime: {record['mime']}")

        payload = self._load_payload(record)
        text = payload.decode("utf-8", errors="strict")
        lines = text.splitlines()
        start_idx = min(line_start - 1, len(lines))
        end_idx = min(line_end, len(lines))
        selected = lines[start_idx:end_idx]
        return "\n".join(selected)

    def get_bytes(self, memory_id: str, offset: int, length: int) -> bytes:
        if offset < 0 or length <= 0:
            raise ValueError("offset must be >=0 and length > 0")

        record = self._read_row(memory_id)
        if not record:
            raise KeyError(f"memory_id {memory_id} not found")

        payload = self._load_payload(record)
        end = min(len(payload), offset + length)
        return payload[offset:end]

    def get_metadata(self, memory_id: str) -> Optional[Dict[str, Any]]:
        record = self._read_row(memory_id)
        if not record:
            return None
        return dict(record)

    def log_event(self, event: str, **payload: Any) -> None:
        self._log_ops(event, **payload)


def get_memory_store() -> MemoryStoreLocal:
    return MemoryStoreLocal.get()
