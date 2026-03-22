/**
 * Classification functions for distance, vastu, and land use.
 */

import type { ProximityClass, ProximityThresholds, VastuAnalysis, VastuRating, AmenityType } from './types';
import { DEFAULT_THRESHOLDS } from './types';

const normalizeClassifierText = (value: string) => value
  .toUpperCase()
  .replace(/[_-]+/g, ' ')
  .replace(/\s+/g, ' ')
  .trim();

export function resolveDirectionText(...values: Array<string | null | undefined>): string | null {
  const first = values
    .map((value) => value?.trim())
    .find((value): value is string => Boolean(value));

  return first ?? null;
}

const PLAYGROUND_TERMS = [
  /\bPLAY(?:\s+AREA|\s+GROUND)?\b/,
  /\bKIDS?(?:\s+ZONE|\s+AREA)?\b/,
  /\bTOT\s+LOT\b/,
];

const PARK_TERMS = [
  /\bPARK\b/,
  /\bGARDEN\b/,
  /\bGREEN(?:\s+BELT|\s+AREA|\s+SPACE|S)?\b/,
  /\bRECREAT(?:ION|IONAL)\b/,
  /\bLAKE\b/,
  /\bLAGOON\b/,
  /\bPOND\b/,
  /\bWATER\s+FEATURE\b/,
  /\bWADI\b/,
];

const LANDSCAPE_TERMS = [
  /\bLANDSCAP(?:E|ED|ING)\b/,
  /\bSTREETSCAP(?:E|ING)\b/,
  /\bPLANT(?:ED|ING)?\b/,
  /\bMEDIAN\b/,
];

const COMMUNITY_CENTER_TERMS = [
  /\bCOMMUNITY\b.*\b(CENTER|CENTRE|CLUB|HUB|PAVILION)\b/,
  /\bCLUB\s*HOUSE\b/,
  /\bCLUBHOUSE\b/,
];

const ENTRANCE_TERMS = [
  /\bENTRANCE\b/,
  /\bENTRY\b/,
  /\bGATE\b/,
  /\bGUARD\s+HOUSE\b/,
  /\bSECURITY\s+(?:GATE|HOUSE|CABIN)\b/,
  /\bACCESS\b/,
];

const ROAD_TERMS = [
  /\bROAD\b/,
  /\bSTREET\b/,
  /\bHIGHWAY\b/,
  /\bSERVICE(?:\s+ROAD|\s+LANE)?\b/,
  /\bDRIVE\b/,
  /\bLANE\b/,
  /\bAVENUE\b/,
  /\bBOULEVARD\b/,
  /\bCRESCENT\b/,
  /\bWAY\b/,
];

const RESIDENTIAL_TERMS = [
  /\bVILLA\b/,
  /\bRESIDENTIAL\b/,
  /\bTOWN\s*HOUSE\b/,
  /\bTOWNHOUSE\b/,
  /\bHOUSE\b/,
  /\bROW\s+HOUSE\b/,
  /\bROWHOUSE\b/,
];

const OPEN_SPACE_TERMS = [
  /\bOPEN\b/,
  /\bVACANT\b/,
  /\bEMPTY\b/,
  /\bBUFFER\b/,
  /\bUTILITY\b/,
];

const matchesAny = (value: string, patterns: RegExp[]) => patterns.some((pattern) => pattern.test(value));

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

// Standard Vastu Shastra ratings. E=Excellent, N/NE=Good, NW/SE/W=Neutral, S/SW=Less Preferred.
const VASTU_MAP: Record<string, { rating: VastuRating; score: number }> = {
  'E':  { rating: 'excellent',      score: 4 }, // Best — morning sun, prosperity
  'N':  { rating: 'good',           score: 3 }, // Wealth & career direction
  'NE': { rating: 'good',           score: 3 }, // Divine corner — auspicious
  'NW': { rating: 'neutral',        score: 2 }, // Air direction — acceptable
  'SE': { rating: 'neutral',        score: 2 }, // Fire corner — neutral
  'W':  { rating: 'neutral',        score: 2 }, // Acceptable for most families
  'S':  { rating: 'less_preferred', score: 1 }, // Yama direction
  'SW': { rating: 'less_preferred', score: 1 }, // Negative energy accumulation
};

