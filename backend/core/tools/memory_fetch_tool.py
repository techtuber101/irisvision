"""
Memory Fetch Tool - On-demand retrieval of offloaded memory content.

This tool enables the agent to fetch precise slices of large content that has been
offloaded to local content-addressed storage (CAS). Never fetches full memories -
always uses tight line/byte ranges for efficiency.
"""

from typing import Optional
from core.agentpress.tool import Tool, ToolResult, openapi_schema
from core.services.memory_store_local import get_memory_store
from core.utils.logger import logger


# Maximum allowed ranges to prevent abuse
MAX_LINE_RANGE = 2000
MAX_BYTE_RANGE = 65536  # 64 KB


@openapi_schema({
    "type": "function",
    "function": {
        "name": "memory_fetch",
        "description": (
            "Fetch a precise slice of previously offloaded content from memory storage. "
            "IMPORTANT: Always use tight ranges (max 2000 lines or 64KB). "
            "Never request full memories - this tool is designed for on-demand, targeted retrieval. "
            "Use line-based slicing for text content (logs, code, documents) and byte-based "
            "slicing for binary or structured data."
        ),
        "parameters": {
            "type": "object",
            "properties": {
                "memory_id": {
                    "type": "string",
                    "description": (
                        "The memory identifier (SHA-256 hash) returned when content was offloaded. "
                        "This is typically found in message metadata as memory_refs[].id"
                    )
                },
                "line_start": {
                    "type": "integer",
                    "description": "Starting line number (1-indexed) for line-based slicing. Default: 1",
                    "default": 1
                },
                "line_end": {
                    "type": "integer",
                    "description": (
                        "Ending line number (inclusive) for line-based slicing. "
                        "Maximum range: 2000 lines. Default: 200"
                    ),
                    "default": 200
                },
                "byte_offset": {
                    "type": "integer",
                    "description": (
                        "Starting byte offset (0-indexed) for byte-based slicing. "
                        "If specified, byte-based slicing is used instead of line-based. "
                        "Optional - omit to use line-based slicing."
                    )
                },
                "byte_length": {
                    "type": "integer",
                    "description": (
                        "Number of bytes to retrieve for byte-based slicing. "
                        "Maximum: 64KB. Required if byte_offset is specified."
                    )
                }
            },
            "required": ["memory_id"]
        }
    }
})
class MemoryFetchTool(Tool):
    """Tool for fetching slices of offloaded memory content."""
    
    def __init__(self):
        """Initialize the memory fetch tool."""
        super().__init__()
        self.memory_store = get_memory_store()
    
    async def memory_fetch(
        self,
        memory_id: str,
        line_start: int = 1,
        line_end: int = 200,
        byte_offset: Optional[int] = None,
        byte_length: Optional[int] = None
    ) -> ToolResult:
        """
        Fetch a precise slice of offloaded content.
        
        Args:
            memory_id: Memory identifier (SHA-256 hash)
            line_start: Starting line number (1-indexed)
            line_end: Ending line number (inclusive)
            byte_offset: Optional byte offset for byte-based slicing
            byte_length: Optional byte length for byte-based slicing
        
        Returns:
            ToolResult with sliced content or error
        """
        try:
            # Validate memory_id
            if not memory_id or not isinstance(memory_id, str):
                return ToolResult(
                    success=False,
                    output="Invalid memory_id: must be a non-empty string"
                )
            
            # Get metadata to verify memory exists
            metadata = self.memory_store.get_metadata(memory_id)
            if not metadata:
                return ToolResult(
                    success=False,
                    output=f"Memory not found: {memory_id}. "
                           f"It may have been deleted or the ID is incorrect."
                )
            
            # Determine slicing mode
            if byte_offset is not None:
                # Byte-based slicing
                if byte_length is None:
                    return ToolResult(
                        success=False,
                        output="byte_length is required when byte_offset is specified"
                    )
                
                # Validate byte range
                if byte_offset < 0:
                    byte_offset = 0
                if byte_length > MAX_BYTE_RANGE:
                    return ToolResult(
                        success=False,
                        output=f"byte_length exceeds maximum allowed ({MAX_BYTE_RANGE} bytes). "
                               f"Use tighter ranges for efficiency."
                    )
                
                # Fetch byte range
                content = self.memory_store.get_bytes(
                    memory_id=memory_id,
                    offset=byte_offset,
                    length=byte_length
                )
                
                if content is None:
                    return ToolResult(
                        success=False,
                        output=f"Failed to retrieve byte range from memory {memory_id}"
                    )
                
                result_info = (
                    f"Retrieved byte range [offset={byte_offset}, length={byte_length}] "
                    f"from memory {memory_id} ({metadata.type}/{metadata.subtype or 'none'})\n\n"
                )
                
            else:
                # Line-based slicing
                line_range = line_end - line_start + 1
                if line_range > MAX_LINE_RANGE:
                    return ToolResult(
                        success=False,
                        output=f"Line range ({line_range}) exceeds maximum allowed ({MAX_LINE_RANGE}). "
                               f"Use tighter ranges for efficiency."
                    )
                
                # Fetch line slice
                content = self.memory_store.get_slice(
                    memory_id=memory_id,
                    line_start=line_start,
                    line_end=line_end
                )
                
                if content is None:
                    return ToolResult(
                        success=False,
                        output=f"Failed to retrieve line range from memory {memory_id}"
                    )
                
                result_info = (
                    f"Retrieved lines {line_start}-{line_end} "
                    f"from memory {memory_id} ({metadata.type}/{metadata.subtype or 'none'})\n"
                )
                
                if metadata.title:
                    result_info += f"Title: {metadata.title}\n"
                
                result_info += "\n"
            
            # Return the sliced content
            return ToolResult(
                success=True,
                output=result_info + content
            )
        
        except Exception as e:
            logger.error(f"Error in memory_fetch: {e}", exc_info=True)
            return ToolResult(
                success=False,
                output=f"Error fetching memory slice: {str(e)}"
            )
