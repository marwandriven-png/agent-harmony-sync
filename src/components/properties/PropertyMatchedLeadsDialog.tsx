import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Users, Plus, Link as LinkIcon, Loader2 } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { useLeads } from '@/hooks/useLeads';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import { formatCurrency } from '@/lib/formatters';
import type { Database } from '@/integrations/supabase/types';

type PropertyRow = Database['public']['Tables']['properties']['Row'];
type LeadRow = Database['public']['Tables']['leads']['Row'];

interface PropertyMatchedLeadsDialogProps {
  property: PropertyRow | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

// Fetch matched leads for a property
function usePropertyMatchedLeads(propertyId: string | undefined) {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['property-matched-leads', propertyId],
    queryFn: async () => {
      if (!propertyId) return [];

      const { data, error } = await supabase
        .from('property_matches')
        .select(`
          *,
          lead:leads(*)
        `)
        .eq('property_id', propertyId)
        .order('match_score', { ascending: false });

      if (error) throw error;
      return data || [];
    },
    enabled: !!user && !!propertyId,
  });
}

export function PropertyMatchedLeadsDialog({
  property,
  open,
  onOpenChange,
}: PropertyMatchedLeadsDialogProps) {
  const [showLinkForm, setShowLinkForm] = useState(false);
  const [selectedLeadId, setSelectedLeadId] = useState<string>('');
  const [isLinking, setIsLinking] = useState(false);

  const { data: matchedLeads = [], refetch } = usePropertyMatchedLeads(property?.id);
  const { data: allLeads = [] } = useLeads();
  const { user } = useAuth();

  // Filter out leads that are already linked
  const linkedLeadIds = matchedLeads.map((m) => m.lead_id);
  const availableLeads = allLeads.filter((l) => !linkedLeadIds.includes(l.id));

  const handleLinkLead = async () => {
    if (!property || !selectedLeadId) return;

    setIsLinking(true);
    try {
      // Calculate match score
      const lead = allLeads.find((l) => l.id === selectedLeadId);
      if (!lead) throw new Error('Lead not found');

      let score = 0;
      const reasons: string[] = [];

      // Price match
      const budgetMin = lead.budget_min || 0;
      const budgetMax = lead.budget_max || Infinity;
      if (property.price >= budgetMin && property.price <= budgetMax) {
        score += 40;
        reasons.push('Within budget');
      }

      // Bedroom match
      if (lead.bedrooms && property.bedrooms === lead.bedrooms) {
        score += 25;
        reasons.push('Exact bedroom count');
      } else if (lead.bedrooms && Math.abs(property.bedrooms - lead.bedrooms) <= 1) {
        score += 15;
        reasons.push('Similar bedroom count');
      }

      // Location match
      if (lead.locations && lead.locations.length > 0) {
        const locationMatch = lead.locations.some(
          (loc) =>
            property.location?.toLowerCase().includes(loc.toLowerCase()) ||
            loc.toLowerCase().includes(property.location?.toLowerCase() || '')
        );
        if (locationMatch) {
          score += 20;
          reasons.push('Location match');
        }
      }

      // Property type match
      if (lead.property_types && lead.property_types.includes(property.type)) {
        score += 15;
        reasons.push('Property type match');
      }

      const { error } = await supabase.from('property_matches').insert({
        lead_id: selectedLeadId,
        property_id: property.id,
        match_type: 'internal',
        match_score: Math.min(score, 100),
        match_reasons: reasons.length > 0 ? reasons : ['Manual link'],
        status: 'pending',
        created_by: user?.id,
      });

      if (error) throw error;

      // Update property matches count
      await supabase
        .from('properties')
        .update({ matches: (property.matches || 0) + 1 })
        .eq('id', property.id);

      toast.success('Lead linked to property');
      setSelectedLeadId('');
      setShowLinkForm(false);
      refetch();
    } catch (error: any) {
      toast.error(`Failed to link lead: ${error.message}`);
    } finally {
      setIsLinking(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'sent':
        return 'bg-primary/10 text-primary';
      case 'viewed':
        return 'bg-warning/10 text-warning';
      case 'interested':
        return 'bg-success/10 text-success';
      case 'dismissed':
        return 'bg-muted text-muted-foreground';
      default:
        return 'bg-muted text-muted-foreground';
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users className="h-5 w-5 text-[hsl(82,84%,50%)]" />
            Matched Leads for {property?.building_name || property?.title || 'Property'}
          </DialogTitle>
        </DialogHeader>

        {/* Matched Leads List */}
        <div className="space-y-3">
          {matchedLeads.length === 0 && !showLinkForm ? (
            <p className="text-muted-foreground text-center py-4">
              No matched leads yet
            </p>
          ) : (
            matchedLeads.map((match) => {
              const lead = match.lead as LeadRow | null;
              if (!lead) return null;

              return (
                <div
                  key={match.id}
                  className="border border-border rounded-lg p-3 space-y-2"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-medium">{lead.name}</span>
                    {match.match_score >= 70 && (
                      <Badge className="text-xs bg-[hsl(82,84%,50%)]/10 text-[hsl(82,84%,50%)]">
                        {match.match_score}% Match
                      </Badge>
                    )}
                    {match.match_score < 70 && match.match_score >= 40 && (
                      <Badge className="text-xs bg-warning/10 text-warning">
                        {match.match_score}% Match
                      </Badge>
                    )}
                    {match.match_score < 40 && (
                      <Badge className="text-xs bg-muted text-muted-foreground">
                        {match.match_score}% Match
                      </Badge>
                    )}
                  </div>
                  <div className="flex gap-4 text-sm text-muted-foreground">
                    {lead.phone && <span>{lead.phone}</span>}
                    {lead.email && <span>{lead.email}</span>}
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    {(match.match_reasons as string[] || []).map((reason, i) => (
                      <Badge key={i} variant="outline" className="text-xs">
                        {reason}
                      </Badge>
                    ))}
                  </div>
                  <div className="flex items-center justify-between">
                    <Badge className={`text-xs capitalize ${getStatusColor(match.status)}`}>
                      {match.status}
                    </Badge>
                    <span className="text-xs text-muted-foreground">
                      {lead.budget_min || lead.budget_max
                        ? `Budget: ${formatCurrency(lead.budget_min || 0, lead.budget_currency || 'AED')} - ${formatCurrency(lead.budget_max || 0, lead.budget_currency || 'AED')}`
                        : 'No budget specified'}
                    </span>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Link to Lead Form */}
        {showLinkForm ? (
          <div className="space-y-4 border-t border-border pt-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Select Lead to Link</label>
              <Select value={selectedLeadId} onValueChange={setSelectedLeadId}>
                <SelectTrigger>
                  <SelectValue placeholder="Choose a lead..." />
                </SelectTrigger>
                <SelectContent>
                  {availableLeads.length === 0 ? (
                    <div className="p-2 text-sm text-muted-foreground text-center">
                      No available leads
                    </div>
                  ) : (
                    availableLeads.map((lead) => (
                      <SelectItem key={lead.id} value={lead.id}>
                        {lead.name} - {lead.phone}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>
            <div className="flex gap-2">
              <Button
                onClick={handleLinkLead}
                disabled={!selectedLeadId || isLinking}
                className="flex-1 bg-[hsl(82,84%,50%)] text-black hover:bg-[hsl(82,84%,45%)]"
              >
                {isLinking && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                <LinkIcon className="h-4 w-4 mr-2" />
                Link Lead
              </Button>
              <Button variant="outline" onClick={() => setShowLinkForm(false)}>
                Cancel
              </Button>
            </div>
          </div>
        ) : (
          <Button
            onClick={() => setShowLinkForm(true)}
            className="w-full bg-[hsl(82,84%,50%)] text-black hover:bg-[hsl(82,84%,45%)]"
          >
            <Plus className="h-4 w-4 mr-2" />
            Link Lead to Property
          </Button>
        )}
      </DialogContent>
    </Dialog>
  );
}
