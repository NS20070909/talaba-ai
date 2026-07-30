-- Migration for Admin Panel Polish & Hardening

-- Add soft deletion and activity tracking to admins table
ALTER TABLE admins ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN DEFAULT false;
ALTER TABLE admins ADD COLUMN IF NOT EXISTS last_seen TIMESTAMPTZ;

-- Add old_value, new_value, ip_address to audit_logs table
ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS old_value JSONB;
ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS new_value JSONB;
ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS ip_address TEXT;

CREATE INDEX IF NOT EXISTS idx_admins_is_deleted ON admins(is_deleted);
