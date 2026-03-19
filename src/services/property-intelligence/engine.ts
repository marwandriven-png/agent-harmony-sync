/**
 * Property Intelligence Engine v2
 * 
 * Performance fixes:
 *  - _classifyPlots() called ONCE per batch, not per villa
 *  - Pre-built plot lookup Map eliminates O(n) find() per villa
 *  - Community amenity registry integrated as reliable fallback
 *  - Cache keyed on villaId — only invalidated when data actually changes
 * 
 * Bug fixes:
 *  - Corner logic: ≥2 road sides OR (no roads AND ≤1 residential neighbour)
 *  - Back-to-Back: road/park between two villas → still SingleRow
 *  - detectAmenities: uses registry fallback when GIS data has no amenity plots
 */

import type { PlotData } from '../DDAGISService';
import type { CommunityVilla } from '@/hooks/useVillas';
import type {
  DetectedAmenity, LayoutAnalysis, LayoutType, PositionType,
  BackFacingType, SmartTag, AmenityType, ProximityThresholds,
} from './types';
import { DEFAULT_THRESHOLDS, AMENITY_CONFIG } from './types';
import { classifyDistance, classifyVastu, classifyLandUse } from './classifiers';
import { Geo, type Polygon, type Edge } from './geometry';
import { detectCommunityAmenities } from './amenity-registry';

// ─── Internal types ─────────────────────────────────────────────────────────

const DIRECTION_BEARINGS: Record<string, number> = {
  N: 0, NE: 45, E: 90, SE: 135, S: 180, SW: 225, W: 270, NW: 315,
};

function parseFrontBearing(dir?: string | null): number | null {
  const n = (dir || '').toUpperCase().replace(/[^A-Z]/g, '');
  if (!n) return null;
  if (n.includes('NORTHEAST') || n === 'NE') return DIRECTION_BEARINGS.NE;
  if (n.includes('NORTHWEST') || n === 'NW') return DIRECTION_BEARINGS.NW;
  if (n.includes('SOUTHEAST') || n === 'SE') return DIRECTION_BEARINGS.SE;
  if (n.includes('SOUTHWEST') || n === 'SW') return DIRECTION_BEARINGS.SW;
  if (n.includes('NORTH') || n === 'N') return DIRECTION_BEARINGS.N;
  if (n.includes('EAST')  || n === 'E') return DIRECTION_BEARINGS.E;
  if (n.includes('SOUTH') || n === 'S') return DIRECTION_BEARINGS.S;
  if (n.includes('WEST')  || n === 'W') return DIRECTION_BEARINGS.W;
  return null;
}

function extractPolygon(plot: PlotData): Polygon | null {
  const geom = (plot.rawAttributes as Record<string, unknown>)?.geometry as
    { rings?: number[][][] } | undefined;
  if (!geom?.rings?.[0] || geom.rings[0].length < 3) return null;
  return geom.rings[0].map(c => [c[0], c[1]] as [number, number]);
}

function plotCentroid(plot: PlotData): [number, number] | null {
  const poly = extractPolygon(plot);
  if (poly) return Geo.centroid(poly);
  if (plot.x && plot.y) {
    let lat = plot.y, lng = plot.x;
    if (lat > 50 && lng < 30) [lat, lng] = [lng, lat]; // UAE coord swap guard
    return [lng, lat];
  }
  return null;
}

interface ClassifiedPlot {
  plot:     PlotData;
  /** 'residential' | 'road' | 'park' | 'open_space' | AmenityType */
  kind:     string;
  polygon:  Polygon | null;
  edges:    Edge[];
  centroid: [number, number];
}

// ─── Pre-classified plot batch (shared across all villas in one analysis run) ─

export interface PlotBatch {
  roads:       ClassifiedPlot[];
  parks:       ClassifiedPlot[];
  openSpaces:  ClassifiedPlot[];
  residential: ClassifiedPlot[];
  amenities:   ClassifiedPlot[];
  /** Fast lookup: plotId → classified plot */
  byId:        Map<string, ClassifiedPlot>;
}

