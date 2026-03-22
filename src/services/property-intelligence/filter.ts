/**
 * Score-ranked villa filter function.
 * Merges NL query parsing with structured filters, applies hard filters,
 * then sorts by composite score.
 */

import type { CommunityVilla } from '@/hooks/useVillas';
import type { VillaIntelligence } from '@/hooks/usePropertyIntelligence';
import type { PISearchFilters, AmenityType, ProximityClass } from './types';
import { classifyVastu, resolveDirectionText } from './classifiers';
import { parseNaturalLanguageQuery } from './nl-parser';

// ─── Scoring weights ───

const SCORE_WEIGHTS = {
  singleRow: 18,
  backToBack: 0,
  corner: 14,
  endUnit: 7,
  backsPark: 12,
  backsRoad: 5,
  backsOpenSpace: 3,
  vastuMultiplier: 4, // multiplied by vastu score (1-4)
  amenityProximity: {
    very_close: 10,
    near: 6,
    walkable: 3,
    not_nearby: 0,
  } as Record<ProximityClass, number>,
} as const;

/**
 * Compute a composite intelligence score for a villa.
 */
export function computeVillaScore(intel: VillaIntelligence): number {
  let score = 0;
  const { layout, amenities, tags } = intel;

  // Layout
  if (layout.layoutType === 'single_row') score += SCORE_WEIGHTS.singleRow;

  // Position
  if (layout.positionType === 'corner') score += SCORE_WEIGHTS.corner;
  else if (layout.positionType === 'end') score += SCORE_WEIGHTS.endUnit;

  // Back facing
  if (layout.backFacing === 'park') score += SCORE_WEIGHTS.backsPark;
  else if (layout.backFacing === 'road') score += SCORE_WEIGHTS.backsRoad;
  else if (layout.backFacing === 'open_space') score += SCORE_WEIGHTS.backsOpenSpace;

  // Vastu
  const vastuTag = tags.find(t => t.category === 'vastu' && t.detail);
  const vastuScore = vastuTag?.detail === 'Excellent' ? 4 : vastuTag?.detail === 'Good' ? 3 : 0;
  score += vastuScore * SCORE_WEIGHTS.vastuMultiplier;

  // Amenity proximity bonuses
  for (const amenity of amenities) {
    score += SCORE_WEIGHTS.amenityProximity[amenity.proximity] ?? 0;
  }

  return score;
}

export interface ScoredVilla {
  villa: CommunityVilla;
  intel: VillaIntelligence;
  score: number;
}

/**
 * Apply villa intelligence filters and return score-ranked results.
 * Merges NL query into structured filters (explicit keys override NL).
 */
export function applyIntelligenceFilters(
  villas: CommunityVilla[],
  intelligenceMap: Map<string, VillaIntelligence>,
  filters: PISearchFilters,
): ScoredVilla[] {
  // Merge NL query into filters (explicit keys win)
  const nlFilters = filters.naturalQuery
    ? parseNaturalLanguageQuery(filters.naturalQuery)
    : {};
  const resolved: PISearchFilters = { ...nlFilters, ...filters };

  const maxDist = resolved.maxDistance ?? 500;
  const results: ScoredVilla[] = [];

  for (const villa of villas) {
    const intel = intelligenceMap.get(villa.id);
    if (!intel) continue;
    const resolvedVastu = classifyVastu(resolveDirectionText(villa.facing_direction, villa.orientation, villa.vastu_details));

    // Hard filters
    if (resolved.layoutType === 'single_row') {
      if (intel.layout.layoutType !== 'single_row' && !villa.is_single_row) {
        continue;
      }
    }

    if (resolved.layoutType === 'back_to_back') {
      if (intel.layout.layoutType !== 'back_to_back') {
        continue;
      }
    }

    if (resolved.position === 'corner') {
      if (intel.layout.positionType !== 'corner' && !villa.is_corner) continue;
    }
    if (resolved.position === 'end') {
      if (intel.layout.positionType !== 'end' && villa.position_type !== 'end') continue;
    }

    if (resolved.backFacing) {
      const bf = intel.layout.backFacing;
      if (bf !== resolved.backFacing) {
        // Check DB fallback flags
        if (resolved.backFacing === 'park' && !villa.backs_park) continue;
        if (resolved.backFacing === 'road' && !villa.backs_road) continue;
        if (resolved.backFacing !== 'park' && resolved.backFacing !== 'road') continue;
      }
    }

    if (resolved.vastuCompliant) {
      const hasVastu = intel.tags.some(t => t.label.includes('Vastu ✓'));
      if (!hasVastu && !villa.vastu_compliant && !resolvedVastu.compliant) continue;
    }

    if (resolved.vastuDirection) {
      const dirTag = intel.tags.find(t => t.category === 'vastu' && t.label.includes('Facing'));
      const dirMap: Record<string, string> = { E: 'East', W: 'West', N: 'North', S: 'South', NE: 'Northeast', NW: 'Northwest', SE: 'Southeast', SW: 'Southwest' };
      const expected = dirMap[resolved.vastuDirection] || resolved.vastuDirection;
      const matchesResolvedDirection = resolvedVastu.entranceDirection === expected;
      if (!dirTag?.label.includes(expected) && !matchesResolvedDirection) continue;
    }

    // Amenity proximity filters
    if (resolved.nearAmenity?.length) {
      const allFound = resolved.nearAmenity.every(reqType =>
        intel.amenities.some(a => a.type === reqType && a.distanceMeters <= maxDist)
      );
      if (!allFound) continue;
    }

    const score = computeVillaScore(intel);
    results.push({ villa, intel, score });
  }

  // Sort by score desc, then by closest amenity as tiebreaker
  return results.sort((a, b) =>
    b.score !== a.score
      ? b.score - a.score
      : (a.intel.amenities[0]?.distanceMeters ?? 9999) - (b.intel.amenities[0]?.distanceMeters ?? 9999)
  );
}
