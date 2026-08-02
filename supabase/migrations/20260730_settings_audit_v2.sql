-- Migration for Settings Management V2 & Audit Log System V2

-- Create system_settings table for dynamic key-value configuration
CREATE TABLE IF NOT EXISTS system_settings (
  key VARCHAR(100) PRIMARY KEY,
  value JSONB NOT NULL,
  category VARCHAR(50) NOT NULL,
  updated_by BIGINT,
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Create audit_logs table for administrative tracking and traceability
CREATE TABLE IF NOT EXISTS audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id BIGINT NOT NULL,
  admin_name TEXT,
  action VARCHAR(50) NOT NULL,
  target TEXT,
  description TEXT NOT NULL,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Create indexes for audit querying and filtering
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_audit_logs_admin ON audit_logs(admin_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created ON audit_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_system_settings_category ON system_settings(category);

-- Seed default settings
INSERT INTO system_settings (key, category, value) VALUES
  ('bot_name', 'bot', '"Talaba AI Bot"'::jsonb),
  ('bot_username', 'bot', '"talaba_ai_bot"'::jsonb),
  ('support_username', 'bot', '"Narkabilov_S_07"'::jsonb),
  ('maintenance_mode', 'bot', 'false'::jsonb),
  ('welcome_message', 'bot', '"Assalomu alaykum! Talaba AI botiga xush kelibsiz."'::jsonb),

  ('card_holder', 'payment', '"Sirojiddin Narkabilov"'::jsonb),
  ('card_number', 'payment', '"8600 0000 0000 0000"'::jsonb),
  ('payment_instructions', 'payment', '"To`lovni amalga oshirgach, chek rasmini yuboring."'::jsonb),

  ('tariffs', 'premium', '{"STARTER": 2900, "WEEKLY": 11900, "PREMIUM": 29900}'::jsonb),
  ('daily_limits', 'premium', '{"FREE": {"scan": 3, "ppt": 1, "pdf": 3}, "PREMIUM": {"scan": 300, "ppt": 120, "pdf": 300}}'::jsonb),

  ('notify_payment', 'notifications', 'true'::jsonb),
  ('notify_broadcast', 'notifications', 'true'::jsonb),
  ('notify_support', 'notifications', 'true'::jsonb),

  ('default_ai_model', 'ai', '"models/gemini-2.5-flash"'::jsonb),
  ('ai_timeout', 'ai', '30000'::jsonb),
  ('ai_retry_count', 'ai', '3'::jsonb),

  ('timezone', 'system', '"Asia/Tashkent"'::jsonb),
  ('default_language', 'system', '"uz"'::jsonb),
  ('file_upload_limit_mb', 'system', '20'::jsonb)
ON CONFLICT (key) DO NOTHING;
