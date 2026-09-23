-- Migration: 20260914_ai_chat_study_mentor_v1.sql
-- Description: Add columns to usage_stats for Live Voice, Flash Review, and AI Chat tracking

ALTER TABLE usage_stats ADD COLUMN IF NOT EXISTS live_seconds_today INTEGER DEFAULT 0;
ALTER TABLE usage_stats ADD COLUMN IF NOT EXISTS flash_review_used_today INTEGER DEFAULT 0;
ALTER TABLE usage_stats ADD COLUMN IF NOT EXISTS chat_messages_today INTEGER DEFAULT 0;

COMMENT ON COLUMN usage_stats.live_seconds_today IS 'Seconds of Gemini Live voice conversation used today';
COMMENT ON COLUMN usage_stats.flash_review_used_today IS 'Number of Flash Review audio summaries generated today';
COMMENT ON COLUMN usage_stats.chat_messages_today IS 'Number of text AI chat messages sent today (unlimited for users, tracked for abuse prevention)';
