-- Create bot_states table to persist Telegram bot conversation state on serverless instances
CREATE TABLE IF NOT EXISTS bot_states (
  telegram_id BIGINT PRIMARY KEY,
  state TEXT NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS (Row Level Security) but allow service role full access
ALTER TABLE bot_states ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all to service_role" ON bot_states
  USING (true)
  WITH CHECK (true);
