import { useEffect, useRef, memo, useCallback } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import type { Plot } from '@/hooks/usePlots';
import { gisService } from '@/services/DDAGISService';

interface LandOSMapViewProps {
  plots: Plot[];
  selectedPlotId: string | null;
  onSelectPlot: (plotId: string) => void;
}

const DUBAI_CENTER: [number, number] = [25.2048, 55.2708];
const DEFAULT_ZOOM = 12;

const UAE_BOUNDS: L.LatLngBoundsExpression = [
  [22.5, 51.0],
  [26.5, 56.5],
];

const STATUS_COLORS: Record<string, string> = {
  available: '#22c55e',
  under_negotiation: '#f59e0b',
  sold: '#ef4444',
  reserved: '#0ea5e9',
  pending: '#f97316',
};

const NEON_CYAN = '#ff6600';

function isValidLatLng(lat: number, lng: number): boolean {
  return Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180;
}

function getPlotPosition(plot: Plot, index: number): [number, number] {
  if (plot.location_coordinates) {
    const coords = plot.location_coordinates as { lat?: number; lng?: number };
    if (typeof coords.lat === 'number' && typeof coords.lng === 'number' && isValidLatLng(coords.lat, coords.lng)) {
      return [coords.lat, coords.lng];
    }
  }
  const areas: Record<string, [number, number]> = {
    'al reem island': [24.4975, 54.4050],
    'jumeira first': [25.2145, 55.2530],
    'jumeirah': [25.2145, 55.2530],
    'dubai south': [24.8900, 55.1500],
    'business bay': [25.1860, 55.2720],
    'downtown': [25.1972, 55.2744],
    'jlt': [25.0757, 55.1380],
    'marina': [25.0801, 55.1342],
    'creek harbour': [25.1950, 55.3400],
    'meydan': [25.1600, 55.3000],
    'palm': [25.1124, 55.1390],
  };
  const areaKey = Object.keys(areas).find(k => plot.area_name.toLowerCase().includes(k));
  if (areaKey) {
    const base = areas[areaKey];
    return [base[0] + (index * 0.002) % 0.01, base[1] + (index * 0.003) % 0.01];
  }
  const hash = plot.id.split('').reduce((a, c) => a + c.charCodeAt(0), 0);
  return [
    DUBAI_CENTER[0] + ((hash % 100) - 50) * 0.002,
    DUBAI_CENTER[1] + ((hash % 73) - 36) * 0.003,
  ];
}

function generatePlotPolygon(center: [number, number], sizeSqm: number): [number, number][] {
  const side = Math.sqrt(sizeSqm) * 0.00001;
  const halfSide = side / 2;
  return [
    [center[0] - halfSide, center[1] - halfSide],
    [center[0] - halfSide, center[1] + halfSide],
    [center[0] + halfSide, center[1] + halfSide],
    [center[0] + halfSide, center[1] - halfSide],
  ];
}

function formatPrice(price: number | null): string {
  if (!price) return '';
  if (price >= 1e6) return `AED ${(price / 1e6).toFixed(1)}M`;
  return `AED ${(price / 1e3).toFixed(0)}K`;
}

