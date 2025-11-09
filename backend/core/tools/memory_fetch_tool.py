"""
Memory fetch tool for on-demand retrieval of offloaded content.

Allows the agent to fetch precise slices of large content stored in CAS,
enabling efficient access without loading entire blobs into context.
"""

from core.agentpress.tool import Tool, ToolResult, openapi_schema, tool_metadata
from core.services.memory_store_local import get_memory_store
from typing import Optional

# Maximum allowed slice sizes (guardrails)
MAX_LINES = 2000
MAX_BYTES = 64 * 1024  # 64KB


@tool_metadata(
    display_name="Memory Fetch",
    description="Fetch specific slices of offloaded content from memory storage",
    icon="Database",
    color="bg-blue-100 dark:bg-blue-800/50",
    weight=50,
    visible=False
)
class MemoryFetchTool(Tool):
    """Tool for fetching slices of offloaded memory content."""
    
    def __init__(self):
        super().__init__()
        self.memory_store = get_memory_store()
    
    @openapi_schema({
        "type": "function",
        "function": {
            "name": "memory_fetch",
            "description": (
                "Fetch a specific slice of content from offloaded memory. "
                "Use this to retrieve precise portions of large tool outputs, web scrapes, "
                "file listings, or other offloaded content. "
                "CRITICAL: Always use tight line/byte ranges. Never request full memories. "
                "For text content, use line_start and line_end. For binary, use byte_offset and byte_len."
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "memory_id": {
                        "type": "string",
                        "description": "The memory ID (SHA256 hash) of the offloaded content to fetch"
                    },
                    "line_start": {
                        "type": "integer",
                        "description": "Starting line number for text content (1-indexed). Use this for text memories.",
                        "default": 1
                    },
                    "line_end": {
                        "type": "integer",
                        "description": "Ending line number for text content (inclusive). Maximum 2000 lines per request.",
                        "default": 200
                    },
                    "byte_offset": {
                        "type": "integer",
                        "description": "Byte offset for binary content. Use this for binary memories or when line-based access isn't suitable.",
                        "default": None
                    },
                    "byte_len": {
                        "type": "integer",
                        "description": "Number of bytes to read. Maximum 64KB per request.",
                        "default": None
                    }
                },
                "required": ["memory_id"]
            }
        }
    })
    async def memory_fetch(
        self,
        memory_id: str,
        line_start: int = 1,
        line_end: int = 200,
        byte_offset: Optional[int] = None,
        byte_len: Optional[int] = None
    ) -> ToolResult:
        """Fetch a slice of offloaded memory content.
        
        Args:
            memory_id: Memory ID (SHA256) of the content to fetch
            line_start: Starting line number (1-indexed, for text)
            line_end: Ending line number (inclusive, for text)
            byte_offset: Byte offset (for binary content)
            byte_len: Number of bytes to read (for binary content)
            
        Returns:
            ToolResult with the fetched content slice
        """
        try:
            # Validate memory_id format (should be SHA256 = 64 hex chars)
            if not memory_id or len(memory_id) != 64 or not all(c in '0123456789abcdef' for c in memory_id.lower()):
                return self.fail_response(f"Invalid memory_id format: {memory_id}. Expected 64-character SHA256 hash.")
            
            # Get metadata first
            metadata = self.memory_store.get_metadata(memory_id)
            if not metadata:
                return self.fail_response(f"Memory {memory_id} not found")
            
            # Enforce guardrails
            if line_end - line_start + 1 > MAX_LINES:
                return self.fail_response(
                    f"Requested range too large: {line_end - line_start + 1} lines. "
                    f"Maximum allowed: {MAX_LINES} lines. "
                    f"Please request a smaller range."
                )
            
            if byte_len and byte_len > MAX_BYTES:
                return self.fail_response(
                    f"Requested byte range too large: {byte_len} bytes. "
                    f"Maximum allowed: {MAX_BYTES} bytes. "
                    f"Please request a smaller range."
                )
            
            # Fetch content based on mode
            if byte_offset is not None or byte_len is not None:
                # Binary mode
                offset = byte_offset or 0
                length = byte_len
                content = self.memory_store.get_bytes(memory_id, offset, length)
                
                # Try to decode as text for display, but keep binary available
                try:
                    text_content = content.decode("utf-8")
                    is_text = True
                except UnicodeDecodeError:
                    text_content = f"[Binary content: {len(content)} bytes]"
                    is_text = False
                
                result = {
                    "memory_id": memory_id,
                    "type": metadata["type"],
                    "subtype": metadata.get("subtype"),
                    "title": metadata.get("title"),
                    "mime": metadata["mime"],
                    "byte_offset": offset,
                    "byte_len": len(content),
                    "content": text_content if is_text else f"[Binary: {len(content)} bytes]",
                    "is_binary": not is_text,
                    "total_bytes": metadata["bytes"]
                }
            else:
                # Text mode (line-based)
                content = self.memory_store.get_slice(memory_id, line_start, line_end)
                
                result = {
                    "memory_id": memory_id,
                    "type": metadata["type"],
                    "subtype": metadata.get("subtype"),
                    "title": metadata.get("title"),
                    "mime": metadata["mime"],
                    "line_start": line_start,
                    "line_end": line_end,
                    "content": content,
                    "total_lines": len(content.splitlines()) if content else 0
                }
            
            return self.success_response(result)
            
        except ValueError as e:
            return self.fail_response(str(e))
        except Exception as e:
            return self.fail_response(f"Error fetching memory: {str(e)}")
