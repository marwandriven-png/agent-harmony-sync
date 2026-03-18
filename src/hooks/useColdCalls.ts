import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { toast } from 'sonner';
import { useEffect } from 'react';
import type { Database } from '@/integrations/supabase/types';

type ColdCallRow = Database['public']['Tables']['cold_calls']['Row'];
type ColdCallInsert = Database['public']['Tables']['cold_calls']['Insert'];
type ColdCallUpdate = Database['public']['Tables']['cold_calls']['Update'];
type ColdCallStatus = Database['public']['Enums']['cold_call_status'];

export interface ColdCallWithProfile extends ColdCallRow {
  profiles?: {
    id: string;
    full_name: string;
    email: string;
    avatar_url: string | null;
  } | null;
}

export function useColdCalls() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['cold_calls'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('cold_calls')
        .select(`
          *,
          profiles!cold_calls_assigned_agent_id_fkey (
            id,
            full_name,
            email,
            avatar_url
          )
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data as unknown as ColdCallWithProfile[];
    },
    enabled: !!user,
  });

  // Set up realtime subscription
  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel('cold_calls-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'cold_calls',
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ['cold_calls'] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, queryClient]);

  return query;
}

export function useCreateColdCall() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (coldCall: Omit<ColdCallInsert, 'id' | 'created_at' | 'updated_at' | 'created_by'>) => {
      const { data, error } = await supabase
        .from('cold_calls')
        .insert({
          ...coldCall,
          created_by: user?.id,
          assigned_agent_id: coldCall.assigned_agent_id || user?.id,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cold_calls'] });
      toast.success('Cold call added successfully');
    },
    onError: (error) => {
      toast.error(`Failed to add cold call: ${error.message}`);
    },
  });
}

export function useUpdateColdCall() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...updates }: ColdCallUpdate & { id: string }) => {
      const { data, error } = await supabase
        .from('cold_calls')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cold_calls'] });
      toast.success('Cold call updated successfully');
    },
    onError: (error) => {
      toast.error(`Failed to update cold call: ${error.message}`);
    },
  });
}

export function useConvertColdCallToLead() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (coldCallId: string) => {
      // Fetch the cold call
      const { data: coldCall, error: fetchError } = await supabase
        .from('cold_calls')
        .select('*')
        .eq('id', coldCallId)
        .single();

      if (fetchError) throw fetchError;

      // Create the lead
      const { data: lead, error: leadError } = await supabase
        .from('leads')
        .insert({
          name: coldCall.name,
          email: coldCall.email,
          phone: coldCall.phone,
          source: coldCall.source,
          status: 'new',
          priority: 'warm',
          budget_min: coldCall.budget,
          budget_max: coldCall.budget ? coldCall.budget * 1.5 : null,
          budget_currency: 'AED',
          bedrooms: coldCall.bedrooms,
          locations: coldCall.location ? [coldCall.location] : [],
          requirements_notes: coldCall.notes,
          assigned_agent_id: coldCall.assigned_agent_id,
          created_by: user?.id,
        })
        .select()
        .single();

      if (leadError) throw leadError;

      // Update cold call status
      const { error: updateError } = await supabase
        .from('cold_calls')
        .update({
          status: 'converted' as ColdCallStatus,
          converted_lead_id: lead.id,
        })
        .eq('id', coldCallId);

      if (updateError) throw updateError;

      // Create activity
      await supabase.from('activities').insert({
        lead_id: lead.id,
        type: 'note',
        title: 'Lead created from cold call',
        description: 'Converted from cold call record',
        created_by: user?.id,
      });

      return lead;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cold_calls'] });
      queryClient.invalidateQueries({ queryKey: ['leads'] });
      toast.success('Cold call converted to lead successfully');
    },
    onError: (error) => {
      toast.error(`Failed to convert cold call: ${error.message}`);
    },
  });
}

export function useDeleteColdCall() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('cold_calls')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cold_calls'] });
      toast.success('Cold call deleted successfully');
    },
    onError: (error) => {
      toast.error(`Failed to delete cold call: ${error.message}`);
    },
  });
}
