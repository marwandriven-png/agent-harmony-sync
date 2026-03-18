import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { toast } from 'sonner';
import type { Database } from '@/integrations/supabase/types';

type TemplateRow = Database['public']['Tables']['follow_up_templates']['Row'];
type TemplateInsert = Database['public']['Tables']['follow_up_templates']['Insert'];
type TemplateUpdate = Database['public']['Tables']['follow_up_templates']['Update'];

export function useTemplates() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['templates'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('follow_up_templates')
        .select('*')
        .order('day', { ascending: true });

      if (error) throw error;
      return data as TemplateRow[];
    },
    enabled: !!user,
  });
}

export function useCreateTemplate() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (template: Omit<TemplateInsert, 'id' | 'created_at' | 'updated_at' | 'created_by'>) => {
      const { data, error } = await supabase
        .from('follow_up_templates')
        .insert({
          ...template,
          created_by: user?.id,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['templates'] });
      toast.success('Template created successfully');
    },
    onError: (error) => {
      toast.error(`Failed to create template: ${error.message}`);
    },
  });
}

export function useUpdateTemplate() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...updates }: TemplateUpdate & { id: string }) => {
      const { data, error } = await supabase
        .from('follow_up_templates')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['templates'] });
      toast.success('Template updated successfully');
    },
    onError: (error) => {
      toast.error(`Failed to update template: ${error.message}`);
    },
  });
}

export function useDeleteTemplate() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('follow_up_templates')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['templates'] });
      toast.success('Template deleted successfully');
    },
    onError: (error) => {
      toast.error(`Failed to delete template: ${error.message}`);
    },
  });
}

// Helper to replace template variables with lead data
export function parseTemplateContent(
  content: string,
  lead: {
    name: string;
    bedrooms?: number | null;
    locations?: string[] | null;
    budget_min?: number | null;
    budget_max?: number | null;
    budget_currency?: string | null;
  }
): string {
  const budgetMin = lead.budget_min || 0;
  const budgetMax = lead.budget_max || 0;
  const currency = lead.budget_currency || 'AED';
  const budget = `${currency} ${budgetMin.toLocaleString()} - ${budgetMax.toLocaleString()}`;
  const locations = lead.locations?.join(', ') || 'your preferred areas';
  const bedrooms = lead.bedrooms?.toString() || 'N/A';

  return content
    .replace(/\{\{name\}\}/g, lead.name)
    .replace(/\{\{bedrooms\}\}/g, bedrooms)
    .replace(/\{\{locations\}\}/g, locations)
    .replace(/\{\{budget\}\}/g, budget);
}
