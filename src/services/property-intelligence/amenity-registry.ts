/**
 * Community Amenity Registry — GPS-accurate amenity positions per community.
 * Used as fallback when GIS plot data lacks amenity-typed features.
 */

import type { AmenityType, DetectedAmenity } from './types';
import { Geo } from './geometry';
import { classifyDistance } from './classifiers';
import { DEFAULT_THRESHOLDS, AMENITY_CONFIG } from './types';

export interface AmenityDef {
  id: string;
  type: AmenityType;
  name: string;
  lat: number;
  lng: number;
}

// ─── Community Amenity Data ───

export const COMMUNITY_AMENITIES: Record<string, AmenityDef[]> = {
  arabian_ranches_3: [
    { id: 'ar3-pool-main', type: 'pool', name: 'Main Pool', lat: 25.0635, lng: 55.2498 },
    { id: 'ar3-park-c', type: 'park', name: 'Central Park', lat: 25.0628, lng: 55.2502 },
    { id: 'ar3-park-n', type: 'park', name: 'North Garden', lat: 25.0648, lng: 55.2488 },
    { id: 'ar3-school', type: 'school', name: 'Ranches Primary', lat: 25.0645, lng: 55.2512 },
    { id: 'ar3-mosque', type: 'mosque', name: 'AR3 Mosque', lat: 25.0618, lng: 55.2505 },
    { id: 'ar3-play-a', type: 'playground', name: 'Kids Zone A', lat: 25.0622, lng: 55.2494 },
    { id: 'ar3-play-b', type: 'playground', name: 'Kids Zone B', lat: 25.0632, lng: 55.2478 },
    { id: 'ar3-club', type: 'community_center', name: 'Club House', lat: 25.0620, lng: 55.2470 },
  ],

  meadows: [
    { id: 'med-pool', type: 'pool', name: 'Village Pool', lat: 25.0698, lng: 55.1572 },
    { id: 'med-park-a', type: 'park', name: 'Meadows Park A', lat: 25.0688, lng: 55.1565 },
    { id: 'med-park-b', type: 'park', name: 'Meadows Lake', lat: 25.0682, lng: 55.1588 },
    { id: 'med-school', type: 'school', name: 'Meadows School', lat: 25.0705, lng: 55.1595 },
    { id: 'med-mosque', type: 'mosque', name: 'Meadows Mosque', lat: 25.0700, lng: 55.1578 },
    { id: 'med-club', type: 'community_center', name: 'Meadows Club', lat: 25.0695, lng: 55.1600 },
    { id: 'med-play', type: 'playground', name: 'Play Area', lat: 25.0690, lng: 55.1558 },
  ],

  mudon: [
    { id: 'mud-pool-a', type: 'pool', name: 'Mudon Pool A', lat: 25.0268, lng: 55.2672 },
    { id: 'mud-pool-b', type: 'pool', name: 'Mudon Pool B', lat: 25.0245, lng: 55.2640 },
    { id: 'mud-park-c', type: 'park', name: 'Al Rafeef Park', lat: 25.0258, lng: 55.2658 },
    { id: 'mud-school', type: 'school', name: 'Mudon School', lat: 25.0278, lng: 55.2690 },
    { id: 'mud-mosque', type: 'mosque', name: 'Mudon Mosque', lat: 25.0262, lng: 55.2678 },
    { id: 'mud-club', type: 'community_center', name: 'Mudon Clubhouse', lat: 25.0272, lng: 55.2685 },
    { id: 'mud-retail', type: 'retail', name: 'Mudon Retail', lat: 25.0282, lng: 55.2695 },
    { id: 'mud-play', type: 'playground', name: 'Play Zone A', lat: 25.0252, lng: 55.2650 },
  ],

  damac_hills: [
    { id: 'dh-pool', type: 'pool', name: 'Club Pool', lat: 25.0378, lng: 55.2328 },
    { id: 'dh-park', type: 'park', name: 'Central Gardens', lat: 25.0372, lng: 55.2318 },
    { id: 'dh-school', type: 'school', name: 'GEMS School', lat: 25.0392, lng: 55.2345 },
    { id: 'dh-mosque', type: 'mosque', name: 'DAMAC Hills Mosque', lat: 25.0358, lng: 55.2340 },
    { id: 'dh-club', type: 'community_center', name: 'The Clubhouse', lat: 25.0374, lng: 55.2320 },
    { id: 'dh-play', type: 'playground', name: 'Kids Academy', lat: 25.0368, lng: 55.2310 },
    { id: 'dh-retail', type: 'retail', name: 'Fitness Centre', lat: 25.0376, lng: 55.2325 },
  ],

  default: [
    { id: 'def-pool', type: 'pool', name: 'Community Pool', lat: 25.0635, lng: 55.2498 },
    { id: 'def-park', type: 'park', name: 'Community Park', lat: 25.0628, lng: 55.2502 },
    { id: 'def-mosque', type: 'mosque', name: 'Community Mosque', lat: 25.0618, lng: 55.2505 },
    { id: 'def-school', type: 'school', name: 'Community School', lat: 25.0645, lng: 55.2512 },
    { id: 'def-play', type: 'playground', name: 'Kids Play Area', lat: 25.0622, lng: 55.2494 },
  ],
};

/**
 * Pick the best amenity set for a given location by comparing
 * the centroid to each community's first amenity.
 */
export function resolveAmenityDefs(lat: number, lng: number): AmenityDef[] {
  let best: AmenityDef[] = COMMUNITY_AMENITIES.default;
  let bestDist = Infinity;

  for (const [key, amenities] of Object.entries(COMMUNITY_AMENITIES)) {
    if (key === 'default' || !amenities.length) continue;
    const d = Geo.haversineDistance(lat, lng, amenities[0].lat, amenities[0].lng);
    if (d < bestDist) { bestDist = d; best = amenities; }
  }

  return best;
}

/**
 * Convert community amenity defs into DetectedAmenity[] relative to a villa position.
 * Only returns amenities within maxDistance meters.
 */
export function detectCommunityAmenities(
  villaLat: number,
  villaLng: number,
  maxDistance: number = 600,
): DetectedAmenity[] {
  const defs = resolveAmenityDefs(villaLat, villaLng);
  const results: DetectedAmenity[] = [];

  for (const def of defs) {
    const dist = Math.round(Geo.haversineDistance(villaLat, villaLng, def.lat, def.lng));
    if (dist > maxDistance) continue;

    results.push({
      type: def.type,
      name: def.name,
      distanceMeters: dist,
      proximity: classifyDistance(dist, DEFAULT_THRESHOLDS),
      coordinates: [def.lat, def.lng],
      plotId: def.id,
      icon: AMENITY_CONFIG[def.type]?.emoji,
    });
  }

  return results.sort((a, b) => a.distanceMeters - b.distanceMeters);
}
