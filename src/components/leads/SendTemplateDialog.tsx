import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useTemplates, parseTemplateContent } from '@/hooks/useTemplates';
import { useCreateActivity } from '@/hooks/useActivities';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import {
  Send,
  MessageSquare,
  CheckCircle,
  Copy,
} from 'lucide-react';
import type { Database } from '@/integrations/supabase/types';

type LeadRow = Database['public']['Tables']['leads']['Row'];

interface SendTemplateDialogProps {
  lead: LeadRow;
  trigger?: React.ReactNode;
}

export function SendTemplateDialog({ lead, trigger }: SendTemplateDialogProps) {
  const [open, setOpen] = useState(false);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null);
  const { data: templates = [], isLoading } = useTemplates();
  const createActivity = useCreateActivity();

  const activeTemplates = templates.filter((t) => t.is_active);
  const selectedTemplate = activeTemplates.find((t) => t.id === selectedTemplateId);

  const parsedContent = selectedTemplate
    ? parseTemplateContent(selectedTemplate.content, lead)
    : '';

  const handleCopy = () => {
    if (parsedContent) {
      navigator.clipboard.writeText(parsedContent);
      toast.success('Message copied to clipboard');
    }
  };

  const handleSend = async () => {
    if (!selectedTemplate) return;

    await createActivity.mutateAsync({
      lead_id: lead.id,
      type: 'whatsapp',
      title: `Follow-up sent: ${selectedTemplate.title}`,
      description: parsedContent,
    });

    toast.success('Follow-up logged successfully');
    setOpen(false);
    setSelectedTemplateId(null);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button variant="outline" className="w-full justify-start">
            <Send className="w-4 h-4 mr-2" />
            Send Follow-up
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>Send Follow-up Message</DialogTitle>
          <DialogDescription>
            Select a template to send to {lead.name}. Variables will be replaced with lead data.
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-2 gap-4">
          {/* Template List */}
          <div className="space-y-2">
            <p className="text-sm font-medium text-foreground">Templates</p>
            <ScrollArea className="h-[300px] rounded-md border p-2">
              {isLoading ? (
                <p className="text-sm text-muted-foreground p-2">Loading...</p>
              ) : activeTemplates.length > 0 ? (
                <div className="space-y-2">
                  {activeTemplates.map((template) => (
                    <div
                      key={template.id}
                      onClick={() => setSelectedTemplateId(template.id)}
                      className={cn(
                        "p-3 rounded-lg border cursor-pointer transition-all",
                        selectedTemplateId === template.id
                          ? "border-primary bg-primary/5"
                          : "border-border hover:border-primary/50"
                      )}
                    >
                      <div className="flex items-center gap-2 mb-1">
                        <Badge variant="outline" className="text-xs">
                          Day {template.day}
                        </Badge>
                        {selectedTemplateId === template.id && (
                          <CheckCircle className="w-3 h-3 text-primary" />
                        )}
                      </div>
                      <p className="text-sm font-medium text-foreground">
                        {template.title}
                      </p>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center h-full text-center p-4">
                  <MessageSquare className="w-8 h-8 text-muted-foreground mb-2" />
                  <p className="text-sm text-muted-foreground">
                    No active templates
                  </p>
                </div>
              )}
            </ScrollArea>
          </div>

          {/* Preview */}
          <div className="space-y-2">
            <p className="text-sm font-medium text-foreground">Preview</p>
            <div className="h-[300px] rounded-md border bg-muted/30 p-4 overflow-auto">
              {selectedTemplate ? (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <Badge variant="secondary">{selectedTemplate.title}</Badge>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={handleCopy}
                    >
                      <Copy className="w-4 h-4" />
                    </Button>
                  </div>
                  <p className="text-sm text-foreground whitespace-pre-wrap">
                    {parsedContent}
                  </p>
                </div>
              ) : (
                <div className="flex items-center justify-center h-full">
                  <p className="text-sm text-muted-foreground">
                    Select a template to preview
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleSend}
            disabled={!selectedTemplate || createActivity.isPending}
          >
            {createActivity.isPending ? 'Logging...' : 'Log as Sent'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
