-- Dynamic customer-content localization and safe backfill.
-- Canonical/admin-authored English remains on the source tables.

CREATE TABLE IF NOT EXISTS recommendation_translations (
  recommendation_id UUID NOT NULL REFERENCES service_recommendations(id) ON DELETE CASCADE,
  language_code TEXT NOT NULL CHECK (language_code IN ('hi', 'te', 'mr', 'ta', 'kn')),
  title TEXT NOT NULL,
  description TEXT,
  recurrence_hint TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (recommendation_id, language_code)
);

CREATE TABLE IF NOT EXISTS legal_policy_translations (
  policy_id UUID NOT NULL REFERENCES legal_policies(id) ON DELETE CASCADE,
  language_code TEXT NOT NULL CHECK (language_code IN ('hi', 'te', 'mr', 'ta', 'kn')),
  title TEXT NOT NULL,
  points JSONB NOT NULL DEFAULT '[]'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (policy_id, language_code)
);

CREATE INDEX IF NOT EXISTS idx_service_translations_language_name
  ON service_translations (language_code, name);
CREATE INDEX IF NOT EXISTS idx_recommendation_translations_language
  ON recommendation_translations (language_code);
CREATE INDEX IF NOT EXISTS idx_legal_policy_translations_language
  ON legal_policy_translations (language_code);

-- Ensure canonical rows exist for records created before translation support.
INSERT INTO service_translations (service_id, language_code, name, short_description, full_description)
SELECT id, 'en', name, short_description, COALESCE(full_description, description)
FROM services
ON CONFLICT (service_id, language_code) DO UPDATE SET
  name = COALESCE(service_translations.name, EXCLUDED.name),
  short_description = COALESCE(service_translations.short_description, EXCLUDED.short_description),
  full_description = COALESCE(service_translations.full_description, EXCLUDED.full_description);

INSERT INTO category_translations (category_id, language_code, name)
SELECT id, 'en', name FROM service_categories
ON CONFLICT (category_id, language_code) DO NOTHING;

INSERT INTO samagri_item_translations (samagri_item_id, language_code, item_name)
SELECT id, 'en', name FROM samagri_items
ON CONFLICT (samagri_item_id, language_code) DO NOTHING;

-- Backfill the two deterministic recommendations created by backend/seed.py.
INSERT INTO recommendation_translations (
  recommendation_id, language_code, title, description, recurrence_hint
)
SELECT r.id, v.language_code, v.title, v.description, v.recurrence_hint
FROM service_recommendations r
JOIN (
  VALUES
    ('Office Puja — Monthly','hi','कार्यालय पूजा — मासिक','कार्यालय की सुख-समृद्धि के लिए अनुशंसित पूजा','मासिक'),
    ('Office Puja — Monthly','te','కార్యాలయ పూజ — నెలవారీ','కార్యాలయ శ్రేయస్సు కోసం సిఫారసు చేసిన పూజ','నెలవారీ'),
    ('Office Puja — Monthly','mr','कार्यालय पूजा — मासिक','कार्यालयाच्या कल्याणासाठी शिफारस केलेली पूजा','मासिक'),
    ('Office Puja — Monthly','ta','அலுவலக பூஜை — மாதாந்திரம்','அலுவலக நலனுக்குப் பரிந்துரைக்கப்படும் பூஜை','மாதாந்திரம்'),
    ('Office Puja — Monthly','kn','ಕಚೇರಿ ಪೂಜೆ — ಮಾಸಿಕ','ಕಚೇರಿಯ ಶ್ರೇಯಸ್ಸಿಗಾಗಿ ಶಿಫಾರಸು ಮಾಡಿದ ಪೂಜೆ','ಮಾಸಿಕ'),
    ('Shop Puja','hi','दुकान पूजा','दुकान के लिए नियमित पूजा की अनुशंसा','नियमित'),
    ('Shop Puja','te','దుకాణ పూజ','దుకాణం కోసం క్రమమైన పూజ సిఫారసు','క్రమం తప్పకుండా'),
    ('Shop Puja','mr','दुकान पूजा','दुकानासाठी नियमित पूजेची शिफारस','नियमित'),
    ('Shop Puja','ta','கடை பூஜை','கடைக்கான வழக்கமான பூஜைப் பரிந்துரை','வழக்கமாக'),
    ('Shop Puja','kn','ಅಂಗಡಿ ಪೂಜೆ','ಅಂಗಡಿಗಾಗಿ ನಿಯಮಿತ ಪೂಜೆಯ ಶಿಫಾರಸು','ನಿಯಮಿತ')
) AS v(source_title, language_code, title, description, recurrence_hint)
  ON v.source_title = r.title
ON CONFLICT (recommendation_id, language_code) DO UPDATE SET
  title = EXCLUDED.title,
  description = EXCLUDED.description,
  recurrence_hint = EXCLUDED.recurrence_hint,
  updated_at = NOW();

-- Existing frozen snapshots can be safely overlaid from stored translations.
UPDATE booking_preparation_snapshot bps
SET service_name = COALESCE(NULLIF(spc.display_name, ''), NULLIF(st.name, ''), bps.service_name),
    preparation_notes = COALESCE(spc.preparation_notes, bps.preparation_notes),
    special_instructions = COALESCE(spc.special_instructions, bps.special_instructions),
    prasadam_notes = COALESCE(spc.prasadam_notes, bps.prasadam_notes),
    venue_notes = COALESCE(spc.venue_notes, bps.venue_notes),
    disclaimer = COALESCE(spc.disclaimer, bps.disclaimer)
FROM bookings b
LEFT JOIN service_preparation_content spc
  ON spc.service_id = b.service_id AND spc.language_code = bps.language_code
LEFT JOIN service_translations st
  ON st.service_id = b.service_id AND st.language_code = bps.language_code
WHERE b.id = bps.booking_id;

UPDATE booking_samagri_snapshot bss
SET name = sit.item_name,
    instructions = COALESCE(sit.notes, bss.instructions)
FROM bookings b
JOIN service_samagri ss ON ss.service_id = b.service_id
JOIN samagri_items si
  ON si.id = ss.samagri_item_id AND si.item_key = bss.item_key
JOIN samagri_item_translations sit
  ON sit.samagri_item_id = si.id AND sit.language_code = bss.language_code
WHERE b.id = bss.booking_id;
