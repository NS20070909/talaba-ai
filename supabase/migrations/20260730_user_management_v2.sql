-- Migration for User Management System V2

-- Alter users table to add new tracking fields
ALTER TABLE users ADD COLUMN IF NOT EXISTS last_seen TIMESTAMPTZ DEFAULT now();
ALTER TABLE users ADD COLUMN IF NOT EXISTS is_muted BOOLEAN DEFAULT false;
ALTER TABLE users ADD COLUMN IF NOT EXISTS mute_reason TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS ban_reason TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS language VARCHAR(10) DEFAULT 'uz';
ALTER TABLE users ADD COLUMN IF NOT EXISTS broadcast_enabled BOOLEAN DEFAULT true;

-- Create user_notes table for internal admin notes
CREATE TABLE IF NOT EXISTS user_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  telegram_id BIGINT NOT NULL REFERENCES users(telegram_id) ON DELETE CASCADE,
  admin_id BIGINT NOT NULL,
  note_text TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Create premium_history table to audit all premium actions
CREATE TABLE IF NOT EXISTS premium_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  telegram_id BIGINT NOT NULL REFERENCES users(telegram_id) ON DELETE CASCADE,
  admin_id BIGINT NOT NULL,
  action VARCHAR(50) NOT NULL, -- GIVE, EXTEND, REDUCE, REMOVE
  plan VARCHAR(50) NOT NULL,
  days INTEGER DEFAULT 0,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes for fast queries
CREATE INDEX IF NOT EXISTS idx_users_plan ON users(plan);
CREATE INDEX IF NOT EXISTS idx_users_muted ON users(is_muted);
CREATE INDEX IF NOT EXISTS idx_users_banned ON users(is_banned);
CREATE INDEX IF NOT EXISTS idx_user_notes_user ON user_notes(telegram_id);
CREATE INDEX IF NOT EXISTS idx_premium_history_user ON premium_history(telegram_id);
