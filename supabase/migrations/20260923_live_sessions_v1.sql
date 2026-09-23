-- Migration: 20260923_live_sessions_v1.sql
-- Description: Table for tracking Gemini Live native audio sessions, heartbeats, and duration

CREATE TABLE IF NOT EXISTS live_sessions (
  id TEXT PRIMARY KEY,
  telegram_id BIGINT NOT NULL,
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_heartbeat_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ended_at TIMESTAMPTZ,
  credited_seconds INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_live_sessions_user ON live_sessions(telegram_id);
CREATE INDEX IF NOT EXISTS idx_live_sessions_status ON live_sessions(status);

COMMENT ON TABLE live_sessions IS 'Tracks real-time Gemini Live sessions to prevent double deduction and enforce accurate duration';
