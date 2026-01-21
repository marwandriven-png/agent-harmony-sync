-- Data source connections table
CREATE TABLE public.data_sources (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('google_sheets', 'csv', 'xlsx', 'airtable', 'notion')),
  connection_url TEXT,
  sheet_id TEXT,
  table_name TEXT NOT NULL,
  column_mappings JSONB NOT NULL DEFAULT '{}'::jsonb,
  last_synced_at TIMESTAMP WITH TIME ZONE,
  sync_status TEXT NOT NULL DEFAULT 'pending' CHECK (sync_status IN ('pending', 'syncing', 'success', 'error')),
  sync_error TEXT,
  created_by UUID REFERENCES public.profiles(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- API keys/integrations table
CREATE TABLE public.api_integrations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('google_calendar', 'google_sheets', 'google_drive', 'whatsapp', 'openai')),
  is_connected BOOLEAN NOT NULL DEFAULT false,
  config JSONB NOT NULL DEFAULT '{}'::jsonb,
  last_tested_at TIMESTAMP WITH TIME ZONE,
  created_by UUID REFERENCES public.profiles(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(type, created_by)
);

-- Setup wizard progress tracking
CREATE TABLE public.setup_wizard_progress (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES public.profiles(id) UNIQUE,
  current_step INTEGER NOT NULL DEFAULT 1,
  completed_steps INTEGER[] NOT NULL DEFAULT '{}'::integer[],
  is_complete BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.data_sources ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.api_integrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.setup_wizard_progress ENABLE ROW LEVEL SECURITY;

-- RLS policies for data_sources
CREATE POLICY "Users can view own data sources" ON public.data_sources
  FOR SELECT USING (created_by = auth.uid() OR is_admin());

CREATE POLICY "Users can create data sources" ON public.data_sources
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Users can update own data sources" ON public.data_sources
  FOR UPDATE USING (created_by = auth.uid() OR is_admin());

CREATE POLICY "Users can delete own data sources" ON public.data_sources
  FOR DELETE USING (created_by = auth.uid() OR is_admin());

-- RLS policies for api_integrations
CREATE POLICY "Users can view own integrations" ON public.api_integrations
  FOR SELECT USING (created_by = auth.uid() OR is_admin());

CREATE POLICY "Users can create integrations" ON public.api_integrations
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Users can update own integrations" ON public.api_integrations
  FOR UPDATE USING (created_by = auth.uid() OR is_admin());

CREATE POLICY "Users can delete own integrations" ON public.api_integrations
  FOR DELETE USING (created_by = auth.uid() OR is_admin());

-- RLS policies for setup_wizard_progress
CREATE POLICY "Users can view own progress" ON public.setup_wizard_progress
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Users can create own progress" ON public.setup_wizard_progress
  FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own progress" ON public.setup_wizard_progress
  FOR UPDATE USING (user_id = auth.uid());

-- Triggers for updated_at
CREATE TRIGGER update_data_sources_updated_at
  BEFORE UPDATE ON public.data_sources
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER update_api_integrations_updated_at
  BEFORE UPDATE ON public.api_integrations
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER update_setup_wizard_progress_updated_at
  BEFORE UPDATE ON public.setup_wizard_progress
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();