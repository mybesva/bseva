-- FCM device tokens (web / PWA / Android / iOS). A user may have many devices.
CREATE TABLE IF NOT EXISTS fcm_device_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  fcm_token TEXT NOT NULL,
  platform TEXT NOT NULL DEFAULT 'web' CHECK (platform IN ('web', 'android', 'ios')),
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (fcm_token)
);

CREATE INDEX IF NOT EXISTS idx_fcm_device_tokens_user_active
  ON fcm_device_tokens (user_id)
  WHERE active = TRUE;
