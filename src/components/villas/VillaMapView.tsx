/**
 * VillaMapView — Leaflet map with full intelligence-classified pins.
 *
 * Every classification gets a UNIQUE color + labeled badge pin:
 *   Corner        → Blue    📐
 *   End Unit      → Violet  ↔️
 *   Single Row    → Emerald 🏡
 *   Back-to-Back  → Red     🏘️
 *   Backs Park    → Teal    🌳
 *   Backs Road    → Amber   🛣
 *   Open View     → Sky     🏞
 *   Vastu         → Pink    🧭
 *   GIS Plot      → Orange  📍
 *   Available     → Gray    ●  (no classification yet)
 *
 * Rule: if intel is loaded and a villa has NO matched class → pin is hidden.
 */
import { useEffect, useRef, memo } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import type { CommunityVilla } from '@/hooks/useVillas';
import type { VillaIntelligence } from '@/hooks/usePropertyIntelligence';
import type { GISSearchResult } from '@/hooks/useVillaGISSearch';
import { normalizeCoordinatesForSearch } from '@/services/DDAGISService';
import { AMENITY_CONFIG, type DetectedAmenity } from '@/services/PropertyIntelligenceService';
import { haversineDistance } from '@/lib/geo';

// ─── Types ───────────────────────────────────────────────────────────────────

interface VillaMapViewProps {
  villas:           CommunityVilla[];
  selectedVillaId:  string | null;
  onSelectVilla:    (villaId: string) => void;
  onRadiusSearch?:  (lat: number, lng: number, radiusM: number) => void;
  searchCenter?:    { lat: number; lng: number } | null;
  searchRadius?:    number;
  matchedVillaIds?: Set<string>;
  gisResults?:      GISSearchResult[];
  amenities?:       DetectedAmenity[];
  intelligenceMap?: Map<string, VillaIntelligence>;
}

// ─── Classification System ────────────────────────────────────────────────────

interface VillaClass {
  key:    string;
  fill:   string;   // pin body color
  stroke: string;   // pin border/ring
  badge:  string;   // text shown on pin badge
  emoji:  string;   // shown in popup & legend
  label:  string;   // human legend label
}

const CLASSES: Record<string, VillaClass> = {
  corner:       { key:'corner',       fill:'#3b82f6', stroke:'#bfdbfe', badge:'C',   emoji:'📐', label:'Corner'        },
  end_unit:     { key:'end_unit',     fill:'#7c3aed', stroke:'#c4b5fd', badge:'EU',  emoji:'↔️', label:'End Unit'      },
  single_row:   { key:'single_row',   fill:'#10b981', stroke:'#6ee7b7', badge:'SR',  emoji:'🏡', label:'Single Row'    },
  back_to_back: { key:'back_to_back', fill:'#ef4444', stroke:'#fca5a5', badge:'B2B', emoji:'🏘️', label:'Back-to-Back'  },
  backs_park:   { key:'backs_park',   fill:'#059669', stroke:'#a7f3d0', badge:'🌳',  emoji:'🌳', label:'Backs Park'    },
  backs_road:   { key:'backs_road',   fill:'#d97706', stroke:'#fde68a', badge:'🛣',  emoji:'🛣️', label:'Backs Road'    },
  backs_open:   { key:'backs_open',   fill:'#0284c7', stroke:'#bae6fd', badge:'🏞',  emoji:'🏞️', label:'Open View'     },
  vastu:        { key:'vastu',        fill:'#db2777', stroke:'#fbcfe8', badge:'V✓',  emoji:'🧭', label:'Vastu Compliant'},
  available:    { key:'available',    fill:'#475569', stroke:'#94a3b8', badge:'·',   emoji:'●',  label:'Unclassified'  },
  gis_plot:     { key:'gis_plot',     fill:'#ea580c', stroke:'#fed7aa', badge:'GIS', emoji:'📍', label:'GIS Plot'      },
};

