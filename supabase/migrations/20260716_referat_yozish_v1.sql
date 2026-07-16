-- Create referats table
CREATE TABLE IF NOT EXISTS referats (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  telegram_id BIGINT REFERENCES users(telegram_id) ON DELETE CASCADE,
  topic TEXT NOT NULL,
  subject TEXT NOT NULL,
  language VARCHAR(10) NOT NULL,
  target_size VARCHAR(20) NOT NULL,
  status VARCHAR(20) DEFAULT 'draft',
  download_url TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Add referat_used_today to usage_stats table
ALTER TABLE usage_stats ADD COLUMN IF NOT EXISTS referat_used_today INTEGER DEFAULT 0;
