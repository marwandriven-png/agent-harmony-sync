
-- Create projects table
CREATE TABLE public.projects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  location text,
  status text NOT NULL DEFAULT 'planning',
  budget numeric DEFAULT 0,
  spent numeric DEFAULT 0,
  start_date date,
  end_date date,
  completion_percentage integer DEFAULT 0,
  created_by uuid REFERENCES public.profiles(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Authenticated users can view all projects" ON public.projects
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "Users can create projects" ON public.projects
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Users can update projects they created or admins" ON public.projects
  FOR UPDATE USING (created_by = auth.uid() OR is_admin());

CREATE POLICY "Admins can delete projects" ON public.projects
  FOR DELETE USING (is_admin());

-- Add project_id to plots table
ALTER TABLE public.plots ADD COLUMN project_id uuid REFERENCES public.projects(id) ON DELETE SET NULL;