export function classifyVastu(facingDirection: string | null | undefined): VastuAnalysis {
  const dir = normalizeClassifierText(facingDirection || '');
  const compact = dir.replace(/\s+/g, '');
  const tokens = dir.split(' ').filter(Boolean);

  const directionAliases: Array<[keyof typeof VASTU_MAP, string[], string]> = [
    ['NE', ['NORTHEAST', 'NORTH EAST', 'NE'], 'Northeast'],
    ['NW', ['NORTHWEST', 'NORTH WEST', 'NW'], 'Northwest'],
    ['SE', ['SOUTHEAST', 'SOUTH EAST', 'SE'], 'Southeast'],
    ['SW', ['SOUTHWEST', 'SOUTH WEST', 'SW'], 'Southwest'],
    ['E', ['EAST', 'E'], 'East'],
    ['N', ['NORTH', 'N'], 'North'],
    ['W', ['WEST', 'W'], 'West'],
    ['S', ['SOUTH', 'S'], 'South'],
  ];

  for (const [card, aliases, dirLabel] of directionAliases) {
    const match = aliases.some((alias) => {
      const normalizedAlias = alias.replace(/\s+/g, '');
      if (compact === normalizedAlias) return true;
      if (dir === alias) return true;
      return alias.length > 1 && tokens.includes(alias);
    });

    if (!match) continue;

    const { rating, score } = VASTU_MAP[card];
    const compliant = score >= 3;
    return {
      entranceDirection: dirLabel,
      rating,
      compliant,
      details: `${dirLabel}-facing entrance — ${rating === 'excellent' ? 'Excellent' : rating === 'good' ? 'Good' : rating === 'neutral' ? 'Neutral' : 'Less preferred'} Vastu orientation`,
      score,
    };
  }

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
  const lu = normalizeClassifierText(landUse);
  if (!lu) return null;
  if (lu.includes('POOL') || lu.includes('SWIMMING')) return 'pool';
  if (lu.includes('SCHOOL') || lu.includes('NURSERY') || lu.includes('KINDERGARTEN')) return 'school';
  if (lu.includes('MOSQUE') || lu.includes('MASJID')) return 'mosque';
  if (lu.includes('MALL') || lu.includes('SHOPPING')) return 'mall';
  if (matchesAny(lu, PLAYGROUND_TERMS)) return 'playground';
  if (matchesAny(lu, ENTRANCE_TERMS)) return 'community_center';
  if (matchesAny(lu, COMMUNITY_CENTER_TERMS)) return 'community_center';
  if (lu.includes('HOSPITAL') || lu.includes('CLINIC') || lu.includes('HEALTH')) return 'healthcare';
  if (lu.includes('RETAIL') || lu.includes('COMMERCIAL') || lu.includes('SHOP')) return 'retail';
  if (matchesAny(lu, PARK_TERMS)) return 'park';
  if (matchesAny(lu, ROAD_TERMS)) return 'road';
  if (matchesAny(lu, RESIDENTIAL_TERMS)) return 'residential';
  if (matchesAny(lu, LANDSCAPE_TERMS)) return 'open_space';
  if (matchesAny(lu, OPEN_SPACE_TERMS)) return 'open_space';
  return null;
}

export function isParkFacingLandUse(landUse: string): boolean {
  const lu = normalizeClassifierText(landUse);
  if (!lu) return false;
  return matchesAny(lu, PARK_TERMS) || matchesAny(lu, PLAYGROUND_TERMS);
}

export function isEntranceLandUse(landUse: string): boolean {
  const lu = normalizeClassifierText(landUse);
  if (!lu) return false;
  return matchesAny(lu, ENTRANCE_TERMS);
}
