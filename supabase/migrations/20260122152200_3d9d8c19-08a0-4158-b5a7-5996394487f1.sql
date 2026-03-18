-- Add new columns to properties table to match Google Sheets exactly
-- Column order: Regis, ProcedureValue, MasterProject, BuildingNameEn, Size, UnitNumber, 
-- PropertyTypeEn, ProcedurePartyTypeNameEn, NameEn, Mobile, ProcedureNameEn, CountryNameEn, Status, Matches

-- Add google_sheet_row_id for sync tracking
ALTER TABLE public.properties 
ADD COLUMN IF NOT EXISTS google_sheet_row_id TEXT UNIQUE;

-- Add regis as immutable unique identifier
ALTER TABLE public.properties 
ADD COLUMN IF NOT EXISTS regis TEXT UNIQUE;

-- Add procedure_value (maps to ProcedureValue)
ALTER TABLE public.properties 
ADD COLUMN IF NOT EXISTS procedure_value NUMERIC;

-- Add master_project (maps to Master Project)
ALTER TABLE public.properties 
ADD COLUMN IF NOT EXISTS master_project TEXT;

-- Add building_name (maps to BuildingNameEn)
ALTER TABLE public.properties 
ADD COLUMN IF NOT EXISTS building_name TEXT;

-- unit_number (maps to UnitNumber)
ALTER TABLE public.properties 
ADD COLUMN IF NOT EXISTS unit_number TEXT;

-- party_type (maps to ProcedurePartyTypeNameEn)
ALTER TABLE public.properties 
ADD COLUMN IF NOT EXISTS party_type TEXT;

-- owner_name (maps to NameEn)
ALTER TABLE public.properties 
ADD COLUMN IF NOT EXISTS owner_name TEXT;

-- owner_mobile (maps to Mobile)
ALTER TABLE public.properties 
ADD COLUMN IF NOT EXISTS owner_mobile TEXT;

-- procedure_name (maps to ProcedureNameEn)
ALTER TABLE public.properties 
ADD COLUMN IF NOT EXISTS procedure_name TEXT;

-- country (maps to CountryNameEn)
ALTER TABLE public.properties 
ADD COLUMN IF NOT EXISTS country TEXT DEFAULT 'UAE';

-- matches (AI calculated, read-only)
ALTER TABLE public.properties 
ADD COLUMN IF NOT EXISTS matches NUMERIC DEFAULT 0;

-- Create function to generate unique regis
CREATE OR REPLACE FUNCTION public.generate_property_regis()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.regis IS NULL THEN
    NEW.regis := 'REG-' || UPPER(SUBSTRING(gen_random_uuid()::text, 1, 8));
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Create trigger to auto-generate regis on insert
DROP TRIGGER IF EXISTS set_property_regis ON public.properties;
CREATE TRIGGER set_property_regis
  BEFORE INSERT ON public.properties
  FOR EACH ROW
  EXECUTE FUNCTION public.generate_property_regis();

-- Update existing properties with regis if null
UPDATE public.properties 
SET regis = 'REG-' || UPPER(SUBSTRING(id::text, 1, 8))
WHERE regis IS NULL;

-- Add index for regis lookups
CREATE INDEX IF NOT EXISTS idx_properties_regis ON public.properties(regis);

-- Add index for google_sheet_row_id
CREATE INDEX IF NOT EXISTS idx_properties_google_sheet_row_id ON public.properties(google_sheet_row_id);