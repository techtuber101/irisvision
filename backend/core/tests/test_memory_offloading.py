"""
Unit tests for the aggressive memory offloading architecture.

Tests cover:
- Memory store local operations (roundtrip, slicing)
- Pointer message shape and metadata
- Context manager pointer mode
- Memory fetch tool with range limits
- Token governor policies
"""

import pytest
import asyncio
import json
import tempfile
import shutil
from pathlib import Path
from typing import Dict, Any

# Import modules to test
from core.services.memory_store_local import MemoryStoreLocal, get_memory_store
from core.agentpress.context_manager import ContextManager
from core.agentpress.thread_manager import ThreadManager
from core.tools.memory_fetch_tool import MemoryFetchTool


@pytest.fixture
def temp_memory_dir():
    """Create a temporary directory for memory storage."""
    temp_dir = Path(tempfile.mkdtemp())
    yield temp_dir
    shutil.rmtree(temp_dir)


@pytest.fixture
def memory_store(temp_memory_dir):
    """Create a MemoryStoreLocal instance with temp directory."""
    return MemoryStoreLocal(base_dir=temp_memory_dir)


@pytest.mark.asyncio
class TestMemoryStoreLocal:
    """Tests for MemoryStoreLocal operations."""
    
    def test_put_and_get_full(self, memory_store):
        """Test storing and retrieving full content."""
        content = "Line 1\nLine 2\nLine 3\n" + ("x" * 10000)
        
        # Store content
        mem_ref = memory_store.put_text(
            content=content,
            type="TOOL_OUTPUT",
            subtype="test_tool",
            title="Test content",
            tags=["test"]
        )
        
        assert mem_ref.memory_id is not None
        assert mem_ref.type == "TOOL_OUTPUT"
        assert mem_ref.subtype == "test_tool"
        assert mem_ref.compression == "zstd"
        assert mem_ref.bytes > 0
        assert mem_ref.bytes < len(content.encode('utf-8'))  # Compressed
        
        # Retrieve full content
        retrieved = memory_store.get_full(mem_ref.memory_id)
        assert retrieved == content
    
    def test_get_slice(self, memory_store):
        """Test retrieving line-based slices."""
        lines = [f"Line {i}" for i in range(1, 101)]
        content = "\n".join(lines)
        
        # Store content
        mem_ref = memory_store.put_text(content=content, type="FILE_LIST")
        
        # Get slice lines 10-40
        sliced = memory_store.get_slice(mem_ref.memory_id, line_start=10, line_end=40)
        sliced_lines = sliced.splitlines()
        
        assert len(sliced_lines) == 31  # lines 10-40 inclusive
        assert sliced_lines[0] == "Line 10"
        assert sliced_lines[-1] == "Line 40"
    
    def test_get_bytes(self, memory_store):
        """Test retrieving byte-range slices."""
        content = "0123456789" * 100  # 1000 chars
        
        # Store content
        mem_ref = memory_store.put_text(content=content, type="TOOL_OUTPUT")
        
        # Get byte range
        sliced = memory_store.get_bytes(mem_ref.memory_id, offset=100, length=200)
        
        assert len(sliced) == 200
        assert sliced == content[100:300]
    
    def test_compression_ratio(self, memory_store):
        """Test that compression achieves significant savings."""
        # Highly compressible content
        content = "AAAA" * 5000  # 20KB of repeated data
        
        mem_ref = memory_store.put_text(content=content, type="TOOL_OUTPUT")
        
        original_size = len(content.encode('utf-8'))
        compressed_size = mem_ref.bytes
        
        # Should achieve >90% compression for repeated data
        ratio = 1 - (compressed_size / original_size)
        assert ratio > 0.9, f"Compression ratio {ratio:.2%} is too low"
    
    def test_metadata_retrieval(self, memory_store):
        """Test retrieving metadata without full content."""
        content = "x" * 10000
        
        mem_ref = memory_store.put_text(
            content=content,
            type="WEB_SCRAPE",
            subtype="html",
            title="Test page",
            tags=["web", "html"]
        )
        
        # Get metadata only
        meta = memory_store.get_metadata(mem_ref.memory_id)
        
        assert meta is not None
        assert meta.type == "WEB_SCRAPE"
        assert meta.subtype == "html"
        assert meta.title == "Test page"
        assert "web" in meta.tags
        assert "html" in meta.tags
    
    def test_list_memories(self, memory_store):
        """Test listing stored memories."""
        # Store multiple memories
        for i in range(5):
            memory_store.put_text(
                content=f"Content {i}",
                type="TOOL_OUTPUT",
                subtype=f"tool_{i}",
                title=f"Memory {i}"
            )
        
        # List all
        memories = memory_store.list_memories(limit=10)
        assert len(memories) == 5
        
        # List by type
        tool_memories = memory_store.list_memories(type="TOOL_OUTPUT", limit=10)
        assert len(tool_memories) == 5


