-- WhatsApp Cloud API: outbound message log and webhook de-duplication. Additive only (two new tables).
-- Safe to run more than once. The release still running ignores both tables.

-- One row per outbound WhatsApp message, updated by the delivery-status webhook. Nothing that can identify
-- the content is stored: no template parameters (they can hold OTPs), no message text. The recipient is kept
-- as a SHA-256 hash plus its last four digits for support lookups.
CREATE TABLE IF NOT EXISTS whatsapp_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  wamid TEXT UNIQUE,
  -- outbound: sent by this app; webhook: first seen in a status webhook (e.g. a test send from the Meta dashboard)
  source TEXT NOT NULL DEFAULT 'outbound',
  purpose TEXT,
  template_name TEXT,
  language TEXT,
  recipient_hash TEXT NOT NULL,
  recipient_last4 TEXT,
  -- send_failed: the API refused it (never reached WhatsApp); accepted/sent/delivered/read/failed: from Meta
  status TEXT NOT NULL,
  attempts INTEGER NOT NULL DEFAULT 0,
  error_code INTEGER,
  error_title TEXT,
  pricing_category TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  sent_at TIMESTAMPTZ,
  delivered_at TIMESTAMPTZ,
  read_at TIMESTAMPTZ,
  failed_at TIMESTAMPTZ,
  CONSTRAINT whatsapp_messages_status_check
    CHECK (status IN ('send_failed', 'accepted', 'sent', 'delivered', 'read', 'failed')),
  CONSTRAINT whatsapp_messages_source_check CHECK (source IN ('outbound', 'webhook'))
);
CREATE INDEX IF NOT EXISTS idx_whatsapp_messages_created ON whatsapp_messages (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_whatsapp_messages_status ON whatsapp_messages (status, created_at DESC);
ALTER TABLE whatsapp_messages ENABLE ROW LEVEL SECURITY;

-- One row per webhook event already processed. Meta retries for up to 7 days and may deliver the same event
-- more than once; a second copy hits the primary key and is skipped. Pruned after 30 days by the worker.
CREATE TABLE IF NOT EXISTS whatsapp_webhook_events (
  event_key TEXT PRIMARY KEY,
  kind TEXT NOT NULL,
  received_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_whatsapp_webhook_events_received ON whatsapp_webhook_events (received_at);
ALTER TABLE whatsapp_webhook_events ENABLE ROW LEVEL SECURITY;
