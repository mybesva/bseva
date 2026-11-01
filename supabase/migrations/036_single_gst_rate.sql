-- GST is now one rate and one SAC code from Settings. Carry over what bookings are charged today.
-- gst_rate_config stays as history; bookings no longer read it.
UPDATE pricing_config p
SET gst_percent = r.gst_rate
FROM (
  SELECT gst_rate FROM gst_rate_config
  WHERE line_type = 'puja' AND service_id IS NULL AND package_type IS NULL AND effective_from <= CURRENT_DATE
  ORDER BY effective_from DESC, created_at DESC
  LIMIT 1
) r
WHERE p.id = 1;

INSERT INTO platform_settings (key, value)
SELECT 'invoice_sac_code', to_jsonb(r.hsn_sac)
FROM (
  SELECT hsn_sac FROM gst_rate_config
  WHERE line_type = 'puja' AND service_id IS NULL AND package_type IS NULL AND effective_from <= CURRENT_DATE
  ORDER BY effective_from DESC, created_at DESC
  LIMIT 1
) r
WHERE COALESCE(r.hsn_sac, '') <> ''
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;
