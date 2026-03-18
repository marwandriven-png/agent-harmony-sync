import { useState, useEffect, useMemo } from 'react';
import type { CommunityVilla } from './useVillas';
import type { PlotData } from '@/services/DDAGISService';
import { villaGISService } from '@/services/VillaGISService';
import { propertyIntelligence } from '@/services/PropertyIntelligenceService';
import type { DetectedAmenity, LayoutAnalysis, SmartTag } from '@/services/property-intelligence/types';

export interface VillaIntelligence {
  villaId: string;
  layout: LayoutAnalysis;
  amenities: DetectedAmenity[];
  tags: SmartTag[];
  isProcessing: boolean;
}

export function usePropertyIntelligence(villas: CommunityVilla[], nearbyPlots: PlotData[]) {
  const [intelligenceMap, setIntelligenceMap] = useState<Map<string, VillaIntelligence>>(new Map());
  const [isProcessing, setIsProcessing] = useState(false);

  useEffect(() => {
    let isMounted = true;
    let cancelProcessing = false;

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

          // Find the villa's plot if possible
          const villaPlot = nearbyPlots.find(p => p.id === villa.plot_number) || null;
          
          // Get full analysis
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

          newMap.set(villa.id, {
            villaId: villa.id,
            layout,
            amenities,
            tags,
            isProcessing: false
          });
        }

        currentIndex += chunkSize;

        // Emit incremental update after every chunk so filters work as soon as
        // each villa's PI data is ready — don't wait for all chunks to finish.
        if (isMounted) {
          setIntelligenceMap(new Map(newMap));
        }

        if (currentIndex < villas.length) {
          // Schedule next chunk — yield to browser to keep UI responsive
          requestAnimationFrame(processChunk);
        } else if (isMounted) {
          setIsProcessing(false);
        }
      };

      // Start processing first chunk
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
    
    // Process all amenities from intelligence map prioritizing closest
    Array.from(intelligenceMap.values()).forEach(intel => {
      intel.amenities.forEach(amenity => {
        // Use plotId as unique key for the amenity itself, or coordinates
        const key = amenity.plotId || `${amenity.coordinates[0]},${amenity.coordinates[1]}`;
        const existing = amenityMap.get(key);
        
        // Keep the one with shortest distance (if multiple villas see it differently)
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
