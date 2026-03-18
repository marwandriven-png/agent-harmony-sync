-- Create property_matches table to store lead-property matching results
CREATE TABLE public.property_matches (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  lead_id UUID NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  property_id UUID REFERENCES public.properties(id) ON DELETE CASCADE,
  external_listing_id TEXT,
  match_type TEXT NOT NULL DEFAULT 'internal' CHECK (match_type IN ('internal', 'external')),
  match_score INTEGER NOT NULL DEFAULT 0 CHECK (match_score >= 0 AND match_score <= 100),
  match_reasons TEXT[] DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'viewed', 'interested', 'dismissed', 'converted')),
  is_flagged BOOLEAN NOT NULL DEFAULT false,
  notes TEXT,
  sent_at TIMESTAMP WITH TIME ZONE,
  external_data JSONB DEFAULT '{}',
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create index for faster queries
CREATE INDEX idx_property_matches_lead_id ON public.property_matches(lead_id);
CREATE INDEX idx_property_matches_property_id ON public.property_matches(property_id);
CREATE INDEX idx_property_matches_status ON public.property_matches(status);

-- Enable RLS
ALTER TABLE public.property_matches ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view matches for accessible leads"
ON public.property_matches
FOR SELECT
USING (can_access_lead(lead_id));

CREATE POLICY "Users can create matches for accessible leads"
ON public.property_matches
FOR INSERT
WITH CHECK (can_access_lead(lead_id));

CREATE POLICY "Users can update matches for accessible leads"
ON public.property_matches
FOR UPDATE
USING (can_access_lead(lead_id));

CREATE POLICY "Users can delete matches for accessible leads"
ON public.property_matches
FOR DELETE
USING (can_access_lead(lead_id));

CREATE POLICY "Admins can manage all matches"
ON public.property_matches
FOR ALL
USING (is_admin());

-- Add updated_at trigger
CREATE TRIGGER update_property_matches_updated_at
BEFORE UPDATE ON public.property_matches
FOR EACH ROW
EXECUTE FUNCTION public.handle_updated_at();

-- Add lead_type column to leads if not exists (for buyer/seller distinction)
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'leads' AND column_name = 'urgency_level'
  ) THEN
    ALTER TABLE public.leads ADD COLUMN urgency_level TEXT DEFAULT 'normal' CHECK (urgency_level IN ('low', 'normal', 'urgent', 'critical'));
  END IF;
END $$;