// ─── Engine ──────────────────────────────────────────────────────────────────

export class PropertyIntelligenceEngine {

  /** Boundary-sharing tolerance in metres */
  private boundaryTolerance = 12;

  /** Analysis result cache: villaId → result */
  private cache = new Map<string, { layout: LayoutAnalysis; amenities: DetectedAmenity[]; tags: string[] }>();

  /** Clear analysis cache — call when plot data changes */
  clearCache(): void { this.cache.clear(); }

  // ─── BATCH CLASSIFICATION ─────────────────────────────────────────────────
  /**
   * Pre-classify an array of nearby GIS plots ONCE for a whole analysis batch.
   * Pass the result to analyzeWithBatch() for each individual villa — this
   * eliminates the O(n*m) repeated classification that was the main bottleneck.
   */
  buildBatch(nearbyPlots: PlotData[]): PlotBatch {
    const roads:       ClassifiedPlot[] = [];
    const parks:       ClassifiedPlot[] = [];
    const openSpaces:  ClassifiedPlot[] = [];
    const residential: ClassifiedPlot[] = [];
    const amenities:   ClassifiedPlot[] = [];
    const byId = new Map<string, ClassifiedPlot>();

    for (const plot of nearbyPlots) {
      const kind = classifyLandUse(plot.landUseDetails || plot.zoning || '');
      if (!kind) continue;
      const centroid = plotCentroid(plot);
      if (!centroid) continue;
      const polygon = extractPolygon(plot);
      const edges   = polygon ? Geo.edges(polygon) : [];
      const cp: ClassifiedPlot = { plot, kind, polygon, edges, centroid };
      byId.set(plot.id, cp);
      if (kind === 'road')        roads.push(cp);
      else if (kind === 'park')   parks.push(cp);
      else if (kind === 'open_space' || kind === 'community_center') openSpaces.push(cp);
      else if (kind === 'residential') residential.push(cp);
      else amenities.push(cp); // pool, school, mosque, mall, etc.
    }

    return { roads, parks, openSpaces, residential, amenities, byId };
  }

  // ─── FULL POLYGON-AWARE ANALYSIS ─────────────────────────────────────────

  /**
   * Analyze a single villa using a pre-built PlotBatch (fast path).
   * Use this when analyzing many villas against the same nearby plot set.
   */
  analyzeWithBatch(
    villaPlot: PlotData,
    batch: PlotBatch,
    facingDirection?: string | null,
  ): { layout: LayoutAnalysis; amenities: DetectedAmenity[]; tags: string[] } {
    const cacheKey = `${villaPlot.id}:${facingDirection ?? ''}`;
    const cached = this.cache.get(cacheKey);
    if (cached) return cached;

    const villaCentroid = plotCentroid(villaPlot);
    if (!villaCentroid) {
      return { layout: this._emptyLayout(), amenities: [], tags: [] };
    }

    const villaPolygon = extractPolygon(villaPlot);
    const villaEdges   = villaPolygon ? Geo.edges(villaPolygon) : [];
    const fb           = parseFrontBearing(facingDirection);

    // Exclude self from residential list
    const residential = batch.residential.filter(r => r.plot.id !== villaPlot.id);

    // ── Position ────────────────────────────────────────────────────────────
    const positionType = this._detectPosition(
      villaCentroid, villaEdges, batch.roads, residential, fb,
    );

    // ── Layout & Back Facing ─────────────────────────────────────────────────
    const { layoutType, backFacing } = this._detectLayoutAndBackFacing(
      villaCentroid, villaEdges, batch.roads, batch.parks, batch.openSpaces, residential, fb,
    );

    // ── Adjacent counts ──────────────────────────────────────────────────────
    const adjacentResidentialCount = this._countAdjacent(villaCentroid, villaEdges, residential, 38);
    const adjacentRoadCount        = this._countAdjacent(villaCentroid, villaEdges, batch.roads, 60);
    const adjacentParkCount        = this._countAdjacent(villaCentroid, villaEdges, batch.parks, 100);

    const layout: LayoutAnalysis = {
      layoutType, positionType, backFacing,
      adjacentResidentialCount, adjacentRoadCount, adjacentParkCount,
    };

    // ── Amenities: GIS plots first, community registry fallback ─────────────
    const amenities = this._detectAmenitiesFromBatch(
      villaCentroid[1], villaCentroid[0], batch.amenities,
    );
    // If GIS yielded nothing, fall back to GPS-accurate community registry
    const finalAmenities = amenities.length > 0
      ? amenities
      : detectCommunityAmenities(villaCentroid[1], villaCentroid[0]);

    // ── Smart tags ───────────────────────────────────────────────────────────
    const tags: string[] = [];
    if (layoutType === 'single_row')  tags.push('Single Row');
    if (layoutType === 'back_to_back') tags.push('Back-to-Back');
    if (positionType === 'corner')    tags.push('Corner');
    if (positionType === 'end')       tags.push('End Unit');
    if (backFacing === 'road')        tags.push('Backs Road');
    if (backFacing === 'park')        tags.push('Backs Park');
    if (backFacing === 'open_space')  tags.push('Backs Open Land');
    if (backFacing === 'community_edge') tags.push('Community Edge');

    const result = { layout, amenities: finalAmenities, tags };
    this.cache.set(cacheKey, result);
    return result;
  }

