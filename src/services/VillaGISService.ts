import { supabase } from '@/integrations/supabase/client';
import { gisService } from './DDAGISService';
import type { PlotData } from './DDAGISService';
import { propertyIntelligence } from './property-intelligence/engine';
import { Geo, type Polygon, type Edge } from './property-intelligence/geometry';

/**
 * VillaGISService — Links villa records to GIS/DDA land data
 * and provides spatial search capabilities for the villa intelligence platform.
 *
 * Uses PropertyIntelligenceEngine with polygon boundary-sharing for accurate
 * corner/layout/back-facing detection when GIS geometry is available.
 */

export interface VillaGISEnriched {
  villaId: string;
  plotNumber: string | null;
  gisPlot: PlotData | null;
  nearbyPlots: PlotData[];
  urbanContext: UrbanContextResult | null;
  distanceToAmenities: AmenityDistance[];
}

export interface UrbanContextResult {
  utilities: { type: string; distance: string; impact: string; detail: string }[];
  greenSpaces: { name: string; type: string; distance: string; impact: string }[];
  streetFacing: { plotType: string; roadWidth: string; frontage: string; streetHierarchy: string; insight: string };
  viewOrientation: { facing: string; direction: string; impact: string; premiumEstimate: string };
  urbanScore: { overall: number; greenSpace: number; roadAccess: number; infrastructureImpact: number; amenities: number; walkability: number };
  positiveSignals: string[];
  negativeSignals: string[];
  valueImpact: { factor: string; impact: string; detail: string }[];
  aiInsight: string;
}

export interface AmenityDistance {
  type: string;
  name: string;
  distanceMeters: number;
  coordinates: [number, number];
}

interface ClassifiedNearbyPlot {
  plot: PlotData;
  kind: 'residential' | 'road' | 'park' | 'pool' | 'school' | 'community' | 'open' | 'other';
  polygon: Polygon | null;
  edges: Edge[];
  pointDistance: number;
}

// Haversine distance in meters
function haversineDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371000;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function normalizePlotCoordinates(lat: number | null | undefined, lng: number | null | undefined): { lat: number; lng: number } | null {
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  if (lat! > 50 && lng! < 30) return { lat: lng!, lng: lat! };
  return { lat: lat!, lng: lng! };
}

function extractPolygon(plot: PlotData): Polygon | null {
  const geom = (plot.rawAttributes as Record<string, unknown>)?.geometry as { rings?: number[][][] } | undefined;
  if (!geom?.rings?.[0] || geom.rings[0].length < 3) return null;
  return geom.rings[0].map((coord) => [coord[0], coord[1]] as [number, number]);
}

function classifyPlotKind(plot: PlotData): ClassifiedNearbyPlot['kind'] {
  const landUse = (plot.landUseDetails || plot.zoning || '').toUpperCase();
  if (landUse.includes('ROAD') || landUse.includes('STREET') || landUse.includes('HIGHWAY') || landUse.includes('SERVICE')) return 'road';
  if (landUse.includes('PARK') || landUse.includes('GARDEN') || landUse.includes('GREEN') || landUse.includes('LANDSCAPE')) return 'park';
  if (landUse.includes('POOL') || landUse.includes('SWIMMING')) return 'pool';
  if (landUse.includes('SCHOOL') || landUse.includes('NURSERY') || landUse.includes('KINDERGARTEN')) return 'school';
  if (landUse.includes('ENTRANCE') || landUse.includes('GATE') || landUse.includes('ENTRY') || landUse.includes('ACCESS')) return 'community';
  if (landUse.includes('COMMUNITY') || landUse.includes('CLUB') || landUse.includes('CENTER') || landUse.includes('CENTRE')) return 'community';
  if (landUse.includes('OPEN') || landUse.includes('VACANT') || landUse.includes('EMPTY')) return 'open';
  if (landUse.includes('VILLA') || landUse.includes('RESIDENTIAL') || landUse.includes('TOWNHOUSE') || landUse.includes('HOUSE')) return 'residential';
  return 'other';
}

