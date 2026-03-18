export interface MockPlot {
  id: string;
  type: 'residential' | 'road' | 'park' | 'open' | 'community' | 'mosque' | 'golf' | 'school' | 'clubhouse' | 'pool' | 'playground' | 'retail';
  entranceSide?: string | null;
  polygon: [number, number][]; // [lng, lat][]
}

export interface MockAmenity {
  id: string;
  type: string;
  name: string;
  centroid: [number, number]; // [lng, lat]
}

export interface MockCommunity {
  id: string;
  name: string;
  developer: string;
  areaType: string;
  launchYear: number;
  centerLng: number;
  centerLat: number;
  unitSize: number;
  boundaryTolerance: number;
  plots: MockPlot[];
  amenities: MockAmenity[];
}

export function makePlotFn(BLng: number, BLat: number, U: number) {
  const rect = (lng: number, lat: number, dLng: number, dLat: number): [number, number][] => [
    [lng, lat],
    [lng + dLng, lat],
    [lng + dLng, lat - dLat],
    [lng, lat - dLat]
  ];
  return (id: string, type: string, col: number, row: number, w = 1, h = 1, entrance: string | null = null): MockPlot => ({
    id,
    type: type as any,
    entranceSide: entrance,
    polygon: rect(BLng + col * U, BLat - row * U, w * U, h * U)
  });
}
