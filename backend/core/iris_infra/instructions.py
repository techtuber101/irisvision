"""
Custom instructions system for Iris infrastructure.

Manages pre-seeded instruction files that guide agent behavior across different
task types and operational modes.
"""

from typing import Dict, Optional
from daytona_sdk import AsyncSandbox
from core.utils.logger import logger
from core.iris_infra.sandbox_fs import IrisSandboxFS

# Instruction file templates
# These are distilled, token-optimized versions of instruction content

INSTRUCTION_TEMPLATES = {
    "system_core.md": """# Iris Core System Instructions

You are Iris, an autonomous AI agent operating in a sandboxed Linux environment.

## Core Capabilities
- File system operations in /workspace
- Shell command execution  
- Web search and browsing
- Code execution (Python, Node.js, etc.)
- Document creation and editing
- Data analysis and visualization

## Operational Guidelines
- Always work incrementally and verify results
- Use relative paths (not /workspace/...)
- Prefer CLI tools over writing code when practical
- Save artifacts and outputs for user access
- Update task lists as work progresses

## Workspace Structure
- Working directory: /workspace
- Iris infrastructure: /workspace/.iris/
- All user files and outputs go in /workspace
""",

    "coding_rules.md": """# Coding Style and Best Practices

## General Principles
- Write clean, readable, well-documented code
- Follow language-specific conventions
- Add error handling and validation
- Include type hints where supported
- Write modular, reusable functions

## File Operations
- Use edit_file for modifications
- Use create_file only for new files
- Test changes incrementally
- Back up important files before major changes

## Testing
- Write tests for new functionality
- Run tests before marking tasks complete
- Use pytest for Python, jest for JavaScript
""",

    "tools_general.md": """# Tool Usage Guidelines

## When to Use Tools
- Use web_search for research and current information
- Use shell commands for system operations
- Use file tools for code and document editing
- Use browser for interactive web navigation
- Use vision tools for image analysis

## Tool Best Practices
- Check tool output before proceeding
- Handle tool errors gracefully
- Use tools in logical sequence
- Batch operations when possible
- Cache and reuse tool results

## Tool Output Handling
- Large outputs are automatically cached
- Recent results are expanded in context
- Older results available via get_artifact()
""",

    "memory_protocol.md": """# Memory and Context Management

## Context Storage
- Task summaries in /workspace/.iris/task/
- Web results in /workspace/.iris/web_results/
- Artifacts in /workspace/.iris/artifacts/
- Runtime state in /workspace/.iris/runtime/

## Memory Best Practices
- Keep track of important decisions
- Reference previous work when relevant
- Update task summaries regularly
- Clean up temporary files

## KV Cache Usage
- Large tool outputs are automatically cached
- Use get_artifact() for historical data
- Cache keys follow pattern: tool_output_{type}_{id}
""",

    "context_selection.md": """# Context Selection Strategy

## What to Include in Context
- Current task description and goals
- Recent turn summaries (last 2-3 turns)
- Relevant file paths (not full contents)
- Active task list with statuses
- Key decisions and constraints

## What to Exclude
- Full file contents (use references)
- Old tool outputs (use cached references)
- Completed task details
- Redundant information

## File References
- List available files with short descriptions
- Include full content only when actively editing
- Use artifact keys for large data
""",

    "mode_planner.md": """# Task Planning and Execution

## Planning Phase
1. Understand user requirements
2. Break down into specific tasks
3. Create task list with sections
4. Identify tools and resources needed

## Execution Phase
1. Work through tasks sequentially
2. Update status as tasks complete
3. Save artifacts and outputs
4. Handle errors and adapt plan

## Completion Phase
1. Mark all tasks complete
2. Generate final deliverable
3. Provide executive summary
4. Suggest next steps
""",
}


async def seed_instructions(iris_fs: IrisSandboxFS) -> bool:
    """
    Seed instruction files into the sandbox if they don't already exist.
    
    This is idempotent - only creates files that are missing.
    
    Args:
        iris_fs: Iris filesystem abstraction
        
    Returns:
        True if seeding successful, False on error
    """
    try:
        logger.info("Seeding Iris instruction files")
        
        seeded_count = 0
        skipped_count = 0
        
        for filename, content in INSTRUCTION_TEMPLATES.items():
            file_path = f"instructions/{filename}"
            
            # Check if file already exists
            if await iris_fs.file_exists(file_path):
                logger.debug(f"Instruction file already exists: {filename}")
                skipped_count += 1
                continue
            
            # Create the file
            try:
                await iris_fs.write_file(file_path, content)
                logger.debug(f"Seeded instruction file: {filename}")
                seeded_count += 1
            except Exception as e:
                logger.error(f"Failed to seed instruction file {filename}: {e}")
                return False
        
        logger.info(f"✅ Instruction seeding complete: {seeded_count} created, {skipped_count} skipped")
        return True
        
    except Exception as e:
        logger.error(f"Failed to seed instructions: {e}", exc_info=True)
        return False


class InstructionLoader:
    """
    Manages loading and caching of instruction files.
    
    Instructions are loaded once at initialization and cached in memory
    to avoid repeated filesystem operations.
    """
    
    def __init__(self, iris_fs: IrisSandboxFS):
        """
        Initialize the instruction loader.
        
        Args:
            iris_fs: Iris filesystem abstraction
        """
        self.iris_fs = iris_fs
        self._cache: Dict[str, str] = {}
        self._loaded = False
    
    async def load_all(self) -> Dict[str, str]:
        """
        Load all instruction files into memory cache.
        
        Returns:
            Dictionary mapping filename to content
        """
        if self._loaded:
            return self._cache
        
        try:
            logger.debug("Loading instruction files into memory")
            
            for filename in INSTRUCTION_TEMPLATES.keys():
                file_path = f"instructions/{filename}"
                try:
                    content = await self.iris_fs.read_file(file_path)
                    if isinstance(content, bytes):
                        content = content.decode('utf-8')
                    self._cache[filename] = content
                    logger.debug(f"Loaded instruction: {filename} ({len(content)} chars)")
                except Exception as e:
                    logger.warning(f"Failed to load instruction {filename}, using template: {e}")
                    self._cache[filename] = INSTRUCTION_TEMPLATES[filename]
            
            self._loaded = True
            logger.info(f"✅ Loaded {len(self._cache)} instruction files into memory")
            return self._cache
            
        except Exception as e:
            logger.error(f"Failed to load instructions: {e}", exc_info=True)
            return {}
    
    async def get(self, filename: str) -> Optional[str]:
        """
        Get a specific instruction file.
        
        Args:
            filename: Name of the instruction file (e.g., "system_core.md")
            
        Returns:
            Instruction content, or None if not found
        """
        if not self._loaded:
            await self.load_all()
        
        return self._cache.get(filename)
    
    async def get_core_instructions(self) -> str:
        """
        Get the essential core instructions.
        
        Combines system_core, coding_rules, and tools_general into a single
        prompt-ready string.
        
        Returns:
            Combined core instructions
        """
        if not self._loaded:
            await self.load_all()
        
        core_files = ["system_core.md", "coding_rules.md", "tools_general.md"]
        sections = []
        
        for filename in core_files:
            content = self._cache.get(filename)
            if content:
                sections.append(content)
        
        return "\n\n---\n\n".join(sections)
    
    def get_cached(self) -> Dict[str, str]:
        """
        Get all cached instructions without loading.
        
        Returns:
            Cached instructions dictionary (may be empty if not loaded)
        """
        return self._cache
