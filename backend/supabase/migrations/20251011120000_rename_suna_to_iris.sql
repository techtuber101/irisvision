BEGIN;

-- =====================================================
-- Migration: Rename all Suna references to Iris
-- =====================================================
-- This migration renames all default agents and related
-- functions from "Suna" to "Iris" for branding update.
-- Works for existing and future accounts.
-- =====================================================

-- Step 1: Update all agent names containing "Suna" to "Iris"
-- This handles various case combinations
UPDATE agents 
SET name = REPLACE(REPLACE(REPLACE(REPLACE(
    name,
    'Suna', 'Iris'),
    'suna', 'iris'),
    'SUNA', 'IRIS'),
    'SuNa', 'Iris')
WHERE name ILIKE '%suna%'
AND COALESCE((metadata->>'is_suna_default')::boolean, false) = true;

-- Step 2: Update agent descriptions containing "Suna" to "Iris"
UPDATE agents 
SET description = REPLACE(REPLACE(REPLACE(REPLACE(
    description,
    'Suna', 'Iris'),
    'suna', 'iris'),
    'SUNA', 'IRIS'),
    'SuNa', 'Iris')
WHERE description IS NOT NULL 
AND description ILIKE '%suna%'
AND COALESCE((metadata->>'is_suna_default')::boolean, false) = true;

-- Step 3: Update metadata field from is_suna_default to is_iris_default
-- Keep old field for backward compatibility initially, then remove it
UPDATE agents
SET metadata = metadata 
    - 'is_suna_default'
    || jsonb_build_object('is_iris_default', (metadata->>'is_suna_default')::boolean)
WHERE metadata->>'is_suna_default' IS NOT NULL;

-- Step 4: Update index for new metadata field
DROP INDEX IF EXISTS idx_agents_suna_default;
CREATE INDEX IF NOT EXISTS idx_agents_iris_default 
ON agents((metadata->>'is_iris_default')) 
WHERE metadata->>'is_iris_default' = 'true';

-- Step 5: Update unique constraint for Iris default agents
DROP INDEX IF EXISTS idx_agents_suna_default_unique;
CREATE UNIQUE INDEX IF NOT EXISTS idx_agents_iris_default_unique 
ON agents(account_id) 
WHERE metadata->>'is_iris_default' = 'true';

-- Step 6: Update metadata column comment
COMMENT ON COLUMN agents.metadata IS 'Stores additional agent metadata including:
- is_iris_default: boolean - Whether this is the official Iris default agent
- centrally_managed: boolean - Whether this agent is managed centrally by Iris
- management_version: string - Version identifier for central management
- restrictions: object - What editing restrictions apply to this agent
- installation_date: timestamp - When this agent was installed
- last_central_update: timestamp - Last time centrally managed updates were applied';

-- Step 7: Create new functions with Iris naming

-- Function to check if agent is Iris default
CREATE OR REPLACE FUNCTION is_iris_default_agent(agent_row agents)
RETURNS boolean
LANGUAGE plpgsql
IMMUTABLE
AS $$
BEGIN
    -- Check both old and new metadata fields for backward compatibility
    RETURN COALESCE(
        (agent_row.metadata->>'is_iris_default')::boolean,
        (agent_row.metadata->>'is_suna_default')::boolean,
        false
    );
END;
$$;

-- Function to find Iris default agent for an account
CREATE OR REPLACE FUNCTION find_iris_default_agent_for_account(p_account_id UUID)
RETURNS TABLE (
    agent_id UUID,
    account_id UUID,
    name VARCHAR(255),
    description TEXT,
    system_prompt TEXT,
    configured_mcps JSONB,
    custom_mcps JSONB,
    agentpress_tools JSONB,
    is_default BOOLEAN,
    avatar VARCHAR(10),
    avatar_color VARCHAR(7),
    metadata JSONB,
    created_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ,
    is_active BOOLEAN,
    is_public BOOLEAN,
    marketplace_published_at TIMESTAMPTZ,
    download_count INTEGER,
    tags TEXT[],
    current_version_id UUID,
    version_count INTEGER
)
SECURITY DEFINER
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        a.agent_id,
        a.account_id,
        a.name,
        a.description,
        a.system_prompt,
        a.configured_mcps,
        a.custom_mcps,
        a.agentpress_tools,
        a.is_default,
        a.avatar,
        a.avatar_color,
        a.metadata,
        a.created_at,
        a.updated_at,
        true as is_active,
        COALESCE(a.is_public, false) as is_public,
        a.marketplace_published_at,
        COALESCE(a.download_count, 0) as download_count,
        COALESCE(a.tags, '{}') as tags,
        a.current_version_id,
        COALESCE(a.version_count, 1) as version_count
    FROM agents a
    WHERE a.account_id = p_account_id 
    AND (
        COALESCE((a.metadata->>'is_iris_default')::boolean, false) = true
        OR COALESCE((a.metadata->>'is_suna_default')::boolean, false) = true
    )
    ORDER BY a.created_at DESC
    LIMIT 1;