/**
 * Resolve which classification a villa belongs to, using live intel if available.
 * Returns null when intel is loaded but villa matches NO classification
 * (caller should skip the pin entirely).
 */
function resolveClass(
  villa: CommunityVilla,
  intel: VillaIntelligence | undefined,
  intelLoaded: boolean,
): VillaClass | null {
  const lt  = intel?.layout.layoutType;
  const pt  = intel?.layout.positionType;
  const bf  = intel?.layout.backFacing;
  const tags = intel?.tags ?? [];

  // ── Live intel priority (most specific first) ──────────────────────────
  if (pt === 'corner'     || villa.is_corner)     return CLASSES.corner;
  if (pt === 'end')                                return CLASSES.end_unit;
  if (bf === 'park'       || villa.backs_park)     return CLASSES.backs_park;
  if (bf === 'road'       || villa.backs_road)     return CLASSES.backs_road;
  if (bf === 'open_space')                         return CLASSES.backs_open;
  if (lt === 'single_row' || villa.is_single_row)  return CLASSES.single_row;
  if (lt === 'back_to_back')                       return CLASSES.back_to_back;

  const hasVastu = tags.some(t => t.label.includes('Vastu ✓')) || villa.vastu_compliant;
  if (hasVastu)                                    return CLASSES.vastu;

  // ── DB flags fallback ─────────────────────────────────────────────────
  if (!intelLoaded) return CLASSES.available; // still loading → show gray

  // Intel loaded but no class matched → hide pin (return null)
  return null;
}

// ─── Pin SVG builders ─────────────────────────────────────────────────────────

/** Labeled pill-badge pin — unique per classification */
function buildClassPin(cls: VillaClass, size: number, selected = false): string {
  const w   = Math.max(size * 1.8, 36);
  const h   = size + 8;
  const r   = h / 2;
  const glow = selected ? `drop-shadow(0 0 6px ${cls.fill}cc)` : 'drop-shadow(0 2px 3px rgba(0,0,0,0.55))';
  const ring = selected ? `stroke-width:3;stroke:${cls.stroke}` : `stroke-width:2;stroke:${cls.stroke}`;
  const fs   = Math.round(size * 0.45);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h + 6}" style="filter:${glow}">
    <rect x="1" y="1" width="${w-2}" height="${h-2}" rx="${r}" fill="${cls.fill}" ${ring}/>
    <text x="${w/2}" y="${h/2 + fs*0.38}" text-anchor="middle"
          font-size="${fs}" font-family="system-ui,-apple-system,sans-serif"
          font-weight="800" fill="#fff" letter-spacing="-0.5">${cls.badge}</text>
    <polygon points="${w/2-5},${h} ${w/2+5},${h} ${w/2},${h+6}" fill="${cls.fill}"/>
  </svg>`;
}

/** Small dot for "available/unclassified" — kept tiny to de-emphasize */
function buildDotPin(cls: VillaClass): string {
  return `<div style="width:10px;height:10px;border-radius:50%;background:${cls.fill};border:2px solid ${cls.stroke};opacity:0.5"></div>`;
}

/** GIS plot match — small diamond */
function buildGisPin(size: number): string {
  const s = size;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${s}" height="${s}" style="filter:drop-shadow(0 1px 3px rgba(0,0,0,0.5))">
    <rect x="${s*0.15}" y="${s*0.15}" width="${s*0.7}" height="${s*0.7}" rx="3"
          fill="${CLASSES.gis_plot.fill}" stroke="${CLASSES.gis_plot.stroke}" stroke-width="1.5"
          transform="rotate(45 ${s/2} ${s/2})"/>
  </svg>`;
}

// ─── Popup builder ─────────────────────────────────────────────────────────────

