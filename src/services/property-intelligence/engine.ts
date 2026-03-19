/**
 * Core Property Intelligence Engine — classifies villas/townhouses
 * based on GIS plot layout, nearby amenities, and surrounding plots.
 * 
 * Features:
 * - Polygon boundary-sharing analysis for layout/position/back-facing
 * - Entrance direction inference from nearest road
 * - Community amenity registry fallback
 * - Internal caching with batch analyzeAll()
 * - Composite scoring via filter module
 */

import type { PlotData } from '../DDAGISService';
import type { CommunityVilla } from '@/hooks/useVillas';
import type {
  DetectedAmenity, LayoutAnalysis, LayoutType, PositionType, BackFacingType,
  SmartTag, AmenityType, ProximityThresholds,
} from './types';
import { DEFAULT_THRESHOLDS, AMENITY_CONFIG } from './types';
import { classifyDistance, classifyVastu, classifyLandUse } from './classifiers';
import { Geo, type Polygon, type Edge } from './geometry';
import { detectCommunityAmenities } from './amenity-registry';

// ─── Helpers to extract polygon from GIS PlotData ───

const DIRECTION_BEARINGS: Record<string, number> = {
  N: 0, NE: 45, E: 90, SE: 135, S: 180, SW: 225, W: 270, NW: 315,
};

function parseFrontBearing(facingDirection?: string | null): number | null {
  const normalized = (facingDirection || '').toUpperCase().replace(/[^A-Z]/g, '');
  if (!normalized) return null;
  if (normalized.includes('NORTHEAST') || normalized === 'NE') return DIRECTION_BEARINGS.NE;
  if (normalized.includes('NORTHWEST') || normalized === 'NW') return DIRECTION_BEARINGS.NW;
  if (normalized.includes('SOUTHEAST') || normalized === 'SE') return DIRECTION_BEARINGS.SE;
  if (normalized.includes('SOUTHWEST') || normalized === 'SW') return DIRECTION_BEARINGS.SW;
  if (normalized.includes('NORTH') || normalized === 'N') return DIRECTION_BEARINGS.N;
  if (normalized.includes('EAST') || normalized === 'E') return DIRECTION_BEARINGS.E;
  if (normalized.includes('SOUTH') || normalized === 'S') return DIRECTION_BEARINGS.S;
  if (normalized.includes('WEST') || normalized === 'W') return DIRECTION_BEARINGS.W;
  return null;
}

/** Extract [lng, lat][] polygon from a PlotData's rawAttributes.geometry.rings */
function extractPolygon(plot: PlotData): Polygon | null {
  const geom = (plot.rawAttributes as Record<string, unknown>)?.geometry as
    { rings?: number[][][] } | undefined;
  if (!geom?.rings?.[0] || geom.rings[0].length < 3) return null;
  return geom.rings[0].map(c => [c[0], c[1]] as [number, number]);
}

/** Get centroid as [lng, lat] from plot — from polygon if available, else from x/y */
function plotCentroid(plot: PlotData): [number, number] | null {
  const poly = extractPolygon(plot);
  if (poly) return Geo.centroid(poly);
  if (plot.x && plot.y) {
    let lat = plot.y, lng = plot.x;
    if (lat > 50 && lng < 30) [lat, lng] = [lng, lat];
    return [lng, lat];
  }
  return null;
}

/**
 * Infer entrance direction from nearest road polygon when facingDirection is not set.
 */
function inferEntranceFromRoads(
  villaCentroid: [number, number],
  roads: ClassifiedPlot[],
): number | null {
  if (roads.length === 0) return null;

  let bestDist = Infinity;
  let bestBearing = 0;

  for (const road of roads) {
    const d = Geo.distanceM(villaCentroid, road.centroid);
    if (d < bestDist) {
      bestDist = d;
      bestBearing = Geo.bearingFrom(villaCentroid, road.centroid);
    }
  }

  // Only infer if there's a road reasonably close (< 80m)
  return bestDist < 80 ? bestBearing : null;
}

interface ClassifiedPlot {
  plot: PlotData;
  kind: string;
  polygon: Polygon | null;
  edges: Edge[];
  centroid: [number, number];
}

// ─── Analysis Cache Entry ───

interface CachedAnalysis {
  layout: LayoutAnalysis;
  amenities: DetectedAmenity[];
  tags: string[];
}

export class PropertyIntelligenceEngine {

  private boundaryTolerance = 12;
  private cache = new Map<string, CachedAnalysis>();

