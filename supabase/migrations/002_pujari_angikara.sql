-- Extend existing pujari_profiles (do not replace users / pujari_documents).
ALTER TABLE pujari_profiles ADD COLUMN IF NOT EXISTS profile_photo_path TEXT;
ALTER TABLE pujari_profiles ADD COLUMN IF NOT EXISTS full_name TEXT;
ALTER TABLE pujari_profiles ADD COLUMN IF NOT EXISTS father_name TEXT;
ALTER TABLE pujari_profiles ADD COLUMN IF NOT EXISTS gotra TEXT;
ALTER TABLE pujari_profiles ADD COLUMN IF NOT EXISTS date_of_birth DATE;
ALTER TABLE pujari_profiles ADD COLUMN IF NOT EXISTS native_place TEXT;
ALTER TABLE pujari_profiles ADD COLUMN IF NOT EXISTS permanent_address TEXT;
ALTER TABLE pujari_profiles ADD COLUMN IF NOT EXISTS present_address TEXT;
ALTER TABLE pujari_profiles ADD COLUMN IF NOT EXISTS mobile_number TEXT;
ALTER TABLE pujari_profiles ADD COLUMN IF NOT EXISTS whatsapp_number TEXT;
ALTER TABLE pujari_profiles ADD COLUMN IF NOT EXISTS qualifications TEXT;
ALTER TABLE pujari_profiles ADD COLUMN IF NOT EXISTS qualification_year INTEGER;
ALTER TABLE pujari_profiles ADD COLUMN IF NOT EXISTS sampradaya TEXT;
ALTER TABLE pujari_profiles ADD COLUMN IF NOT EXISTS website_publication_consent BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE pujari_profiles ADD COLUMN IF NOT EXISTS signature_path TEXT;

CREATE TABLE IF NOT EXISTS pujari_angikara (
  pujari_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'not_started'
    CHECK (status IN ('not_started', 'draft', 'submitted', 'approved', 'rejected')),
  snapshot JSONB,
  submitted_at TIMESTAMPTZ,
  approved_at TIMESTAMPTZ,
  rejected_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS pujari_document_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pujari_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  document_type TEXT NOT NULL DEFAULT 'ANGIKARA_PATRAM',
  version_number INTEGER NOT NULL,
  snapshot JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_pujari_doc_versions ON pujari_document_versions(pujari_id);
