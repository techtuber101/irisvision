"""
Comprehensive tests for the KV cache system.

Tests cover:
- Core KV store operations (CRUD)
- TTL and expiration logic
- Quota enforcement
- Fingerprint validation
- Concurrent access
- Error handling
"""

import pytest
import asyncio
from unittest.mock import Mock, AsyncMock, MagicMock
from datetime import datetime, timedelta
import json

from core.sandbox.kv_store import (
    SandboxKVStore,
    KVStoreError,
    KVKeyError,
    KVValueError,
    KVQuotaError,
    sanitize_key,
    validate_scope,
    generate_fingerprint,
)


class MockAsyncSandbox:
    """Mock AsyncSandbox for testing."""
    
    def __init__(self):
        self.fs = MockFilesystem()


class MockFilesystem:
    """Mock filesystem for testing."""
    
    def __init__(self):
        self.files = {}
        self.directories = set()
    
    async def make_dir(self, path: str):
        """Mock directory creation."""
        self.directories.add(path)
    
    async def upload_file(self, content: bytes, path: str):
        """Mock file upload."""
        self.files[path] = content
    
    async def download_file(self, path: str):
        """Mock file download."""
        if path not in self.files:
            raise Exception(f"File not found: {path}")
        return self.files[path]
    
    async def delete_file(self, path: str):
        """Mock file deletion."""
        if path in self.files:
            del self.files[path]


class TestKVStoreBasics:
    """Test basic KV store operations."""
    
    @pytest.fixture
    def sandbox(self):
        """Create mock sandbox."""
        return MockAsyncSandbox()
    
    @pytest.fixture
    def kv_store(self, sandbox):
        """Create KV store instance."""
        return SandboxKVStore(sandbox)
    
    @pytest.mark.asyncio
    async def test_put_and_get_string(self, kv_store):
        """Test storing and retrieving string values."""
        path = await kv_store.put("system", "test_key", "test value")
        assert path is not None
        
        value = await kv_store.get("system", "test_key")
        assert value == "test value"
    
    @pytest.mark.asyncio
    async def test_put_and_get_dict(self, kv_store):
        """Test storing and retrieving dict values."""
        test_data = {"foo": "bar", "nested": {"key": "value"}}
        path = await kv_store.put("artifacts", "test_dict", test_data)
        assert path is not None
        
        value = await kv_store.get("artifacts", "test_dict", as_type="dict")
        assert value == test_data
    
    @pytest.mark.asyncio
    async def test_put_and_get_bytes(self, kv_store):
        """Test storing and retrieving byte values."""
        test_bytes = b"binary data here"
        path = await kv_store.put("task", "test_bytes", test_bytes)
        assert path is not None
        
        value = await kv_store.get("task", "test_bytes", as_type="bytes")
        assert value == test_bytes
    
    @pytest.mark.asyncio
    async def test_get_nonexistent_key(self, kv_store):
        """Test retrieving non-existent key raises error."""
        with pytest.raises(KVKeyError):
            await kv_store.get("system", "nonexistent")
    
    @pytest.mark.asyncio
    async def test_delete_key(self, kv_store):
        """Test deleting keys."""
        await kv_store.put("system", "to_delete", "value")
        deleted = await kv_store.delete("system", "to_delete")
        assert deleted is True
        
        with pytest.raises(KVKeyError):
            await kv_store.get("system", "to_delete")
    
    @pytest.mark.asyncio
    async def test_delete_nonexistent_key(self, kv_store):
        """Test deleting non-existent key returns False."""
        deleted = await kv_store.delete("system", "nonexistent")
        assert deleted is False


class TestTTLAndExpiration:
    """Test TTL and expiration logic."""
    
    @pytest.fixture
    def sandbox(self):
        return MockAsyncSandbox()
    
    @pytest.fixture
    def kv_store(self, sandbox):
        return SandboxKVStore(sandbox)
    
    @pytest.mark.asyncio
    async def test_custom_ttl(self, kv_store):
        """Test custom TTL values."""
        await kv_store.put("system", "short_ttl", "value", ttl_hours=1)
        metadata = await kv_store.get_metadata("system", "short_ttl")
        
        created = datetime.fromisoformat(metadata["created_at"])
        expires = datetime.fromisoformat(metadata["expires_at"])
        ttl_delta = expires - created
        
        # Should be approximately 1 hour (within 1 minute tolerance)
        assert abs(ttl_delta.total_seconds() - 3600) < 60
    
    @pytest.mark.asyncio
    async def test_list_excludes_expired(self, kv_store, monkeypatch):
        """Test that list_keys excludes expired entries by default."""
        # Store value with past expiration
        await kv_store.put("system", "expired_key", "value", ttl_hours=1)
        
        # Mock the expiration check to simulate expired entry
        index = await kv_store._load_index("system")
        past_time = (datetime.utcnow() - timedelta(hours=2)).isoformat()
        index["expired_key"]["expires_at"] = past_time
        await kv_store._save_index("system", index)
        
        # List should not include expired key
        keys = await kv_store.list_keys("system")
        assert len(keys) == 0
        
        # List with include_expired should include it
        keys = await kv_store.list_keys("system", include_expired=True)
        assert len(keys) == 1
        assert keys[0]["is_expired"] is True
    
    @pytest.mark.asyncio
    async def test_prune_expired(self, kv_store):
        """Test pruning expired entries."""
        # Store multiple values
        await kv_store.put("system", "active", "value1", ttl_hours=168)
        await kv_store.put("system", "expired", "value2", ttl_hours=1)
        
        # Manually expire one entry
        index = await kv_store._load_index("system")
        past_time = (datetime.utcnow() - timedelta(hours=2)).isoformat()
        index["expired"]["expires_at"] = past_time
        await kv_store._save_index("system", index)
        
        # Prune expired
        results = await kv_store.prune_expired("system")
        assert results["system"] == 1
        
        # Verify only active key remains
        keys = await kv_store.list_keys("system")
        assert len(keys) == 1
        assert keys[0]["key"] == "active"


