import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { toast } from 'sonner';
import { useEffect } from 'react';
import type { Database } from '@/integrations/supabase/types';

type TaskRow = Database['public']['Tables']['tasks']['Row'];
type TaskInsert = Database['public']['Tables']['tasks']['Insert'];
type TaskUpdate = Database['public']['Tables']['tasks']['Update'];
type TaskStatus = Database['public']['Enums']['task_status'];

export interface TaskWithRelations extends TaskRow {
  profiles?: {
    id: string;
    full_name: string;
    email: string;
    avatar_url: string | null;
  } | null;
  leads?: {
    id: string;
    name: string;
    priority: Database['public']['Enums']['lead_priority'];
  } | null;
}

export function useTasks() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['tasks'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('tasks')
        .select(`
          *,
          profiles!tasks_assigned_to_fkey (
            id,
            full_name,
            email,
            avatar_url
          ),
          leads!tasks_lead_id_fkey (
            id,
            name,
            priority
          )
        `)
        .order('due_date', { ascending: true });

      if (error) throw error;
      return data as unknown as TaskWithRelations[];
    },
    enabled: !!user,
  });

  // Set up realtime subscription
  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel('tasks-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'tasks',
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ['tasks'] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, queryClient]);

  return query;
}

export function useTasksByLead(leadId: string) {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['tasks', 'lead', leadId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('tasks')
        .select(`
          *,
          profiles!tasks_assigned_to_fkey (
            id,
            full_name,
            email,
            avatar_url
          )
        `)
        .eq('lead_id', leadId)
        .order('due_date', { ascending: true });

      if (error) throw error;
      return data as unknown as TaskWithRelations[];
    },
    enabled: !!user && !!leadId,
  });
}

export function useUpcomingTasks(limit = 5) {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['tasks', 'upcoming', limit],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('tasks')
        .select(`
          *,
          leads!tasks_lead_id_fkey (
            id,
            name,
            priority
          )
        `)
        .neq('status', 'completed')
        .order('due_date', { ascending: true })
        .limit(limit);

      if (error) throw error;
      return data as unknown as TaskWithRelations[];
    },
    enabled: !!user,
  });
}

export function useCreateTask() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (task: Omit<TaskInsert, 'id' | 'created_at' | 'updated_at' | 'created_by'>) => {
      const { data, error } = await supabase
        .from('tasks')
        .insert({
          ...task,
          created_by: user?.id,
          assigned_to: task.assigned_to || user?.id,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      queryClient.invalidateQueries({ queryKey: ['tasks', 'lead', data.lead_id] });
      toast.success('Task created successfully');
    },
    onError: (error) => {
      toast.error(`Failed to create task: ${error.message}`);
    },
  });
}

export function useUpdateTask() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...updates }: TaskUpdate & { id: string }) => {
      const { data, error } = await supabase
        .from('tasks')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      queryClient.invalidateQueries({ queryKey: ['tasks', 'lead', data.lead_id] });
      toast.success('Task updated successfully');
    },
    onError: (error) => {
      toast.error(`Failed to update task: ${error.message}`);
    },
  });
}

export function useCompleteTask() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { data, error } = await supabase
        .from('tasks')
        .update({ 
          status: 'completed' as TaskStatus,
          completed_at: new Date().toISOString()
        })
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      queryClient.invalidateQueries({ queryKey: ['tasks', 'lead', data.lead_id] });
      toast.success('Task completed');
    },
    onError: (error) => {
      toast.error(`Failed to complete task: ${error.message}`);
    },
  });
}

export function useDeleteTask() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('tasks')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      toast.success('Task deleted successfully');
    },
    onError: (error) => {
      toast.error(`Failed to delete task: ${error.message}`);
    },
  });
}
