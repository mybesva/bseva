-- Review moderation for admin approve/reject workflow
ALTER TABLE ratings ADD COLUMN IF NOT EXISTS moderation_status TEXT NOT NULL DEFAULT 'approved';

COMMENT ON COLUMN ratings.moderation_status IS 'pending | approved | rejected';
