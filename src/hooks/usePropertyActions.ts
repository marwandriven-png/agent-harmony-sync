import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { toast } from 'sonner';
import type { Database } from '@/integrations/supabase/types';

type PropertyStatus = Database['public']['Enums']['property_status'];
type PropertyRow = Database['public']['Tables']['properties']['Row'];

// Types for property actions
interface PropertyNote {
  property_id: string;
  note: string;
}

interface PropertyActivity {
  property_id: string;
  activity_type: 'call' | 'meeting' | 'viewing' | 'follow_up' | 'note';
  description?: string;
}

interface StatusDragAction {
  property_id: string;
  status_key: string;
  status_label: string;
}

/**
 * Hook for property status updates with DB persistence + Google Sheets sync
 */
export function usePropertyStatusUpdate() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ 
      propertyId, 
      newStatus, 
      oldStatus 
    }: { 
      propertyId: string; 
      newStatus: PropertyStatus; 
      oldStatus: PropertyStatus;
    }) => {
      // 1. Update property in DB
      const { data, error } = await supabase
        .from('properties')
        .update({ status: newStatus })
        .eq('id', propertyId)
        .select()
        .single();

      if (error) throw error;

      // 2. Log activity
      await supabase.from('activity_logs').insert({
        table_name: 'properties',
        record_id: propertyId,
        action: 'STATUS_CHANGE',
        old_values: { status: oldStatus },
        new_values: { status: newStatus },
        user_id: user?.id,
        source: 'ui_icon',
      });

      // 3. Trigger sync to Google Sheets (if linked)
      if (data.google_sheet_row_id) {
        await supabase.from('sync_logs').insert({
          table_name: 'properties',
          record_id: propertyId,
          operation: 'push',
          source: 'crm',
          status: 'queued',
          new_data: { status: newStatus },
        });
      }

      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['properties'] });
      queryClient.invalidateQueries({ queryKey: ['properties', data.id] });
      toast.success(`Status updated to "${data.status?.replace('_', ' ')}"`);
    },
    onError: (error) => {
      toast.error(`Failed to update status: ${error.message}`);
    },
  });
}

/**
 * Hook for adding notes to properties with DB persistence
 */
export function usePropertyNote() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ property_id, note }: PropertyNote) => {
      // Get current property for old description
      const { data: property } = await supabase
        .from('properties')
        .select('description')
        .eq('id', property_id)
        .single();

      // Append note to description (or create new)
      const currentDesc = property?.description || '';
      const timestamp = new Date().toLocaleString();
      const newDesc = currentDesc 
        ? `${currentDesc}\n\n[${timestamp}] ${note}`
        : `[${timestamp}] ${note}`;

      // Update property with new note
      const { data, error } = await supabase
        .from('properties')
        .update({ description: newDesc })
        .eq('id', property_id)
        .select()
        .single();

      if (error) throw error;

      // Log activity
      await supabase.from('activity_logs').insert({
        table_name: 'properties',
        record_id: property_id,
        action: 'NOTE_ADDED',
        old_values: { description: currentDesc },
        new_values: { description: newDesc, note_text: note },
        user_id: user?.id,
        source: 'ui_icon',
      });

      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['properties'] });
      queryClient.invalidateQueries({ queryKey: ['properties', data.id] });
      toast.success('Note added successfully');
    },
    onError: (error) => {
      toast.error(`Failed to add note: ${error.message}`);
    },
  });
}

/**
 * Hook for adding activities to properties with DB persistence
 */
export function usePropertyActivity() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ property_id, activity_type, description }: PropertyActivity) => {
      // Log activity
      const { error } = await supabase.from('activity_logs').insert({
        table_name: 'properties',
        record_id: property_id,
        action: `ACTIVITY_${activity_type.toUpperCase()}`,
        new_values: { activity_type, description, scheduled_at: new Date().toISOString() },
        user_id: user?.id,
        source: 'ui_icon',
      });

      if (error) throw error;

      return { success: true, activity_type };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['properties'] });
      toast.success(`${data.activity_type.replace('_', ' ')} activity added`);
    },
    onError: (error) => {
      toast.error(`Failed to add activity: ${error.message}`);
    },
  });
}

/**
 * Hook for converting property to active listing
 */
export function useConvertToListing() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (propertyId: string) => {
      // Get current property
      const { data: property } = await supabase
        .from('properties')
        .select('*')
        .eq('id', propertyId)
        .single();

      if (!property) throw new Error('Property not found');

      const oldStatus = property.status;

      // Update to available status
      const { data, error } = await supabase
        .from('properties')
        .update({ status: 'available' })
        .eq('id', propertyId)
        .select()
        .single();

      if (error) throw error;

      // Log activity
      await supabase.from('activity_logs').insert({
        table_name: 'properties',
        record_id: propertyId,
        action: 'CONVERT_TO_LISTING',
        old_values: { status: oldStatus },
        new_values: { status: 'available' },
        user_id: user?.id,
        source: 'ui_icon',
      });

      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['properties'] });
      queryClient.invalidateQueries({ queryKey: ['properties', data.id] });
      toast.success('Converted to active listing');
    },
    onError: (error) => {
      toast.error(`Failed to convert: ${error.message}`);
    },
  });
}

