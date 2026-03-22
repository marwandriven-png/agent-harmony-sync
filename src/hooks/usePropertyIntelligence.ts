/**
 * usePropertyIntelligence — Performance-optimized villa classification hook.
 *
 * Key improvements over previous version:
 *  1. buildBatch() called ONCE per data change — plots classified once, reused per villa
 *  2. Plot lookup Map eliminates O(n) find() per villa
 *  3. Web Worker-style chunking with larger chunks (50 vs 20) — fewer rAF yields
 *  4. Cache keyed on (villaId + facingDirection) — no stale data after data changes
 *  5. Community amenity registry fallback when GIS plots have no amenity features
 *  6. Exposes per-villa `score` for filter ranking
 */

import { useState, useEffect, useMemo, useRef } from 'react';
import type { CommunityVilla } from './useVillas';
import type { PlotData } from '@/services/DDAGISService';
import { propertyIntelligence, type PlotBatch } from '@/services/property-intelligence/engine';
import { computeVillaScore } from '@/services/property-intelligence/filter';
import type { DetectedAmenity, LayoutAnalysis, SmartTag } from '@/services/property-intelligence/types';
import { normalizePlotKey } from '@/services/property-intelligence/unit-reference';

export interface VillaIntelligence {
  villaId:       string;
  layout:        LayoutAnalysis;
  amenities:     DetectedAmenity[];
  tags:          SmartTag[];
  score:         number;
  isProcessing:  boolean;
}

const CHUNK_SIZE = 50; // villas per animation frame — larger = fewer yields = faster

export function usePropertyIntelligence(
  villas: CommunityVilla[],
  nearbyPlots: PlotData[],
) {
  const [intelligenceMap, setIntelligenceMap] = useState<Map<string, VillaIntelligence>>(new Map());
  const [isProcessing, setIsProcessing]       = useState(false);

  // Keep a stable ref to the batch so we don't recompute on irrelevant re-renders
  const batchRef = useRef<PlotBatch | null>(null);

  useEffect(() => {
    let isMounted       = true;
    let cancelRef       = { value: false };

    // Invalidate engine cache whenever underlying data changes
    propertyIntelligence.clearCache();

    if (!villas.length || !nearbyPlots.length) {
      batchRef.current = null;
      if (isMounted) { setIntelligenceMap(new Map()); setIsProcessing(false); }
      return () => { isMounted = false; cancelRef.value = true; };
    }

    // ── Step 1: Build the plot batch ONCE for the whole villa set ──────────
    const batch = propertyIntelligence.buildBatch(nearbyPlots);
    batchRef.current = batch;

    // Fast O(1) lookup: plotId → PlotData
    const plotById = new Map<string, PlotData>();
    nearbyPlots.forEach((plot) => {
      const keys = [normalizePlotKey(plot.id)];
      keys.filter((key): key is string => Boolean(key)).forEach((key) => {
        if (!plotById.has(key)) plotById.set(key, plot);
      });
    });

    setIsProcessing(true);
    const newMap = new Map<string, VillaIntelligence>();
    let idx = 0;

    // ── Step 2: Process in chunks, yielding to browser between chunks ──────
    const processChunk = () => {
      if (cancelRef.value || !isMounted) return;

      const end   = Math.min(idx + CHUNK_SIZE, villas.length);
      const chunk = villas.slice(idx, end);

      for (const villa of chunk) {
        // If villa has a matching GIS plot, use polygon-aware analysis
        const villaPlot = (villa.plot_number ? plotById.get(normalizePlotKey(villa.plot_number) ?? '') : null)
          ?? (villa.plot_id ? plotById.get(normalizePlotKey(villa.plot_id) ?? '') : null)
          ?? (villa.id.startsWith('gis:') ? plotById.get(normalizePlotKey(villa.id.replace(/^gis:/, '')) ?? '') : null)
          ?? null;

        // Villas without a linked GIS plot still need coordinates for centroid fallback
        if (!villaPlot && (!villa.latitude || !villa.longitude)) continue;

        let layout:    LayoutAnalysis;
        let amenities: DetectedAmenity[];

        if (villaPlot) {
          // Polygon-accurate analysis using pre-built batch (fast path)
          const result = propertyIntelligence.analyzeWithBatch(villaPlot, batch, villa.facing_direction);
          layout    = result.layout;
          amenities = result.amenities;
        } else {
          // Centroid-only fallback — still uses the same batch-classified plots
          layout    = propertyIntelligence.analyzeLayout(villa.latitude, villa.longitude, nearbyPlots);
          amenities = propertyIntelligence.detectAmenities(villa.latitude, villa.longitude, nearbyPlots);
        }

        const tags = propertyIntelligence.generateSmartTags(villa, amenities, layout);

        const intel: VillaIntelligence = {
          villaId: villa.id,
          layout,
          amenities,
          tags,
          score: 0,
          isProcessing: false,
        };
        intel.score = computeVillaScore(intel);
        newMap.set(villa.id, intel);
      }

      idx = end;

      // Emit incremental update — UI becomes responsive immediately
      if (isMounted) setIntelligenceMap(new Map(newMap));

      if (idx < villas.length) {
        // Yield to browser then continue
        requestAnimationFrame(processChunk);
      } else if (isMounted) {
        setIsProcessing(false);
      }
    };

    requestAnimationFrame(processChunk);

    return () => {
      isMounted       = false;
      cancelRef.value = true;
    };
  }, [villas, nearbyPlots]);

  // Deduplicated amenity list for map icon display
  const allAmenities = useMemo((): DetectedAmenity[] => {
    const seen = new Map<string, DetectedAmenity>();
    for (const intel of intelligenceMap.values()) {
      for (const a of intel.amenities) {
        const key = a.plotId || `${a.coordinates[0].toFixed(5)},${a.coordinates[1].toFixed(5)}`;
        const existing = seen.get(key);
        if (!existing || a.distanceMeters < existing.distanceMeters) seen.set(key, a);
      }
    }
    return Array.from(seen.values());
  }, [intelligenceMap]);

  return { intelligenceMap, allAmenities, isProcessing };
}
