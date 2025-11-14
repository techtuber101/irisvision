"""
Agent integration module for Iris infrastructure.

Provides hooks and utilities for integrating Iris infrastructure
into the AgentRunner execution flow.
"""

from typing import Optional, Dict, Any
from core.utils.logger import logger
from core.iris_infra.integration import IrisInfrastructure, initialize_for_sandbox
from daytona_sdk import AsyncSandbox


class IrisAgentContext:
    """
    Context manager for Iris infrastructure during agent execution.
    
    Handles initialization, cleanup, and provides convenient access to
    infrastructure components during an agent run.
    """
    
    def __init__(self, project_id: str, thread_id: str):
        """
        Initialize the agent context.
        
        Args:
            project_id: Project ID
            thread_id: Thread ID
        """
        self.project_id = project_id
        self.thread_id = thread_id
        self.infrastructure: Optional[IrisInfrastructure] = None
        self._enabled = True  # Can be disabled via config
    
    async def initialize(self, sandbox: AsyncSandbox) -> bool:
        """
        Initialize the infrastructure for this agent run.
        
        Args:
            sandbox: Sandbox instance
            
        Returns:
            True if initialization successful
        """
        if not self._enabled:
            logger.debug("Iris infrastructure disabled, skipping initialization")
            return False
        
        try:
            self.infrastructure = await initialize_for_sandbox(sandbox, use_global=False)
            
            if self.infrastructure.is_initialized():
                logger.info(f"Iris infrastructure ready for thread {self.thread_id}")
                return True
            else:
                logger.warning("Iris infrastructure initialization failed")
                return False
                
        except Exception as e:
            logger.error(f"Failed to initialize Iris infrastructure: {e}", exc_info=True)
            return False
    
    async def cleanup(self) -> None:
        """Clean up resources and flush pending operations."""
        if self.infrastructure:
            await self.infrastructure.cleanup()
    
    def is_ready(self) -> bool:
        """Check if infrastructure is ready for use."""
        return self.infrastructure is not None and self.infrastructure.is_initialized()
    
    async def enhance_system_prompt(self, base_prompt: str) -> str:
        """
        Enhance the system prompt with Iris context.
        
        Args:
            base_prompt: Original system prompt
            
        Returns:
            Enhanced system prompt (or original if infrastructure not ready)
        """
        if not self.is_ready():
            return base_prompt
        
        return await self.infrastructure.enhance_system_prompt(base_prompt)
    
    async def process_tool_output(
        self,
        tool_name: str,
        tool_output: Any,
        tool_args: Optional[Dict[str, Any]] = None
    ) -> Any:
        """
        Process a tool output through the Iris pipeline.
        
        Args:
            tool_name: Tool name
            tool_output: Tool output
            tool_args: Tool arguments
            
        Returns:
            Processed output (may be summarized/referenced)
        """
        if not self.is_ready():
            return tool_output
        
        return await self.infrastructure.process_tool_output(
            tool_name, tool_output, tool_args
        )
    
    async def record_turn_summary(
        self,
        user_input: str,
        tools_used: list,
        artifacts: list
    ) -> None:
        """
        Record a turn summary.
        
        Args:
            user_input: User input summary
            tools_used: List of tools used
            artifacts: List of artifacts created
        """
        if not self.is_ready():
            return
        
        assistant_actions = f"Executed {len(tools_used)} tool(s), created {len(artifacts)} artifact(s)"
        
        await self.infrastructure.record_turn(
            user_input=user_input,
            assistant_actions=assistant_actions,
            tools_used=tools_used,
            artifacts_created=artifacts
        )


def should_enable_iris_infrastructure(agent_config: Optional[Dict[str, Any]] = None) -> bool:
    """
    Determine if Iris infrastructure should be enabled for this agent run.
    
    Args:
        agent_config: Agent configuration
        
    Returns:
        True if infrastructure should be enabled
    """
    # Check agent config for explicit enable/disable
    if agent_config:
        iris_enabled = agent_config.get('enable_iris_infrastructure')
        if iris_enabled is not None:
            return iris_enabled
    
    # Check environment variable
    from core.utils.config import config
    if hasattr(config, 'ENABLE_IRIS_INFRASTRUCTURE'):
        return config.ENABLE_IRIS_INFRASTRUCTURE
    
    # Default: enabled
    return True
