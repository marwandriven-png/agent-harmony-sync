import { MockCommunity, makePlotFn, MockPlot } from './types';

export function buildAR3(): MockCommunity {
  const BLng = 55.2480, BLat = 25.0640, U = 0.00042;
  const rect = (lng: number, lat: number, dLng: number, dLat: number): [number, number][] => [
    [lng, lat], [lng + dLng, lat], [lng + dLng, lat - dLat], [lng, lat - dLat]
  ];
  const mp = makePlotFn(BLng, BLat, U);

  const plots: MockPlot[] = [
    // Roads
    { id: 'R-TOP', type: 'road', polygon: rect(BLng - U, BLat + U * .8, U * 16, U * .4) },
    { id: 'R-BOT', type: 'road', polygon: rect(BLng - U, BLat - U * 9, U * 16, U * .4) },
    { id: 'R-LEFT', type: 'road', polygon: rect(BLng - U * .4, BLat + U * .5, U * .4, U * 11) },
    { id: 'R-RIGHT', type: 'road', polygon: rect(BLng + U * 11, BLat + U * .5, U * .4, U * 11) },
    { id: 'R-H1', type: 'road', polygon: rect(BLng, BLat - U * 2.8, U * 11, U * .35) },
    { id: 'R-H2', type: 'road', polygon: rect(BLng, BLat - U * 5.5, U * 11, U * .35) },
    { id: 'R-H3', type: 'road', polygon: rect(BLng + U * 3, BLat - U * 7.8, U * 8, U * .35) },
    { id: 'R-V1', type: 'road', polygon: rect(BLng + U * 3.8, BLat + U * .3, U * .35, U * 10) },
    { id: 'R-V2', type: 'road', polygon: rect(BLng + U * 7.3, BLat + U * .3, U * .35, U * 8) },
    // Parks
    { id: 'PARK-CENTRAL', type: 'park', polygon: rect(BLng + U * 4.2, BLat - U * 2.9, U * 2.8, U * 2.5) },
    { id: 'PARK-NORTH', type: 'park', polygon: rect(BLng + U * 1.5, BLat + U * .1, U * 2, U * .7) },
    { id: 'PARK-EAST', type: 'park', polygon: rect(BLng + U * 9, BLat - U * 3, U * 1.5, U * 2) },
    { id: 'PARK-POCKET', type: 'park', polygon: rect(BLng + U * 5.5, BLat - U * 6, U * 1.5, U * 1.2) },
    { id: 'OPEN-SOUTH', type: 'open', polygon: rect(BLng + U * 2, BLat - U * 9, U * 7, U * 1.2) },
    // Block A - NW
    mp('A101', 'residential', 0, -.4, 1, 1, 'N'), mp('A102', 'residential', 1, -.4, 1, 1, 'N'),
    mp('A103', 'residential', 2, -.4, 1, 1, 'N'), mp('A104', 'residential', 3, -.4, 1, 1, 'N'),
    mp('A201', 'residential', 0, .65, 1, 1, 'S'), mp('A202', 'residential', 1, .65, 1, 1, 'S'),
    mp('A203', 'residential', 2, .65, 1, 1, 'S'), mp('A204', 'residential', 3, .65, 1, 1, 'S'),
    // Block B - Mid-West B2B
    mp('B101', 'residential', 0, 1.8, 1, 1, 'S'), mp('B102', 'residential', 1, 1.8, 1, 1, 'S'),
    mp('B103', 'residential', 2, 1.8, 1, 1, 'S'), mp('B104', 'residential', 3.45, 1.8, 1, 1, 'S'),
    mp('B201', 'residential', 0, 2.85, 1, 1, 'N'), mp('B202', 'residential', 1, 2.85, 1, 1, 'N'),
    mp('B203', 'residential', 2, 2.85, 1, 1, 'N'), mp('B204', 'residential', 3.45, 2.85, 1, 1, 'N'),
    // Block C - East cluster
    mp('C101', 'residential', 4.25, .2, 1, 1, 'E'), mp('C102', 'residential', 4.25, 1.2, 1, 1, 'E'),
    mp('C103', 'residential', 4.25, 2.2, 1, 1, 'E'),
    mp('C201', 'residential', 9.8, .2, 1, 1, 'W'), mp('C202', 'residential', 9.8, 1.2, 1, 1, 'W'),
    mp('C203', 'residential', 9.8, 2.2, 1, 1, 'W'), mp('C204', 'residential', 9.8, 3.2, 1, 1, 'W'),
    // Block D
    mp('D101', 'residential', 7.4, .2, 1, 1, 'N'), mp('D102', 'residential', 8.4, .2, 1, 1, 'N'),
    mp('D103', 'residential', 9.4, .2, 1, 1, 'N'),
    mp('D201', 'residential', 7.4, 1.2, 1, 1, 'E'), mp('D202', 'residential', 7.4, 2.2, 1, 1, 'E'),
    mp('D203', 'residential', 7.4, 3.2, 1, 1, 'E'),
    // Block E - South
    mp('E101', 'residential', 0, 4.2, 1, 1, 'N'), mp('E102', 'residential', 1, 4.2, 1, 1, 'N'),
    mp('E103', 'residential', 2, 4.2, 1, 1, 'N'), mp('E104', 'residential', 3.45, 4.2, 1, 1, 'N'),
    mp('E201', 'residential', 0, 5.3, 1, 1, 'S'), mp('E202', 'residential', 1, 5.3, 1, 1, 'S'),
    mp('E203', 'residential', 2, 5.3, 1, 1, 'S'), mp('E204', 'residential', 3.45, 5.3, 1, 1, 'S'),
    // Block F - SE
    mp('F101', 'residential', 4.25, 4.2, 1, 1, 'N'), mp('F102', 'residential', 5.25, 4.2, 1, 1, 'N'),
    mp('F103', 'residential', 6.25, 4.2, 1, 1, 'N'), mp('F104', 'residential', 7.35, 4.2, 1, 1, 'N'),
    mp('F201', 'residential', 4.25, 5.3, 1, 1, 'S'), mp('F202', 'residential', 5.25, 5.3, 1, 1, 'S'),
    mp('F203', 'residential', 6.25, 5.3, 1, 1, 'S'), mp('F204', 'residential', 7.35, 5.3, 1, 1, 'S'),
    // Block G - Deep south
    mp('G101', 'residential', 1, 7.2, 1, 1, 'N'), mp('G102', 'residential', 2, 7.2, 1, 1, 'N'),
    mp('G103', 'residential', 3, 7.2, 1, 1, 'N'), mp('G104', 'residential', 4, 7.2, 1, 1, 'N'),
    mp('G105', 'residential', 5, 7.2, 1, 1, 'N'), mp('G106', 'residential', 6, 7.2, 1, 1, 'N'),
    mp('G107', 'residential', 7, 7.2, 1, 1, 'N'), mp('G108', 'residential', 8, 7.2, 1, 1, 'N'),
    mp('G201', 'residential', 1, 8.3, 1, 1, 'S'), mp('G202', 'residential', 2, 8.3, 1, 1, 'S'),
    mp('G203', 'residential', 3, 8.3, 1, 1, 'S'), mp('G204', 'residential', 4, 8.3, 1, 1, 'S'),
    mp('G205', 'residential', 5, 8.3, 1, 1, 'S'),
    // Amenity buildings
    { id: 'CLUB', type: 'community', polygon: rect(BLng + U * 1.5, BLat - U * 6.5, U * 1.5, U * 1) },
    { id: 'MOSQUE1', type: 'mosque', polygon: rect(BLng + U * 8.5, BLat - U * 5.5, U * .8, U * .8) },
  ];

  const amenities = [
    { id: 'am-park-central', type: 'park', name: 'Central Park', centroid: [BLng + U * 5.6, BLat - U * 4.0] as [number, number] },
    { id: 'am-park-north', type: 'park', name: 'North Garden', centroid: [BLng + U * 2.5, BLat - U * .3] as [number, number] },
    { id: 'am-park-east', type: 'park', name: 'East Greenway', centroid: [BLng + U * 9.8, BLat - U * 4.0] as [number, number] },
    { id: 'am-pool-main', type: 'pool', name: 'Main Pool', centroid: [BLng + U * 5.0, BLat - U * 3.5] as [number, number] },
    { id: 'am-pool-west', type: 'pool', name: 'West Pool', centroid: [BLng + U * 1.8, BLat - U * 7.0] as [number, number] },
    { id: 'am-school', type: 'school', name: 'Ranches Primary', centroid: [BLng + U * 10, BLat - U * 2.0] as [number, number] },
    { id: 'am-mosque', type: 'mosque', name: 'AR3 Mosque', centroid: [BLng + U * 8.8, BLat - U * 5.8] as [number, number] },
    { id: 'am-club', type: 'clubhouse', name: 'Club House', centroid: [BLng + U * 2.2, BLat - U * 7.0] as [number, number] },
    { id: 'am-play1', type: 'playground', name: 'Kids Zone A', centroid: [BLng + U * 6.0, BLat - U * 5.8] as [number, number] },
    { id: 'am-play2', type: 'playground', name: 'Kids Zone B', centroid: [BLng + U * 3.0, BLat - U * 4.5] as [number, number] },
  ];

  return {
    id: 'ar3', name: 'Arabian Ranches III', developer: 'Emaar', areaType: 'Townhouses & Villas',
    launchYear: 2019, centerLng: BLng, centerLat: BLat, unitSize: U,
    boundaryTolerance: 10, plots, amenities
  };
}