  /** Clear the analysis cache (call when community/GIS data changes) */
  clearCache(): void {
    this.cache.clear();
  }

  // ─── Full Analysis (polygon-aware) ───

  analyzeWithPolygons(
    villaPlot: PlotData,
    nearbyPlots: PlotData[],
    facingDirection?: string | null,
  ): CachedAnalysis {
    // Check cache
    const cacheKey = villaPlot.id;
    if (this.cache.has(cacheKey)) return this.cache.get(cacheKey)!;

    const villaPolygon = extractPolygon(villaPlot);
    const villaCentroid = plotCentroid(villaPlot);
    if (!villaCentroid) {
      return { layout: this._emptyLayout(), amenities: [], tags: [] };
    }

    // Classify all nearby plots
    const classified = this._classifyPlots(nearbyPlots);
    const roads = classified.filter(c => c.kind === 'road');
    const parks = classified.filter(c => c.kind === 'park');
    const openSpaces = classified.filter(c => ['open_space', 'community_center'].includes(c.kind));
    const residential = classified.filter(c => c.kind === 'residential');

    // Entrance bearing: explicit > inferred from roads > null
    let fb = parseFrontBearing(facingDirection);
    if (fb === null) {
      fb = inferEntranceFromRoads(villaCentroid, roads);
    }

    const villaEdges = villaPolygon ? Geo.edges(villaPolygon) : [];

    // --- POSITION: Corner detection ---
    let positionType: PositionType = 'middle';

    if (villaPolygon && villaEdges.length > 0) {
      const roadSides = new Set<string>();
      for (const road of roads) {
        if (road.edges.length === 0) continue;
        for (const vEdge of villaEdges) {
          for (const rEdge of road.edges) {
            if (Geo.distanceM(vEdge.mid, rEdge.mid) < this.boundaryTolerance) {
              if (fb !== null) {
                roadSides.add(Geo.sideFB(Geo.bearingFrom(villaCentroid, vEdge.mid), fb));
              } else {
                const bearing = Geo.bearingFrom(villaCentroid, vEdge.mid);
                roadSides.add(String(Math.floor(((bearing + 45) % 360) / 90)));
              }
            }
          }
        }
      }
      if (roadSides.size >= 2) {
        positionType = 'corner';
      } else {
        const resBoundaryCount = residential.filter(r =>
          r.edges.length > 0 && Geo.sharesBoundary(villaEdges, r.edges, this.boundaryTolerance)
        ).length;
        positionType = resBoundaryCount <= 1 ? 'corner' : 'middle';
      }
    } else {
      positionType = this._positionByCentroid(villaCentroid, classified, fb);
    }

    // --- LAYOUT: back-to-back vs single-row ---
    let layoutType: LayoutType = 'unknown';
    let backFacing: BackFacingType = 'unknown';

    if (villaPolygon && villaEdges.length > 0) {
      const backEdges = this._getBackEdges(villaEdges, villaCentroid, fb);

      const backsResidential = residential.some(r =>
        r.edges.length > 0 && Geo.sharesBoundary(backEdges, r.edges, this.boundaryTolerance)
      );
      const backsRoad = roads.some(r =>
        r.edges.length > 0 && Geo.sharesBoundary(backEdges, r.edges, this.boundaryTolerance)
      );
      const backsPark = parks.some(r =>
        r.edges.length > 0 && Geo.sharesBoundary(backEdges, r.edges, this.boundaryTolerance)
      );
      const backsOpen = openSpaces.some(r =>
        r.edges.length > 0 && Geo.sharesBoundary(backEdges, r.edges, this.boundaryTolerance)
      );

      layoutType = (backsResidential && !backsRoad && !backsPark && !backsOpen)
        ? 'back_to_back' : 'single_row';

      if (backsRoad) backFacing = 'road';
      else if (backsPark) backFacing = 'park';
      else if (backsOpen) backFacing = 'open_space';
      else if (backsResidential) backFacing = 'villa';
      else backFacing = 'community_edge';
    } else {
      const fallback = this._layoutByCentroid(villaCentroid, classified, fb);
      layoutType = fallback.layoutType;
      backFacing = fallback.backFacing;
    }

    // --- AMENITIES: GIS plots + community registry fallback ---
    const gisAmenities = this.detectAmenities(villaCentroid[1], villaCentroid[0], nearbyPlots);
    const registryAmenities = detectCommunityAmenities(villaCentroid[1], villaCentroid[0]);

    // Merge: prefer GIS amenities by type, add registry ones that aren't covered
    const coveredTypes = new Set(gisAmenities.map(a => a.type));
    const mergedAmenities = [
      ...gisAmenities,
      ...registryAmenities.filter(a => !coveredTypes.has(a.type)),
    ].sort((a, b) => a.distanceMeters - b.distanceMeters);

    // --- SMART TAGS ---
    const tags: string[] = [];
    if (layoutType === 'single_row') tags.push('Single Row');
    if (layoutType === 'back_to_back') tags.push('Back-to-Back');
    if (positionType === 'corner') tags.push('Corner');
    if (positionType === 'end') tags.push('End Unit');
    if (backFacing === 'road') tags.push('Backs Road');
    if (backFacing === 'park') tags.push('Backs Park');
    if (backFacing === 'open_space') tags.push('Backs Open Land');

    const layout: LayoutAnalysis = {
      layoutType,
      positionType,
      backFacing,
      adjacentResidentialCount: residential.filter(r =>
        r.edges.length > 0 && villaEdges.length > 0
          ? Geo.sharesBoundary(villaEdges, r.edges, this.boundaryTolerance)
          : Geo.distanceM(villaCentroid, r.centroid) < 35
      ).length,
      adjacentRoadCount: roads.filter(r =>
        Geo.distanceM(villaCentroid, r.centroid) < 60
      ).length,
      adjacentParkCount: parks.filter(r =>
        Geo.distanceM(villaCentroid, r.centroid) < 100
      ).length,
    };

    const result: CachedAnalysis = { layout, amenities: mergedAmenities, tags };
    this.cache.set(cacheKey, result);
    return result;
  }

