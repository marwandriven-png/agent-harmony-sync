-- =============================================
-- REAL ESTATE CRM PRODUCTION DATABASE SCHEMA
-- =============================================

-- 1. Create ENUM types
CREATE TYPE public.app_role AS ENUM ('admin', 'agent');
CREATE TYPE public.lead_status AS ENUM ('new', 'contacted', 'viewing', 'viewed', 'negotiation', 'closed', 'lost');
CREATE TYPE public.lead_priority AS ENUM ('hot', 'warm', 'cold');
CREATE TYPE public.lead_source AS ENUM ('website', 'referral', 'cold_call', 'social_media', 'property_portal', 'walk_in', 'other');
CREATE TYPE public.property_type AS ENUM ('apartment', 'villa', 'townhouse', 'penthouse', 'studio', 'commercial', 'land');
CREATE TYPE public.activity_type AS ENUM ('call', 'email', 'whatsapp', 'meeting', 'note', 'task', 'status_change', 'property_sent');
CREATE TYPE public.task_type AS ENUM ('call', 'viewing', 'follow_up', 'meeting', 'document', 'other');
CREATE TYPE public.task_status AS ENUM ('pending', 'completed', 'overdue');
CREATE TYPE public.cold_call_status AS ENUM ('new', 'called', 'interested', 'not_interested', 'converted');
CREATE TYPE public.property_status AS ENUM ('available', 'under_offer', 'sold', 'rented');

-- 2. Create user_roles table (CRITICAL: separate from profiles for security)
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL DEFAULT 'agent',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);

-- 3. Create profiles table
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  full_name TEXT NOT NULL,
  phone TEXT,
  avatar_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 4. Create leads table
