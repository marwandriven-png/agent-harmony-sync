import type { MockCommunity } from './types';
import { buildAR3 } from './ar3';
import { buildMeadows } from './meadows';
import { buildMudon } from './mudon';
import { buildDamacHills } from './damac-hills';
import type { PlotData } from '@/services/DDAGISService';

export const MOCK_COMMUNITIES: Record<string, MockCommunity> = {
  ar3: buildAR3(),
  meadows: buildMeadows(),
  mudon: buildMudon(),
  damac_hills: buildDamacHills(),
};

/**
 * Converts a MockCommunity into a PlotData array directly compatible with
 * DDAGISService and VillaGISService for local execution and mapping.
 */
export function convertMockCommunityToPlots(community: MockCommunity): PlotData[] {
  const plots: PlotData[] = [];

  for (const p of community.plots) {
    plots.push({
      id: `${community.id}_${p.id}`,
      area: community.unitSize * 1000000 * 2, // arbitrary area calculation
      gfa: 4000,
      floors: 'G+1',
      zoning: p.type === 'residential' ? 'Residential Villa' : 'Mixed Use',
      location: community.name,
      x: p.polygon[0][0], // Set exact lng dynamically
      y: p.polygon[0][1], // Set exact lat dynamically
      color: '#000000',
      status: 'Available',
      constructionCost: 1000,
      salePrice: 2000,
      isFrozen: false,
      verificationSource: 'Demo',
      landUseDetails: p.type, // e.g., 'residential', 'road', 'park'
      rawAttributes: {
        geometry: { rings: [p.polygon] },
        facingDirection: p.entranceSide // for Vastu tracking layer
      }
    });
  }

  // Inject amenities as plots so GIS service dynamically finds them near residences
  for (const a of community.amenities) {
    plots.push({
      id: `${community.id}_${a.id}`,
      area: 1000,
      gfa: 1000,
      floors: 'G',
      zoning: 'Amenity',
      location: community.name,
      x: a.centroid[0],
      y: a.centroid[1],
      color: '#000000',
      status: 'Available',
      constructionCost: 0,
      salePrice: 0,
      isFrozen: false,
      verificationSource: 'Demo',
      landUseDetails: a.type,
      rawAttributes: {
        geometry: {
          rings: [[[
            a.centroid[0] - 0.0001, a.centroid[1] + 0.0001
          ], [
            a.centroid[0] + 0.0001, a.centroid[1] + 0.0001
          ], [
            a.centroid[0] + 0.0001, a.centroid[1] - 0.0001
          ], [
            a.centroid[0] - 0.0001, a.centroid[1] - 0.0001
          ]]]
        }
      }
    });
  }

  return plots;
}