END;
$$;

-- Function to get all Iris default agents
CREATE OR REPLACE FUNCTION get_all_iris_default_agents()
RETURNS TABLE (
    agent_id UUID,
    account_id UUID,
    name VARCHAR(255),
    description TEXT,
    system_prompt TEXT,
    configured_mcps JSONB,
    custom_mcps JSONB,
    agentpress_tools JSONB,
    is_default BOOLEAN,
    avatar VARCHAR(10),
    avatar_color VARCHAR(7),
    metadata JSONB,
    created_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ,
    is_active BOOLEAN,
    management_version TEXT,
    centrally_managed BOOLEAN
)
SECURITY DEFINER
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        a.agent_id,
        a.account_id,
        a.name,
        a.description,
        a.system_prompt,
        a.configured_mcps,
        a.custom_mcps,
        a.agentpress_tools,
        a.is_default,
        a.avatar,
        a.avatar_color,
        a.metadata,
        a.created_at,
        a.updated_at,
        true as is_active,
        a.metadata->>'management_version' as management_version,
        COALESCE((a.metadata->>'centrally_managed')::boolean, false) as centrally_managed
    FROM agents a
    WHERE (
        COALESCE((a.metadata->>'is_iris_default')::boolean, false) = true
        OR COALESCE((a.metadata->>'is_suna_default')::boolean, false) = true
    )
    ORDER BY a.created_at DESC;
END;
$$;

-- Function to count agents by management version
CREATE OR REPLACE FUNCTION count_iris_agents_by_version(p_version TEXT)
RETURNS INTEGER
SECURITY DEFINER
LANGUAGE plpgsql
AS $$
DECLARE
    agent_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO agent_count
    FROM agents a
    WHERE (
        COALESCE((a.metadata->>'is_iris_default')::boolean, false) = true
        OR COALESCE((a.metadata->>'is_suna_default')::boolean, false) = true
    )
    AND a.metadata->>'management_version' = p_version;
    
    RETURN COALESCE(agent_count, 0);
END;
$$;

-- Function to get Iris default agent statistics
CREATE OR REPLACE FUNCTION get_iris_default_agent_stats()
RETURNS TABLE (
    total_agents INTEGER,
    active_agents INTEGER,
    inactive_agents INTEGER,
    version_distribution JSONB,
    creation_dates JSONB
)
SECURITY DEFINER
LANGUAGE plpgsql
AS $$
DECLARE
    total_count INTEGER;
    active_count INTEGER;
    inactive_count INTEGER;
    version_stats JSONB;
    creation_stats JSONB;