function buildPopup(
  villa: CommunityVilla,
  cls: VillaClass,
  intel: VillaIntelligence | undefined,
  dist: number | undefined,
): string {
  const tags = intel?.tags ?? [];
  const amenityTags = tags.filter(t => t.category === 'amenity').slice(0, 4);
  const classTags   = tags.filter(t => t.category !== 'amenity').slice(0, 5);

  const tagPills = [...classTags, ...amenityTags].map(t =>
    `<span style="display:inline-flex;align-items:center;gap:3px;padding:2px 7px;border-radius:99px;
      background:rgba(255,255,255,0.07);border:1px solid rgba(255,255,255,0.12);
      font-size:9px;font-weight:700;color:#e2e8f0;white-space:nowrap">
      ${t.emoji} ${t.label}
    </span>`
  ).join('');

  const distLine = dist != null
    ? `<div style="font-size:9px;color:#22d3ee;margin-top:5px">
        📍 ${dist < 1000 ? `${Math.round(dist)}m` : `${(dist/1000).toFixed(1)}km`} from center
      </div>` : '';

  return `
    <div style="font-family:system-ui,-apple-system,sans-serif;min-width:210px;padding:0">
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:6px">
        <span style="font-size:13px;font-weight:800;color:#fff">
          ${villa.villa_number.startsWith('gis:') ? `Plot ${villa.plot_number}` : `Villa ${villa.villa_number}`}
        </span>
        <span style="display:flex;align-items:center;gap:3px;padding:2px 8px;border-radius:99px;
              background:${cls.fill}22;border:1px solid ${cls.fill}55;font-size:9px;font-weight:700;color:${cls.stroke}">
          ${cls.emoji} ${cls.label}
        </span>
      </div>
      <div style="font-size:10px;color:#9ca3af;margin-bottom:6px">
        ${villa.community_name}${villa.cluster_name ? ` • ${villa.cluster_name}` : ''}
        ${villa.plot_number ? ` • Plot ${villa.plot_number}` : ''}
      </div>
      ${tagPills ? `<div style="display:flex;flex-wrap:wrap;gap:4px;margin-bottom:6px">${tagPills}</div>` : ''}
      <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:4px;
            padding-top:6px;border-top:1px solid rgba(255,255,255,0.07)">
        <div>
          <div style="font-size:7px;color:#6b7280;text-transform:uppercase">Plot</div>
          <div style="font-size:10px;color:#d1d5db;font-weight:600">
            ${villa.plot_size_sqft ? villa.plot_size_sqft.toLocaleString() + ' ft²' : '—'}
          </div>
        </div>
        <div>
          <div style="font-size:7px;color:#6b7280;text-transform:uppercase">BR</div>
          <div style="font-size:10px;color:#d1d5db;font-weight:600">${villa.bedrooms || '—'}</div>
        </div>
        <div style="text-align:right">
          <div style="font-size:7px;color:#6b7280;text-transform:uppercase">Facing</div>
          <div style="font-size:10px;color:#d1d5db;font-weight:600">${villa.facing_direction || '—'}</div>
        </div>
      </div>
      ${distLine}
    </div>`;
}

// ─── Position helpers ─────────────────────────────────────────────────────────

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
  'damac hills 2':          [25.0100, 55.2100],
  'dubai hills':            [25.1180, 55.2400],
  'palm jumeirah':          [25.1124, 55.1390],
  'jumeirah golf estates':  [25.0450, 55.1800],
  'jumeirah park':          [25.0400, 55.1500],
  'victory heights':        [25.0500, 55.1800],
  'mudon':                  [25.0250, 55.2700],
  'villanova':              [25.0350, 55.2900],
  'reem':                   [25.0800, 55.2650],
  'town square':            [25.0150, 55.2500],
  'tilal al ghaf':          [25.0650, 55.2400],
};

export function getVillaPosition(villa: CommunityVilla, index: number): [number, number] {
  if (villa.latitude && villa.longitude) return [villa.latitude, villa.longitude];
  const key = Object.keys(COMMUNITY_CENTERS).find(k => villa.community_name.toLowerCase().includes(k));
  if (key) {
    const base = COMMUNITY_CENTERS[key];
    const hash = villa.villa_number.split('').reduce((a, c) => a + c.charCodeAt(0), 0);
    return [base[0] + ((hash % 60) - 30) * 0.0003, base[1] + ((hash % 47) - 23) * 0.0004];
  }
  return [DUBAI_CENTER[0] + ((index % 50) - 25) * 0.001, DUBAI_CENTER[1] + (Math.floor(index / 50) - 5) * 0.001];
}

