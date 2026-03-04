import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { toast } from 'sonner';

export interface Project {
  id: string;
  name: string;
  description: string | null;
  location: string | null;
  status: string;
  budget: number;
  spent: number;
  start_date: string | null;
  end_date: string | null;
  completion_percentage: number;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  // Computed
  total_plots?: number;
  sold_plots?: number;
}

export function useProjects() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['projects'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('projects')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Get plot counts per project
      const { data: plots } = await supabase
        .from('plots')
        .select('id, project_id, status');

      const projectsWithCounts = (data as any[]).map((project: any) => {
        const projectPlots = (plots || []).filter((p: any) => p.project_id === project.id);
        return {
          ...project,
          total_plots: projectPlots.length,
          sold_plots: projectPlots.filter((p: any) => p.status === 'sold').length,
        } as Project;
      });

      return projectsWithCounts;
    },
    enabled: !!user,
  });
}

export function useCreateProject() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (projectData: Omit<Project, 'id' | 'created_at' | 'updated_at' | 'created_by' | 'total_plots' | 'sold_plots'>) => {
      const { data, error } = await supabase
        .from('projects')
        .insert({
          ...projectData,
          created_by: user?.id,
        } as any)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      toast.success('Project created successfully');
    },
    onError: (error) => {
      toast.error(`Failed to create project: ${error.message}`);
    },
  });
}

export function useUpdateProject() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...updates }: { id: string } & Partial<Project>) => {
      const { data, error } = await supabase
        .from('projects')
        .update(updates as any)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      toast.success('Project updated successfully');
    },
    onError: (error) => {
      toast.error(`Failed to update project: ${error.message}`);
    },
  });
}

export function useDeleteProject() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (projectId: string) => {
      const { error } = await supabase
        .from('projects')
        .delete()
        .eq('id', projectId);

      if (error) throw error;
      return projectId;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      toast.success('Project deleted successfully');
    },
    onError: (error) => {
      toast.error(`Failed to delete project: ${error.message}`);
    },
  });
}

export function useAssignPlotToProject() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ plotId, projectId }: { plotId: string; projectId: string | null }) => {
      const { data, error } = await supabase
        .from('plots')
        .update({ project_id: projectId } as any)
        .eq('id', plotId)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      queryClient.invalidateQueries({ queryKey: ['plots'] });
      toast.success('Plot assignment updated');
    },
    onError: (error) => {
      toast.error(`Failed to assign plot: ${error.message}`);
    },
  });
}
