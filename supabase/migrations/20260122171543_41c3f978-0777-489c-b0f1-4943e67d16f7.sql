-- Add missing columns to match Google Sheets schema exactly
ALTER TABLE public.properties
ADD COLUMN IF NOT EXISTS id_number text,
ADD COLUMN IF NOT EXISTS uae_id_number text,
ADD COLUMN IF NOT EXISTS passport_expiry_date date,
ADD COLUMN IF NOT EXISTS birth_date date,
ADD COLUMN IF NOT EXISTS unified_number text;

-- Add comments for documentation
COMMENT ON COLUMN public.properties.id_number IS 'Owner ID number from Google Sheets';
COMMENT ON COLUMN public.properties.uae_id_number IS 'Owner UAE ID number';
COMMENT ON COLUMN public.properties.passport_expiry_date IS 'Owner passport expiry date';
COMMENT ON COLUMN public.properties.birth_date IS 'Owner birth date';
COMMENT ON COLUMN public.properties.unified_number IS 'Unified number from Google Sheets';