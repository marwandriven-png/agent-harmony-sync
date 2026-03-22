/**
 * VillaMapView v3 — Strict class-based pin rendering
 *
 * Rules:
 *  1. Every classification has ONE distinct color + short text label
 *  2. Plots with NO classification → NO PIN rendered (when intel is loaded)
 *  3. When a class filter is active → show ONLY pins matching that class
 *     (GIS orange diamonds also hidden when a class filter is on)
 *  4. No emoji icons for Open View / Backs Open (renders as broken image on some systems)
 *  5. All colors are pure CSS — no emoji fallback
 *
 * Classification color palette:
 *   Back-to-Back  → #ef4444  (red)    badge: B2B
 *   End Unit      → #7c3aed  (violet) badge: EU
 *   Single Row    → #10b981  (emerald)badge: SR
 *   Corner        → #3b82f6  (blue)   badge: C
 *   Backs Park    → #059669  (teal)   badge: PK
 *   Backs Road    → #d97706  (amber)  badge: RD
 *   Open View     → #0284c7  (sky)    badge: OV
 *   Vastu         → #db2777  (pink)   badge: V✓
 *   GIS Plot      → shown only when NO class filter is active
 */
import { useEffect, useRef, memo } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import type { CommunityVilla, VillaSearchFilters } from '@/hooks/useVillas';
import type { VillaIntelligence } from '@/hooks/usePropertyIntelligence';
import type { GISSearchResult } from '@/hooks/useVillaGISSearch';
import { normalizeCoordinatesForSearch } from '@/services/DDAGISService';
import { AMENITY_CONFIG, type DetectedAmenity } from '@/services/PropertyIntelligenceService';
import { haversineDistance } from '@/lib/geo';
import { VILLA_CLASSES as _VILLA_CLASSES, resolveVillaClass as _resolveVillaClass, type VillaClass } from '@/services/property-intelligence/classify-class';

// ─── Types ───────────────────────────────────────────────────────────────────

interface VillaMapViewProps {
  villas:           CommunityVilla[];
  selectedVillaId:  string | null;
  onSelectVilla:    (id: string) => void;
  onRadiusSearch?:  (lat: number, lng: number, radiusM: number) => void;
  searchCenter?:    { lat: number; lng: number } | null;
  searchRadius?:    number;
  matchedVillaIds?: Set<string>;
  gisResults?:      GISSearchResult[];
  amenities?:       DetectedAmenity[];
  intelligenceMap?: Map<string, VillaIntelligence>;
  activeFilters?:   VillaSearchFilters;
  plotCoordinateLookup?: Map<string, { lat: number; lng: number }>;
}

// ─── Classification palette ───────────────────────────────────────────────────
// Single source of truth — ALL colors defined here, nowhere else

export type { VillaClass } from '@/services/property-intelligence/classify-class';

export const VILLA_CLASSES = _VILLA_CLASSES;

/**
 * Resolve classification for a villa. Returns null when:
 *  - intel is loaded (intelLoaded=true) AND no class matched
 *  - Caller should SKIP the pin entirely
 */
export const resolveVillaClass = _resolveVillaClass;

/** Returns true when at least one intelligence-related filter is active */
function hasActiveClassFilter(f: VillaSearchFilters | undefined): boolean {
  if (!f) return false;
  return !!(
    f.isCorner || f.isEndUnit || f.isBackToBack || f.isSingleRow ||
    f.backsPark || f.backsRoad || f.backsOpenSpace ||
    f.vastuCompliant ||
    f.nearPool || f.nearSchool || f.nearEntrance ||
    (f.nearAmenity?.length ?? 0) > 0
  );
}

function hasVastu(villa: CommunityVilla, intel: VillaIntelligence | undefined): boolean {
  return !!(intel?.tags.some(t => t.label.includes('Vastu')) || villa.vastu_compliant);
}

function matchesCorner(villa: CommunityVilla, intel: VillaIntelligence | undefined): boolean {
  return intel?.layout.positionType === 'corner' || villa.is_corner;
}

function matchesEndUnit(villa: CommunityVilla, intel: VillaIntelligence | undefined): boolean {
  if (matchesCorner(villa, intel)) return false;
  return intel?.layout.positionType === 'end' || villa.position_type === 'end';
}

function matchesBackToBack(intel: VillaIntelligence | undefined): boolean {
  return intel?.layout.layoutType === 'back_to_back';
}