CREATE TABLE public.leads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  email TEXT,
  phone TEXT NOT NULL,
  status lead_status NOT NULL DEFAULT 'new',
  priority lead_priority NOT NULL DEFAULT 'warm',
  source lead_source NOT NULL DEFAULT 'other',
  assigned_agent_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  budget_min DECIMAL(15,2),
  budget_max DECIMAL(15,2),
  budget_currency TEXT DEFAULT 'AED',
  property_types property_type[] DEFAULT '{}',
  bedrooms INTEGER,
  locations TEXT[] DEFAULT '{}',
  requirements_notes TEXT,
  last_contacted_at TIMESTAMPTZ,
  next_follow_up TIMESTAMPTZ,
  tags TEXT[] DEFAULT '{}',
  google_sheet_row_id TEXT,
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 5. Create activities table
CREATE TABLE public.activities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id UUID REFERENCES public.leads(id) ON DELETE CASCADE NOT NULL,
  type activity_type NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  metadata JSONB DEFAULT '{}',
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 6. Create tasks table
CREATE TABLE public.tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id UUID REFERENCES public.leads(id) ON DELETE CASCADE NOT NULL,
  type task_type NOT NULL DEFAULT 'other',
  title TEXT NOT NULL,
  description TEXT,
  due_date TIMESTAMPTZ NOT NULL,
  status task_status NOT NULL DEFAULT 'pending',
  assigned_to UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  completed_at TIMESTAMPTZ,
  google_sheet_row_id TEXT,
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 7. Create cold_calls table
CREATE TABLE public.cold_calls (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  phone TEXT NOT NULL,
  email TEXT,
  source lead_source NOT NULL DEFAULT 'cold_call',
  location TEXT,
  budget DECIMAL(15,2),
  bedrooms INTEGER,
  notes TEXT,
  assigned_agent_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  status cold_call_status NOT NULL DEFAULT 'new',
  last_call_date TIMESTAMPTZ,
  next_follow_up TIMESTAMPTZ,
  converted_lead_id UUID REFERENCES public.leads(id) ON DELETE SET NULL,
  google_sheet_row_id TEXT,
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 8. Create properties table
CREATE TABLE public.properties (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  type property_type NOT NULL,
  price DECIMAL(15,2) NOT NULL,
  currency TEXT DEFAULT 'AED',
  location TEXT NOT NULL,
  bedrooms INTEGER NOT NULL,
  bathrooms INTEGER NOT NULL,
  size DECIMAL(10,2) NOT NULL,
  size_unit TEXT DEFAULT 'sqft',
  description TEXT,
  features TEXT[] DEFAULT '{}',
  images TEXT[] DEFAULT '{}',
  status property_status NOT NULL DEFAULT 'available',
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 9. Create lead_attachments table
CREATE TABLE public.lead_attachments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id UUID REFERENCES public.leads(id) ON DELETE CASCADE NOT NULL,
  folder TEXT NOT NULL DEFAULT 'Documents',
  file_name TEXT NOT NULL,
  file_path TEXT NOT NULL,
  file_size INTEGER,
  file_type TEXT,
  uploaded_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 10. Create sync_logs table for Google Sheets
CREATE TABLE public.sync_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  operation TEXT NOT NULL,
  table_name TEXT NOT NULL,
  record_id UUID,
  old_data JSONB,
  new_data JSONB,
  source TEXT NOT NULL DEFAULT 'crm',
  status TEXT NOT NULL DEFAULT 'success',
  error_message TEXT,
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 11. Create activity_logs table for full audit trail
CREATE TABLE public.activity_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  table_name TEXT NOT NULL,
  record_id UUID NOT NULL,
  action TEXT NOT NULL,
  old_values JSONB,
  new_values JSONB,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  source TEXT NOT NULL DEFAULT 'crm',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- =============================================
-- SECURITY DEFINER FUNCTIONS
-- =============================================

-- Check if user has a specific role
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$$;

-- Check if current user is admin
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.has_role(auth.uid(), 'admin')
$$;

-- Check if agent is assigned to lead
CREATE OR REPLACE FUNCTION public.is_agent_assigned_to_lead(_lead_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.leads
    WHERE id = _lead_id
      AND (assigned_agent_id = auth.uid() OR created_by = auth.uid())
  )
$$;

-- Check if user can access lead (admin OR assigned agent)
CREATE OR REPLACE FUNCTION public.can_access_lead(_lead_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.is_admin() OR public.is_agent_assigned_to_lead(_lead_id)
$$;

-- Get current user role
CREATE OR REPLACE FUNCTION public.get_user_role()
RETURNS app_role
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role FROM public.user_roles WHERE user_id = auth.uid() LIMIT 1
$$;

-- =============================================
-- ENABLE RLS ON ALL TABLES
-- =============================================

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cold_calls ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.properties ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lead_attachments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sync_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.activity_logs ENABLE ROW LEVEL SECURITY;

-- =============================================
-- RLS POLICIES
-- =============================================

-- USER_ROLES policies
CREATE POLICY "Users can view own role" ON public.user_roles
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Admins can manage all roles" ON public.user_roles
  FOR ALL USING (public.is_admin());

-- PROFILES policies
CREATE POLICY "Users can view all profiles" ON public.profiles
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Users can update own profile" ON public.profiles
  FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Users can insert own profile" ON public.profiles
  FOR INSERT WITH CHECK (auth.uid() = id);

CREATE POLICY "Admins can manage all profiles" ON public.profiles
  FOR ALL USING (public.is_admin());

-- LEADS policies
CREATE POLICY "Admins can manage all leads" ON public.leads
  FOR ALL USING (public.is_admin());

CREATE POLICY "Agents can view assigned leads" ON public.leads
  FOR SELECT USING (
    assigned_agent_id = auth.uid() OR created_by = auth.uid()
  );

CREATE POLICY "Agents can create leads" ON public.leads
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Agents can update assigned leads" ON public.leads
  FOR UPDATE USING (
    assigned_agent_id = auth.uid() OR created_by = auth.uid()
  );

CREATE POLICY "Agents can delete own leads" ON public.leads
  FOR DELETE USING (created_by = auth.uid());

-- ACTIVITIES policies
CREATE POLICY "Admins can manage all activities" ON public.activities
  FOR ALL USING (public.is_admin());

CREATE POLICY "Agents can view activities for accessible leads" ON public.activities
  FOR SELECT USING (public.can_access_lead(lead_id));

CREATE POLICY "Agents can create activities for accessible leads" ON public.activities
  FOR INSERT WITH CHECK (public.can_access_lead(lead_id));

CREATE POLICY "Agents can update own activities" ON public.activities
  FOR UPDATE USING (created_by = auth.uid());

CREATE POLICY "Agents can delete own activities" ON public.activities
  FOR DELETE USING (created_by = auth.uid());

-- TASKS policies
CREATE POLICY "Admins can manage all tasks" ON public.tasks
  FOR ALL USING (public.is_admin());

CREATE POLICY "Agents can view tasks for accessible leads" ON public.tasks
  FOR SELECT USING (
    public.can_access_lead(lead_id) OR assigned_to = auth.uid()
  );

CREATE POLICY "Agents can create tasks for accessible leads" ON public.tasks
  FOR INSERT WITH CHECK (public.can_access_lead(lead_id));

CREATE POLICY "Agents can update assigned tasks" ON public.tasks
  FOR UPDATE USING (
    assigned_to = auth.uid() OR created_by = auth.uid()
  );

CREATE POLICY "Agents can delete own tasks" ON public.tasks
  FOR DELETE USING (created_by = auth.uid());

-- COLD_CALLS policies
CREATE POLICY "Admins can manage all cold calls" ON public.cold_calls
  FOR ALL USING (public.is_admin());

CREATE POLICY "Agents can view assigned cold calls" ON public.cold_calls
  FOR SELECT USING (
    assigned_agent_id = auth.uid() OR created_by = auth.uid()
  );

CREATE POLICY "Agents can create cold calls" ON public.cold_calls
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Agents can update assigned cold calls" ON public.cold_calls
  FOR UPDATE USING (
    assigned_agent_id = auth.uid() OR created_by = auth.uid()
  );

CREATE POLICY "Agents can delete own cold calls" ON public.cold_calls
  FOR DELETE USING (created_by = auth.uid());

-- PROPERTIES policies
CREATE POLICY "Anyone can view available properties" ON public.properties
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admins can manage properties" ON public.properties
  FOR ALL USING (public.is_admin());

CREATE POLICY "Agents can create properties" ON public.properties
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

-- LEAD_ATTACHMENTS policies
CREATE POLICY "Users can view attachments for accessible leads" ON public.lead_attachments
  FOR SELECT USING (public.can_access_lead(lead_id));

CREATE POLICY "Users can upload attachments for accessible leads" ON public.lead_attachments
  FOR INSERT WITH CHECK (public.can_access_lead(lead_id));

CREATE POLICY "Users can delete own attachments" ON public.lead_attachments
  FOR DELETE USING (uploaded_by = auth.uid());

CREATE POLICY "Admins can manage all attachments" ON public.lead_attachments
  FOR ALL USING (public.is_admin());

-- SYNC_LOGS policies
CREATE POLICY "Admins can view all sync logs" ON public.sync_logs
  FOR SELECT USING (public.is_admin());

CREATE POLICY "System can insert sync logs" ON public.sync_logs
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

-- ACTIVITY_LOGS policies
CREATE POLICY "Admins can view all activity logs" ON public.activity_logs
  FOR SELECT USING (public.is_admin());

CREATE POLICY "System can insert activity logs" ON public.activity_logs
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

-- =============================================
-- TRIGGERS FOR AUTOMATIC UPDATES
-- =============================================

-- Updated_at trigger function
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply updated_at triggers
CREATE TRIGGER set_updated_at_profiles
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER set_updated_at_leads
  BEFORE UPDATE ON public.leads
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER set_updated_at_tasks
  BEFORE UPDATE ON public.tasks
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER set_updated_at_cold_calls
  BEFORE UPDATE ON public.cold_calls
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER set_updated_at_properties
  BEFORE UPDATE ON public.properties
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- =============================================
-- PROFILE AUTO-CREATION ON SIGNUP
-- =============================================

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  -- Create profile
  INSERT INTO public.profiles (id, email, full_name)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1))
  );
  
  -- Assign default agent role
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'agent');
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- =============================================
-- ACTIVITY LOGGING TRIGGER
-- =============================================