/**
 * Hook for archiving property (soft delete)
 */
export function useArchiveProperty() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (propertyId: string) => {
      // Get current property
      const { data: property } = await supabase
        .from('properties')
        .select('*')
        .eq('id', propertyId)
        .single();

      if (!property) throw new Error('Property not found');

      // Log activity before delete
      await supabase.from('activity_logs').insert({
        table_name: 'properties',
        record_id: propertyId,
        action: 'ARCHIVED',
        old_values: property,
        user_id: user?.id,
        source: 'ui_icon',
      });

      // If has google_sheet_row_id, update status to "Archived" instead of deleting
      if (property.google_sheet_row_id) {
        const { data, error } = await supabase
          .from('properties')
          .update({ status: 'sold' as PropertyStatus }) // Use 'sold' as archived state
          .eq('id', propertyId)
          .select()
          .single();

        if (error) throw error;

        // Queue sync to update Google Sheets
        await supabase.from('sync_logs').insert({
          table_name: 'properties',
          record_id: propertyId,
          operation: 'push',
          source: 'crm',
          status: 'queued',
          new_data: { status: 'Archived' },
        });

        return { archived: true, deleted: false, data };
      } else {
        // No sheet link - actually delete
        const { error } = await supabase
          .from('properties')
          .delete()
          .eq('id', propertyId);

        if (error) throw error;

        return { archived: false, deleted: true };
      }
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['properties'] });
      if (result.deleted) {
        toast.success('Property deleted successfully');
      } else {
        toast.success('Property archived successfully');
      }
    },
    onError: (error) => {
      toast.error(`Failed to archive: ${error.message}`);
    },
  });
}

/**
 * Hook for handling drag-drop status icon actions
 */
export function useDragStatusAction() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ property_id, status_key, status_label }: StatusDragAction) => {
      // Get current property
      const { data: property } = await supabase
        .from('properties')
        .select('*')
        .eq('id', property_id)
        .single();

      if (!property) throw new Error('Property not found');

      // Map drag status to actual status or add as tag/note
      // These are quick status indicators - map to real statuses or add as metadata
      let statusUpdate: Partial<PropertyRow> = {};
      
      switch (status_key) {
        case 'not-answering':
        case 'not-working':
        case 'busy':
          // Add as a note/tag rather than changing status
          const currentDesc = property.description || '';
          const timestamp = new Date().toLocaleString();
          statusUpdate = {
            description: currentDesc 
              ? `${currentDesc}\n\n[${timestamp}] Status Flag: ${status_label}`
              : `[${timestamp}] Status Flag: ${status_label}`,
          };
          break;
        case 'red-flag':
          // Add red flag as note
          const redFlagDesc = property.description || '';
          statusUpdate = {
            description: redFlagDesc 
              ? `${redFlagDesc}\n\n[${new Date().toLocaleString()}] 🚩 RED FLAG`
              : `[${new Date().toLocaleString()}] 🚩 RED FLAG`,
          };
          break;
        case 'new-listing':
          // Set to available
          statusUpdate = { status: 'available' as PropertyStatus };
          break;
        default:
          break;
      }

      // Update property
      const { data, error } = await supabase
        .from('properties')
        .update(statusUpdate)
        .eq('id', property_id)
        .select()
        .single();

      if (error) throw error;

      // Log activity
      await supabase.from('activity_logs').insert({
        table_name: 'properties',
        record_id: property_id,
        action: `DRAG_STATUS_${status_key.toUpperCase().replace('-', '_')}`,
        old_values: { status: property.status, description: property.description },
        new_values: statusUpdate,
        user_id: user?.id,
        source: 'drag_icon',
      });

      return { data, status_label };
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['properties'] });
      toast.success(`Applied "${result.status_label}" to property`);
    },
    onError: (error) => {
      toast.error(`Failed to apply status: ${error.message}`);
    },
  });
}

/**
 * Hook for fetching property activity logs
 */
export function usePropertyActivityLogs(propertyId: string | null) {
  const { user } = useAuth();

  return {
    queryKey: ['property-activity-logs', propertyId],
    queryFn: async () => {
      if (!propertyId) return [];

      const { data, error } = await supabase
        .from('activity_logs')
        .select('*')
        .eq('table_name', 'properties')
        .eq('record_id', propertyId)
        .order('created_at', { ascending: false })
        .limit(20);

      if (error) throw error;
      return data;
    },
    enabled: !!user && !!propertyId,
  };
}