function matchesSingleRow(villa: CommunityVilla, intel: VillaIntelligence | undefined): boolean {
  if (intel?.layout.layoutType === 'back_to_back') return false;
  return intel?.layout.layoutType === 'single_row' || villa.is_single_row;
}

function matchesBacksPark(villa: CommunityVilla, intel: VillaIntelligence | undefined): boolean {
  // backFacing='park' and B2B are independent. A row can back a park AND be B2B.
  return intel?.layout.backFacing === 'park' || villa.backs_park;
}

function matchesBacksRoad(villa: CommunityVilla, intel: VillaIntelligence | undefined): boolean {
  // backFacing='road' and B2B are independent.
  return intel?.layout.backFacing === 'road' || villa.backs_road;
}

function matchesOpenView(intel: VillaIntelligence | undefined): boolean {
  return intel?.layout.backFacing === 'open_space';
}

function resolveDisplayedClass(
  villa: CommunityVilla,
  intel: VillaIntelligence | undefined,
  intelLoaded: boolean,
  filters: VillaSearchFilters | undefined,
): VillaClass | null {
  const primary = resolveVillaClass(villa, intel, intelLoaded);

  if (!filters || !hasActiveClassFilter(filters)) return primary;

  const matchedFilteredClass: VillaClass[] = [];

  if (filters.backsPark && matchesBacksPark(villa, intel)) matchedFilteredClass.push(VILLA_CLASSES.backs_park);
  if (filters.backsRoad && matchesBacksRoad(villa, intel)) matchedFilteredClass.push(VILLA_CLASSES.backs_road);
  if (filters.backsOpenSpace && matchesOpenView(intel)) matchedFilteredClass.push(VILLA_CLASSES.open_view);
  if (filters.isCorner && matchesCorner(villa, intel)) matchedFilteredClass.push(VILLA_CLASSES.corner);
  if (filters.isEndUnit && matchesEndUnit(villa, intel)) matchedFilteredClass.push(VILLA_CLASSES.end_unit);
  if (filters.isBackToBack && matchesBackToBack(intel)) matchedFilteredClass.push(VILLA_CLASSES.back_to_back);
  if (filters.isSingleRow && matchesSingleRow(villa, intel)) matchedFilteredClass.push(VILLA_CLASSES.single_row);
  if (filters.vastuCompliant && hasVastu(villa, intel)) matchedFilteredClass.push(VILLA_CLASSES.vastu);

  if (matchedFilteredClass.length > 0) return matchedFilteredClass[0];

  const hasExplicitClassToggle = !!(
    filters.isCorner || filters.isEndUnit || filters.isBackToBack || filters.isSingleRow ||
    filters.backsPark || filters.backsRoad || filters.backsOpenSpace || filters.vastuCompliant
  );

  if (hasExplicitClassToggle) return null;

  return primary;
}

// ─── Pin SVG builders ─────────────────────────────────────────────────────────

/** Pill-shaped badge pin with text label */
function buildClassPin(cls: VillaClass, selected = false): string {
  const fill   = cls.fill;
  const ring   = cls.ring;
  const badge  = cls.badge;
  const w = badge.length <= 2 ? 34 : 42;
  const h = 22;
  const r = h / 2;
  const glow = selected
    ? `filter:drop-shadow(0 0 6px ${fill}cc) drop-shadow(0 2px 4px rgba(0,0,0,0.6))`
    : 'filter:drop-shadow(0 2px 4px rgba(0,0,0,0.55))';
  const sw = selected ? 2.5 : 1.8;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h+7}" style="${glow}">
    <rect x="1" y="1" width="${w-2}" height="${h-2}" rx="${r}"
          fill="${fill}" stroke="${ring}" stroke-width="${sw}"/>
    <text x="${w/2}" y="${h/2+4}" text-anchor="middle"
          font-family="system-ui,-apple-system,'Helvetica Neue',sans-serif"
          font-size="${badge.length <= 2 ? 10 : 8}" font-weight="900"
          fill="#fff" letter-spacing="-0.3">${badge}</text>
    <polygon points="${w/2-4},${h} ${w/2+4},${h} ${w/2},${h+7}" fill="${fill}"/>
  </svg>`;
}

/** Small diamond for GIS plot matches */
function buildGisDiamond(): string {
  const s = 18;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${s}" height="${s}"
    style="filter:drop-shadow(0 1px 3px rgba(0,0,0,0.45))">
    <rect x="${s*0.18}" y="${s*0.18}" width="${s*0.64}" height="${s*0.64}" rx="2"
          fill="#ea580c" stroke="#fed7aa" stroke-width="1.5"
          transform="rotate(45 ${s/2} ${s/2})"/>
  </svg>`;
}

