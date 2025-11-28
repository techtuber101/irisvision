-- Migration: Add summarization support for context management
-- This migration adds indexes and helper functions for managing conversation summaries
-- Summaries are stored as system messages with special metadata

BEGIN;

-- Add index on metadata for faster summary lookups
-- This allows efficient queries for messages with summarization metadata
CREATE INDEX IF NOT EXISTS idx_messages_metadata_summarization 
ON messages USING GIN (metadata) 
WHERE metadata ? 'summarization';

-- Add index on thread_id + type for faster summary retrieval per thread
-- Summaries are stored as type='system' messages
CREATE INDEX IF NOT EXISTS idx_messages_thread_type_summary
ON messages (thread_id, type, created_at)
WHERE type = 'system' AND metadata->>'summarization' = 'true';

-- Function to get the active summary message for a thread
-- Returns the most recent summary message (only one should be active)
CREATE OR REPLACE FUNCTION get_thread_summary(thread_uuid UUID)
RETURNS TABLE (
    message_id UUID,
    content JSONB,
    metadata JSONB,
    created_at TIMESTAMPTZ,
    boundary_message_id UUID,
    replaced_count INTEGER,
    version INTEGER
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        m.message_id,
        m.content,
        m.metadata,
        m.created_at,
        (m.metadata->>'boundary_message_id')::UUID as boundary_message_id,
        (m.metadata->>'replaced_count')::INTEGER as replaced_count,
        COALESCE((m.metadata->>'version')::INTEGER, 1) as version
    FROM messages m
    WHERE m.thread_id = thread_uuid
        AND m.type = 'system'
        AND m.metadata->>'summarization' = 'true'
        AND m.is_llm_message = true
    ORDER BY m.created_at DESC
    LIMIT 1;
END;
$$ LANGUAGE plpgsql;

-- Function to find or create summary message
-- If summary exists, returns it; otherwise returns NULL
CREATE OR REPLACE FUNCTION find_thread_summary(thread_uuid UUID)
RETURNS UUID AS $$
DECLARE
    summary_id UUID;
BEGIN
    SELECT message_id INTO summary_id
    FROM messages
    WHERE thread_id = thread_uuid
        AND type = 'system'
        AND metadata->>'summarization' = 'true'
        AND is_llm_message = true
    ORDER BY created_at DESC
    LIMIT 1;
    
    RETURN summary_id;
END;
$$ LANGUAGE plpgsql;

-- Add comment explaining the summarization metadata structure
COMMENT ON COLUMN messages.metadata IS 
'Metadata JSONB field. For summarization messages, contains:
{
  "summarization": true,
  "boundary_message_id": "UUID of first message kept fresh (not summarized)",
  "replaced_count": 97,
  "version": 2
}';

COMMIT;

