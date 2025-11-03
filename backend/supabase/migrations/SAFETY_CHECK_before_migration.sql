-- SAFETY CHECK: Run this BEFORE running the migration to see what will be affected
-- This shows you exactly which rows will be updated, without making any changes

-- Check agents that will be updated
SELECT 
    agent_id,
    name,
    is_default,
    metadata->>'is_iris_default' as metadata_is_iris_default,
    config->>'system_prompt' as current_config_prompt,
    CASE 
        WHEN EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'agents' AND column_name = 'system_prompt')
        THEN system_prompt::text
        ELSE NULL
    END as legacy_system_prompt,
    current_version_id
FROM agents
WHERE (is_default = true OR COALESCE((metadata->>'is_iris_default')::boolean, false) = true)
AND lower(name) = ANY (ARRAY['iris', 'suna']);

-- Check agent_versions that will be updated
SELECT 
    av.version_id,
    av.agent_id,
    a.name as agent_name,
    a.is_default,
    a.metadata->>'is_iris_default' as metadata_is_iris_default,
    av.config->>'system_prompt' as current_config_prompt
FROM agent_versions av
JOIN agents a ON av.version_id = a.current_version_id
WHERE (a.is_default = true OR COALESCE((a.metadata->>'is_iris_default')::boolean, false) = true)
AND lower(a.name) = ANY (ARRAY['iris', 'suna']);

-- Count how many rows will be affected
SELECT 
    'agents' as table_name,
    COUNT(*) as rows_to_update
FROM agents
WHERE (is_default = true OR COALESCE((metadata->>'is_iris_default')::boolean, false) = true)
AND lower(name) = ANY (ARRAY['iris', 'suna'])

UNION ALL

SELECT 
    'agent_versions' as table_name,
    COUNT(*) as rows_to_update
FROM agent_versions av
JOIN agents a ON av.version_id = a.current_version_id
WHERE (a.is_default = true OR COALESCE((a.metadata->>'is_iris_default')::boolean, false) = true)
AND lower(a.name) = ANY (ARRAY['iris', 'suna']);

