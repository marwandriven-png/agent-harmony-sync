
-- Call direction and status enums
CREATE TYPE public.call_direction AS ENUM ('inbound', 'outbound');
CREATE TYPE public.call_status AS ENUM ('answered', 'missed', 'rejected', 'busy', 'failed', 'in_progress', 'completed');

-- Called Calls table (core call logging)
CREATE TABLE public.called_calls (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  lead_id uuid REFERENCES public.leads(id) ON DELETE SET NULL,
  agent_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  phone_number text NOT NULL,
  direction public.call_direction NOT NULL DEFAULT 'outbound',
  status public.call_status NOT NULL DEFAULT 'in_progress',
  call_date timestamptz NOT NULL DEFAULT now(),
  started_at timestamptz,
  ended_at timestamptz,
  duration_seconds integer DEFAULT 0,
  provider_call_sid text UNIQUE,
  provider_recording_sid text UNIQUE,
  recording_url text,
  recording_duration integer,
  transcript_text text,
  transcript_status text DEFAULT 'pending',
  transcript_provider text,
  ai_evaluation_status text DEFAULT 'pending',
  ai_overall_score numeric,
  ai_confidence_score numeric,
  ai_closing_probability numeric,
  ai_lead_intent_score numeric,
  ai_strengths jsonb DEFAULT '[]'::jsonb,
  ai_weaknesses jsonb DEFAULT '[]'::jsonb,
  ai_full_analysis jsonb,
  notes text,
  created_by uuid REFERENCES public.profiles(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Call KPIs table (weekly/monthly aggregation)
CREATE TABLE public.call_kpis (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  agent_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  period_type text NOT NULL,
  period_start timestamptz NOT NULL,
  period_end timestamptz NOT NULL,
  total_calls integer DEFAULT 0,
  inbound_calls integer DEFAULT 0,
  outbound_calls integer DEFAULT 0,
  answered_calls integer DEFAULT 0,
  missed_calls integer DEFAULT 0,
  total_duration_seconds integer DEFAULT 0,
  avg_duration_seconds numeric DEFAULT 0,
  avg_ai_score numeric DEFAULT 0,
  answer_rate numeric DEFAULT 0,
  high_intent_calls integer DEFAULT 0,
  weak_calls integer DEFAULT 0,
  leads_converted integer DEFAULT 0,
  conversion_rate numeric DEFAULT 0,
  common_strengths jsonb DEFAULT '[]'::jsonb,
  common_weaknesses jsonb DEFAULT '[]'::jsonb,
  improvement_suggestions text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (agent_id, period_type, period_start)
);

-- Call Webhook Logs
CREATE TABLE public.call_webhook_logs (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  provider text NOT NULL,
  event_type text NOT NULL,
  payload jsonb NOT NULL,
  processed boolean DEFAULT false,
  error_message text,
  received_at timestamptz NOT NULL DEFAULT now(),
  processed_at timestamptz
);

-- Enable RLS
ALTER TABLE public.called_calls ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.call_kpis ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.call_webhook_logs ENABLE ROW LEVEL SECURITY;

-- RLS for called_calls
CREATE POLICY "Admins can manage all calls" ON public.called_calls FOR ALL USING (is_admin());
CREATE POLICY "Agents can view own calls" ON public.called_calls FOR SELECT USING (agent_id = auth.uid() OR created_by = auth.uid());
CREATE POLICY "Agents can create calls" ON public.called_calls FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Agents can update own calls" ON public.called_calls FOR UPDATE USING (agent_id = auth.uid() OR created_by = auth.uid());
CREATE POLICY "Agents can delete own calls" ON public.called_calls FOR DELETE USING (created_by = auth.uid());

-- RLS for call_kpis
CREATE POLICY "Admins can manage all KPIs" ON public.call_kpis FOR ALL USING (is_admin());
CREATE POLICY "Agents can view own KPIs" ON public.call_kpis FOR SELECT USING (agent_id = auth.uid());
CREATE POLICY "System can insert KPIs" ON public.call_kpis FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "System can update KPIs" ON public.call_kpis FOR UPDATE USING (auth.uid() IS NOT NULL);

-- RLS for webhook logs
CREATE POLICY "Admins can view webhook logs" ON public.call_webhook_logs FOR SELECT USING (is_admin());
CREATE POLICY "System can insert webhook logs" ON public.call_webhook_logs FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

-- Indexes
CREATE INDEX idx_called_calls_lead ON public.called_calls(lead_id);
CREATE INDEX idx_called_calls_agent ON public.called_calls(agent_id);
CREATE INDEX idx_called_calls_date ON public.called_calls(call_date DESC);
CREATE INDEX idx_called_calls_status ON public.called_calls(status);
CREATE INDEX idx_call_kpis_agent_period ON public.call_kpis(agent_id, period_type, period_start);

-- Updated_at triggers
CREATE TRIGGER update_called_calls_updated_at BEFORE UPDATE ON public.called_calls FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
CREATE TRIGGER update_call_kpis_updated_at BEFORE UPDATE ON public.call_kpis FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.called_calls;
