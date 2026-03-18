import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useCreateTask } from '@/hooks/useTasks';
import { useUpdateLead } from '@/hooks/useLeads';
import { supabase } from '@/integrations/supabase/client';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Loader2, Calendar, Bell, MapPin } from 'lucide-react';
import { toast } from 'sonner';

const viewingSchema = z.object({
  viewing_date: z.string().min(1, 'Viewing date is required'),
  location: z.string().min(1, 'Location is required'),
  notes: z.string().max(500).optional(),
  add_to_google_calendar: z.boolean().default(true),
  reminder_minutes: z.number().min(5).max(1440).default(30),
});

type ViewingFormData = z.infer<typeof viewingSchema>;

interface ScheduleViewingDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  leadId: string;
  leadName: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ScheduleViewingDialog({
  open,
  onOpenChange,
  leadId,
  leadName,
  onConfirm,
  onCancel,
}: ScheduleViewingDialogProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const createTask = useCreateTask();
  const updateLead = useUpdateLead();

  const form = useForm<ViewingFormData>({
    resolver: zodResolver(viewingSchema),
    defaultValues: {
      viewing_date: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().slice(0, 16),
      location: '',
      notes: '',
      add_to_google_calendar: true,
      reminder_minutes: 30,
    },
  });

  const onSubmit = async (data: ViewingFormData) => {
    setIsSubmitting(true);
    try {
      const viewingDate = new Date(data.viewing_date);
      
      // Create task for the viewing
      const taskResult = await createTask.mutateAsync({
        title: `Viewing with ${leadName}`,
        description: data.notes || `Property viewing at ${data.location}`,
        lead_id: leadId,
        type: 'viewing',
        due_date: viewingDate.toISOString(),
      });

      // Update lead with next follow up
      await updateLead.mutateAsync({
        id: leadId,
        next_follow_up: viewingDate.toISOString(),
      });

      // Add to Google Calendar if enabled
      if (data.add_to_google_calendar) {
        try {
          const { data: calendarResult, error } = await supabase.functions.invoke('google-calendar', {
            body: {
              action: 'create_event',
              event: {
                summary: `Viewing: ${leadName}`,
                description: data.notes || `Property viewing scheduled`,
                location: data.location,
                start: viewingDate.toISOString(),
                end: new Date(viewingDate.getTime() + 60 * 60 * 1000).toISOString(), // 1 hour duration
                reminder_minutes: data.reminder_minutes,
              },
              task_id: taskResult.id,
            },
          });

          if (error) {
            console.error('Calendar error:', error);
            toast.warning('Task created but Google Calendar sync failed. You can sync later.');
          } else if (calendarResult?.success) {
            toast.success('Viewing scheduled and added to Google Calendar with reminder!');
          }
        } catch (calendarError) {
          console.error('Calendar integration error:', calendarError);
          toast.warning('Task created but Google Calendar sync failed.');
        }
      } else {
        toast.success('Viewing scheduled successfully!');
      }

      onConfirm();
      onOpenChange(false);
      form.reset();
    } catch (error) {
      console.error('Failed to schedule viewing:', error);
      toast.error('Failed to schedule viewing');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCancel = () => {
    onCancel();
    onOpenChange(false);
    form.reset();
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => {
      if (!isOpen) handleCancel();
      else onOpenChange(isOpen);
    }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Calendar className="w-5 h-5 text-primary" />
            Schedule Viewing
          </DialogTitle>
          <DialogDescription>
            Set the viewing date and time for <strong>{leadName}</strong>. This will create a task and optionally sync to Google Calendar.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="viewing_date"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="flex items-center gap-2">
                    <Calendar className="w-4 h-4" />
                    Viewing Date & Time *
                  </FormLabel>
                  <FormControl>
                    <Input type="datetime-local" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="location"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="flex items-center gap-2">
                    <MapPin className="w-4 h-4" />
                    Location *
                  </FormLabel>
                  <FormControl>
                    <Input placeholder="Property address or meeting point" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Notes</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Additional details about the viewing..."
                      className="resize-none"
                      rows={3}
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="border border-border rounded-lg p-4 space-y-4 bg-muted/30">
              <FormField
                control={form.control}
                name="add_to_google_calendar"
                render={({ field }) => (
                  <FormItem className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <FormLabel className="flex items-center gap-2">
                        <Calendar className="w-4 h-4 text-primary" />
                        Add to Google Calendar
                      </FormLabel>
                      <p className="text-xs text-muted-foreground">
                        Sync this viewing to your calendar
                      </p>
                    </div>
                    <FormControl>
                      <Switch
                        checked={field.value}
                        onCheckedChange={field.onChange}
                      />
                    </FormControl>
                  </FormItem>
                )}
              />

              {form.watch('add_to_google_calendar') && (
                <FormField
                  control={form.control}
                  name="reminder_minutes"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="flex items-center gap-2">
                        <Bell className="w-4 h-4 text-primary" />
                        Reminder
                      </FormLabel>
                      <FormControl>
                        <select
                          className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                          value={field.value}
                          onChange={(e) => field.onChange(Number(e.target.value))}
                        >
                          <option value={5}>5 minutes before</option>
                          <option value={15}>15 minutes before</option>
                          <option value={30}>30 minutes before</option>
                          <option value={60}>1 hour before</option>
                          <option value={120}>2 hours before</option>
                          <option value={1440}>1 day before</option>
                        </select>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}
            </div>

            <div className="flex justify-end gap-2 pt-4">
              <Button type="button" variant="outline" onClick={handleCancel}>
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmitting} className="bg-gradient-primary">
                {isSubmitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                Schedule Viewing
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
