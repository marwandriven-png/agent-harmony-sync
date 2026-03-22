import { haversineDistance } from '@/lib/geo';
import type { CommunityVilla } from '@/hooks/useVillas';
import { getVillaPlotKey } from '@/services/property-intelligence/unit-reference';

export interface SearchCenterPoint {
  lat: number;
  lng: number;
}

export function resolveVillaSearchCoordinates(
  villa: CommunityVilla,
  plotCoordinateLookup?: Map<string, SearchCenterPoint>,
): SearchCenterPoint | null {
  const plotKey = getVillaPlotKey(villa);
  if (plotKey) {
    const plotCoords = plotCoordinateLookup?.get(plotKey);
    if (plotCoords) return plotCoords;
  }

  if (villa.latitude != null && villa.longitude != null) {
    return { lat: villa.latitude, lng: villa.longitude };
  }

  return null;
}

export function isWithinSearchRadius(
  coords: SearchCenterPoint | null,
  center: SearchCenterPoint | null | undefined,
  radiusMeters: number,
): boolean {
  if (!center) return true;
  if (!coords) return false;

  return haversineDistance(center.lat, center.lng, coords.lat, coords.lng) <= radiusMeters;
}

export function isVillaWithinSearchRadius(
  villa: CommunityVilla,
  center: SearchCenterPoint | null | undefined,
  radiusMeters: number,
  plotCoordinateLookup?: Map<string, SearchCenterPoint>,
): boolean {
  return isWithinSearchRadius(
    resolveVillaSearchCoordinates(villa, plotCoordinateLookup),
    center,
    radiusMeters,
  );
}