-- CORRECTED SQL Migration for updating default agent prompts
-- This migration updates system_prompt in agent_versions.config and agents.config
-- for default Iris and Suna agents
--
-- SAFETY FEATURES:
-- 1. Wrapped in transaction (can rollback if needed)
-- 2. Only updates agents with name 'iris' or 'suna' AND is_default=true OR metadata->>'is_iris_default'=true
-- 3. Uses jsonb_set which PRESERVES all other config fields (only updates system_prompt key)
-- 4. Checks for column/table existence before updating (safe for different schema versions)
-- 5. Uses COALESCE to handle NULL configs safely
--
-- RECOMMENDED: Run SAFETY_CHECK_before_migration.sql first to see what will be affected

BEGIN;

DO $$
DECLARE
    v_prompt TEXT := $IRIS_PROMPT$
-- PASTE THE FULL PROMPT FROM backend/core/prompts/prompt.py HERE
-- Copy everything from SYSTEM_PROMPT (between the triple quotes)
-- Start pasting right after this line (delete this comment)
-- The prompt should start with: "You are Iris, an autonomous personal AI for you."
-- And end before the closing $IRIS_PROMPT$ marker below

$IRIS_PROMPT$;
BEGIN
  -- Update versioned agent configs if present
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'agents' AND column_name = 'current_version_id'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_name = 'agent_versions'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'agent_versions' AND column_name = 'config'
  ) THEN
    -- Check for version_id (correct column name) first
    IF EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_name = 'agent_versions' AND column_name = 'version_id'
    ) THEN
      UPDATE agent_versions av
      SET config = jsonb_set(
        COALESCE(av.config, '{}'::jsonb),
        '{system_prompt}',
        to_jsonb(v_prompt),
        true
      )
      FROM agents a
      WHERE av.version_id = a.current_version_id
        AND (a.is_default = true OR COALESCE((a.metadata->>'is_iris_default')::boolean, false) = true)
        AND lower(a.name) = ANY (ARRAY['iris', 'suna']);
    -- Fallback for legacy agent_version_id column name
    ELSIF EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_name = 'agent_versions' AND column_name = 'agent_version_id'
    ) THEN
      UPDATE agent_versions av
      SET config = jsonb_set(
        COALESCE(av.config, '{}'::jsonb),
        '{system_prompt}',
        to_jsonb(v_prompt),
        true
      )
      FROM agents a
      WHERE av.agent_version_id = a.current_version_id
        AND (a.is_default = true OR COALESCE((a.metadata->>'is_iris_default')::boolean, false) = true)
        AND lower(a.name) = ANY (ARRAY['iris', 'suna']);
    -- Fallback for id column name
    ELSIF EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_name = 'agent_versions' AND column_name = 'id'
    ) THEN
      UPDATE agent_versions av
      SET config = jsonb_set(
        COALESCE(av.config, '{}'::jsonb),
        '{system_prompt}',
        to_jsonb(v_prompt),
        true
      )
      FROM agents a
      WHERE av.id = a.current_version_id
        AND (a.is_default = true OR COALESCE((a.metadata->>'is_iris_default')::boolean, false) = true)
        AND lower(a.name) = ANY (ARRAY['iris', 'suna']);
    END IF;
  END IF;

  -- Update agents.config fallback if column exists
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'agents' AND column_name = 'config'
  ) THEN
    UPDATE agents
    SET config = jsonb_set(
      COALESCE(config, '{}'::jsonb),
      '{system_prompt}',
      to_jsonb(v_prompt),
      true
    )
    WHERE (is_default = true OR COALESCE((metadata->>'is_iris_default')::boolean, false) = true)
    AND lower(name) = ANY (ARRAY['iris', 'suna']);
  END IF;

  -- Update legacy agents.system_prompt if column exists
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'agents' AND column_name = 'system_prompt'
  ) THEN
    UPDATE agents
    SET system_prompt = v_prompt
    WHERE (is_default = true OR COALESCE((metadata->>'is_iris_default')::boolean, false) = true)
    AND lower(name) = ANY (ARRAY['iris', 'suna']);
  END IF;
END
$$;

COMMIT;

-- Optional verification
-- SELECT agent_id, name, is_default,
--        config->>'system_prompt' AS config_prompt,
--        system_prompt AS legacy_prompt
-- FROM agents
-- WHERE (is_default = true OR COALESCE((metadata->>'is_iris_default')::boolean, false) = true)
--   AND lower(name) = ANY (ARRAY['iris', 'suna']);

