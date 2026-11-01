-- Pujari payment cycle now defaults to 3 days. A value an admin has already customised is kept.
INSERT INTO platform_settings (key, value)
VALUES ('pujari_settlement_days', '3'::jsonb)
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value
WHERE btrim(platform_settings.value #>> '{}') = '14';