function offsetByMeters(lat: number, lng: number, m: number, deg: number) {
  const R = 6378137, b = deg * Math.PI / 180, φ1 = lat * Math.PI / 180, λ1 = lng * Math.PI / 180;
  const δ = m / R;
  const φ2 = Math.asin(Math.sin(φ1)*Math.cos(δ) + Math.cos(φ1)*Math.sin(δ)*Math.cos(b));
  const λ2 = λ1 + Math.atan2(Math.sin(b)*Math.sin(δ)*Math.cos(φ1), Math.cos(δ)-Math.sin(φ1)*Math.sin(φ2));
  return { lat: φ2*180/Math.PI, lng: λ2*180/Math.PI };
}

// ─── Component ───────────────────────────────────────────────────────────────

export const VillaMapView = memo(function VillaMapView({
  villas, selectedVillaId, onSelectVilla, onRadiusSearch,
  searchCenter, searchRadius = 1000, matchedVillaIds, gisResults = [],
  amenities = [], intelligenceMap,
}: VillaMapViewProps) {
  const containerRef        = useRef<HTMLDivElement>(null);
  const mapRef              = useRef<L.Map | null>(null);
  const markersRef          = useRef<L.LayerGroup | null>(null);
  const markerMapRef        = useRef<Map<string, { layer: L.Layer; cls: VillaClass }>>(new Map());
  const radiusLayerRef      = useRef<L.LayerGroup | null>(null);
  const gisLayerRef         = useRef<L.LayerGroup | null>(null);
  const amenityLayerRef     = useRef<L.LayerGroup | null>(null);
  const pinMarkerRef        = useRef<L.Marker | null>(null);
  const onSelectRef         = useRef(onSelectVilla);
  const onRadiusSearchRef   = useRef(onRadiusSearch);
  onSelectRef.current       = onSelectVilla;
  onRadiusSearchRef.current = onRadiusSearch;

  // ── Init map ───────────────────────────────────────────────────────────
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    const map = L.map(containerRef.current, {
      center: DUBAI_CENTER, zoom: 11, zoomControl: false, attributionControl: false,
      preferCanvas: true, maxBounds: [[22.5,51.0],[26.5,56.5]],
      maxBoundsViscosity: 0.9, minZoom: 8, maxZoom: 19,
    });
    L.tileLayer(
      'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
      { maxZoom: 19, noWrap: true, updateWhenIdle: true }
    ).addTo(map);
    L.control.zoom({ position: 'topleft' }).addTo(map);

    markersRef.current    = L.layerGroup().addTo(map);
    radiusLayerRef.current  = L.layerGroup().addTo(map);
    gisLayerRef.current   = L.layerGroup().addTo(map);
    amenityLayerRef.current = L.layerGroup().addTo(map);
    mapRef.current = map;

    // Right-click → radius search
    map.on('contextmenu', (e: L.LeafletMouseEvent) => {
      const { lat, lng } = e.latlng;
      if (pinMarkerRef.current) map.removeLayer(pinMarkerRef.current);
      const icon = L.divIcon({
        html: `<div style="width:22px;height:22px;background:hsl(82,84%,50%);border:3px solid #fff;
          border-radius:50%;box-shadow:0 2px 8px rgba(0,0,0,0.5)"></div>`,
        className: '', iconSize: [22,22], iconAnchor: [11,11],
      });
      const pin = L.marker([lat,lng], { icon }).addTo(map);
      pinMarkerRef.current = pin;
      pin.bindPopup(`
        <div style="font-family:system-ui;min-width:160px">
          <div style="font-size:12px;font-weight:700;color:#fff;margin-bottom:6px">📍 Radius Search</div>
          <div style="font-size:9px;color:#9ca3af;margin-bottom:8px">${lat.toFixed(5)}, ${lng.toFixed(5)}</div>
          <div style="display:flex;gap:4px;flex-wrap:wrap">
            ${[100,200,500,1000,2000].map(r =>
              `<button onclick="window.__vrs(${lat},${lng},${r})"
                style="background:hsl(82,84%,45%);color:#000;border:none;padding:3px 8px;
                border-radius:4px;font-size:9px;font-weight:700;cursor:pointer">
                ${r<1000?r+'m':(r/1000)+'km'}</button>`
            ).join('')}
          </div>
        </div>`, { className: 'villa-map-popup', maxWidth: 200, closeButton: true }).openPopup();
      (window as any).__vrs = (la: number, ln: number, ra: number) => onRadiusSearchRef.current?.(la,ln,ra);
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
    L.circleMarker([lat,lng], { radius:4, color:'#fff', fillColor:'#cbd5e1', fillOpacity:1, weight:1.5, interactive:false }).addTo(rl);
    L.circle([lat,lng], { radius:searchRadius, color:'rgba(191,255,0,0.75)', fillColor:'rgba(191,255,0,0.06)', fillOpacity:1, weight:2.5 }).addTo(rl);
    map.flyToBounds(L.latLng(lat,lng).toBounds(searchRadius*2.2), { duration:0.8, padding:[30,30] });
  }, [searchCenter, searchRadius]);

  // ── Villa pins ─────────────────────────────────────────────────────────
  useEffect(() => {
    const lg = markersRef.current;
    if (!lg) return;
    lg.clearLayers();
    markerMapRef.current.clear();

    // intel is "loaded" once the map has any entry (even partial)
    const intelLoaded = (intelligenceMap?.size ?? 0) > 0;

    villas.forEach((villa, idx) => {
      const intel = intelligenceMap?.get(villa.id);
      const cls   = resolveClass(villa, intel, intelLoaded);

      // ── KEY RULE: hide pin if intel is loaded but no class matched ──
      if (cls === null) return;

      const pos      = getVillaPosition(villa, idx);
      const isMatch  = matchedVillaIds?.has(villa.id) ?? false;
      const dist     = searchCenter ? haversineDistance(searchCenter.lat, searchCenter.lng, pos[0], pos[1]) : undefined;
      const selected = villa.id === selectedVillaId;

      // Choose pin size: matched > selected > normal
      const sz = isMatch ? 32 : selected ? 30 : 26;

      const isUnclassified = cls.key === 'available';
      const html = isUnclassified ? buildDotPin(cls) : buildClassPin(cls, sz, selected);
      const iconW = isUnclassified ? 10 : Math.max(sz * 1.8, 36);
      const iconH = isUnclassified ? 10 : sz + 14;

      const icon = L.divIcon({
        html,
        className: isUnclassified ? 'villa-dot-pin' : 'villa-class-pin',
        iconSize:   [iconW, iconH],
        iconAnchor: [iconW/2, iconH],
        popupAnchor:[0, -iconH],
      });

      const marker = L.marker(pos, { icon, zIndexOffset: isMatch ? 1200 : selected ? 1100 : cls.key === 'available' ? 500 : 900 });
      marker.on('click', () => onSelectRef.current(villa.id));
      marker.bindPopup(buildPopup(villa, cls, intel, dist), {
        className: 'villa-map-popup', maxWidth: 240, closeButton: true, autoPan: true,
      });
      if (!isUnclassified) {
        marker.bindTooltip(
          `${cls.emoji} ${cls.label} — Villa ${villa.villa_number}`,
          { direction: 'top', className: 'plot-tooltip-premium', offset: [0, -iconH], permanent: false }
        );
      }

      lg.addLayer(marker);
      markerMapRef.current.set(villa.id, { layer: marker, cls });
    });
  }, [villas, searchCenter, matchedVillaIds, intelligenceMap, selectedVillaId]);

  // ── GIS result pins ────────────────────────────────────────────────────
  useEffect(() => {
    const gl = gisLayerRef.current;
    if (!gl) return;
    gl.clearLayers();
    const seen = new Set<string>();
    const dupCount = new Map<string, number>();
    let fi = 0;
    gisResults.forEach(r => {
      if (seen.has(r.plot.id)) return;
      seen.add(r.plot.id);
      let coords = normalizeCoordinatesForSearch(r.plot.y, r.plot.x);
      if (!coords && searchCenter) { fi++; coords = offsetByMeters(searchCenter.lat, searchCenter.lng, 30+fi*12, (fi*137.5)%360); }
      if (!coords) return;
      const ck = `${coords.lat.toFixed(6)}:${coords.lng.toFixed(6)}`;
      const di = dupCount.get(ck) ?? 0; dupCount.set(ck, di+1);
      const { lat, lng } = di > 0 ? offsetByMeters(coords.lat, coords.lng, di*8, (di*47)%360) : coords;
      const sz = 20;
      const marker = L.marker([lat,lng], {
        icon: L.divIcon({ html: buildGisPin(sz), className:'villa-gis-pin', iconSize:[sz,sz], iconAnchor:[sz/2,sz/2] }),
        zIndexOffset: 700,
      });
      const d = searchCenter ? haversineDistance(searchCenter.lat, searchCenter.lng, lat, lng) : undefined;
      marker.bindPopup(`
        <div style="font-family:system-ui;min-width:200px">
          <div style="display:flex;align-items:center;gap:6px;margin-bottom:5px">
            <span style="font-size:13px;font-weight:800;color:#fff">Plot ${r.plot.id}</span>
            <span style="font-size:9px;padding:2px 6px;border-radius:99px;background:rgba(234,88,12,0.2);color:#fb923c;font-weight:700">${r.confidenceScore}%</span>
          </div>
          <div style="font-size:9px;color:#9ca3af;margin-bottom:5px">Source: ${r.source}</div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:5px;padding-top:5px;border-top:1px solid rgba(255,255,255,0.08)">
            <div><div style="font-size:7px;color:#6b7280;text-transform:uppercase">Area</div>
              <div style="font-size:10px;color:#d1d5db;font-weight:600">${r.plot.area?Math.round(r.plot.area).toLocaleString()+' m²':'—'}</div></div>
            <div><div style="font-size:7px;color:#6b7280;text-transform:uppercase">GFA</div>
              <div style="font-size:10px;color:#d1d5db;font-weight:600">${r.plot.gfa?Math.round(r.plot.gfa).toLocaleString()+' m²':'—'}</div></div>
          </div>
          ${d!=null?`<div style="font-size:9px;color:#22d3ee;margin-top:5px">📍 ${d<1000?Math.round(d)+'m':(d/1000).toFixed(1)+'km'} from center</div>`:''}
        </div>`, { className:'villa-map-popup', maxWidth:230, closeButton:true });
      gl.addLayer(marker);
    });
  }, [gisResults, searchCenter]);

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
      const [lat,lng] = a.coordinates;
      const icon = L.divIcon({
        html:`<div style="width:28px;height:28px;border-radius:50%;background:${cfg.mapColor};
          border:2px solid rgba(255,255,255,0.9);box-shadow:0 2px 8px rgba(0,0,0,0.4);
          display:flex;align-items:center;justify-content:center;font-size:14px">${cfg.emoji}</div>`,
        className:'villa-amenity-icon', iconSize:[28,28], iconAnchor:[14,14],
      });
      const m = L.marker([lat,lng], { icon, zIndexOffset:600 });
      m.bindTooltip(`${cfg.emoji} ${cfg.label} — ${a.distanceMeters}m`, { direction:'top', className:'plot-tooltip-premium', offset:[0,-16] });
      m.bindPopup(`<div style="font-family:system-ui;min-width:150px">
        <div style="font-size:18px;margin-bottom:4px">${cfg.emoji}</div>
        <div style="font-size:12px;font-weight:700;color:#fff">${cfg.label}</div>
        <div style="font-size:10px;color:#9ca3af;margin-top:2px">${a.name}</div>
        <div style="font-size:11px;font-weight:700;color:${cfg.mapColor};margin-top:6px">${a.distanceMeters}m away</div>
      </div>`, { className:'villa-map-popup', maxWidth:200, closeButton:true });
      al.addLayer(m);
    }
  }, [amenities]);

  // ── Auto-fit to GIS results ────────────────────────────────────────────
  useEffect(() => {
    const map = mapRef.current;
    if (!map || searchCenter || gisResults.length === 0) return;
    const pts = gisResults.map(r => normalizeCoordinatesForSearch(r.plot.y, r.plot.x)).filter(Boolean) as { lat:number; lng:number }[];
    if (!pts.length) return;
    map.flyToBounds(L.latLngBounds(pts.map(p => [p.lat,p.lng] as [number,number])).pad(0.15), { duration:0.7, padding:[30,30] });
  }, [gisResults, searchCenter]);

  // ── Fly to selected ────────────────────────────────────────────────────
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !selectedVillaId) return;
    const entry = markerMapRef.current.get(selectedVillaId);
    if (!entry) return;
    const { layer } = entry;
    if ('getLatLng' in layer) {
      map.flyTo((layer as L.Marker).getLatLng(), 16, { duration:0.5 });
      (layer as L.Marker).openPopup?.();
    }
  }, [selectedVillaId]);

  // ── Compute visible class counts for dynamic legend ────────────────────
  const classCounts: Record<string, number> = {};
  if (intelligenceMap) {
    for (const villa of villas) {
      const intel = intelligenceMap.get(villa.id);
      const cls = resolveClass(villa, intel, intelligenceMap.size > 0);
      if (cls && cls.key !== 'available') {
        classCounts[cls.key] = (classCounts[cls.key] ?? 0) + 1;
      }
    }
  }
  const activeLegendItems = Object.entries(CLASSES)
    .filter(([key]) => key !== 'available' && key !== 'gis_plot' && (classCounts[key] ?? 0) > 0)
    .map(([, cls]) => ({ ...cls, count: classCounts[cls.key] ?? 0 }));

  return (
    <>
      <div ref={containerRef} className="absolute inset-0 min-h-0" style={{ background:'hsl(220,20%,8%)' }} />

      {searchCenter && (
        <div className="absolute top-3 left-1/2 -translate-x-1/2 z-[500] bg-[hsl(220,25%,10%,0.95)] border border-[hsl(220,20%,26%)] rounded-lg px-4 py-2 backdrop-blur-sm flex items-center gap-3">
          <div className="h-2 w-2 rounded-full bg-[hsl(0,0%,80%)]" />
          <span className="text-[11px] text-[hsl(220,10%,78%)] font-medium">
            Radius Search Active • {searchRadius >= 1000 ? `${(searchRadius/1000).toFixed(1)}km` : `${searchRadius}m`}
          </span>
          <span className="text-[10px] text-[hsl(220,10%,50%)]">
            {searchCenter.lat.toFixed(4)}, {searchCenter.lng.toFixed(4)}
          </span>
        </div>
      )}

      {/* Dynamic classification legend — only shows classes actually present */}
      <div className="absolute bottom-4 left-4 z-[500] bg-[hsl(220,25%,10%,0.92)] border border-[hsl(220,20%,18%)] rounded-xl p-3 backdrop-blur-sm min-w-[140px]">
        <div className="text-[8px] text-[hsl(220,10%,45%)] uppercase tracking-wider mb-2 font-semibold">Classification</div>
        <div className="space-y-1.5">
          {/* Always show GIS match if any */}
          {gisResults.length > 0 && (
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-sm rotate-45 shrink-0" style={{ background: CLASSES.gis_plot.fill, border:`1.5px solid ${CLASSES.gis_plot.stroke}` }} />
              <span className="text-[9px] text-[hsl(220,10%,65%)]">GIS Plot ({gisResults.length})</span>
            </div>
          )}
          {activeLegendItems.length > 0
            ? activeLegendItems.map(cls => (
                <div key={cls.key} className="flex items-center gap-2">
                  <div className="shrink-0 h-4 px-1.5 rounded flex items-center justify-center"
                       style={{ background: cls.fill, border:`1px solid ${cls.stroke}` }}>
                    <span className="text-[7px] font-black text-white leading-none">{cls.badge}</span>
                  </div>
                  <span className="text-[9px] text-[hsl(220,10%,65%)]">{cls.label} <span className="text-[hsl(220,10%,40%)]">({cls.count})</span></span>
                </div>
              ))
            : (
                <div className="text-[9px] text-[hsl(220,10%,40%)] italic">
                  {(intelligenceMap?.size ?? 0) === 0 ? 'Classifying…' : 'No classes detected'}
                </div>
              )
          }
        </div>
        {amenities.length > 0 && (
          <div className="mt-2 pt-2 border-t border-[hsl(220,20%,16%)] space-y-1">
            <div className="text-[8px] text-[hsl(220,10%,45%)] uppercase tracking-wider font-semibold">Amenities</div>
            {Array.from(new Set(amenities.map(a => a.type))).slice(0, 4).map(type => {
              const cfg = AMENITY_CONFIG[type];
              return (
                <div key={type} className="flex items-center gap-1.5">
                  <span className="text-[11px]">{cfg.emoji}</span>
                  <span className="text-[9px] text-[hsl(220,10%,65%)]">{cfg.label}</span>
                </div>
              );
            })}
          </div>
        )}
        <div className="text-[8px] text-[hsl(220,10%,38%)] mt-2 pt-1.5 border-t border-[hsl(220,20%,14%)]">
          Right-click → Drop pin → Radius search
        </div>
      </div>

      <style>{`
        .villa-map-popup .leaflet-popup-content-wrapper {
          background: hsl(220, 25%, 10%); border: 1px solid hsl(220, 20%, 18%);
          border-radius: 12px; box-shadow: 0 12px 40px rgba(0,0,0,0.5);
          color: white; padding: 0;
        }
        .villa-map-popup .leaflet-popup-content { margin: 12px 14px; line-height: 1.4; }
        .villa-map-popup .leaflet-popup-tip { background: hsl(220, 25%, 10%); }
        .villa-map-popup .leaflet-popup-close-button { color: #6b7280 !important; font-size: 16px !important; top: 6px !important; right: 8px !important; }
        .villa-map-popup .leaflet-popup-close-button:hover { color: #fff !important; }
        .villa-class-pin { filter: drop-shadow(0 2px 5px rgba(0,0,0,0.4)); transition: transform 0.15s ease; cursor: pointer; }
        .villa-class-pin:hover { transform: scale(1.15) translateY(-2px); filter: drop-shadow(0 4px 8px rgba(0,0,0,0.5)); }
        .villa-dot-pin { opacity: 0.5; cursor: pointer; transition: opacity 0.15s; }
        .villa-dot-pin:hover { opacity: 0.9; }
        .villa-gis-pin { filter: drop-shadow(0 1px 3px rgba(0,0,0,0.4)); cursor: pointer; transition: transform 0.1s; }
        .villa-gis-pin:hover { transform: scale(1.2); }
        .villa-amenity-icon { filter: drop-shadow(0 1px 3px rgba(0,0,0,0.3)); transition: transform 0.15s; }
        .villa-amenity-icon:hover { transform: scale(1.15); }
        .plot-tooltip-premium { background: hsl(220,25%,10%) !important; border: 1px solid hsl(220,20%,24%) !important; color: #e2e8f0 !important; font-size: 11px !important; font-weight: 600 !important; border-radius: 6px !important; padding: 3px 8px !important; white-space: nowrap !important; }
        .plot-tooltip-premium::before { display: none !important; }
      `}</style>
    </>
  );
});
