
-- =============================================
-- CAMPAIGNS TABLE - Multi-channel campaign management
-- =============================================
CREATE TABLE public.campaigns (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'draft',  -- draft, active, paused, completed, archived
  campaign_type TEXT NOT NULL DEFAULT 'outreach',  -- outreach, follow_up, nurture, announcement
  
  -- Channel flags
  whatsapp_enabled BOOLEAN NOT NULL DEFAULT false,
  email_enabled BOOLEAN NOT NULL DEFAULT false,
  linkedin_enabled BOOLEAN NOT NULL DEFAULT false,
  
  -- Templates
  whatsapp_template TEXT,
  email_subject TEXT,
  email_body TEXT,
  linkedin_message TEXT,
  
  -- Scheduling
  scheduled_at TIMESTAMP WITH TIME ZONE,
  started_at TIMESTAMP WITH TIME ZONE,
  completed_at TIMESTAMP WITH TIME ZONE,
  send_interval_seconds INTEGER DEFAULT 30,  -- delay between messages for rate limiting
  
  -- Stats (denormalized for performance)
  total_leads INTEGER NOT NULL DEFAULT 0,
  sent_count INTEGER NOT NULL DEFAULT 0,
  delivered_count INTEGER NOT NULL DEFAULT 0,
  read_count INTEGER NOT NULL DEFAULT 0,
  replied_count INTEGER NOT NULL DEFAULT 0,
  failed_count INTEGER NOT NULL DEFAULT 0,
  
  -- Ownership
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.campaigns ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own campaigns" ON public.campaigns
  FOR SELECT USING (created_by = auth.uid() OR is_admin());

CREATE POLICY "Users can create campaigns" ON public.campaigns
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Users can update own campaigns" ON public.campaigns
  FOR UPDATE USING (created_by = auth.uid() OR is_admin());

CREATE POLICY "Users can delete own campaigns" ON public.campaigns
  FOR DELETE USING (created_by = auth.uid() OR is_admin());

-- =============================================
-- CAMPAIGN_LEADS - Links campaigns to leads
-- =============================================
CREATE TABLE public.campaign_leads (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  campaign_id UUID NOT NULL REFERENCES public.campaigns(id) ON DELETE CASCADE,
  lead_id UUID NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending',  -- pending, sent, delivered, read, replied, failed, skipped
  channel TEXT,  -- whatsapp, email, linkedin
  sent_at TIMESTAMP WITH TIME ZONE,
  delivered_at TIMESTAMP WITH TIME ZONE,
  read_at TIMESTAMP WITH TIME ZONE,
  replied_at TIMESTAMP WITH TIME ZONE,
  error_message TEXT,
  retry_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(campaign_id, lead_id, channel)
);

ALTER TABLE public.campaign_leads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view campaign leads" ON public.campaign_leads
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.campaigns c WHERE c.id = campaign_id AND (c.created_by = auth.uid() OR is_admin()))
  );

CREATE POLICY "Users can insert campaign leads" ON public.campaign_leads
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Users can update campaign leads" ON public.campaign_leads
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM public.campaigns c WHERE c.id = campaign_id AND (c.created_by = auth.uid() OR is_admin()))
  );

CREATE POLICY "Users can delete campaign leads" ON public.campaign_leads
  FOR DELETE USING (
    EXISTS (SELECT 1 FROM public.campaigns c WHERE c.id = campaign_id AND (c.created_by = auth.uid() OR is_admin()))
  );

-- =============================================
-- MESSAGES - All outbound messages across channels
-- =============================================
CREATE TABLE public.messages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  campaign_id UUID REFERENCES public.campaigns(id) ON DELETE SET NULL,
  lead_id UUID NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  channel TEXT NOT NULL,  -- whatsapp, email, linkedin
  direction TEXT NOT NULL DEFAULT 'outbound',  -- outbound, inbound
  
  -- Content
  subject TEXT,  -- for email
  body TEXT NOT NULL,
  template_name TEXT,
  template_variables JSONB DEFAULT '{}'::jsonb,
  
  -- Status tracking
  status TEXT NOT NULL DEFAULT 'queued',  -- queued, sent, delivered, read, replied, failed, bounced
  external_message_id TEXT,  -- provider's message ID (Meta msg ID, Resend msg ID)
  
  -- Error handling
  error_message TEXT,
  retry_count INTEGER NOT NULL DEFAULT 0,
  
  -- Timestamps
  sent_at TIMESTAMP WITH TIME ZONE,
  delivered_at TIMESTAMP WITH TIME ZONE,
  read_at TIMESTAMP WITH TIME ZONE,
  replied_at TIMESTAMP WITH TIME ZONE,
  
  -- Ownership
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view messages for accessible leads" ON public.messages
  FOR SELECT USING (can_access_lead(lead_id) OR is_admin());

CREATE POLICY "Users can create messages" ON public.messages
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Users can update own messages" ON public.messages
  FOR UPDATE USING (created_by = auth.uid() OR is_admin());

-- =============================================
-- CHANNEL_CREDENTIALS - Encrypted channel API keys
-- =============================================
CREATE TABLE public.channel_credentials (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  channel TEXT NOT NULL,  -- whatsapp, email, linkedin
  credential_key TEXT NOT NULL,  -- e.g., 'access_token', 'business_id', 'api_key'
  credential_value TEXT NOT NULL,  -- encrypted value
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(channel, credential_key, created_by)
);

ALTER TABLE public.channel_credentials ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own credentials" ON public.channel_credentials
  FOR SELECT USING (created_by = auth.uid() OR is_admin());

CREATE POLICY "Users can create credentials" ON public.channel_credentials
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Users can update own credentials" ON public.channel_credentials
  FOR UPDATE USING (created_by = auth.uid() OR is_admin());

CREATE POLICY "Users can delete own credentials" ON public.channel_credentials
  FOR DELETE USING (created_by = auth.uid() OR is_admin());

-- =============================================
-- Triggers for updated_at
-- =============================================
CREATE TRIGGER update_campaigns_updated_at
  BEFORE UPDATE ON public.campaigns
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER update_campaign_leads_updated_at
  BEFORE UPDATE ON public.campaign_leads
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER update_messages_updated_at
  BEFORE UPDATE ON public.messages
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER update_channel_credentials_updated_at
  BEFORE UPDATE ON public.channel_credentials
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- =============================================
-- Activity logging triggers
-- =============================================
CREATE TRIGGER log_campaigns_activity
  AFTER INSERT OR UPDATE OR DELETE ON public.campaigns
  FOR EACH ROW EXECUTE FUNCTION public.log_activity();

CREATE TRIGGER log_messages_activity
  AFTER INSERT OR UPDATE OR DELETE ON public.messages
  FOR EACH ROW EXECUTE FUNCTION public.log_activity();
