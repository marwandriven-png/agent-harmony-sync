
-- Community Villas table
CREATE TABLE public.community_villas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  community_name TEXT NOT NULL,
  sub_community TEXT,
  cluster_name TEXT,
  villa_number TEXT NOT NULL,
  plot_number TEXT,
  plot_id UUID REFERENCES public.plots(id) ON DELETE SET NULL,
  orientation TEXT,
  facing_direction TEXT,
  position_type TEXT,
  is_corner BOOLEAN DEFAULT false,
  is_single_row BOOLEAN DEFAULT false,
  backs_park BOOLEAN DEFAULT false,
  backs_road BOOLEAN DEFAULT false,
  near_pool BOOLEAN DEFAULT false,
  near_entrance BOOLEAN DEFAULT false,
  near_school BOOLEAN DEFAULT false,
  near_community_center BOOLEAN DEFAULT false,
  vastu_compliant BOOLEAN,
  vastu_details TEXT,
  latitude DOUBLE PRECISION,
  longitude DOUBLE PRECISION,
  land_usage TEXT DEFAULT 'villa',
  plot_size_sqft NUMERIC,
  built_up_area_sqft NUMERIC,
  bedrooms INTEGER,
  floors INTEGER,
  year_built INTEGER,
  notes TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_by UUID REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Villa Owners table
CREATE TABLE public.villa_owners (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  villa_id UUID REFERENCES public.community_villas(id) ON DELETE CASCADE NOT NULL,
  owner_name TEXT NOT NULL,
  phone TEXT,
  email TEXT,
  nationality TEXT,
  ownership_type TEXT DEFAULT 'freehold',
  ownership_start_date DATE,
  notes TEXT,
  created_by UUID REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Bayut Listings table
CREATE TABLE public.bayut_listings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  villa_id UUID REFERENCES public.community_villas(id) ON DELETE CASCADE,
  community_name TEXT NOT NULL,
  villa_number TEXT,
  plot_number TEXT,
  listing_type TEXT NOT NULL DEFAULT 'sale',
  listing_price NUMERIC,
  listing_currency TEXT DEFAULT 'AED',
  listing_agent TEXT,
  listing_agency TEXT,
  listing_url TEXT,
  listing_date DATE,
  is_active BOOLEAN DEFAULT true,
  bedrooms INTEGER,
  size_sqft NUMERIC,
  description TEXT,
  images TEXT[],
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.community_villas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.villa_owners ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bayut_listings ENABLE ROW LEVEL SECURITY;

-- RLS Policies for community_villas
CREATE POLICY "Authenticated users can view villas" ON public.community_villas FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users can create villas" ON public.community_villas FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Users can update villas" ON public.community_villas FOR UPDATE USING ((created_by = auth.uid()) OR public.is_admin());
CREATE POLICY "Admins can delete villas" ON public.community_villas FOR DELETE USING (public.is_admin());

-- RLS Policies for villa_owners
CREATE POLICY "Authenticated users can view owners" ON public.villa_owners FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users can create owners" ON public.villa_owners FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Users can update owners" ON public.villa_owners FOR UPDATE USING ((created_by = auth.uid()) OR public.is_admin());
CREATE POLICY "Admins can delete owners" ON public.villa_owners FOR DELETE USING (public.is_admin());

-- RLS Policies for bayut_listings
CREATE POLICY "Authenticated users can view listings" ON public.bayut_listings FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users can create listings" ON public.bayut_listings FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Users can update listings" ON public.bayut_listings FOR UPDATE USING (auth.uid() IS NOT NULL);
CREATE POLICY "Admins can delete listings" ON public.bayut_listings FOR DELETE USING (public.is_admin());

-- Indexes for search performance
CREATE INDEX idx_villas_community ON public.community_villas(community_name);
CREATE INDEX idx_villas_villa_number ON public.community_villas(villa_number);
CREATE INDEX idx_villas_plot_number ON public.community_villas(plot_number);
CREATE INDEX idx_villas_position ON public.community_villas(is_corner, is_single_row, backs_park);
CREATE INDEX idx_villas_vastu ON public.community_villas(vastu_compliant);
CREATE INDEX idx_villas_coords ON public.community_villas(latitude, longitude);
CREATE INDEX idx_owners_villa ON public.villa_owners(villa_id);
CREATE INDEX idx_bayut_villa ON public.bayut_listings(villa_id);
CREATE INDEX idx_bayut_community ON public.bayut_listings(community_name, villa_number);
CREATE INDEX idx_bayut_active ON public.bayut_listings(is_active);
