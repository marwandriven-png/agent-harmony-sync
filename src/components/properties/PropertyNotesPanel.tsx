import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import { Send, User, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Skeleton } from '@/components/ui/skeleton';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import { formatDistanceToNow } from 'date-fns';

interface PropertyNotesPanelProps {
  propertyId: string;
}

interface PropertyNote {
  id: string;
  content: string;
  created_at: string;
  created_by: string | null;
  profile?: {
    full_name: string;
  };
}

export function PropertyNotesPanel({ propertyId }: PropertyNotesPanelProps) {
  const { user, profile } = useAuth();
  const queryClient = useQueryClient();
  const [newNote, setNewNote] = useState('');

  // Fetch notes
  const { data: notes = [], isLoading } = useQuery({
    queryKey: ['property-notes', propertyId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('property_notes')
        .select(`
          id,
          content,
          created_at,
          created_by
        `)
        .eq('property_id', propertyId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      
      // Fetch profiles for notes
      const userIds = [...new Set(data.filter(n => n.created_by).map(n => n.created_by))];
      let profileMap: Record<string, string> = {};
      
      if (userIds.length > 0) {
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, full_name')
          .in('id', userIds as string[]);
        
        profileMap = (profiles || []).reduce((acc, p) => {
          acc[p.id] = p.full_name;
          return acc;
        }, {} as Record<string, string>);
      }

      return data.map(note => ({
        ...note,
        profile: note.created_by ? { full_name: profileMap[note.created_by] || 'Unknown' } : undefined
      })) as PropertyNote[];
    },
    enabled: !!propertyId,
  });

  // Add note mutation
  const addNoteMutation = useMutation({
    mutationFn: async (content: string) => {
      const { data, error } = await supabase
        .from('property_notes')
        .insert({
          property_id: propertyId,
          content,
          created_by: user?.id,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['property-notes', propertyId] });
      setNewNote('');
      toast.success('Note added');
    },
    onError: (error) => {
      toast.error(`Failed to add note: ${error.message}`);
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (newNote.trim()) {
      addNoteMutation.mutate(newNote.trim());
    }
  };

  return (
    <div className="space-y-4">
      {/* Add Note Form */}
      <form onSubmit={handleSubmit} className="flex gap-2">
        <Textarea
          value={newNote}
          onChange={(e) => setNewNote(e.target.value)}
          placeholder="Add a note..."
          className="min-h-[60px] resize-none bg-muted/50 border-border/50"
        />
        <Button 
          type="submit" 
          size="icon"
          disabled={!newNote.trim() || addNoteMutation.isPending}
          className="shrink-0 h-auto aspect-square"
        >
          <Send className="w-4 h-4" />
        </Button>
      </form>

      {/* Notes List */}
      <div className="space-y-3 max-h-[200px] overflow-y-auto">
        {isLoading ? (
          <>
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-16 w-full" />
          </>
        ) : notes.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">
            No notes yet. Add one above.
          </p>
        ) : (
          <AnimatePresence mode="popLayout">
            {notes.map((note) => (
              <motion.div
                key={note.id}
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 10 }}
                className="p-3 bg-muted/30 rounded-lg"
              >
                <p className="text-sm text-foreground whitespace-pre-wrap">{note.content}</p>
                <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <User className="w-3 h-3" />
                    {note.profile?.full_name || profile?.full_name || 'You'}
                  </span>
                  <span className="flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {formatDistanceToNow(new Date(note.created_at), { addSuffix: true })}
                  </span>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        )}
      </div>
    </div>
  );
}
