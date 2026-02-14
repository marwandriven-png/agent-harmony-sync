import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { toast } from 'sonner';
import { useEffect } from 'react';

export interface CalledCall {
  id: string;
  lead_id: string | null;
  agent_id: string | null;
  phone_number: string;
  direction: 'inbound' | 'outbound';
  status: 'answered' | 'missed' | 'rejected' | 'busy' | 'failed' | 'in_progress' | 'completed';
  call_date: string;
  started_at: string | null;
  ended_at: string | null;
  duration_seconds: number;
  provider_call_sid: string | null;
  recording_url: string | null;
  recording_duration: number | null;
  transcript_text: string | null;
  transcript_status: string;
  transcript_provider: string | null;
  ai_evaluation_status: string;
  ai_overall_score: number | null;
  ai_confidence_score: number | null;
  ai_closing_probability: number | null;
  ai_lead_intent_score: number | null;
  ai_strengths: string[];
  ai_weaknesses: string[];
  ai_full_analysis: Record<string, unknown> | null;
  notes: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  // Joined
  lead?: { id: string; name: string; phone: string } | null;
  profiles?: { id: string; full_name: string; avatar_url: string | null } | null;
}

export function useCalls(filters?: { leadId?: string; agentId?: string }) {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['called_calls', filters],
    queryFn: async () => {
      let q = supabase
        .from('called_calls')
        .select(`
          *,
          lead:leads!called_calls_lead_id_fkey(id, name, phone),
          profiles!called_calls_agent_id_fkey(id, full_name, avatar_url)
        `)
        .order('call_date', { ascending: false });

      if (filters?.leadId) q = q.eq('lead_id', filters.leadId);
      if (filters?.agentId) q = q.eq('agent_id', filters.agentId);

      const { data, error } = await q;
      if (error) throw error;
      return data as unknown as CalledCall[];
    },
    enabled: !!user,
  });

  // Realtime subscription
  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel('called_calls-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'called_calls' }, () => {
        queryClient.invalidateQueries({ queryKey: ['called_calls'] });
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user, queryClient]);

  return query;
}

export function useCreateCall() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (call: {
      lead_id?: string;
      phone_number: string;
      direction: 'inbound' | 'outbound';
      status?: string;
      duration_seconds?: number;
      notes?: string;
      transcript_text?: string;
      recording_url?: string;
    }) => {
      const { data, error } = await supabase
        .from('called_calls')
        .insert({
          ...call,
          agent_id: user?.id,
          created_by: user?.id,
          status: (call.status as any) || 'completed',
        })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['called_calls'] });
      toast.success('Call logged successfully');
    },
    onError: (error) => {
      toast.error(`Failed to log call: ${error.message}`);
    },
  });
}

export function useUpdateCall() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...updates }: { id: string; [key: string]: any }) => {
      const { data, error } = await supabase
        .from('called_calls')
        .update(updates)
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['called_calls'] });
      toast.success('Call updated');
    },
    onError: (error) => {
      toast.error(`Failed to update call: ${error.message}`);
    },
  });
}

export function useDeleteCall() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('called_calls').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['called_calls'] });
      toast.success('Call deleted');
    },
    onError: (error) => {
      toast.error(`Failed to delete call: ${error.message}`);
    },
  });
}

export function useEvaluateCall() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (callId: string) => {
      const { data, error } = await supabase.functions.invoke('call-evaluate', {
        body: { call_id: callId },
      });
      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || 'Evaluation failed');
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['called_calls'] });
      toast.success('AI evaluation completed');
    },
    onError: (error) => {
      toast.error(`AI evaluation failed: ${error.message}`);
    },
  });
}

export function useCallKPIs(agentId?: string) {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['call_kpis', agentId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('call_kpis')
        .select('*')
        .eq('agent_id', agentId || user?.id || '')
        .order('period_start', { ascending: false })
        .limit(10);
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });
}
