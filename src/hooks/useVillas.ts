import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { toast } from 'sonner';

export interface CommunityVilla {
  id: string;
  community_name: string;
  sub_community: string | null;
  cluster_name: string | null;
  villa_number: string;
  plot_number: string | null;
  plot_id: string | null;
  orientation: string | null;
  facing_direction: string | null;
  position_type: string | null;
  is_corner: boolean;
  is_single_row: boolean;
  backs_park: boolean;
  backs_road: boolean;
  near_pool: boolean;
  near_entrance: boolean;
  near_school: boolean;
  near_community_center: boolean;
  vastu_compliant: boolean | null;
  vastu_details: string | null;
  latitude: number | null;
  longitude: number | null;
  land_usage: string | null;
  plot_size_sqft: number | null;
  built_up_area_sqft: number | null;
  bedrooms: number | null;
  floors: number | null;
  year_built: number | null;
  notes: string | null;
  metadata: Record<string, unknown>;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  // Joined data
  owner?: VillaOwner | null;
  listings?: BayutListing[];
  listing_count?: number;
}

export interface VillaOwner {
  id: string;
  villa_id: string;
  owner_name: string;
  phone: string | null;
  email: string | null;
  nationality: string | null;
  ownership_type: string | null;
  ownership_start_date: string | null;
  notes: string | null;
  created_at: string;
}

export interface BayutListing {
  id: string;
  villa_id: string | null;
  community_name: string;
  villa_number: string | null;
  listing_type: string;
  listing_price: number | null;
  listing_agent: string | null;
  listing_agency: string | null;
  listing_url: string | null;
  is_active: boolean;
  bedrooms: number | null;
  size_sqft: number | null;
}

export interface VillaSearchFilters {
  community?: string;
  plotNumber?: string;
  googleLocation?: string;
  villaNumber?: string;
  villaNumberRange?: { from: number; to: number };
  oddEven?: 'odd' | 'even' | 'all';
  nearVilla?: string;
  nearVillaRadius?: number;
  isCorner?: boolean;
  isSingleRow?: boolean;
  isBackToBack?: boolean;
  isEndUnit?: boolean;
  backsPark?: boolean;
  backsRoad?: boolean;
  backsOpenSpace?: boolean;
  nearPool?: boolean;
  nearEntrance?: boolean;
  nearSchool?: boolean;
  vastuCompliant?: boolean;
  bedrooms?: number;
  minSize?: number;
  maxSize?: number;
  hasOwner?: boolean;
  isListed?: boolean;
  listingType?: 'sale' | 'rent';
  cluster?: string;
  searchText?: string;
  nearAmenity?: string[];
  maxDistance?: number;
}

export function useVillas(filters?: VillaSearchFilters) {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['villas', filters],
    queryFn: async () => {
      let query = supabase
        .from('community_villas')
        .select('*')
        .order('community_name')
        .order('villa_number');

      if (filters?.community) {
        query = query.ilike('community_name', `%${filters.community}%`);
      }
      if (filters?.plotNumber) {
        query = query.ilike('plot_number', `%${filters.plotNumber}%`);
      }
      if (filters?.villaNumber) {
        query = query.eq('villa_number', filters.villaNumber);
      }
      if (filters?.cluster) {
        query = query.ilike('cluster_name', `%${filters.cluster}%`);
      }
      // Spatial / intelligence flags are filtered client-side so runtime GIS enrichment
      // can promote villas even when database flags are stale or missing.
      if (filters?.vastuCompliant) {
        query = query.eq('vastu_compliant', true);
      }
      if (filters?.bedrooms) {
        query = query.eq('bedrooms', filters.bedrooms);
      }
      if (filters?.minSize) {
        query = query.gte('plot_size_sqft', filters.minSize);
      }
      if (filters?.maxSize) {
        query = query.lte('plot_size_sqft', filters.maxSize);
      }

      const { data, error } = await query.limit(500);
      if (error) throw error;

      let villas = (data || []) as unknown as CommunityVilla[];

      // Client-side filters
      if (filters?.oddEven === 'odd') {
        villas = villas.filter(v => {
          const num = parseInt(v.villa_number, 10);
          return !isNaN(num) && num % 2 !== 0;
        });
      } else if (filters?.oddEven === 'even') {
        villas = villas.filter(v => {
          const num = parseInt(v.villa_number, 10);
          return !isNaN(num) && num % 2 === 0;
        });
      }

      if (filters?.villaNumberRange) {
        const { from, to } = filters.villaNumberRange;
        villas = villas.filter(v => {
          const num = parseInt(v.villa_number, 10);
          return !isNaN(num) && num >= from && num <= to;
        });
      }

      if (filters?.searchText) {
        const text = filters.searchText.toLowerCase();
        villas = villas.filter(v =>
          v.villa_number.toLowerCase().includes(text) ||
          v.community_name.toLowerCase().includes(text) ||
          (v.cluster_name?.toLowerCase().includes(text) ?? false) ||
          (v.plot_number?.toLowerCase().includes(text) ?? false)
        );
      }

      return villas;
    },
    enabled: !!user,
  });
}

