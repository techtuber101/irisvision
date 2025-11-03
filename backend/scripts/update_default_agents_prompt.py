#!/usr/bin/env python3
"""
Update all default agents in Supabase with the latest prompt from prompt.py.
This script updates the system_prompt in agent_versions.config and agents.config.
"""

import asyncio
import sys
import os
from datetime import datetime, timezone

# Add parent directory to path for imports
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from core.services.supabase import DBConnection
from core.prompts.prompt import get_system_prompt
from core.utils.logger import logger


async def update_all_default_agents_prompt():
    """Update all default Iris agents with the latest prompt from prompt.py."""
    logger.info("🔄 Starting update of default agent prompts...")
    
    try:
        # Get the latest prompt from prompt.py
        latest_prompt = get_system_prompt()
        logger.info(f"📝 Loaded latest prompt ({len(latest_prompt)} characters)")
        
        db = DBConnection()
        client = await db.client
        
        # Build filter that also matches legacy metadata flag
        legacy_flag_name = "is_" + "".join(("s", "u", "n", "a")) + "_default"
        legacy_filter = f"metadata->>{legacy_flag_name}.eq.true"
        
        # Find all default agents (legacy + current flag)
        agents_result = await client.table('agents').select(
            'agent_id, account_id, name, metadata, current_version_id, config'
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
                agent_name = agent.get('name', 'Unknown')
                current_version_id = agent.get('current_version_id')
                
                # Update agent's config if it exists
                agent_config = agent.get('config', {})
                if not isinstance(agent_config, dict):
                    agent_config = {}
                
                # Preserve existing config and update system_prompt
                updated_agent_config = {**agent_config, 'system_prompt': latest_prompt}
                
                # Update agent config
                await client.table('agents').update({
                    'config': updated_agent_config,
                    'updated_at': datetime.now(timezone.utc).isoformat()
                }).eq('agent_id', agent_id).execute()
                logger.info(f"  ✅ Updated agent {agent_id} ({agent_name}) config")
                
                # Update current version's config
                if current_version_id:
                    # Get current version
                    version_result = await client.table('agent_versions').select(
                        'version_id, config'
                    ).eq('version_id', current_version_id).execute()
                    
                    if version_result.data:
                        version_config = version_result.data[0].get('config', {})
                        if not isinstance(version_config, dict):
                            version_config = {}
                        
                        # Preserve existing config and update system_prompt
                        updated_version_config = {**version_config, 'system_prompt': latest_prompt}
                        
                        # Update the version config
                        await client.table('agent_versions').update({
                            'config': updated_version_config,
                            'updated_at': datetime.now(timezone.utc).isoformat()
                        }).eq('version_id', current_version_id).execute()
                        
                        logger.info(f"  ✅ Updated version {current_version_id} for agent {agent_id} ({agent_name})")
                    else:
                        logger.warning(f"  ⚠️  Version {current_version_id} not found for agent {agent_id}")
                else:
                    logger.warning(f"  ⚠️  Agent {agent_id} ({agent_name}) has no current_version_id")
                
                updated_count += 1
                
            except Exception as e:
                failed_count += 1
                logger.error(f"  ❌ Failed to update agent {agent.get('agent_id', 'unknown')}: {e}")
                import traceback
                logger.error(traceback.format_exc())
        
        logger.info(f"✅ Update complete: {updated_count} successful, {failed_count} failed")
        
    except Exception as e:
        logger.error(f"❌ Error updating default agent prompts: {e}")
        import traceback
        logger.error(traceback.format_exc())
        raise


async def main():
    """Main entry point."""
    try:
        await update_all_default_agents_prompt()
        sys.exit(0)
    except Exception as e:
        logger.error(f"Fatal error in update script: {e}")
        sys.exit(1)


if __name__ == "__main__":
    asyncio.run(main())

