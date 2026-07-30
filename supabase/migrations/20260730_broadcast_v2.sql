-- Migration for Broadcast System V2
-- Create bot_groups table to track Telegram groups/supergroups where bot is installed
CREATE TABLE IF NOT EXISTS bot_groups (
  chat_id BIGINT PRIMARY KEY,
  title TEXT NOT NULL,
  type VARCHAR(50) DEFAULT 'group',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Create bot_channels table to track Telegram channels where bot is installed
CREATE TABLE IF NOT EXISTS bot_channels (
  chat_id BIGINT PRIMARY KEY,
  title TEXT NOT NULL,
  username TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Create broadcasts table to track all broadcast operations, scheduling, and metrics
CREATE TABLE IF NOT EXISTS broadcasts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_id BIGINT NOT NULL,
  target_type VARCHAR(50) NOT NULL, -- USERS, GROUPS, CHANNELS, PREMIUM, EVERYONE
  message_text TEXT NOT NULL,
  status VARCHAR(50) NOT NULL DEFAULT 'draft', -- draft, scheduled, sending, completed, failed
  scheduled_at TIMESTAMPTZ,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  total_recipients INTEGER DEFAULT 0,
  delivered_count INTEGER DEFAULT 0,
  failed_count INTEGER DEFAULT 0,
  failed_recipients JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_broadcasts_status_scheduled ON broadcasts(status, scheduled_at);
