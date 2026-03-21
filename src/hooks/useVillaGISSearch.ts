import { haversineDistance as haversineM } from '@/lib/geo';
// Villa GIS Search Hook - v2
import { useState, useCallback } from 'react';
import { gisService, normalizeCoordinatesForSearch } from '@/services/DDAGISService';
import { villaGISService } from '@/services/VillaGISService';
import type { PlotData } from '@/services/DDAGISService';
import { toast } from 'sonner';

export interface GISSearchResult {
  plot: PlotData;
  source: 'gis-direct' | 'gis-area' | 'gis-location';
  confidenceScore: number;
  areaDeviation?: number;
  gfaDeviation?: number;
}

/**
 * Parse Google Maps URL or raw coordinates into lat/lng.
 * Supports formats:
 * - "25.1234, 55.5678"
 * - "https://maps.google.com/?q=25.1234,55.5678"
 * - "https://www.google.com/maps/@25.1234,55.5678,17z"
 * - "https://www.google.com/maps/place/.../@25.1234,55.5678,..."
 * - "...!3d25.1234!4d55.5678"
 */
function parseGoogleLocation(input: string): { lat: number; lng: number } | null {
  const trimmed = input.trim();
  if (!trimmed) return null;

  let decoded = trimmed;
  try {
    decoded = decodeURIComponent(trimmed);
  } catch {
    decoded = trimmed;
  }

  // Try raw coordinates "lat, lng"
  const rawMatch = decoded.match(/^(-?\d+\.?\d*)\s*[,\s]\s*(-?\d+\.?\d*)$/);
  if (rawMatch) {
    return { lat: parseFloat(rawMatch[1]), lng: parseFloat(rawMatch[2]) };
  }

  // Google Maps @lat,lng pattern
  const atMatch = decoded.match(/@(-?\d+\.?\d*),(-?\d+\.?\d*)/);
  if (atMatch) {
    return { lat: parseFloat(atMatch[1]), lng: parseFloat(atMatch[2]) };
  }

  // Google Maps ?q=lat,lng / ?ll=lat,lng / ?center=lat,lng pattern
  const qMatch = decoded.match(/[?&](?:q|ll|center)=(-?\d+\.?\d*)(?:%2C|,)\s*(-?\d+\.?\d*)/);
  if (qMatch) {
    return { lat: parseFloat(qMatch[1]), lng: parseFloat(qMatch[2]) };
  }

  // Google Maps /place/ pattern with coordinates
  const placeMatch = decoded.match(/\/place\/[^/]*\/@(-?\d+\.?\d*),(-?\d+\.?\d*)/);
  if (placeMatch) {
    return { lat: parseFloat(placeMatch[1]), lng: parseFloat(placeMatch[2]) };
  }

  // Google Maps /place/lat,lng pattern
  const placeDirectMatch = decoded.match(/\/place\/(-?\d+\.?\d*),(-?\d+\.?\d*)/);
  if (placeDirectMatch) {
    return { lat: parseFloat(placeDirectMatch[1]), lng: parseFloat(placeDirectMatch[2]) };
  }

  // Google Maps !3dlat!4dlng pattern
  const dataMatch = decoded.match(/!3d(-?\d+\.?\d*)!4d(-?\d+\.?\d*)/);
  if (dataMatch) {
    return { lat: parseFloat(dataMatch[1]), lng: parseFloat(dataMatch[2]) };
  }

  // Try any two decimal numbers in the string (last resort)
  const anyMatch = decoded.match(/(-?\d+\.\d+)[\s,]+(-?\d+\.\d+)/);
  if (anyMatch) {
    const lat = parseFloat(anyMatch[1]);
    const lng = parseFloat(anyMatch[2]);
    // Sanity check for UAE region
    if (lat > 20 && lat < 30 && lng > 50 && lng < 60) {
      return { lat, lng };
    }
    // Maybe they're swapped
    if (lng > 20 && lng < 30 && lat > 50 && lat < 60) {
      return { lat: lng, lng: lat };
    }
  }

  return null;
}

