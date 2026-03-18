import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { useCreateCall, useEvaluateCall } from '@/hooks/useCalls';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Loader2, Brain } from 'lucide-react';

interface LogCallDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function LogCallDialog({ open, onOpenChange }: LogCallDialogProps) {
  const createCall = useCreateCall();
  const evaluateCall = useEvaluateCall();
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    phone_number: '',
    direction: 'outbound' as 'inbound' | 'outbound',
    status: 'completed',
    duration_seconds: 0,
    notes: '',
    transcript_text: '',
  });

  const handleSubmit = async () => {
    if (!form.phone_number) return;
    setSaving(true);
    try {
      const callData = await createCall.mutateAsync(form);

      // Auto-generate transcript from notes if no transcript provided
      if (!form.transcript_text && form.notes && form.status === 'completed') {
        toast.info('Generating AI transcript from notes...');
        try {
          const { data: transcribeData, error: transcribeError } = await supabase.functions.invoke('call-transcribe', {
            body: {
              call_id: callData.id,
              notes: form.notes,
              direction: form.direction,
              duration_seconds: form.duration_seconds,
            },
          });
          if (transcribeError) {
            console.error('Transcription error:', transcribeError);
          } else if (transcribeData?.has_transcript) {
            toast.success('Transcript generated!');
          }
        } catch (err) {
          console.error('Transcription failed:', err);
        }
      }

      // Auto-run F-CVS evaluation if we have transcript text or notes were transcribed
      if (form.transcript_text || form.notes) {
        toast.info('Running F-CVS evaluation...');
        try {
          await evaluateCall.mutateAsync(callData.id);
        } catch (evalErr) {
          console.error('F-CVS evaluation error:', evalErr);
          // Don't block - evaluation can be retried manually
        }
      }

      onOpenChange(false);
      setForm({ phone_number: '', direction: 'outbound', status: 'completed', duration_seconds: 0, notes: '', transcript_text: '' });
    } catch (err) {
      console.error('Save call error:', err);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            Log a Call
            <span className="text-xs font-normal text-muted-foreground">(Auto F-CVS scoring)</span>
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label>Phone Number *</Label>
            <Input
              value={form.phone_number}
              onChange={(e) => setForm({ ...form, phone_number: e.target.value })}
              placeholder="+971..."
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Direction</Label>
              <Select value={form.direction} onValueChange={(v) => setForm({ ...form, direction: v as any })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="outbound">Outbound</SelectItem>
                  <SelectItem value="inbound">Inbound</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Status</Label>
              <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="completed">Completed</SelectItem>
                  <SelectItem value="answered">Answered</SelectItem>
                  <SelectItem value="missed">Missed</SelectItem>
                  <SelectItem value="busy">Busy</SelectItem>
                  <SelectItem value="failed">Failed</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div>
            <Label>Duration (seconds)</Label>
            <Input
              type="number"
              value={form.duration_seconds}
              onChange={(e) => setForm({ ...form, duration_seconds: parseInt(e.target.value) || 0 })}
            />
          </div>
          <div>
            <Label>Notes</Label>
            <Textarea
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              placeholder="Call summary... (will be auto-transcribed & scored)"
              rows={2}
            />
          </div>
          <div>
            <Label>Transcript (optional)</Label>
            <Textarea
              value={form.transcript_text}
              onChange={(e) => setForm({ ...form, transcript_text: e.target.value })}
              placeholder="Paste call transcript for AI F-CVS evaluation..."
              rows={3}
            />
          </div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground bg-muted/30 p-2.5 rounded-lg">
            <Brain className="h-4 w-4 text-purple-400 shrink-0" />
            <span>After saving, AI will auto-generate transcript (if notes provided) and run F-CVS valuation scoring.</span>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={saving || !form.phone_number}>
            {saving ? (
              <><Loader2 className="w-4 h-4 animate-spin mr-2" /> Processing...</>
            ) : (
              'Log & Score Call'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