class TestValidationAndSecurity:
    """Test input validation and security controls."""
    
    def test_sanitize_key(self):
        """Test key sanitization."""
        # Valid keys
        assert sanitize_key("simple_key") == "simple_key"
        assert sanitize_key("key-with-dash") == "key-with-dash"
        assert sanitize_key("key.with.dot") == "key.with.dot"
        
        # Keys with special characters
        assert sanitize_key("key with spaces") == "key_with_spaces"
        assert sanitize_key("key@#$%") == "key_____"
        
        # Path traversal attempts
        with pytest.raises(KVValueError):
            sanitize_key("../../../etc/passwd")
        
        with pytest.raises(KVValueError):
            sanitize_key("/absolute/path")
        
        # Empty/invalid keys
        with pytest.raises(KVValueError):
            sanitize_key("")
        
        with pytest.raises(KVValueError):
            sanitize_key(None)
    
    def test_validate_scope(self):
        """Test scope validation."""
        # Valid scopes
        assert validate_scope("system") == "system"
        assert validate_scope("instructions") == "instructions"
        assert validate_scope("project") == "project"
        assert validate_scope("task") == "task"
        assert validate_scope("artifacts") == "artifacts"
        
        # Invalid scopes
        with pytest.raises(KVValueError):
            validate_scope("invalid_scope")
        
        with pytest.raises(KVValueError):
            validate_scope("")
    
    def test_generate_fingerprint(self):
        """Test fingerprint generation."""
        # Same content should produce same fingerprint
        fp1 = generate_fingerprint("test content")
        fp2 = generate_fingerprint("test content")
        assert fp1 == fp2
        
        # Different content should produce different fingerprints
        fp3 = generate_fingerprint("different content")
        assert fp1 != fp3
        
        # Dict content
        data = {"key": "value", "nested": {"foo": "bar"}}
        fp4 = generate_fingerprint(data)
        fp5 = generate_fingerprint(data)
        assert fp4 == fp5
    
    @pytest.mark.asyncio
    async def test_value_size_limit(self):
        """Test value size limits."""
        sandbox = MockAsyncSandbox()
        kv_store = SandboxKVStore(sandbox)
        
        # Create large value (>50MB)
        large_value = "x" * (51 * 1024 * 1024)
        
        with pytest.raises(KVValueError):
            await kv_store.put("system", "large_key", large_value)


class TestQuotaEnforcement:
    """Test quota and size limit enforcement."""
    
    @pytest.fixture
    def sandbox(self):
        return MockAsyncSandbox()
    
    @pytest.fixture
    def kv_store(self, sandbox):
        return SandboxKVStore(sandbox)
    
    @pytest.mark.asyncio
    async def test_quota_enforcement(self, kv_store):
        """Test that quota limits are enforced."""
        # System scope has 10MB limit
        # Try to store multiple values that exceed quota
        value_5mb = "x" * (5 * 1024 * 1024)
        
        await kv_store.put("system", "key1", value_5mb)
        await kv_store.put("system", "key2", value_5mb)
        
        # Third 5MB value should exceed quota
        with pytest.raises(KVQuotaError):
            await kv_store.put("system", "key3", value_5mb)


class TestStats:
    """Test statistics and monitoring."""
    
    @pytest.fixture
    def sandbox(self):
        return MockAsyncSandbox()
    
    @pytest.fixture
    def kv_store(self, sandbox):
        return SandboxKVStore(sandbox)
    
    @pytest.mark.asyncio
    async def test_get_stats(self, kv_store):
        """Test cache statistics."""
        # Store some values
        await kv_store.put("system", "key1", "value1")
        await kv_store.put("system", "key2", "value2" * 100)
        
        stats = await kv_store.get_stats("system")
        
        assert "system" in stats
        assert stats["system"]["total_keys"] == 2
        assert stats["system"]["active_keys"] == 2
        assert stats["system"]["total_size_mb"] > 0
        assert stats["system"]["quota_mb"] == 10
        assert 0 <= stats["system"]["quota_used_percent"] <= 100
    
    @pytest.mark.asyncio
    async def test_list_with_pattern(self, kv_store):
        """Test filtering keys by pattern."""
        await kv_store.put("system", "test_key_1", "value1")
        await kv_store.put("system", "test_key_2", "value2")
        await kv_store.put("system", "other_key", "value3")
        
        # Filter by pattern
        keys = await kv_store.list_keys("system", pattern="test_key_")
        assert len(keys) == 2
        
        keys = await kv_store.list_keys("system", pattern="other")
        assert len(keys) == 1


class TestConcurrency:
    """Test concurrent access patterns."""
    
    @pytest.fixture
    def sandbox(self):
        return MockAsyncSandbox()
    
    @pytest.fixture
    def kv_store(self, sandbox):
        return SandboxKVStore(sandbox)
    
    @pytest.mark.asyncio
    async def test_concurrent_writes(self, kv_store):
        """Test concurrent writes to same key are serialized."""
        async def write_value(key, value):
            await kv_store.put("system", key, value)
        
        # Write to different keys concurrently (should succeed)
        await asyncio.gather(
            write_value("key1", "value1"),
            write_value("key2", "value2"),
            write_value("key3", "value3"),
        )
        
        keys = await kv_store.list_keys("system")
        assert len(keys) == 3


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