CREATE OR REPLACE FUNCTION public.log_activity()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.activity_logs (table_name, record_id, action, new_values, user_id)
    VALUES (TG_TABLE_NAME, NEW.id, 'INSERT', to_jsonb(NEW), auth.uid());
  ELSIF TG_OP = 'UPDATE' THEN
    INSERT INTO public.activity_logs (table_name, record_id, action, old_values, new_values, user_id)
    VALUES (TG_TABLE_NAME, NEW.id, 'UPDATE', to_jsonb(OLD), to_jsonb(NEW), auth.uid());
  ELSIF TG_OP = 'DELETE' THEN
    INSERT INTO public.activity_logs (table_name, record_id, action, old_values, user_id)
    VALUES (TG_TABLE_NAME, OLD.id, 'DELETE', to_jsonb(OLD), auth.uid());
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Apply activity logging to key tables
CREATE TRIGGER log_leads_activity
  AFTER INSERT OR UPDATE OR DELETE ON public.leads
  FOR EACH ROW EXECUTE FUNCTION public.log_activity();

CREATE TRIGGER log_tasks_activity
  AFTER INSERT OR UPDATE OR DELETE ON public.tasks
  FOR EACH ROW EXECUTE FUNCTION public.log_activity();

CREATE TRIGGER log_cold_calls_activity
  AFTER INSERT OR UPDATE OR DELETE ON public.cold_calls
  FOR EACH ROW EXECUTE FUNCTION public.log_activity();

