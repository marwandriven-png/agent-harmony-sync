import { useState, useEffect, useMemo } from 'react';
import type { CommunityVilla } from './useVillas';
import type { PlotData } from '@/services/DDAGISService';
import { propertyIntelligence } from '@/services/property-intelligence/engine';
import { computeVillaScore } from '@/services/property-intelligence/filter';
import type { DetectedAmenity, LayoutAnalysis, SmartTag } from '@/services/property-intelligence/types';

export interface VillaIntelligence {
  villaId: string;
  layout: LayoutAnalysis;
  amenities: DetectedAmenity[];
  tags: SmartTag[];
  score: number;
  isProcessing: boolean;
}

export function usePropertyIntelligence(villas: CommunityVilla[], nearbyPlots: PlotData[]) {
  const [intelligenceMap, setIntelligenceMap] = useState<Map<string, VillaIntelligence>>(new Map());
  const [isProcessing, setIsProcessing] = useState(false);

  useEffect(() => {
    let isMounted = true;
    let cancelProcessing = false;

    // Clear cache when data changes to avoid stale results
    propertyIntelligence.clearCache();

    async function processVillas() {
      if (!villas.length || !nearbyPlots.length) {
        if (isMounted) setIntelligenceMap(new Map());
        return;
      }

      setIsProcessing(true);
      const newMap = new Map<string, VillaIntelligence>();
      
      const chunkSize = 20;
      let currentIndex = 0;

      const processChunk = () => {
        if (cancelProcessing || !isMounted) return;

        const chunk = villas.slice(currentIndex, currentIndex + chunkSize);
        
        for (const villa of chunk) {
          if (!villa.latitude || !villa.longitude) continue;

          const villaPlot = nearbyPlots.find(p => p.id === villa.plot_number) || null;
          
          let layout: LayoutAnalysis;
          let amenities: DetectedAmenity[];
          
          if (villaPlot) {
             const analysis = propertyIntelligence.analyzeWithPolygons(
               villaPlot,
               nearbyPlots.filter(p => p.id !== villaPlot.id),
               villa.facing_direction
             );
             layout = analysis.layout;
             amenities = analysis.amenities;
          } else {
             layout = propertyIntelligence.analyzeLayout(villa.latitude, villa.longitude, nearbyPlots);
             amenities = propertyIntelligence.detectAmenities(villa.latitude, villa.longitude, nearbyPlots);
          }

          const tags = propertyIntelligence.generateSmartTags(villa, amenities, layout);

          const intel: VillaIntelligence = {
            villaId: villa.id,
            layout,
            amenities,
            tags,
            score: 0,
            isProcessing: false
          };
          // Compute score after constructing the intelligence object
          intel.score = computeVillaScore(intel);

          newMap.set(villa.id, intel);
        }

        currentIndex += chunkSize;

        if (isMounted) {
          setIntelligenceMap(new Map(newMap));
        }

        if (currentIndex < villas.length) {
          requestAnimationFrame(processChunk);
        } else if (isMounted) {
          setIsProcessing(false);
        }
      };

      requestAnimationFrame(processChunk);
    }

    processVillas();

    return () => {
      isMounted = false;
      cancelProcessing = true;
    };
  }, [villas, nearbyPlots]);

  // Aggregate all unique amenities across all visible villas for map display
  const allAmenities = useMemo(() => {
    const amenityMap = new Map<string, DetectedAmenity>();
    
    Array.from(intelligenceMap.values()).forEach(intel => {
      intel.amenities.forEach(amenity => {
        const key = amenity.plotId || `${amenity.coordinates[0]},${amenity.coordinates[1]}`;
        const existing = amenityMap.get(key);
        
        if (!existing || amenity.distanceMeters < existing.distanceMeters) {
          amenityMap.set(key, amenity);
        }
      });
    });
    
    return Array.from(amenityMap.values());
  }, [intelligenceMap]);

  return {
    intelligenceMap,
    allAmenities,
    isProcessing
  };
}
