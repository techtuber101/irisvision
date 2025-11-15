"""
Sandbox folder structure initialization for Iris infrastructure.

This module handles the one-time setup of the .iris/ directory structure
in the Daytona sandbox workspace.
"""

import asyncio
from typing import Optional
from daytona_sdk import AsyncSandbox
from core.utils.logger import logger

# Root path for all Iris infrastructure in the sandbox
IRIS_ROOT = "/workspace/.iris"

# Directory structure to be created
IRIS_STRUCTURE = {
    "instructions": "Pre-seeded custom instructions (system-level and mode-specific)",
    "project": "Long-lived project-specific docs (architecture, spec, brand, etc.)",
    "task": "Per-task state, summaries, turn history, task-local notes",
    "web_results": "Cached web search results, scraped data",
    "artifacts": "Generated outputs (documents, code, JSON, reports, etc.)",
    "memory": "Long-term semantic memory, if any",
    "embeddings": "Embedding index files / vectors (optional, if used)",
    "runtime": "Runtime metadata, state files, indexes",
}

# Files to create in runtime directory
RUNTIME_FILES = {
    "state.json": '{"initialized": true, "version": "1.0", "task_mode": null, "current_phase": null}',
    "index.json": "[]",
    "last_turn.json": "{}",
    "turn_summaries.json": "[]",
}


async def ensure_iris_structure(sandbox: AsyncSandbox) -> bool:
    """
    Ensure the .iris/ directory structure exists in the sandbox.
    
    This function is idempotent - safe to call multiple times.
    It will only create directories and files that don't already exist.
    
    Args:
        sandbox: The Daytona sandbox instance
        
    Returns:
        True if structure was created or already exists, False on error
    """
    try:
        # Check if .iris root already exists
        try:
            await sandbox.fs.get_file_info(IRIS_ROOT)
            logger.debug(f"Iris structure already exists at {IRIS_ROOT}")
            return True
        except Exception:
            # Directory doesn't exist, we'll create it
            logger.info(f"Initializing Iris infrastructure at {IRIS_ROOT}")
        
        # Create root directory
        await sandbox.fs.create_folder(IRIS_ROOT, "755")
        logger.debug(f"Created root directory: {IRIS_ROOT}")
        
        # Create subdirectories
        for dir_name, description in IRIS_STRUCTURE.items():
            dir_path = f"{IRIS_ROOT}/{dir_name}"
            try:
                await sandbox.fs.create_folder(dir_path, "755")
                logger.debug(f"Created directory: {dir_path} ({description})")
            except Exception as e:
                # Directory might already exist, that's okay
                logger.debug(f"Directory {dir_path} already exists or error: {e}")
        
        # Create runtime files
        runtime_dir = f"{IRIS_ROOT}/runtime"
        for filename, content in RUNTIME_FILES.items():
            file_path = f"{runtime_dir}/{filename}"
            try:
                # Check if file already exists
                try:
                    await sandbox.fs.get_file_info(file_path)
                    logger.debug(f"Runtime file already exists: {file_path}")
                    continue
                except Exception:
                    pass
                
                # Create the file
                await sandbox.fs.upload_file(content.encode('utf-8'), file_path)
                logger.debug(f"Created runtime file: {file_path}")
            except Exception as e:
                logger.warning(f"Failed to create runtime file {file_path}: {e}")
        
        logger.info(f"✅ Iris infrastructure initialized successfully at {IRIS_ROOT}")
        return True
        
    except Exception as e:
        logger.error(f"Failed to initialize Iris structure: {e}", exc_info=True)
        return False


async def check_iris_initialized(sandbox: AsyncSandbox) -> bool:
    """
    Check if the Iris infrastructure has been initialized in the sandbox.
    
    Args:
        sandbox: The Daytona sandbox instance
        
    Returns:
        True if initialized, False otherwise
    """
    try:
        await sandbox.fs.get_file_info(IRIS_ROOT)
        await sandbox.fs.get_file_info(f"{IRIS_ROOT}/runtime/state.json")
        return True
    except Exception:
        return False


async def reset_iris_structure(sandbox: AsyncSandbox) -> bool:
    """
    Reset the Iris infrastructure by removing and recreating the structure.
    
    WARNING: This will delete all data in .iris/
    
    Args:
        sandbox: The Daytona sandbox instance
        
    Returns:
        True if reset successful, False on error
    """
    try:
        logger.warning(f"Resetting Iris infrastructure at {IRIS_ROOT}")
        
        # Try to remove the existing structure
        try:
            # Note: Daytona SDK might not have a direct delete_directory method
            # We might need to use shell commands for this
            result = await sandbox.process.execute_command(f"rm -rf {IRIS_ROOT}")
            logger.debug(f"Removed existing structure: {result}")
        except Exception as e:
            logger.warning(f"Failed to remove existing structure (might not exist): {e}")
        
        # Recreate the structure
        return await ensure_iris_structure(sandbox)
        
    except Exception as e:
        logger.error(f"Failed to reset Iris structure: {e}", exc_info=True)
        return False
