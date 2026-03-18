-- ===============================================
-- PLOT INTELLIGENCE CRM - Database Schema
-- ===============================================

-- Create plots table
CREATE TABLE public.plots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plot_number TEXT NOT NULL,
  area_name TEXT NOT NULL,
  master_plan TEXT,
  plot_size DECIMAL NOT NULL,
  gfa DECIMAL,
  floors_allowed INTEGER,
  zoning TEXT,
  status TEXT NOT NULL DEFAULT 'available',
  pdf_source_link TEXT,
  notes TEXT,
  price DECIMAL,
  price_per_sqft DECIMAL,
  owner_name TEXT,
  owner_mobile TEXT,
  location_coordinates JSONB,
  google_sheet_row_id TEXT,
  created_by UUID REFERENCES public.profiles(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create plot offers table
CREATE TABLE public.plot_offers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plot_id UUID NOT NULL REFERENCES public.plots(id) ON DELETE CASCADE,
  lead_id UUID REFERENCES public.leads(id) ON DELETE SET NULL,
  buyer_name TEXT NOT NULL,
  mobile TEXT,
  email TEXT,
  offer_amount DECIMAL NOT NULL,
  offer_status TEXT NOT NULL DEFAULT 'pending',
  notes TEXT,
  created_by UUID REFERENCES public.profiles(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create plot interested buyers table (linked to leads)
CREATE TABLE public.plot_interested_buyers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plot_id UUID NOT NULL REFERENCES public.plots(id) ON DELETE CASCADE,
  lead_id UUID REFERENCES public.leads(id) ON DELETE SET NULL,
  buyer_name TEXT NOT NULL,
  mobile TEXT,
  email TEXT,
  viewed_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  source TEXT DEFAULT 'direct',
  notes TEXT,
  created_by UUID REFERENCES public.profiles(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create plot activity logs table
CREATE TABLE public.plot_activity_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plot_id UUID NOT NULL REFERENCES public.plots(id) ON DELETE CASCADE,
  action TEXT NOT NULL,
  old_values JSONB,
  new_values JSONB,
  user_id UUID REFERENCES public.profiles(id),
  source TEXT DEFAULT 'crm',
  timestamp TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create plot feasibility results table (for AI analysis)
CREATE TABLE public.plot_feasibility (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plot_id UUID NOT NULL REFERENCES public.plots(id) ON DELETE CASCADE,
  estimated_units INTEGER,
  build_potential TEXT,
  roi_range TEXT,
  risk_notes TEXT[],
  recommendation TEXT,
  market_comparison JSONB,
  ai_raw_response JSONB,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on all tables
ALTER TABLE public.plots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.plot_offers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.plot_interested_buyers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.plot_activity_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.plot_feasibility ENABLE ROW LEVEL SECURITY;

-- ===============================================
-- RLS Policies for plots
-- ===============================================
CREATE POLICY "Authenticated users can view all plots" 
ON public.plots FOR SELECT 
USING (auth.uid() IS NOT NULL);

CREATE POLICY "Users can create plots" 
ON public.plots FOR INSERT 
WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Users can update plots they created or admins" 
ON public.plots FOR UPDATE 
USING (created_by = auth.uid() OR is_admin());

CREATE POLICY "Admins can delete plots" 
ON public.plots FOR DELETE 
USING (is_admin());

-- ===============================================
-- RLS Policies for plot_offers
-- ===============================================
CREATE POLICY "Users can view plot offers" 
ON public.plot_offers FOR SELECT 
USING (auth.uid() IS NOT NULL);

CREATE POLICY "Users can create plot offers" 
ON public.plot_offers FOR INSERT 
WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Users can update their plot offers or admins" 
ON public.plot_offers FOR UPDATE 
USING (created_by = auth.uid() OR is_admin());

CREATE POLICY "Admins can delete plot offers" 
ON public.plot_offers FOR DELETE 
USING (is_admin());

-- ===============================================
-- RLS Policies for plot_interested_buyers
-- ===============================================
CREATE POLICY "Users can view interested buyers" 
ON public.plot_interested_buyers FOR SELECT 
USING (auth.uid() IS NOT NULL);

CREATE POLICY "Users can create interested buyers" 
ON public.plot_interested_buyers FOR INSERT 
WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Users can update interested buyers they created or admins" 
ON public.plot_interested_buyers FOR UPDATE 
USING (created_by = auth.uid() OR is_admin());

CREATE POLICY "Admins can delete interested buyers" 
ON public.plot_interested_buyers FOR DELETE 
USING (is_admin());

-- ===============================================
-- RLS Policies for plot_activity_logs
-- ===============================================
CREATE POLICY "Users can view plot activity logs" 
ON public.plot_activity_logs FOR SELECT 
USING (auth.uid() IS NOT NULL);

CREATE POLICY "System can insert plot activity logs" 
ON public.plot_activity_logs FOR INSERT 
WITH CHECK (auth.uid() IS NOT NULL);

-- ===============================================
-- RLS Policies for plot_feasibility
-- ===============================================
CREATE POLICY "Users can view feasibility reports" 
ON public.plot_feasibility FOR SELECT 
USING (auth.uid() IS NOT NULL);

CREATE POLICY "Users can create feasibility reports" 
ON public.plot_feasibility FOR INSERT 
WITH CHECK (auth.uid() IS NOT NULL);

-- ===============================================
-- Triggers for updated_at
-- ===============================================
CREATE TRIGGER update_plots_updated_at
BEFORE UPDATE ON public.plots
FOR EACH ROW EXECUTE FUNCTION handle_updated_at();

CREATE TRIGGER update_plot_offers_updated_at
BEFORE UPDATE ON public.plot_offers
FOR EACH ROW EXECUTE FUNCTION handle_updated_at();

-- ===============================================
-- Indexes for performance
-- ===============================================
CREATE INDEX idx_plots_area_name ON public.plots(area_name);
CREATE INDEX idx_plots_status ON public.plots(status);
CREATE INDEX idx_plots_zoning ON public.plots(zoning);
CREATE INDEX idx_plot_offers_plot_id ON public.plot_offers(plot_id);
CREATE INDEX idx_plot_offers_lead_id ON public.plot_offers(lead_id);
CREATE INDEX idx_plot_interested_buyers_plot_id ON public.plot_interested_buyers(plot_id);
CREATE INDEX idx_plot_interested_buyers_lead_id ON public.plot_interested_buyers(lead_id);
CREATE INDEX idx_plot_activity_logs_plot_id ON public.plot_activity_logs(plot_id);