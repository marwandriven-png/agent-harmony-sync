import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { toast } from 'sonner';
import { useEffect } from 'react';
import type { Database } from '@/integrations/supabase/types';

type ActivityRow = Database['public']['Tables']['activities']['Row'];
type ActivityInsert = Database['public']['Tables']['activities']['Insert'];
type ActivityType = Database['public']['Enums']['activity_type'];

export interface ActivityWithProfile extends ActivityRow {
  profiles?: {
    id: string;
    full_name: string;
    email: string;
    avatar_url: string | null;
  } | null;
}

export function useActivitiesByLead(leadId: string) {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['activities', leadId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('activities')
        .select(`
          *,
          profiles:created_by (
            id,
            full_name,
            email,
            avatar_url
          )
        `)
        .eq('lead_id', leadId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data as ActivityWithProfile[];
    },
    enabled: !!user && !!leadId,
  });

  // Set up realtime subscription
  useEffect(() => {
    if (!user || !leadId) return;

    const channel = supabase
      .channel(`activities-${leadId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'activities',
          filter: `lead_id=eq.${leadId}`,
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ['activities', leadId] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, leadId, queryClient]);

  return query;
}

export function useRecentActivities(limit = 10) {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['activities', 'recent', limit],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('activities')
        .select(`
          *,
          profiles:created_by (
            id,
            full_name,
            email,
            avatar_url
          ),
          leads:lead_id (
            id,
            name
          )
        `)
        .order('created_at', { ascending: false })
        .limit(limit);

      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });
}

export function useCreateActivity() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (activity: Omit<ActivityInsert, 'id' | 'created_at' | 'created_by'>) => {
      const { data, error } = await supabase
        .from('activities')
        .insert({
          ...activity,
          created_by: user?.id,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['activities', data.lead_id] });
      queryClient.invalidateQueries({ queryKey: ['activities', 'recent'] });
      toast.success('Activity logged successfully');
    },
    onError: (error) => {
      toast.error(`Failed to log activity: ${error.message}`);
    },
  });
}
