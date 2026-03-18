/**
 * Shared types for the Property Intelligence system.
 */

// ─── Distance Classification ───
export type ProximityClass = 'very_close' | 'near' | 'walkable' | 'not_nearby';

export interface ProximityThresholds {
  veryClose: number;
  near: number;
  walkable: number;
}

export const DEFAULT_THRESHOLDS: ProximityThresholds = {
  veryClose: 50,
  near: 120,
  walkable: 250,
};

// ─── Amenity Types ───
export type AmenityType = 'park' | 'pool' | 'school' | 'mosque' | 'mall' | 'playground' | 'community_center' | 'healthcare' | 'retail';

export interface DetectedAmenity {
  type: AmenityType;
  name: string;
  distanceMeters: number;
  proximity: ProximityClass;
  coordinates: [number, number];
  plotId?: string;
  icon?: string;
}

export const AMENITY_ICONS: Record<string, string> = {
  pool: '🏊', park: '🌳', playground: '🛝', mall: '🛍️',
  school: '🏫', mosque: '🕌', community_center: '🏛️',
  clubhouse: '🏛️', healthcare: '🏥', retail: '🏪',
};

export const AMENITY_CONFIG: Record<AmenityType, { emoji: string; label: string; color: string; mapColor: string }> = {
  park:             { emoji: '🌳', label: 'Park',             color: 'bg-emerald-500/10 text-emerald-400', mapColor: '#10b981' },
  pool:             { emoji: '🏊', label: 'Pool',             color: 'bg-cyan-500/10 text-cyan-400',      mapColor: '#06b6d4' },
  school:           { emoji: '🏫', label: 'School',           color: 'bg-indigo-500/10 text-indigo-400',   mapColor: '#6366f1' },
  mosque:           { emoji: '🕌', label: 'Mosque',           color: 'bg-teal-500/10 text-teal-400',      mapColor: '#14b8a6' },
  mall:             { emoji: '🛍️', label: 'Mall',            color: 'bg-pink-500/10 text-pink-400',      mapColor: '#ec4899' },
  playground:       { emoji: '🎠', label: 'Play Area',        color: 'bg-yellow-500/10 text-yellow-400',  mapColor: '#eab308' },
  community_center: { emoji: '🏛️', label: 'Community Center',color: 'bg-violet-500/10 text-violet-400',  mapColor: '#8b5cf6' },
  healthcare:       { emoji: '🏥', label: 'Healthcare',       color: 'bg-red-500/10 text-red-400',        mapColor: '#ef4444' },
  retail:           { emoji: '🏪', label: 'Retail',           color: 'bg-orange-500/10 text-orange-400',  mapColor: '#f97316' },
};

// ─── Layout Classification ───
export type LayoutType = 'back_to_back' | 'single_row' | 'unknown';
export type PositionType = 'corner' | 'middle' | 'end' | 'unknown';
export type BackFacingType = 'villa' | 'road' | 'park' | 'open_space' | 'community_edge' | 'unknown';

export interface LayoutAnalysis {
  layoutType: LayoutType;
  positionType: PositionType;
  backFacing: BackFacingType;
  adjacentResidentialCount: number;
  adjacentRoadCount: number;
  adjacentParkCount: number;
}

// ─── Vastu Classification ───
export type VastuRating = 'excellent' | 'good' | 'neutral' | 'less_preferred';

export interface VastuAnalysis {
  entranceDirection: string;
  rating: VastuRating;
  compliant: boolean;
  details: string;
  score: number; // 1-4 for ranking
}

// ─── Smart Property Tags ───
export interface SmartTag {
  label: string;
  category: 'layout' | 'position' | 'amenity' | 'vastu' | 'facing';
  emoji: string;
  color: string;
  detail?: string;
}

// ─── Tag Color Map (for map visualization) ───
export const TAG_COLORS: Record<string, string> = {
  'Single Row':      '#2ECC71',
  'Back-to-Back':    '#FF5555',
  'Corner':          '#FFB347',
  'End Unit':        '#BD93F9',
  'Backs Park':      '#26E8C8',
  'Backs Road':      '#F1FA8C',
  'Backs Open Land': '#FFB347',
  'Open View':       '#38BDF8',
  'Vastu ✓':         '#FF79C6',
};

// ─── NL Search Filters (normalized) ───
export interface PISearchFilters {
  layoutType?: 'back_to_back' | 'single_row';
  position?: 'corner' | 'end';
  backFacing?: BackFacingType;
  vastuCompliant?: boolean;
  nearAmenity?: AmenityType[];
  maxDistance?: number;
  naturalQuery?: string;
}