@pytest.mark.asyncio
class TestPointerProtocol:
    """Tests for pointer message shape and metadata."""
    
    @pytest.mark.asyncio
    async def test_offload_large_content(self, temp_memory_dir):
        """Test that large content is auto-offloaded with correct metadata."""
        # Create a ThreadManager instance
        from core.services.memory_store_local import BASE_DIR
        import core.services.memory_store_local as msl
        
        # Temporarily override BASE_DIR
        original_base_dir = msl.BASE_DIR
        msl.BASE_DIR = temp_memory_dir
        
        try:
            # Create large content (>6000 chars)
            large_content = "x" * 10000
            
            # Mock ThreadManager._offload_large_content
            thread_manager = ThreadManager()
            
            modified_content, modified_metadata = await thread_manager._offload_large_content(
                content=large_content,
                type="tool",
                metadata=None
            )
            
            # Check that content was truncated
            assert len(str(modified_content)) < len(large_content)
            assert "[Large content offloaded" in str(modified_content) or "[See memory_refs]" in str(modified_content)
            
            # Check that metadata has memory_refs
            assert modified_metadata is not None
            assert "memory_refs" in modified_metadata
            assert len(modified_metadata["memory_refs"]) == 1
            
            mem_ref = modified_metadata["memory_refs"][0]
            assert "id" in mem_ref
            assert "title" in mem_ref
            assert "mime" in mem_ref
            
            # Check tokens_saved estimation
            assert "tokens_saved" in modified_metadata
            assert modified_metadata["tokens_saved"] > 0
        
        finally:
            # Restore original BASE_DIR
            msl.BASE_DIR = original_base_dir


@pytest.mark.asyncio
class TestContextManagerPointerMode:
    """Tests for ContextManager pointer_mode."""
    
    @pytest.mark.asyncio
    async def test_pointer_mode_preserves_memory_refs(self):
        """Test that pointer_mode preserves memory_refs without hydration."""
        context_manager = ContextManager()
        
        # Create messages with memory_refs
        messages = [
            {
                "role": "user",
                "content": "Do something",
                "metadata": {}
            },
            {
                "role": "assistant",
                "content": "Short summary. [See memory_refs]",
                "metadata": {
                    "memory_refs": [
                        {
                            "id": "abc123",
                            "title": "Large output",
                            "mime": "text/plain"
                        }
                    ],
                    "tokens_saved": 5000
                }
            }
        ]
        
        # Compress with pointer_mode=True
        compressed, report = await context_manager.compress_messages(
            messages=messages,
            llm_model="gpt-4",
            pointer_mode=True,
            return_report=True
        )
        
        # Find the message with memory_refs
        mem_ref_msg = None
        for msg in compressed:
            if isinstance(msg, dict) and msg.get('metadata', {}).get('memory_refs'):
                mem_ref_msg = msg
                break
        
        # Verify memory_refs were preserved
        assert mem_ref_msg is not None, "Message with memory_refs not found"
        assert "memory_refs" in mem_ref_msg.get("metadata", {})
        assert len(mem_ref_msg["metadata"]["memory_refs"]) == 1
        assert mem_ref_msg["metadata"]["memory_refs"][0]["id"] == "abc123"


