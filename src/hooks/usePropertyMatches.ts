import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { toast } from 'sonner';
import type { Database } from '@/integrations/supabase/types';

type PropertyRow = Database['public']['Tables']['properties']['Row'];

export interface PropertyMatch {
  id: string;
  lead_id: string;
  property_id: string | null;
  external_listing_id: string | null;
  match_type: 'internal' | 'external';
  match_score: number;
  match_reasons: string[];
  status: 'pending' | 'sent' | 'viewed' | 'interested' | 'dismissed' | 'converted';
  is_flagged: boolean;
  notes: string | null;
  sent_at: string | null;
  external_data: ExternalListingData | null;
  created_at: string;
  updated_at: string;
  property?: PropertyRow | null;
}

export interface ExternalListingData {
  source: string;
  title: string;
  price: number;
  bedrooms: number;
  size_sqft: number;
  location: string;
  building_name: string;
  property_type: string;
  purpose: string;
  thumbnail_url: string;
  listing_url: string;
  agent_name?: string;
  broker_name?: string;
}

interface LeadProfile {
  budget_min: number | null;
  budget_max: number | null;
  bedrooms: number | null;
  property_types: string[] | null;
  locations: string[] | null;
}

// Calculate match score based on lead requirements
export function calculateMatchScore(
  property: { price: number; bedrooms: number; location: string; type?: string; property_type?: string },
  profile: LeadProfile
): { score: number; reasons: string[] } {
  let score = 0;
  const reasons: string[] = [];

  const budgetMin = profile.budget_min || 0;
  const budgetMax = profile.budget_max || Infinity;
  const budgetMid = (budgetMin + budgetMax) / 2;
  const priceRange = Math.max(budgetMax - budgetMin, 1);

  // Price match (up to 40 points)
  if (property.price >= budgetMin && property.price <= budgetMax) {
    score += 40;
    reasons.push('Within budget');
  } else if (property.price <= budgetMax * 1.1) {
    score += 20;
    reasons.push('Slightly above budget');
  } else if (property.price >= budgetMin * 0.9) {
    score += 15;
    reasons.push('Below budget range');
  }

  // Bedroom match (up to 25 points)
  const targetBedrooms = profile.bedrooms || 2;
  const bedroomDiff = Math.abs(property.bedrooms - targetBedrooms);
  if (bedroomDiff === 0) {
    score += 25;
    reasons.push('Exact bedroom count');
  } else if (bedroomDiff === 1) {
    score += 15;
    reasons.push('Similar bedroom count');
  }

  // Property type match (up to 15 points)
  const propertyTypes = profile.property_types || [];
  const propType = property.type || property.property_type || '';
  if (propertyTypes.length > 0 && propertyTypes.some(t => 
    t.toLowerCase() === propType.toLowerCase()
  )) {
    score += 15;
    reasons.push('Property type match');
  }

  // Location match (up to 20 points)
  const locations = profile.locations || [];
  if (locations.length > 0 && locations.some(loc => 
    property.location?.toLowerCase().includes(loc.toLowerCase()) ||
    loc.toLowerCase().includes(property.location?.toLowerCase() || '')
  )) {
    score += 20;
    reasons.push('Location match');
  }

  return { score: Math.min(score, 100), reasons };
}

// Hook to fetch matches for a lead
export function usePropertyMatchesByLead(leadId: string) {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['property-matches', leadId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('property_matches')
        .select(`
          *,
          property:properties(*)
        `)
        .eq('lead_id', leadId)
        .order('match_score', { ascending: false });

      if (error) throw error;
      return data as unknown as PropertyMatch[];
    },
    enabled: !!user && !!leadId,
  });
}