export const LandOSMapView = memo(function LandOSMapView({
  plots,
  selectedPlotId,
  onSelectPlot,
}: LandOSMapViewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const layerGroupRef = useRef<L.LayerGroup | null>(null);
  const glowGroupRef = useRef<L.LayerGroup | null>(null);
  const gisBoundaryGroupRef = useRef<L.LayerGroup | null>(null);
  const polygonMapRef = useRef<Map<string, L.Polygon>>(new Map());
  const verticesMapRef = useRef<Map<string, [number, number][]>>(new Map());
  const gisCacheRef = useRef<Map<string, [number, number][][] | null>>(new Map());
  const gisLoadedPlotsRef = useRef<Set<string>>(new Set());
  const onSelectRef = useRef(onSelectPlot);
  onSelectRef.current = onSelectPlot;

  // Initialize map ONCE
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const map = L.map(containerRef.current, {
      center: DUBAI_CENTER,
      zoom: DEFAULT_ZOOM,
      zoomControl: false,
      attributionControl: false,
      preferCanvas: true,
      zoomAnimation: true,
      fadeAnimation: true,
      inertia: true,
      inertiaDeceleration: 3000,
      maxBounds: UAE_BOUNDS,
      maxBoundsViscosity: 0.9,
      minZoom: 8,
      maxZoom: 19,
      worldCopyJump: false,
    });

    L.tileLayer(
      'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
      {
        maxZoom: 19,
        noWrap: true,
        updateWhenZooming: false,
        updateWhenIdle: true,
        keepBuffer: 2,
      }
    ).addTo(map);

    L.control.zoom({ position: 'topleft' }).addTo(map);

    const lg = L.layerGroup().addTo(map);
    const gg = L.layerGroup().addTo(map);
    const bg = L.layerGroup().addTo(map);
    layerGroupRef.current = lg;
    glowGroupRef.current = gg;
    gisBoundaryGroupRef.current = bg;
    mapRef.current = map;

    requestAnimationFrame(() => map.invalidateSize());

    return () => {
      map.remove();
      mapRef.current = null;
      layerGroupRef.current = null;
      gisBoundaryGroupRef.current = null;
    };
  }, []);

  // Sync polygons when plots change (decoupled from selection)
  useEffect(() => {
    const lg = layerGroupRef.current;
    if (!lg) return;

    lg.clearLayers();
    polygonMapRef.current.clear();
    verticesMapRef.current.clear();

    plots.forEach((plot, idx) => {
      const center = getPlotPosition(plot, idx);
      const vertices = generatePlotPolygon(center, plot.plot_size || 1000);
      const color = STATUS_COLORS[plot.status] || '#00bcd4';

      const polygon = L.polygon(vertices as L.LatLngExpression[], {
        color,
        weight: 1.5,
        fillColor: color,
        fillOpacity: 0.2,
      });

      polygon.on('click', () => onSelectRef.current(plot.id));

      const priceStr = formatPrice(plot.price);
      polygon.bindTooltip(
        `<div style="font-family:system-ui;padding:2px 0">
          <div style="font-size:12px;font-weight:700;margin-bottom:2px">${plot.plot_number}</div>
          <div style="font-size:10px;color:#9ca3af">${plot.area_name}</div>
          <div style="font-size:10px;margin-top:3px">${(plot.plot_size || 0).toLocaleString()} sqft</div>
          ${priceStr ? `<div style="font-size:11px;font-weight:600;color:#86efac;margin-top:2px">${priceStr}</div>` : ''}
        </div>`,
        { direction: 'top', className: 'plot-tooltip-premium', offset: [0, -4] }
      );

      lg.addLayer(polygon);
      polygonMapRef.current.set(plot.id, polygon);
      verticesMapRef.current.set(plot.id, vertices);
    });
  }, [plots]);

  // Highlight selected polygon + fetch real GIS boundary
  const renderGISBoundary = useCallback(async (plotNumber: string, plotId: string) => {
    const bg = gisBoundaryGroupRef.current;
    const gg = glowGroupRef.current;
    if (!bg) return;

    // Check cache first
    if (gisCacheRef.current.has(plotNumber)) {
      const cached = gisCacheRef.current.get(plotNumber);
      if (cached) {
      renderBoundaryLayers(bg, cached);
        gisLoadedPlotsRef.current.add(plotId);
        const genPoly = polygonMapRef.current.get(plotId);
        if (genPoly) genPoly.setStyle({ opacity: 0, fillOpacity: 0 });
        if (gg) gg.clearLayers();
      }
      return;
    }

    // Fetch real boundary from DDA GIS
    console.log(`[GIS] Fetching real boundary for plot: ${plotNumber}`);
    const rings = await gisService.fetchPlotBoundary(plotNumber);
    gisCacheRef.current.set(plotNumber, rings);

    if (rings) {
      console.log(`[GIS] Received ${rings.length} ring(s) with ${rings[0]?.length || 0} vertices`);
      renderBoundaryLayers(bg, rings);
      gisLoadedPlotsRef.current.add(plotId);
      const genPoly = polygonMapRef.current.get(plotId);
      if (genPoly) genPoly.setStyle({ opacity: 0, fillOpacity: 0 });
      if (gg) gg.clearLayers();
    } else {
      console.log(`[GIS] No boundary found for ${plotNumber}, using generated polygon`);
    }
  }, []);

  useEffect(() => {
    const gg = glowGroupRef.current;
    const bg = gisBoundaryGroupRef.current;
    if (gg) gg.clearLayers();
    if (bg) bg.clearLayers();

    polygonMapRef.current.forEach((polygon, id) => {
      const isSelected = id === selectedPlotId;
      const plot = plots.find(p => p.id === id);
      const baseColor = STATUS_COLORS[plot?.status || 'available'] || '#00bcd4';
      const hasRealBoundary = gisLoadedPlotsRef.current.has(id);

      // Hide generated polygon entirely if real GIS boundary was loaded
      if (hasRealBoundary) {
        polygon.setStyle({ opacity: 0, fillOpacity: 0 });
      } else {
        polygon.setStyle({
          color: isSelected ? NEON_CYAN : baseColor,
          weight: isSelected ? 2.5 : 1.5,
          fillColor: isSelected ? NEON_CYAN : baseColor,
          fillOpacity: isSelected ? 0.25 : 0.2,
          opacity: 1,
        });
      }

      if (isSelected) {
        if (!hasRealBoundary && gg) {
          const vertices = verticesMapRef.current.get(id);
          if (vertices) addGlowLayers(gg, vertices);
        }
        polygon.bringToFront();

        // Fetch real GIS boundary — will hide generated polygon if found
        if (plot) {
          renderGISBoundary(plot.plot_number, plot.id);
        }
      }
    });
  }, [selectedPlotId, plots, renderGISBoundary]);

  // Fly to selected
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !selectedPlotId) return;

    const polygon = polygonMapRef.current.get(selectedPlotId);
    if (polygon) {
      const center = polygon.getBounds().getCenter();
      if (isValidLatLng(center.lat, center.lng)) {
        map.flyTo(center, 16, { duration: 0.6 });
      }
    } else {
      const plot = plots.find(p => p.id === selectedPlotId);
      if (plot) {
        const idx = plots.indexOf(plot);
        const pos = getPlotPosition(plot, idx);
        if (isValidLatLng(pos[0], pos[1])) {
          map.flyTo(pos, 16, { duration: 0.6 });
        }
      }
    }
  }, [selectedPlotId, plots]);

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
    <div
      ref={containerRef}
      className="absolute inset-0 min-h-0"
      style={{ background: 'hsl(220, 20%, 8%)' }}
    />
  );
});

