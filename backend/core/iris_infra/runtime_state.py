"""
Runtime state and turn summary management for Iris infrastructure.

Manages agent execution state, turn summaries, and conversation compression.
"""

from typing import Dict, Any, Optional, List
from datetime import datetime, timezone
from core.utils.logger import logger
from core.iris_infra.sandbox_fs import IrisSandboxFS


class RuntimeState:
    """
    Manages runtime execution state and turn history compression.
    
    Keeps track of:
    - Current task mode and phase
    - Turn summaries for context compression
    - Key artifacts and decisions
    - Execution metadata
    """
    
    def __init__(self, iris_fs: IrisSandboxFS):
        """
        Initialize the runtime state manager.
        
        Args:
            iris_fs: Iris filesystem abstraction
        """
        self.iris_fs = iris_fs
        self._state_cache: Optional[Dict[str, Any]] = None
        self._summaries_cache: Optional[List[Dict[str, Any]]] = None
        self._cache_dirty = False
    
    async def load_state(self) -> Dict[str, Any]:
        """
        Load the current runtime state.
        
        Returns cached version if available.
        
        Returns:
            Runtime state dictionary
        """
        if self._state_cache is None:
            try:
                self._state_cache = await self.iris_fs.read_json("runtime/state.json")
                logger.debug(f"Loaded runtime state: {self._state_cache.get('task_mode')}")
            except Exception as e:
                logger.warning(f"Failed to load runtime state, using default: {e}")
                self._state_cache = {
                    "initialized": True,
                    "version": "1.0",
                    "task_mode": None,
                    "current_phase": None,
                    "key_artifacts": [],
                    "last_updated": datetime.now(timezone.utc).isoformat()
                }
        
        return self._state_cache
    
    async def save_state(self, state: Optional[Dict[str, Any]] = None) -> None:
        """
        Save the runtime state.
        
        Args:
            state: State to save (default: use cached version)
        """
        if state is not None:
            self._state_cache = state
        
        if self._state_cache is not None:
            # Update timestamp
            self._state_cache["last_updated"] = datetime.now(timezone.utc).isoformat()
            
            try:
                await self.iris_fs.write_json("runtime/state.json", self._state_cache)
                self._cache_dirty = False
                logger.debug(f"Saved runtime state")
            except Exception as e:
                logger.error(f"Failed to save runtime state: {e}")
    
    async def update_state(self, **kwargs) -> None:
        """
        Update specific fields in the runtime state.
        
        Args:
            **kwargs: Fields to update (e.g., task_mode="research", current_phase="analysis")
        """
        state = await self.load_state()
        state.update(kwargs)
        self._state_cache = state
        self._cache_dirty = True
    
    async def add_artifact_reference(self, artifact_path: str, artifact_type: str, description: str = "") -> None:
        """
        Add a reference to a key artifact in the state.
        
        Args:
            artifact_path: Path to the artifact
            artifact_type: Type of artifact
            description: Optional description
        """
        state = await self.load_state()
        
        if "key_artifacts" not in state:
            state["key_artifacts"] = []
        
        artifact_ref = {
            "path": artifact_path,
            "type": artifact_type,
            "description": description,
            "added_at": datetime.now(timezone.utc).isoformat()
        }
        
        state["key_artifacts"].append(artifact_ref)
        self._state_cache = state
        self._cache_dirty = True
    
    async def load_turn_summaries(self) -> List[Dict[str, Any]]:
        """
        Load turn summaries from storage.
        
        Returns:
            List of turn summary dictionaries
        """
        if self._summaries_cache is None:
            try:
                self._summaries_cache = await self.iris_fs.read_json("runtime/turn_summaries.json")
                logger.debug(f"Loaded {len(self._summaries_cache)} turn summaries")
            except Exception as e:
                logger.warning(f"Failed to load turn summaries, using empty: {e}")
                self._summaries_cache = []
        
        return self._summaries_cache
    
    async def save_turn_summaries(self, summaries: Optional[List[Dict[str, Any]]] = None) -> None:
        """
        Save turn summaries to storage.
        
        Args:
            summaries: Summaries to save (default: use cached version)
        """
        if summaries is not None:
            self._summaries_cache = summaries
        
        if self._summaries_cache is not None:
            try:
                await self.iris_fs.write_json("runtime/turn_summaries.json", self._summaries_cache)
                logger.debug(f"Saved {len(self._summaries_cache)} turn summaries")
            except Exception as e:
                logger.error(f"Failed to save turn summaries: {e}")
    
    async def add_turn_summary(self, user_input: str, assistant_actions: str, key_points: List[str]) -> None:
        """
        Add a new turn summary.
        
        Args:
            user_input: Summary of user's input
            assistant_actions: Summary of assistant's actions
            key_points: List of key points/decisions from this turn
        """
        summaries = await self.load_turn_summaries()
        
        summary = {
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "user_input": user_input,
            "assistant_actions": assistant_actions,
            "key_points": key_points
        }
        
        summaries.append(summary)
        
        # Keep only last N summaries in memory (older ones can be archived)
        MAX_SUMMARIES = 50
        if len(summaries) > MAX_SUMMARIES:
            # Archive older summaries
            archived = summaries[:len(summaries) - MAX_SUMMARIES]
            summaries = summaries[-MAX_SUMMARIES:]
            
            # Could save archived summaries to a separate file
            logger.debug(f"Archived {len(archived)} older turn summaries")
        
        self._summaries_cache = summaries
        await self.save_turn_summaries()
    
    async def get_recent_summaries(self, count: int = 3) -> List[Dict[str, Any]]:
        """
        Get the most recent turn summaries.
        
        Args:
            count: Number of recent summaries to return
            
        Returns:
            List of recent turn summaries
        """
        summaries = await self.load_turn_summaries()
        return summaries[-count:] if len(summaries) > count else summaries
    
    async def get_state_summary(self) -> str:
        """
        Get a compact text summary of current runtime state.
        
        Returns:
            Formatted state summary string
        """
        state = await self.load_state()
        
        summary_parts = []
        
        if state.get("task_mode"):
            summary_parts.append(f"Mode: {state['task_mode']}")
        
        if state.get("current_phase"):
            summary_parts.append(f"Phase: {state['current_phase']}")
        
        key_artifacts = state.get("key_artifacts", [])
        if key_artifacts:
            summary_parts.append(f"Key artifacts: {len(key_artifacts)}")
        
        return " | ".join(summary_parts) if summary_parts else "No active state"
    
    async def flush_if_dirty(self) -> None:
        """Save state if it has been modified."""
        if self._cache_dirty:
            await self.save_state()
    
    async def clear_state(self) -> None:
        """Reset the runtime state to initial values."""
        self._state_cache = {
            "initialized": True,
            "version": "1.0",
            "task_mode": None,
            "current_phase": None,
            "key_artifacts": [],
            "last_updated": datetime.now(timezone.utc).isoformat()
        }
        await self.save_state()
        logger.info("Runtime state cleared")


