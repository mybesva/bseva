-- Values the API already writes that the CHECK constraints rejected (found comparing the Production schema and data):
--   invoices.invoice_type 'credit_note' (cancellation refunds), settlements/bookings 'blocked' (pujari no-show),
--   Malayalam ('ml') in the translation tables (the web app ships seven locales).
ALTER TABLE invoices DROP CONSTRAINT IF EXISTS invoices_invoice_type_check;
ALTER TABLE invoices ADD CONSTRAINT invoices_invoice_type_check
  CHECK (invoice_type IN ('customer', 'settlement', 'credit_note')) NOT VALID;

ALTER TABLE settlements DROP CONSTRAINT IF EXISTS settlements_status_check;
ALTER TABLE settlements ADD CONSTRAINT settlements_status_check
  CHECK (status IN ('pending', 'eligible', 'processing', 'settled', 'failed', 'held', 'blocked')) NOT VALID;

ALTER TABLE bookings DROP CONSTRAINT IF EXISTS bookings_settlement_status_check;
ALTER TABLE bookings ADD CONSTRAINT bookings_settlement_status_check
  CHECK (settlement_status IN ('not_applicable', 'pending', 'eligible', 'processing', 'settled', 'failed', 'held', 'legacy', 'blocked')) NOT VALID;

ALTER TABLE category_translations DROP CONSTRAINT IF EXISTS category_translations_language_code_check;
ALTER TABLE category_translations ADD CONSTRAINT category_translations_language_code_check
  CHECK (language_code IN ('en', 'hi', 'te', 'mr', 'ta', 'kn', 'ml')) NOT VALID;
ALTER TABLE service_translations DROP CONSTRAINT IF EXISTS service_translations_language_code_check;
ALTER TABLE service_translations ADD CONSTRAINT service_translations_language_code_check
  CHECK (language_code IN ('en', 'hi', 'te', 'mr', 'ta', 'kn', 'ml')) NOT VALID;
ALTER TABLE samagri_item_translations DROP CONSTRAINT IF EXISTS samagri_item_translations_language_code_check;
ALTER TABLE samagri_item_translations ADD CONSTRAINT samagri_item_translations_language_code_check
  CHECK (language_code IN ('en', 'hi', 'te', 'mr', 'ta', 'kn', 'ml')) NOT VALID;
ALTER TABLE legal_policy_translations DROP CONSTRAINT IF EXISTS legal_policy_translations_language_code_check;
ALTER TABLE legal_policy_translations ADD CONSTRAINT legal_policy_translations_language_code_check
  CHECK (language_code IN ('hi', 'te', 'mr', 'ta', 'kn', 'ml')) NOT VALID;
ALTER TABLE recommendation_translations DROP CONSTRAINT IF EXISTS recommendation_translations_language_code_check;
ALTER TABLE recommendation_translations ADD CONSTRAINT recommendation_translations_language_code_check
  CHECK (language_code IN ('hi', 'te', 'mr', 'ta', 'kn', 'ml')) NOT VALID;
