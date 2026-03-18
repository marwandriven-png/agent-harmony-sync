-- Create follow_up_templates table
CREATE TABLE public.follow_up_templates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  day INTEGER NOT NULL CHECK (day >= 0 AND day <= 21),
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.follow_up_templates ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Users can view all templates"
ON public.follow_up_templates
FOR SELECT
USING (auth.uid() IS NOT NULL);

CREATE POLICY "Users can create templates"
ON public.follow_up_templates
FOR INSERT
WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Users can update own templates"
ON public.follow_up_templates
FOR UPDATE
USING (created_by = auth.uid() OR is_admin());

CREATE POLICY "Users can delete own templates"
ON public.follow_up_templates
FOR DELETE
USING (created_by = auth.uid() OR is_admin());

-- Add updated_at trigger
CREATE TRIGGER update_follow_up_templates_updated_at
  BEFORE UPDATE ON public.follow_up_templates
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

-- Insert default templates
INSERT INTO public.follow_up_templates (day, title, content, is_active) VALUES
(2, 'Initial Follow-up', 'Hi {{name}}, following up on your interest in {{bedrooms}}BR properties in {{locations}}. I''ve found some excellent options within your {{budget}} budget. When''s a good time to discuss?', true),
(4, 'Property Showcase', 'Hi {{name}}, I wanted to share some handpicked properties that match your requirements. Would you like me to arrange viewings for any of these?', true),
(6, 'Pro Tip Follow-up', 'Hi {{name}}, quick tip: Properties in {{locations}} are moving fast this season. Let me know if you''d like priority access to new listings.', true);