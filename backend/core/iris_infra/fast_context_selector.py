"""
Fast context selector for zero-latency dynamic context injection.

This module provides extremely fast context selection that runs as part of
tool execution, allowing the agent to dynamically load files, instructions,
and artifacts only when needed.
"""

import asyncio
from typing import Dict, Any, List, Optional, Set
from core.utils.logger import logger
from core.iris_infra.sandbox_fs import IrisSandboxFS
from core.iris_infra.instructions import InstructionLoader
from core.iris_infra.artifact_store import ArtifactStore
from core.iris_infra.workspace_indexer import WorkspaceIndexer
from core.iris_infra.context_builder import IrisContextBuilder


class FastContextSelector:
    """
    Ultra-fast context selector that runs before tool execution.
    
    Analyzes tool intent and quickly selects relevant files/instructions/artifacts,
    reads them in parallel, and returns compact context for injection.
    """
    
    # Maximum context size to inject (characters) - KEEP SMALL for token savings
    MAX_CONTEXT_SIZE = 3000  # Reduced from 5000 for aggressive token savings
    
    # File size threshold - files larger than this get truncated (not full content)
    LARGE_FILE_THRESHOLD = 1000  # Reduced from 2000 - only show snippets
    
    def __init__(
        self,
        iris_fs: IrisSandboxFS,
        instruction_loader: InstructionLoader,
        artifact_store: ArtifactStore,
        workspace_indexer: Optional[WorkspaceIndexer] = None,
        context_builder: Optional[IrisContextBuilder] = None
    ):
        """
        Initialize the fast context selector.
        
        Args:
            iris_fs: Filesystem abstraction
            instruction_loader: Instruction loader
            artifact_store: Artifact store
            workspace_indexer: Workspace file indexer
            context_builder: Optional IrisContextBuilder for selection logic
        """
        self.iris_fs = iris_fs
        self.instruction_loader = instruction_loader
        self.artifact_store = artifact_store
        self.workspace_indexer = workspace_indexer
        self.context_builder = context_builder
        
        # Cache for recently loaded files (in-memory, per-run)
        self._file_cache: Dict[str, str] = {}
        self._instruction_cache: Dict[str, str] = {}
    
    async def select_context_for_tool(
        self,
        tool_name: str,
        tool_args: Dict[str, Any],
        user_message: Optional[str] = None
    ) -> str:
        """
        Quickly select and load context needed for a tool call.
        
        This runs BEFORE tool execution to inject relevant context.
        
        Args:
            tool_name: Name of the tool being called
            tool_args: Tool arguments
            user_message: Current user message (for context)
            
        Returns:
            Compact context string to inject (empty if nothing needed)
        """
        try:
            start_time = asyncio.get_event_loop().time()
            
            # Quick intent analysis
            selected_files = await self._select_files(tool_name, tool_args)
            selected_instructions = await self._select_instructions(tool_name, tool_args)
            selected_artifacts = await self._select_artifacts(tool_name, tool_args)
            
            # Parallel read of all selected content
            context_parts = await asyncio.gather(
                self._load_files(selected_files),
                self._load_instructions(selected_instructions),
                self._load_artifacts(selected_artifacts),
                return_exceptions=True
            )
            
            file_context, instruction_context, artifact_context = context_parts
            
            # Combine into compact context
            context = self._combine_context(
                file_context, instruction_context, artifact_context
            )
            
            elapsed = (asyncio.get_event_loop().time() - start_time) * 1000
            if context:
                logger.debug(f"⚡ Context selected in {elapsed:.1f}ms: {len(context)} chars")
            
            return context
            
        except Exception as e:
            logger.warning(f"Context selection failed: {e}")
            return ""
    
    async def _select_files(
        self,
        tool_name: str,
        tool_args: Dict[str, Any]
    ) -> List[str]:
        """
        Quickly select relevant files based on tool intent.
        
        Returns:
            List of file paths to load
        """
        selected = []
        
        # Check if tool explicitly references files
        if "file_path" in tool_args:
            file_path = tool_args["file_path"]
            if file_path and not file_path.startswith("/"):
                selected.append(file_path)
        
        if "path" in tool_args:
            path = tool_args["path"]
            if path and not path.startswith("/"):
                selected.append(path)
        
        # Tool-specific heuristics
        if tool_name in ["read_file", "edit_file", "search_files"]:
            # These tools work with files - check args
            if "file_path" in tool_args:
                selected.append(tool_args["file_path"])
            if "pattern" in tool_args and self.workspace_indexer:
                # Quick file search from index - LIMIT to 1 for token savings
                pattern = tool_args["pattern"]
                matching = self.workspace_indexer.index.search_files(pattern, limit=1)
                selected.extend([f['relative_path'] for f in matching])  # Only 1 file
        
        # Remove duplicates and validate
        selected = list(set(selected))
        return [f for f in selected if f and len(f) > 0]
    
    async def _select_instructions(
        self,
        tool_name: str,
        tool_args: Dict[str, Any]
    ) -> List[str]:
        """
        Select relevant instructions based on tool type.
        
        Uses IrisContextBuilder's selection logic if available.
        
        Returns:
            List of instruction file names to load
        """
        # Use context_builder's selection logic if available
        if self.context_builder:
            try:
                # Detect task type from tool name (heuristic)
                task_type = None
                if tool_name in ["create_document", "create_file", "edit_file"]:
                    task_type = "coding" if "file" in tool_name else "document_creation"
                elif tool_name in ["web_search", "browser"]:
                    task_type = "research"
                
                # Use context builder's selection method
                selected = await self.context_builder.select_relevant_instructions(task_type)
                return selected
            except Exception as e:
                logger.debug(f"Context builder selection failed, using fallback: {e}")
        
        # Fallback: Map tool types to instruction files
        selected = []
        tool_instruction_map = {
            "create_document": ["document_creation.md"],
            "web_search": ["research_methodology.md"],
            "execute_command": ["coding_rules.md", "tools_general.md"],
            "edit_file": ["coding_rules.md"],
            "create_file": ["coding_rules.md"],
            "browser": ["tools_general.md"],
        }
        
        # Get relevant instructions for this tool
        if tool_name in tool_instruction_map:
            selected.extend(tool_instruction_map[tool_name])
        
        # Always include core instructions
        if "system_core.md" not in selected:
            selected.insert(0, "system_core.md")
        
        return selected
    
    async def _select_artifacts(
        self,
        tool_name: str,
        tool_args: Dict[str, Any]
    ) -> List[str]:
        """
        Select relevant artifacts based on tool intent.
        
        Returns:
            List of artifact keys to load
        """
        # Only load artifacts if tool explicitly needs them - TOKEN SAVINGS
        if tool_name in ["create_document"]:
            # Only for document creation - get 1 most recent artifact
            artifacts = await self.artifact_store.list_artifacts(limit=1)
            return [a.get("artifact_key") for a in artifacts if a.get("artifact_key")]
        
        return []  # Don't load artifacts for other tools
    
    async def _load_files(self, file_paths: List[str]) -> str:
        """
        Load files in parallel and return compact context.
        
        Args:
            file_paths: List of file paths to load
            
        Returns:
            Combined file content (truncated if too large)
        """
        if not file_paths:
            return ""
        
        try:
            # Parallel read
            read_tasks = [self._read_file_safe(path) for path in file_paths]
            contents = await asyncio.gather(*read_tasks, return_exceptions=True)
            
            # Combine with file names
            parts = []
            for path, content in zip(file_paths, contents):
                if isinstance(content, Exception):
                    continue
                if content:
                    # Aggressively truncate large files for token savings
                    if len(content) > self.LARGE_FILE_THRESHOLD:
                        # Show first 500 chars + last 500 chars for context
                        preview = content[:500] + "\n\n... [middle truncated for token savings] ...\n\n" + content[-500:]
                        content = preview
                    parts.append(f"**{path}:**\n{content}")
            
            return "\n\n".join(parts) if parts else ""
            
        except Exception as e:
            logger.debug(f"Failed to load files: {e}")
            return ""
    
    async def _read_file_safe(self, path: str) -> Optional[str]:
        """Safely read a file with caching."""
        # Check cache first
        if path in self._file_cache:
            return self._file_cache[path]
        
        try:
            content = await self.iris_fs.read_file(path)
            if isinstance(content, bytes):
                content = content.decode('utf-8')
            
            # Cache it
            self._file_cache[path] = content
            return content
        except Exception:
            return None
    
    async def _load_instructions(self, instruction_names: List[str]) -> str:
        """
        Load instructions in parallel.
        
        Args:
            instruction_names: List of instruction file names
            
        Returns:
            Combined instruction content
        """
        if not instruction_names:
            return ""
        
        try:
            # Load from instruction loader (uses cache)
            instructions = await asyncio.gather(
                *[self.instruction_loader.get(name) for name in instruction_names],
                return_exceptions=True
            )
            
            # Combine
            parts = []
            for name, content in zip(instruction_names, instructions):
                if isinstance(content, Exception) or not content:
                    continue
                parts.append(content)
            
            return "\n\n".join(parts) if parts else ""
            
        except Exception as e:
            logger.debug(f"Failed to load instructions: {e}")
            return ""
    
    async def _load_artifacts(self, artifact_keys: List[str]) -> str:
        """
        Load artifacts in parallel.
        
        Args:
            artifact_keys: List of artifact keys
            
        Returns:
            Combined artifact content (summarized)
        """
        if not artifact_keys:
            return ""
        
        try:
            artifacts = await asyncio.gather(
                *[self.artifact_store.get_artifact(key) for key in artifact_keys],
                return_exceptions=True
            )
            
            parts = []
            for key, artifact in zip(artifact_keys, artifacts):
                if isinstance(artifact, Exception) or not artifact:
                    continue
                
                content = artifact.get("content", "")
                if len(content) > self.LARGE_FILE_THRESHOLD:
                    content = content[:self.LARGE_FILE_THRESHOLD] + "\n... (truncated)"
                
                parts.append(f"**Artifact {key}:**\n{content}")
            
            return "\n\n".join(parts) if parts else ""
            
        except Exception as e:
            logger.debug(f"Failed to load artifacts: {e}")
            return ""
    
    def _combine_context(
        self,
        file_context: str,
        instruction_context: str,
        artifact_context: str
    ) -> str:
        """
        Combine all context parts into compact format.
        
        Args:
            file_context: File content
            instruction_context: Instruction content
            artifact_context: Artifact content
            
        Returns:
            Combined context (truncated if too large)
        """
        parts = []
        
        if instruction_context:
            parts.append(f"## Relevant Instructions\n{instruction_context}")
        
        if file_context:
            parts.append(f"## Relevant Files\n{file_context}")
        
        if artifact_context:
            parts.append(f"## Relevant Artifacts\n{artifact_context}")
        
        if not parts:
            return ""
        
        combined = "\n\n".join(parts)
        
        # Truncate if too large
        if len(combined) > self.MAX_CONTEXT_SIZE:
            combined = combined[:self.MAX_CONTEXT_SIZE] + "\n... (context truncated)"
        
        return combined

