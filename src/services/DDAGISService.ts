import { supabase } from "@/integrations/supabase/client";
import proj4 from 'proj4';

interface CacheEntry<T> {
  expiresAt: number;
  value: T;
}

export type VerificationSource = 'DDA' | 'DLD' | 'Manual';

export interface PlotData {
  id: string;
  area: number;
  gfa: number;
  floors: string;
  zoning: string;
  location: string;
  x: number;
  y: number;
  color: string;
  status: string;
  constructionCost: number;
  salePrice: number;
  developer?: string;
  project?: string;
  entity?: string;
  landUseDetails?: string;
  maxHeight?: number;
  plotCoverage?: number;
  isFrozen: boolean;
  freezeReason?: string;
  constructionStatus?: string;
  siteStatus?: string;
  rawAttributes?: Record<string, unknown>;
  // Verification fields
  verificationSource: VerificationSource;
  verificationDate?: string;
  municipalityNumber?: string;
  subNumber?: string;
  isApproximateLocation?: boolean;
}

export interface AffectionPlanData {
  plotNumber: string;
  entityName: string | null;
  projectName: string | null;
  landName: string | null;
  areaSqm: number | null;
  gfaSqm: number | null;
  gfaType: string | null;
  maxHeightFloors: string | null;
  maxHeightMeters: number | null;
  maxHeight: string | null;
  heightCategory: string | null;
  maxPlotCoverage: number | null;
  minPlotCoverage: number | null;
  plotCoverage: string | null;
  buildingSetbacks: {
    side1: string | null;
    side2: string | null;
    side3: string | null;
    side4: string | null;
  };
  podiumSetbacks: {
    side1: string | null;
    side2: string | null;
    side3: string | null;
    side4: string | null;
  };
  mainLanduse: string | null;
  subLanduse: string | null;
  landuseDetails: string | null;
  landuseCategory: string | null;
  generalNotes: string | null;
  siteplanIssueDate: number | null;
  siteplanExpiryDate: number | null;
  siteStatus: string | null;
  isFrozen: boolean;
  freezeReason: string | null;
}

export interface FeasibilityResult {
  revenue: number;
  cost: number;
  profit: number;
  roi: number;
  score: number;
  paybackPeriod: string;
  profitMargin: string;
  riskLevel: 'Low' | 'Medium' | 'High';
}

proj4.defs('EPSG:3997', '+proj=tmerc +lat_0=0 +lon_0=55.33333333333334 +k=1 +x_0=500000 +y_0=0 +ellps=WGS84 +towgs84=0,0,0,0,0,0,0 +units=m +no_defs');

const isFiniteCoordinate = (value: number): boolean => Number.isFinite(value) && !Number.isNaN(value);
const isValidWgs84 = (lat: number, lng: number): boolean => Math.abs(lat) <= 90 && Math.abs(lng) <= 180;
const isDubaiRegion = (lat: number, lng: number): boolean => lat >= 22 && lat <= 27 && lng >= 51 && lng <= 57;

function convertFromProjected(x: number, y: number): { lat: number; lng: number } | null {
  try {
    const [lng, lat] = proj4('EPSG:3997', 'EPSG:4326', [x, y]);
    if (isValidWgs84(lat, lng)) return { lat, lng };
  } catch (error) {
    console.warn('[GIS] EPSG:3997 conversion failed', { x, y, error });
  }
  return null;
}

export function normalizeCoordinatesForSearch(lat: number, lng: number): { lat: number; lng: number } | null {
  if (!isFiniteCoordinate(lat) || !isFiniteCoordinate(lng)) return null;

  if (isValidWgs84(lat, lng)) {
    if (isDubaiRegion(lat, lng)) return { lat, lng };
    if (isValidWgs84(lng, lat) && isDubaiRegion(lng, lat)) return { lat: lng, lng: lat };
    return { lat, lng };
  }

  // Common projected input from GIS plot centroids comes as y,x in callers.
  const projectedCandidates: Array<{ x: number; y: number }> = [
    { x: lng, y: lat },
    { x: lat, y: lng },
  ];

  const converted = projectedCandidates
    .map(({ x, y }) => convertFromProjected(x, y))
    .filter((coord): coord is { lat: number; lng: number } => Boolean(coord));

  if (converted.length === 0) return null;

  const preferred = converted.find((coord) => isDubaiRegion(coord.lat, coord.lng));
  return preferred ?? converted[0];
}