BEGIN
    -- Get total count
    SELECT COUNT(*) INTO total_count
    FROM agents a
    WHERE (
        COALESCE((a.metadata->>'is_iris_default')::boolean, false) = true
        OR COALESCE((a.metadata->>'is_suna_default')::boolean, false) = true
    );
    
    -- Get active count (all Iris agents are considered active)
    SELECT COUNT(*) INTO active_count
    FROM agents a
    WHERE (
        COALESCE((a.metadata->>'is_iris_default')::boolean, false) = true
        OR COALESCE((a.metadata->>'is_suna_default')::boolean, false) = true
    );
    
    -- Calculate inactive count
    inactive_count := total_count - active_count;
    
    -- Get version distribution
    SELECT jsonb_object_agg(
        COALESCE(a.metadata->>'management_version', 'unknown'),
        version_count
    ) INTO version_stats
    FROM (
        SELECT 
            COALESCE(a.metadata->>'management_version', 'unknown') as version,
            COUNT(*) as version_count
        FROM agents a
        WHERE (
            COALESCE((a.metadata->>'is_iris_default')::boolean, false) = true
            OR COALESCE((a.metadata->>'is_suna_default')::boolean, false) = true
        )
        GROUP BY COALESCE(a.metadata->>'management_version', 'unknown')
    ) version_data;
    
    -- Get creation date distribution (by month)
    SELECT jsonb_object_agg(
        creation_month,
        month_count
    ) INTO creation_stats
    FROM (
        SELECT 
            TO_CHAR(a.created_at, 'YYYY-MM') as creation_month,
            COUNT(*) as month_count
        FROM agents a
        WHERE (
            COALESCE((a.metadata->>'is_iris_default')::boolean, false) = true
            OR COALESCE((a.metadata->>'is_suna_default')::boolean, false) = true
        )
        GROUP BY TO_CHAR(a.created_at, 'YYYY-MM')
        ORDER BY creation_month DESC
        LIMIT 12  -- Last 12 months
    ) creation_data;
    
    RETURN QUERY
    SELECT 
        total_count,
        active_count,
        inactive_count,
        COALESCE(version_stats, '{}'::jsonb),
        COALESCE(creation_stats, '{}'::jsonb);
END;
$$;

-- Function to find agents needing updates to a specific version
CREATE OR REPLACE FUNCTION find_iris_agents_needing_update(p_target_version TEXT)
RETURNS TABLE (
    agent_id UUID,
    account_id UUID,
    name VARCHAR(255),
    current_version TEXT,
    last_central_update TIMESTAMPTZ
)
SECURITY DEFINER
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        a.agent_id,
        a.account_id,
        a.name,
        COALESCE(a.metadata->>'management_version', 'unknown') as current_version,
        (a.metadata->>'last_central_update')::timestamptz as last_central_update
    FROM agents a
    WHERE (
        COALESCE((a.metadata->>'is_iris_default')::boolean, false) = true
        OR COALESCE((a.metadata->>'is_suna_default')::boolean, false) = true
    )
    AND COALESCE((a.metadata->>'centrally_managed')::boolean, false) = true
    AND (
        a.metadata->>'management_version' IS NULL 
        OR a.metadata->>'management_version' != p_target_version
    )
    ORDER BY a.created_at ASC;
END;
$$;

-- Step 8: Update RLS policies to use new metadata field
DROP POLICY IF EXISTS agents_update_own ON agents;
CREATE POLICY agents_update_own ON agents
    FOR UPDATE
    USING (
        basejump.has_role_on_account(account_id, 'owner') 
        AND (
            NOT COALESCE((metadata->>'is_iris_default')::boolean, false)
            AND NOT COALESCE((metadata->>'is_suna_default')::boolean, false)
            OR 
            (
                COALESCE((metadata->>'is_iris_default')::boolean, false) = true
                OR COALESCE((metadata->>'is_suna_default')::boolean, false) = true
            )
        )
    );

DROP POLICY IF EXISTS agents_delete_own ON agents;
CREATE POLICY agents_delete_own ON agents
    FOR DELETE
    USING (
        basejump.has_role_on_account(account_id, 'owner') 
        AND is_default = false 
        AND NOT COALESCE((metadata->>'is_iris_default')::boolean, false)
        AND NOT COALESCE((metadata->>'is_suna_default')::boolean, false)
    );

-- Step 9: Grant permissions to new functions
GRANT EXECUTE ON FUNCTION is_iris_default_agent(agents) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION find_iris_default_agent_for_account(UUID) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION get_all_iris_default_agents() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION count_iris_agents_by_version(TEXT) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION get_iris_default_agent_stats() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION find_iris_agents_needing_update(TEXT) TO authenticated, service_role;

-- Step 10: Maintain backward compatibility by keeping old function names as aliases
-- These will call the new Iris functions internally

