"""
Enterprise-grade Key-Value store for Iris Agent Context Caching.

This module provides a file-based KV cache that lives in the Daytona sandbox 
filesystem at /workspace/.iris/kv-cache/. It enables the agent to offload 
instructions, summaries, and intermediate artifacts from the context window,
dramatically reducing token usage while maintaining retrieval capabilities.

Architecture:
- Storage: /workspace/.iris/kv-cache/ with scoped subdirectories
- Persistence: Daytona's built-in snapshot system
- Access: Async filesystem operations via AsyncSandbox.fs
- Lifecycle: TTL-based expiration + manual eviction
- Security: Path sanitization + size limits + access controls

Scopes:
- system/: Core system instructions and schemas
- instructions/: Task-specific instruction files (presentations, research, etc.)
- project/: Project-level metadata and summaries
- task/: Task-specific intermediate data
- artifacts/: Generated outputs (search results, analysis, etc.)
"""

import asyncio
import hashlib
import json
import os
import re
from datetime import datetime, timedelta
from typing import Any, Dict, List, Optional, Tuple, Union
from pathlib import Path

from daytona_sdk import AsyncSandbox
from core.utils.logger import logger


# Constants
KV_CACHE_ROOT = "/workspace/.iris/kv-cache"
DEFAULT_TTL_HOURS = 24
MAX_KEY_LENGTH = 255
MAX_VALUE_SIZE_MB = 50
INDEX_FILENAME = "_index.json"

# TTL override (hours). Set via env KV_CACHE_TTL_OVERRIDE_HOURS; default 0 (no expiry).
_ttl_override_raw = os.getenv("KV_CACHE_TTL_OVERRIDE_HOURS", "0")
try:
    _ttl_override_val = int(_ttl_override_raw)
except ValueError:
    _ttl_override_val = 0
if _ttl_override_val < 0:
    KV_CACHE_TTL_OVERRIDE_HOURS: Optional[int] = None
else:
    KV_CACHE_TTL_OVERRIDE_HOURS = _ttl_override_val

# Scope configurations
SCOPE_CONFIG = {
    "system": {"ttl_hours": 168, "max_size_mb": 10},  # 1 week
    "instructions": {"ttl_hours": 168, "max_size_mb": 5},  # 1 week
    "project": {"ttl_hours": 72, "max_size_mb": 20},  # 3 days
    "task": {"ttl_hours": 24, "max_size_mb": 100},  # 1 day
    "artifacts": {"ttl_hours": 48, "max_size_mb": 200},  # 2 days
}


class KVStoreError(Exception):
    """Base exception for KV store operations."""
    pass


class KVKeyError(KVStoreError):
    """Raised when a key is not found."""
    pass


class KVValueError(KVStoreError):
    """Raised when a value is invalid."""
    pass


class KVQuotaError(KVStoreError):
    """Raised when quota/size limits are exceeded."""
    pass


def sanitize_key(key: str) -> str:
    """
    Sanitize a cache key to be filesystem-safe.
    
    Args:
        key: Raw cache key
        
    Returns:
        Sanitized key safe for filesystem use
        
    Raises:
        KVValueError: If key is invalid
    """
    if not key or not isinstance(key, str):
        raise KVValueError("Key must be a non-empty string")
    
    if len(key) > MAX_KEY_LENGTH:
        raise KVValueError(f"Key exceeds maximum length of {MAX_KEY_LENGTH}")
    
    # Remove dangerous characters
    sanitized = re.sub(r'[^\w\-\.]', '_', key)
    
    # Prevent directory traversal
    if '..' in sanitized or sanitized.startswith('/'):
        raise KVValueError("Key contains invalid path components")
    
    return sanitized


def validate_scope(scope: str) -> str:
    """
    Validate and normalize a cache scope.
    
    Args:
        scope: Scope name
        
    Returns:
        Validated scope name
        
    Raises:
        KVValueError: If scope is invalid
    """
    if scope not in SCOPE_CONFIG:
        raise KVValueError(f"Invalid scope '{scope}'. Must be one of: {list(SCOPE_CONFIG.keys())}")
    return scope


def generate_fingerprint(data: Union[str, bytes, dict]) -> str:
    """
    Generate a stable fingerprint for cache data.
    
    Args:
        data: Data to fingerprint
        
    Returns:
        SHA-256 hex digest (first 16 chars)
    """
    if isinstance(data, dict):
        data = json.dumps(data, sort_keys=True)
    if isinstance(data, str):
        data = data.encode('utf-8')
    return hashlib.sha256(data).hexdigest()[:16]