  // ─── Classify nearby plots ───

  private _classifyPlots(plots: PlotData[]): ClassifiedPlot[] {
    const result: ClassifiedPlot[] = [];
    for (const plot of plots) {
      const kind = classifyLandUse(plot.landUseDetails || plot.zoning || '');
      if (!kind) continue;
      const centroid = plotCentroid(plot);
      if (!centroid) continue;
      const polygon = extractPolygon(plot);
      const edges = polygon ? Geo.edges(polygon) : [];
      result.push({ plot, kind, polygon, edges, centroid });
    }
    return result;
  }

  // ─── Get back edges of a polygon ───

  private _getBackEdges(villaEdges: Edge[], centroid: [number, number], fb: number | null): Edge[] {
    if (fb === null) return villaEdges;
    const backEdges = villaEdges.filter(e =>
      Geo.sideFB(Geo.bearingFrom(centroid, e.mid), fb) === 'back'
    );
    return backEdges.length > 0 ? backEdges : villaEdges;
  }

  // ─── Centroid-based fallbacks ───

  private _positionByCentroid(
    villaCentroid: [number, number],
    classified: ClassifiedPlot[],
    fb: number | null,
  ): PositionType {
    const roads = classified.filter(c => c.kind === 'road' && Geo.distanceM(villaCentroid, c.centroid) < 75);
    const residential = classified.filter(c => c.kind === 'residential' && Geo.distanceM(villaCentroid, c.centroid) < 38);

    const roadBearings = roads.map(r => Geo.bearingFrom(villaCentroid, r.centroid));
    const hasSeparatedRoads = roadBearings.some((b1, i) =>
      roadBearings.slice(i + 1).some(b2 => {
        const diff = Math.abs(b1 - b2) % 360;
        return (diff > 180 ? 360 - diff : diff) >= 55;
      })
    );

    if (hasSeparatedRoads && roads.length >= 2) return 'corner';

    const edgePlots = classified.filter(c =>
      ['road', 'park', 'open_space'].includes(c.kind) && Geo.distanceM(villaCentroid, c.centroid) < 80
    );
    const edgeBearings = edgePlots.map(r => Geo.bearingFrom(villaCentroid, r.centroid));
    const hasSeparatedEdges = edgeBearings.some((b1, i) =>
      edgeBearings.slice(i + 1).some(b2 => {
        const diff = Math.abs(b1 - b2) % 360;
        return (diff > 180 ? 360 - diff : diff) >= 55;
      })
    );
    const resQuadrants = new Set(residential.map(r => {
      const b = Geo.bearingFrom(villaCentroid, r.centroid);
      return Math.floor(((b + 45) % 360) / 90);
    }));

    if (edgePlots.length >= 2 && hasSeparatedEdges && resQuadrants.size <= 1) return 'corner';
    if (residential.length <= 1) return 'end';
    return 'middle';
  }