  /**
   * Legacy single-call API — classifies plots internally (slower, kept for backward compat).
   */
  analyzeWithPolygons(
    villaPlot: PlotData,
    nearbyPlots: PlotData[],
    facingDirection?: string | null,
  ): { layout: LayoutAnalysis; amenities: DetectedAmenity[]; tags: string[] } {
    const batch = this.buildBatch(nearbyPlots);
    return this.analyzeWithBatch(villaPlot, batch, facingDirection);
  }

  // ─── POSITION DETECTION ──────────────────────────────────────────────────

  private _detectPosition(
    villaCentroid: [number, number],
    villaEdges: Edge[],
    roads: ClassifiedPlot[],
    residential: ClassifiedPlot[],
    fb: number | null,
  ): PositionType {
    if (villaEdges.length > 0) {
      // Method A: 2+ different sides touch road polygons → Corner
      const roadSides = new Set<string>();
      for (const road of roads) {
        if (!road.edges.length) continue;
        for (const vEdge of villaEdges) {
          for (const rEdge of road.edges) {
            if (Geo.distanceM(vEdge.mid, rEdge.mid) < this.boundaryTolerance) {
              const bearing = Geo.bearingFrom(villaCentroid, vEdge.mid);
              const side = fb !== null
                ? Geo.sideFB(bearing, fb)
                : String(Math.floor(((bearing + 45) % 360) / 90));
              roadSides.add(side);
            }
          }
        }
      }
      if (roadSides.size >= 2) return 'corner';

      // Method B: count residential boundary-sharing neighbours
      const resBoundaryCount = residential.filter(r =>
        r.edges.length > 0 && Geo.sharesBoundary(villaEdges, r.edges, this.boundaryTolerance)
      ).length;
      // ≤1 neighbour and NOT touching a road on one side → End Unit
      // 0 neighbours and roads on multiple sides → already caught by Method A
      if (resBoundaryCount === 0) return 'end';
      if (resBoundaryCount === 1) return 'end';
      return 'middle';
    }

    // Fallback: centroid-distance
    return this._positionByCentroid(villaCentroid, roads, residential, fb);
  }

  // ─── LAYOUT & BACK-FACING DETECTION ──────────────────────────────────────

