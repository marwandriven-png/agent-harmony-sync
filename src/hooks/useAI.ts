import { useMutation } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import type { Database } from '@/integrations/supabase/types';

type LeadRow = Database['public']['Tables']['leads']['Row'];
type PropertyRow = Database['public']['Tables']['properties']['Row'];
type ActivityRow = Database['public']['Tables']['activities']['Row'];

export interface LeadProfile {
  intent: 'buy' | 'rent' | 'invest';
  urgency: 'high' | 'medium' | 'low';
  budget_tier: 'luxury' | 'premium' | 'mid_range' | 'budget';
  property_preferences: string[];
  communication_style: 'formal' | 'casual' | 'professional';
  key_insights: string[];
  recommended_approach: string;
}

export interface PropertyMatch {
  property_id: string;
  match_score: number;
  match_reasons: string[];
  concerns: string[];
  recommended_pitch: string;
}

export interface GeneratedMessage {
  subject?: string;
  message: string;
  cta: string;
}

export interface MarketInsight {
  market_trend: 'rising' | 'stable' | 'declining';
  price_per_sqft_range: { min: number; max: number };
  comparable_transactions: { price: number; type: string; size: number; date: string }[];
  investment_rating: number;
  key_factors: string[];
  recommendation: string;
}

export interface FollowUpPlan {
  week_1: { tasks: { title: string; type: string; description: string; day: number }[] };
  week_2: { tasks: { title: string; type: string; description: string; day: number }[] };
  week_3: { tasks: { title: string; type: string; description: string; day: number }[] };
  key_milestones: string[];
  success_metrics: string[];
}

async function callAI<T>(type: string, data: Record<string, unknown>): Promise<T> {
  const { data: result, error } = await supabase.functions.invoke('ai-assistant', {
    body: { type, data },
  });

  if (error) {
    throw new Error(error.message || 'AI request failed');
  }

  if (!result.success) {
    throw new Error(result.error || 'AI request failed');
  }

  return result.result as T;
}

export function useLeadProfile() {
  return useMutation({
    mutationFn: async (lead: LeadRow) => {
      return callAI<LeadProfile>('lead_profile', { lead });
    },
    onError: (error) => {
      toast.error(`Failed to analyze lead: ${error.message}`);
    },
  });
}

export function usePropertyMatch() {
  return useMutation({
    mutationFn: async ({ lead, properties }: { lead: LeadRow; properties: PropertyRow[] }) => {
      return callAI<PropertyMatch[]>('property_match', { lead, properties });
    },
    onError: (error) => {
      toast.error(`Failed to match properties: ${error.message}`);
    },
  });
}

export function useGenerateMessage() {
  return useMutation({
    mutationFn: async ({
      lead,
      channel,
      context,
      properties,
    }: {
      lead: LeadRow;
      channel: 'whatsapp' | 'email' | 'sms';
      context?: string;
      properties?: PropertyRow[];
    }) => {
      return callAI<GeneratedMessage>('message_generate', { lead, channel, context, properties });
    },
    onSuccess: () => {
      toast.success('Message generated successfully');
    },
    onError: (error) => {
      toast.error(`Failed to generate message: ${error.message}`);
    },
  });
}

export function useMarketInsight() {
  return useMutation({
    mutationFn: async ({
      location,
      property_type,
      budget_min,
      budget_max,
    }: {
      location: string;
      property_type: string;
      budget_min?: number;
      budget_max?: number;
    }) => {
      return callAI<MarketInsight>('market_insight', {
        location,
        property_type,
        budget_min,
        budget_max,
      });
    },
    onError: (error) => {
      toast.error(`Failed to get market insights: ${error.message}`);
    },
  });
}

export function useFollowUpPlan() {
  return useMutation({
    mutationFn: async ({
      lead,
      stage,
      activities,
    }: {
      lead: LeadRow;
      stage: string;
      activities?: ActivityRow[];
    }) => {
      return callAI<FollowUpPlan>('follow_up_suggest', { lead, stage, activities });
    },
    onSuccess: () => {
      toast.success('Follow-up plan generated');
    },
    onError: (error) => {
      toast.error(`Failed to create follow-up plan: ${error.message}`);
    },
  });
}
