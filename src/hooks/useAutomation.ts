import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import {
  detectCountry,
  getTimezoneForCountry,
} from '@/lib/timezones';
import {
  mapSourceToClassification,
  isAutomationEligible,
  type SourceClassification,
} from '@/lib/automationRules';

/**
 * Hook to auto-detect and update lead's country/timezone/classification.
 */
export function useDetectLeadMetadata() {
  return useMutation({
    mutationFn: async (lead: {
      id: string;
      phone?: string | null;
      email?: string | null;
      detected_country?: string | null;
      source?: string;
      whatsapp_initiated?: boolean;
    }) => {
      const country = detectCountry(lead.detected_country, lead.phone, lead.email);
      const timezone = country ? getTimezoneForCountry(country) : null;
      const classification = mapSourceToClassification(
        lead.source || 'other',
        { whatsapp_initiated: lead.whatsapp_initiated }
      );

      const updates: Record<string, unknown> = {};
      if (country) updates.detected_country = country;
      if (timezone) updates.detected_timezone = timezone;
      updates.source_classification = classification;

      const { error } = await supabase
        .from('leads')
        .update(updates)
        .eq('id', lead.id);

      if (error) throw error;
      return { country, timezone, classification };
    },
  });
}

/**
 * Hook to stop automation for a lead.
 */
export function useStopLeadAutomation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ leadId, reason }: { leadId: string; reason: string }) => {
      const { data, error } = await supabase.functions.invoke('campaign-engine', {
        body: { action: 'stop_lead', lead_id: leadId, data: { reason } },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['leads'] });
      toast.success('Automation stopped for this lead');
    },
    onError: (error) => {
      toast.error(`Failed to stop automation: ${error.message}`);
    },
  });
}

/**
 * Hook to fetch automation logs for a lead.
 */
export function useAutomationLogs(leadId: string | undefined) {
  return useQuery({
    queryKey: ['automation-logs', leadId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('automation_queue')
        .select('*')
        .eq('lead_id', leadId!)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!leadId,
  });
}

/**
 * Hook to update lead source classification.
 */
export function useUpdateSourceClassification() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ leadId, classification }: { leadId: string; classification: SourceClassification }) => {
      const { error } = await supabase
        .from('leads')
        .update({ source_classification: classification } as any)
        .eq('id', leadId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['leads'] });
    },
  });
}

/**
 * Hook to verify lead contact details.
 */
export function useVerifyContact() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (leadId: string) => {
      const { error } = await supabase
        .from('leads')
        .update({ contact_verified: true } as any)
        .eq('id', leadId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['leads'] });
      toast.success('Contact verified');
    },
  });
}
