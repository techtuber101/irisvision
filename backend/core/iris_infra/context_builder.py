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
from core.iris_infra.workspace_indexer import WorkspaceIndexer


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
        artifact_store: ArtifactStore,
        workspace_indexer: Optional[WorkspaceIndexer] = None
    ):
        """
        Initialize the context builder.
        
        Args:
            iris_fs: Filesystem abstraction
            instruction_loader: Instruction loader
            runtime_state: Runtime state manager
            artifact_store: Artifact store
            workspace_indexer: Workspace file indexer (optional)
        """
        self.iris_fs = iris_fs
        self.instruction_loader = instruction_loader
        self.runtime_state = runtime_state
        self.artifact_store = artifact_store
        self.workspace_indexer = workspace_indexer
    
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
            logger.debug("🔧 CONTEXT BUILDER: Iris enhancements disabled, using base prompt")
            return base_system_prompt
        
        try:
            logger.info("=" * 70)
            logger.info("🔧 CONTEXT BUILDER: Building enhanced system prompt")
            logger.info("=" * 70)
            
            # Get core instructions from cache
            logger.debug("📖 Loading core instructions from cache...")
            core_instructions = await self.instruction_loader.get_core_instructions()
            logger.debug(f"   ✅ Core instructions loaded: {len(core_instructions)} chars")
            
            # Get runtime state summary
            logger.debug("💾 Loading runtime state summary...")
            state_summary = await self.runtime_state.get_state_summary()
            logger.debug(f"   ✅ State summary: {state_summary[:100] if state_summary else 'None'}...")
            
            # Get recent turn summaries
            logger.debug("🔄 Loading recent turn summaries...")
            recent_turns = await self.runtime_state.get_recent_summaries(count=2)
            turn_context = self._format_turn_summaries(recent_turns)
            logger.debug(f"   ✅ Turn summaries: {len(recent_turns)} turns loaded")
            
            # Get available resources (file pointers)
            logger.debug("📁 Building resource list (artifacts + workspace files)...")
            resources = await self._build_resource_list()
            logger.debug(f"   ✅ Resources: {len(resources)} chars")
            
            # Compose enhanced prompt
            enhancements = []
            
            if state_summary and state_summary != "No active state":
                enhancements.append(f"\n\n## Current State\n{state_summary}")
                logger.debug("   ✓ Added current state to enhancements")
            
            if turn_context:
                enhancements.append(f"\n\n## Recent Context\n{turn_context}")
                logger.debug("   ✓ Added recent context to enhancements")
            
            if resources:
                enhancements.append(f"\n\n## Available Resources\n{resources}")
                logger.debug("   ✓ Added available resources to enhancements")
            
            enhanced_prompt = base_system_prompt
            if enhancements:
                enhanced_prompt += "\n\n---\n# IRIS INFRASTRUCTURE CONTEXT" + "".join(enhancements)
            
            total_enhancement_size = len(''.join(enhancements))
            logger.info("=" * 70)
            logger.info("✅ CONTEXT BUILDER: System prompt enhanced")
            logger.info(f"   Base prompt: {len(base_system_prompt)} chars")
            logger.info(f"   Enhancements: {total_enhancement_size} chars")
            logger.info(f"   Final prompt: {len(enhanced_prompt)} chars")
            logger.info(f"   Increase: +{total_enhancement_size} chars (+{100*total_enhancement_size/len(base_system_prompt):.1f}%)")
            logger.info("=" * 70)
            
            return enhanced_prompt
            
        except Exception as e:
            logger.error(f"❌ CONTEXT BUILDER FAILED: {e}", exc_info=True)
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
            lines = []
            logger.debug("📋 Building resource list...")
            
            # Get recent artifacts from index
            logger.debug("   Fetching artifacts...")
            artifacts = await self.artifact_store.list_artifacts(limit=max_items)
            
            if artifacts:
                logger.debug(f"   ✅ Found {len(artifacts)} artifacts")
                lines.append("**Recent Artifacts:**")
                for artifact in artifacts[:max_items]:
                    artifact_type = artifact.get("type", "unknown")
                    filename = artifact.get("filename", "unknown")
                    lines.append(f"  - {artifact_type}: {filename}")
                    logger.debug(f"      • {artifact_type}: {filename}")
            else:
                logger.debug("   ℹ️  No artifacts found")
            
            # Get workspace file summary if indexer is available
            logger.debug("   Checking workspace indexer...")
            if self.workspace_indexer and self.workspace_indexer.is_indexed():
                try:
                    logger.debug("   ✅ Workspace is indexed, getting summary...")
                    workspace_summary = self.workspace_indexer.get_summary()
                    if workspace_summary:
                        lines.append("")
                        lines.append("**Workspace Files:**")
                        lines.append(workspace_summary)
                        lines.append("")
                        lines.append("💡 **Tip:** Use tools like `read_file`, `search_files`, or `list_directory` to access specific files when needed.")
                        logger.debug(f"   ✅ Added workspace summary ({len(workspace_summary)} chars)")
                        logger.debug(f"   📊 Agent will see file inventory in context")
                    else:
                        logger.debug("   ℹ️  Workspace summary is empty")
                except Exception as e:
                    logger.warning(f"   ⚠️  Failed to get workspace summary: {e}")
            else:
                if not self.workspace_indexer:
                    logger.debug("   ℹ️  No workspace indexer available")
                else:
                    logger.debug("   ℹ️  Workspace not yet indexed")
            
            result = "\n".join(lines) if lines else ""
            logger.debug(f"📋 Resource list complete: {len(result)} chars, {len(lines)} lines")
            return result
            
        except Exception as e:
            logger.warning(f"⚠️  Failed to build resource list: {e}")
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
