/**
 * Natural Language query parser for property intelligence search.
 * Converts free-text queries into structured filter objects.
 */

import type { PISearchFilters, AmenityType } from './types';

const AMENITY_KEYWORDS: Record<string, AmenityType> = {
  pool: 'pool', swimming: 'pool',
  park: 'park', garden: 'park', green: 'park',
  play: 'playground', kids: 'playground', playground: 'playground',
  mall: 'mall', shopping: 'mall',
  school: 'school', nursery: 'school',
  mosque: 'mosque', masjid: 'mosque',
  community: 'community_center', clubhouse: 'community_center',
  hospital: 'healthcare', clinic: 'healthcare',
  retail: 'retail', shop: 'retail',
};

export function parseNaturalLanguageQuery(query: string): PISearchFilters {
  const s = query.toLowerCase().trim();
  const filters: PISearchFilters = {};

  // Layout type
  if (/single.?row/.test(s)) filters.layoutType = 'single_row';
  if (/back.?to.?back|b2b/.test(s)) filters.layoutType = 'back_to_back';

  // Position
  if (/\bcorner\b/.test(s)) filters.position = 'corner';
  if (/end.?unit/.test(s)) filters.position = 'end';

  // Back facing
  if (/backs?\s*park|park\s*back/.test(s)) filters.backFacing = 'park';
  if (/backs?\s*road|road\s*back|back\s*road/.test(s)) filters.backFacing = 'road';
  if (/open\s*(view|space|land)/.test(s)) filters.backFacing = 'open_space';

  // Vastu
  if (/vastu|east\s*fac/.test(s)) filters.vastuCompliant = true;

  // Amenity detection
  const detectedAmenities: AmenityType[] = [];
  for (const [keyword, type] of Object.entries(AMENITY_KEYWORDS)) {
    if (s.includes(keyword) && !detectedAmenities.includes(type)) {
      detectedAmenities.push(type);
    }
  }
  if (detectedAmenities.length > 0) {
    // Don't add 'park' as amenity if it's already a back-facing filter
    const filtered = filters.backFacing === 'park'
      ? detectedAmenities.filter(a => a !== 'park')
      : detectedAmenities;
    if (filtered.length > 0) filters.nearAmenity = filtered;
  }

  // Max distance override
  const distMatch = s.match(/(?:within|under|<)\s*(\d+)\s*m/);
  if (distMatch) filters.maxDistance = parseInt(distMatch[1]);

  // "Near" keyword implies amenity search
  if (/\bnear\b/.test(s) && !filters.nearAmenity?.length) {
    // Check if "near" is followed by an amenity-like word
    const nearMatch = s.match(/near\s+(\w+)/);
    if (nearMatch) {
      const word = nearMatch[1];
      const type = AMENITY_KEYWORDS[word];
      if (type) {
        filters.nearAmenity = [type];
      }
    }
  }

  return filters;
}

/**
 * Generate a human-readable description of parsed filters.
 */
export function describeFilters(filters: PISearchFilters): string[] {
  const parts: string[] = [];
  if (filters.layoutType === 'single_row') parts.push('Single Row');
  if (filters.layoutType === 'back_to_back') parts.push('Back-to-Back');
  if (filters.position === 'corner') parts.push('Corner');
  if (filters.position === 'end') parts.push('End Unit');
  if (filters.backFacing === 'park') parts.push('Backs Park');
  if (filters.backFacing === 'road') parts.push('Backs Road');
  if (filters.backFacing === 'open_space') parts.push('Open View');
  if (filters.vastuCompliant) parts.push('Vastu Compliant');
  if (filters.nearAmenity) {
    for (const a of filters.nearAmenity) {
      parts.push(`Near ${a.replace('_', ' ')}`);
    }
  }
  return parts;
}
