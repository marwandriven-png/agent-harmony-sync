import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface Campaign {
  id: string;
  name: string;
  description: string | null;
  status: string;
  campaign_type: string;
  whatsapp_enabled: boolean;
  email_enabled: boolean;
  linkedin_enabled: boolean;
  whatsapp_template: string | null;
  email_subject: string | null;
  email_body: string | null;
  linkedin_message: string | null;
  scheduled_at: string | null;
  started_at: string | null;
  completed_at: string | null;
  send_interval_seconds: number;
  total_leads: number;
  sent_count: number;
  delivered_count: number;
  read_count: number;
  replied_count: number;
  failed_count: number;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export function useCampaigns() {
  return useQuery({
    queryKey: ['campaigns'],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke('campaign-engine', {
        body: { action: 'list' },
      });
      if (error) throw error;
      return data.campaigns as Campaign[];
    },
  });
}

export function useCampaign(campaignId: string | undefined) {
  return useQuery({
    queryKey: ['campaign', campaignId],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke('campaign-engine', {
        body: { action: 'get', campaign_id: campaignId },
      });
      if (error) throw error;
      return data;
    },
    enabled: !!campaignId,
  });
}

export function useCreateCampaign() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (campaignData: Partial<Campaign>) => {
      const { data, error } = await supabase.functions.invoke('campaign-engine', {
        body: { action: 'create', data: campaignData },
      });
      if (error) throw error;
      return data.campaign;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['campaigns'] });
      toast.success('Campaign created successfully');
    },
    onError: (error) => {
      toast.error(`Failed to create campaign: ${error.message}`);
    },
  });
}

export function useAddLeadsToCampaign() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ campaignId, leadIds }: { campaignId: string; leadIds: string[] }) => {
      const { data, error } = await supabase.functions.invoke('campaign-engine', {
        body: { action: 'add_leads', campaign_id: campaignId, data: { lead_ids: leadIds } },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (_, { campaignId }) => {
      queryClient.invalidateQueries({ queryKey: ['campaign', campaignId] });
      toast.success('Leads added to campaign');
    },
    onError: (error) => {
      toast.error(`Failed to add leads: ${error.message}`);
    },
  });
}

export function useStartCampaign() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (campaignId: string) => {
      // First check if campaign has leads
      const { data: checkData } = await supabase.functions.invoke('campaign-engine', {
        body: { action: 'get', campaign_id: campaignId },
      });
      
      const campaignLeads = checkData?.leads || [];
      const hasPending = campaignLeads.some((l: any) => l.status === 'pending');
      const hasFailed = campaignLeads.some((l: any) => l.status === 'failed');

      if (campaignLeads.length === 0) {
        // No leads at all — fetch all and add them
        const { data: allLeads, error: leadsError } = await supabase
          .from('leads')
          .select('id')
          .not('status', 'eq', 'lost');
        
        if (leadsError) throw leadsError;
        if (!allLeads || allLeads.length === 0) {
          throw new Error('No leads available to add to this campaign. Create some leads first.');
        }

        const leadIds = allLeads.map((l) => l.id);
        const { error: addError } = await supabase.functions.invoke('campaign-engine', {
          body: { action: 'add_leads', campaign_id: campaignId, data: { lead_ids: leadIds } },
        });
        if (addError) throw addError;
      } else if (!hasPending && hasFailed) {
        // All leads failed — retry them by resetting to pending
        const { error: retryError } = await supabase.functions.invoke('campaign-engine', {
          body: { action: 'retry_failed', campaign_id: campaignId },
        });
        if (retryError) throw retryError;
      }

      const { data, error } = await supabase.functions.invoke('campaign-engine', {
        body: { action: 'start', campaign_id: campaignId },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['campaigns'] });
      toast.success('Campaign started');
    },
    onError: (error) => {
      toast.error(`Failed to start campaign: ${error.message}`);
    },
  });
}

export function useCampaignStats(campaignId: string | undefined) {
  return useQuery({
    queryKey: ['campaign-stats', campaignId],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke('campaign-engine', {
        body: { action: 'stats', campaign_id: campaignId },
      });
      if (error) throw error;
      return data;
    },
    enabled: !!campaignId,
    refetchInterval: 10000, // Poll every 10s for active campaigns
  });
}
