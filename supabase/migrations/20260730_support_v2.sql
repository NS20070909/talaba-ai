-- Migration for Telegram Support Center V2

-- Create sequence for human-readable Ticket Numbers starting at 1001
CREATE SEQUENCE IF NOT EXISTS support_ticket_number_seq START WITH 1001;

-- Create support_tickets table
CREATE TABLE IF NOT EXISTS support_tickets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_number INTEGER DEFAULT nextval('support_ticket_number_seq'),
  telegram_id BIGINT NOT NULL REFERENCES users(telegram_id) ON DELETE CASCADE,
  category VARCHAR(50) NOT NULL, -- PAYMENT, PREMIUM, AI_PROBLEMS, TECHNICAL, BUG_REPORT, SUGGESTION, OTHER
  priority VARCHAR(20) NOT NULL DEFAULT 'MEDIUM', -- LOW, MEDIUM, HIGH, URGENT
  status VARCHAR(20) NOT NULL DEFAULT 'OPEN', -- OPEN, IN_PROGRESS, WAITING_USER, RESOLVED, CLOSED
  subject TEXT,
  assigned_admin_id BIGINT,
  first_response_at TIMESTAMPTZ,
  resolved_at TIMESTAMPTZ,
  closed_at TIMESTAMPTZ,
  last_activity_at TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Create support_messages table
CREATE TABLE IF NOT EXISTS support_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id UUID NOT NULL REFERENCES support_tickets(id) ON DELETE CASCADE,
  sender_type VARCHAR(20) NOT NULL, -- USER, ADMIN, SYSTEM
  sender_id BIGINT NOT NULL,
  message_text TEXT NOT NULL,
  telegram_file_id TEXT,
  telegram_file_type VARCHAR(20), -- photo, document
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Create support_attachments table
CREATE TABLE IF NOT EXISTS support_attachments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id UUID NOT NULL REFERENCES support_messages(id) ON DELETE CASCADE,
  file_id TEXT NOT NULL,
  file_type VARCHAR(20) NOT NULL,
  file_name TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_support_tickets_user ON support_tickets(telegram_id);
CREATE INDEX IF NOT EXISTS idx_support_tickets_status ON support_tickets(status);
CREATE INDEX IF NOT EXISTS idx_support_tickets_priority ON support_tickets(priority);
CREATE INDEX IF NOT EXISTS idx_support_messages_ticket ON support_messages(ticket_id);
