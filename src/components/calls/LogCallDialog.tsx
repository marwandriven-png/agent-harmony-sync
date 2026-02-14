import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { useCreateCall } from '@/hooks/useCalls';

interface LogCallDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function LogCallDialog({ open, onOpenChange }: LogCallDialogProps) {
  const createCall = useCreateCall();
  const [form, setForm] = useState({
    phone_number: '',
    direction: 'outbound' as 'inbound' | 'outbound',
    status: 'completed',
    duration_seconds: 0,
    notes: '',
    transcript_text: '',
  });

  const handleSubmit = () => {
    if (!form.phone_number) return;
    createCall.mutate(form, {
      onSuccess: () => {
        onOpenChange(false);
        setForm({ phone_number: '', direction: 'outbound', status: 'completed', duration_seconds: 0, notes: '', transcript_text: '' });
      },
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Log a Call</DialogTitle>
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
              placeholder="Call summary..."
              rows={2}
            />
          </div>
          <div>
            <Label>Transcript (optional)</Label>
            <Textarea
              value={form.transcript_text}
              onChange={(e) => setForm({ ...form, transcript_text: e.target.value })}
              placeholder="Paste call transcript for AI evaluation..."
              rows={3}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={createCall.isPending || !form.phone_number}>
            {createCall.isPending ? 'Saving...' : 'Log Call'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