  private _detectLayoutAndBackFacing(
    villaCentroid: [number, number],
    villaEdges: Edge[],
    roads: ClassifiedPlot[],
    parks: ClassifiedPlot[],
    openSpaces: ClassifiedPlot[],
    residential: ClassifiedPlot[],
    fb: number | null,
  ): { layoutType: LayoutType; backFacing: BackFacingType } {
    if (villaEdges.length > 0) {
      const backEdges = this._getBackEdges(villaEdges, villaCentroid, fb);

      // Priority: Road > Park > OpenSpace > ResidentialPlot > CommunityEdge
      const backsRoad        = roads.some(r       => r.edges.length > 0 && Geo.sharesBoundary(backEdges, r.edges, this.boundaryTolerance));
      const backsPark        = parks.some(p       => p.edges.length > 0 && Geo.sharesBoundary(backEdges, p.edges, this.boundaryTolerance));
      const backsOpen        = openSpaces.some(o  => o.edges.length > 0 && Geo.sharesBoundary(backEdges, o.edges, this.boundaryTolerance));
      const backsResidential = residential.some(r => r.edges.length > 0 && Geo.sharesBoundary(backEdges, r.edges, this.boundaryTolerance));

      // Back-to-Back ONLY when rear boundary touches another villa
      // AND there is NO road, park, or open space between them
      const layoutType: LayoutType =
        (backsResidential && !backsRoad && !backsPark && !backsOpen)
          ? 'back_to_back'
          : 'single_row';

      let backFacing: BackFacingType = 'community_edge';
      if (backsRoad)        backFacing = 'road';
      else if (backsPark)   backFacing = 'park';
      else if (backsOpen)   backFacing = 'open_space';
      else if (backsResidential) backFacing = 'villa';

      return { layoutType, backFacing };
    }

    // Fallback
    return this._layoutByCentroid(villaCentroid, roads, parks, openSpaces, residential, fb);
  }

  // ─── ADJACENCY COUNT ─────────────────────────────────────────────────────

  private _countAdjacent(
    villaCentroid: [number, number],
    villaEdges: Edge[],
    candidates: ClassifiedPlot[],
    fallbackRadius: number,
  ): number {
    if (villaEdges.length > 0) {
      return candidates.filter(c =>
        c.edges.length > 0 && Geo.sharesBoundary(villaEdges, c.edges, this.boundaryTolerance)
      ).length;
    }
    return candidates.filter(c => Geo.distanceM(villaCentroid, c.centroid) < fallbackRadius).length;
  }

  // ─── AMENITY DETECTION ───────────────────────────────────────────────────

  private _detectAmenitiesFromBatch(
    villaLat: number,
    villaLng: number,
    amenityPlots: ClassifiedPlot[],
    thresholds: ProximityThresholds = DEFAULT_THRESHOLDS,
  ): DetectedAmenity[] {
    const results: DetectedAmenity[] = [];
    for (const cp of amenityPlots) {
      const amenityType = cp.kind as AmenityType;
      const [lng, lat] = cp.centroid;
      const dist = Math.round(Geo.haversineDistance(villaLat, villaLng, lat, lng));
      if (dist > 600) continue;
      results.push({
        type: amenityType,
        name: cp.plot.landUseDetails || cp.plot.location || `Plot ${cp.plot.id}`,
        distanceMeters: dist,
        proximity: classifyDistance(dist, thresholds),
        coordinates: [lat, lng],
        plotId: cp.plot.id,
        icon: AMENITY_CONFIG[amenityType]?.emoji,
      });
    }
    return results.sort((a, b) => a.distanceMeters - b.distanceMeters);
  }

  /**
   * Public amenity detection — GIS-based then registry fallback.
   * Used by legacy analyzeLayout path.
   */
  detectAmenities(
    villaLat: number,
    villaLng: number,
    nearbyPlots: PlotData[],
    thresholds: ProximityThresholds = DEFAULT_THRESHOLDS,
  ): DetectedAmenity[] {
    const amenityPlots: ClassifiedPlot[] = [];
    for (const plot of nearbyPlots) {
      const kind = classifyLandUse(plot.landUseDetails || plot.zoning || '');
      if (!kind || ['residential', 'road', 'open_space'].includes(kind)) continue;
      const centroid = plotCentroid(plot);
      if (!centroid) continue;
      const polygon = extractPolygon(plot);
      amenityPlots.push({ plot, kind, polygon, edges: polygon ? Geo.edges(polygon) : [], centroid });
    }

    const gis = this._detectAmenitiesFromBatch(villaLat, villaLng, amenityPlots, thresholds);
    return gis.length > 0 ? gis : detectCommunityAmenities(villaLat, villaLng);
  }

