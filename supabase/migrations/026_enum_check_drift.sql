-- Align CHECK constraints with values the API already writes (found when building QA from a fresh database):
--   bookings.package_type 'basic', bookings.mode 'temple', pujari_documents.document_type 'driving_licence'.
-- NOT VALID: new rows are checked; existing rows are not rescanned, so this cannot fail on legacy data.
ALTER TABLE bookings DROP CONSTRAINT IF EXISTS bookings_package_type_check;
ALTER TABLE bookings ADD CONSTRAINT bookings_package_type_check
  CHECK (package_type IN ('basic', 'standard', 'premium')) NOT VALID;

ALTER TABLE bookings DROP CONSTRAINT IF EXISTS bookings_mode_check;
ALTER TABLE bookings ADD CONSTRAINT bookings_mode_check
  CHECK (mode IN ('in_person', 'temple', 'virtual')) NOT VALID;

ALTER TABLE pujari_documents DROP CONSTRAINT IF EXISTS pujari_documents_document_type_check;
ALTER TABLE pujari_documents ADD CONSTRAINT pujari_documents_document_type_check
  CHECK (document_type IN ('certificate', 'identity', 'supporting', 'driving_licence')) NOT VALID;
