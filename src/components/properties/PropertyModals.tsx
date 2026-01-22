import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import { Save } from 'lucide-react';
import type { Database } from '@/integrations/supabase/types';

type PropertyStatus = Database['public']['Enums']['property_status'];

interface StatusOption {
  value: PropertyStatus;
  label: string;
  icon: string;
  colorClass: string;
}

const STATUS_OPTIONS: StatusOption[] = [
  { value: 'available', label: 'Available', icon: '✓', colorClass: 'bg-success text-success-foreground' },
  { value: 'under_offer', label: 'Under Offer', icon: '⏰', colorClass: 'bg-warning text-warning-foreground' },
  { value: 'sold', label: 'Sold', icon: '✓', colorClass: 'bg-accent text-accent-foreground' },
  { value: 'rented', label: 'Rented', icon: '🏠', colorClass: 'bg-primary text-primary-foreground' },
];

const ACTIVITY_TYPES = ['Call', 'Meeting', 'Viewing', 'Follow-up'] as const;

interface StatusModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelect: (status: PropertyStatus) => void;
}

export function StatusModal({ open, onOpenChange, onSelect }: StatusModalProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-gradient">Change Status</DialogTitle>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-3 py-4">
          {STATUS_OPTIONS.map((status) => (
            <Button
              key={status.value}
              onClick={() => {
                onSelect(status.value);
                onOpenChange(false);
              }}
              className={cn(
                status.colorClass,
                'hover:opacity-90 transition-all hover:scale-105'
              )}
            >
              <span className="mr-2">{status.icon}</span>
              {status.label}
            </Button>
          ))}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

interface NoteModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (note: string) => void;
}

export function NoteModal({ open, onOpenChange, onSave }: NoteModalProps) {
  const [noteText, setNoteText] = useState('');

  const handleSave = () => {
    if (noteText.trim()) {
      onSave(noteText);
      setNoteText('');
      onOpenChange(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-gradient">Add Note</DialogTitle>
        </DialogHeader>
        <Textarea
          value={noteText}
          onChange={(e) => setNoteText(e.target.value)}
          className="min-h-32"
          placeholder="Enter your note..."
        />
        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={!noteText.trim()}>
            <Save className="w-4 h-4 mr-2" />
            Save Note
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

interface ActivityModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelect: (activityType: string) => void;
}

export function ActivityModal({ open, onOpenChange, onSelect }: ActivityModalProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-gradient">Add Activity</DialogTitle>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-3 py-4">
          {ACTIVITY_TYPES.map((activity) => (
            <Button
              key={activity}
              variant="secondary"
              onClick={() => {
                onSelect(activity);
                onOpenChange(false);
              }}
              className="hover:scale-105 transition-all"
            >
              {activity}
            </Button>
          ))}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

interface AttachModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function AttachModal({ open, onOpenChange }: AttachModalProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-gradient">Attach Documents</DialogTitle>
        </DialogHeader>
        <div className="py-4">
          <div className="border-2 border-dashed border-border rounded-lg p-8 text-center">
            <p className="text-muted-foreground">
              Drag and drop files here or click to browse
            </p>
            <p className="text-xs text-muted-foreground mt-2">
              Supports: PDF, DOC, DOCX, JPG, PNG
            </p>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