/** Neutral pin for filtered matches that don't have a resolved class yet */
function buildFallbackMatchPin(selected = false): string {
  const glow = selected
    ? 'filter:drop-shadow(0 0 6px rgba(255,255,255,0.5)) drop-shadow(0 2px 4px rgba(0,0,0,0.6))'
    : 'filter:drop-shadow(0 2px 4px rgba(0,0,0,0.55))';

  return `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" style="${glow}">
    <circle cx="9" cy="9" r="6.5" fill="#0f172a" stroke="#e2e8f0" stroke-width="2" />
    <circle cx="9" cy="9" r="2.25" fill="#ffffff" />
  </svg>`;
}

// ─── Popup ─────────────────────────────────────────────────────────────────

function buildPopup(
  villa: CommunityVilla,
  cls: VillaClass | null,
  intel: VillaIntelligence | undefined,
  dist: number | undefined,
): string {
  const tags = intel?.tags ?? [];
  const classTags   = tags.filter(t => t.category !== 'amenity');
  const amenTags    = tags.filter(t => t.category === 'amenity').slice(0, 4);
  const allTags     = [...classTags, ...amenTags];

  const tagHtml = allTags.map(t =>
    `<span style="display:inline-flex;align-items:center;gap:2px;padding:2px 6px;border-radius:99px;
      background:rgba(255,255,255,0.07);border:1px solid rgba(255,255,255,0.12);
      font-size:9px;font-weight:700;color:#e2e8f0">${t.emoji}&nbsp;${t.label}</span>`
  ).join('');

  const classBadge = cls
    ? `<span style="padding:2px 8px;border-radius:99px;background:${cls.fill}33;
        border:1px solid ${cls.fill}66;font-size:9px;font-weight:800;color:${cls.ring}">
        ${cls.badge}&nbsp;${cls.label}</span>`
    : '';

  const distStr = dist != null
    ? `<div style="font-size:9px;color:#22d3ee;margin-top:5px">
        \u{1F4CD} ${dist < 1000 ? `${Math.round(dist)}m` : `${(dist/1000).toFixed(1)}km`} from center
       </div>` : '';

  const isGis = villa.villa_number.startsWith('gis:');
  const title = isGis ? `Plot ${villa.plot_number ?? villa.villa_number}` : `Villa ${villa.villa_number}`;

  return `<div style="font-family:system-ui,-apple-system,sans-serif;min-width:210px;padding:0">
    <div style="display:flex;align-items:center;gap:8px;margin-bottom:5px;flex-wrap:wrap">
      <span style="font-size:13px;font-weight:800;color:#fff">${title}</span>
      ${classBadge}
    </div>
    <div style="font-size:10px;color:#9ca3af;margin-bottom:5px">
      ${villa.community_name}${villa.cluster_name ? ` \u00b7 ${villa.cluster_name}` : ''}
      ${villa.plot_number && !isGis ? ` \u00b7 Plot&nbsp;${villa.plot_number}` : ''}
    </div>
    ${allTags.length ? `<div style="display:flex;flex-wrap:wrap;gap:3px;margin-bottom:5px">${tagHtml}</div>` : ''}
    <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:4px;
          padding-top:5px;border-top:1px solid rgba(255,255,255,0.07)">
      <div>
        <div style="font-size:7px;color:#6b7280;text-transform:uppercase">Size</div>
        <div style="font-size:10px;color:#d1d5db;font-weight:600">
          ${villa.plot_size_sqft ? villa.plot_size_sqft.toLocaleString() + ' ft\u00b2' : '\u2014'}
        </div>
      </div>
      <div>
        <div style="font-size:7px;color:#6b7280;text-transform:uppercase">BR</div>
        <div style="font-size:10px;color:#d1d5db;font-weight:600">${villa.bedrooms ?? '\u2014'}</div>
      </div>
      <div style="text-align:right">
        <div style="font-size:7px;color:#6b7280;text-transform:uppercase">Facing</div>
        <div style="font-size:10px;color:#d1d5db;font-weight:600">${villa.facing_direction ?? '\u2014'}</div>
      </div>
    </div>
    ${distStr}
  </div>`;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const DUBAI_CENTER: [number, number] = [25.2048, 55.2708];

const COMMUNITY_CENTERS: Record<string, [number, number]> = {
  'arabian ranches':        [25.0580, 55.2700],
  'arabian ranches 2':      [25.0500, 55.2800],
  'arabian ranches 3':      [25.0450, 55.2750],
  'meadows':                [25.0450, 55.1650],
  'springs':                [25.0500, 55.1550],
  'lakes':                  [25.0580, 55.1580],
  'al barari':              [25.0880, 55.2800],
  'damac hills':            [25.0300, 55.2300],
  'dubai hills':            [25.1180, 55.2400],
  'palm jumeirah':          [25.1124, 55.1390],
  'jumeirah park':          [25.0400, 55.1500],
  'mudon':                  [25.0250, 55.2700],
  'villanova':              [25.0350, 55.2900],
  'town square':            [25.0150, 55.2500],
  'tilal al ghaf':          [25.0650, 55.2400],
};

export function getVillaPosition(
  villa: CommunityVilla,
  idx: number,
  plotCoordinateLookup?: Map<string, { lat: number; lng: number }>,
): [number, number] {
  if (villa.latitude && villa.longitude) return [villa.latitude, villa.longitude];
  const linkedPlotId = villa.plot_number ?? villa.plot_id ?? (villa.villa_number.startsWith('gis:') ? villa.villa_number.replace(/^gis:/, '') : null);
  if (linkedPlotId) {
    const linkedCoords = plotCoordinateLookup?.get(linkedPlotId);
    if (linkedCoords) return [linkedCoords.lat, linkedCoords.lng];
  }
  const key = Object.keys(COMMUNITY_CENTERS).find(k => villa.community_name.toLowerCase().includes(k));
  if (key) {
    const b = COMMUNITY_CENTERS[key];
    const h = villa.villa_number.split('').reduce((a, c) => a + c.charCodeAt(0), 0);
    return [b[0] + ((h % 60) - 30) * 0.0003, b[1] + ((h % 47) - 23) * 0.0004];
  }
  return [DUBAI_CENTER[0] + ((idx % 50) - 25) * 0.001, DUBAI_CENTER[1] + (Math.floor(idx / 50) - 5) * 0.001];
}

function offsetM(lat: number, lng: number, m: number, deg: number) {
  const R = 6378137, b = deg * Math.PI / 180, f1 = lat * Math.PI / 180, l1 = lng * Math.PI / 180;
  const d = m / R;
  const f2 = Math.asin(Math.sin(f1) * Math.cos(d) + Math.cos(f1) * Math.sin(d) * Math.cos(b));
  const l2 = l1 + Math.atan2(Math.sin(b) * Math.sin(d) * Math.cos(f1), Math.cos(d) - Math.sin(f1) * Math.sin(f2));
  return { lat: f2 * 180 / Math.PI, lng: l2 * 180 / Math.PI };
}

// ─── Component ───────────────────────────────────────────────────────────────

export const VillaMapView = memo(function VillaMapView({
  villas, selectedVillaId, onSelectVilla, onRadiusSearch,
  searchCenter, searchRadius = 1000, matchedVillaIds,
  gisResults = [], amenities = [], intelligenceMap, activeFilters, plotCoordinateLookup,
}: VillaMapViewProps) {
  const containerRef      = useRef<HTMLDivElement>(null);
  const mapRef            = useRef<L.Map | null>(null);
  const villaLayerRef     = useRef<L.LayerGroup | null>(null);
  const markerMapRef      = useRef<Map<string, L.Marker>>(new Map());
  const radiusLayerRef    = useRef<L.LayerGroup | null>(null);
  const gisLayerRef       = useRef<L.LayerGroup | null>(null);
  const amenityLayerRef   = useRef<L.LayerGroup | null>(null);
  const pinMarkerRef      = useRef<L.Marker | null>(null);
  const onSelectRef       = useRef(onSelectVilla);
  const onRadiusRef       = useRef(onRadiusSearch);
  onSelectRef.current     = onSelectVilla;
  onRadiusRef.current     = onRadiusSearch;

  // ── Map init ───────────────────────────────────────────────────────────
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    const map = L.map(containerRef.current, {
      center: DUBAI_CENTER, zoom: 11,
      zoomControl: false, attributionControl: false,
      preferCanvas: true,
      maxBounds: [[22.5, 51.0], [26.5, 56.5]],
      maxBoundsViscosity: 0.9, minZoom: 8, maxZoom: 19,
    });
    L.tileLayer(
      'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
      { maxZoom: 19, noWrap: true, updateWhenIdle: true }
    ).addTo(map);
    L.control.zoom({ position: 'topleft' }).addTo(map);

    villaLayerRef.current   = L.layerGroup().addTo(map);
    radiusLayerRef.current  = L.layerGroup().addTo(map);
    gisLayerRef.current     = L.layerGroup().addTo(map);
    amenityLayerRef.current = L.layerGroup().addTo(map);
    mapRef.current = map;

    // Right-click → radius search popup
    map.on('contextmenu', (e: L.LeafletMouseEvent) => {
      const { lat, lng } = e.latlng;
      if (pinMarkerRef.current) map.removeLayer(pinMarkerRef.current);
      const icon = L.divIcon({
        html: `<div style="width:22px;height:22px;background:hsl(82,84%,50%);border:3px solid #fff;
               border-radius:50%;box-shadow:0 2px 8px rgba(0,0,0,0.5)"></div>`,
        className: '', iconSize: [22, 22], iconAnchor: [11, 11],
      });
      const pin = L.marker([lat, lng], { icon }).addTo(map);
      pinMarkerRef.current = pin;
      pin.bindPopup(`
        <div style="font-family:system-ui;min-width:160px">
          <div style="font-size:12px;font-weight:700;color:#fff;margin-bottom:6px">Radius Search</div>
          <div style="font-size:9px;color:#9ca3af;margin-bottom:8px">${lat.toFixed(5)}, ${lng.toFixed(5)}</div>
          <div style="display:flex;gap:4px;flex-wrap:wrap">
            ${[100, 200, 500, 1000, 2000].map(r =>
              `<button onclick="window.__vrs(${lat},${lng},${r})"
                style="background:hsl(82,84%,45%);color:#000;border:none;padding:3px 8px;
                border-radius:4px;font-size:9px;font-weight:700;cursor:pointer">
                ${r < 1000 ? r + 'm' : (r / 1000) + 'km'}</button>`
            ).join('')}
          </div>
        </div>`, { className: 'villa-map-popup', maxWidth: 200, closeButton: true }).openPopup();
      (window as any).__vrs = (la: number, ln: number, ra: number) => onRadiusRef.current?.(la, ln, ra);
    });

    const ro = new ResizeObserver(() => map.invalidateSize());
    ro.observe(containerRef.current!);
    return () => { ro.disconnect(); map.remove(); mapRef.current = null; };
  }, []);

  // ── Radius wave ────────────────────────────────────────────────────────
  useEffect(() => {
    const rl = radiusLayerRef.current, map = mapRef.current;
    if (!rl || !map) return;
    rl.clearLayers();
    if (!searchCenter) return;
    const { lat, lng } = searchCenter;
    L.circleMarker([lat, lng], { radius: 4, color: '#fff', fillColor: '#cbd5e1', fillOpacity: 1, weight: 1.5, interactive: false }).addTo(rl);
    L.circle([lat, lng], { radius: searchRadius, color: 'rgba(191,255,0,0.75)', fillColor: 'rgba(191,255,0,0.06)', fillOpacity: 1, weight: 2.5 }).addTo(rl);
    map.flyToBounds(L.latLng(lat, lng).toBounds(searchRadius * 2.2), { duration: 0.8, padding: [30, 30] });
  }, [searchCenter, searchRadius]);

  // ── Villa classification pins ──────────────────────────────────────────
  useEffect(() => {
    const lg = villaLayerRef.current;
    if (!lg) return;
    lg.clearLayers();
    markerMapRef.current.clear();

    const intelLoaded = (intelligenceMap?.size ?? 0) > 0;
    const duplicatePositionCounts = new Map<string, number>();

    villas.forEach((villa, idx) => {
      const intel = intelligenceMap?.get(villa.id);
      const cls   = resolveDisplayedClass(villa, intel, intelLoaded, activeFilters);

      const basePos   = getVillaPosition(villa, idx, plotCoordinateLookup);
      const posKey    = `${basePos[0].toFixed(6)}:${basePos[1].toFixed(6)}`;
      const dupIndex  = duplicatePositionCounts.get(posKey) ?? 0;
      duplicatePositionCounts.set(posKey, dupIndex + 1);
      const posObject = dupIndex > 0
        ? offsetM(basePos[0], basePos[1], dupIndex * 7, (dupIndex * 47) % 360)
        : { lat: basePos[0], lng: basePos[1] };
      const pos: [number, number] = [posObject.lat, posObject.lng];
      const isMatch  = matchedVillaIds?.has(villa.id) ?? false;
      const selected = villa.id === selectedVillaId;
      const dist     = searchCenter ? haversineDistance(searchCenter.lat, searchCenter.lng, basePos[0], basePos[1]) : undefined;

      const html  = cls ? buildClassPin(cls, selected || isMatch) : buildFallbackMatchPin(selected || isMatch);
      const w     = cls ? (cls.badge.length <= 2 ? 34 : 42) : 18;
      const h     = cls ? 29 : 18;

      const icon = L.divIcon({
        html,
        className: 'villa-class-pin',
        iconSize:   [w, h],
        iconAnchor: [w / 2, h],
        popupAnchor:[0, -h],
      });

      const marker = L.marker(pos, {
        icon,
        zIndexOffset: isMatch ? 1200 : selected ? 1100 : 900,
      });

      marker.on('click', () => onSelectRef.current(villa.id));
      marker.bindPopup(buildPopup(villa, cls, intel, dist), {
        className: 'villa-map-popup', maxWidth: 250, closeButton: true, autoPan: true,
      });
      marker.bindTooltip(
        `<strong style="color:${cls?.fill ?? '#e2e8f0'}">${cls?.label ?? 'Matched Result'}</strong>&nbsp;&mdash;&nbsp;${
          villa.villa_number.startsWith('gis:') ? `Plot ${villa.plot_number}` : `Villa ${villa.villa_number}`
        }`,
        { direction: 'top', className: 'villa-tooltip', offset: [0, -h], permanent: false }
      );

      lg.addLayer(marker);
      markerMapRef.current.set(villa.id, marker);
    });
  }, [villas, searchCenter, matchedVillaIds, intelligenceMap, selectedVillaId, activeFilters, plotCoordinateLookup]);

  // ── GIS plot pins (only when no class filter active) ───────────────────
  useEffect(() => {
    const gl = gisLayerRef.current;
    if (!gl) return;
    gl.clearLayers();

    // When user has a class filter on → hide GIS orange diamonds entirely
    if (hasActiveClassFilter(activeFilters)) return;

    const seen     = new Set<string>();
    const dupCount = new Map<string, number>();
    let fi = 0;

    gisResults.forEach(r => {
      if (seen.has(r.plot.id)) return;
      seen.add(r.plot.id);

      let coords = normalizeCoordinatesForSearch(r.plot.y, r.plot.x);
      if (!coords && searchCenter) { fi++; coords = offsetM(searchCenter.lat, searchCenter.lng, 30 + fi * 12, (fi * 137.5) % 360); }
      if (!coords) return;

      const ck = `${coords.lat.toFixed(6)}:${coords.lng.toFixed(6)}`;
      const di = dupCount.get(ck) ?? 0;
      dupCount.set(ck, di + 1);
      const { lat, lng } = di > 0 ? offsetM(coords.lat, coords.lng, di * 8, (di * 47) % 360) : coords;
      const sz = 18;
      const d  = searchCenter ? haversineDistance(searchCenter.lat, searchCenter.lng, lat, lng) : undefined;

      const marker = L.marker([lat, lng], {
        icon: L.divIcon({ html: buildGisDiamond(), className: 'villa-gis-pin', iconSize: [sz, sz], iconAnchor: [sz / 2, sz / 2] }),
        zIndexOffset: 600,
      });

      marker.bindPopup(`
        <div style="font-family:system-ui;min-width:200px">
          <div style="display:flex;align-items:center;gap:6px;margin-bottom:5px">
            <span style="font-size:13px;font-weight:800;color:#fff">Plot ${r.plot.id}</span>
            <span style="font-size:9px;padding:2px 6px;border-radius:99px;
                  background:rgba(234,88,12,0.2);color:#fb923c;font-weight:700">${r.confidenceScore}%</span>
          </div>
          <div style="font-size:9px;color:#9ca3af;margin-bottom:4px">Source: ${r.source}</div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:4px;padding-top:4px;border-top:1px solid rgba(255,255,255,0.08)">
            <div><div style="font-size:7px;color:#6b7280;text-transform:uppercase">Area</div>
              <div style="font-size:10px;color:#d1d5db;font-weight:600">${r.plot.area ? Math.round(r.plot.area).toLocaleString() + ' m\u00b2' : '\u2014'}</div></div>
            <div><div style="font-size:7px;color:#6b7280;text-transform:uppercase">GFA</div>
              <div style="font-size:10px;color:#d1d5db;font-weight:600">${r.plot.gfa ? Math.round(r.plot.gfa).toLocaleString() + ' m\u00b2' : '\u2014'}</div></div>
          </div>
          ${d != null ? `<div style="font-size:9px;color:#22d3ee;margin-top:4px">${d < 1000 ? Math.round(d) + 'm' : (d / 1000).toFixed(1) + 'km'} from center</div>` : ''}
        </div>`, { className: 'villa-map-popup', maxWidth: 230, closeButton: true });

      gl.addLayer(marker);
    });
  }, [gisResults, searchCenter, activeFilters]);

  // ── Amenity icons ──────────────────────────────────────────────────────
  useEffect(() => {
    const al = amenityLayerRef.current;
    if (!al) return;
    al.clearLayers();
    const seen = new Set<string>();
    for (const a of amenities) {
      const key = a.plotId || `${a.coordinates[0].toFixed(5)},${a.coordinates[1].toFixed(5)}`;
      if (seen.has(key)) continue; seen.add(key);
      const cfg = AMENITY_CONFIG[a.type]; if (!cfg) continue;
      const [lat, lng] = a.coordinates;
      const icon = L.divIcon({
        html: `<div style="width:26px;height:26px;border-radius:50%;background:${cfg.mapColor};
               border:2px solid rgba(255,255,255,0.9);box-shadow:0 2px 6px rgba(0,0,0,0.4);
               display:flex;align-items:center;justify-content:center;
               font-family:system-ui;font-size:13px;font-weight:900;color:#fff">
               ${cfg.emoji}</div>`,
        className: 'villa-amenity-icon', iconSize: [26, 26], iconAnchor: [13, 13],
      });
      const m = L.marker([lat, lng], { icon, zIndexOffset: 500 });
      m.bindTooltip(`${cfg.label} \u2014 ${a.distanceMeters}m`, { direction: 'top', className: 'villa-tooltip', offset: [0, -15] });
      al.addLayer(m);
    }
  }, [amenities]);

  // ── Auto-fit to GIS results when no explicit center ────────────────────
  useEffect(() => {
    const map = mapRef.current;
    if (!map || searchCenter || gisResults.length === 0) return;
    const pts = gisResults.map(r => normalizeCoordinatesForSearch(r.plot.y, r.plot.x)).filter(Boolean) as { lat: number; lng: number }[];
    if (!pts.length) return;
    map.flyToBounds(L.latLngBounds(pts.map(p => [p.lat, p.lng] as [number, number])).pad(0.15), { duration: 0.7, padding: [30, 30] });
  }, [gisResults, searchCenter]);

  // ── Fly to selected villa ──────────────────────────────────────────────
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !selectedVillaId) return;
    const m = markerMapRef.current.get(selectedVillaId);
    if (m) { map.flyTo(m.getLatLng(), 16, { duration: 0.5 }); m.openPopup(); }
  }, [selectedVillaId]);

  // ── Build legend (only active classes) ────────────────────────────────
  const filterOn    = hasActiveClassFilter(activeFilters);
  const classCounts: Record<string, number> = {};
  let unclassifiedCount = 0;
  if (intelligenceMap) {
    const intelLoaded = intelligenceMap.size > 0;
    for (const villa of villas) {
      const intel = intelligenceMap.get(villa.id);
      const cls   = resolveDisplayedClass(villa, intel, intelLoaded, activeFilters);
      if (!cls) {
        unclassifiedCount += 1;
        continue;
      }
      classCounts[cls.key] = (classCounts[cls.key] ?? 0) + 1;
    }
  }
  const legendItems = Object.values(VILLA_CLASSES).filter(c => (classCounts[c.key] ?? 0) > 0);

  return (
    <>
      <div ref={containerRef} className="absolute inset-0 min-h-0" style={{ background: 'hsl(220,20%,8%)' }} />

      {searchCenter && (
        <div className="absolute top-3 left-1/2 -translate-x-1/2 z-[500] bg-[hsl(220,25%,10%,0.95)] border border-[hsl(220,20%,26%)] rounded-lg px-4 py-2 backdrop-blur-sm flex items-center gap-3">
          <div className="h-2 w-2 rounded-full bg-[hsl(0,0%,80%)]" />
          <span className="text-[11px] text-[hsl(220,10%,78%)] font-medium">
            Radius Search Active &bull; {searchRadius >= 1000 ? `${(searchRadius / 1000).toFixed(1)}km` : `${searchRadius}m`}
          </span>
          <span className="text-[10px] text-[hsl(220,10%,50%)]">
            {searchCenter.lat.toFixed(4)}, {searchCenter.lng.toFixed(4)}
          </span>
        </div>
      )}

      {/* Classification legend */}
      <div className="absolute bottom-4 left-4 z-[500] bg-[hsl(220,25%,10%,0.93)] border border-[hsl(220,20%,18%)] rounded-xl p-3 backdrop-blur-sm min-w-[145px]">
        <div className="text-[8px] text-[hsl(220,10%,42%)] uppercase tracking-wider mb-2 font-semibold">Classification</div>
        <div className="space-y-1.5">
          {!filterOn && gisResults.length > 0 && (
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 shrink-0 rotate-45 rounded-sm" style={{ background: '#ea580c', border: '1.5px solid #fed7aa' }} />
              <span className="text-[9px] text-[hsl(220,10%,62%)]">GIS Plot ({gisResults.length})</span>
            </div>
          )}
          {legendItems.length > 0
            ? legendItems.map(cls => (
                <div key={cls.key} className="flex items-center gap-2">
                  <div className="shrink-0 px-1.5 h-[16px] rounded flex items-center"
                       style={{ background: cls.fill, border: `1px solid ${cls.ring}` }}>
                    <span className="text-[7px] font-black text-white leading-none tracking-tight">{cls.badge}</span>
                  </div>
                  <span className="text-[9px] text-[hsl(220,10%,62%)]">
                    {cls.label}
                    <span className="text-[hsl(220,10%,38%)] ml-1">({classCounts[cls.key]})</span>
                  </span>
                </div>
              ))
            : (
                <div className="text-[9px] text-[hsl(220,10%,38%)] italic">
                  {(intelligenceMap?.size ?? 0) === 0 ? 'Classifying\u2026' : 'No classes detected'}
                </div>
              )
          }
          {unclassifiedCount > 0 && (
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 shrink-0 rounded-full border-2 border-[hsl(220,20%,92%)] bg-[hsl(220,35%,12%)]" />
              <span className="text-[9px] text-[hsl(220,10%,62%)]">
                Matched Result
                <span className="text-[hsl(220,10%,38%)] ml-1">({unclassifiedCount})</span>
              </span>
            </div>
          )}
        </div>
        {amenities.length > 0 && (
          <div className="mt-2 pt-1.5 border-t border-[hsl(220,20%,14%)] space-y-1">
            <div className="text-[8px] text-[hsl(220,10%,42%)] uppercase tracking-wider font-semibold">Amenities</div>
            {Array.from(new Set(amenities.map(a => a.type))).slice(0, 4).map(t => {
              const cfg = AMENITY_CONFIG[t];
              return (
                <div key={t} className="flex items-center gap-1.5">
                  <span className="text-[11px]">{cfg.emoji}</span>
                  <span className="text-[9px] text-[hsl(220,10%,62%)]">{cfg.label}</span>
                </div>
              );
            })}
          </div>
        )}
        <div className="text-[8px] text-[hsl(220,10%,35%)] mt-2 pt-1.5 border-t border-[hsl(220,20%,12%)]">
          Right-click \u2192 Drop pin \u2192 Radius search
        </div>
      </div>

      <style>{`
        .villa-map-popup .leaflet-popup-content-wrapper {
          background: hsl(220,25%,10%); border: 1px solid hsl(220,20%,18%);
          border-radius: 12px; box-shadow: 0 12px 40px rgba(0,0,0,0.5);
          color: white; padding: 0;
        }
        .villa-map-popup .leaflet-popup-content { margin: 12px 14px; line-height: 1.4; }
        .villa-map-popup .leaflet-popup-tip { background: hsl(220,25%,10%); }
        .villa-map-popup .leaflet-popup-close-button { color:#6b7280!important; font-size:16px!important; top:6px!important; right:8px!important; }
        .villa-map-popup .leaflet-popup-close-button:hover { color:#fff!important; }
        .villa-class-pin { cursor:pointer; transition:transform 0.12s ease, filter 0.12s; }
        .villa-class-pin:hover { transform:scale(1.18) translateY(-2px); filter:brightness(1.15); }
        .villa-gis-pin { cursor:pointer; transition:transform 0.1s; }
        .villa-gis-pin:hover { transform:scale(1.25); }
        .villa-amenity-icon { cursor:pointer; transition:transform 0.12s; }
        .villa-amenity-icon:hover { transform:scale(1.2); }
        .villa-tooltip {
          background:hsl(220,25%,10%)!important; border:1px solid hsl(220,20%,24%)!important;
          color:#e2e8f0!important; font-size:11px!important; font-weight:600!important;
          border-radius:6px!important; padding:3px 8px!important; white-space:nowrap!important;
        }
        .villa-tooltip::before { display:none!important; }
      `}</style>
    </>
  );
});
