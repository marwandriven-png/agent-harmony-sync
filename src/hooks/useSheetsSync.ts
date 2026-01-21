import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { toast } from 'sonner';
import { useEffect, useRef, useCallback } from 'react';
import type { Database } from '@/integrations/supabase/types';

interface SyncConflict {
  row_id: string;
  crm_data: Record<string, unknown>;
  sheet_data: Record<string, unknown>;
  field_diffs: string[];
}

interface SyncResult {
  success: boolean;
  synced: number;
  errors: number;
  conflicts: SyncConflict[];
}

export function usePullFromSheets() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (sourceId: string) => {
      const { data, error } = await supabase.functions.invoke('sheets-sync', {
        body: { action: 'pull', sourceId },
      });

      if (error) throw error;
      return data as SyncResult;
    },
    onSuccess: (data) => {
      if (data.conflicts.length > 0) {
        toast.warning(`Sync complete with ${data.conflicts.length} conflicts to resolve`);
      } else {
        toast.success(`Synced ${data.synced} records from Google Sheets`);
      }
      queryClient.invalidateQueries({ queryKey: ['leads'] });
      queryClient.invalidateQueries({ queryKey: ['cold_calls'] });
      queryClient.invalidateQueries({ queryKey: ['properties'] });
    },
    onError: (error) => {
      toast.error(`Sync failed: ${error.message}`);
    },
  });
}

export function usePushToSheets() {
  return useMutation({
    mutationFn: async ({
      tableName,
      record,
      recordId,
    }: {
      tableName: string;
      record: Record<string, unknown>;
      recordId: string;
    }) => {
      const { data, error } = await supabase.functions.invoke('sheets-sync', {
        body: { action: 'push', tableName, record, recordId },
      });

      if (error) throw error;
      return data;
    },
    onError: (error) => {
      console.error('Failed to push to sheets:', error);
      // Silent fail - sheets sync is best-effort
    },
  });
}

export function useCheckSyncConflicts(sourceId: string | null) {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['sync-conflicts', sourceId],
    queryFn: async () => {
      if (!sourceId) return null;

      const { data, error } = await supabase.functions.invoke('sheets-sync', {
        body: { action: 'check_conflicts', sourceId },
      });

      if (error) throw error;
      return data;
    },
    enabled: !!user && !!sourceId,
    refetchInterval: 30000, // Poll every 30 seconds
  });
}

export function useSyncPolling(sourceId: string | null, enabled: boolean = true) {
  const { user } = useAuth();
  const pullFromSheets = usePullFromSheets();
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  const startPolling = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
    }

    if (sourceId && user && enabled) {
      // Initial sync
      pullFromSheets.mutate(sourceId);

      // Set up 30-second polling
      intervalRef.current = setInterval(() => {
        pullFromSheets.mutate(sourceId);
      }, 30000);
    }
  }, [sourceId, user, enabled, pullFromSheets]);

  const stopPolling = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  useEffect(() => {
    if (enabled) {
      startPolling();
    } else {
      stopPolling();
    }

    return () => stopPolling();
  }, [enabled, startPolling, stopPolling]);

  return {
    isPolling: !!intervalRef.current,
    isSyncing: pullFromSheets.isPending,
    startPolling,
    stopPolling,
    syncNow: () => sourceId && pullFromSheets.mutate(sourceId),
  };
}

export function useSyncConflictResolver() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      tableName,
      recordId,
      resolution,
      mergedData,
    }: {
      tableName: 'leads' | 'cold_calls' | 'properties' | 'tasks';
      recordId: string;
      resolution: 'keep_crm' | 'keep_sheet' | 'merge';
      mergedData?: Record<string, unknown>;
    }) => {
      if (resolution === 'keep_crm') {
        // Do nothing, CRM is already correct
        return { success: true };
      }

      if (resolution === 'keep_sheet' || resolution === 'merge') {
        // Type-safe update based on table name
        if (tableName === 'leads') {
          const { error } = await supabase
            .from('leads')
            .update(mergedData as Database['public']['Tables']['leads']['Update'])
            .eq('id', recordId);
          if (error) throw error;
        } else if (tableName === 'cold_calls') {
          const { error } = await supabase
            .from('cold_calls')
            .update(mergedData as Database['public']['Tables']['cold_calls']['Update'])
            .eq('id', recordId);
          if (error) throw error;
        } else if (tableName === 'properties') {
          const { error } = await supabase
            .from('properties')
            .update(mergedData as Database['public']['Tables']['properties']['Update'])
            .eq('id', recordId);
          if (error) throw error;
        } else if (tableName === 'tasks') {
          const { error } = await supabase
            .from('tasks')
            .update(mergedData as Database['public']['Tables']['tasks']['Update'])
            .eq('id', recordId);
          if (error) throw error;
        }
      }

      // Log the conflict resolution
      const logEntry = {
        table_name: tableName,
        record_id: recordId,
        operation: 'conflict_resolution',
        source: resolution === 'keep_sheet' ? 'google_sheets' : 'crm',
        status: 'success',
        new_data: mergedData ? JSON.parse(JSON.stringify(mergedData)) : null,
      };
      
      await supabase.from('sync_logs').insert(logEntry);

      return { success: true };
    },
    onSuccess: () => {
      toast.success('Conflict resolved');
      queryClient.invalidateQueries({ queryKey: ['leads'] });
      queryClient.invalidateQueries({ queryKey: ['sync-conflicts'] });
    },
    onError: (error) => {
      toast.error(`Failed to resolve conflict: ${error.message}`);
    },
  });
}
