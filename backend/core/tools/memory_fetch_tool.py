from __future__ import annotations

import base64
from typing import Optional, Dict, Any

from core.agentpress.tool import Tool, ToolResult, openapi_schema, tool_metadata
from core.agentpress.thread_manager import ThreadManager
from core.services.memory_store_local import get_memory_store
from core.utils.logger import logger


@tool_metadata(
    display_name="Memory Fetch",
    description="Retrieve precise slices from local CAS-backed memories without expanding full content.",
    icon="Database",
    color="bg-slate-100 dark:bg-slate-800/50",
    is_core=True,
    weight=15,
    visible=True,
)
class MemoryFetchTool(Tool):
    """Tool for retrieving precise text or byte ranges from the local memory store."""

    MAX_LINE_RANGE = 200
    MAX_BYTE_SLICE = 64 * 1024  # 64KB

    def __init__(self, thread_manager: ThreadManager):
        super().__init__()
        self.thread_manager = thread_manager
        self.memory_store = get_memory_store()

    @openapi_schema(
        {
            "type": "function",
            "function": {
                "name": "memory_fetch",
                "description": "Fetch a precise slice from a stored memory object using line or byte ranges. Always request the smallest range that answers the question.",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "memory_id": {
                            "type": "string",
                            "description": "Content-addressed identifier (sha256) of the stored memory blob.",
                        },
                        "line_start": {
                            "type": "integer",
                            "description": "1-indexed start line for text slices. Defaults to 1.",
                            "default": 1,
                            "minimum": 1,
                        },
                        "line_end": {
                            "type": "integer",
                            "description": "Inclusive end line for text slices. Maximum 200 lines per call.",
                            "default": 120,
                            "minimum": 1,
                        },
                        "byte_offset": {
                            "type": "integer",
                            "description": "Optional byte offset for binary slices. Mutually exclusive with line ranges.",
                            "minimum": 0,
                        },
                        "byte_len": {
                            "type": "integer",
                            "description": "Optional byte length for binary slices (<= 65536). Mutually exclusive with line ranges.",
                            "minimum": 1,
                        },
                    },
                    "required": ["memory_id"],
                },
            }
        }
    )
    async def memory_fetch(
        self,
        memory_id: str,
        line_start: int = 1,
        line_end: int = 120,
        byte_offset: Optional[int] = None,
        byte_len: Optional[int] = None,
    ) -> ToolResult:
        """Fetch a precise slice from stored CAS memory."""
        try:
            if not memory_id:
                return self.fail_response("memory_id is required.")

            using_bytes = byte_offset is not None or byte_len is not None
            if using_bytes:
                if byte_offset is None or byte_len is None:
                    return self.fail_response("Both byte_offset and byte_len are required for byte range requests.")
                if byte_len > self.MAX_BYTE_SLICE:
                    return self.fail_response(f"byte_len must be <= {self.MAX_BYTE_SLICE} bytes.")
                if line_start != 1 or line_end != 120:
                    logger.debug("Ignoring line range because byte range was provided.")
                payload = self.memory_store.get_bytes(memory_id, byte_offset, byte_len)
                pointer = self._pointer_uri(memory_id, byte_offset=byte_offset, byte_len=byte_len)
                encoded = base64.b64encode(payload).decode("ascii")
                preview = encoded[:512] + ("…[truncated]" if len(encoded) > 512 else "")
                output: Dict[str, Any] = {
                    "role": "tool",
                    "name": "memory_fetch",
                    "content": f"Base64 payload preview ({len(payload)} bytes):\n{preview}",
                    "memory_refs": [
                        {"id": memory_id, "title": f"bytes {byte_offset}-{byte_offset + len(payload)}", "mime": "application/octet-stream"}
                    ],
                    "pointer": pointer,
                    "byte_range": {"offset": byte_offset, "length": len(payload)},
                    "encoding": "base64",
                }
            else:
                if line_end < line_start:
                    return self.fail_response("line_end must be >= line_start.")
                if (line_end - line_start + 1) > self.MAX_LINE_RANGE:
                    return self.fail_response(f"Line range cannot exceed {self.MAX_LINE_RANGE} lines per call.")
                snippet = self.memory_store.get_slice(memory_id, line_start, line_end)
                pointer = self._pointer_uri(memory_id, line_start=line_start, line_end=line_end)
                output = {
                    "role": "tool",
                    "name": "memory_fetch",
                    "content": snippet,
                    "memory_refs": [
                        {"id": memory_id, "title": f"lines {line_start}-{line_end}", "mime": "text/plain"}
                    ],
                    "pointer": pointer,
                    "line_range": {"start": line_start, "end": line_end},
                }

            self.thread_manager.record_memory_fetch()
            self.memory_store.log_event("memory_fetch_tool", memory_id=memory_id, pointer=output.get("pointer"))
            return self.success_response(output)

        except ValueError as ve:
            return self.fail_response(f"Invalid request: {ve}")
        except KeyError:
            return self.fail_response(f"Memory {memory_id} not found.")
        except Exception as exc:
            logger.error(f"memory_fetch tool error: {exc}", exc_info=True)
            return self.fail_response(f"Failed to fetch memory slice: {exc}")

    def _pointer_uri(
        self,
        memory_id: str,
        line_start: Optional[int] = None,
        line_end: Optional[int] = None,
        byte_offset: Optional[int] = None,
        byte_len: Optional[int] = None,
    ) -> str:
        if line_start is not None and line_end is not None:
            return f"mem://{memory_id}#L{line_start}-{line_end}"
        if byte_offset is not None and byte_len is not None:
            return f"mem://{memory_id}?offset={byte_offset}&len={byte_len}"
        return f"mem://{memory_id}"
