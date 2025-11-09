"""
Tests for local memory store and pointer protocol.
"""

import pytest
import tempfile
import shutil
from pathlib import Path
from core.services.memory_store_local import MemoryStoreLocal, MAX_INLINE_SIZE


@pytest.fixture
def temp_memory_store():
    """Create a temporary memory store for testing."""
    temp_dir = tempfile.mkdtemp()
    store = MemoryStoreLocal(base_path=temp_dir)
    yield store
    shutil.rmtree(temp_dir)


def test_memory_store_roundtrip(temp_memory_store):
    """Test storing and retrieving text content."""
    # Store text
    test_content = "Line 1\nLine 2\nLine 3\n" * 100  # 400 lines
    memory_ref = temp_memory_store.put_text(
        content=test_content,
        memory_type="TOOL_OUTPUT",
        subtype="test_tool",
        title="Test Output"
    )
    
    assert memory_ref["memory_id"] is not None
    assert memory_ref["type"] == "TOOL_OUTPUT"
    assert memory_ref["compression"] == "zstd"
    
    # Retrieve full content
    retrieved = temp_memory_store.get_slice(memory_ref["memory_id"], 1, 400)
    assert retrieved == test_content
    
    # Retrieve slice
    slice_content = temp_memory_store.get_slice(memory_ref["memory_id"], 10, 40)
    lines = test_content.splitlines()
    expected = "\n".join(lines[9:40])  # 0-indexed, so 9-39
    assert slice_content == expected


def test_pointer_message_shape(temp_memory_store):
    """Test that offloaded content creates proper pointer message shape."""
    # Large content that should be offloaded
    large_content = "X" * (MAX_INLINE_SIZE + 1000)
    
    memory_ref = temp_memory_store.put_text(
        content=large_content,
        memory_type="TOOL_OUTPUT",
        title="Large Output"
    )
    
    # Check memory_ref structure
    assert "memory_id" in memory_ref
    assert "mime" in memory_ref
    assert "path" in memory_ref
    assert memory_ref["memory_id"] is not None
    
    # Verify it's stored
    metadata = temp_memory_store.get_metadata(memory_ref["memory_id"])
    assert metadata is not None
    assert metadata["type"] == "TOOL_OUTPUT"


def test_memory_fetch_range_limits(temp_memory_store):
    """Test that memory_fetch enforces range limits."""
    # Create test content
    test_content = "Line\n" * 5000  # 5000 lines
    memory_ref = temp_memory_store.put_text(
        content=test_content,
        memory_type="FILE_LIST"
    )
    
    # Small range should work
    small_slice = temp_memory_store.get_slice(memory_ref["memory_id"], 1, 200)
    assert len(small_slice.splitlines()) <= 200
    
    # Large range should still work (no hard limit in store, but tool enforces it)
    # The tool will enforce MAX_LINES = 2000
    large_slice = temp_memory_store.get_slice(memory_ref["memory_id"], 1, 3000)
    assert len(large_slice.splitlines()) == 3000  # Store allows it, tool will reject


def test_compression_stats(temp_memory_store):
    """Test that compression statistics are logged."""
    # Create compressible content (repetitive)
    repetitive_content = "This is a test line. " * 1000
    
    memory_ref = temp_memory_store.put_text(
        content=repetitive_content,
        memory_type="TOOL_OUTPUT"
    )
    
    # Check that compressed size is smaller than original
    original_bytes = len(repetitive_content.encode("utf-8"))
    compressed_bytes = memory_ref["bytes"]
    
    assert compressed_bytes < original_bytes
    assert memory_ref["compression"] == "zstd"


def test_list_memories(temp_memory_store):
    """Test listing memories by type."""
    # Create multiple memories
    temp_memory_store.put_text("Content 1", memory_type="TOOL_OUTPUT", title="Output 1")
    temp_memory_store.put_text("Content 2", memory_type="WEB_SCRAPE", title="Scrape 1")
    temp_memory_store.put_text("Content 3", memory_type="TOOL_OUTPUT", title="Output 2")
    
    # List all
    all_memories = temp_memory_store.list_memories()
    assert len(all_memories) >= 3
    
    # List by type
    tool_outputs = temp_memory_store.list_memories(memory_type="TOOL_OUTPUT")
    assert len(tool_outputs) >= 2
    assert all(m["type"] == "TOOL_OUTPUT" for m in tool_outputs)
