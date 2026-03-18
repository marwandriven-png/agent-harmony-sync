import { MockCommunity, makePlotFn, MockPlot } from './types';

export function buildMeadows(): MockCommunity {
  const BLng = 55.1555, BLat = 25.0695, U = 0.00044;
  const rect = (lng: number, lat: number, dLng: number, dLat: number): [number, number][] => [[lng, lat], [lng + dLng, lat], [lng + dLng, lat - dLat], [lng, lat - dLat]];
  const mp = makePlotFn(BLng, BLat, U);

  const plots: MockPlot[] = [
    // Perimeter + internal roads
    { id: 'R-TOP', type: 'road', polygon: rect(BLng - U * .5, BLat + U * .8, U * 14, U * .4) },
    { id: 'R-BOT', type: 'road', polygon: rect(BLng - U * .5, BLat - U * 9.5, U * 14, U * .4) },
    { id: 'R-LEFT', type: 'road', polygon: rect(BLng - U * .5, BLat + U * .5, U * .45, U * 10.5) },
    { id: 'R-RIGHT', type: 'road', polygon: rect(BLng + U * 12, BLat + U * .5, U * .45, U * 10.5) },
    { id: 'R-H1', type: 'road', polygon: rect(BLng, BLat - U * 2.5, U * 12, U * .35) },
    { id: 'R-H2', type: 'road', polygon: rect(BLng, BLat - U * 5.0, U * 12, U * .35) },
    { id: 'R-H3', type: 'road', polygon: rect(BLng, BLat - U * 7.5, U * 12, U * .35) },
    { id: 'R-V1', type: 'road', polygon: rect(BLng + U * 5.8, BLat + U * .3, U * .35, U * 8.5) },
    { id: 'R-V2', type: 'road', polygon: rect(BLng + U * 10, BLat + U * .3, U * .35, U * 5) },
    // Parks
    { id: 'PARK-MAIN', type: 'park', polygon: rect(BLng + U * 2.5, BLat - U * 1.0, U * 3, U * 1.5) },
    { id: 'PARK-MID', type: 'park', polygon: rect(BLng + U * 2.5, BLat - U * 3.6, U * 3, U * 1.5) },
    { id: 'PARK-SOUTH', type: 'park', polygon: rect(BLng + U * 2.5, BLat - U * 6.2, U * 3, U * 1.5) },
    { id: 'LAKE-EAST', type: 'park', polygon: rect(BLng + U * 9, BLat - U * 1, U * 2, U * 4) },
    { id: 'OPEN-SOUTH', type: 'open', polygon: rect(BLng + U * 1, BLat - U * 9, U * 10, U * 1.2) },
    // Block A
    mp('A101', 'residential', 0, -.3, 1, 1.1, 'N'), mp('A102', 'residential', 1.1, -.3, 1, 1.1, 'N'),
    mp('A103', 'residential', 2.2, -.3, 1, 1.1, 'N'),
    mp('A201', 'residential', 0, .9, 1, 1.1, 'S'), mp('A202', 'residential', 1.1, .9, 1, 1.1, 'S'),
    mp('A203', 'residential', 2.2, .9, 1, 1.1, 'S'),
    // Block B
    mp('B101', 'residential', 0, 1.8, 1, 1, 'S'), mp('B102', 'residential', 1.1, 1.8, 1, 1, 'S'),
    mp('B103', 'residential', 2.2, 1.8, 1, 1, 'S'),
    mp('B201', 'residential', 0, 2.85, 1, 1, 'N'), mp('B202', 'residential', 1.1, 2.85, 1, 1, 'N'),
    mp('B203', 'residential', 2.2, 2.85, 1, 1, 'N'),
    // Block C
    mp('C101', 'residential', 6.2, -.3, 1.2, 1.1, 'N'), mp('C102', 'residential', 7.5, -.3, 1.2, 1.1, 'N'),
    mp('C103', 'residential', 8.8, -.3, 1.2, 1.1, 'N'),
    mp('C201', 'residential', 6.2, .9, 1.2, 1.1, 'S'), mp('C202', 'residential', 7.5, .9, 1.2, 1.1, 'S'),
    mp('C203', 'residential', 8.8, .9, 1.2, 1.1, 'S'),
    // Block D
    mp('D101', 'residential', 0, 4.15, 1, 1, 'N'), mp('D102', 'residential', 1.1, 4.15, 1, 1, 'N'),
    mp('D103', 'residential', 2.2, 4.15, 1, 1, 'N'),
    mp('D201', 'residential', 0, 5.1, 1, 1, 'S'), mp('D202', 'residential', 1.1, 5.1, 1, 1, 'S'),
    mp('D203', 'residential', 2.2, 5.1, 1, 1, 'S'),
    // Block E
    mp('E101', 'residential', 6.2, 4.15, 1.2, 1, 'N'), mp('E102', 'residential', 7.5, 4.15, 1.2, 1, 'N'),
    mp('E103', 'residential', 8.8, 4.15, 1.2, 1, 'N'),
    mp('E201', 'residential', 6.2, 5.1, 1.2, 1, 'S'), mp('E202', 'residential', 7.5, 5.1, 1.2, 1, 'S'),
    mp('E203', 'residential', 8.8, 5.1, 1.2, 1, 'S'),
    // Block F
    mp('F101', 'residential', 0, 6.6, 1, 1, 'N'), mp('F102', 'residential', 1.1, 6.6, 1, 1, 'N'),
    mp('F103', 'residential', 2.2, 6.6, 1, 1, 'N'), mp('F104', 'residential', 3.3, 6.6, 1, 1, 'N'),
    mp('F201', 'residential', 0, 7.7, 1, 1, 'S'), mp('F202', 'residential', 1.1, 7.7, 1, 1, 'S'),
    mp('F203', 'residential', 2.2, 7.7, 1, 1, 'S'), mp('F204', 'residential', 3.3, 7.7, 1, 1, 'S'),
    // Amenities
    { id: 'CLUB-MAIN', type: 'community', polygon: rect(BLng + U * 10.5, BLat - U * 3.0, U * 1.2, U * 1) },
    { id: 'MOSQUE', type: 'mosque', polygon: rect(BLng + U * 10.5, BLat - U * 5.0, U * .8, U * .8) },
  ];

  const amenities = [
    { id: 'am-park-main', type: 'park', name: 'Meadows Park A', centroid: [BLng + U * 4.0, BLat - U * 1.75] as [number, number] },
    { id: 'am-park-mid', type: 'park', name: 'Meadows Park B', centroid: [BLng + U * 4.0, BLat - U * 4.35] as [number, number] },
    { id: 'am-park-south', type: 'park', name: 'Meadows Park C', centroid: [BLng + U * 4.0, BLat - U * 6.95] as [number, number] },
    { id: 'am-lake', type: 'park', name: 'Meadows Lake', centroid: [BLng + U * 10.0, BLat - U * 3.0] as [number, number] },
    { id: 'am-pool-main', type: 'pool', name: 'Village Pool', centroid: [BLng + U * 10.5, BLat - U * 2.0] as [number, number] },
    { id: 'am-school', type: 'school', name: 'Meadows School', centroid: [BLng + U * 11.0, BLat - U * 6.5] as [number, number] },
    { id: 'am-mosque', type: 'mosque', name: 'Meadows Mosque', centroid: [BLng + U * 10.9, BLat - U * 5.4] as [number, number] },
    { id: 'am-club', type: 'clubhouse', name: 'Meadows Club', centroid: [BLng + U * 11.1, BLat - U * 3.5] as [number, number] },
    { id: 'am-play1', type: 'playground', name: 'Kids Play Area', centroid: [BLng + U * 5.0, BLat - U * 3.5] as [number, number] },
  ];

  return {
    id: 'meadows', name: 'The Meadows', developer: 'Emaar', areaType: 'Standalone Villas',
    launchYear: 2003, centerLng: BLng, centerLat: BLat, unitSize: U,
    boundaryTolerance: 10, plots, amenities
  };
}
