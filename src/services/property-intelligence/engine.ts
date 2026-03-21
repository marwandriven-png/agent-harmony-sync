/**
 * Property Intelligence Engine v4
 *
 * KEY FIX: GIS polygon rings are in EPSG:3997 projected coordinates
 * (x≈495000-520000, y≈2760000-2800000), NOT lat/lng degrees.
 * Previous versions passed projected coords to haversine, computing
 * 4,000,000m distances instead of 39m — every boundary check returned false,
 * forcing centroid-only fallback for ALL GIS plots.
 *
 * Fix: convertRingsToWgs84() converts projected rings to WGS84 before
 * any geometry operations. Engine now correctly uses polygon boundaries.
 *
 * Classification priority (strict, no conflicts):
 *   1. Back-to-Back (rear boundary touches residential) → B2B ONLY
 *   2. Corner (2+ road sides) or End Unit (≤1 residential neighbour)
 *   3. Single Row (rear doesn't touch residential)
 *   4. Back-facing: Park > Road > Open Space > Community Edge
 *   5. Vastu (from facing direction, independent of layout)
 *
 * B2B and Single Row are MUTUALLY EXCLUSIVE — engine enforces this.
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

// ─── Coordinate conversion ────────────────────────────────────────────────────

const PROJ4_DEF = '+proj=tmerc +lat_0=0 +lon_0=55.33333333333334 +k=1 +x_0=500000 +y_0=0 +ellps=WGS84 +towgs84=0,0,0,0,0,0,0 +units=m +no_defs';
let _proj4Ready = false;

function ensureProj4() {
  if (_proj4Ready) return;
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const p4 = (globalThis as any).proj4;
    if (p4) { p4.defs('EPSG:3997', PROJ4_DEF); _proj4Ready = true; }
  } catch { /* ignore */ }
}

/** Convert a single [x, y] projected point → [lng, lat] WGS84. */
function projToWgs84(x: number, y: number): [number, number] | null {
  // If already in WGS84 degree range (Dubai: lat 22-27, lng 51-57)
  if (y >= 22 && y <= 27 && x >= 51 && x <= 57) return [x, y]; // already [lng, lat]

  ensureProj4();
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const p4 = (globalThis as any).proj4;
    if (p4 && _proj4Ready) {
      const [lng, lat] = p4('EPSG:3997', 'EPSG:4326', [x, y]);
      if (lat >= 22 && lat <= 27 && lng >= 51 && lng <= 57) return [lng, lat];
    }
  } catch { /* fall through */ }

  // Affine approximation for EPSG:3997 → WGS84 (Dubai region, ±50m accuracy)
  const lat = (y - 2_750_000) / 111_320 + 24.83;
  const lng = (x - 495_000) / (111_320 * Math.cos(25.0 * Math.PI / 180)) + 55.333;
  if (lat >= 22 && lat <= 27 && lng >= 51 && lng <= 57) return [lng, lat];
  return null;
}

/**
 * Convert a GIS polygon ring (projected coords) → WGS84 [lng, lat][] polygon.
 * Returns null if conversion fails or polygon too small (< 3 points).
 */
function convertRingsToWgs84(rings: number[][][]): Polygon | null {
  if (!rings?.[0] || rings[0].length < 3) return null;
  const converted: [number, number][] = [];
  for (const [x, y] of rings[0]) {
    const wgs = projToWgs84(x, y);
    if (!wgs) return null;
    converted.push(wgs);
  }
  return converted.length >= 3 ? converted : null;
}

// ─── Plot data extraction ─────────────────────────────────────────────────────

function extractPolygon(plot: PlotData): Polygon | null {
  const geom = (plot.rawAttributes as Record<string, unknown>)?.geometry as
    { rings?: number[][][] } | undefined;
  if (!geom?.rings?.[0]) return null;
  return convertRingsToWgs84(geom.rings);
}

