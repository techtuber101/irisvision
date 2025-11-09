"""
Sandbox KV Cache Tool for Agent Context Management.

This tool exposes the KV cache to the agent, enabling retrieval-first
workflows where instructions, summaries, and data are stored in files
and fetched on demand rather than embedded in the prompt.

Usage Examples:
1. Store presentation instructions:
   put_instruction(tag="presentation", content="<instructions>")
   
2. Retrieve instructions before task:
   get_instruction(tag="presentation") -> returns file path + content

3. Cache search results:
   put_artifact(key="web_search_results", value={...}, ttl_hours=24)
   
4. List available instructions:
   list_instructions() -> returns all instruction files
"""

from typing import Optional, Dict, Any, List
from core.agentpress.tool import Tool, ToolResult, openapi_schema, tool_metadata
from core.sandbox.tool_base import SandboxToolsBase
from core.sandbox.kv_store import SandboxKVStore, KVStoreError, KVKeyError
from core.agentpress.thread_manager import ThreadManager
from core.utils.logger import logger


@tool_metadata(
    display_name="KV Cache",
    description="Store and retrieve instructions, summaries, and artifacts to reduce context window usage",
    icon="Database",
    color="bg-purple-100 dark:bg-purple-800/50",
    weight=50,  # High priority - should be one of first tools loaded
    visible=True
)
class SandboxKvCacheTool(SandboxToolsBase):
    """
    KV Cache tool for intelligent context management.
    
    Enables the agent to:
    - Store and retrieve instruction files (presentation, research, coding, etc.)
    - Cache intermediate results and summaries
    - Manage project-level metadata
    - Reduce prompt token count by 80%+
    """
    
    def __init__(self, project_id: str, thread_manager: ThreadManager):
        super().__init__(project_id, thread_manager)
        self._kv_store: Optional[SandboxKVStore] = None
    
    async def _get_kv_store(self) -> SandboxKVStore:
        """Get or create KV store instance."""
        if self._kv_store is None:
            await self._ensure_sandbox()
            self._kv_store = SandboxKVStore(self.sandbox)
        return self._kv_store
    
    @openapi_schema({
        "type": "function",
        "function": {
            "name": "put_instruction",
            "description": """Store an instruction file for a specific task type. Instructions are long-lived (1 week TTL) and should contain detailed guidance for how to perform specific tasks like creating presentations, conducting research, writing code, etc.

Use this to offload large instruction blocks from the prompt so they can be retrieved only when needed.""",
            "parameters": {
                "type": "object",
                "properties": {
                    "tag": {
                        "type": "string",
                        "description": "Instruction tag/category (e.g., 'presentation', 'research', 'coding', 'data_analysis')"
                    },
                    "content": {
                        "type": "string",
                        "description": "Full instruction text in Markdown or plain text format"
                    },
                    "metadata": {
                        "type": "object",
                        "description": "Optional metadata (tags, version, author, etc.)"
                    }
                },
                "required": ["tag", "content"]
            }
        }
    })
    async def put_instruction(
        self,
        tag: str,
        content: str,
        metadata: Optional[Dict[str, Any]] = None
    ) -> ToolResult:
        """Store an instruction file."""
        try:
            kv = await self._get_kv_store()
            key = f"instruction_{tag}"
            path = await kv.put(
                scope="instructions",
                key=key,
                value=content,
                ttl_hours=168,  # 1 week
                metadata=metadata or {},
                content_type="text/markdown"
            )
            
            return self.success_response({
                "success": True,
                "message": f"Instruction '{tag}' stored successfully",
                "path": path,
                "key": key,
                "scope": "instructions",
                "size_bytes": len(content.encode('utf-8'))
            })
        except KVStoreError as e:
            return self.fail_response(f"Failed to store instruction: {e}")
    
    @openapi_schema({
        "type": "function",
        "function": {
            "name": "get_instruction",
            "description": """Retrieve an instruction file by tag. Use this before performing specific tasks (presentations, research, etc.) to load the relevant instructions into context.

This is how you reduce context window usage - instructions stay in files until needed.""",
            "parameters": {
                "type": "object",
                "properties": {
                    "tag": {
                        "type": "string",
                        "description": "Instruction tag to retrieve (e.g., 'presentation', 'research')"
                    }
                },
                "required": ["tag"]
            }
        }
    })
    async def get_instruction(self, tag: str) -> ToolResult:
        """Retrieve an instruction file."""
        try:
            kv = await self._get_kv_store()
            key = f"instruction_{tag}"
            content = await kv.get(scope="instructions", key=key, as_type="str")
            metadata = await kv.get_metadata(scope="instructions", key=key)
            
            return self.success_response({
                "success": True,
                "tag": tag,
                "content": content,
                "path": metadata["path"],
                "created_at": metadata["created_at"],
                "expires_at": metadata["expires_at"],
                "size_bytes": metadata["size_bytes"],
                "metadata": metadata.get("metadata", {})
            })
        except KVKeyError:
            return self.fail_response(f"Instruction '{tag}' not found. Available instructions: {await self._list_instruction_tags()}")
        except KVStoreError as e:
            return self.fail_response(f"Failed to retrieve instruction: {e}")
    
    async def _list_instruction_tags(self) -> List[str]:
        """Helper to get list of available instruction tags."""
        try:
            kv = await self._get_kv_store()
            keys = await kv.list_keys(scope="instructions")
            return [k["key"].replace("instruction_", "") for k in keys if k["key"].startswith("instruction_")]
        except Exception:
            return []
    
    @openapi_schema({
        "type": "function",
        "function": {
            "name": "list_instructions",
            "description": "List all available instruction files. Use this to see what instructions are cached and available for retrieval.",
            "parameters": {
                "type": "object",
                "properties": {}
            }
        }
    })
    async def list_instructions(self) -> ToolResult:
        """List all instruction files."""
        try:
            kv = await self._get_kv_store()
            keys = await kv.list_keys(scope="instructions")
            
            instructions = []
            for key_info in keys:
                if key_info["key"].startswith("instruction_"):
                    tag = key_info["key"].replace("instruction_", "")
                    instructions.append({
                        "tag": tag,
                        "path": key_info["path"],
                        "size_bytes": key_info["size_bytes"],
                        "created_at": key_info["created_at"],
                        "expires_at": key_info["expires_at"],
                        "is_expired": key_info["is_expired"]
                    })
            
            return self.success_response({
                "success": True,
                "count": len(instructions),
                "instructions": instructions
            })
        except KVStoreError as e:
            return self.fail_response(f"Failed to list instructions: {e}")
    
    @openapi_schema({
        "type": "function",
        "function": {
            "name": "put_artifact",
            "description": """Store an artifact (search results, analysis output, intermediate data) in the cache. Artifacts have shorter TTLs (default 2 days) and can be larger than instructions.

Use this to cache expensive operations (web searches, data processing) so you don't need to repeat them.""",
            "parameters": {
                "type": "object",
                "properties": {
                    "key": {
                        "type": "string",
                        "description": "Unique key for the artifact"
                    },
                    "value": {
                        "description": "Artifact data (string, dict, or structured data)"
                    },
                    "ttl_hours": {
                        "type": "integer",
                        "description": "Time-to-live in hours (default: 48)"
                    },
                    "metadata": {
                        "type": "object",
                        "description": "Optional metadata"
                    }
                },
                "required": ["key", "value"]
            }
        }
    })
    async def put_artifact(
        self,
        key: str,
        value: Any,
        ttl_hours: Optional[int] = None,
        metadata: Optional[Dict[str, Any]] = None
    ) -> ToolResult:
        """Store an artifact."""
        try:
            kv = await self._get_kv_store()
            path = await kv.put(
                scope="artifacts",
                key=key,
                value=value,
                ttl_hours=ttl_hours,
                metadata=metadata or {}
            )
            
            return self.success_response({
                "success": True,
                "message": f"Artifact '{key}' stored successfully",
                "path": path,
                "key": key,
                "scope": "artifacts"
            })
        except KVStoreError as e:
            return self.fail_response(f"Failed to store artifact: {e}")
    
    @openapi_schema({
        "type": "function",
        "function": {
            "name": "get_artifact",
            "description": "Retrieve a cached artifact. Use this to recover results from previous expensive operations.",
            "parameters": {
                "type": "object",
                "properties": {
                    "key": {
                        "type": "string",
                        "description": "Artifact key"
                    }
                },
                "required": ["key"]
            }
        }
    })
    async def get_artifact(self, key: str) -> ToolResult:
        """Retrieve an artifact."""
        try:
            kv = await self._get_kv_store()
            value = await kv.get(scope="artifacts", key=key, as_type="auto")
            metadata = await kv.get_metadata(scope="artifacts", key=key)
            
            return self.success_response({
                "success": True,
                "key": key,
                "value": value,
                "path": metadata["path"],
                "created_at": metadata["created_at"],
                "expires_at": metadata["expires_at"],
                "size_bytes": metadata["size_bytes"]
            })
        except KVKeyError:
            return self.fail_response(f"Artifact '{key}' not found or expired")
        except KVStoreError as e:
            return self.fail_response(f"Failed to retrieve artifact: {e}")
    
    @openapi_schema({
        "type": "function",
        "function": {
            "name": "put_project_summary",
            "description": """Store a project-level summary or metadata. Use this to maintain context about the current project across sessions.

Examples: project goals, key decisions, architecture notes, important file paths.""",
            "parameters": {
                "type": "object",
                "properties": {
                    "summary": {
                        "type": "string",
                        "description": "Project summary or context"
                    },
                    "metadata": {
                        "type": "object",
                        "description": "Additional project metadata"
                    }
                },
                "required": ["summary"]
            }
        }
    })
    async def put_project_summary(
        self,
        summary: str,
        metadata: Optional[Dict[str, Any]] = None
    ) -> ToolResult:
        """Store project summary."""
        try:
            kv = await self._get_kv_store()
            path = await kv.put(
                scope="project",
                key="summary",
                value=summary,
                ttl_hours=72,  # 3 days
                metadata=metadata or {},
                content_type="text/markdown"
            )
            
            return self.success_response({
                "success": True,
                "message": "Project summary stored successfully",
                "path": path
            })
        except KVStoreError as e:
            return self.fail_response(f"Failed to store project summary: {e}")
    
    @openapi_schema({
        "type": "function",
        "function": {
            "name": "get_project_summary",
            "description": "Retrieve the project summary. Use this at the start of a session to load project context.",
            "parameters": {
                "type": "object",
                "properties": {}
            }
        }
    })
    async def get_project_summary(self) -> ToolResult:
        """Retrieve project summary."""
        try:
            kv = await self._get_kv_store()
            summary = await kv.get(scope="project", key="summary", as_type="str")
            metadata = await kv.get_metadata(scope="project", key="summary")
            
            return self.success_response({
                "success": True,
                "summary": summary,
                "path": metadata["path"],
                "created_at": metadata["created_at"],
                "metadata": metadata.get("metadata", {})
            })
        except KVKeyError:
            return self.fail_response("No project summary found")
        except KVStoreError as e:
            return self.fail_response(f"Failed to retrieve project summary: {e}")
    
    @openapi_schema({
        "type": "function",
        "function": {
            "name": "get_cache_stats",
            "description": "Get statistics about cache usage (counts, sizes, quotas). Use this to monitor cache health.",
            "parameters": {
                "type": "object",
                "properties": {
                    "scope": {
                        "type": "string",
                        "enum": ["system", "instructions", "project", "task", "artifacts"],
                        "description": "Specific scope to query, or omit for all scopes"
                    }
                }
            }
        }
    })
    async def get_cache_stats(self, scope: Optional[str] = None) -> ToolResult:
        """Get cache statistics."""
        try:
            kv = await self._get_kv_store()
            stats = await kv.get_stats(scope=scope)
            
            return self.success_response({
                "success": True,
                "stats": stats
            })
        except KVStoreError as e:
            return self.fail_response(f"Failed to get cache stats: {e}")
    
    @openapi_schema({
        "type": "function",
        "function": {
            "name": "prune_cache",
            "description": "Remove expired entries from the cache. Run this periodically to free up space.",
            "parameters": {
                "type": "object",
                "properties": {
                    "scope": {
                        "type": "string",
                        "enum": ["system", "instructions", "project", "task", "artifacts"],
                        "description": "Specific scope to prune, or omit for all scopes"
                    }
                }
            }
        }
    })
    async def prune_cache(self, scope: Optional[str] = None) -> ToolResult:
        """Prune expired cache entries."""
        try:
            kv = await self._get_kv_store()
            results = await kv.prune_expired(scope=scope)
            
            total_pruned = sum(v for v in results.values() if v >= 0)
            
            return self.success_response({
                "success": True,
                "message": f"Pruned {total_pruned} expired entries",
                "results": results
            })
        except KVStoreError as e:
            return self.fail_response(f"Failed to prune cache: {e}")
