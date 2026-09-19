-- Support ticket workspace: activity, assignment, SLA, escalation, chat link.
ALTER TABLE support_tickets ADD COLUMN IF NOT EXISTS related_payment_id UUID;
ALTER TABLE support_tickets ALTER COLUMN user_id DROP NOT NULL;
ALTER TABLE support_tickets DROP CONSTRAINT IF EXISTS support_tickets_status_check;
ALTER TABLE support_tickets ADD COLUMN IF NOT EXISTS reporter_type TEXT;
ALTER TABLE support_tickets ADD COLUMN IF NOT EXISTS contact_source TEXT;
ALTER TABLE support_tickets ADD COLUMN IF NOT EXISTS expected_resolution TEXT;
ALTER TABLE support_tickets ADD COLUMN IF NOT EXISTS additional_info TEXT;
ALTER TABLE support_tickets ADD COLUMN IF NOT EXISTS assigned_at TIMESTAMPTZ;
ALTER TABLE support_tickets ADD COLUMN IF NOT EXISTS assigned_by UUID REFERENCES users(id);
ALTER TABLE support_tickets ADD COLUMN IF NOT EXISTS sla_hours INTEGER;
ALTER TABLE support_tickets ADD COLUMN IF NOT EXISTS sla_due_at TIMESTAMPTZ;
ALTER TABLE support_tickets ADD COLUMN IF NOT EXISTS escalated_to TEXT;
ALTER TABLE support_tickets ADD COLUMN IF NOT EXISTS escalation_reason TEXT;
ALTER TABLE support_tickets ADD COLUMN IF NOT EXISTS escalation_action TEXT;
ALTER TABLE support_tickets ADD COLUMN IF NOT EXISTS escalated_at TIMESTAMPTZ;
ALTER TABLE support_tickets ADD COLUMN IF NOT EXISTS escalated_by UUID REFERENCES users(id);
ALTER TABLE support_tickets ADD COLUMN IF NOT EXISTS resolution_type TEXT;
ALTER TABLE support_tickets ADD COLUMN IF NOT EXISTS resolved_by UUID REFERENCES users(id);
ALTER TABLE support_tickets ADD COLUMN IF NOT EXISTS resolved_at TIMESTAMPTZ;
ALTER TABLE support_tickets ADD COLUMN IF NOT EXISTS resolution_outcome TEXT;
ALTER TABLE support_tickets ADD COLUMN IF NOT EXISTS feedback TEXT;
ALTER TABLE support_tickets ADD COLUMN IF NOT EXISTS rating INTEGER;
ALTER TABLE support_tickets ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES users(id);
ALTER TABLE support_tickets ADD COLUMN IF NOT EXISTS conversation_id UUID;
ALTER TABLE support_tickets ADD COLUMN IF NOT EXISTS last_activity_at TIMESTAMPTZ;
ALTER TABLE support_tickets ADD COLUMN IF NOT EXISTS closed_at TIMESTAMPTZ;
ALTER TABLE support_tickets ADD COLUMN IF NOT EXISTS reopened_at TIMESTAMPTZ;
ALTER TABLE support_tickets ADD COLUMN IF NOT EXISTS guest_name TEXT;
ALTER TABLE support_tickets ADD COLUMN IF NOT EXISTS guest_phone TEXT;
ALTER TABLE support_tickets ADD COLUMN IF NOT EXISTS guest_email TEXT;
ALTER TABLE support_tickets ALTER COLUMN priority SET DEFAULT 'medium';

UPDATE support_tickets SET last_activity_at = COALESCE(updated_at, created_at) WHERE last_activity_at IS NULL;
UPDATE support_tickets
SET reporter_type = CASE
  WHEN user_role IN ('pujari', 'head_pujari') THEN 'pujari'
  WHEN user_role = 'customer' THEN 'customer'
  ELSE COALESCE(reporter_type, 'other')
END
WHERE reporter_type IS NULL;
UPDATE support_tickets SET priority = 'medium' WHERE LOWER(COALESCE(priority, '')) IN ('normal', '');

ALTER TABLE support_ticket_messages ALTER COLUMN author_id DROP NOT NULL;
ALTER TABLE support_ticket_messages ADD COLUMN IF NOT EXISTS visibility TEXT NOT NULL DEFAULT 'public';
ALTER TABLE support_ticket_messages ADD COLUMN IF NOT EXISTS event_type TEXT NOT NULL DEFAULT 'message';
ALTER TABLE support_ticket_messages ADD COLUMN IF NOT EXISTS previous_value TEXT;
ALTER TABLE support_ticket_messages ADD COLUMN IF NOT EXISTS new_value TEXT;
ALTER TABLE support_ticket_messages ADD COLUMN IF NOT EXISTS meta JSONB NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE support_ticket_messages ADD COLUMN IF NOT EXISTS actor_role TEXT;

ALTER TABLE support_conversations ADD COLUMN IF NOT EXISTS ticket_id UUID REFERENCES support_tickets(id);
ALTER TABLE support_conversations ADD COLUMN IF NOT EXISTS user_role TEXT;

CREATE INDEX IF NOT EXISTS idx_support_tickets_status ON support_tickets(status);
CREATE INDEX IF NOT EXISTS idx_support_tickets_priority ON support_tickets(priority);
CREATE INDEX IF NOT EXISTS idx_support_tickets_assigned ON support_tickets(assigned_admin_id);
CREATE INDEX IF NOT EXISTS idx_support_tickets_created ON support_tickets(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_support_ticket_messages_ticket ON support_ticket_messages(ticket_id, created_at);
