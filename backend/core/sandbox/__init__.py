"""
Sandbox module for Iris agent context management.

Provides:
- KV cache for context offloading
- Instruction seeding and management
- Sandbox filesystem operations
- Tool base classes
"""

from core.sandbox.kv_store import SandboxKVStore
from core.sandbox.instruction_seeder import seed_instructions_to_cache, InstructionSeeder
from core.sandbox.tool_base import SandboxToolsBase

__all__ = [
    "SandboxKVStore",
    "seed_instructions_to_cache",
    "InstructionSeeder",
    "SandboxToolsBase",
]
