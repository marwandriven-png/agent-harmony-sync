import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { toast } from 'sonner';
import type { Database, Json } from '@/integrations/supabase/types';

type PlotRow = Database['public']['Tables']['plots']['Row'];
type PlotInsert = Database['public']['Tables']['plots']['Insert'];
type PlotUpdate = Database['public']['Tables']['plots']['Update'];

// Types
export interface Plot {
  id: string;
  plot_number: string;
  area_name: string;
  master_plan: string | null;
  plot_size: number;
  gfa: number | null;
  floors_allowed: number | null;
  zoning: string | null;
  status: string;
  pdf_source_link: string | null;
  notes: string | null;
  price: number | null;
  price_per_sqft: number | null;
  owner_name: string | null;
  owner_mobile: string | null;
  location_coordinates: Record<string, unknown> | null;
  google_sheet_row_id: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  // Computed fields from joins
  offers_count?: number;
  interested_count?: number;
}

export interface PlotOffer {
  id: string;
  plot_id: string;
  lead_id: string | null;
  buyer_name: string;
  mobile: string | null;
  email: string | null;
  offer_amount: number;
  offer_status: string;
  notes: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface PlotInterestedBuyer {
  id: string;
  plot_id: string;
  lead_id: string | null;
  buyer_name: string;
  mobile: string | null;
  email: string | null;
  viewed_at: string | null;
  source: string | null;
  notes: string | null;
  created_by: string | null;
  created_at: string;
}

export interface PlotFeasibility {
  id: string;
  plot_id: string;
  estimated_units: number | null;
  build_potential: string | null;
  roi_range: string | null;
  risk_notes: string[] | null;
  recommendation: string | null;
  market_comparison: Record<string, unknown> | null;
  created_at: string;
}

export interface PlotActivityLog {
  id: string;
  plot_id: string;
  action: string;
  old_values: Record<string, unknown> | null;
  new_values: Record<string, unknown> | null;
  user_id: string | null;
  source: string | null;
  timestamp: string;
}

// Fetch all plots
export function usePlots() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['plots'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('plots')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data as Plot[];
    },
    enabled: !!user,
  });
}

// Fetch single plot with details
export function usePlotDetails(plotId: string | undefined) {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['plot', plotId],
    queryFn: async () => {
      if (!plotId) return null;

      const { data, error } = await supabase
        .from('plots')
        .select('*')
        .eq('id', plotId)
        .single();

      if (error) throw error;
      return data as Plot;
    },
    enabled: !!user && !!plotId,
  });
}

// Fetch offers for a plot
export function usePlotOffers(plotId: string | undefined) {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['plot-offers', plotId],
    queryFn: async () => {
      if (!plotId) return [];

      const { data, error } = await supabase
        .from('plot_offers')
        .select('*')
        .eq('plot_id', plotId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data as PlotOffer[];
    },
    enabled: !!user && !!plotId,
  });
}

// Fetch interested buyers for a plot
export function usePlotInterestedBuyers(plotId: string | undefined) {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['plot-interested', plotId],
    queryFn: async () => {
      if (!plotId) return [];

      const { data, error } = await supabase
        .from('plot_interested_buyers')
        .select('*')
        .eq('plot_id', plotId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data as PlotInterestedBuyer[];
    },
    enabled: !!user && !!plotId,
  });
}

// Fetch feasibility reports for a plot
export function usePlotFeasibility(plotId: string | undefined) {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['plot-feasibility', plotId],
    queryFn: async () => {
      if (!plotId) return [];

      const { data, error } = await supabase
        .from('plot_feasibility')
        .select('*')
        .eq('plot_id', plotId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data as PlotFeasibility[];
    },
    enabled: !!user && !!plotId,
  });
}

// Fetch activity logs for a plot
export function usePlotActivityLogs(plotId: string | undefined) {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['plot-activity-logs', plotId],
    queryFn: async () => {
      if (!plotId) return [];

      const { data, error } = await supabase
        .from('plot_activity_logs')
        .select('*')
        .eq('plot_id', plotId)
        .order('timestamp', { ascending: false });

      if (error) throw error;
      return data as PlotActivityLog[];
    },
    enabled: !!user && !!plotId,
  });
}

// Create plot
export function useCreatePlot() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (plotData: PlotInsert) => {
      const insertData: PlotInsert = {
        ...plotData,
        created_by: user?.id,
      };

      const { data, error } = await supabase
        .from('plots')
        .insert(insertData)
        .select()
        .single();

      if (error) throw error;

      // Log activity
      await supabase.from('plot_activity_logs').insert({
        plot_id: data.id,
        action: 'PLOT_CREATED',
        new_values: data as unknown as Json,
        user_id: user?.id,
        source: 'crm',
      });

      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['plots'] });
      toast.success('Plot created successfully');
    },
    onError: (error) => {
      toast.error(`Failed to create plot: ${error.message}`);
    },
  });
}

