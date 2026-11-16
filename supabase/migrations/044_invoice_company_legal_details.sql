-- Invoice company details: replace the placeholder company name, address and PIN with B-Seva's legal details
-- (the same text as the legal pages, packages/config/src/legal/shared.ts), and fill an empty GSTIN.
-- Only settings still holding the old placeholder, or empty, change: anything an admin typed is kept.
-- Safe to run more than once. Invoices already issued keep the company block copied into them.

UPDATE platform_settings
SET value = to_jsonb('B-SEVA PRIVATE LIMITED'::text), updated_at = NOW()
WHERE key = 'invoice_company_name'
  AND btrim(COALESCE(value #>> '{}', '')) IN ('', 'BSeva Services Private Limited', 'B-Seva', 'BSeva');

UPDATE platform_settings
SET value = to_jsonb('Divyasree Holdings Pvt Ltd, Plot No. 5 & 43, HITEC City Layout, Madhapur, Shaikpet, Hyderabad – 500081, Telangana, India'::text),
    updated_at = NOW()
WHERE key = 'invoice_company_address'
  AND btrim(COALESCE(value #>> '{}', '')) IN ('', '123, Banjara Hills Road No. 12, Hyderabad, Telangana – 500034, India');

UPDATE platform_settings
SET value = to_jsonb('500081'::text), updated_at = NOW()
WHERE key = 'invoice_company_pincode'
  AND btrim(COALESCE(value #>> '{}', '')) IN ('', '500034');

UPDATE platform_settings
SET value = to_jsonb('36AAPCB2396C1ZK'::text), updated_at = NOW()
WHERE key = 'invoice_gstin'
  AND btrim(COALESCE(value #>> '{}', '')) = '';
