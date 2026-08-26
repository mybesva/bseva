-- Structured address, consent, onboarding, customer photo

ALTER TABLE users ADD COLUMN IF NOT EXISTS registration_consent BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS registration_consent_at TIMESTAMPTZ;
ALTER TABLE users ADD COLUMN IF NOT EXISTS terms_version TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS privacy_version TEXT;

ALTER TABLE customer_profiles ADD COLUMN IF NOT EXISTS address_line1 TEXT;
ALTER TABLE customer_profiles ADD COLUMN IF NOT EXISTS address_line2 TEXT;
ALTER TABLE customer_profiles ADD COLUMN IF NOT EXISTS district TEXT;
ALTER TABLE customer_profiles ADD COLUMN IF NOT EXISTS country TEXT DEFAULT 'India';
ALTER TABLE customer_profiles ADD COLUMN IF NOT EXISTS profile_photo_path TEXT;

ALTER TABLE pujari_profiles ADD COLUMN IF NOT EXISTS address_line1 TEXT;
ALTER TABLE pujari_profiles ADD COLUMN IF NOT EXISTS address_line2 TEXT;
ALTER TABLE pujari_profiles ADD COLUMN IF NOT EXISTS district TEXT;
ALTER TABLE pujari_profiles ADD COLUMN IF NOT EXISTS country TEXT DEFAULT 'India';
ALTER TABLE pujari_profiles ADD COLUMN IF NOT EXISTS gender TEXT;
ALTER TABLE pujari_profiles ADD COLUMN IF NOT EXISTS languages TEXT;
ALTER TABLE pujari_profiles ADD COLUMN IF NOT EXISTS specializations TEXT;
ALTER TABLE pujari_profiles ADD COLUMN IF NOT EXISTS experience_years INTEGER;
ALTER TABLE pujari_profiles ADD COLUMN IF NOT EXISTS onboarding_step INTEGER NOT NULL DEFAULT 1;
ALTER TABLE pujari_profiles ADD COLUMN IF NOT EXISTS profile_submitted_at TIMESTAMPTZ;
ALTER TABLE pujari_profiles ADD COLUMN IF NOT EXISTS final_submission_consent BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE pujari_profiles ADD COLUMN IF NOT EXISTS final_submission_consent_at TIMESTAMPTZ;
ALTER TABLE pujari_profiles ADD COLUMN IF NOT EXISTS profile_completion_percentage INTEGER NOT NULL DEFAULT 0;
ALTER TABLE pujari_profiles ADD COLUMN IF NOT EXISTS rejection_reason TEXT;