  private _layoutByCentroid(
    villaCentroid: [number, number],
    classified: ClassifiedPlot[],
    fb: number | null,
  ): { layoutType: LayoutType; backFacing: BackFacingType } {
    const rearPlots = fb === null
      ? classified.filter(c => {
          const d = Geo.distanceM(villaCentroid, c.centroid);
          return d >= 20 && d <= 65;
        })
      : classified.filter(c => {
          const d = Geo.distanceM(villaCentroid, c.centroid);
          if (d < 18 || d > 75) return false;
          const bearing = Geo.bearingFrom(villaCentroid, c.centroid);
          return Geo.sideFB(bearing, fb) === 'back';
        });

    const rearRes = rearPlots.some(c => c.kind === 'residential');
    const rearRoad = rearPlots.some(c => c.kind === 'road');
    const rearPark = rearPlots.some(c => c.kind === 'park');
    const rearOpen = rearPlots.some(c => c.kind === 'open_space');

    const layoutType: LayoutType = (rearRes && !rearRoad && !rearPark && !rearOpen)
      ? 'back_to_back' : 'single_row';

    let backFacing: BackFacingType = 'unknown';
    if (rearRoad) backFacing = 'road';
    else if (rearPark) backFacing = 'park';
    else if (rearOpen) backFacing = 'open_space';
    else if (rearRes) backFacing = 'villa';
    else backFacing = 'community_edge';

    return { layoutType, backFacing };
  }

  private _emptyLayout(): LayoutAnalysis {
    return {
      layoutType: 'unknown',
      positionType: 'unknown',
      backFacing: 'unknown',
      adjacentResidentialCount: 0,
      adjacentRoadCount: 0,
      adjacentParkCount: 0,
    };
  }

  // ─── Amenity Detection (GIS-based) ───

  detectAmenities(
    villaLat: number, villaLng: number,
    nearbyPlots: PlotData[],
    thresholds: ProximityThresholds = DEFAULT_THRESHOLDS,
  ): DetectedAmenity[] {
    const amenities: DetectedAmenity[] = [];

    for (const plot of nearbyPlots) {
      const landUse = plot.landUseDetails || plot.zoning || '';
      const classification = classifyLandUse(landUse);
      if (!classification || classification === 'residential' || classification === 'road' || classification === 'open_space') continue;

      const amenityType = classification as AmenityType;

      if (plot.y && plot.x) {
        let lat = plot.y, lng = plot.x;
        if (lat > 50 && lng < 30) [lat, lng] = [lng, lat];

        const dist = Geo.haversineDistance(villaLat, villaLng, lat, lng);
        const proximity = classifyDistance(dist, thresholds);

        amenities.push({
          type: amenityType,
          name: plot.landUseDetails || plot.location || `Plot ${plot.id}`,
          distanceMeters: Math.round(dist),
          proximity,
          coordinates: [lat, lng],
          plotId: plot.id,
          icon: AMENITY_CONFIG[amenityType]?.emoji,
        });
      }
    }

    return amenities.sort((a, b) => a.distanceMeters - b.distanceMeters);
  }

  // ─── Legacy Layout Analysis (centroid-only, kept for backward compat) ───

  analyzeLayout(villaLat: number, villaLng: number, nearbyPlots: PlotData[]): LayoutAnalysis {
    const villaCentroid: [number, number] = [villaLng, villaLat];
    const classified = this._classifyPlots(nearbyPlots);
    const fb = null;
    const positionType = this._positionByCentroid(villaCentroid, classified, fb);
    const { layoutType, backFacing } = this._layoutByCentroid(villaCentroid, classified, fb);

    const residential = classified.filter(c => c.kind === 'residential' && Geo.distanceM(villaCentroid, c.centroid) < 38);
    const roads = classified.filter(c => c.kind === 'road' && Geo.distanceM(villaCentroid, c.centroid) < 60);
    const parks = classified.filter(c => c.kind === 'park' && Geo.distanceM(villaCentroid, c.centroid) < 100);

    return {
      layoutType,
      positionType,
      backFacing,
      adjacentResidentialCount: residential.length,
      adjacentRoadCount: roads.length,
      adjacentParkCount: parks.length,
    };
  }

  // ─── Smart Tags Generation ───