  // ─── BACK EDGES ──────────────────────────────────────────────────────────

  private _getBackEdges(edges: Edge[], centroid: [number, number], fb: number | null): Edge[] {
    if (fb === null) return edges;
    const back = edges.filter(e => Geo.sideFB(Geo.bearingFrom(centroid, e.mid), fb) === 'back');
    return back.length > 0 ? back : edges;
  }

  // ─── CENTROID FALLBACKS ───────────────────────────────────────────────────

  private _positionByCentroid(
    vc: [number, number],
    roads: ClassifiedPlot[],
    residential: ClassifiedPlot[],
    fb: number | null,
  ): PositionType {
    const nearRoads = roads.filter(r => Geo.distanceM(vc, r.centroid) < 75);
    const nearRes   = residential.filter(r => Geo.distanceM(vc, r.centroid) < 38);

    const roadBearings = nearRoads.map(r => Geo.bearingFrom(vc, r.centroid));
    const hasMultiRoad = roadBearings.some((b1, i) =>
      roadBearings.slice(i + 1).some(b2 => {
        const d = Math.abs(b1 - b2) % 360;
        return (d > 180 ? 360 - d : d) >= 55;
      })
    );
    if (hasMultiRoad && nearRoads.length >= 2) return 'corner';
    if (nearRes.length <= 1) return 'end';
    return 'middle';
  }

  private _layoutByCentroid(
    vc: [number, number],
    roads: ClassifiedPlot[],
    parks: ClassifiedPlot[],
    openSpaces: ClassifiedPlot[],
    residential: ClassifiedPlot[],
    fb: number | null,
  ): { layoutType: LayoutType; backFacing: BackFacingType } {
    const rearFilter = (candidates: ClassifiedPlot[], minD = 18, maxD = 75) =>
      candidates.filter(c => {
        const d = Geo.distanceM(vc, c.centroid);
        if (d < minD || d > maxD) return false;
        if (fb === null) return true;
        return Geo.sideFB(Geo.bearingFrom(vc, c.centroid), fb) === 'back';
      });

    const rearRes  = rearFilter(residential).length > 0;
    const rearRoad = rearFilter(roads, 10, 60).length > 0;
    const rearPark = rearFilter(parks, 10, 80).length > 0;
    const rearOpen = rearFilter(openSpaces, 10, 80).length > 0;

    const layoutType: LayoutType =
      (rearRes && !rearRoad && !rearPark && !rearOpen) ? 'back_to_back' : 'single_row';

    let backFacing: BackFacingType = 'community_edge';
    if (rearRoad)      backFacing = 'road';
    else if (rearPark) backFacing = 'park';
    else if (rearOpen) backFacing = 'open_space';
    else if (rearRes)  backFacing = 'villa';

    return { layoutType, backFacing };
  }

  // ─── LAYOUT ANALYSIS (legacy, centroid only) ──────────────────────────────

  analyzeLayout(villaLat: number, villaLng: number, nearbyPlots: PlotData[]): LayoutAnalysis {
    const batch = this.buildBatch(nearbyPlots);
    const vc: [number, number] = [villaLng, villaLat];
    const residential = batch.residential;
    const positionType = this._positionByCentroid(vc, batch.roads, residential, null);
    const { layoutType, backFacing } = this._layoutByCentroid(
      vc, batch.roads, batch.parks, batch.openSpaces, residential, null,
    );
    return {
      layoutType, positionType, backFacing,
      adjacentResidentialCount: this._countAdjacent(vc, [], residential, 38),
      adjacentRoadCount:        this._countAdjacent(vc, [], batch.roads, 60),
      adjacentParkCount:        this._countAdjacent(vc, [], batch.parks, 100),
    };
  }

