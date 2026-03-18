import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useUpdateLead } from '@/hooks/useLeads';
import { usePushToSheets } from '@/hooks/useSheetsSync';
import { useCreateActivity } from '@/hooks/useActivities';
import { Loader2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import type { Database } from '@/integrations/supabase/types';

type LeadRow = Database['public']['Tables']['leads']['Row'];

interface DeleteLeadDialogProps {
  lead: LeadRow | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function DeleteLeadDialog({ lead, open, onOpenChange }: DeleteLeadDialogProps) {
  const navigate = useNavigate();
  const updateLead = useUpdateLead();
  const pushToSheets = usePushToSheets();
  const createActivity = useCreateActivity();

  const handleDelete = async () => {
    if (!lead) return;

    try {
      // Soft delete - set status to 'lost' (closest to deleted in our schema)
      // In a production system, you'd add a 'deleted' status or is_deleted flag
      await updateLead.mutateAsync({
        id: lead.id,
        status: 'lost',
        // Add a tag to mark as deleted
        tags: [...(lead.tags || []), 'DELETED'],
      });

      // Log the deletion
      await createActivity.mutateAsync({
        lead_id: lead.id,
        type: 'status_change',
        title: 'Lead deleted',
        description: 'Lead was soft-deleted from the pipeline',
        metadata: { action: 'soft_delete', previous_status: lead.status },
      });

      // Push to Google Sheets
      pushToSheets.mutate({
        tableName: 'leads',
        record: { id: lead.id, status: 'lost', tags: [...(lead.tags || []), 'DELETED'] },
        recordId: lead.id,
      });

      onOpenChange(false);
      navigate('/leads');
    } catch (error) {
      // Error handled by mutation
    }
  };

  if (!lead) return null;

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete Lead</AlertDialogTitle>
          <AlertDialogDescription>
            Are you sure you want to delete <strong>{lead.name}</strong>?
            <br /><br />
            This will:
            <ul className="list-disc list-inside mt-2 space-y-1">
              <li>Remove the lead from the pipeline view</li>
              <li>Mark the lead as deleted in Google Sheets</li>
              <li>Preserve the audit log for compliance</li>
            </ul>
            <br />
            This action can be undone by an administrator.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={handleDelete}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            disabled={updateLead.isPending}
          >
            {updateLead.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            Delete Lead
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