function getFrontBearing(facingDirection?: string | null): number | null {
  const normalized = (facingDirection || '').toUpperCase().replace(/[^A-Z]/g, '');
  if (!normalized) return null;
  if (normalized.includes('NORTHEAST') || normalized === 'NE') return 45;
  if (normalized.includes('NORTHWEST') || normalized === 'NW') return 315;
  if (normalized.includes('SOUTHEAST') || normalized === 'SE') return 135;
  if (normalized.includes('SOUTHWEST') || normalized === 'SW') return 225;
  if (normalized.includes('NORTH') || normalized === 'N') return 0;
  if (normalized.includes('EAST') || normalized === 'E') return 90;
  if (normalized.includes('SOUTH') || normalized === 'S') return 180;
  if (normalized.includes('WEST') || normalized === 'W') return 270;
  return null;
}

class VillaGISService {
  /**
   * Fetch GIS plot data for a villa's plot number
   */
  async enrichVillaWithGIS(plotNumber: string): Promise<PlotData | null> {
    if (!plotNumber) return null;
    try {
      return await gisService.fetchPlotById(plotNumber);
    } catch (e) {
      console.error('Villa GIS enrichment failed:', e);
      return null;
    }
  }

  /**
   * Search GIS plots within a radius of given coordinates
   */
  async searchNearbyPlots(lat: number, lng: number, radiusMeters: number = 500): Promise<PlotData[]> {
    try {
      return await gisService.searchByLocation(lat, lng, radiusMeters);
    } catch (e) {
      console.error('Nearby plot search failed:', e);
      return [];
    }
  }

  /**
   * Search villas within a radius of given coordinates
   */
  async searchVillasNearLocation(lat: number, lng: number, radiusMeters: number = 500): Promise<string[]> {
    const { data: villas } = await supabase
      .from('community_villas')
      .select('id, villa_number, latitude, longitude')
      .not('latitude', 'is', null)
      .not('longitude', 'is', null)
      .limit(1000);

    if (!villas) return [];

    return villas
      .filter((villa) => {
        const coords = normalizePlotCoordinates(villa.latitude, villa.longitude);
        if (!coords) return false;
        const dist = haversineDistance(lat, lng, coords.lat, coords.lng);
        return dist <= radiusMeters;
      })
      .sort((a, b) => {
        const coordA = normalizePlotCoordinates(a.latitude, a.longitude);
        const coordB = normalizePlotCoordinates(b.latitude, b.longitude);
        const dA = coordA ? haversineDistance(lat, lng, coordA.lat, coordA.lng) : Number.POSITIVE_INFINITY;
        const dB = coordB ? haversineDistance(lat, lng, coordB.lat, coordB.lng) : Number.POSITIVE_INFINITY;
        return dA - dB;
      })
      .map((villa) => villa.id);
  }

  /**
   * Calculate distances between a villa and nearby amenity-type plots
   */
  calculateAmenityDistances(villaLat: number, villaLng: number, nearbyPlots: PlotData[]): AmenityDistance[] {
    const amenities: AmenityDistance[] = [];

    for (const plot of nearbyPlots) {
      const landUse = (plot.landUseDetails || plot.zoning || '').toUpperCase();
      let type: string | null = null;

      if (landUse.includes('PARK') || landUse.includes('GARDEN') || landUse.includes('GREEN')) type = 'Park';
      else if (landUse.includes('SCHOOL') || landUse.includes('NURSERY')) type = 'School';
      else if (landUse.includes('MOSQUE') || landUse.includes('MASJID')) type = 'Mosque';
      else if (landUse.includes('HOSPITAL') || landUse.includes('CLINIC')) type = 'Healthcare';
      else if (landUse.includes('RETAIL') || landUse.includes('COMMERCIAL')) type = 'Retail';
      else if (landUse.includes('POOL') || landUse.includes('SWIMMING')) type = 'Pool';
      else if (landUse.includes('COMMUNITY')) type = 'Community Center';

      if (type) {
        const coordinates = normalizePlotCoordinates(plot.y, plot.x);
        if (!coordinates) continue;

        const dist = haversineDistance(villaLat, villaLng, coordinates.lat, coordinates.lng);
        amenities.push({
          type,
          name: plot.landUseDetails || plot.location || `Plot ${plot.id}`,
          distanceMeters: Math.round(dist),
          coordinates: [coordinates.lat, coordinates.lng],
        });
      }
    }

    return amenities.sort((a, b) => a.distanceMeters - b.distanceMeters);
  }