function plotCentroid(plot: PlotData): [number, number] | null {
  const poly = extractPolygon(plot);
  if (poly) return Geo.centroid(poly);
  // Fallback: plot.x/y from GIS are already WGS84-equivalent centroids
  // (DDAGISService calculates centroid and stores as x,y)
  if (plot.x && plot.y) {
    const wgs = projToWgs84(plot.x, plot.y);
    if (wgs) return wgs; // [lng, lat]
    // If x/y are already WGS84
    if (Math.abs(plot.y) <= 90 && Math.abs(plot.x) <= 180) {
      return [plot.x, plot.y]; // [lng, lat]
    }
  }
  return null;
}

// ─── Internal types ───────────────────────────────────────────────────────────

interface ClassifiedPlot {
  plot:     PlotData;
  kind:     string;
  polygon:  Polygon | null;
  edges:    Edge[];
  centroid: [number, number]; // [lng, lat] WGS84
}

export interface PlotBatch {
  roads:       ClassifiedPlot[];
  parks:       ClassifiedPlot[];
  openSpaces:  ClassifiedPlot[];
  residential: ClassifiedPlot[];
  amenities:   ClassifiedPlot[];
  byId:        Map<string, ClassifiedPlot>;
}

// ─── Engine ──────────────────────────────────────────────────────────────────

export class PropertyIntelligenceEngine {

  /** Boundary-sharing tolerance in metres (walls of adjacent plots touch) */
  private tolM = 15;

  private cache = new Map<string, { layout: LayoutAnalysis; amenities: DetectedAmenity[]; tags: string[] }>();

  clearCache() { this.cache.clear(); }

