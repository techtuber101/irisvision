"""
Initialize Intelligence Tool

This tool bootstraps the Iris infrastructure by ensuring a sandbox exists
and initializing the intelligent context selection system.
"""

import os
from typing import Dict, Any
from core.sandbox.tool_base import SandboxToolsBase, ToolResult
from core.sandbox.sandbox import create_sandbox, get_or_start_sandbox
from core.sandbox.api import get_sandbox_by_project_id
from core.utils.logger import logger
from core.agentpress.tool import tool_metadata, method_metadata


@tool_metadata(
    display_name="Initialize Intelligence",
    description="Bootstrap the intelligent context selection system for efficient file and memory management",
    icon="brain",
    color="#9333EA",
    is_core=True,
    weight=5,
    visible=True
)
class InitializeIntelligenceTool(SandboxToolsBase):
    """
    Tool to initialize the intelligent context selection system.
    
    This tool:
    1. Ensures a Daytona sandbox exists for the project
    2. Initializes the Iris infrastructure (file indexing, memory, artifacts)
    3. Provides the agent with workspace context and available resources
    
    Should be called early in the conversation to enable intelligent file selection.
    """
    
    @method_metadata(
        display_name="Initialize Intelligence System",
        description="Bootstrap the Iris infrastructure for intelligent context management"
    )
    async def execute(self) -> ToolResult:
        """
        Initialize the intelligent context selection system.
        
        Returns:
            ToolResult with initialization status and available resources
        """
        try:
            logger.info("=" * 70)
            logger.info("🧠 INITIALIZING INTELLIGENCE SYSTEM")
            logger.info("=" * 70)
            
            # Step 1: Ensure sandbox exists
            logger.info("Step 1: Ensuring Daytona sandbox exists...")
            await self._ensure_sandbox()
            logger.info(f"✅ Sandbox ready: {self.sandbox.id}")
            
            # Step 2: Trigger Iris initialization (happens in _ensure_sandbox via _try_init_iris_infrastructure)
            logger.info("Step 2: Initializing Iris infrastructure...")
            
            # The initialization already happened in _ensure_sandbox, but let's verify
            if not self.thread_manager or not hasattr(self.thread_manager, 'agent_runner'):
                logger.warning("⚠️  No agent runner available")
                return ToolResult(
                    success=True,
                    output="Sandbox initialized, but Iris infrastructure not available."
                )
            
            runner = self.thread_manager.agent_runner
            if not runner or not hasattr(runner, 'iris_context') or not runner.iris_context:
                logger.warning("⚠️  No Iris context available")
                return ToolResult(
                    success=True,
                    output="Sandbox initialized, but Iris infrastructure not configured."
                )
            
            # Wait a moment for initialization to complete
            import asyncio
            await asyncio.sleep(1)
            
            # Step 3: Check if Iris is ready
            iris_ready = runner.iris_context.is_ready()
            logger.info(f"Step 3: Iris infrastructure ready: {iris_ready}")
            
            if not iris_ready:
                logger.warning("⚠️  Iris infrastructure not fully initialized yet")
                return ToolResult(
                    success=True,
                    output="Sandbox created. Iris infrastructure is initializing in the background..."
                )
            
            # Step 4: Get workspace summary
            logger.info("Step 4: Gathering workspace information...")
            workspace_info = await self._get_workspace_info(runner.iris_context)
            
            # Step 5: Get available resources
            logger.info("Step 5: Gathering available resources...")
            resources_info = await self._get_resources_info(runner.iris_context)
            
            logger.info("=" * 70)
            logger.info("✅ INTELLIGENCE SYSTEM INITIALIZED")
            logger.info("=" * 70)
            
            # Build response
            response_parts = [
                "🧠 **Intelligence System Initialized Successfully**",
                "",
                "The intelligent context selection system is now active. I can now:",
                "- Access and analyze files in the workspace",
                "- Remember important information across turns",
                "- Save and retrieve artifacts",
                "- Intelligently select which files to load based on the task",
                "",
            ]
            
            if workspace_info:
                response_parts.append("**Workspace Status:**")
                response_parts.append(workspace_info)
                response_parts.append("")
            
            if resources_info:
                response_parts.append("**Available Resources:**")
                response_parts.append(resources_info)
                response_parts.append("")
            
            response_parts.append("I'm now ready to work efficiently with selective context loading.")
            
            return ToolResult(
                success=True,
                output="\n".join(response_parts)
            )
            
        except Exception as e:
            logger.error(f"Failed to initialize intelligence system: {e}", exc_info=True)
            return ToolResult(
                success=False,
                output=f"Failed to initialize intelligence system: {str(e)}"
            )
    
    async def _get_workspace_info(self, iris_context) -> str:
        """Get workspace file summary"""
        try:
            if not hasattr(iris_context, 'infrastructure') or not iris_context.infrastructure:
                return "Workspace indexing not available yet."
            
            workspace_indexer = iris_context.infrastructure.workspace_indexer
            if not workspace_indexer or not workspace_indexer.is_indexed():
                return "Workspace not yet indexed."
            
            summary = workspace_indexer.get_summary()
            return summary if summary else "Workspace is empty or indexing in progress."
            
        except Exception as e:
            logger.warning(f"Failed to get workspace info: {e}")
            return "Workspace information not available."
    
    async def _get_resources_info(self, iris_context) -> str:
        """Get available resources (artifacts, memory, etc.)"""
        try:
            if not hasattr(iris_context, 'infrastructure') or not iris_context.infrastructure:
                return "Resource information not available yet."
            
            artifact_store = iris_context.infrastructure.artifact_store
            if not artifact_store:
                return "No artifacts available."
            
            artifacts = await artifact_store.list_artifacts(limit=5)
            if not artifacts:
                return "No artifacts found yet."
            
            artifact_lines = ["Recent artifacts:"]
            for artifact in artifacts:
                artifact_type = artifact.get("type", "unknown")
                filename = artifact.get("filename", "unknown")
                artifact_lines.append(f"  - {artifact_type}: {filename}")
            
            return "\n".join(artifact_lines)
            
        except Exception as e:
            logger.warning(f"Failed to get resources info: {e}")
            return "Resource information not available."


# Tool schema for LLM
INITIALIZE_INTELLIGENCE_SCHEMA = {
    "name": "initialising_intelligence",
    "description": """Initialize the intelligent context selection system for this conversation.

This tool sets up the infrastructure that allows me to:
- Intelligently select which files to load based on your requests
- Index and understand the workspace structure
- Remember important information across our conversation
- Save and retrieve artifacts efficiently

**When to use:**
- Call this ONCE near the start of a new conversation/project
- Especially useful before working with files or code in the workspace
- Helps me work more efficiently by only loading relevant context

**What it does:**
- Creates/starts the Daytona sandbox environment
- Indexes files in the /workspace directory
- Sets up memory and artifact storage
- Enables selective context loading

This is a setup operation that takes a few seconds but significantly improves my efficiency.""",
    "parameters": {
        "type": "object",
        "properties": {},
        "required": []
    }
}

