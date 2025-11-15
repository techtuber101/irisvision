"""
Tool output persistence and summarization pipeline.

Handles:
- Automatic persistence of tool outputs to artifacts
- Summarization of large tool outputs
- Path references instead of full content in context
"""

from typing import Dict, Any, Optional, Tuple
import json
from core.utils.logger import logger
from core.iris_infra.artifact_store import ArtifactStore


class ToolOutputHandler:
    """
    Manages tool output persistence and summarization.
    
    Intercepts tool outputs, saves large ones as artifacts, and provides
    summaries for inclusion in conversation context.
    """
    
    # Threshold for considering output "large" (in characters)
    LARGE_OUTPUT_THRESHOLD = 2000
    
    # Tools that should always have their outputs persisted
    PERSIST_ALWAYS_TOOLS = [
        "web_search",
        "image_search",
        "browser",
        "search_files",
        "search_people",
        "search_companies",
        "search_papers"
    ]
    
    def __init__(self, artifact_store: ArtifactStore):
        """
        Initialize the tool output handler.
        
        Args:
            artifact_store: Artifact store for persistence
        """
        self.artifact_store = artifact_store
    
    async def process_tool_output(
        self,
        tool_name: str,
        tool_output: Any,
        tool_args: Optional[Dict[str, Any]] = None
    ) -> Tuple[Any, Optional[Dict[str, Any]]]:
        """
        Process a tool output, persisting if necessary and creating summary.
        
        Args:
            tool_name: Name of the tool that was called
            tool_output: The tool's output
            tool_args: Arguments passed to the tool (optional)
            
        Returns:
            Tuple of (processed_output, artifact_info)
            - processed_output: Modified output (may be summarized or referenced)
            - artifact_info: Artifact info dict if persisted, None otherwise
        """
        try:
            # Determine if output should be persisted
            should_persist = self._should_persist_output(tool_name, tool_output)
            
            if not should_persist:
                return tool_output, None
            
            # Convert output to string for size check
            output_str = self._serialize_output(tool_output)
            output_size = len(output_str)
            
            # Persist large outputs
            if output_size > self.LARGE_OUTPUT_THRESHOLD or tool_name in self.PERSIST_ALWAYS_TOOLS:
                artifact_info = await self._persist_output(
                    tool_name, output_str, tool_args
                )
                
                # Create summarized version for context
                summary = self._create_summary(tool_name, tool_output, output_size)
                
                # Create reference output
                processed_output = {
                    "_iris_artifact": True,
                    "artifact_path": artifact_info["artifact_path"],
                    "artifact_key": artifact_info["artifact_key"],
                    "tool_name": tool_name,
                    "summary": summary,
                    "size": output_size,
                    "retrieval_hint": "Full output saved as artifact. Use get_artifact() if needed."
                }
                
                logger.info(
                    f"Persisted {tool_name} output: {output_size} chars "
                    f"→ artifact {artifact_info['artifact_key']}"
                )
                
                return processed_output, artifact_info
            else:
                # Output is small enough, return as-is
                return tool_output, None
                
        except Exception as e:
            logger.error(f"Failed to process tool output for {tool_name}: {e}", exc_info=True)
            # Return original output on error
            return tool_output, None
    
    def _should_persist_output(self, tool_name: str, tool_output: Any) -> bool:
        """
        Determine if a tool output should be persisted.
        
        Args:
            tool_name: Name of the tool
            tool_output: The tool's output
            
        Returns:
            True if output should be persisted
        """
        # Always persist specific tools
        if tool_name in self.PERSIST_ALWAYS_TOOLS:
            return True
        
        # Check if output is large
        try:
            output_str = self._serialize_output(tool_output)
            if len(output_str) > self.LARGE_OUTPUT_THRESHOLD:
                return True
        except Exception:
            pass
        
        # Check for specific output types
        if isinstance(tool_output, dict):
            # Persist if output has common "large data" indicators
            if any(key in tool_output for key in ["results", "data", "content", "items"]):
                return True
        
        return False
    
    def _serialize_output(self, tool_output: Any) -> str:
        """
        Serialize tool output to string.
        
        Args:
            tool_output: Tool output to serialize
            
        Returns:
            String representation
        """
        if isinstance(tool_output, str):
            return tool_output
        elif isinstance(tool_output, (dict, list)):
            return json.dumps(tool_output, indent=2)
        else:
            return str(tool_output)
    
    async def _persist_output(
        self,
        tool_name: str,
        output_str: str,
        tool_args: Optional[Dict[str, Any]]
    ) -> Dict[str, Any]:
        """
        Persist tool output as artifact.
        
        Args:
            tool_name: Name of the tool
            output_str: Serialized output
            tool_args: Tool arguments
            
        Returns:
            Artifact info dictionary
        """
        metadata = {
            "tool_name": tool_name,
            "tags": ["tool_output", tool_name]
        }
        
        if tool_args:
            metadata["tool_args"] = tool_args
        
        return await self.artifact_store.save_artifact(
            content=output_str,
            artifact_type=f"tool_{tool_name}",
            metadata=metadata,
            blocking=False  # Async persistence
        )
    
    def _create_summary(self, tool_name: str, tool_output: Any, output_size: int) -> str:
        """
        Create a concise summary of tool output.
        
        Args:
            tool_name: Name of the tool
            tool_output: Tool output
            output_size: Size of serialized output
            
        Returns:
            Summary string
        """
        # Tool-specific summarization
        if tool_name == "web_search":
            return self._summarize_web_search(tool_output)
        elif tool_name == "image_search":
            return self._summarize_image_search(tool_output)
        elif tool_name == "search_files":
            return self._summarize_file_search(tool_output)
        elif tool_name in ["search_people", "search_companies"]:
            return self._summarize_entity_search(tool_output, tool_name)
        else:
            return self._summarize_generic(tool_output, output_size)
    
    def _summarize_web_search(self, output: Any) -> str:
        """Summarize web search results."""
        try:
            if isinstance(output, dict):
                results = output.get("results", [])
                num_results = len(results) if isinstance(results, list) else 0
                
                # Get first few titles/snippets
                preview_items = []
                if isinstance(results, list):
                    for result in results[:3]:
                        if isinstance(result, dict):
                            title = result.get("title", "")[:60]
                            preview_items.append(f"- {title}")
                
                preview = "\n".join(preview_items) if preview_items else ""
                return f"Found {num_results} web results\n{preview}"
            
            return "Web search completed"
        except Exception:
            return "Web search results available"
    
    def _summarize_image_search(self, output: Any) -> str:
        """Summarize image search results."""
        try:
            if isinstance(output, dict):
                images = output.get("images", [])
                num_images = len(images) if isinstance(images, list) else 0
                return f"Found {num_images} images"
            return "Image search completed"
        except Exception:
            return "Image search results available"
    
    def _summarize_file_search(self, output: Any) -> str:
        """Summarize file search results."""
        try:
            if isinstance(output, dict):
                files = output.get("results", [])
                num_files = len(files) if isinstance(files, list) else 0
                
                # List first few file names
                if isinstance(files, list):
                    file_names = [f.get("path", "unknown") for f in files[:5] if isinstance(f, dict)]
                    preview = ", ".join(file_names)
                    return f"Found {num_files} files: {preview}"
                
                return f"Found {num_files} matching files"
            return "File search completed"
        except Exception:
            return "File search results available"
    
    def _summarize_entity_search(self, output: Any, tool_name: str) -> str:
        """Summarize people/company search results."""
        try:
            if isinstance(output, dict):
                results = output.get("results", [])
                num_results = len(results) if isinstance(results, list) else 0
                entity_type = "people" if "people" in tool_name else "companies"
                return f"Found {num_results} {entity_type}"
            return f"Search completed"
        except Exception:
            return "Search results available"
    
    def _summarize_generic(self, output: Any, output_size: int) -> str:
        """Generic summary for any tool output."""
        if isinstance(output, dict):
            keys = list(output.keys())[:5]
            return f"Output includes: {', '.join(keys)} ({output_size} chars)"
        elif isinstance(output, list):
            return f"List with {len(output)} items ({output_size} chars)"
        else:
            preview = str(output)[:100]
            return f"{preview}... ({output_size} chars total)"


class ToolOutputSummarizer:
    """
    Standalone tool output summarizer for use outside the main pipeline.
    
    Can be used to generate summaries without persistence.
    """
    
    @staticmethod
    def summarize(tool_name: str, tool_output: Any, max_length: int = 300) -> str:
        """
        Generate a summary of tool output.
        
        Args:
            tool_name: Name of the tool
            tool_output: Tool output to summarize
            max_length: Maximum summary length
            
        Returns:
            Summary string
        """
        handler = ToolOutputHandler(artifact_store=None)  # No persistence
        summary = handler._create_summary(tool_name, tool_output, len(str(tool_output)))
        
        if len(summary) > max_length:
            summary = summary[:max_length - 3] + "..."
        
        return summary
