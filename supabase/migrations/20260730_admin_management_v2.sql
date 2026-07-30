-- Migration for Admin Management System V2

-- Create admins table if not exists, or add new columns if existing
CREATE TABLE IF NOT EXISTS admins (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  telegram_id BIGINT UNIQUE NOT NULL,
  name TEXT,
  username TEXT,
  role VARCHAR(20) NOT NULL DEFAULT 'ADMIN', -- OWNER, ADMIN, MODERATOR
  status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE', -- ACTIVE, DISABLED
  permissions JSONB DEFAULT '["payment","broadcast","support","users","settings","audit_log"]'::jsonb,
  last_login TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE admins ADD COLUMN IF NOT EXISTS name TEXT;
ALTER TABLE admins ADD COLUMN IF NOT EXISTS username TEXT;
ALTER TABLE admins ADD COLUMN IF NOT EXISTS role VARCHAR(20) DEFAULT 'ADMIN';
ALTER TABLE admins ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'ACTIVE';
ALTER TABLE admins ADD COLUMN IF NOT EXISTS permissions JSONB DEFAULT '["payment","broadcast","support","users","settings","audit_log"]'::jsonb;
ALTER TABLE admins ADD COLUMN IF NOT EXISTS last_login TIMESTAMPTZ;

-- Ensure OWNER record exists with full permissions
INSERT INTO admins (telegram_id, name, username, role, status, permissions)
VALUES (6630030492, 'Owner', 'Narkabilov_S_07', 'OWNER', 'ACTIVE', '["payment","broadcast","support","users","settings","audit_log"]'::jsonb)
ON CONFLICT (telegram_id) DO UPDATE SET role = 'OWNER', status = 'ACTIVE';

CREATE INDEX IF NOT EXISTS idx_admins_telegram ON admins(telegram_id);
CREATE INDEX IF NOT EXISTS idx_admins_role ON admins(role);
CREATE INDEX IF NOT EXISTS idx_admins_status ON admins(status);
