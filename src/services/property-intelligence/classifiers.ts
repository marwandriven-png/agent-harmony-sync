/**
 * Classification functions for distance, vastu, and land use.
 */

import type { ProximityClass, ProximityThresholds, VastuAnalysis, VastuRating, AmenityType } from './types';
import { DEFAULT_THRESHOLDS } from './types';

// ─── Distance Classification ───

export function classifyDistance(meters: number, thresholds: ProximityThresholds = DEFAULT_THRESHOLDS): ProximityClass {
  if (meters <= thresholds.veryClose) return 'very_close';
  if (meters <= thresholds.near) return 'near';
  if (meters <= thresholds.walkable) return 'walkable';
  return 'not_nearby';
}

export function proximityLabel(cls: ProximityClass): string {
  switch (cls) {
    case 'very_close': return 'Very Close';
    case 'near': return 'Near';
    case 'walkable': return 'Walkable';
    case 'not_nearby': return 'Not Nearby';
  }
}

export function proximityColor(cls: ProximityClass): string {
  switch (cls) {
    case 'very_close': return 'text-emerald-400';
    case 'near': return 'text-cyan-400';
    case 'walkable': return 'text-amber-400';
    case 'not_nearby': return 'text-gray-500';
  }
}

export function proximityCssClass(cls: ProximityClass): string {
  switch (cls) {
    case 'very_close': return 'prox-vc';
    case 'near': return 'prox-near';
    case 'walkable': return 'prox-walk';
    case 'not_nearby': return 'prox-far';
  }
}

// ─── Vastu Classification ───

// Standard Vastu Shastra compass ratings for entrance/plot orientation.
// E=Excellent (best light, prosperity), N=Good (wealth direction),
// NE=Good (divine corner, acceptable), NW/SE/W=Neutral,
// S/SW=Less Preferred (negative energy flow per Vastu).
const VASTU_MAP: Record<string, { rating: VastuRating; score: number }> = {
  'E':  { rating: 'excellent',      score: 4 }, // Best — morning sun, prosperity
  'N':  { rating: 'good',           score: 3 }, // Wealth & career
  'NE': { rating: 'good',           score: 3 }, // Divine corner, auspicious
  'NW': { rating: 'neutral',        score: 2 }, // Air direction — acceptable
  'SE': { rating: 'neutral',        score: 2 }, // Fire corner — neutral
  'W':  { rating: 'neutral',        score: 2 }, // Acceptable for some families
  'S':  { rating: 'less_preferred', score: 1 }, // Lord of death (Yama) direction
  'SW': { rating: 'less_preferred', score: 1 }, // Negative energy accumulation
};

export function classifyVastu(facingDirection: string | null | undefined): VastuAnalysis {
  const dir = (facingDirection || '').toUpperCase().trim();

  // Try to match cardinal direction
  for (const [card, { rating, score }] of Object.entries(VASTU_MAP)) {
    const patterns = card.length === 2
      ? [card, card.split('').join('')]  // NE, NE
      : [card];

    for (const p of patterns) {
      if (dir === p || dir.includes(p === 'E' ? 'EAST' : p === 'W' ? 'WEST' : p === 'N' ? 'NORTH' : p === 'S' ? 'SOUTH' : p)) {
        const dirLabel = {
          'E': 'East', 'W': 'West', 'N': 'North', 'S': 'South',
          'NE': 'Northeast', 'NW': 'Northwest', 'SE': 'Southeast', 'SW': 'Southwest',
        }[card] || card;
        const compliant = score >= 3;
        return {
          entranceDirection: dirLabel,
          rating,
          compliant,
          details: `${dirLabel}-facing entrance — ${rating === 'excellent' ? 'Excellent' : rating === 'good' ? 'Good' : rating === 'neutral' ? 'Neutral' : 'Less preferred'} Vastu orientation`,
          score,
        };
      }
    }
  }

  // Check for directional words
  if (dir.includes('EAST')) return { entranceDirection: 'East', rating: 'excellent', compliant: true, details: 'East-facing entrance — Excellent Vastu orientation', score: 4 };
  if (dir.includes('NORTH')) return { entranceDirection: 'North', rating: 'good', compliant: true, details: 'North-facing entrance — Good Vastu orientation', score: 3 };
  if (dir.includes('WEST')) return { entranceDirection: 'West', rating: 'neutral', compliant: false, details: 'West-facing entrance — Neutral Vastu orientation', score: 2 };
  if (dir.includes('SOUTH')) return { entranceDirection: 'South', rating: 'less_preferred', compliant: false, details: 'South-facing entrance — Less preferred Vastu orientation', score: 1 };

  return { entranceDirection: 'Unknown', rating: 'neutral', compliant: false, details: 'Orientation not determined', score: 0 };
}

export function vastuRatingColor(rating: VastuRating): string {
  switch (rating) {
    case 'excellent': return 'text-emerald-400';
    case 'good': return 'text-cyan-400';
    case 'neutral': return 'text-amber-400';
    case 'less_preferred': return 'text-red-400';
  }
}

export function vastuRatingHex(rating: VastuRating): string {
  switch (rating) {
    case 'excellent': return '#2ECC71';
    case 'good': return '#4F8EF7';
    case 'neutral': return '#FFB347';
    case 'less_preferred': return '#FF5555';
  }
}

// ─── Land Use Classification ───

export function classifyLandUse(landUse: string): AmenityType | 'residential' | 'road' | 'open_space' | null {
  const lu = landUse.toUpperCase();
  if (lu.includes('PARK') || lu.includes('GARDEN') || lu.includes('GREEN') || lu.includes('LANDSCAPE')) return 'park';
  if (lu.includes('POOL') || lu.includes('SWIMMING')) return 'pool';
  if (lu.includes('SCHOOL') || lu.includes('NURSERY') || lu.includes('KINDERGARTEN')) return 'school';
  if (lu.includes('MOSQUE') || lu.includes('MASJID')) return 'mosque';
  if (lu.includes('MALL') || lu.includes('SHOPPING')) return 'mall';
  if (lu.includes('PLAY') || lu.includes('KIDS')) return 'playground';
  if (lu.includes('COMMUNITY') && (lu.includes('CENTER') || lu.includes('CENTRE') || lu.includes('CLUB'))) return 'community_center';
  if (lu.includes('HOSPITAL') || lu.includes('CLINIC') || lu.includes('HEALTH')) return 'healthcare';
  if (lu.includes('RETAIL') || lu.includes('COMMERCIAL') || lu.includes('SHOP')) return 'retail';
  if (lu.includes('ROAD') || lu.includes('STREET') || lu.includes('HIGHWAY') || lu.includes('SERVICE')) return 'road';
  if (lu.includes('VILLA') || lu.includes('RESIDENTIAL') || lu.includes('TOWNHOUSE') || lu.includes('HOUSE')) return 'residential';
  if (lu.includes('OPEN') || lu.includes('VACANT') || lu.includes('EMPTY')) return 'open_space';
  return null;
}