// Hook to generate matches for a lead
export function useGenerateMatches() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (leadId: string) => {
      // Fetch lead requirements
      const { data: lead, error: leadError } = await supabase
        .from('leads')
        .select('*')
        .eq('id', leadId)
        .single();

      if (leadError) throw leadError;

      // Fetch available properties
      const { data: properties, error: propError } = await supabase
        .from('properties')
        .select('*')
        .eq('status', 'available');

      if (propError) throw propError;

      // Delete existing pending matches for this lead
      await supabase
        .from('property_matches')
        .delete()
        .eq('lead_id', leadId)
        .eq('status', 'pending');

      // Calculate matches
      const matches = properties
        .map(property => {
          const { score, reasons } = calculateMatchScore(
            { 
              price: Number(property.price), 
              bedrooms: property.bedrooms, 
              location: property.location,
              type: property.type
            },
            {
              budget_min: lead.budget_min ? Number(lead.budget_min) : null,
              budget_max: lead.budget_max ? Number(lead.budget_max) : null,
              bedrooms: lead.bedrooms,
              property_types: lead.property_types,
              locations: lead.locations,
            }
          );

          return {
            lead_id: leadId,
            property_id: property.id,
            match_type: 'internal' as const,
            match_score: score,
            match_reasons: reasons,
            status: 'pending' as const,
            created_by: user?.id,
          };
        })
        .filter(m => m.match_score >= 30)
        .sort((a, b) => b.match_score - a.match_score)
        .slice(0, 20); // Top 20 matches

      if (matches.length > 0) {
        const { error: insertError } = await supabase
          .from('property_matches')
          .insert(matches);

        if (insertError) throw insertError;
      }

      return matches.length;
    },
    onSuccess: (count, leadId) => {
      queryClient.invalidateQueries({ queryKey: ['property-matches', leadId] });
      toast.success(`Found ${count} matching properties`);
    },
    onError: (error) => {
      toast.error(`Failed to generate matches: ${error.message}`);
    },
  });
}

// Hook to update match status
export function useUpdateMatchStatus() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ 
      matchId, 
      status, 
      leadId 
    }: { 
      matchId: string; 
      status: PropertyMatch['status']; 
      leadId: string;
    }) => {
      const updates: Record<string, unknown> = { status };
      if (status === 'sent') {
        updates.sent_at = new Date().toISOString();
      }

      const { data, error } = await supabase
        .from('property_matches')
        .update(updates)
        .eq('id', matchId)
        .select()
        .single();

      if (error) throw error;
      return { data, leadId };
    },
    onSuccess: ({ leadId }) => {
      queryClient.invalidateQueries({ queryKey: ['property-matches', leadId] });
    },
    onError: (error) => {
      toast.error(`Failed to update match: ${error.message}`);
    },
  });
}

// Hook to toggle flag on match
export function useToggleMatchFlag() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ 
      matchId, 
      isFlagged, 
      leadId 
    }: { 
      matchId: string; 
      isFlagged: boolean; 
      leadId: string;
    }) => {
      const { data, error } = await supabase
        .from('property_matches')
        .update({ is_flagged: isFlagged })
        .eq('id', matchId)
        .select()
        .single();

      if (error) throw error;
      return { data, leadId };
    },
    onSuccess: ({ leadId }) => {
      queryClient.invalidateQueries({ queryKey: ['property-matches', leadId] });
    },
    onError: (error) => {
      toast.error(`Failed to update match: ${error.message}`);
    },
  });
}

// Hook to add note to match
export function useAddMatchNote() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ 
      matchId, 
      note, 
      leadId 
    }: { 
      matchId: string; 
      note: string; 
      leadId: string;
    }) => {
      const { data, error } = await supabase
        .from('property_matches')
        .update({ notes: note })
        .eq('id', matchId)
        .select()
        .single();

      if (error) throw error;
      return { data, leadId };
    },
    onSuccess: ({ leadId }) => {
      queryClient.invalidateQueries({ queryKey: ['property-matches', leadId] });
      toast.success('Note added');
    },
    onError: (error) => {
      toast.error(`Failed to add note: ${error.message}`);
    },
  });
}
