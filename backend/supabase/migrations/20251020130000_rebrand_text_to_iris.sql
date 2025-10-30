BEGIN;

-- Rebrand textual references from Suna/Kortix to Iris while keeping historical snapshot names intact.

-- Helper updates for the agents table
UPDATE agents
SET name = regexp_replace(regexp_replace(name, '(?i)kortix', 'Iris', 'g'), '(?i)suna', 'Iris', 'g')
WHERE name ~* '(suna|kortix)';

UPDATE agents
SET description = regexp_replace(regexp_replace(description, '(?i)kortix', 'Iris', 'g'), '(?i)suna', 'Iris', 'g')
WHERE description IS NOT NULL AND description ~* '(suna|kortix)';

-- Ensure metadata flag and string content are updated
UPDATE agents
SET metadata = metadata - 'is_suna_default' || jsonb_build_object('is_iris_default', (metadata->>'is_suna_default')::boolean)
WHERE metadata ? 'is_suna_default';

UPDATE agents
SET metadata = regexp_replace(
        regexp_replace(metadata::text, '(?i)kortix', 'Iris', 'g'),
        '(?i)suna', 'Iris', 'g'
    )::jsonb
WHERE metadata::text ~* '(suna|kortix)'
  AND metadata::text NOT LIKE '%kortix/suna:%';

-- Update agent versions JSON configuration
UPDATE agent_versions
SET config = regexp_replace(
        regexp_replace(config::text, '(?i)kortix', 'Iris', 'g'),
        '(?i)suna', 'Iris', 'g'
    )::jsonb
WHERE config::text ~* '(suna|kortix)'
  AND config::text NOT LIKE '%kortix/suna:%';

-- Update agent templates text and metadata
UPDATE agent_templates
SET name = regexp_replace(regexp_replace(name, '(?i)kortix', 'Iris', 'g'), '(?i)suna', 'Iris', 'g')
WHERE name ~* '(suna|kortix)';

UPDATE agent_templates
SET description = regexp_replace(regexp_replace(description, '(?i)kortix', 'Iris', 'g'), '(?i)suna', 'Iris', 'g')
WHERE description IS NOT NULL AND description ~* '(suna|kortix)';

UPDATE agent_templates
SET metadata = regexp_replace(
        regexp_replace(metadata::text, '(?i)kortix', 'Iris', 'g'),
        '(?i)suna', 'Iris', 'g'
    )::jsonb
WHERE metadata::text ~* '(suna|kortix)'
  AND metadata::text NOT LIKE '%kortix/suna:%';

-- Update project names and metadata
UPDATE projects
SET name = regexp_replace(regexp_replace(name, '(?i)kortix', 'Iris', 'g'), '(?i)suna', 'Iris', 'g')
WHERE name ~* '(suna|kortix)';

UPDATE projects
SET metadata = regexp_replace(
        regexp_replace(metadata::text, '(?i)kortix', 'Iris', 'g'),
        '(?i)suna', 'Iris', 'g'
    )::jsonb
WHERE metadata::text ~* '(suna|kortix)'
  AND metadata::text NOT LIKE '%kortix/suna:%';

-- Update sandbox metadata stored on projects
UPDATE projects
SET sandbox = regexp_replace(
        regexp_replace(sandbox::text, '(?i)kortix', 'Iris', 'g'),
        '(?i)suna', 'Iris', 'g'
    )::jsonb
WHERE sandbox::text ~* '(suna|kortix)'
  AND sandbox::text NOT LIKE '%kortix/suna:%';

-- Update thread metadata
UPDATE threads
SET metadata = regexp_replace(
        regexp_replace(metadata::text, '(?i)kortix', 'Iris', 'g'),
        '(?i)suna', 'Iris', 'g'
    )::jsonb
WHERE metadata::text ~* '(suna|kortix)'
  AND metadata::text NOT LIKE '%kortix/suna:%';

-- Update stored message payloads
UPDATE messages
SET content = regexp_replace(
        regexp_replace(content::text, '(?i)kortix', 'Iris', 'g'),
        '(?i)suna', 'Iris', 'g'
    )::jsonb
WHERE content::text ~* '(suna|kortix)'
  AND content::text NOT LIKE '%kortix/suna:%';

COMMIT;
