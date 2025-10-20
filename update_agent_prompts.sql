-- Purpose: Ensure backend picks up the latest prompt from code (prompt.py)
-- Strategy: For ONLY default agents, clear stored overrides so PromptManager 
--           falls back to get_system_prompt() from backend/core/prompts/prompt.py
-- Safe for mixed schemas (guards for column/table existence).

BEGIN;

-- 1) Versioned config: clear agent_versions.config->>'system_prompt' for default agents
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name='agents' AND column_name='current_version_id'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.tables WHERE table_name='agent_versions'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name='agent_versions' AND column_name='config'
  ) THEN
    UPDATE agent_versions av
    SET config = config - 'system_prompt'
    FROM agents a
    WHERE av.agent_version_id = a.current_version_id
      AND a.is_default = true
      AND av.config ? 'system_prompt';
  END IF;
END $$;

-- 2) Fallback: agents.config (if column exists)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name='agents' AND column_name='config'
  ) THEN
    UPDATE agents
    SET config = config - 'system_prompt'
    WHERE is_default = true
      AND config ? 'system_prompt';
  END IF;
END $$;

-- 3) Legacy: agents.system_prompt (if column exists)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name='agents' AND column_name='system_prompt'
  ) THEN
    UPDATE agents
    SET system_prompt = NULL
    WHERE is_default = true
      AND system_prompt IS NOT NULL;
  END IF;
END $$;

COMMIT;

-- Verification query (optional - run separately if needed)
-- SELECT 
--   agent_id, 
--   name, 
--   is_default,
--   CASE 
--     WHEN EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='agents' AND column_name='config')
--     THEN config->>'system_prompt'
--     ELSE 'config column does not exist'
--   END as config_system_prompt,
--   CASE 
--     WHEN EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='agents' AND column_name='system_prompt')
--     THEN system_prompt
--     ELSE 'system_prompt column does not exist'
--   END as legacy_system_prompt
-- FROM agents 
-- WHERE is_default = true;