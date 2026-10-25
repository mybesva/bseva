-- Production (Supabase) gained these columns outside the migration files; the API writes them on profile save.
ALTER TABLE pujari_profiles ADD COLUMN IF NOT EXISTS licence_type TEXT;
ALTER TABLE pujari_profiles ADD COLUMN IF NOT EXISTS licence_number TEXT;
