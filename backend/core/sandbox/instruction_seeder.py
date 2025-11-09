"""
Instruction Seeding System for Iris KV Cache.

This module handles seeding instruction files from the canonical repository
into the KV cache within each project's sandbox. Instructions are stored
in /workspace/.iris/kv-cache/instructions/ and can be retrieved on demand
by the agent during task execution.

Usage:
    from core.sandbox.instruction_seeder import seed_instructions_to_cache
    
    await seed_instructions_to_cache(sandbox, force_refresh=False)
"""

import os
from pathlib import Path
from typing import Dict, List, Optional
from daytona_sdk import AsyncSandbox
from core.sandbox.kv_store import SandboxKVStore
from core.utils.logger import logger


# Define instruction file mappings
INSTRUCTION_FILES = {
    "presentation": {
        "file": "presentation_instructions.md",
        "tag": "presentation",
        "description": "Comprehensive presentation creation workflow and guidelines"
    },
    "document_creation": {
        "file": "document_creation_instructions.md",
        "tag": "document_creation",
        "description": "Document and PDF creation instructions with TipTap formatting"
    },
    "research": {
        "file": "research_instructions.md",
        "tag": "research",
        "description": "Research, analysis, and visualization workflow guidelines"
    },
    "web_development": {
        "file": "web_development_instructions.md",
        "tag": "web_development",
        "description": "Web development, deployment, and UI design standards"
    }
}


class InstructionSeeder:
    """Manages seeding of instruction files into KV cache."""
    
    def __init__(self, sandbox: AsyncSandbox):
        """
        Initialize instruction seeder.
        
        Args:
            sandbox: AsyncSandbox instance
        """
        self.sandbox = sandbox
        self.kv_store = SandboxKVStore(sandbox)
        self.instructions_dir = Path(__file__).parent.parent / "instructions"
    
    async def seed_all_instructions(self, force_refresh: bool = False) -> Dict[str, bool]:
        """
        Seed all instruction files into KV cache.
        
        Args:
            force_refresh: If True, overwrite existing instructions
            
        Returns:
            Dict mapping instruction tags to success status
        """
        results = {}
        
        for key, config in INSTRUCTION_FILES.items():
            try:
                success = await self.seed_instruction(
                    tag=config["tag"],
                    filename=config["file"],
                    description=config["description"],
                    force_refresh=force_refresh
                )
                results[config["tag"]] = success
            except Exception as e:
                logger.error(f"Failed to seed instruction '{config['tag']}': {e}")
                results[config["tag"]] = False
        
        seeded_count = sum(1 for v in results.values() if v)
        logger.info(
            f"Instruction seeding complete: {seeded_count}/{len(INSTRUCTION_FILES)} "
            f"instructions seeded successfully"
        )
        
        return results
    
    async def seed_instruction(
        self,
        tag: str,
        filename: str,
        description: str,
        force_refresh: bool = False
    ) -> bool:
        """
        Seed a single instruction file into KV cache.
        
        Args:
            tag: Instruction tag/identifier
            filename: Name of instruction file
            description: Human-readable description
            force_refresh: If True, overwrite existing instruction
            
        Returns:
            True if seeded successfully, False otherwise
        """
        # Check if instruction already exists
        if not force_refresh:
            try:
                existing = await self.kv_store.get_metadata(
                    scope="instructions",
                    key=f"instruction_{tag}"
                )
                logger.debug(
                    f"Instruction '{tag}' already exists in cache "
                    f"(created: {existing['created_at']})"
                )
                return True
            except Exception:
                # Instruction doesn't exist, proceed with seeding
                pass
        
        # Load instruction file from repository
        instruction_path = self.instructions_dir / filename
        if not instruction_path.exists():
            logger.error(f"Instruction file not found: {instruction_path}")
            return False
        
        try:
            with open(instruction_path, 'r', encoding='utf-8') as f:
                content = f.read()
        except Exception as e:
            logger.error(f"Failed to read instruction file {instruction_path}: {e}")
            return False
        
        # Store in KV cache
        try:
            await self.kv_store.put(
                scope="instructions",
                key=f"instruction_{tag}",
                value=content,
                ttl_hours=168,  # 1 week
                metadata={
                    "description": description,
                    "filename": filename,
                    "source": "canonical_repository",
                    "auto_seeded": True
                },
                content_type="text/markdown"
            )
            logger.info(f"Successfully seeded instruction '{tag}' into KV cache")
            return True
        except Exception as e:
            logger.error(f"Failed to store instruction '{tag}' in KV cache: {e}")
            return False
    
    async def verify_instructions(self) -> Dict[str, bool]:
        """
        Verify all instructions are present in cache.
        
        Returns:
            Dict mapping instruction tags to presence status
        """
        results = {}
        
        for key, config in INSTRUCTION_FILES.items():
            try:
                await self.kv_store.get_metadata(
                    scope="instructions",
                    key=f"instruction_{config['tag']}"
                )
                results[config["tag"]] = True
            except Exception:
                results[config["tag"]] = False
        
        return results


async def seed_instructions_to_cache(
    sandbox: AsyncSandbox,
    force_refresh: bool = False
) -> Dict[str, bool]:
    """
    Convenience function to seed instructions into KV cache.
    
    Args:
        sandbox: AsyncSandbox instance
        force_refresh: If True, overwrite existing instructions
        
    Returns:
        Dict mapping instruction tags to success status
    """
    seeder = InstructionSeeder(sandbox)
    return await seeder.seed_all_instructions(force_refresh=force_refresh)


async def get_instruction_reference_text(tag: str) -> str:
    """
    Get reference text to inject into prompt for a specific instruction.
    
    This generates a short directive that tells the agent where to find
    the instruction file, rather than including the full content inline.
    
    Args:
        tag: Instruction tag (presentation, research, etc.)
        
    Returns:
        Reference text to include in prompt
    """
    config = INSTRUCTION_FILES.get(tag)
    if not config:
        return ""
    
    return f"""
## {config['description']}

**IMPORTANT:** Complete instructions for {tag} tasks are stored in the KV cache.
Before starting {tag} tasks, retrieve instructions using:

```
<function_calls>
<invoke name="get_instruction">
<parameter name="tag">{tag}</parameter>
</invoke>
</function_calls>
```

This will load the full {config['description'].lower()} into context only when needed,
reducing baseline token usage.
"""


def get_all_instruction_references() -> str:
    """
    Get reference text for all available instructions.
    
    Returns:
        Combined reference text for all instructions
    """
    references = []
    
    references.append("# Available Instructions in KV Cache\n")
    references.append(
        "The following instruction sets are available in the KV cache. "
        "Retrieve them only when needed for specific tasks:\n"
    )
    
    for key, config in INSTRUCTION_FILES.items():
        references.append(
            f"\n- **{config['tag']}**: {config['description']}\n"
            f"  Retrieve with: `get_instruction` tool using tag=\"{config['tag']}\"\n"
        )
    
    references.append(
        "\n**Benefits of KV Cache Instructions:**\n"
        "- Reduces baseline prompt token count by ~30k+ tokens\n"
        "- Load instructions only when task requires them\n"
        "- Instructions are versioned and can be updated independently\n"
        "- Consistent across all projects and agents\n"
    )
    
    return "".join(references)