/** Render neon glow layers around a set of vertices */
function addGlowLayers(group: L.LayerGroup, vertices: [number, number][]) {
  const glowMega = L.polygon(vertices as L.LatLngExpression[], {
    color: '#ff4400', weight: 40, fillOpacity: 0, opacity: 0.15, interactive: false,
  });
  const glowUltra = L.polygon(vertices as L.LatLngExpression[], {
    color: NEON_CYAN, weight: 28, fillOpacity: 0, opacity: 0.25, interactive: false,
  });
  const glowOuter = L.polygon(vertices as L.LatLngExpression[], {
    color: NEON_CYAN, weight: 16, fillOpacity: 0, opacity: 0.45, interactive: false,
  });
  const glowInner = L.polygon(vertices as L.LatLngExpression[], {
    color: '#ffaa33', weight: 6, fillOpacity: 0, opacity: 0.7, interactive: false,
  });
  group.addLayer(glowMega);
  group.addLayer(glowUltra);
  group.addLayer(glowOuter);
  group.addLayer(glowInner);
}

/** Render real GIS boundary with neon highlight */
function renderBoundaryLayers(group: L.LayerGroup, rings: [number, number][][]) {
  group.clearLayers();

  for (const ring of rings) {
    // Mega halo — widest spread
    const glowMega = L.polygon(ring as L.LatLngExpression[], {
      color: '#ff4400',
      weight: 44,
      fillOpacity: 0,
      opacity: 0.12,
      interactive: false,
      lineCap: 'round',
      lineJoin: 'round',
    });

    // Ultra-wide outer halo
    const glowUltra = L.polygon(ring as L.LatLngExpression[], {
      color: NEON_CYAN,
      weight: 30,
      fillOpacity: 0,
      opacity: 0.2,
      interactive: false,
      lineCap: 'round',
      lineJoin: 'round',
    });

    // Outer neon glow
    const glowWide = L.polygon(ring as L.LatLngExpression[], {
      color: NEON_CYAN,
      weight: 18,
      fillOpacity: 0,
      opacity: 0.4,
      interactive: false,
      lineCap: 'round',
      lineJoin: 'round',
    });

    // Mid glow — bright
    const glowMid = L.polygon(ring as L.LatLngExpression[], {
      color: '#ffaa33',
      weight: 10,
      fillOpacity: 0,
      opacity: 0.6,
      interactive: false,
      lineCap: 'round',
      lineJoin: 'round',
    });

    // Core bright border
    const core = L.polygon(ring as L.LatLngExpression[], {
      color: '#ffcc55',
      weight: 4,
      fillColor: NEON_CYAN,
      fillOpacity: 0.18,
      opacity: 1,
      interactive: false,
      lineCap: 'round',
      lineJoin: 'round',
    });

    // Inner fill
    const fill = L.polygon(ring as L.LatLngExpression[], {
      color: 'transparent',
      weight: 0,
      fillColor: NEON_CYAN,
      fillOpacity: 0.15,
      interactive: false,
    });

    group.addLayer(glowMega);
    group.addLayer(glowUltra);
    group.addLayer(glowWide);
    group.addLayer(glowMid);
    group.addLayer(core);
    group.addLayer(fill);
  }
}