class TurnSummarizer:
    """
    Generates compact summaries of conversation turns.
    
    Summaries are used to keep conversation history small while maintaining
    continuity and context.
    """
    
    @staticmethod
    def summarize_user_message(message: str, max_length: int = 200) -> str:
        """
        Create a compact summary of a user message.
        
        Args:
            message: User message content
            max_length: Maximum summary length
            
        Returns:
            Summarized message
        """
        if len(message) <= max_length:
            return message
        
        # Simple truncation with ellipsis
        # In production, could use LLM for better summarization
        return message[:max_length - 3] + "..."
    
    @staticmethod
    def summarize_assistant_turn(
        actions: List[str],
        tools_used: List[str],
        artifacts_created: List[str],
        max_length: int = 300
    ) -> str:
        """
        Create a compact summary of an assistant turn.
        
        Args:
            actions: List of actions taken
            tools_used: List of tools used
            artifacts_created: List of artifacts created
            max_length: Maximum summary length
            
        Returns:
            Formatted summary
        """
        parts = []
        
        if tools_used:
            parts.append(f"Tools: {', '.join(tools_used[:3])}")
        
        if artifacts_created:
            parts.append(f"Created: {', '.join(artifacts_created[:2])}")
        
        if actions:
            action_summary = "; ".join(actions[:2])
            if len(action_summary) > 150:
                action_summary = action_summary[:150] + "..."
            parts.append(action_summary)
        
        summary = " | ".join(parts)
        
        if len(summary) > max_length:
            summary = summary[:max_length - 3] + "..."
        
        return summary