  // ── Build batch: classify all plots ONCE for the entire villa set ───────────
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
      else amenities.push(cp);
    }
    return { roads, parks, openSpaces, residential, amenities, byId };
  }

  // ── Main analysis using pre-built batch ────────────────────────────────────
  analyzeWithBatch(
    villaPlot: PlotData,
    batch: PlotBatch,
    facingDirection?: string | null,
  ): { layout: LayoutAnalysis; amenities: DetectedAmenity[]; tags: string[] } {
    const cacheKey = `${villaPlot.id}:${facingDirection ?? ''}`;
    const cached = this.cache.get(cacheKey);
    if (cached) return cached;

    const villaCentroid = plotCentroid(villaPlot);
    if (!villaCentroid) return { layout: this._emptyLayout(), amenities: [], tags: [] };

    const villaPolygon = extractPolygon(villaPlot);
    const villaEdges   = villaPolygon ? Geo.edges(villaPolygon) : [];

    const fb = this._parseFrontBearing(facingDirection);
    const residential = batch.residential.filter(r => r.plot.id !== villaPlot.id);

    const hasPolygon = villaEdges.length > 0;

    // ── 1. LAYOUT: B2B vs Single Row (MUTUALLY EXCLUSIVE, strict priority) ──
    const { layoutType, backFacing } = hasPolygon
      ? this._detectLayoutPolygon(villaCentroid, villaEdges, batch.roads, batch.parks, batch.openSpaces, residential, fb)
      : this._detectLayoutCentroid(villaCentroid, batch.roads, batch.parks, batch.openSpaces, residential, fb);

    // ── 2. POSITION: Corner or End Unit ─────────────────────────────────────
    const positionType = hasPolygon
      ? this._detectPositionPolygon(villaCentroid, villaEdges, batch.roads, residential, fb)
      : this._detectPositionCentroid(villaCentroid, batch.roads, residential);

    // ── 3. ADJACENT COUNTS ───────────────────────────────────────────────────
    const adjacentResidentialCount = this._countAdjacent(villaCentroid, villaEdges, residential, 35);
    const adjacentRoadCount        = this._countAdjacent(villaCentroid, villaEdges, batch.roads, 60);
    const adjacentParkCount        = this._countAdjacent(villaCentroid, villaEdges, batch.parks, 100);

    const layout: LayoutAnalysis = {
      layoutType, positionType, backFacing,
      adjacentResidentialCount, adjacentRoadCount, adjacentParkCount,
    };

    // ── 4. AMENITIES: GIS plots first, registry fallback ────────────────────
    const gisAmenities = this._detectAmenitiesFromBatch(villaCentroid[1], villaCentroid[0], batch.amenities);
    const finalAmenities = gisAmenities.length > 0
      ? gisAmenities
      : detectCommunityAmenities(villaCentroid[1], villaCentroid[0]);

    const result = { layout, amenities: finalAmenities, tags: [] };
    this.cache.set(cacheKey, result);
    return result;
  }

  // ── Backward-compat single-call entry ─────────────────────────────────────
  analyzeWithPolygons(
    villaPlot: PlotData, nearbyPlots: PlotData[], facingDirection?: string | null,
  ): { layout: LayoutAnalysis; amenities: DetectedAmenity[]; tags: string[] } {
    return this.analyzeWithBatch(villaPlot, this.buildBatch(nearbyPlots), facingDirection);
  }

  // ─── LAYOUT DETECTION ─────────────────────────────────────────────────────

  /**
   * Polygon-aware layout detection.
   * Rule: B2B iff rear boundary touches a residential polygon with NO road/park buffer.
   * B2B and Single Row are mutually exclusive — B2B wins.
   */
  private _detectLayoutPolygon(
    villaCentroid: [number, number],
    villaEdges: Edge[],
    roads: ClassifiedPlot[], parks: ClassifiedPlot[], opens: ClassifiedPlot[],
    residential: ClassifiedPlot[], fb: number | null,
  ): { layoutType: LayoutType; backFacing: BackFacingType } {
    const backEdges = this._backEdges(villaEdges, villaCentroid, fb);

    const backsRoad = roads.some(r  => r.edges.length && Geo.sharesBoundary(backEdges, r.edges, this.tolM));
    const backsPark = parks.some(p  => p.edges.length && Geo.sharesBoundary(backEdges, p.edges, this.tolM));
    const backsOpen = opens.some(o  => o.edges.length && Geo.sharesBoundary(backEdges, o.edges, this.tolM));
    const backsRes  = residential.some(r => r.edges.length && Geo.sharesBoundary(backEdges, r.edges, this.tolM));

    // B2B ONLY when rear touches residential AND no road/park/open space buffer
    const layoutType: LayoutType =
      (backsRes && !backsRoad && !backsPark && !backsOpen) ? 'back_to_back' : 'single_row';

    // Back-facing priority: Road > Park > Open > Residential > Edge
    let backFacing: BackFacingType = 'community_edge';
    if (backsRoad)       backFacing = 'road';
    else if (backsPark)  backFacing = 'park';
    else if (backsOpen)  backFacing = 'open_space';
    else if (backsRes)   backFacing = 'villa';

    return { layoutType, backFacing };
  }

  /**
   * Centroid-based layout detection (fallback when no polygon data).
   * Uses directional distance to nearby plots to infer rear adjacency.
   */
  private _detectLayoutCentroid(
    vc: [number, number],
    roads: ClassifiedPlot[], parks: ClassifiedPlot[], opens: ClassifiedPlot[],
    residential: ClassifiedPlot[], fb: number | null,
  ): { layoutType: LayoutType; backFacing: BackFacingType } {
    /**
     * Centroid heuristic for when no polygon data is available.
     *
     * Key rules (enforced strictly):
     *  1. B2B and Single Row are MUTUALLY EXCLUSIVE.
     *  2. B2B = rear has residential plot AND no road/park/open buffer in THAT direction.
     *  3. Single Row = rear has NO residential adjacency.
     *  4. Roads must be within TIGHTER radius than residential to count as buffer.
     *     (Otherwise a road 50m away masks B2B detection for residential 20m away.)
     *
     * Without facing direction (fb=null), we analyse all nearby plots but
     * give priority to plots that are CLOSER (more likely to be truly adjacent).
     */

    // Residential: look for plots that are close enough to share a boundary (~10-25m)
    const REAR_RES_MIN = 10;
    const REAR_RES_MAX = 40; // tighter than before (was 45)

    // Buffer (road/park) must be within the SAME tight radius to count as separator
    const BUFFER_MAX = 35;   // tighter than before (was 55m for roads)

    const inRear = (candidates: ClassifiedPlot[], minD: number, maxD: number) =>
      candidates.filter(c => {
        const d = Geo.distanceM(vc, c.centroid);
        if (d < minD || d > maxD) return false;
        if (fb === null) return true;
        return Geo.sideFB(Geo.bearingFrom(vc, c.centroid), fb) === 'back';
      });

    const rearRes  = inRear(residential, REAR_RES_MIN, REAR_RES_MAX).length > 0;
    const rearRoad = inRear(roads, 5, BUFFER_MAX).length > 0;
    const rearPark = inRear(parks, 5, BUFFER_MAX).length > 0;
    const rearOpen = inRear(opens, 5, BUFFER_MAX).length > 0;

    /**
     * Additional density check: if there are many residential plots nearby
     * (≥4 within 50m in ANY direction), this is a dense residential area
     * where back-to-back rows are highly probable even without clear rear detection.
     * Only applies when fb is null (no facing direction available).
     */
    const nearbyResCount = fb === null
      ? residential.filter(c => Geo.distanceM(vc, c.centroid) < 50).length
      : 0;
    const isDenseResidential = nearbyResCount >= 4;

    // STRICT B2B rule: residential is in rear AND no buffer between them
    // Dense area fallback: if ≥4 residential plots nearby and no clear open space → B2B
    const isB2B = (rearRes && !rearRoad && !rearPark && !rearOpen)
               || (isDenseResidential && !rearRoad && !rearPark && !rearOpen && rearRes);

    const layoutType: LayoutType = isB2B ? 'back_to_back' : 'single_row';

    // Back-facing: what is ACTUALLY at the rear, regardless of layout type.
    // B2B means another villa row is adjacent, but the back of that row
    // may itself face a park/road. We set backFacing = 'villa' for B2B
    // UNLESS a park or road is also directly detectable behind this unit
    // (within tighter radius — indicating the park/road is really close).
    let backFacing: BackFacingType = 'community_edge';
    if (rearPark)        backFacing = 'park';
    else if (rearRoad)   backFacing = 'road';
    else if (rearOpen)   backFacing = 'open_space';
    else if (isB2B)      backFacing = 'villa';

    return { layoutType, backFacing };
  }

  // ─── POSITION DETECTION ───────────────────────────────────────────────────

  private _detectPositionPolygon(
    villaCentroid: [number, number],
    villaEdges: Edge[],
    roads: ClassifiedPlot[], residential: ClassifiedPlot[], fb: number | null,
  ): PositionType {
    // Corner: 2+ distinct sides of the plot border a road
    const roadSides = new Set<string>();
    for (const road of roads) {
      if (!road.edges.length) continue;
      for (const ve of villaEdges) {
        for (const re of road.edges) {
          if (Geo.distanceM(ve.mid, re.mid) < this.tolM) {
            const bearing = Geo.bearingFrom(villaCentroid, ve.mid);
            const side = fb !== null
              ? Geo.sideFB(bearing, fb)
              : String(Math.floor(((bearing + 45) % 360) / 90));
            roadSides.add(side);
          }
        }
      }
    }
    if (roadSides.size >= 2) return 'corner';

    // End Unit: 0 or 1 residential neighbours sharing boundary
    const resCount = residential.filter(r =>
      r.edges.length > 0 && Geo.sharesBoundary(villaEdges, r.edges, this.tolM)
    ).length;
    if (resCount <= 1) return 'end';
    return 'middle';
  }

  private _detectPositionCentroid(
    vc: [number, number],
    roads: ClassifiedPlot[], residential: ClassifiedPlot[],
  ): PositionType {
    const nearRoads = roads.filter(r => Geo.distanceM(vc, r.centroid) < 70);
    const nearRes   = residential.filter(r => Geo.distanceM(vc, r.centroid) < 38);

    // Corner: roads exist on 2+ significantly different bearings
    const bearings = nearRoads.map(r => Geo.bearingFrom(vc, r.centroid));
    const isCorner = bearings.some((b1, i) =>
      bearings.slice(i + 1).some(b2 => {
        const d = Math.abs(b1 - b2) % 360;
        return (d > 180 ? 360 - d : d) >= 60;
      })
    );
    if (isCorner && nearRoads.length >= 2) return 'corner';
    if (nearRes.length <= 1) return 'end';
    return 'middle';
  }

  // ─── HELPERS ──────────────────────────────────────────────────────────────

  private _backEdges(edges: Edge[], centroid: [number, number], fb: number | null): Edge[] {
    if (fb === null) return edges;
    const back = edges.filter(e => Geo.sideFB(Geo.bearingFrom(centroid, e.mid), fb) === 'back');
    return back.length > 0 ? back : edges;
  }

  private _countAdjacent(
    vc: [number, number], villaEdges: Edge[],
    candidates: ClassifiedPlot[], fallbackRadius: number,
  ): number {
    if (villaEdges.length > 0) {
      return candidates.filter(c =>
        c.edges.length > 0 && Geo.sharesBoundary(villaEdges, c.edges, this.tolM)
      ).length;
    }
    return candidates.filter(c => Geo.distanceM(vc, c.centroid) < fallbackRadius).length;
  }

  private _parseFrontBearing(dir?: string | null): number | null {
    const n = (dir || '').toUpperCase().replace(/[^A-Z]/g, '');
    if (!n) return null;
    const map: Record<string, number> = { N:0, NE:45, E:90, SE:135, S:180, SW:225, W:270, NW:315 };
    for (const [k, v] of Object.entries(map)) {
      if (n === k || n.includes(k.length === 2 ? k : k+'H')) return v; // NE, NW etc.
    }
    if (n.includes('NORTH')) return n.includes('EAST') ? 45 : n.includes('WEST') ? 315 : 0;
    if (n.includes('SOUTH')) return n.includes('EAST') ? 135 : n.includes('WEST') ? 225 : 180;
    if (n.includes('EAST'))  return 90;
    if (n.includes('WEST'))  return 270;
    return null;
  }

  // ─── AMENITY DETECTION ────────────────────────────────────────────────────

  private _detectAmenitiesFromBatch(
    villaLat: number, villaLng: number,
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

  detectAmenities(
    villaLat: number, villaLng: number, nearbyPlots: PlotData[],
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

  // ─── LEGACY (centroid-only, kept for backward compat) ─────────────────────

  analyzeLayout(villaLat: number, villaLng: number, nearbyPlots: PlotData[]): LayoutAnalysis {
    const batch = this.buildBatch(nearbyPlots);
    const vc: [number, number] = [villaLng, villaLat];
    const { layoutType, backFacing } = this._detectLayoutCentroid(
      vc, batch.roads, batch.parks, batch.openSpaces, batch.residential, null
    );
    const positionType = this._detectPositionCentroid(vc, batch.roads, batch.residential);
    return {
      layoutType, positionType, backFacing,
      adjacentResidentialCount: this._countAdjacent(vc, [], batch.residential, 38),
      adjacentRoadCount:        this._countAdjacent(vc, [], batch.roads, 60),
      adjacentParkCount:        this._countAdjacent(vc, [], batch.parks, 100),
    };
  }

  // ─── SMART TAG GENERATION ─────────────────────────────────────────────────

  /**
   * Generate smart tags with strict priority — no conflicting classes.
   * B2B and Single Row are MUTUALLY EXCLUSIVE in output.
   */
  generateSmartTags(
    villa: CommunityVilla,
    amenities?: DetectedAmenity[],
    layout?: LayoutAnalysis,
  ): SmartTag[] {
    const tags: SmartTag[] = [];
    const lt = layout?.layoutType;
    const pt = layout?.positionType;
    const bf = layout?.backFacing;

    // ── Layout (strict mutual exclusion) ────────────────────────────────────
    if (lt === 'back_to_back') {
      // B2B: skip Single Row completely — they CANNOT coexist
      tags.push({ label: 'Back-to-Back', category: 'layout', emoji: '🏘️', color: 'bg-red-500/10 text-red-400' });
    } else if (lt === 'single_row' || villa.is_single_row) {
      tags.push({ label: 'Single Row', category: 'layout', emoji: '🏡', color: 'bg-emerald-500/10 text-emerald-400' });
    }

    // ── Position ─────────────────────────────────────────────────────────────
    if (pt === 'corner' || villa.is_corner) {
      tags.push({ label: 'Corner', category: 'position', emoji: '📐', color: 'bg-amber-500/10 text-amber-400' });
    } else if (pt === 'end') {
      tags.push({ label: 'End Unit', category: 'position', emoji: '↔️', color: 'bg-purple-500/10 text-purple-400' });
    }

    // ── Back facing (only for single_row — B2B implies facing=villa, no separate tag) ─────
    if (lt !== 'back_to_back') {
      if (bf === 'road'       || villa.backs_road)  tags.push({ label: 'Backs Road',     category: 'facing', emoji: '🛣️', color: 'bg-yellow-500/10 text-yellow-400' });
      else if (bf === 'park'  || villa.backs_park)  tags.push({ label: 'Backs Park',     category: 'facing', emoji: '🌳', color: 'bg-emerald-500/10 text-emerald-400' });
      else if (bf === 'open_space')                 tags.push({ label: 'Open View',      category: 'facing', emoji: '🏞️', color: 'bg-sky-500/10 text-sky-400' });
      // community_edge: only add if no other facing is detected — rare, skip for cleanliness
    }

    // ── Vastu ─────────────────────────────────────────────────────────────────
    const vastu = classifyVastu(villa.facing_direction);
    if (vastu.entranceDirection !== 'Unknown') {
      tags.push({
        label: `${vastu.entranceDirection} Facing`, category: 'vastu',
        emoji: '🧭',
        color: vastu.compliant ? 'bg-pink-500/10 text-pink-400' : 'bg-gray-500/10 text-gray-400',
        detail: vastu.rating === 'excellent' ? 'Excellent' : vastu.rating === 'good' ? 'Good' : undefined,
      });
      if (vastu.compliant) tags.push({ label: 'Vastu ✓', category: 'vastu', emoji: '✅', color: 'bg-pink-500/10 text-pink-400' });
    } else if (villa.vastu_compliant) {
      tags.push({ label: 'Vastu ✓', category: 'vastu', emoji: '🧭', color: 'bg-pink-500/10 text-pink-400' });
    }

    // ── Amenities ─────────────────────────────────────────────────────────────
    if (amenities?.length) {
      const bestByType = new Map<AmenityType, DetectedAmenity>();
      for (const a of amenities) {
        if (a.proximity === 'not_nearby') continue;
        const ex = bestByType.get(a.type);
        if (!ex || a.distanceMeters < ex.distanceMeters) bestByType.set(a.type, a);
      }
      for (const [type, a] of bestByType) {
        const cfg = AMENITY_CONFIG[type];
        if (!cfg) continue;
        tags.push({ label: `Near ${cfg.label} (${a.distanceMeters}m)`, category: 'amenity', emoji: cfg.emoji, color: cfg.color, detail: `${a.distanceMeters}m` });
      }
    } else {
      if (villa.near_pool)             tags.push({ label: 'Near Pool',        category: 'amenity', emoji: '🏊', color: 'bg-cyan-500/10 text-cyan-400' });
      if (villa.near_school)           tags.push({ label: 'Near School',      category: 'amenity', emoji: '🏫', color: 'bg-indigo-500/10 text-indigo-400' });
      if (villa.near_entrance)         tags.push({ label: 'Near Entrance',    category: 'amenity', emoji: '🚪', color: 'bg-rose-500/10 text-rose-400' });
      if (villa.near_community_center) tags.push({ label: 'Community Center', category: 'amenity', emoji: '🏛️', color: 'bg-violet-500/10 text-violet-400' });
    }

    return tags;
  }

  generateBasicTags(villa: CommunityVilla): SmartTag[] {
    return this.generateSmartTags(villa);
  }

  private _emptyLayout(): LayoutAnalysis {
    return { layoutType: 'unknown', positionType: 'unknown', backFacing: 'unknown', adjacentResidentialCount: 0, adjacentRoadCount: 0, adjacentParkCount: 0 };
  }
}

export const propertyIntelligence = new PropertyIntelligenceEngine();
