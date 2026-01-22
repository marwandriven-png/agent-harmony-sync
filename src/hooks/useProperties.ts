import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { toast } from 'sonner';
import { useEffect } from 'react';
import type { Database } from '@/integrations/supabase/types';

type PropertyRow = Database['public']['Tables']['properties']['Row'];
type PropertyInsert = Database['public']['Tables']['properties']['Insert'];
type PropertyUpdate = Database['public']['Tables']['properties']['Update'];

export type PropertyWithProfile = PropertyRow;

export function useProperties() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['properties'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('properties')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data as PropertyRow[];
    },
    enabled: !!user,
  });

  // Set up realtime subscription
  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel('properties-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'properties',
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ['properties'] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, queryClient]);

  return query;
}

export function usePropertyById(id: string) {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['properties', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('properties')
        .select('*')
        .eq('id', id)
        .single();

      if (error) throw error;
      return data as PropertyRow;
    },
    enabled: !!user && !!id,
  });
}

export function useCreateProperty() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (property: Omit<PropertyInsert, 'id' | 'created_at' | 'updated_at' | 'created_by'>) => {
      const { data, error } = await supabase
        .from('properties')
        .insert({
          ...property,
          created_by: user?.id,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['properties'] });
      toast.success('Property created successfully');
    },
    onError: (error) => {
      toast.error(`Failed to create property: ${error.message}`);
    },
  });
}

export function useUpdateProperty() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async ({ id, ...updates }: PropertyUpdate & { id: string }) => {
      // First get the current property for activity logging
      const { data: oldData } = await supabase
        .from('properties')
        .select('*')
        .eq('id', id)
        .single();

      const { data, error } = await supabase
        .from('properties')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;

      // Log the activity with field-level changes
      if (oldData) {
        const changedFields: string[] = [];
        for (const [key, newValue] of Object.entries(updates)) {
          if (oldData[key as keyof typeof oldData] !== newValue) {
            changedFields.push(key);
          }
        }

        if (changedFields.length > 0) {
          await supabase.from('activity_logs').insert({
            table_name: 'properties',
            record_id: id,
            action: 'UPDATE',
            old_values: oldData,
            new_values: data,
            user_id: user?.id,
            source: 'crm',
          });
        }
      }

      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['properties'] });
      queryClient.invalidateQueries({ queryKey: ['properties', data.id] });
      toast.success('Property updated successfully');
    },
    onError: (error) => {
      toast.error(`Failed to update property: ${error.message}`);
    },
  });
}

export function useDeleteProperty() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('properties')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['properties'] });
      toast.success('Property deleted successfully');
    },
    onError: (error) => {
      toast.error(`Failed to delete property: ${error.message}`);
    },
  });
}

export function usePropertyMetrics() {
  const { data: properties = [] } = useProperties();

  const totalProperties = properties.length;
  const availableCount = properties.filter((p) => p.status === 'available').length;
  const soldReservedCount = properties.filter((p) => p.status === 'sold' || p.status === 'rented').length;

  return {
    totalProperties,
    availableCount,
    highDemand: 0,
    withMatches: 0,
    soldReservedCount,
  };
}