// Update plot
export function useUpdatePlot() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async ({ id, ...updates }: PlotUpdate & { id: string }) => {
      // Get old values first
      const { data: oldData } = await supabase
        .from('plots')
        .select('*')
        .eq('id', id)
        .single();

      const { data, error } = await supabase
        .from('plots')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;

      // Log activity
      await supabase.from('plot_activity_logs').insert({
        plot_id: id,
        action: 'PLOT_UPDATED',
        old_values: oldData as unknown as Json,
        new_values: data as unknown as Json,
        user_id: user?.id,
        source: 'crm',
      });

      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['plots'] });
      queryClient.invalidateQueries({ queryKey: ['plot', data.id] });
      toast.success('Plot updated successfully');
    },
    onError: (error) => {
      toast.error(`Failed to update plot: ${error.message}`);
    },
  });
}

// Delete plot
export function useDeletePlot() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (plotId: string) => {
      const { error } = await supabase
        .from('plots')
        .delete()
        .eq('id', plotId);

      if (error) throw error;
      return plotId;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['plots'] });
      toast.success('Plot deleted successfully');
    },
    onError: (error) => {
      toast.error(`Failed to delete plot: ${error.message}`);
    },
  });
}

// Update plot status
export function useUpdatePlotStatus() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async ({ plotId, status }: { plotId: string; status: string }) => {
      // Get old status
      const { data: oldData } = await supabase
        .from('plots')
        .select('status')
        .eq('id', plotId)
        .single();

      const { data, error } = await supabase
        .from('plots')
        .update({ status })
        .eq('id', plotId)
        .select()
        .single();

      if (error) throw error;

      // Log activity
      await supabase.from('plot_activity_logs').insert({
        plot_id: plotId,
        action: 'STATUS_CHANGE',
        old_values: { status: oldData?.status },
        new_values: { status },
        user_id: user?.id,
        source: 'crm',
      });

      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['plots'] });
      queryClient.invalidateQueries({ queryKey: ['plot', data.id] });
      toast.success('Status updated');
    },
    onError: (error) => {
      toast.error(`Failed to update status: ${error.message}`);
    },
  });
}

// Add offer to plot
export function useAddPlotOffer() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (offerData: Omit<PlotOffer, 'id' | 'created_at' | 'updated_at' | 'created_by'>) => {
      const { data, error } = await supabase
        .from('plot_offers')
        .insert({
          ...offerData,
          created_by: user?.id,
        })
        .select()
        .single();

      if (error) throw error;

      // Log activity
      await supabase.from('plot_activity_logs').insert({
        plot_id: offerData.plot_id,
        action: 'OFFER_RECEIVED',
        new_values: { buyer: offerData.buyer_name, amount: offerData.offer_amount },
        user_id: user?.id,
        source: 'crm',
      });

      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['plot-offers', data.plot_id] });
      queryClient.invalidateQueries({ queryKey: ['plots'] });
      toast.success('Offer added successfully');
    },
    onError: (error) => {
      toast.error(`Failed to add offer: ${error.message}`);
    },
  });
}

// Add interested buyer
export function useAddInterestedBuyer() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (buyerData: Omit<PlotInterestedBuyer, 'id' | 'created_at' | 'created_by'>) => {
      const { data, error } = await supabase
        .from('plot_interested_buyers')
        .insert({
          ...buyerData,
          created_by: user?.id,
        })
        .select()
        .single();

      if (error) throw error;

      // Log activity
      await supabase.from('plot_activity_logs').insert({
        plot_id: buyerData.plot_id,
        action: 'BUYER_INTERESTED',
        new_values: { buyer: buyerData.buyer_name, source: buyerData.source },
        user_id: user?.id,
        source: 'crm',
      });

      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['plot-interested', data.plot_id] });
      queryClient.invalidateQueries({ queryKey: ['plots'] });
      toast.success('Interested buyer added');
    },
    onError: (error) => {
      toast.error(`Failed to add interested buyer: ${error.message}`);
    },
  });
}

// Run AI feasibility analysis
export function useRunFeasibility() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (plot: Plot) => {
      const { data, error } = await supabase.functions.invoke('plot-feasibility', {
        body: { plot },
      });

      if (error) throw error;
      if (!data.success) throw new Error(data.error || 'Feasibility analysis failed');

      return data.result as PlotFeasibility;
    },
    onSuccess: (_, plot) => {
      queryClient.invalidateQueries({ queryKey: ['plot-feasibility', plot.id] });
      queryClient.invalidateQueries({ queryKey: ['plot-activity-logs', plot.id] });
      toast.success('AI feasibility analysis complete');
    },
    onError: (error) => {
      toast.error(`Feasibility analysis failed: ${error.message}`);
    },
  });
}

// Link interested buyer to lead
export function useLinkBuyerToLead() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async ({ buyerId, leadId, plotId }: { buyerId: string; leadId: string; plotId: string }) => {
      const { data, error } = await supabase
        .from('plot_interested_buyers')
        .update({ lead_id: leadId })
        .eq('id', buyerId)
        .select()
        .single();

      if (error) throw error;

      // Log activity
      await supabase.from('plot_activity_logs').insert({
        plot_id: plotId,
        action: 'BUYER_LINKED_TO_LEAD',
        new_values: { buyer_id: buyerId, lead_id: leadId },
        user_id: user?.id,
        source: 'crm',
      });

      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['plot-interested', data.plot_id] });
      toast.success('Buyer linked to lead');
    },
    onError: (error) => {
      toast.error(`Failed to link buyer: ${error.message}`);
    },
  });
}
