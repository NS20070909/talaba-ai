-- Create bot_states table to persist Telegram bot conversation state on serverless instances
CREATE TABLE IF NOT EXISTS bot_states (
  telegram_id BIGINT PRIMARY KEY,
  state TEXT NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS (Row Level Security)
ALTER TABLE bot_states ENABLE ROW LEVEL SECURITY;

-- Drop existing policy if present to allow idempotent re-execution
DROP POLICY IF EXISTS "Allow all access to bot_states" ON bot_states;
DROP POLICY IF EXISTS "Allow all to service_role" ON bot_states;

-- Create policy allowing full access for all operations (read/write/delete)
CREATE POLICY "Allow all access to bot_states" ON bot_states
  FOR ALL
  USING (true)
  WITH CHECK (true);