CREATE OR REPLACE FUNCTION find_suna_default_agent_for_account(p_account_id UUID)
RETURNS TABLE (
    agent_id UUID,
    account_id UUID,
    name VARCHAR(255),
    description TEXT,
    system_prompt TEXT,
    configured_mcps JSONB,
    custom_mcps JSONB,
    agentpress_tools JSONB,
    is_default BOOLEAN,
    avatar VARCHAR(10),
    avatar_color VARCHAR(7),
    metadata JSONB,
    created_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ,
    is_active BOOLEAN,
    is_public BOOLEAN,
    marketplace_published_at TIMESTAMPTZ,
    download_count INTEGER,
    tags TEXT[],
    current_version_id UUID,
    version_count INTEGER
)
SECURITY DEFINER
LANGUAGE plpgsql
AS $$
BEGIN
    -- Backward compatibility: redirect to new function
    RETURN QUERY SELECT * FROM find_iris_default_agent_for_account(p_account_id);
END;
$$;

CREATE OR REPLACE FUNCTION get_all_suna_default_agents()
RETURNS TABLE (
    agent_id UUID,
    account_id UUID,
    name VARCHAR(255),
    description TEXT,
    system_prompt TEXT,
    configured_mcps JSONB,
    custom_mcps JSONB,
    agentpress_tools JSONB,
    is_default BOOLEAN,
    avatar VARCHAR(10),
    avatar_color VARCHAR(7),
    metadata JSONB,
    created_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ,
    is_active BOOLEAN,
    management_version TEXT,
    centrally_managed BOOLEAN
)
SECURITY DEFINER
LANGUAGE plpgsql
AS $$
BEGIN
    -- Backward compatibility: redirect to new function
    RETURN QUERY SELECT * FROM get_all_iris_default_agents();
END;
$$;

CREATE OR REPLACE FUNCTION count_suna_agents_by_version(p_version TEXT)
RETURNS INTEGER
SECURITY DEFINER
LANGUAGE plpgsql
AS $$
BEGIN
    -- Backward compatibility: redirect to new function
    RETURN count_iris_agents_by_version(p_version);
END;
$$;

CREATE OR REPLACE FUNCTION get_suna_default_agent_stats()
RETURNS TABLE (
    total_agents INTEGER,
    active_agents INTEGER,
    inactive_agents INTEGER,
    version_distribution JSONB,
    creation_dates JSONB
)
SECURITY DEFINER
LANGUAGE plpgsql
AS $$
BEGIN
    -- Backward compatibility: redirect to new function
    RETURN QUERY SELECT * FROM get_iris_default_agent_stats();
END;
$$;

CREATE OR REPLACE FUNCTION find_suna_agents_needing_update(p_target_version TEXT)
RETURNS TABLE (
    agent_id UUID,
    account_id UUID,
    name VARCHAR(255),
    current_version TEXT,
    last_central_update TIMESTAMPTZ
)
SECURITY DEFINER
LANGUAGE plpgsql
AS $$
BEGIN
    -- Backward compatibility: redirect to new function
    RETURN QUERY SELECT * FROM find_iris_agents_needing_update(p_target_version);
END;
$$;

CREATE OR REPLACE FUNCTION is_suna_default_agent(agent_row agents)
RETURNS boolean
LANGUAGE plpgsql
IMMUTABLE
AS $$
BEGIN
    -- Backward compatibility: redirect to new function
    RETURN is_iris_default_agent(agent_row);
END;
$$;

-- Step 11: Update comments on functions
COMMENT ON FUNCTION find_iris_default_agent_for_account(UUID) IS 'Finds the Iris default agent for a given account';
COMMENT ON FUNCTION get_all_iris_default_agents() IS 'Returns all Iris default agents across all accounts';
COMMENT ON FUNCTION count_iris_agents_by_version(TEXT) IS 'Counts Iris agents by management version';
COMMENT ON FUNCTION get_iris_default_agent_stats() IS 'Returns statistics about Iris default agents';
COMMENT ON FUNCTION find_iris_agents_needing_update(TEXT) IS 'Finds Iris agents that need to be updated to a specific version';
COMMENT ON FUNCTION is_iris_default_agent(agents) IS 'Checks if an agent is an Iris default agent';

-- Step 12: Update function comment for email lookup (used by admin scripts)
COMMENT ON FUNCTION public.get_user_account_by_email(text) IS 'Gets user account by email address. Used by admin scripts to install Iris agents.';

COMMIT;


