-- Update threads.updated_at when messages are inserted
-- This ensures that threads appear at the top of the list when a new message is added

CREATE OR REPLACE FUNCTION update_thread_on_message_insert()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE threads
    SET updated_at = TIMEZONE('utc'::text, NOW())
    WHERE thread_id = NEW.thread_id;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create trigger to update thread when message is inserted
CREATE TRIGGER update_thread_on_message_insert
    AFTER INSERT ON messages
    FOR EACH ROW
    EXECUTE FUNCTION update_thread_on_message_insert();

