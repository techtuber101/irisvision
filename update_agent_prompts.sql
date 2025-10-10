-- SQL Script to Update Agent Prompts from Backend
-- This script updates all agent prompts to use the latest system prompt from the backend

-- First, let's create a temporary function to get the current system prompt
-- This would typically be called from the backend application
CREATE OR REPLACE FUNCTION get_current_system_prompt()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    -- This function should be called from the backend application
    -- to get the current system prompt content
    -- For now, we'll use a placeholder that needs to be replaced
    -- with the actual prompt content from backend/core/prompts/prompt.py
    
    RETURN 'PLACEHOLDER_SYSTEM_PROMPT_CONTENT';
END;
$$;

-- Update all agents to use the current system prompt
-- This updates both the config JSONB field and the legacy system_prompt field
UPDATE agents 
SET 
    config = jsonb_set(
        COALESCE(config, '{}'::jsonb),
        '{system_prompt}',
        to_jsonb(get_current_system_prompt())
    ),
    system_prompt = get_current_system_prompt(),
    updated_at = NOW()
WHERE 
    -- Only update agents that don't have a custom system prompt
    -- or are marked as centrally managed
    (
        config->>'system_prompt' IS NULL 
        OR config->>'system_prompt' = ''
        OR config->'metadata'->>'centrally_managed' = 'true'
        OR metadata->>'is_suna_default' = 'true'
    )
    -- Don't update agents that have custom prompts
    AND NOT (
        config->>'system_prompt' IS NOT NULL 
        AND config->>'system_prompt' != ''
        AND config->'metadata'->>'centrally_managed' = 'false'
        AND metadata->>'is_suna_default' != 'true'
    );

-- Also update agent versions that are centrally managed
UPDATE agent_versions 
SET 
    config = jsonb_set(
        COALESCE(config, '{}'::jsonb),
        '{system_prompt}',
        to_jsonb(get_current_system_prompt())
    ),
    system_prompt = get_current_system_prompt(),
    updated_at = NOW()
WHERE 
    -- Only update versions that are centrally managed
    (
        config->>'system_prompt' IS NULL 
        OR config->>'system_prompt' = ''
        OR config->'metadata'->>'centrally_managed' = 'true'
    )
    -- Don't update versions with custom prompts
    AND NOT (
        config->>'system_prompt' IS NOT NULL 
        AND config->>'system_prompt' != ''
        AND config->'metadata'->>'centrally_managed' = 'false'
    );

-- Show summary of updated agents
SELECT 
    'Updated Agents' as summary,
    COUNT(*) as count
FROM agents 
WHERE updated_at > NOW() - INTERVAL '1 minute';

-- Show summary of updated agent versions
SELECT 
    'Updated Agent Versions' as summary,
    COUNT(*) as count
FROM agent_versions 
WHERE updated_at > NOW() - INTERVAL '1 minute';

-- Clean up the temporary function
DROP FUNCTION get_current_system_prompt();

-- Optional: Show which agents were updated
SELECT 
    agent_id,
    name,
    account_id,
    CASE 
        WHEN metadata->>'is_suna_default' = 'true' THEN 'Default Agent'
        WHEN config->'metadata'->>'centrally_managed' = 'true' THEN 'Centrally Managed'
        ELSE 'Custom Agent'
    END as agent_type,
    updated_at
FROM agents 
WHERE updated_at > NOW() - INTERVAL '1 minute'
ORDER BY updated_at DESC;
