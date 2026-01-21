import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { toast } from 'sonner';
import type { Database } from '@/integrations/supabase/types';

type DataSourceRow = Database['public']['Tables']['data_sources']['Row'];

export function useDataSources(tableName?: string) {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['data_sources', tableName],
    queryFn: async () => {
      let query = supabase.from('data_sources').select('*').order('created_at', { ascending: false });
      
      if (tableName) {
        query = query.eq('table_name', tableName);
      }
      
      const { data, error } = await query;
      if (error) throw error;
      return data as DataSourceRow[];
    },
    enabled: !!user,
  });
}

export function useSyncFromSheet() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (sourceId: string) => {
      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/sync-data`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({ sourceId }),
      });

      const result = await response.json();
      
      if (!response.ok) {
        throw new Error(result.error || 'Sync failed');
      }
      
      return result;
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['properties'] });
      queryClient.invalidateQueries({ queryKey: ['leads'] });
      queryClient.invalidateQueries({ queryKey: ['cold_calls'] });
      queryClient.invalidateQueries({ queryKey: ['data_sources'] });
      
      if (result.inserted > 0) {
        toast.success(`Synced ${result.inserted} records successfully!`);
      } else {
        toast.info('Sync completed. No new records found.');
      }
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : 'Failed to sync data');
    },
  });
}
