
-- 1. Lead Source Classification Enum
CREATE TYPE public.lead_source_classification AS ENUM (
  'linkedin_inbound',
  'linkedin_outreach_response',
  'whatsapp_inbound',
  'dubai_owner_database',
  'referral',
  'cold_imported'
);

-- 2. Add automation-related fields to leads table
ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS source_classification public.lead_source_classification DEFAULT 'cold_imported',
  ADD COLUMN IF NOT EXISTS contact_verified boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS detected_country text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS detected_timezone text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS automation_eligible boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS automation_stopped boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS automation_stop_reason text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS automation_stopped_at timestamptz DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS whatsapp_opt_in boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS whatsapp_initiated boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS email_bounce boolean NOT NULL DEFAULT false;

-- 3. Automation Queue table – timezone-aware scheduled sends
CREATE TABLE public.automation_queue (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  lead_id uuid NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  campaign_id uuid REFERENCES public.campaigns(id) ON DELETE SET NULL,
  channel text NOT NULL CHECK (channel IN ('email', 'whatsapp')),
  sequence_step integer NOT NULL DEFAULT 1,
  scheduled_at timestamptz NOT NULL,
  scheduled_local_time text NOT NULL,
  lead_timezone text NOT NULL DEFAULT 'UTC',
  status text NOT NULL DEFAULT 'queued' CHECK (status IN ('queued', 'sending', 'sent', 'cancelled', 'failed', 'bounced')),
  message_subject text,
  message_body text NOT NULL,
  template_name text,
  attempt_count integer NOT NULL DEFAULT 0,
  max_attempts integer NOT NULL DEFAULT 1,
  sent_at timestamptz,
  error_message text,
  cancelled_reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.automation_queue ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view automation queue for accessible leads"
  ON public.automation_queue FOR SELECT
  USING (can_access_lead(lead_id) OR is_admin());

CREATE POLICY "System can insert automation queue"
  ON public.automation_queue FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "System can update automation queue"
  ON public.automation_queue FOR UPDATE
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Admins can delete automation queue"
  ON public.automation_queue FOR DELETE
  USING (is_admin());

-- 4. Automation Logs table – compliance logging
CREATE TABLE public.automation_logs (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  lead_id uuid NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  campaign_id uuid REFERENCES public.campaigns(id) ON DELETE SET NULL,
  event_type text NOT NULL,
  channel text,
  trigger_source text,
  lead_source_classification public.lead_source_classification,
  system_timestamp timestamptz NOT NULL DEFAULT now(),
  lead_local_timestamp text,
  lead_timezone text,
  stop_condition text,
  stop_reason text,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.automation_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view automation logs"
  ON public.automation_logs FOR SELECT
  USING (can_access_lead(lead_id) OR is_admin());

CREATE POLICY "System can insert automation logs"
  ON public.automation_logs FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

-- 5. Email Provider Config table – support Gmail/Outlook/SMTP/Resend
CREATE TABLE public.email_provider_config (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  provider_type text NOT NULL CHECK (provider_type IN ('resend', 'gmail', 'outlook', 'smtp')),
  display_name text NOT NULL,
  from_email text NOT NULL,
  from_name text,
  is_active boolean NOT NULL DEFAULT true,
  is_default boolean NOT NULL DEFAULT false,
  daily_send_limit integer NOT NULL DEFAULT 50,
  sent_today integer NOT NULL DEFAULT 0,
  last_reset_at timestamptz NOT NULL DEFAULT now(),
  warmup_enabled boolean NOT NULL DEFAULT false,
  warmup_daily_increment integer NOT NULL DEFAULT 5,
  warmup_started_at timestamptz,
  auth_status text NOT NULL DEFAULT 'unchecked' CHECK (auth_status IN ('unchecked', 'verified', 'failed')),
  spf_verified boolean NOT NULL DEFAULT false,
  dkim_verified boolean NOT NULL DEFAULT false,
  dmarc_verified boolean NOT NULL DEFAULT false,
  config jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.email_provider_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view email provider configs"
  ON public.email_provider_config FOR SELECT
  USING (created_by = auth.uid() OR is_admin());

CREATE POLICY "Users can create email provider configs"
  ON public.email_provider_config FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Users can update own email provider configs"
  ON public.email_provider_config FOR UPDATE
  USING (created_by = auth.uid() OR is_admin());

CREATE POLICY "Admins can delete email provider configs"
  ON public.email_provider_config FOR DELETE
  USING (is_admin());

-- 6. Add indexes
CREATE INDEX idx_automation_queue_status ON public.automation_queue(status);
CREATE INDEX idx_automation_queue_scheduled ON public.automation_queue(scheduled_at) WHERE status = 'queued';
CREATE INDEX idx_automation_queue_lead ON public.automation_queue(lead_id);
CREATE INDEX idx_automation_logs_lead ON public.automation_logs(lead_id);
CREATE INDEX idx_automation_logs_event ON public.automation_logs(event_type);
CREATE INDEX idx_leads_source_classification ON public.leads(source_classification);
CREATE INDEX idx_leads_automation_eligible ON public.leads(automation_eligible) WHERE automation_eligible = true;

-- 7. Trigger for updated_at on new tables
CREATE TRIGGER update_automation_queue_updated_at
  BEFORE UPDATE ON public.automation_queue
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER update_email_provider_config_updated_at
  BEFORE UPDATE ON public.email_provider_config
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
