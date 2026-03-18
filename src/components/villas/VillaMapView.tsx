import { useEffect, useRef, memo, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import type { CommunityVilla } from '@/hooks/useVillas';
import type { GISSearchResult } from '@/hooks/useVillaGISSearch';
import { normalizeCoordinatesForSearch } from '@/services/DDAGISService';
import { AMENITY_CONFIG, type DetectedAmenity } from '@/services/PropertyIntelligenceService';

interface VillaMapViewProps {
  villas: CommunityVilla[];
  selectedVillaId: string | null;
  onSelectVilla: (villaId: string) => void;
  onRadiusSearch?: (lat: number, lng: number, radiusM: number) => void;
  searchCenter?: { lat: number; lng: number } | null;
  searchRadius?: number;
  matchedVillaIds?: Set<string>;
  gisResults?: GISSearchResult[];
  amenities?: DetectedAmenity[];
}

const DUBAI_CENTER: [number, number] = [25.2048, 55.2708];

const COMMUNITY_CENTERS: Record<string, [number, number]> = {
  'arabian ranches': [25.0580, 55.2700],
  'arabian ranches 2': [25.0500, 55.2800],
  'arabian ranches 3': [25.0450, 55.2750],
  'meadows': [25.0450, 55.1650],
  'springs': [25.0500, 55.1550],
  'lakes': [25.0580, 55.1580],
  'al barari': [25.0880, 55.2800],
  'damac hills': [25.0300, 55.2300],
  'damac hills 2': [25.0100, 55.2100],
  'dubai hills': [25.1180, 55.2400],
  'palm jumeirah': [25.1124, 55.1390],
  'jumeirah golf estates': [25.0450, 55.1800],
  'jumeirah park': [25.0400, 55.1500],
  'victory heights': [25.0500, 55.1800],
  'mudon': [25.0250, 55.2700],
  'villanova': [25.0350, 55.2900],
  'reem': [25.0800, 55.2650],
  'town square': [25.0150, 55.2500],
  'tilal al ghaf': [25.0650, 55.2400],
};

export function getVillaPosition(villa: CommunityVilla, index: number): [number, number] {
  if (villa.latitude && villa.longitude) return [villa.latitude, villa.longitude];
  const communityKey = Object.keys(COMMUNITY_CENTERS).find(k => villa.community_name.toLowerCase().includes(k));
  if (communityKey) {
    const base = COMMUNITY_CENTERS[communityKey];
    const hash = villa.villa_number.split('').reduce((a, c) => a + c.charCodeAt(0), 0);
    return [base[0] + ((hash % 60) - 30) * 0.0003, base[1] + ((hash % 47) - 23) * 0.0004];
  }
  return [DUBAI_CENTER[0] + ((index % 50) - 25) * 0.001, DUBAI_CENTER[1] + (Math.floor(index / 50) - 5) * 0.001];
}

// Status-based pin colors
function getVillaPinColor(villa: CommunityVilla, isMatched: boolean, listingStatus?: string): { fill: string; border: string } {
  if (listingStatus === 'sold') return { fill: '#6b7280', border: '#9ca3af' }; // Grey
  if (listingStatus === 'under_offer') return { fill: '#f97316', border: '#fb923c' }; // Orange
  if (listingStatus === 'internal') return { fill: '#3b82f6', border: '#60a5fa' }; // Blue
  if (isMatched) return { fill: '#ef4444', border: '#fff' }; // Red Google-style pin
  if (villa.vastu_compliant) return { fill: '#f97316', border: '#fb923c' };
  if (villa.is_corner) return { fill: '#3b82f6', border: '#60a5fa' };
  if (villa.backs_park) return { fill: '#10b981', border: '#34d399' };
  if (villa.is_single_row) return { fill: '#a855f7', border: '#c084fc' };
  return { fill: '#22c55e', border: '#4ade80' };
}

// Build a Google Maps–style drop pin SVG
function buildDropPinSvg(fill: string, border: string, size: number = 36): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${Math.round(size * 1.35)}" viewBox="0 0 24 33">
    <defs>
      <filter id="ds" x="-20%" y="-10%" width="140%" height="140%">
        <feDropShadow dx="0" dy="2" stdDeviation="2" flood-color="rgba(0,0,0,0.45)"/>
      </filter>
    </defs>
    <path d="M12 0C5.373 0 0 5.373 0 12c0 9 12 21 12 21s12-12 12-21C24 5.373 18.627 0 12 0z"
          fill="${fill}" stroke="${border}" stroke-width="1.5" filter="url(#ds)"/>
    <circle cx="12" cy="11" r="4.5" fill="#fff" opacity="0.95"/>
  </svg>`;
}

function buildPopupContent(villa: CommunityVilla, distance?: number): string {
  const indicators: string[] = [];
  if (villa.is_corner) indicators.push('<span style="color:#60a5fa">◻ Corner</span>');
  if (villa.is_single_row) indicators.push('<span style="color:#c084fc">▬ Single Row</span>');
  if (villa.vastu_compliant) indicators.push('<span style="color:#fb923c">🧭 Vastu</span>');
  if (villa.backs_park) indicators.push('<span style="color:#34d399">🌳 Park</span>');
  if (villa.backs_road) indicators.push('<span style="color:#fbbf24">🛣 Road</span>');
  if (villa.near_pool) indicators.push('<span style="color:#22d3ee">🏊 Pool</span>');

  const distStr = distance != null
    ? `<div style="font-size:9px;color:#22d3ee;margin-top:4px;padding-top:4px;border-top:1px solid rgba(255,255,255,0.06)">
        📍 ${distance < 1000 ? `${Math.round(distance)}m` : `${(distance / 1000).toFixed(1)}km`} from search center
      </div>`
    : '';

  return `
    <div style="font-family:system-ui,-apple-system,sans-serif;min-width:220px;padding:0">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:6px">
        <span style="font-size:14px;font-weight:800;color:#fff">Villa ${villa.villa_number}</span>
        ${villa.plot_number ? `<span style="font-size:9px;color:#6b7280;background:rgba(255,255,255,0.06);padding:1px 5px;border-radius:4px">Plot ${villa.plot_number}</span>` : ''}
      </div>
      <div style="font-size:10px;color:#9ca3af;margin-bottom:4px">${villa.community_name}${villa.cluster_name ? ` • ${villa.cluster_name}` : ''}</div>
      ${indicators.length > 0 ? `<div style="display:flex;flex-wrap:wrap;gap:4px;margin:6px 0;font-size:9px;font-weight:600">${indicators.join('')}</div>` : ''}
      <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:4px;margin-top:6px;padding-top:6px;border-top:1px solid rgba(255,255,255,0.08)">
        <div>
          <div style="font-size:8px;color:#6b7280;text-transform:uppercase;letter-spacing:0.5px">Size</div>
          <div style="font-size:10px;color:#d1d5db;font-weight:600">${villa.plot_size_sqft ? villa.plot_size_sqft.toLocaleString() + ' sqft' : '—'}</div>
        </div>
        <div>
          <div style="font-size:8px;color:#6b7280;text-transform:uppercase;letter-spacing:0.5px">BR</div>
          <div style="font-size:10px;color:#d1d5db;font-weight:600">${villa.bedrooms || '—'}</div>
        </div>
        <div style="text-align:right">
          <div style="font-size:8px;color:#6b7280;text-transform:uppercase;letter-spacing:0.5px">Facing</div>
          <div style="font-size:10px;color:#d1d5db;font-weight:600">${villa.facing_direction || '—'}</div>
        </div>
      </div>
      ${distStr}
      <div style="margin-top:6px;text-align:center">
        <span style="font-size:9px;color:hsl(82,84%,55%);cursor:pointer">Click for full details →</span>
      </div>
    </div>`;
}

// Haversine distance in meters
function haversineDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371000;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function offsetLatLngByMeters(lat: number, lng: number, distanceMeters: number, bearingDegrees: number): { lat: number; lng: number } {
  const earthRadius = 6378137;
  const bearing = bearingDegrees * Math.PI / 180;
  const latRad = lat * Math.PI / 180;
  const lngRad = lng * Math.PI / 180;
  const angularDistance = distanceMeters / earthRadius;

  const nextLat = Math.asin(
    Math.sin(latRad) * Math.cos(angularDistance)
      + Math.cos(latRad) * Math.sin(angularDistance) * Math.cos(bearing)
  );

  const nextLng = lngRad + Math.atan2(
    Math.sin(bearing) * Math.sin(angularDistance) * Math.cos(latRad),
    Math.cos(angularDistance) - Math.sin(latRad) * Math.sin(nextLat)
  );

  return {
    lat: nextLat * 180 / Math.PI,
    lng: nextLng * 180 / Math.PI,
  };
}

export const VillaMapView = memo(function VillaMapView({
  villas, selectedVillaId, onSelectVilla, onRadiusSearch,
  searchCenter, searchRadius = 1000, matchedVillaIds, gisResults = [],
  amenities = [],
}: VillaMapViewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markersRef = useRef<L.LayerGroup | null>(null);
  const markerMapRef = useRef<Map<string, L.Layer>>(new Map());
  const radiusLayerRef = useRef<L.LayerGroup | null>(null);
  const gisPlotLayerRef = useRef<L.LayerGroup | null>(null);
  const amenityLayerRef = useRef<L.LayerGroup | null>(null);
  const pinMarkerRef = useRef<L.Marker | null>(null);
  const pulseIntervalRef = useRef<number | null>(null);
  const onSelectRef = useRef(onSelectVilla);
  const onRadiusSearchRef = useRef(onRadiusSearch);
  onSelectRef.current = onSelectVilla;
  onRadiusSearchRef.current = onRadiusSearch;

  // Init map
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    const map = L.map(containerRef.current, {
      center: DUBAI_CENTER, zoom: 11, zoomControl: false, attributionControl: false,
      preferCanvas: true, maxBounds: [[22.5, 51.0], [26.5, 56.5]],
      maxBoundsViscosity: 0.9, minZoom: 8, maxZoom: 19,
    });
    L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
      { maxZoom: 19, noWrap: true, updateWhenIdle: true, keepBuffer: 2 }).addTo(map);
    L.control.zoom({ position: 'topleft' }).addTo(map);
    const lg = L.layerGroup().addTo(map);
    markersRef.current = lg;
    radiusLayerRef.current = L.layerGroup().addTo(map);
    gisPlotLayerRef.current = L.layerGroup().addTo(map);
    amenityLayerRef.current = L.layerGroup().addTo(map);
    mapRef.current = map;

    // Right-click to drop pin for radius search
    map.on('contextmenu', (e: L.LeafletMouseEvent) => {
      const { lat, lng } = e.latlng;
      if (pinMarkerRef.current) map.removeLayer(pinMarkerRef.current);

      const pinIcon = L.divIcon({
        html: `<div style="width:24px;height:24px;background:hsl(82,84%,50%);border:3px solid #fff;border-radius:50%;box-shadow:0 2px 8px rgba(0,0,0,0.5);display:flex;align-items:center;justify-content:center">
          <div style="width:6px;height:6px;background:#fff;border-radius:50%"></div>
        </div>`,
        className: '',
        iconSize: [24, 24],
        iconAnchor: [12, 12],
      });

      const pin = L.marker([lat, lng], { icon: pinIcon }).addTo(map);
      pinMarkerRef.current = pin;

      pin.bindPopup(`
        <div style="font-family:system-ui;min-width:160px">
          <div style="font-size:12px;font-weight:700;color:#fff;margin-bottom:4px">📍 Location Pin</div>
          <div style="font-size:9px;color:#9ca3af;margin-bottom:8px">${lat.toFixed(6)}, ${lng.toFixed(6)}</div>
          <div style="font-size:10px;color:#d1d5db;margin-bottom:4px">Search villas within:</div>
          <div style="display:flex;gap:4px;flex-wrap:wrap">
            <button onclick="window.__villaRadiusSearch(${lat},${lng},200)" style="background:hsl(82,84%,45%);color:#000;border:none;padding:3px 8px;border-radius:4px;font-size:9px;font-weight:600;cursor:pointer">200m</button>
            <button onclick="window.__villaRadiusSearch(${lat},${lng},500)" style="background:hsl(82,84%,45%);color:#000;border:none;padding:3px 8px;border-radius:4px;font-size:9px;font-weight:600;cursor:pointer">500m</button>
            <button onclick="window.__villaRadiusSearch(${lat},${lng},1000)" style="background:hsl(82,84%,45%);color:#000;border:none;padding:3px 8px;border-radius:4px;font-size:9px;font-weight:600;cursor:pointer">1km</button>
            <button onclick="window.__villaRadiusSearch(${lat},${lng},2000)" style="background:hsl(82,84%,45%);color:#000;border:none;padding:3px 8px;border-radius:4px;font-size:9px;font-weight:600;cursor:pointer">2km</button>
          </div>
        </div>
      `, { className: 'villa-map-popup', maxWidth: 200, closeButton: true }).openPopup();

      (window as any).__villaRadiusSearch = (lat: number, lng: number, radius: number) => {
        onRadiusSearchRef.current?.(lat, lng, radius);
      };
    });

    requestAnimationFrame(() => map.invalidateSize());
    return () => {
      if (pulseIntervalRef.current) clearInterval(pulseIntervalRef.current);
      map.remove(); mapRef.current = null; markersRef.current = null; gisPlotLayerRef.current = null; amenityLayerRef.current = null;
    };
  }, []);

  // Hologram radius wave effect
  useEffect(() => {
    const map = mapRef.current;
    const radiusLayer = radiusLayerRef.current;
    if (!map || !radiusLayer) return;

    radiusLayer.clearLayers();
    if (pulseIntervalRef.current) {
      clearInterval(pulseIntervalRef.current);
      pulseIntervalRef.current = null;
    }

    if (!searchCenter) return;

    const { lat, lng } = searchCenter;

    // Small neutral center point (no glowing pin)
    L.circleMarker([lat, lng], {
      radius: 4,
      color: 'hsl(0,0%,100%)',
      fillColor: 'hsl(220,15%,75%)',
      fillOpacity: 1,
      weight: 1.5,
      interactive: false,
    }).addTo(radiusLayer);

    // Precise geodesic radius circle with lemon glow
    L.circle([lat, lng], {
      radius: searchRadius,
      color: 'rgba(191,255,0,0.75)',
      fillColor: 'rgba(191,255,0,0.08)',
      fillOpacity: 1,
      weight: 2.5,
    }).addTo(radiusLayer);

    // Fit map to show full radius
    const bounds = L.latLng(lat, lng).toBounds(searchRadius * 2.2);
    map.flyToBounds(bounds, { duration: 0.8, padding: [30, 30] });
  }, [searchCenter, searchRadius]);

  // Sync markers
  useEffect(() => {
    const lg = markersRef.current;
    if (!lg) return;
    lg.clearLayers();
    markerMapRef.current.clear();

    const matched = matchedVillaIds || new Set<string>();

    villas.forEach((villa, idx) => {
      const pos = getVillaPosition(villa, idx);
      const isMatched = matched.has(villa.id);
      const { fill, border } = getVillaPinColor(villa, isMatched);

      // Calculate distance from search center
      let distance: number | undefined;
      if (searchCenter) {
        distance = haversineDistance(searchCenter.lat, searchCenter.lng, pos[0], pos[1]);
      }

      let marker: L.Layer;

      if (isMatched) {
        // Google Maps–style drop pin for matched villas
        const pinSize = 32;
        const pinIcon = L.divIcon({
          html: buildDropPinSvg(fill, border, pinSize),
          className: 'villa-drop-pin',
          iconSize: [pinSize, Math.round(pinSize * 1.35)],
          iconAnchor: [pinSize / 2, Math.round(pinSize * 1.35)],
          popupAnchor: [0, -Math.round(pinSize * 1.35)],
        });
        const m = L.marker(pos, { icon: pinIcon, zIndexOffset: 1000 });
        m.on('click', () => onSelectRef.current(villa.id));
        m.bindPopup(buildPopupContent(villa, distance), {
          className: 'villa-map-popup',
          maxWidth: 240,
          closeButton: true,
          autoPan: true,
          offset: [0, 0],
        });
        m.bindTooltip(
          `Villa ${villa.villa_number}${villa.bedrooms ? ` • ${villa.bedrooms}BR` : ''}${villa.plot_size_sqft ? ` • ${villa.plot_size_sqft.toLocaleString()}sqft` : ''}`,
          { direction: 'top', className: 'plot-tooltip-premium', offset: [0, -Math.round(pinSize * 1.35)], permanent: false }
        );
        marker = m;
      } else {
        // Standard circle marker for non-matched
        const cm = L.circleMarker(pos, {
          radius: 6,
          fillColor: fill,
          fillOpacity: 0.75,
          color: border,
          weight: 2,
          opacity: 0.9,
        });
        cm.on('click', () => onSelectRef.current(villa.id));
        cm.bindPopup(buildPopupContent(villa, distance), {
          className: 'villa-map-popup',
          maxWidth: 240,
          closeButton: true,
          autoPan: true,
          offset: [0, -6],
        });
        cm.bindTooltip(
          `Villa ${villa.villa_number}${villa.bedrooms ? ` • ${villa.bedrooms}BR` : ''}${villa.plot_size_sqft ? ` • ${villa.plot_size_sqft.toLocaleString()}sqft` : ''}`,
          { direction: 'top', className: 'plot-tooltip-premium', offset: [0, -8], permanent: false }
        );
        marker = cm;
      }

      lg.addLayer(marker);
      markerMapRef.current.set(villa.id, marker);
    });
  }, [villas, searchCenter, matchedVillaIds]);

  // GIS plot match pins
  useEffect(() => {
    const layer = gisPlotLayerRef.current;
    if (!layer) return;

    layer.clearLayers();
    const plotted = new Set<string>();
    const duplicateCoordinateCounts = new Map<string, number>();

    let fallbackIndex = 0;

    gisResults.forEach((result) => {
      if (plotted.has(result.plot.id)) return;
      plotted.add(result.plot.id);

      let coords = normalizeCoordinatesForSearch(result.plot.y, result.plot.x);
      
      // Fallback: if no coords, jitter around search center
      if (!coords && searchCenter) {
        fallbackIndex++;
        const jitterDist = 30 + fallbackIndex * 12;
        const jitterBearing = (fallbackIndex * 137.5) % 360; // golden angle spread
        coords = offsetLatLngByMeters(searchCenter.lat, searchCenter.lng, jitterDist, jitterBearing);
      }
      if (!coords) return;

      const coordinateKey = `${coords.lat.toFixed(6)}:${coords.lng.toFixed(6)}`;
      const duplicateIndex = duplicateCoordinateCounts.get(coordinateKey) ?? 0;
      duplicateCoordinateCounts.set(coordinateKey, duplicateIndex + 1);

      let markerLat = coords.lat;
      let markerLng = coords.lng;

      if (duplicateIndex > 0) {
        const jitterDistanceMeters = Math.min(duplicateIndex * 8, 48);
        const jitterBearing = (duplicateIndex * 47) % 360;
        const offset = offsetLatLngByMeters(coords.lat, coords.lng, jitterDistanceMeters, jitterBearing);
        markerLat = offset.lat;
        markerLng = offset.lng;
      }

      // Small non-glowing red pin for all GIS plot matches (Google Maps size)
      const pinSize = 18;

      const marker = L.marker([markerLat, markerLng], {
        icon: L.divIcon({
          html: buildDropPinSvg('hsl(4,86%,58%)', 'hsl(0,0%,100%)', pinSize),
          className: 'villa-gis-plot-pin',
          iconSize: [pinSize, Math.round(pinSize * 1.35)],
          iconAnchor: [pinSize / 2, Math.round(pinSize * 1.35)],
          popupAnchor: [0, -Math.round(pinSize * 1.35)],
        }),
        zIndexOffset: 920,
      });

      const distance = searchCenter
        ? haversineDistance(searchCenter.lat, searchCenter.lng, coords.lat, coords.lng)
        : undefined;

      marker.bindPopup(`
        <div style="font-family:system-ui,-apple-system,sans-serif;min-width:210px">
          <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:6px">
            <span style="font-size:13px;font-weight:800;color:#fff">Plot ${result.plot.id}</span>
            <span style="font-size:9px;padding:2px 6px;border-radius:999px;background:rgba(34,211,238,0.15);color:rgb(34,211,238);font-weight:700">${result.confidenceScore}%</span>
          </div>
          <div style="font-size:10px;color:#9ca3af;margin-bottom:4px">Source: ${result.source}</div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;margin-top:6px;padding-top:6px;border-top:1px solid rgba(255,255,255,0.08)">
            <div>
              <div style="font-size:8px;color:#6b7280;text-transform:uppercase">Area</div>
              <div style="font-size:10px;color:#d1d5db;font-weight:600">${result.plot.area ? Math.round(result.plot.area).toLocaleString() + ' m²' : '—'}</div>
            </div>
            <div>
              <div style="font-size:8px;color:#6b7280;text-transform:uppercase">GFA</div>
              <div style="font-size:10px;color:#d1d5db;font-weight:600">${result.plot.gfa ? Math.round(result.plot.gfa).toLocaleString() + ' m²' : '—'}</div>
            </div>
          </div>
          ${distance != null ? `<div style="font-size:9px;color:#22d3ee;margin-top:6px">📍 ${distance < 1000 ? `${Math.round(distance)}m` : `${(distance / 1000).toFixed(1)}km`} from search center</div>` : ''}
        </div>
      `, { className: 'villa-map-popup', maxWidth: 240, closeButton: true });

      layer.addLayer(marker);
    });
  }, [gisResults, searchCenter]);

  // ─── Amenity icon markers ───
  useEffect(() => {
    const layer = amenityLayerRef.current;
    if (!layer) return;
    layer.clearLayers();

    if (amenities.length === 0) return;

    // De-duplicate by plotId
    const seen = new Set<string>();
    for (const amenity of amenities) {
      const key = amenity.plotId || `${amenity.coordinates[0]},${amenity.coordinates[1]}`;
      if (seen.has(key)) continue;
      seen.add(key);

      const config = AMENITY_CONFIG[amenity.type];
      if (!config) continue;

      const [lat, lng] = amenity.coordinates;

      const icon = L.divIcon({
        html: `<div style="
          width:28px;height:28px;border-radius:50%;
          background:${config.mapColor};
          border:2px solid rgba(255,255,255,0.9);
          box-shadow:0 2px 8px rgba(0,0,0,0.4), 0 0 12px ${config.mapColor}44;
          display:flex;align-items:center;justify-content:center;
          font-size:14px;line-height:1;
        ">${config.emoji}</div>`,
        className: 'villa-amenity-icon',
        iconSize: [28, 28],
        iconAnchor: [14, 14],
      });

      const marker = L.marker([lat, lng], { icon, zIndexOffset: 800, interactive: true });

      marker.bindTooltip(
        `${config.emoji} ${config.label} — ${amenity.distanceMeters}m`,
        { direction: 'top', className: 'plot-tooltip-premium', offset: [0, -16], permanent: false }
      );

      marker.bindPopup(`
        <div style="font-family:system-ui;min-width:160px">
          <div style="font-size:18px;margin-bottom:4px">${config.emoji}</div>
          <div style="font-size:12px;font-weight:700;color:#fff">${config.label}</div>
          <div style="font-size:10px;color:#9ca3af;margin-top:2px">${amenity.name}</div>
          <div style="font-size:11px;font-weight:700;color:${config.mapColor};margin-top:6px">${amenity.distanceMeters}m away</div>
        </div>
      `, { className: 'villa-map-popup', maxWidth: 200, closeButton: true });

      layer.addLayer(marker);
    }
  }, [amenities]);

  // If there is no explicit center, frame GIS plot matches
  useEffect(() => {
    const map = mapRef.current;
    if (!map || searchCenter || gisResults.length === 0) return;

    const points = gisResults
      .map((result) => normalizeCoordinatesForSearch(result.plot.y, result.plot.x))
      .filter((coord): coord is { lat: number; lng: number } => Boolean(coord));

    if (points.length === 0) return;

    const bounds = L.latLngBounds(points.map((coord) => [coord.lat, coord.lng] as [number, number]));
    map.flyToBounds(bounds.pad(0.15), { duration: 0.7, padding: [30, 30] });
  }, [gisResults, searchCenter]);

  // Highlight selected
  useEffect(() => {
    markerMapRef.current.forEach((marker, id) => {
      const isSelected = id === selectedVillaId;
      if ('setStyle' in marker && typeof (marker as any).setStyle === 'function') {
        (marker as L.CircleMarker).setStyle({
          radius: isSelected ? 12 : 6,
          weight: isSelected ? 4 : 2,
          fillOpacity: isSelected ? 1 : 0.75,
        });
      } else if (isSelected && marker instanceof L.Marker) {
        // For drop-pin markers, swap to a larger icon when selected
        const pinSize = 42;
        const { fill, border } = { fill: '#ef4444', border: '#fff' };
        marker.setIcon(L.divIcon({
          html: buildDropPinSvg(fill, border, pinSize),
          className: 'villa-drop-pin villa-drop-pin-selected',
          iconSize: [pinSize, Math.round(pinSize * 1.35)],
          iconAnchor: [pinSize / 2, Math.round(pinSize * 1.35)],
          popupAnchor: [0, -Math.round(pinSize * 1.35)],
        }));
      }
      if (isSelected && 'bringToFront' in marker) (marker as any).bringToFront();
    });
  }, [selectedVillaId, matchedVillaIds]);

  // Fly to selected
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !selectedVillaId) return;
    const marker = markerMapRef.current.get(selectedVillaId);
    if (marker) {
      const latlng = 'getLatLng' in marker ? (marker as any).getLatLng() : null;
      if (latlng) {
        map.flyTo(latlng, 16, { duration: 0.5 });
        (marker as any).openPopup?.();
      }
    }
  }, [selectedVillaId]);

  // Resize observer
  useEffect(() => {
    const map = mapRef.current;
    const el = containerRef.current;
    if (!map || !el) return;
    const ro = new ResizeObserver(() => map.invalidateSize());
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  return (
    <>
      <div ref={containerRef} className="absolute inset-0 min-h-0" style={{ background: 'hsl(220, 20%, 8%)' }} />

      {/* Search center info overlay */}
      {searchCenter && (
        <div className="absolute top-3 left-1/2 -translate-x-1/2 z-[500] bg-[hsl(220,25%,10%,0.95)] border border-[hsl(220,20%,26%)] rounded-lg px-4 py-2 backdrop-blur-sm flex items-center gap-3">
          <div className="h-2 w-2 rounded-full bg-[hsl(0,0%,80%)]" />
          <span className="text-[11px] text-[hsl(220,10%,78%)] font-medium">
            Radius Search Active • {searchRadius >= 1000 ? `${(searchRadius / 1000).toFixed(1)}km` : `${searchRadius}m`}
          </span>
          <span className="text-[10px] text-[hsl(220,10%,50%)]">
            {searchCenter.lat.toFixed(4)}, {searchCenter.lng.toFixed(4)}
          </span>
        </div>
      )}

      {/* Map legend */}
      <div className="absolute bottom-4 left-4 z-[500] bg-[hsl(220,25%,10%,0.95)] border border-[hsl(220,20%,18%)] rounded-lg p-2.5 backdrop-blur-sm">
        <div className="text-[8px] text-[hsl(220,10%,50%)] uppercase tracking-wider mb-1.5 font-semibold">Pin Status</div>
        <div className="space-y-1">
          {[
            { color: '#ea4335', label: 'GIS Plot Match' },
            { color: '#ef4444', label: 'Matched Villa' },
            { color: '#10b981', label: 'Available' },
            { color: '#f97316', label: 'Under Offer / Vastu' },
            { color: '#3b82f6', label: 'Internal / Corner' },
            { color: '#6b7280', label: 'Sold' },
            { color: '#a855f7', label: 'Single Row' },
          ].map(item => (
            <div key={item.label} className="flex items-center gap-1.5">
              <div className="w-2.5 h-2.5 rounded-full" style={{ background: item.color }} />
              <span className="text-[9px] text-[hsl(220,10%,65%)]">{item.label}</span>
            </div>
          ))}
        </div>
        {amenities.length > 0 && (
          <div className="mt-2 pt-1.5 border-t border-[hsl(220,20%,16%)]">
            <div className="text-[8px] text-[hsl(220,10%,50%)] uppercase tracking-wider mb-1 font-semibold">Amenities</div>
            <div className="space-y-0.5">
              {Array.from(new Set(amenities.map(a => a.type))).slice(0, 5).map(type => {
                const config = AMENITY_CONFIG[type];
                return (
                  <div key={type} className="flex items-center gap-1.5">
                    <span className="text-[10px]">{config.emoji}</span>
                    <span className="text-[9px] text-[hsl(220,10%,65%)]">{config.label}</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}
        <div className="text-[8px] text-[hsl(220,10%,40%)] mt-2 pt-1.5 border-t border-[hsl(220,20%,16%)]">
          Right-click map → Drop pin → Radius search
        </div>
      </div>

      <style>{`
        .villa-map-popup .leaflet-popup-content-wrapper {
          background: hsl(220, 25%, 10%);
          border: 1px solid hsl(220, 20%, 18%);
          border-radius: 12px;
          box-shadow: 0 12px 40px rgba(0,0,0,0.5);
          color: white;
          padding: 0;
        }
        .villa-map-popup .leaflet-popup-content {
          margin: 12px 14px;
          line-height: 1.4;
        }
        .villa-map-popup .leaflet-popup-tip {
          background: hsl(220, 25%, 10%);
          border: 1px solid hsl(220, 20%, 18%);
          border-top: none;
          border-left: none;
        }
        .villa-map-popup .leaflet-popup-close-button {
          color: #6b7280 !important;
          font-size: 16px !important;
          top: 6px !important;
          right: 8px !important;
        }
        .villa-map-popup .leaflet-popup-close-button:hover {
          color: #fff !important;
        }
        .villa-drop-pin {
          filter: drop-shadow(0 2px 5px rgba(0,0,0,0.35));
          transition: transform 0.15s ease;
        }
        .villa-drop-pin:hover {
          transform: scale(1.1) translateY(-1px);
        }
        .villa-drop-pin-selected {
          filter: drop-shadow(0 3px 8px rgba(239,68,68,0.4));
          animation: pin-bounce 0.4s ease-out;
        }
        .villa-gis-plot-pin {
          filter: none;
          transition: none;
        }
        .villa-amenity-icon {
          filter: drop-shadow(0 1px 3px rgba(0,0,0,0.3));
          transition: transform 0.15s ease;
        }
        .villa-amenity-icon:hover {
          transform: scale(1.15);
        }
        @keyframes pin-bounce {
          0% { transform: translateY(-20px); opacity: 0; }
          60% { transform: translateY(4px); }
          100% { transform: translateY(0); opacity: 1; }
        }
      `}</style>
    </>
  );
});
