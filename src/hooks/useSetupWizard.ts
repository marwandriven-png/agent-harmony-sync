import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { toast } from 'sonner';
import type { Json } from '@/integrations/supabase/types';

export interface DataSource {
  id: string;
  name: string;
  type: 'google_sheets' | 'csv' | 'xlsx' | 'airtable' | 'notion';
  connection_url?: string;
  sheet_id?: string;
  table_name: string;
  column_mappings: Record<string, string>;
  last_synced_at?: string;
  sync_status: 'pending' | 'syncing' | 'success' | 'error';
  sync_error?: string;
  created_by?: string;
  created_at: string;
  updated_at: string;
}

export interface ApiIntegration {
  id: string;
  name: string;
  type: 'google_calendar' | 'google_sheets' | 'google_drive' | 'whatsapp' | 'openai';
  is_connected: boolean;
  config: Record<string, unknown>;
  last_tested_at?: string;
  created_by?: string;
  created_at: string;
  updated_at: string;
}

export interface WizardProgress {
  id: string;
  user_id: string;
  current_step: number;
  completed_steps: number[];
  is_complete: boolean;
  created_at: string;
  updated_at: string;
}

export function useWizardProgress() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['wizard-progress'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('setup_wizard_progress')
        .select('*')
        .eq('user_id', user?.id)
        .maybeSingle();

      if (error) throw error;
      return data as WizardProgress | null;
    },
    enabled: !!user,
  });

  const createProgress = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase
        .from('setup_wizard_progress')
        .insert({ user_id: user?.id })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['wizard-progress'] });
    },
  });

  const updateProgress = useMutation({
    mutationFn: async (updates: Partial<WizardProgress>) => {
      const { data, error } = await supabase
        .from('setup_wizard_progress')
        .update(updates)
        .eq('user_id', user?.id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['wizard-progress'] });
    },
  });

  return {
    progress: query.data,
    isLoading: query.isLoading,
    createProgress,
    updateProgress,
  };
}

export function useDataSources() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['data-sources'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('data_sources')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data as DataSource[];
    },
    enabled: !!user,
  });

  const createDataSource = useMutation({
    mutationFn: async (source: Omit<DataSource, 'id' | 'created_at' | 'updated_at' | 'created_by'>) => {
      const { data, error } = await supabase
        .from('data_sources')
        .insert({ ...source, created_by: user?.id })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['data-sources'] });
      toast.success('Data source connected successfully');
    },
    onError: (error) => {
      toast.error(`Failed to connect data source: ${error.message}`);
    },
  });

  const updateDataSource = useMutation({
    mutationFn: async ({ id, ...updates }: Partial<DataSource> & { id: string }) => {
      const { data, error } = await supabase
        .from('data_sources')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['data-sources'] });
    },
  });

  const deleteDataSource = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('data_sources')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['data-sources'] });
      toast.success('Data source removed');
    },
  });

  return {
    dataSources: query.data ?? [],
    isLoading: query.isLoading,
    createDataSource,
    updateDataSource,
    deleteDataSource,
  };
}

export function useApiIntegrations() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['api-integrations'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('api_integrations')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data as ApiIntegration[];
    },
    enabled: !!user,
  });

  const upsertIntegration = useMutation({
    mutationFn: async (integration: Omit<ApiIntegration, 'id' | 'created_at' | 'updated_at' | 'created_by'>) => {
      // Check if integration already exists for this user and type
      const { data: existing } = await supabase
        .from('api_integrations')
        .select('id')
        .eq('type', integration.type)
        .eq('created_by', user?.id ?? '')
        .maybeSingle();

      if (existing) {
        // Update existing
        const { data, error } = await supabase
          .from('api_integrations')
          .update({
            name: integration.name,
            is_connected: integration.is_connected,
            config: integration.config as Json,
            last_tested_at: integration.last_tested_at,
          })
          .eq('id', existing.id)
          .select()
          .single();

        if (error) throw error;
        return data;
      } else {
        // Insert new
        const { data, error } = await supabase
          .from('api_integrations')
          .insert([{
            name: integration.name,
            type: integration.type,
            is_connected: integration.is_connected,
            config: integration.config as Json,
            last_tested_at: integration.last_tested_at,
            created_by: user?.id,
          }])
          .select()
          .single();

        if (error) throw error;
        return data;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['api-integrations'] });
    },
  });

  const testConnection = useMutation({
    mutationFn: async (type: ApiIntegration['type']) => {
      const { data, error } = await supabase.functions.invoke('test-integration', {
        body: { type },
      });

      if (error) throw error;
      return data;
    },
    onSuccess: (_, type) => {
      queryClient.invalidateQueries({ queryKey: ['api-integrations'] });
      toast.success(`${type} connection verified`);
    },
    onError: (error, type) => {
      toast.error(`${type} connection failed: ${error.message}`);
    },
  });

  return {
    integrations: query.data ?? [],
    isLoading: query.isLoading,
    upsertIntegration,
    testConnection,
  };
}

// Column mapping helpers
export const CRM_FIELDS = {
  leads: [
    { key: 'name', label: 'Name', required: true },
    { key: 'email', label: 'Email', required: false },
    { key: 'phone', label: 'Phone', required: true },
    { key: 'status', label: 'Status', required: false },
    { key: 'priority', label: 'Priority', required: false },
    { key: 'source', label: 'Source', required: false },
    { key: 'budget_min', label: 'Budget Min', required: false },
    { key: 'budget_max', label: 'Budget Max', required: false },
    { key: 'bedrooms', label: 'Bedrooms', required: false },
    { key: 'locations', label: 'Locations', required: false },
    { key: 'property_types', label: 'Property Types', required: false },
    { key: 'requirements_notes', label: 'Notes', required: false },
  ],
  cold_calls: [
    { key: 'name', label: 'Name', required: true },
    { key: 'phone', label: 'Phone', required: true },
    { key: 'email', label: 'Email', required: false },
    { key: 'source', label: 'Source', required: false },
    { key: 'budget', label: 'Budget', required: false },
    { key: 'bedrooms', label: 'Bedrooms', required: false },
    { key: 'location', label: 'Location', required: false },
    { key: 'notes', label: 'Notes', required: false },
  ],
  properties: [
    // Google Sheets aligned columns
    { key: 'regis', label: 'Regis', required: false },
    { key: 'procedure_value', label: 'ProcedureValue', required: false },
    { key: 'master_project', label: 'Master Project', required: false },
    { key: 'building_name', label: 'BuildingNameEn', required: true },
    { key: 'size', label: 'Size', required: true },
    { key: 'unit_number', label: 'UnitNumber', required: false },
    { key: 'type', label: 'PropertyTypeEn', required: true },
    { key: 'party_type', label: 'ProcedurePartyTypeNameEn', required: false },
    { key: 'owner_name', label: 'NameEn', required: false },
    { key: 'owner_mobile', label: 'Mobile', required: false },
    { key: 'procedure_name', label: 'ProcedureNameEn', required: false },
    { key: 'country', label: 'CountryNameEn', required: false },
    { key: 'status', label: 'Status', required: false },
    // Additional CRM fields
    { key: 'location', label: 'Location', required: true },
    { key: 'bedrooms', label: 'Bedrooms', required: false },
    { key: 'bathrooms', label: 'Bathrooms', required: false },
    { key: 'description', label: 'Description', required: false },
    { key: 'features', label: 'Features', required: false },
  ],
} as const;

export type TableName = keyof typeof CRM_FIELDS;