class DDAGISService {
  private cache = new Map<string, CacheEntry<unknown>>();
  private inFlight = new Map<string, Promise<unknown>>();

  private getCached<T>(key: string): T | null {
    const cached = this.cache.get(key) as CacheEntry<T> | undefined;
    if (!cached) return null;
    if (cached.expiresAt <= Date.now()) {
      this.cache.delete(key);
      return null;
    }
    return cached.value;
  }

  private setCached<T>(key: string, value: T, ttlMs: number) {
    this.cache.set(key, {
      value,
      expiresAt: Date.now() + ttlMs,
    });
  }

  private async withCache<T>(key: string, fetcher: () => Promise<T>, ttlMs: number): Promise<T> {
    const cached = this.getCached<T>(key);
    if (cached !== null) return cached;

    const existing = this.inFlight.get(key) as Promise<T> | undefined;
    if (existing) return existing;

    const promise = fetcher()
      .then((result) => {
        this.setCached(key, result, ttlMs);
        return result;
      })
      .finally(() => {
        this.inFlight.delete(key);
      });

    this.inFlight.set(key, promise);
    return promise;
  }

  async testConnection(): Promise<boolean> {
    try {

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/dda-gis-proxy?action=test`,
        {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
            'Content-Type': 'application/json'
          }
        }
      );

      if (!response.ok) {
        console.error('GIS test failed:', response.status);
        return false;
      }

      const result = await response.json();
      return result.connected === true;
    } catch (error) {
      console.error('GIS connection test failed:', error);
      return false;
    }
  }

  async fetchPlots(limit: number = 100): Promise<PlotData[]> {
    try {

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/dda-gis-proxy?action=fetch&limit=${limit}`,
        {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
            'Content-Type': 'application/json'
          }
        }
      );

      if (!response.ok) {
        throw new Error(`Edge function returned ${response.status}`);
      }

      const data = await response.json();

      if (data.error) {
        const errMsg = typeof data.error === 'string' ? data.error : (data.error.message || JSON.stringify(data.error));
        throw new Error(errMsg);
      }

