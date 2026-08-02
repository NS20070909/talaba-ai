-- Migration for Quiz Engine Pro: SHA-256 Smart Cache & Session Resume System

-- 1. Create quiz_cache table for SHA-256 file fingerprint caching
CREATE TABLE IF NOT EXISTS quiz_cache (
  hash VARCHAR(64) PRIMARY KEY,
  file_name TEXT NOT NULL,
  file_type TEXT NOT NULL,
  raw_text TEXT NOT NULL,
  questions JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 2. Create quiz_sessions table for active user session resume
CREATE TABLE IF NOT EXISTS quiz_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id BIGINT NOT NULL,
  file_hash VARCHAR(64),
  file_name TEXT,
  step VARCHAR(50) NOT NULL DEFAULT 'INPUT',
  raw_text TEXT,
  questions JSONB DEFAULT '[]'::jsonb,
  settings JSONB DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_quiz_cache_created ON quiz_cache(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_quiz_sessions_user ON quiz_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_quiz_sessions_updated ON quiz_sessions(updated_at DESC);