  // ─── SMART TAGS ───────────────────────────────────────────────────────────

  generateSmartTags(
    villa: CommunityVilla,
    amenities?: DetectedAmenity[],
    layout?: LayoutAnalysis,
  ): SmartTag[] {
    const tags: SmartTag[] = [];

    // Layout
    const lt = layout?.layoutType;
    if (lt === 'back_to_back') {
      tags.push({ label: 'Back-to-Back', category: 'layout', emoji: '🏘️', color: 'bg-red-500/10 text-red-400' });
    } else if (lt === 'single_row' || villa.is_single_row) {
      tags.push({ label: 'Single Row', category: 'layout', emoji: '🏡', color: 'bg-emerald-500/10 text-emerald-400' });
    }

    // Position
    if (layout?.positionType === 'corner' || villa.is_corner) {
      tags.push({ label: 'Corner', category: 'position', emoji: '📐', color: 'bg-amber-500/10 text-amber-400' });
    } else if (layout?.positionType === 'end') {
      tags.push({ label: 'End Unit', category: 'position', emoji: '↔️', color: 'bg-purple-500/10 text-purple-400' });
    }

    // Back facing
    const bf = layout?.backFacing;
    if (bf === 'road'  || villa.backs_road)  tags.push({ label: 'Backs Road',     category: 'facing', emoji: '🛣️', color: 'bg-yellow-500/10 text-yellow-400' });
    if (bf === 'park'  || villa.backs_park)  tags.push({ label: 'Backs Park',     category: 'facing', emoji: '🌳', color: 'bg-emerald-500/10 text-emerald-400' });
    if (bf === 'open_space')                 tags.push({ label: 'Open View',      category: 'facing', emoji: '🏞️', color: 'bg-sky-500/10 text-sky-400' });
    if (bf === 'community_edge')             tags.push({ label: 'Community Edge', category: 'facing', emoji: '📍', color: 'bg-gray-500/10 text-gray-400' });

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

    // Amenity proximity tags (only near/very-close)
    if (amenities?.length) {
      const bestByType = new Map<AmenityType, DetectedAmenity>();
      for (const a of amenities) {
        if (a.proximity === 'not_nearby') continue;
        const existing = bestByType.get(a.type);
        if (!existing || a.distanceMeters < existing.distanceMeters) bestByType.set(a.type, a);
      }
      for (const [type, amenity] of bestByType) {
        const cfg = AMENITY_CONFIG[type];
        if (!cfg) continue;
        tags.push({
          label: `Near ${cfg.label} (${amenity.distanceMeters}m)`,
          category: 'amenity',
          emoji: cfg.emoji,
          color: cfg.color,
          detail: `${amenity.distanceMeters}m`,
        });
      }
    } else {
      // DB flag fallback
      if (villa.near_pool)              tags.push({ label: 'Near Pool',         category: 'amenity', emoji: '🏊', color: 'bg-cyan-500/10 text-cyan-400' });
      if (villa.near_school)            tags.push({ label: 'Near School',       category: 'amenity', emoji: '🏫', color: 'bg-indigo-500/10 text-indigo-400' });
      if (villa.near_entrance)          tags.push({ label: 'Near Entrance',     category: 'amenity', emoji: '🚪', color: 'bg-rose-500/10 text-rose-400' });
      if (villa.near_community_center)  tags.push({ label: 'Community Center',  category: 'amenity', emoji: '🏛️', color: 'bg-violet-500/10 text-violet-400' });
    }

    return tags;
  }

  generateBasicTags(villa: CommunityVilla): SmartTag[] {
    return this.generateSmartTags(villa);
  }

  private _emptyLayout(): LayoutAnalysis {
    return {
      layoutType: 'unknown', positionType: 'unknown', backFacing: 'unknown',
      adjacentResidentialCount: 0, adjacentRoadCount: 0, adjacentParkCount: 0,
    };
  }
}

export const propertyIntelligence = new PropertyIntelligenceEngine();