  generateSmartTags(villa: CommunityVilla, amenities?: DetectedAmenity[], layout?: LayoutAnalysis): SmartTag[] {
    const tags: SmartTag[] = [];

    // Layout
    if (layout) {
      if (layout.layoutType === 'back_to_back') {
        tags.push({ label: 'Back-to-Back', category: 'layout', emoji: '🏘️', color: 'bg-red-500/10 text-red-400' });
      } else if (layout.layoutType === 'single_row' || villa.is_single_row) {
        tags.push({ label: 'Single Row', category: 'layout', emoji: '🏡', color: 'bg-emerald-500/10 text-emerald-400' });
      }
    } else if (villa.is_single_row) {
      tags.push({ label: 'Single Row', category: 'layout', emoji: '🏡', color: 'bg-emerald-500/10 text-emerald-400' });
    }

    // Position
    if (layout?.positionType === 'corner' || villa.is_corner) {
      tags.push({ label: 'Corner', category: 'position', emoji: '📐', color: 'bg-amber-500/10 text-amber-400' });
    } else if (layout?.positionType === 'end') {
      tags.push({ label: 'End Unit', category: 'position', emoji: '↔️', color: 'bg-purple-500/10 text-purple-400' });
    }

    // Back facing
    if (layout?.backFacing === 'road' || villa.backs_road) {
      tags.push({ label: 'Backs Road', category: 'facing', emoji: '🛣️', color: 'bg-yellow-500/10 text-yellow-400' });
    }
    if (layout?.backFacing === 'park' || villa.backs_park) {
      tags.push({ label: 'Backs Park', category: 'facing', emoji: '🌳', color: 'bg-emerald-500/10 text-emerald-400' });
    }
    if (layout?.backFacing === 'open_space') {
      tags.push({ label: 'Open View', category: 'facing', emoji: '🏞️', color: 'bg-sky-500/10 text-sky-400' });
    }
    if (layout?.backFacing === 'community_edge') {
      tags.push({ label: 'Community Edge', category: 'facing', emoji: '📍', color: 'bg-gray-500/10 text-gray-400' });
    }

    // Vastu
    const vastu = classifyVastu(villa.facing_direction);
    if (vastu.entranceDirection !== 'Unknown') {
      tags.push({
        label: `${vastu.entranceDirection} Facing`,
        category: 'vastu',
        emoji: '🧭',
        color: vastu.compliant ? 'bg-pink-500/10 text-pink-400' : 'bg-gray-500/10 text-gray-400',
        detail: vastu.rating === 'excellent' ? 'Excellent' : vastu.rating === 'good' ? 'Good' : undefined,
      });
      if (vastu.compliant) {
        tags.push({ label: 'Vastu ✓', category: 'vastu', emoji: '✅', color: 'bg-pink-500/10 text-pink-400' });
      }
    } else if (villa.vastu_compliant) {
      tags.push({ label: 'Vastu ✓', category: 'vastu', emoji: '🧭', color: 'bg-pink-500/10 text-pink-400' });
    }

    // Amenity proximity tags
    if (amenities) {
      const bestByType = new Map<AmenityType, DetectedAmenity>();
      for (const a of amenities) {
        if (a.proximity === 'not_nearby') continue;
        const existing = bestByType.get(a.type);
        if (!existing || a.distanceMeters < existing.distanceMeters) {
          bestByType.set(a.type, a);
        }
      }
      for (const [type, amenity] of bestByType) {
        const config = AMENITY_CONFIG[type];
        tags.push({
          label: `Near ${config.label} (${amenity.distanceMeters}m)`,
          category: 'amenity',
          emoji: config.emoji,
          color: config.color,
          detail: `${amenity.distanceMeters}m`,
        });
      }
    } else {
      if (villa.near_pool) tags.push({ label: 'Near Pool', category: 'amenity', emoji: '🏊', color: 'bg-cyan-500/10 text-cyan-400' });
      if (villa.near_school) tags.push({ label: 'Near School', category: 'amenity', emoji: '🏫', color: 'bg-indigo-500/10 text-indigo-400' });
      if (villa.near_entrance) tags.push({ label: 'Near Entrance', category: 'amenity', emoji: '🚪', color: 'bg-rose-500/10 text-rose-400' });
      if (villa.near_community_center) tags.push({ label: 'Community Center', category: 'amenity', emoji: '🏛️', color: 'bg-violet-500/10 text-violet-400' });
    }

    return tags;
  }

  /** Tags from DB fields only (no GIS) */
  generateBasicTags(villa: CommunityVilla): SmartTag[] {
    return this.generateSmartTags(villa);
  }
}

export const propertyIntelligence = new PropertyIntelligenceEngine();