@pytest.mark.asyncio
class TestMemoryFetchTool:
    """Tests for memory_fetch tool."""
    
    @pytest.mark.asyncio
    async def test_memory_fetch_line_range(self, temp_memory_dir):
        """Test fetching with line ranges."""
        # Override BASE_DIR
        import core.services.memory_store_local as msl
        original_base_dir = msl.BASE_DIR
        msl.BASE_DIR = temp_memory_dir
        
        try:
            memory_store = MemoryStoreLocal(base_dir=temp_memory_dir)
            
            # Store content
            lines = [f"Line {i}" for i in range(1, 301)]
            content = "\n".join(lines)
            mem_ref = memory_store.put_text(content=content, type="TOOL_OUTPUT", title="Test")
            
            # Create tool and fetch
            tool = MemoryFetchTool()
            result = await tool.memory_fetch(
                memory_id=mem_ref.memory_id,
                line_start=50,
                line_end=100
            )
            
            assert result.success is True
            assert "Line 50" in result.output
            assert "Line 100" in result.output
            assert "Line 49" not in result.output
            assert "Line 101" not in result.output
        
        finally:
            msl.BASE_DIR = original_base_dir
    
    @pytest.mark.asyncio
    async def test_memory_fetch_refuses_large_ranges(self, temp_memory_dir):
        """Test that memory_fetch refuses excessively large ranges."""
        import core.services.memory_store_local as msl
        original_base_dir = msl.BASE_DIR
        msl.BASE_DIR = temp_memory_dir
        
        try:
            memory_store = MemoryStoreLocal(base_dir=temp_memory_dir)
            
            content = "x" * 100000
            mem_ref = memory_store.put_text(content=content, type="TOOL_OUTPUT")
            
            tool = MemoryFetchTool()
            
            # Try to fetch >2000 lines
            result = await tool.memory_fetch(
                memory_id=mem_ref.memory_id,
                line_start=1,
                line_end=3000
            )
            
            assert result.success is False
            assert "exceeds maximum" in result.output
        
        finally:
            msl.BASE_DIR = original_base_dir
    
    @pytest.mark.asyncio
    async def test_memory_fetch_byte_range_limit(self, temp_memory_dir):
        """Test that byte ranges are limited to 64KB."""
        import core.services.memory_store_local as msl
        original_base_dir = msl.BASE_DIR
        msl.BASE_DIR = temp_memory_dir
        
        try:
            memory_store = MemoryStoreLocal(base_dir=temp_memory_dir)
            
            content = "x" * 200000
            mem_ref = memory_store.put_text(content=content, type="TOOL_OUTPUT")
            
            tool = MemoryFetchTool()
            
            # Try to fetch >64KB
            result = await tool.memory_fetch(
                memory_id=mem_ref.memory_id,
                byte_offset=0,
                byte_length=100000  # >64KB
            )
            
            assert result.success is False
            assert "exceeds maximum" in result.output
        
        finally:
            msl.BASE_DIR = original_base_dir


@pytest.mark.asyncio
class TestTokenGovernor:
    """Tests for token governor policies."""
    
    @pytest.mark.asyncio
    async def test_token_governor_tier_1(self):
        """Test that token governor warns at 20k tokens."""
        thread_manager = ThreadManager()
        
        # Create messages that sum to ~25k tokens (rough estimation: 4 chars = 1 token)
        large_content = "x" * 100000  # ~25k tokens
        messages = [
            {"role": "user", "content": large_content}
        ]
        
        result = await thread_manager._apply_token_governor(
            messages=messages,
            llm_model="gpt-4"
        )
        
        # Should have added a warning message
        assert len(result) > len(messages)
        assert any("TOKEN EFFICIENCY WARNING" in str(msg.get("content", "")) for msg in result)
    
    @pytest.mark.asyncio
    async def test_token_governor_tier_2(self):
        """Test that token governor enforces pointer-only mode at 40k tokens."""
        thread_manager = ThreadManager()
        
        # Create messages that sum to ~50k tokens
        large_content = "x" * 200000  # ~50k tokens
        messages = [
            {"role": "user", "content": large_content}
        ]
        
        result = await thread_manager._apply_token_governor(
            messages=messages,
            llm_model="gpt-4"
        )
        
        # Should have added a strict warning message
        assert len(result) > len(messages)
        assert any("TOKEN LIMIT WARNING" in str(msg.get("content", "")) for msg in result)
        assert any("DO NOT attempt to expand" in str(msg.get("content", "")) for msg in result)


# Run tests
if __name__ == "__main__":
    pytest.main([__file__, "-v", "-s"])
