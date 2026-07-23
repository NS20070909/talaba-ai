-- Add translation_used_today to existing usage_stats table
DROP TABLE IF EXISTS tarjima_pro_usage;

ALTER TABLE usage_stats ADD COLUMN IF NOT EXISTS translation_used_today INTEGER DEFAULT 0;
