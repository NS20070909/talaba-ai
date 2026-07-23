-- Hujjat Tozalash daily usage tracking (self-contained table)
CREATE TABLE IF NOT EXISTS hujjat_tozalash_usage (
  telegram_id BIGINT PRIMARY KEY REFERENCES users(telegram_id) ON DELETE CASCADE,
  used_today INTEGER DEFAULT 0 NOT NULL,
  last_reset_date TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_hujjat_tozalash_usage_reset
  ON hujjat_tozalash_usage (last_reset_date);
