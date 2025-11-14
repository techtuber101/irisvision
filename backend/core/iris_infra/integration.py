"""
Integration module for Iris infrastructure.

Provides high-level API for initializing and using Iris infrastructure
within the agent execution flow.
"""

from typing import Optional, Dict, Any
from daytona_sdk import AsyncSandbox
from core.utils.logger import logger
from core.iris_infra.sandbox_init import ensure_iris_structure, check_iris_initialized
from core.iris_infra.sandbox_fs import IrisSandboxFS
from core.iris_infra.instructions import InstructionLoader, seed_instructions
from core.iris_infra.runtime_state import RuntimeState
from core.iris_infra.artifact_store import ArtifactStore
from core.iris_infra.context_builder import IrisContextBuilder
from core.iris_infra.tool_output_handler import ToolOutputHandler


class IrisInfrastructure:
    """
    Central orchestrator for Iris infrastructure.
    
    Manages initialization, coordination, and access to all Iris infrastructure
    components.
    """
    
    def __init__(self):
        """Initialize the infrastructure manager."""
        self.sandbox: Optional[AsyncSandbox] = None
        self.iris_fs: Optional[IrisSandboxFS] = None
        self.instruction_loader: Optional[InstructionLoader] = None
        self.runtime_state: Optional[RuntimeState] = None
        self.artifact_store: Optional[ArtifactStore] = None
        self.context_builder: Optional[IrisContextBuilder] = None
        self.tool_output_handler: Optional[ToolOutputHandler] = None
        self._initialized = False
    
    async def initialize(self, sandbox: AsyncSandbox) -> bool:
        """
        Initialize the Iris infrastructure for a sandbox.
        
        This is idempotent - safe to call multiple times.
        
        Args:
            sandbox: Daytona sandbox instance
            
        Returns:
            True if initialization successful
        """
        if self._initialized and self.sandbox == sandbox:
            logger.debug("Iris infrastructure already initialized for this sandbox")
            return True
        
        try:
            logger.info("Initializing Iris infrastructure")
            self.sandbox = sandbox
            
            # Step 1: Ensure directory structure exists
            structure_ok = await ensure_iris_structure(sandbox)
            if not structure_ok:
                logger.error("Failed to create Iris directory structure")
                return False
            
            # Step 2: Initialize filesystem abstraction
            self.iris_fs = IrisSandboxFS(sandbox)
            logger.debug("✅ Filesystem abstraction initialized")
            
            # Step 3: Seed instruction files
            seed_ok = await seed_instructions(self.iris_fs)
            if not seed_ok:
                logger.warning("Failed to seed instructions, continuing anyway")
            
            # Step 4: Initialize instruction loader
            self.instruction_loader = InstructionLoader(self.iris_fs)
            await self.instruction_loader.load_all()
            logger.debug("✅ Instruction loader initialized")
            
            # Step 5: Initialize runtime state
            self.runtime_state = RuntimeState(self.iris_fs)
            await self.runtime_state.load_state()
            logger.debug("✅ Runtime state initialized")
            
            # Step 6: Initialize artifact store
            self.artifact_store = ArtifactStore(self.iris_fs)
            logger.debug("✅ Artifact store initialized")
            
            # Step 7: Initialize context builder
            self.context_builder = IrisContextBuilder(
                self.iris_fs,
                self.instruction_loader,
                self.runtime_state,
                self.artifact_store
            )
            logger.debug("✅ Context builder initialized")
            
            # Step 8: Initialize tool output handler
            self.tool_output_handler = ToolOutputHandler(self.artifact_store)
            logger.debug("✅ Tool output handler initialized")
            
            self._initialized = True
            logger.info("✅ Iris infrastructure fully initialized")
            return True
            
        except Exception as e:
            logger.error(f"Failed to initialize Iris infrastructure: {e}", exc_info=True)
            self._initialized = False
            return False
    
    async def cleanup(self) -> None:
        """Clean up and flush any pending operations."""
        try:
            if self.runtime_state:
                await self.runtime_state.flush_if_dirty()
            
            if self.iris_fs:
                await self.iris_fs.flush_index_if_dirty()
            
            if self.artifact_store:
                await self.artifact_store.wait_for_pending_writes(timeout=10.0)
            
            logger.debug("Iris infrastructure cleanup complete")
        except Exception as e:
            logger.error(f"Error during infrastructure cleanup: {e}")
    
    def is_initialized(self) -> bool:
        """Check if infrastructure is initialized."""
        return self._initialized
    
    async def enhance_system_prompt(self, base_prompt: str) -> str:
        """
        Enhance a system prompt with Iris infrastructure context.
        
        Args:
            base_prompt: Original system prompt
            
        Returns:
            Enhanced system prompt
        """
        if not self._initialized or not self.context_builder:
            return base_prompt
        
        try:
            return await self.context_builder.build_system_prompt(base_prompt)
        except Exception as e:
            logger.error(f"Failed to enhance system prompt: {e}")
            return base_prompt
    
    async def process_tool_output(
        self,
        tool_name: str,
        tool_output: Any,
        tool_args: Optional[Dict[str, Any]] = None
    ):
        """
        Process a tool output through the persistence pipeline.
        
        Args:
            tool_name: Name of the tool
            tool_output: Tool output
            tool_args: Tool arguments
            
        Returns:
            Processed output (may be summarized or referenced)
        """
        if not self._initialized or not self.tool_output_handler:
            return tool_output
        
        try:
            processed_output, artifact_info = await self.tool_output_handler.process_tool_output(
                tool_name, tool_output, tool_args
            )
            return processed_output
        except Exception as e:
            logger.error(f"Failed to process tool output: {e}")
            return tool_output
    
    async def record_turn(
        self,
        user_input: str,
        assistant_actions: str,
        tools_used: list,
        artifacts_created: list
    ) -> None:
        """
        Record a conversation turn in the runtime state.
        
        Args:
            user_input: User's input
            assistant_actions: Summary of assistant actions
            tools_used: List of tools used
            artifacts_created: List of artifacts created
        """
        if not self._initialized or not self.runtime_state:
            return
        
        try:
            key_points = []
            
            if tools_used:
                key_points.append(f"Used tools: {', '.join(tools_used)}")
            
            if artifacts_created:
                key_points.append(f"Created: {', '.join(artifacts_created)}")
            
            await self.runtime_state.add_turn_summary(
                user_input=user_input[:200],
                assistant_actions=assistant_actions,
                key_points=key_points
            )
        except Exception as e:
            logger.error(f"Failed to record turn: {e}")


# Global instance (optional - can also create per-thread instances)
_global_infrastructure: Optional[IrisInfrastructure] = None


def get_global_infrastructure() -> IrisInfrastructure:
    """Get or create the global infrastructure instance."""
    global _global_infrastructure
    if _global_infrastructure is None:
        _global_infrastructure = IrisInfrastructure()
    return _global_infrastructure


async def initialize_for_sandbox(sandbox: AsyncSandbox, use_global: bool = False) -> IrisInfrastructure:
    """
    Initialize Iris infrastructure for a sandbox.
    
    Args:
        sandbox: Daytona sandbox instance
        use_global: Whether to use the global instance or create a new one
        
    Returns:
        Initialized IrisInfrastructure instance
    """
    if use_global:
        infra = get_global_infrastructure()
    else:
        infra = IrisInfrastructure()
    
    await infra.initialize(sandbox)
    return infra