  /**
   * Run AI urban context analysis for a villa/plot
   */
  async analyzeUrbanContext(selectedPlot: Record<string, unknown>, nearbyPlots: Record<string, unknown>[]): Promise<UrbanContextResult | null> {
    try {
      const { data, error } = await supabase.functions.invoke('urban-context', {
        body: { selectedPlot, nearbyPlots },
      });

      if (error) {
        console.error('Urban context analysis error:', error);
        return null;
      }

      return data as UrbanContextResult;
    } catch (e) {
      console.error('Urban context failed:', e);
      return null;
    }
  }

  /**
   * Detect villa position using polygon boundary-sharing (HTML PIEngine approach).
   *
   * The detection first identifies the villa's actual parcel using polygon containment /
   * polygon distance, then runs property-intelligence against a broader local context so
   * radius searches still classify villas correctly near the edge of the search circle.
   */
  detectVillaPositionSync(villaLat: number, villaLng: number, nearbyPlots: PlotData[], facingDirection?: string | null): {
    isCorner: boolean;
    isSingleRow: boolean;
    backsPark: boolean;
    backsRoad: boolean;
    nearPool: boolean;
    nearSchool: boolean;
    nearEntrance: boolean;
  } {
    const result = {
      isCorner: false,
      isSingleRow: false,
      backsPark: false,
      backsRoad: false,
      nearPool: false,
      nearSchool: false,
      nearEntrance: false,
    };

    if (nearbyPlots.length === 0) return result;

    const villaPoint: [number, number] = [villaLng, villaLat];
    const frontBearing = getFrontBearing(facingDirection);

    const classified = nearbyPlots.map((plot) => {
      const polygon = extractPolygon(plot);
      const coords = normalizePlotCoordinates(plot.y, plot.x);
      const pointDistance = polygon
        ? Geo.distancePointToPolygonM(villaPoint, polygon)
        : coords
          ? haversineDistance(villaLat, villaLng, coords.lat, coords.lng)
          : Number.POSITIVE_INFINITY;

      return {
        plot,
        kind: classifyPlotKind(plot),
        polygon,
        edges: polygon ? Geo.edges(polygon) : [],
        pointDistance,
      } satisfies ClassifiedNearbyPlot;
    }).filter((item) => Number.isFinite(item.pointDistance));

    if (classified.length === 0) return result;

    const residentialCandidates = classified
      .filter((item) => item.kind === 'residential')
      .sort((a, b) => a.pointDistance - b.pointDistance);

    const containingResidential = residentialCandidates.find((item) => item.polygon && Geo.pointInPolygon(villaPoint, item.polygon));
    const closestResidential = residentialCandidates.find((item) => item.pointDistance <= 20)
      ?? residentialCandidates.find((item) => item.pointDistance <= 40)
      ?? residentialCandidates[0];

    const villaPlotMatch = containingResidential ?? closestResidential;
    const villaPlot = villaPlotMatch?.plot ?? null;

    const contextPlots = classified
      .filter((item) => item.pointDistance <= 220 || item.kind === 'road' || item.kind === 'park' || item.kind === 'community')
      .map((item) => item.plot);

    if (villaPlot) {
      const { layout, amenities } = propertyIntelligence.analyzeWithPolygons(
        villaPlot,
        contextPlots.filter((plot) => plot.id !== villaPlot.id),
        facingDirection,
      );

      result.isCorner = layout.positionType === 'corner';
      result.isSingleRow = layout.layoutType === 'single_row';
      result.backsRoad = layout.backFacing === 'road';
      result.backsPark = layout.backFacing === 'park' || layout.backFacing === 'open_space';

      const villaPolygon = villaPlotMatch?.polygon ?? null;
      const villaEdges = villaPlotMatch?.edges ?? [];
      if (villaPolygon && villaEdges.length > 0) {
        const touchedRoadEdges = new Set<number>();
        const touchedParkEdges = new Set<number>();
        const backTouchedRoadEdges = new Set<number>();
        const backTouchedParkEdges = new Set<number>();
        const backEdges = frontBearing === null
          ? villaEdges
          : villaEdges.filter((edge) => Geo.sideFB(Geo.bearingFrom(Geo.centroid(villaPolygon), edge.mid), frontBearing) === 'back');

        for (const [edgeIndex, villaEdge] of villaEdges.entries()) {
          const onBackSide = backEdges.includes(villaEdge);

          for (const item of classified) {
            if (item.plot.id === villaPlot.id || item.edges.length === 0) continue;
            const touching = item.edges.some((edge) => Geo.sharesBoundary([villaEdge], [edge], 12));
            if (!touching) continue;

            if (item.kind === 'road') {
              touchedRoadEdges.add(edgeIndex);
              if (onBackSide) backTouchedRoadEdges.add(edgeIndex);
            }
            if (item.kind === 'park' || item.kind === 'open' || item.kind === 'community' || item.kind === 'pool') {
              touchedParkEdges.add(edgeIndex);
              if (onBackSide) backTouchedParkEdges.add(edgeIndex);
            }
          }
        }

        if (touchedRoadEdges.size >= 2) result.isCorner = true;
        if (backTouchedRoadEdges.size > 0) result.backsRoad = true;
        if (backTouchedParkEdges.size > 0) result.backsPark = true;
        if (backTouchedRoadEdges.size > 0 || backTouchedParkEdges.size > 0) result.isSingleRow = true;
      }

      for (const amenity of amenities) {
        if (amenity.type === 'pool' && amenity.distanceMeters <= 220) result.nearPool = true;
        if (amenity.type === 'school' && amenity.distanceMeters <= 500) result.nearSchool = true;
        if ((amenity.type === 'park' || amenity.type === 'community_center') && amenity.distanceMeters <= 140) result.backsPark = true;
      }
    } else {
      const layout = propertyIntelligence.analyzeLayout(villaLat, villaLng, contextPlots);
      result.isCorner = layout.positionType === 'corner';
      result.isSingleRow = layout.layoutType === 'single_row';
      result.backsRoad = layout.backFacing === 'road';
      result.backsPark = layout.backFacing === 'park' || layout.backFacing === 'open_space';
    }

    const amenities = this.calculateAmenityDistances(villaLat, villaLng, contextPlots);
    for (const amenity of amenities) {
      if (amenity.type === 'Park' && amenity.distanceMeters <= 140) result.backsPark = true;
      if (amenity.type === 'Pool' && amenity.distanceMeters <= 220) result.nearPool = true;
      if (amenity.type === 'School' && amenity.distanceMeters <= 500) result.nearSchool = true;
      if ((amenity.type === 'Community Center' || amenity.name.toLowerCase().includes('gate') || amenity.name.toLowerCase().includes('entrance')) && amenity.distanceMeters <= 160) {
        result.nearEntrance = true;
      }
    }

    return result;
  }

  /**
   * Async wrapper for detectVillaPositionSync
   */
  async detectVillaPosition(villaLat: number, villaLng: number, nearbyPlots: PlotData[], facingDirection?: string | null) {
    return this.detectVillaPositionSync(villaLat, villaLng, nearbyPlots, facingDirection);
  }
}

export const villaGISService = new VillaGISService();
