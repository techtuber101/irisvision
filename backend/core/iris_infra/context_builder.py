"""
Context builder for intelligent, lightweight prompt construction.

Builds optimized prompts with:
- Core instructions (from memory)
- Task state summaries
- Recent turn summaries
- File references (not full content)
- Current user message
"""

from typing import Dict, Any, Optional, List
from core.utils.logger import logger
from core.iris_infra.sandbox_fs import IrisSandboxFS
from core.iris_infra.instructions import InstructionLoader
from core.iris_infra.runtime_state import RuntimeState
from core.iris_infra.artifact_store import ArtifactStore


class IrisContextBuilder:
    """
    Builds intelligent, compact context for each agent turn.
    
    The goal is to create prompts that are:
    - Small (minimize tokens)
    - Dense (maximum relevant information)
    - Fast (minimal I/O operations)
    """
    
    def __init__(
        self,
        iris_fs: IrisSandboxFS,
        instruction_loader: InstructionLoader,
        runtime_state: RuntimeState,
        artifact_store: ArtifactStore
    ):
        """
        Initialize the context builder.
        
        Args:
            iris_fs: Filesystem abstraction
            instruction_loader: Instruction loader
            runtime_state: Runtime state manager
            artifact_store: Artifact store
        """
        self.iris_fs = iris_fs
        self.instruction_loader = instruction_loader
        self.runtime_state = runtime_state
        self.artifact_store = artifact_store
    
    async def build_system_prompt(
        self,
        base_system_prompt: str,
        include_iris_enhancements: bool = True
    ) -> str:
        """
        Build an enhanced system prompt with Iris infrastructure context.
        
        Args:
            base_system_prompt: The original system prompt
            include_iris_enhancements: Whether to add Iris-specific enhancements
            
        Returns:
            Enhanced system prompt
        """
        if not include_iris_enhancements:
            return base_system_prompt
        
        try:
            # Get core instructions from cache
            core_instructions = await self.instruction_loader.get_core_instructions()
            
            # Get runtime state summary
            state_summary = await self.runtime_state.get_state_summary()
            
            # Get recent turn summaries
            recent_turns = await self.runtime_state.get_recent_summaries(count=2)
            turn_context = self._format_turn_summaries(recent_turns)
            
            # Get available resources (file pointers)
            resources = await self._build_resource_list()
            
            # Compose enhanced prompt
            enhancements = []
            
            if state_summary and state_summary != "No active state":
                enhancements.append(f"\n\n## Current State\n{state_summary}")
            
            if turn_context:
                enhancements.append(f"\n\n## Recent Context\n{turn_context}")
            
            if resources:
                enhancements.append(f"\n\n## Available Resources\n{resources}")
            
            enhanced_prompt = base_system_prompt
            if enhancements:
                enhanced_prompt += "\n\n---\n# IRIS INFRASTRUCTURE CONTEXT" + "".join(enhancements)
            
            logger.debug(f"Enhanced system prompt: added {len(''.join(enhancements))} chars of Iris context")
            return enhanced_prompt
            
        except Exception as e:
            logger.error(f"Failed to build enhanced system prompt: {e}", exc_info=True)
            return base_system_prompt
    
    def _format_turn_summaries(self, summaries: List[Dict[str, Any]]) -> str:
        """
        Format turn summaries into compact context text.
        
        Args:
            summaries: List of turn summary dictionaries
            
        Returns:
            Formatted summary text
        """
        if not summaries:
            return ""
        
        lines = []
        for summary in summaries:
            user_part = summary.get("user_input", "")[:100]
            assistant_part = summary.get("assistant_actions", "")[:150]
            
            if user_part or assistant_part:
                lines.append(f"- User: {user_part}")
                lines.append(f"  Agent: {assistant_part}")
        
        return "\n".join(lines) if lines else ""
    
    async def _build_resource_list(self, max_items: int = 10) -> str:
        """
        Build a compact list of available resources (artifacts, files, etc.).
        
        Args:
            max_items: Maximum number of items to list
            
        Returns:
            Formatted resource list
        """
        try:
            # Get recent artifacts from index
            artifacts = await self.artifact_store.list_artifacts(limit=max_items)
            
            if not artifacts:
                return ""
            
            lines = ["Available artifacts:"]
            for artifact in artifacts[:max_items]:
                artifact_type = artifact.get("type", "unknown")
                filename = artifact.get("filename", "unknown")
                lines.append(f"  - {artifact_type}: {filename}")
            
            return "\n".join(lines)
            
        except Exception as e:
            logger.warning(f"Failed to build resource list: {e}")
            return ""
    
    async def build_turn_context(self, user_message: str) -> Dict[str, Any]:
        """
        Build complete context for a single turn.
        
        This is a lightweight structure that provides just enough context
        without including full file contents or large artifacts.
        
        Args:
            user_message: Current user message
            
        Returns:
            Context dictionary with:
            - state_summary: Current runtime state
            - recent_turns: Last N turn summaries
            - available_artifacts: List of artifact references
            - user_message: Current user message
        """
        try:
            context = {
                "state_summary": await self.runtime_state.get_state_summary(),
                "recent_turns": await self.runtime_state.get_recent_summaries(count=3),
                "available_artifacts": await self.artifact_store.list_artifacts(limit=5),
                "user_message": user_message
            }
            
            return context
            
        except Exception as e:
            logger.error(f"Failed to build turn context: {e}", exc_info=True)
            return {"user_message": user_message}
    
    def detect_task_type(self, user_message: str) -> Optional[str]:
        """
        Detect the type of task from user message.
        
        Simple heuristic-based detection. In production, could use
        more sophisticated classification.
        
        Args:
            user_message: User's message
            
        Returns:
            Task type string (e.g., "research", "coding", "document_creation")
            or None if unclear
        """
        message_lower = user_message.lower()
        
        # Research tasks
        if any(word in message_lower for word in ["research", "find", "search", "investigate", "analyze"]):
            return "research"
        
        # Coding tasks
        if any(word in message_lower for word in ["code", "implement", "build", "develop", "program", "script"]):
            return "coding"
        
        # Document creation
        if any(word in message_lower for word in ["document", "report", "write", "draft", "create doc"]):
            return "document_creation"
        
        # Presentation tasks
        if any(word in message_lower for word in ["presentation", "slides", "pitch deck"]):
            return "presentation"
        
        return None
    
    async def select_relevant_instructions(self, task_type: Optional[str]) -> List[str]:
        """
        Select which instruction files are relevant for a given task type.
        
        Args:
            task_type: Detected task type
            
        Returns:
            List of instruction filenames to include
        """
        # Always include core instructions
        relevant = ["system_core.md", "tools_general.md"]
        
        if task_type == "coding":
            relevant.append("coding_rules.md")
        
        if task_type in ["research", "document_creation"]:
            relevant.append("context_selection.md")
        
        if task_type:
            relevant.append("mode_planner.md")
        
        return relevant