export function useVillaWithDetails(villaId: string | undefined) {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['villa-details', villaId],
    queryFn: async () => {
      if (!villaId) return null;
      // GIS synthetic villas (id starts with 'gis:') don't exist in Supabase
      if (villaId.startsWith('gis:')) return null;

      const [villaRes, ownerRes, listingsRes] = await Promise.all([
        supabase.from('community_villas').select('*').eq('id', villaId).single(),
        supabase.from('villa_owners').select('*').eq('villa_id', villaId).limit(1),
        supabase.from('bayut_listings').select('*').eq('villa_id', villaId).eq('is_active', true),
      ]);

      if (villaRes.error) throw villaRes.error;

      const villa = villaRes.data as unknown as CommunityVilla;
      villa.owner = (ownerRes.data?.[0] as unknown as VillaOwner) || null;
      villa.listings = (listingsRes.data || []) as unknown as BayutListing[];
      villa.listing_count = villa.listings.length;

      return villa;
    },
    enabled: !!user && !!villaId,
  });
}

export function useVillaListingCounts(villaIds: string[]) {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['villa-listing-counts', villaIds],
    queryFn: async () => {
      if (villaIds.length === 0) return {};

      const { data, error } = await supabase
        .from('bayut_listings')
        .select('villa_id')
        .in('villa_id', villaIds)
        .eq('is_active', true);

      if (error) throw error;

      const counts: Record<string, number> = {};
      (data || []).forEach((row: any) => {
        counts[row.villa_id] = (counts[row.villa_id] || 0) + 1;
      });
      return counts;
    },
    enabled: !!user && villaIds.length > 0,
  });
}

export function useCommunities() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['communities'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('community_villas')
        .select('community_name')
        .limit(1000);

      if (error) throw error;
      const unique = [...new Set((data || []).map((d: any) => d.community_name))];
      return unique.sort();
    },
    enabled: !!user,
  });
}

export function useVillasByIds(villaIds: string[]) {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['villas-by-ids', villaIds],
    queryFn: async () => {
      if (villaIds.length === 0) return [] as CommunityVilla[];
      // Filter out synthetic GIS IDs — they're not in Supabase
      const realIds = villaIds.filter(id => !id.startsWith('gis:'));
      if (realIds.length === 0) return [] as CommunityVilla[];

      const { data, error } = await supabase
        .from('community_villas')
        .select('*')
        .in('id', realIds)
        .limit(1000);

      if (error) throw error;

      const byId = new Map((data || []).map((villa: any) => [villa.id, villa as CommunityVilla]));
      return realIds.map(id => byId.get(id)).filter(Boolean) as CommunityVilla[];
    },
    enabled: !!user && villaIds.length > 0,
  });
}