      if (!data.features || !Array.isArray(data.features)) {
        throw new Error('Invalid response format from GIS service');
      }
      return this.transformGISData(data.features);
    } catch (error) {
      console.error('DDA GIS API Error:', error);
      throw error;
    }
  }

  async fetchPlotById(plotId: string): Promise<PlotData | null> {
    const normalizedPlotId = plotId.trim();
    return this.withCache(`plot:${normalizedPlotId}`, async () => {
      try {
        const response = await fetch(
          `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/dda-gis-proxy?action=plot&plotId=${encodeURIComponent(normalizedPlotId)}`,
          {
            method: 'GET',
            headers: {
              'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
              'Content-Type': 'application/json'
            }
          }
        );

        if (!response.ok) {
          throw new Error(`Edge function returned ${response.status}`);
        }

        const data = await response.json();

        if (data.features && data.features.length > 0) {
          return this.transformGISData(data.features)[0];
        }
        return null;
      } catch (error) {
        console.error('Error fetching plot by ID:', error);
        return null;
      }
    }, 5 * 60 * 1000);
  }

  async fetchAffectionPlan(plotId: string): Promise<AffectionPlanData | null> {
    try {
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/dda-gis-proxy?action=affection&plotId=${encodeURIComponent(plotId)}`,
        {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
            'Content-Type': 'application/json'
          }
        }
      );

      if (!response.ok) throw new Error(`Edge function returned ${response.status}`);

      const data = await response.json();

      if (data.features && data.features.length > 0) {
        const attrs = data.features[0].attributes;
        return {
          plotNumber: attrs.PLOT_NUMBER || plotId,
          entityName: attrs.ENTITY_NAME || null,
          projectName: attrs.PROJECT_NAME || null,
          landName: attrs.LAND_NAME || null,
          areaSqm: attrs.AREA_SQM || null,
          gfaSqm: attrs.GFA_SQM || null,
          gfaType: attrs.GFA_TYPE || null,
          maxHeightFloors: attrs.MAX_HEIGHT_FLOORS || null,
          maxHeightMeters: attrs.MAX_HEIGHT_METERS || null,
          maxHeight: attrs.MAX_HEIGHT || null,
          heightCategory: attrs.HEIGHT_CATEGORY || null,
          maxPlotCoverage: attrs.MAX_PLOT_COVERAGE || null,
          minPlotCoverage: attrs.MIN_PLOT_COVERAGE || null,
          plotCoverage: attrs.PLOT_COVERAGE || null,
          buildingSetbacks: {
            side1: attrs.BUILDING_SETBACK_SIDE1 || null,
            side2: attrs.BUILDING_SETBACK_SIDE2 || null,
            side3: attrs.BUILDING_SETBACK_SIDE3 || null,
            side4: attrs.BUILDING_SETBACK_SIDE4 || null,
          },
          podiumSetbacks: {
            side1: attrs.PODIUM_SETBACK_SIDE1 || null,
            side2: attrs.PODIUM_SETBACK_SIDE2 || null,
            side3: attrs.PODIUM_SETBACK_SIDE3 || null,
            side4: attrs.PODIUM_SETBACK_SIDE4 || null,
          },
          mainLanduse: attrs.MAIN_LANDUSE || null,
          subLanduse: attrs.SUB_LANDUSE || null,
          landuseDetails: attrs.LANDUSE_DETAILS || null,
          landuseCategory: attrs.LANDUSE_CATEGORY || null,
          generalNotes: attrs.GENERAL_NOTES || null,
          siteplanIssueDate: attrs.SITEPLAN_ISSUE_DATE || null,
          siteplanExpiryDate: attrs.SITEPLAN_EXPIRY_DATE || null,
          siteStatus: attrs.SITE_STATUS || null,
          isFrozen: attrs.IS_FROZEN === 1,
          freezeReason: attrs.FREEZE_REASON || null,
        };
      }

      // Fallback: try fetching the plot itself and build AP from its attributes
      console.warn(`No dedicated affection plan for ${plotId}, trying plot data fallback...`);
      return await this.buildAffectionPlanFromPlotData(plotId);
    } catch (error) {
      console.error('Error fetching affection plan:', error);
      // Last resort fallback
      try {
        return await this.buildAffectionPlanFromPlotData(plotId);
      } catch {
        return null;
      }
    }
  }

  private async buildAffectionPlanFromPlotData(plotId: string): Promise<AffectionPlanData | null> {
    try {
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/dda-gis-proxy?action=plot&plotId=${encodeURIComponent(plotId)}`,
        {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
            'Content-Type': 'application/json'
          }
        }
      );

      if (!response.ok) return null;
      const data = await response.json();

      if (!data.features || data.features.length === 0) return null;

      const attrs = data.features[0].attributes;

      return {
        plotNumber: attrs.PLOT_NUMBER || plotId,
        entityName: attrs.ENTITY_NAME || attrs.DEVELOPER_NAME || null,
        projectName: attrs.PROJECT_NAME || null,
        landName: attrs.LAND_NAME || null,
        areaSqm: attrs.AREA_SQM || null,
        gfaSqm: attrs.GFA_SQM || null,
        gfaType: attrs.GFA_TYPE || (attrs.GFA_SQM ? 'Value' : null),
        maxHeightFloors: attrs.MAX_HEIGHT_FLOORS || null,
        maxHeightMeters: attrs.MAX_HEIGHT_METERS || null,
        maxHeight: attrs.MAX_HEIGHT || (attrs.MAX_HEIGHT_FLOORS ? `${attrs.MAX_HEIGHT_FLOORS}` : null),
        heightCategory: attrs.HEIGHT_CATEGORY || null,
        maxPlotCoverage: attrs.MAX_PLOT_COVERAGE || null,
        minPlotCoverage: attrs.MIN_PLOT_COVERAGE || null,
        plotCoverage: attrs.PLOT_COVERAGE || (attrs.MAX_PLOT_COVERAGE ? `${attrs.MAX_PLOT_COVERAGE}%` : null),
        buildingSetbacks: {
          side1: attrs.BUILDING_SETBACK_SIDE1 ?? attrs.SETBACK_SIDE1 ?? null,
          side2: attrs.BUILDING_SETBACK_SIDE2 ?? attrs.SETBACK_SIDE2 ?? null,
          side3: attrs.BUILDING_SETBACK_SIDE3 ?? attrs.SETBACK_SIDE3 ?? null,
          side4: attrs.BUILDING_SETBACK_SIDE4 ?? attrs.SETBACK_SIDE4 ?? null,
        },
        podiumSetbacks: {
          side1: attrs.PODIUM_SETBACK_SIDE1 ?? null,
          side2: attrs.PODIUM_SETBACK_SIDE2 ?? null,
          side3: attrs.PODIUM_SETBACK_SIDE3 ?? null,
          side4: attrs.PODIUM_SETBACK_SIDE4 ?? null,
        },
        mainLanduse: attrs.MAIN_LANDUSE || null,
        subLanduse: attrs.SUB_LANDUSE || null,
        landuseDetails: attrs.LANDUSE_DETAILS || null,
        landuseCategory: attrs.LANDUSE_CATEGORY || null,
        generalNotes: attrs.GENERAL_NOTES || null,
        siteplanIssueDate: attrs.SITEPLAN_ISSUE_DATE || null,
        siteplanExpiryDate: attrs.SITEPLAN_EXPIRY_DATE || null,
        siteStatus: attrs.SITE_STATUS || null,
        isFrozen: attrs.IS_FROZEN === 1,
        freezeReason: attrs.FREEZE_REASON || null,
      };
    } catch (error) {
      console.error('Failed to build AP from plot data:', error);
      return null;
    }
  }


  /**
   * Fetch real GIS polygon boundary for a plot in WGS84 coordinates.
   * Returns array of [lat, lng] rings suitable for Leaflet.
   */
  async fetchPlotBoundary(plotNumber: string): Promise<[number, number][][] | null> {
    try {
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/dda-gis-proxy?action=boundary&plotId=${encodeURIComponent(plotNumber)}`,
        {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
            'Content-Type': 'application/json'
          }
        }
      );

      if (!response.ok) return null;
      const data = await response.json();

      if (!data.features || data.features.length === 0) return null;

      const geometry = data.features[0].geometry;
      if (!geometry?.rings || geometry.rings.length === 0) return null;

      // ArcGIS returns [lng, lat] in WGS84 — convert to [lat, lng] for Leaflet
      return geometry.rings.map((ring: number[][]) =>
        ring.map((coord: number[]) => [coord[1], coord[0]] as [number, number])
      );
    } catch (error) {
      console.error('Error fetching plot boundary:', error);
      return null;
    }
  }

  async searchByArea(minArea?: number, maxArea?: number, projectName?: string): Promise<PlotData[]> {
    const cacheKey = `area:${projectName ?? ''}:${minArea ?? ''}:${maxArea ?? ''}`;
    return this.withCache(cacheKey, async () => {
      try {
        const params = new URLSearchParams({ action: 'search' });
        if (minArea !== undefined) params.set('minArea', String(minArea));
        if (maxArea !== undefined) params.set('maxArea', String(maxArea));
        if (projectName) params.set('project', projectName);
        params.set('limit', '100');

        const response = await fetch(
          `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/dda-gis-proxy?${params.toString()}`,
          {
            method: 'GET',
            headers: {
              'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
              'Content-Type': 'application/json'
            }
          }
        );

        if (!response.ok) throw new Error(`Edge function returned ${response.status}`);

        const data = await response.json();
        if (data.features && data.features.length > 0) {
          return this.transformGISData(data.features);
        }
        return [];
      } catch (error) {
        console.error('Error searching by area:', error);
        return [];
      }
    }, 30 * 1000);
  }

  async searchByLocation(lat: number, lng: number, radiusMeters: number = 1000): Promise<PlotData[]> {
    const normalized = normalizeCoordinatesForSearch(lat, lng);
    if (!normalized) {
      console.error('Invalid spatial coordinates for searchByLocation:', { lat, lng });
      return [];
    }

    const cacheKey = `location:${normalized.lat.toFixed(6)}:${normalized.lng.toFixed(6)}:${radiusMeters}`;
    return this.withCache(cacheKey, async () => {
      try {
        const params = new URLSearchParams({
          action: 'spatial',
          lat: normalized.lat.toString(),
          lng: normalized.lng.toString(),
          radius: radiusMeters.toString()
        });

        const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/dda-gis-proxy?${params}`;

        const response = await fetch(url, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
            'Content-Type': 'application/json'
          }
        });

        if (!response.ok) {
          console.error(`Edge function returned ${response.status}`);
          return [];
        }

        const data = await response.json();

        if (!data.features || data.features.length === 0) return [];

        return this.transformGISData(data.features);
      } catch (error) {
        console.error('Error searching by location:', error);
        return [];
      }
    }, 20 * 1000);
  }

  /**
   * Consolidated location search: runs GIS/DDA + DLD Property Status in parallel
   * via the land-matching-wizard edge function and returns merged, deduplicated results.
   */
  async searchByLocationConsolidated(lat: number, lng: number, radiusMeters: number = 1000): Promise<{
    plots: PlotData[];
    metadata: {
      total_count: number;
      gis_dda_count: number;
      property_status_count: number;
      fallback_count: number;
      freehold_enriched_count: number;
      gis_dda_available: boolean;
      property_status_available: boolean;
    };
  }> {
    const normalized = normalizeCoordinatesForSearch(lat, lng);
    if (!normalized) {
      console.error('Invalid coordinates for consolidated search:', { lat, lng });
      return {
        plots: [],
        metadata: {
          total_count: 0,
          gis_dda_count: 0,
          property_status_count: 0,
          fallback_count: 0,
          freehold_enriched_count: 0,
          gis_dda_available: false,
          property_status_available: false,
        },
      };
    }

    const { lat: safeLat, lng: safeLng } = normalized;
    if (safeLat !== lat || safeLng !== lng) {
      console.info('[GIS] Normalized search coordinates', { input: { lat, lng }, normalized });
    }

    const cacheKey = `consolidated:${safeLat.toFixed(6)}:${safeLng.toFixed(6)}:${radiusMeters}`;
    return this.withCache(cacheKey, async () => {
      try {
        const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/land-matching-wizard`;

        const response = await fetch(url, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            latitude: safeLat,
            longitude: safeLng,
            radius_meters: radiusMeters,
          }),
        });

        if (!response.ok) {
          const errBody = await response.json().catch(() => ({}));
          throw new Error(errBody.error || `HTTP ${response.status}`);
        }

        const result = await response.json();

        if (!result.success) {
          throw new Error(result.error || 'Unknown error');
        }

        const rawPlots: any[] = result.data?.plots ?? [];

        const plots: PlotData[] = rawPlots.map((p: any, index: number) => ({
          id: p.land_number || p.plot_id || p.municipality_number || `unknown-${index + 1}`,
          area: p.area_sqm || 0,
          gfa: p.gfa_sqm || 0,
          floors: p.max_height_floors || 'N/A',
          zoning: this.getZoningCategory(p.main_landuse, p.sub_landuse),
          location: p.project_name || p.entity_name || p.area || '',
          x: p.longitude || 0,
          y: p.latitude || 0,
          color: this.getZoningColor(p.main_landuse, p.sub_landuse),
          status: p.land_status || (p.is_frozen ? 'Frozen' : 'Available'),
          constructionCost: this.getConstructionCost(p.main_landuse),
          salePrice: this.getSalePrice(p.main_landuse, p.area_sqm),
          developer: undefined,
          project: p.project_name,
          entity: p.entity_name,
          landUseDetails: p.landuse_details || p.sub_landuse || p.main_landuse || undefined,
          maxHeight: undefined,
          plotCoverage: p.plot_coverage,
          isFrozen: p.is_frozen || false,
          freezeReason: p.freeze_reason,
          constructionStatus: p.construction_status,
          siteStatus: p.site_status,
          municipalityNumber: p.municipality_number,
          rawAttributes: {
            LAND_NUMBER: p.land_number,
            PLOT_ID: p.plot_id,
            MUNICIPALITY_NUMBER: p.municipality_number,
            MAIN_LANDUSE: p.main_landuse,
            SUB_LANDUSE: p.sub_landuse,
            LANDUSE_DETAILS: p.landuse_details,
            data_source_master: p.data_source_master,
            confidence_score: p.confidence_score,
            is_fallback: p.is_fallback,
            land_status_source: p.land_status_source,
            distance_from_center_m: p.distance_from_center_m,
            geometry: p.geometry,
          },
          verificationSource: (p.data_source_master === 'GIS/DDA' ? 'DDA' : 'DLD') as VerificationSource,
          verificationDate: new Date().toISOString(),
        }));

        return {
          plots,
          metadata: {
            total_count: result.metadata?.total_count ?? plots.length,
            gis_dda_count: result.metadata?.gis_dda_count ?? 0,
            property_status_count: result.metadata?.property_status_count ?? 0,
            fallback_count: result.metadata?.fallback_count ?? 0,
            freehold_enriched_count: result.metadata?.freehold_enriched_count ?? 0,
            gis_dda_available: result.metadata?.data_sources?.gis_dda_available ?? false,
            property_status_available: result.metadata?.data_sources?.property_status_available ?? false,
          },
        };
      } catch (error) {
        console.error('Consolidated location search error:', error);
        const plots = await this.searchByLocation(safeLat, safeLng, radiusMeters);
        return {
          plots,
          metadata: {
            total_count: plots.length,
            gis_dda_count: plots.length,
            property_status_count: 0,
            fallback_count: 0,
            freehold_enriched_count: 0,
            gis_dda_available: true,
            property_status_available: false,
          },
        };
      }
    }, 20 * 1000);
  }

  private transformGISData(features: Array<{ attributes: Record<string, unknown>; geometry?: { rings?: number[][][]; x?: number; y?: number } }>): PlotData[] {
    return features.map((feature, index) => {
      const attrs = feature.attributes;
      const geometry = feature.geometry;
      const parseNumber = (value: unknown): number | null => {
        if (typeof value === 'number' && Number.isFinite(value)) return value;
        if (typeof value === 'string' && value.trim()) {
          const parsed = Number(value);
          return Number.isFinite(parsed) ? parsed : null;
        }
        return null;
      };

      const mainLanduse = attrs.MAIN_LANDUSE as string | undefined;
      const subLanduse = attrs.SUB_LANDUSE as string | undefined;
      const areaSqm = attrs.AREA_SQM as number | undefined;
      const areaSqft = attrs.AREA_SQFT as number | undefined;
      const gfaSqm = attrs.GFA_SQM as number | undefined;
      const gfaSqft = attrs.GFA_SQFT as number | undefined;

      // Calculate centroid from geometry rings if available
      let centroidX = parseNumber(geometry?.x) ?? parseNumber(attrs.X_COORDINATE) ?? parseNumber(attrs.CENTROID_X) ?? 0;
      let centroidY = parseNumber(geometry?.y) ?? parseNumber(attrs.Y_COORDINATE) ?? parseNumber(attrs.CENTROID_Y) ?? 0;

      if (geometry?.rings && geometry.rings.length > 0) {
        const ring = geometry.rings[0];
        if (ring.length > 0) {
          const sumX = ring.reduce((acc, coord) => acc + coord[0], 0);
          const sumY = ring.reduce((acc, coord) => acc + coord[1], 0);
          centroidX = sumX / ring.length;
          centroidY = sumY / ring.length;
        }
      }

      return {
        id: (attrs.PLOT_NUMBER as string) || (attrs.LAND_NUMBER as string) || String(attrs.OBJECTID ?? `unknown-${index + 1}`),
        area: areaSqm || (areaSqft ? areaSqft / 10.764 : 0),
        gfa: gfaSqm || (gfaSqft ? gfaSqft / 10.764 : 0),
        floors: (attrs.MAX_HEIGHT_FLOORS as string) || 'G+1',
        zoning: this.getZoningCategory(mainLanduse, subLanduse),
        location: (attrs.PROJECT_NAME as string) || (attrs.ENTITY_NAME as string) || (attrs.LAND_NAME as string) || '',
        x: centroidX,
        y: centroidY,
        color: this.getZoningColor(mainLanduse, subLanduse),
        status: this.getPlotStatus(
          attrs.CONSTRUCTION_STATUS as string | undefined,
          attrs.IS_FROZEN as number | undefined,
          attrs.SITE_STATUS as string | undefined
        ),
        constructionCost: this.getConstructionCost(mainLanduse),
        salePrice: this.getSalePrice(mainLanduse, areaSqm || 0),
        developer: attrs.DEVELOPER_NAME as string | undefined,
        project: attrs.PROJECT_NAME as string | undefined,
        entity: attrs.ENTITY_NAME as string | undefined,
        landUseDetails: attrs.LANDUSE_DETAILS as string | undefined,
        maxHeight: attrs.MAX_HEIGHT_METERS as number | undefined,
        plotCoverage: attrs.MAX_PLOT_COVERAGE as number | undefined,
        isFrozen: (attrs.IS_FROZEN as number) === 1,
        freezeReason: attrs.FREEZE_REASON as string | undefined,
        constructionStatus: attrs.CONSTRUCTION_STATUS as string | undefined,
        siteStatus: attrs.SITE_STATUS as string | undefined,
        rawAttributes: { ...attrs, geometry },
        verificationSource: 'DDA' as VerificationSource,
        verificationDate: new Date().toISOString()
      };
    });
  }

  // Normalize coordinates for display (if needed for non-map views)
  normalizeCoordinate(coord: number, axis: 'x' | 'y'): number {
    // Use wider range for Dubai coordinates (EPSG:3997)
    const minX = 480000;
    const maxX = 520000;
    const minY = 2760000;
    const maxY = 2800000;

    if (axis === 'x') {
      const normalized = ((coord - minX) / (maxX - minX)) * 80 + 10;
      return Math.max(5, Math.min(95, normalized));
    } else {
      const normalized = ((coord - minY) / (maxY - minY)) * 80 + 10;
      return Math.max(5, Math.min(95, normalized));
    }
  }

  private getZoningCategory(mainLanduse?: string, subLanduse?: string): string {
    if (!mainLanduse) return 'Mixed Use';

    const landuse = mainLanduse.toLowerCase();
    if (landuse.includes('residential')) {
      return subLanduse?.toLowerCase().includes('villa') ? 'Residential Villa' : 'Residential Apartments';
    }
    if (landuse.includes('commercial')) return 'Commercial';
    if (landuse.includes('industrial')) return 'Industrial';
    if (landuse.includes('mixed')) return 'Mixed Use';
    return mainLanduse;
  }

  private getZoningColor(mainLanduse?: string, subLanduse?: string): string {
    if (!mainLanduse) return '#10b981';

    const landuse = mainLanduse.toLowerCase();
    if (landuse.includes('residential')) {
      return subLanduse?.toLowerCase().includes('villa') ? '#10b981' : '#ef4444';
    }
    if (landuse.includes('commercial')) return '#3b82f6';
    if (landuse.includes('industrial')) return '#f59e0b';
    if (landuse.includes('mixed')) return '#8b5cf6';
    return '#10b981';
  }

  private getPlotStatus(constructionStatus?: string, isFrozen?: number, siteStatus?: string): string {
    if (isFrozen) return 'Frozen';
    if (siteStatus?.toLowerCase().includes('available')) return 'Available';
    if (constructionStatus?.toLowerCase().includes('complete')) return 'Completed';
    if (constructionStatus?.toLowerCase().includes('progress')) return 'Under Construction';
    return 'Available';
  }

  private getConstructionCost(landuse?: string): number {
    const costs: Record<string, number> = {
      'residential': 800,
      'commercial': 1200,
      'industrial': 600,
      'mixed': 1000
    };

    if (!landuse) return 800;
    const key = landuse.toLowerCase();
    const matchingKey = Object.keys(costs).find(k => key.includes(k));
    return matchingKey ? costs[matchingKey] : 800;
  }

  private getSalePrice(landuse?: string, area?: number): number {
    const basePrices: Record<string, number> = {
      'residential': 1500,
      'commercial': 2500,
      'industrial': 1000,
      'mixed': 2000
    };

    if (!landuse) return 1500;
    const key = landuse.toLowerCase();
    const matchingKey = Object.keys(basePrices).find(k => key.includes(k));
    const basePrice = matchingKey ? basePrices[matchingKey] : 1500;

    const areaFactor = (area || 850) > 2000 ? 1.2 : (area || 850) > 1000 ? 1.1 : 1.0;
    return basePrice * areaFactor;
  }
}

export const gisService = new DDAGISService();

export function calculateFeasibility(plot: PlotData): FeasibilityResult {
  const gfaSqft = plot.gfa * 10.764;
  const cost = gfaSqft * plot.constructionCost;
  const revenue = gfaSqft * plot.salePrice;
  const profit = revenue - cost;
  const roi = (profit / cost) * 100;

  let score = roi * 1.5;

  if (plot.status === 'Frozen') score *= 0.3;
  if (plot.status === 'Under Construction') score *= 0.8;
  if (plot.status === 'Completed') score *= 1.2;

  if (plot.area > 2000) score *= 1.1;
  if (plot.zoning.includes('Commercial')) score *= 1.15;
  if (plot.zoning.includes('Mixed')) score *= 1.2;

  return {
    revenue,
    cost,
    profit,
    roi: parseFloat(roi.toFixed(1)),
    score: Math.min(100, Math.max(0, score)),
    paybackPeriod: (cost / (profit / 12)).toFixed(1),
    profitMargin: ((profit / revenue) * 100).toFixed(1),
    riskLevel: plot.status === 'Frozen' ? 'High' : plot.status === 'Under Construction' ? 'Medium' : 'Low'
  };
}

// DLD Fallback Service
export interface DLDResponse {
  plotNumber: string;
  municipalityNumber: string;
  subNumber: string;
  status: string | null;
  location: string | null;
  registrationConfirmed: boolean;
  verificationDate: string;
  source: 'DLD';
}

class DLDFallbackService {
  private cache = new Map<string, { data: DLDResponse; timestamp: number }>();
  private readonly CACHE_TTL_MS = 30 * 60 * 1000; // 30 minutes

  async lookupPlot(plotNumber: string): Promise<DLDResponse | null> {
    // Check local cache first
    const cached = this.cache.get(plotNumber);
    if (cached && Date.now() - cached.timestamp < this.CACHE_TTL_MS) {
      return cached.data;
    }

    try {

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/dld-status-proxy?action=lookup&plotNumber=${encodeURIComponent(plotNumber)}`,
        {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
            'Content-Type': 'application/json'
          }
        }
      );

      if (!response.ok) {
        console.warn(`DLD lookup failed: ${response.status}`);
        return null;
      }

      const result = await response.json();

      if (result.success && result.data) {
        this.cache.set(plotNumber, { data: result.data, timestamp: Date.now() });
        return result.data;
      }

      return null;
    } catch (error) {
      console.error('DLD fallback error:', error);
      return null;
    }
  }

  parsePlotNumber(plotNumber: string): { municipality: string; sub: string } {
    const cleaned = plotNumber.replace(/[^0-9]/g, '');

    if (cleaned.length === 7) {
      return {
        municipality: cleaned.substring(0, 3),
        sub: cleaned.substring(3, 7)
      };
    } else if (cleaned.length >= 4 && cleaned.length <= 10) {
      const municipality = cleaned.substring(0, 3);
      const sub = cleaned.substring(3).padStart(4, '0');
      return { municipality, sub };
    }

    return { municipality: cleaned, sub: '' };
  }
}

export const dldService = new DLDFallbackService();
