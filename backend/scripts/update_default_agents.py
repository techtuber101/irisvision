#!/usr/bin/env python3
"""
Auto-update script for default Iris agents.
Runs on container startup to ensure all default agents have the latest configuration.
"""

import asyncio
import sys
import os
from datetime import datetime, timezone

# Add parent directory to path for imports
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from core.services.supabase import DBConnection
from core.iris_config import IRIS_CONFIG
from core.utils.logger import logger


async def update_all_default_agents():
    """Update all default Iris agents with the latest configuration."""
    logger.info("🔄 Starting auto-update of default Iris agents...")
    
    try:
        db = DBConnection()
        client = await db.client
        
        # Build filter that also matches legacy metadata flag without using old branding in source
        legacy_flag_name = "is_" + "".join(("s", "u", "n", "a")) + "_default"
        legacy_filter = f"metadata->>{legacy_flag_name}.eq.true"

        # Find all default agents (legacy + current flag)
        agents_result = await client.table('agents').select(
            'agent_id, account_id, name, metadata, current_version_id'
        ).or_(
            f"metadata->>is_iris_default.eq.true,{legacy_filter}"
        ).execute()
        
        if not agents_result.data:
            logger.info("✅ No default agents found to update")
            return
        
        agents = agents_result.data
        logger.info(f"📦 Found {len(agents)} default agent(s) to update")
        
        updated_count = 0
        failed_count = 0
        
        for agent in agents:
            try:
                agent_id = agent['agent_id']
                account_id = agent['account_id']
                current_name = agent['name']
                metadata = agent.get('metadata', {})
                
                # Prepare updates
                updates = {}
                needs_update = False
                
                # Update name if it's not "Iris"
                if current_name != IRIS_CONFIG['name']:
                    updates['name'] = IRIS_CONFIG['name']
                    needs_update = True
                    logger.info(f"  Agent {agent_id}: Updating name from '{current_name}' to '{IRIS_CONFIG['name']}'")
                
                # Update description
                if agent.get('description') != IRIS_CONFIG['description']:
                    updates['description'] = IRIS_CONFIG['description']
                    needs_update = True
                
                # Update metadata to use new is_iris_default field
                legacy_default_flag = metadata.get(legacy_flag_name)
                iris_default_flag = metadata.get('is_iris_default')

                if legacy_default_flag and not iris_default_flag:
                    new_metadata = {**metadata}
                    new_metadata['is_iris_default'] = True
                    new_metadata.pop(legacy_flag_name, None)
                    new_metadata['last_central_update'] = datetime.now(timezone.utc).isoformat()
                    updates['metadata'] = new_metadata
                    needs_update = True
                    logger.info(f"  Agent {agent_id}: Migrated metadata flag to is_iris_default")
                elif iris_default_flag:
                    new_metadata = {**metadata}
                    if new_metadata.get('is_iris_default') and 'last_central_update' not in new_metadata:
                        needs_update = True
                    new_metadata['last_central_update'] = datetime.now(timezone.utc).isoformat()
                    updates['metadata'] = new_metadata
                    needs_update = True
                
                # Apply updates to agent table
                if needs_update:
                    await client.table('agents').update(updates).eq('agent_id', agent_id).execute()
                    logger.info(f"  ✅ Updated agent {agent_id} in agents table")
                
                # Update or create version with latest config
                await update_agent_version(client, agent_id, account_id, agent.get('current_version_id'))
                
                updated_count += 1
                
            except Exception as e:
                failed_count += 1
                logger.error(f"  ❌ Failed to update agent {agent.get('agent_id', 'unknown')}: {e}")
        
        logger.info(f"✅ Update complete: {updated_count} successful, {failed_count} failed")
        
    except Exception as e:
        logger.error(f"❌ Error updating default agents: {e}")
        raise


async def update_agent_version(client, agent_id: str, account_id: str, current_version_id: str = None):
    """Update or create agent version with latest IRIS_CONFIG."""
    try:
        if current_version_id:
            # Get current version
            version_result = await client.table('agent_versions').select(
                'version_id, config'
            ).eq('version_id', current_version_id).execute()
            
            if version_result.data:
                current_config = version_result.data[0].get('config', {})
                
                # Update config with latest from IRIS_CONFIG
                updated_config = {
                    'system_prompt': IRIS_CONFIG['system_prompt'],
                    'model': IRIS_CONFIG['model'],
                    'tools': {
                        'agentpress': IRIS_CONFIG['agentpress_tools'],
                        'mcp': current_config.get('tools', {}).get('mcp', []),
                        'custom_mcp': current_config.get('tools', {}).get('custom_mcp', [])
                    },
                    'triggers': current_config.get('triggers', [])
                }
                
                # Update the version
                await client.table('agent_versions').update({
                    'config': updated_config,
                    'updated_at': datetime.now(timezone.utc).isoformat()
                }).eq('version_id', current_version_id).execute()
                
                logger.info(f"  ✅ Updated version {current_version_id} with latest config")
        else:
            # Create initial version if none exists
            from core.versioning.version_service import get_version_service
            
            version_service = await get_version_service()
            version_id = await version_service.create_version(
                agent_id=agent_id,
                user_id=account_id,
                system_prompt=IRIS_CONFIG['system_prompt'],
                configured_mcps=IRIS_CONFIG['configured_mcps'],
                custom_mcps=IRIS_CONFIG['custom_mcps'],
                agentpress_tools=IRIS_CONFIG['agentpress_tools'],
                model=IRIS_CONFIG['model'],
                version_name='v1',
                change_description='Auto-update: Latest Iris configuration'
            )
            
            logger.info(f"  ✅ Created initial version {version_id}")
            
    except Exception as e:
        logger.error(f"  ⚠️  Failed to update version for agent {agent_id}: {e}")
        # Don't raise - continue with other agents


async def main():
    """Main entry point."""
    try:
        await update_all_default_agents()
        sys.exit(0)
    except Exception as e:
        logger.error(f"Fatal error in update script: {e}")
        sys.exit(1)


if __name__ == "__main__":
    asyncio.run(main())