-- =============================================
-- INDEXES FOR PERFORMANCE
-- =============================================

CREATE INDEX idx_leads_assigned_agent ON public.leads(assigned_agent_id);
CREATE INDEX idx_leads_status ON public.leads(status);
CREATE INDEX idx_leads_priority ON public.leads(priority);
CREATE INDEX idx_leads_created_at ON public.leads(created_at DESC);
CREATE INDEX idx_activities_lead_id ON public.activities(lead_id);
CREATE INDEX idx_activities_created_at ON public.activities(created_at DESC);
CREATE INDEX idx_tasks_lead_id ON public.tasks(lead_id);
CREATE INDEX idx_tasks_assigned_to ON public.tasks(assigned_to);
CREATE INDEX idx_tasks_due_date ON public.tasks(due_date);
CREATE INDEX idx_tasks_status ON public.tasks(status);
CREATE INDEX idx_cold_calls_assigned_agent ON public.cold_calls(assigned_agent_id);
CREATE INDEX idx_cold_calls_status ON public.cold_calls(status);
CREATE INDEX idx_properties_status ON public.properties(status);
CREATE INDEX idx_properties_type ON public.properties(type);
CREATE INDEX idx_activity_logs_table_record ON public.activity_logs(table_name, record_id);
CREATE INDEX idx_activity_logs_created_at ON public.activity_logs(created_at DESC);

-- =============================================
-- ENABLE REALTIME
-- =============================================

ALTER PUBLICATION supabase_realtime ADD TABLE public.leads;
ALTER PUBLICATION supabase_realtime ADD TABLE public.activities;
ALTER PUBLICATION supabase_realtime ADD TABLE public.tasks;
ALTER PUBLICATION supabase_realtime ADD TABLE public.cold_calls;