class SandboxKVStore:
    """
    File-based KV cache for agent context management.
    
    Provides persistent storage in the Daytona sandbox with automatic
    TTL management, quotas, and efficient retrieval.
    """
    
    def __init__(self, sandbox: AsyncSandbox):
        """
        Initialize KV store.
        
        Args:
            sandbox: AsyncSandbox instance for filesystem access
        """
        self.sandbox = sandbox
        self.root_path = KV_CACHE_ROOT
        self._locks: Dict[str, asyncio.Lock] = {}
        self._initialized = False
        self._initializing = False  # Prevent recursive initialization
    
    def _get_lock(self, key: str) -> asyncio.Lock:
        """Get or create a lock for a specific key."""
        if key not in self._locks:
            self._locks[key] = asyncio.Lock()
        return self._locks[key]
    
    def _scope_path(self, scope: str) -> str:
        """Get the directory path for a scope."""
        return f"{self.root_path}/{scope}"
    
    def _key_path(self, scope: str, key: str) -> str:
        """Get the full file path for a key."""
        sanitized_key = sanitize_key(key)
        return f"{self._scope_path(scope)}/{sanitized_key}"
    
    def _index_path(self, scope: str) -> str:
        """Get the path to the scope's index file."""
        return f"{self._scope_path(scope)}/{INDEX_FILENAME}"
    
    async def _ensure_initialized(self) -> None:
        """
        Ensure KV cache is initialized: create .iris folder and seed instructions.
        
        This runs automatically on first use and ensures the .iris folder
        is visible immediately and instructions are seeded.
        """
        if self._initialized or self._initializing:
            return
        
        self._initializing = True
        
        try:
            # Create root .iris/kv-cache directory
            try:
                await self.sandbox.fs.create_folder(self.root_path, "755")
                logger.info(f"✅ Created KV cache root directory: {self.root_path}")
            except Exception as e:
                # Directory might already exist
                logger.debug(f"KV cache root directory check: {e}")
            
            # Create all scope directories immediately (including artifacts!)
            for scope in SCOPE_CONFIG.keys():
                await self._ensure_scope_directory(scope)
                logger.debug(f"✅ Created/verified scope directory: {scope}")
            
            # Verify artifacts scope exists (critical for tool output caching)
            artifacts_path = self._scope_path("artifacts")
            try:
                # Try to list files to verify it exists
                await self.sandbox.fs.list_files(artifacts_path)
                logger.info(f"✅ Artifacts scope verified: {artifacts_path}")
            except Exception as e:
                logger.warning(f"⚠️  Artifacts scope verification failed: {e} - will be created on first use")
            
            # Seed instructions automatically
            # Pass self to prevent creating a new SandboxKVStore instance (which would cause recursion)
            try:
                from core.sandbox.instruction_seeder import InstructionSeeder
                seeder = InstructionSeeder(self.sandbox, kv_store=self)
                results = await seeder.seed_all_instructions(force_refresh=False)
                seeded_count = sum(1 for v in results.values() if v)
                logger.info(f"✅ Auto-seeded {seeded_count}/{len(results)} instructions into KV cache")
            except Exception as e:
                logger.warning(f"Failed to auto-seed instructions (non-critical): {e}")
            
            self._initialized = True
            logger.info(f"✅ KV cache initialized: {self.root_path} ready")
            
        except Exception as e:
            logger.error(f"Failed to initialize KV cache: {e}")
            # Don't block if initialization fails, but mark as attempted
            self._initialized = True
        finally:
            self._initializing = False
    
    async def _ensure_scope_directory(self, scope: str) -> None:
        """Ensure scope directory exists."""
        scope_path = self._scope_path(scope)
        try:
            await self.sandbox.fs.create_folder(scope_path, "755")
            logger.debug(f"Created KV cache scope directory: {scope_path}")
        except Exception as e:
            # Directory might already exist
            logger.debug(f"Scope directory creation result for {scope_path}: {e}")
    
    async def _load_index(self, scope: str) -> Dict[str, Any]:
        """
        Load the index file for a scope.
        
        Returns:
            Index dict mapping keys to metadata
        """
        index_path = self._index_path(scope)
        try:
            content = await self.sandbox.fs.download_file(index_path)
            return json.loads(content.decode('utf-8'))
        except Exception:
            # Index doesn't exist yet
            return {}
    
    async def _save_index(self, scope: str, index: Dict[str, Any]) -> None:
        """Save the index file for a scope."""
        index_path = self._index_path(scope)
        content = json.dumps(index, indent=2)
        await self.sandbox.fs.upload_file(content.encode('utf-8'), index_path)
    
    async def _check_quota(self, scope: str, value_size: int) -> None:
        """
        Check if adding a value would exceed scope quota.
        
        Raises:
            KVQuotaError: If quota would be exceeded
        """
        config = SCOPE_CONFIG[scope]
        max_bytes = config["max_size_mb"] * 1024 * 1024
        
        # Get current scope size
        index = await self._load_index(scope)
        current_size = sum(meta.get("size_bytes", 0) for meta in index.values())
        
        if current_size + value_size > max_bytes:
            raise KVQuotaError(
                f"Quota exceeded for scope '{scope}': "
                f"current={current_size / 1024 / 1024:.2f}MB, "
                f"adding={value_size / 1024 / 1024:.2f}MB, "
                f"max={config['max_size_mb']}MB"
            )
    
    async def put(
        self,
        scope: str,
        key: str,
        value: Union[str, bytes, dict],
        ttl_hours: Optional[int] = None,
        metadata: Optional[Dict[str, Any]] = None,
        content_type: str = "text/plain"
    ) -> str:
        """
        Store a value in the KV cache.
        
        Args:
            scope: Cache scope (system/instructions/project/task/artifacts)
            key: Unique key within scope
            value: Data to store (string, bytes, or dict)
            ttl_hours: Time-to-live in hours (uses scope default if None)
            metadata: Additional metadata to store
            content_type: MIME type of the content
            
        Returns:
            File path where value was stored
            
        Raises:
            KVValueError: If key or value is invalid
            KVQuotaError: If quota would be exceeded
        """
        # Validate inputs
        scope = validate_scope(scope)
        sanitized_key = sanitize_key(key)
        
        # Serialize value if needed
        if isinstance(value, dict):
            value_bytes = json.dumps(value, indent=2).encode('utf-8')
            content_type = "application/json"
        elif isinstance(value, str):
            value_bytes = value.encode('utf-8')
        elif isinstance(value, bytes):
            value_bytes = value
        else:
            raise KVValueError(f"Unsupported value type: {type(value)}")
        
        # Check size limits
        value_size = len(value_bytes)
        max_bytes = MAX_VALUE_SIZE_MB * 1024 * 1024
        if value_size > max_bytes:
            raise KVValueError(
                f"Value size ({value_size / 1024 / 1024:.2f}MB) exceeds "
                f"maximum allowed ({MAX_VALUE_SIZE_MB}MB)"
            )
        
        # Ensure KV cache is initialized (creates .iris folder and seeds instructions)
        await self._ensure_initialized()
        
        # Ensure scope directory exists
        await self._ensure_scope_directory(scope)
        
        # Check quota before writing
        await self._check_quota(scope, value_size)
        
        # Acquire lock for this key
        async with self._get_lock(f"{scope}:{sanitized_key}"):
            # Write value to file
            file_path = self._key_path(scope, key)
            await self.sandbox.fs.upload_file(value_bytes, file_path)
            
        # Update index
        index = await self._load_index(scope)
        default_ttl = ttl_hours if ttl_hours is not None else SCOPE_CONFIG[scope]["ttl_hours"]
        ttl_override = KV_CACHE_TTL_OVERRIDE_HOURS
        ttl = default_ttl
        if ttl_override is not None:
            ttl = ttl_override
        expiry = None
        if ttl and ttl > 0:
            expiry = datetime.utcnow() + timedelta(hours=ttl)
            
            index[sanitized_key] = {
                "original_key": key,
                "path": file_path,
                "content_type": content_type,
                "size_bytes": value_size,
                "fingerprint": generate_fingerprint(value_bytes),
                "created_at": datetime.utcnow().isoformat(),
                "expires_at": expiry.isoformat() if expiry else None,
                "ttl_hours": ttl,
                "metadata": metadata or {}
            }
            
            await self._save_index(scope, index)
            
            logger.info(
                f"KV cache PUT: scope={scope} key={key} size={value_size}B "
                f"ttl={ttl}h path={file_path}"
            )
            
            return file_path
    
    async def get(
        self,
        scope: str,
        key: str,
        as_type: str = "auto"
    ) -> Union[str, bytes, dict, None]:
        """
        Retrieve a value from the KV cache.
        
        Args:
            scope: Cache scope
            key: Cache key
            as_type: Return type ("auto", "str", "bytes", "dict")
            
        Returns:
            Cached value or None if not found/expired
            
        Raises:
            KVKeyError: If key not found
            KVValueError: If deserialization fails
        """
        # Ensure KV cache is initialized (creates .iris folder and seeds instructions)
        await self._ensure_initialized()
        
        scope = validate_scope(scope)
        sanitized_key = sanitize_key(key)
        
        # Check index
        index = await self._load_index(scope)
        if sanitized_key not in index:
            raise KVKeyError(f"Key '{key}' not found in scope '{scope}'")
        
        entry = index[sanitized_key]
        
        # Check expiration
        expiry_str = entry.get("expires_at")
        if expiry_str:
            expiry = datetime.fromisoformat(expiry_str)
            if datetime.utcnow() > expiry:
                logger.info(f"KV cache key expired: scope={scope} key={key}")
                await self.delete(scope, key)
                raise KVKeyError(f"Key '{key}' expired in scope '{scope}'")
        
        # Read file
        file_path = entry["path"]
        try:
            content_bytes = await self.sandbox.fs.download_file(file_path)
        except Exception as e:
            logger.error(f"Failed to read KV cache file {file_path}: {e}")
            raise KVKeyError(f"Failed to read key '{key}' from scope '{scope}'")
        
        # Verify fingerprint
        actual_fingerprint = generate_fingerprint(content_bytes)
        expected_fingerprint = entry.get("fingerprint", "")
        if actual_fingerprint != expected_fingerprint:
            logger.warning(
                f"KV cache fingerprint mismatch: scope={scope} key={key} "
                f"expected={expected_fingerprint} actual={actual_fingerprint}"
            )
        
        logger.info(
            f"KV cache GET: scope={scope} key={key} size={len(content_bytes)}B "
            f"age={(datetime.utcnow() - datetime.fromisoformat(entry['created_at'])).total_seconds() / 3600:.1f}h"
        )
        
        # Deserialize based on type
        if as_type == "bytes":
            return content_bytes
        elif as_type == "dict" or (as_type == "auto" and entry["content_type"] == "application/json"):
            try:
                return json.loads(content_bytes.decode('utf-8'))
            except Exception as e:
                raise KVValueError(f"Failed to parse JSON for key '{key}': {e}")
        else:  # str or auto with text content
            try:
                return content_bytes.decode('utf-8')
            except Exception:
                # Fallback to bytes if not valid UTF-8
                return content_bytes
    
    async def get_metadata(self, scope: str, key: str) -> Dict[str, Any]:
        """
        Get metadata for a cached key without reading the value.
        
        Args:
            scope: Cache scope
            key: Cache key
            
        Returns:
            Metadata dict
            
        Raises:
            KVKeyError: If key not found
        """
        # Ensure KV cache is initialized
        await self._ensure_initialized()
        
        scope = validate_scope(scope)
        sanitized_key = sanitize_key(key)
        
        index = await self._load_index(scope)
        if sanitized_key not in index:
            raise KVKeyError(f"Key '{key}' not found in scope '{scope}'")
        
        entry = index[sanitized_key].copy()
        entry["scope"] = scope
        entry["key"] = entry.get("original_key", key)
        return entry
    
    async def delete(self, scope: str, key: str) -> bool:
        """
        Delete a key from the cache.
        
        Args:
            scope: Cache scope
            key: Cache key
            
        Returns:
            True if key was deleted, False if not found
        """
        scope = validate_scope(scope)
        sanitized_key = sanitize_key(key)
        
        async with self._get_lock(f"{scope}:{sanitized_key}"):
            index = await self._load_index(scope)
            
            if sanitized_key not in index:
                return False
            
            entry = index[sanitized_key]
            file_path = entry["path"]
            
            # Delete file
            try:
                await self.sandbox.fs.delete_file(file_path)
            except Exception as e:
                logger.warning(f"Failed to delete KV cache file {file_path}: {e}")
            
            # Update index
            del index[sanitized_key]
            await self._save_index(scope, index)
            
            logger.info(f"KV cache DELETE: scope={scope} key={key}")
            
            return True
    
    async def list_keys(
        self,
        scope: Optional[str] = None,
        pattern: Optional[str] = None,
        include_expired: bool = False
    ) -> List[Dict[str, Any]]:
        """
        List keys across one or all scopes with optional regex filtering.
        """
        await self._ensure_initialized()
        
        scopes = [validate_scope(scope)] if scope else list(SCOPE_CONFIG.keys())
        results: List[Dict[str, Any]] = []
        now = datetime.utcnow()
        regex = re.compile(pattern) if pattern else None
        
        for scope_name in scopes:
            index = await self._load_index(scope_name)
            for sanitized_key, entry in index.items():
                expiry_str = entry.get("expires_at")
                expiry = datetime.fromisoformat(expiry_str) if expiry_str else None
                is_expired = expiry and now > expiry
                if not include_expired and is_expired:
                    continue
                if regex and not regex.search(entry["original_key"]):
                    continue

                results.append({
                    "key": entry["original_key"],
                    "sanitized_key": sanitized_key,
                    "scope": scope_name,
                    "path": entry["path"],
                    "content_type": entry["content_type"],
                    "size_bytes": entry["size_bytes"],
                    "created_at": entry["created_at"],
                    "updated_at": entry.get("updated_at"),
                    "expires_at": entry.get("expires_at"),
                    "ttl_hours": entry["ttl_hours"],
                    "is_expired": bool(is_expired),
                    "metadata": entry.get("metadata", {}),
                    "tags": entry.get("tags", []),
                })
        
        results.sort(key=lambda item: item.get("created_at") or "", reverse=True)
        return results
    
    async def prune_expired(self, scope: Optional[str] = None) -> Dict[str, int]:
        """
        Remove all expired keys.
        
        Args:
            scope: Specific scope to prune, or None for all scopes
            
        Returns:
            Dict mapping scope to number of keys pruned
        """
        scopes = [scope] if scope else list(SCOPE_CONFIG.keys())
        results = {}
        
        for s in scopes:
            try:
                validate_scope(s)
                keys = await self.list_keys(s, include_expired=True)
                pruned = 0
                
                for key_info in keys:
                    if key_info["is_expired"]:
                        await self.delete(s, key_info["key"])
                        pruned += 1
                
                results[s] = pruned
                if pruned > 0:
                    logger.info(f"KV cache pruned {pruned} expired keys from scope '{s}'")
            except Exception as e:
                logger.error(f"Error pruning scope '{s}': {e}")
                results[s] = -1
        
        return results
    
    async def get_stats(self, scope: Optional[str] = None) -> Dict[str, Any]:
        """
        Get statistics about cache usage.
        
        Args:
            scope: Specific scope, or None for all scopes
            
        Returns:
            Stats dict with counts, sizes, and quotas
        """
        scopes = [scope] if scope else list(SCOPE_CONFIG.keys())
        results = {}
        
        for s in scopes:
            try:
                validate_scope(s)
                keys = await self.list_keys(s, include_expired=True)
                
                total_size = sum(k["size_bytes"] for k in keys)
                expired_count = sum(1 for k in keys if k["is_expired"])
                config = SCOPE_CONFIG[s]
                
                results[s] = {
                    "total_keys": len(keys),
                    "active_keys": len(keys) - expired_count,
                    "expired_keys": expired_count,
                    "total_size_mb": total_size / 1024 / 1024,
                    "quota_mb": config["max_size_mb"],
                    "quota_used_percent": (total_size / (config["max_size_mb"] * 1024 * 1024)) * 100,
                    "default_ttl_hours": config["ttl_hours"]
                }
            except Exception as e:
                logger.error(f"Error getting stats for scope '{s}': {e}")
                results[s] = {"error": str(e)}
        
        return results
    
    async def clear_scope(self, scope: str) -> int:
        """
        Delete all keys in a scope.
        
        Args:
            scope: Scope to clear
            
        Returns:
            Number of keys deleted
        """
        scope = validate_scope(scope)
        keys = await self.list_keys(scope, include_expired=True)
        
        deleted = 0
        for key_info in keys:
            if await self.delete(scope, key_info["key"]):
                deleted += 1
        
        logger.info(f"KV cache cleared {deleted} keys from scope '{scope}'")
        return deleted