async function resolveGoogleLocation(input: string): Promise<{ lat: number; lng: number } | null> {
  const parsed = parseGoogleLocation(input);
  if (parsed) return parsed;

  const trimmed = input.trim();
  if (!/^https?:\/\//i.test(trimmed)) return null;

  try {
    const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/resolve-url`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ url: trimmed }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      if (errorData?.error === 'short_url') {
        throw new Error('Please open the short Google Maps link, copy the full URL from the browser, and paste it here.');
      }
      return null;
    }

    const data = await response.json();
    if (typeof data?.lat === 'number' && typeof data?.lng === 'number') {
      return { lat: data.lat, lng: data.lng };
    }

    return null;
  } catch (error) {
    console.warn('Location resolve failed:', error);
    if (error instanceof Error) throw error;
    return null;
  }
}

const TOLERANCE = 0.06; // ±6%


function isWithinTolerance(actual: number, target: number, tolerance: number): { match: boolean; deviation: number } {
  if (target === 0) return { match: true, deviation: 0 };
  const deviation = Math.abs(actual - target) / target;
  return { match: deviation <= tolerance, deviation };
}

export function useVillaGISSearch() {
  const [gisResults, setGisResults] = useState<GISSearchResult[]>([]);
  const [isSearching, setIsSearching] = useState<boolean>(false);
  const [gisVillaIds, setGisVillaIds] = useState<string[]>([]);
  const [resolvedCenter, setResolvedCenter] = useState<{ lat: number; lng: number } | null>(null);


  const searchGIS = useCallback(async (params: {
    community?: string;
    plotNumber?: string;
    googleLocation?: string;
    plotAreaSqm?: number;
    gfaSqm?: number;
    radiusMeters?: number;
  }) => {
    const { community, plotNumber, googleLocation, plotAreaSqm, gfaSqm, radiusMeters = 1000 } = params;
    if (!community && !plotNumber && !googleLocation) return;

    const contextRadiusMeters = Math.max(radiusMeters + 200, 250);

    setIsSearching(true);
    const results: GISSearchResult[] = [];
    const villaIds: string[] = [];
    let center: { lat: number; lng: number } | null = null;

    try {
      // 1. Direct plot number lookup + use as radius center
      if (plotNumber && /^\d+$/.test(plotNumber.trim())) {
        try {
          const plot = await gisService.fetchPlotById(plotNumber.trim());
          if (plot) {
            results.push({
              plot,
              source: 'gis-direct',
              confidenceScore: 100,
            });

            // Use plot coordinates as search center for radius mode
            if (plot.y && plot.x) {
              const normalizedCenter = normalizeCoordinatesForSearch(plot.y, plot.x);
              if (!normalizedCenter) {
                toast.error('Could not resolve plot coordinates for radius search');
              } else {
                center = normalizedCenter;

                // Search villas within the exact user radius
                const nearbyVillaIds = await villaGISService.searchVillasNearLocation(
                  normalizedCenter.lat,
                  normalizedCenter.lng,
                  radiusMeters,
                );
                for (const id of nearbyVillaIds) {
                  if (!villaIds.includes(id)) villaIds.push(id);
                }

                // Fetch broader surrounding GIS context for classification accuracy
                try {
                  const { plots: nearbyPlots } = await gisService.searchByLocationConsolidated(
                    normalizedCenter.lat,
                    normalizedCenter.lng,
                    contextRadiusMeters,
                  );
                  for (const np of nearbyPlots) {
                    if (!results.some((r) => r.plot.id === np.id)) {
                      results.push({
                        plot: np,
                        source: 'gis-location',
                        confidenceScore: 70,
                      });
                    }
                  }
                } catch { /* continue */ }
              }
            }
          }
        } catch { /* continue */ }
      }

      // 2. Community/project name search via GIS API
      if (community && community.trim().length > 0) {
        try {
          const minArea = plotAreaSqm && plotAreaSqm > 0 ? plotAreaSqm * (1 - TOLERANCE) : undefined;
          const maxArea = plotAreaSqm && plotAreaSqm > 0 ? plotAreaSqm * (1 + TOLERANCE) : undefined;
          const apiPlots = await gisService.searchByArea(minArea, maxArea, community.trim());

          for (const ap of apiPlots) {
            let confidenceScore = 60;
            let areaDev = 0;
            let gfaDev = 0;

            if (plotAreaSqm && plotAreaSqm > 0) {
              const check = isWithinTolerance(ap.area, plotAreaSqm, TOLERANCE);
              areaDev = check.deviation;
              if (!check.match) continue;
              confidenceScore += 20 * (1 - areaDev / TOLERANCE);
            }
            if (gfaSqm && gfaSqm > 0) {
              const check = isWithinTolerance(ap.gfa, gfaSqm, TOLERANCE);
              gfaDev = check.deviation;
              if (!check.match) continue;
              confidenceScore += 20 * (1 - gfaDev / TOLERANCE);
            }

            if (!results.some((r) => r.plot.id === ap.id)) {
              results.push({
                plot: ap,
                source: 'gis-area',
                confidenceScore: Math.min(100, Math.round(confidenceScore)),
                areaDeviation: parseFloat((areaDev * 100).toFixed(2)),
                gfaDeviation: parseFloat((gfaDev * 100).toFixed(2)),
              });
            }
          }
        } catch { /* continue */ }
      }

      // 3. Google location spatial search
      if (googleLocation && googleLocation.trim().length > 0) {
        try {
          const coords = await resolveGoogleLocation(googleLocation);
          if (coords) {
            center = coords;

            const { plots: nearbyPlots } = await gisService.searchByLocationConsolidated(
              coords.lat,
              coords.lng,
              contextRadiusMeters,
            );

            for (const np of nearbyPlots) {
              if (!results.some((r) => r.plot.id === np.id)) {
                results.push({
                  plot: np,
                  source: 'gis-location',
                  confidenceScore: 70,
                });
              }
            }

            const nearbyVillaIds = await villaGISService.searchVillasNearLocation(
              coords.lat,
              coords.lng,
              radiusMeters,
            );

            for (const id of nearbyVillaIds) {
              if (!villaIds.includes(id)) villaIds.push(id);
            }
          } else {
            toast.error('Could not parse coordinates from location input');
          }
        } catch (error) {
          const message = error instanceof Error ? error.message : 'Could not parse coordinates from location input';
          toast.error(message);
        }
      }

      // Filter results by actual user radius (context fetched broader for classification)
      if (center) {
        const filteredResults: GISSearchResult[] = [];
        for (const r of results) {
          if (r.source === 'gis-direct') {
            filteredResults.push(r); // Always keep direct plot matches
            continue;
          }
          const coords = normalizeCoordinatesForSearch(r.plot.y, r.plot.x);
          if (!coords) { filteredResults.push(r); continue; }
          const dist = haversineM(center.lat, center.lng, coords.lat, coords.lng);
          if (dist <= radiusMeters) {
            filteredResults.push(r);
          }
        }
        results.length = 0;
        results.push(...filteredResults);
      }

      results.sort((a, b) => b.confidenceScore - a.confidenceScore);

      // Exclude plots with zero or missing GFA — they have no buildable data
      const validResults = results.filter(r => r.plot.gfa != null && r.plot.gfa > 0);
      results.length = 0;
      results.push(...validResults);

      if (!center && results.length > 0) {
        const firstGeoPlot = results.find((result) => Number.isFinite(result.plot.y) && Number.isFinite(result.plot.x));
        if (firstGeoPlot) {
          center = normalizeCoordinatesForSearch(firstGeoPlot.plot.y, firstGeoPlot.plot.x);
        }
      }

      setGisResults(results);
      setGisVillaIds(villaIds);
      setResolvedCenter(center);

      if (results.length > 0 || villaIds.length > 0) {
        toast.success(`Found ${results.length} GIS plots${villaIds.length > 0 ? ` + ${villaIds.length} nearby villas` : ''}`);
      } else {
        toast.info('No GIS/DDA matches found for this search');
      }
    } catch (err) {
      console.error('GIS search error:', err);
      toast.error('GIS search failed');
    } finally {
      setIsSearching(false);
    }
  }, []);

  const clearGISResults = useCallback(() => {
    setGisResults([]);
    setGisVillaIds([]);
    setResolvedCenter(null);
  }, []);

  return {
    gisResults,
    gisVillaIds,
    isSearching,
    searchGIS,
    clearGISResults,
    resolvedCenter,
  };
}
