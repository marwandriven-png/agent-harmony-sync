import { MockCommunity, makePlotFn, MockPlot } from './types';

export function buildMudon(): MockCommunity {
  const BLng = 55.2650, BLat = 25.0260, U = 0.00040;
  const rect = (lng: number, lat: number, dLng: number, dLat: number): [number, number][] => [[lng, lat], [lng + dLng, lat], [lng + dLng, lat - dLat], [lng, lat - dLat]];
  const mp = makePlotFn(BLng, BLat, U);

  const plots: MockPlot[] = [
    // Perimeter roads
    { id: 'R-TOP', type: 'road', polygon: rect(BLng - U * .5, BLat + U * .8, U * 15, U * .4) },
    { id: 'R-BOT', type: 'road', polygon: rect(BLng - U * .5, BLat - U * 10, U * 15, U * .4) },
    { id: 'R-LEFT', type: 'road', polygon: rect(BLng - U * .5, BLat + U * .5, U * .45, U * 11) },
    { id: 'R-RIGHT', type: 'road', polygon: rect(BLng + U * 12.5, BLat + U * .5, U * .45, U * 11) },
    // Internal roads
    { id: 'R-H1', type: 'road', polygon: rect(BLng, BLat - U * 2.6, U * 12.5, U * .35) },
    { id: 'R-H2', type: 'road', polygon: rect(BLng, BLat - U * 5.2, U * 12.5, U * .35) },
    { id: 'R-H3', type: 'road', polygon: rect(BLng, BLat - U * 7.7, U * 12.5, U * .35) },
    { id: 'R-V1', type: 'road', polygon: rect(BLng + U * 3.0, BLat + U * .3, U * .35, U * 9) },
    { id: 'R-V2', type: 'road', polygon: rect(BLng + U * 6.1, BLat + U * .3, U * .35, U * 9) },
    { id: 'R-V3', type: 'road', polygon: rect(BLng + U * 9.2, BLat + U * .3, U * .35, U * 9) },
    // Parks
    { id: 'PARK-CENTRAL', type: 'park', polygon: rect(BLng + U * 3.4, BLat - U * 3.0, U * 2.3, U * 1.9) },
    { id: 'PARK-N', type: 'park', polygon: rect(BLng + U * 6.5, BLat - U * .2, U * 2.2, U * .8) },
    { id: 'PARK-S', type: 'park', polygon: rect(BLng + U * 3.4, BLat - U * 5.6, U * 2.3, U * 1.9) },
    { id: 'OPEN-END', type: 'open', polygon: rect(BLng + U * 2, BLat - U * 9.5, U * 9, U * 1.5) },
    // Al Rafeef - Block A
    mp('AR-A101', 'residential', 0, -.3, 1, 1, 'N'), mp('AR-A102', 'residential', 1, -.3, 1, 1, 'N'),
    mp('AR-A103', 'residential', 2, -.3, 1, 1, 'N'),
    mp('AR-A201', 'residential', 0, .8, 1, 1, 'S'), mp('AR-A202', 'residential', 1, .8, 1, 1, 'S'),
    mp('AR-A203', 'residential', 2, .8, 1, 1, 'S'),
    // Block B
    mp('AR-B101', 'residential', 0, 1.7, 1, 1, 'S'), mp('AR-B102', 'residential', 1, 1.7, 1, 1, 'S'),
    mp('AR-B103', 'residential', 2, 1.7, 1, 1, 'S'),
    mp('AR-B201', 'residential', 0, 2.7, 1, 1, 'N'), mp('AR-B202', 'residential', 1, 2.7, 1, 1, 'N'),
    mp('AR-B203', 'residential', 2, 2.7, 1, 1, 'N'),
    // Block C
    mp('AR-C101', 'residential', 6.5, -.3, 1, 1, 'N'), mp('AR-C102', 'residential', 7.5, -.3, 1, 1, 'N'),
    mp('AR-C103', 'residential', 8.5, -.3, 1, 1, 'N'), mp('AR-C104', 'residential', 9.5, -.3, 1, 1, 'N'),
    mp('AR-C201', 'residential', 6.5, .8, 1, 1, 'S'), mp('AR-C202', 'residential', 7.5, .8, 1, 1, 'S'),
    mp('AR-C203', 'residential', 8.5, .8, 1, 1, 'S'), mp('AR-C204', 'residential', 9.5, .8, 1, 1, 'S'),
    // Block D
    mp('AR-D101', 'residential', 0, 4.3, 1, 1, 'N'), mp('AR-D102', 'residential', 1, 4.3, 1, 1, 'N'),
    mp('AR-D103', 'residential', 2, 4.3, 1, 1, 'N'),
    mp('AR-D201', 'residential', 0, 5.3, 1, 1, 'S'), mp('AR-D202', 'residential', 1, 5.3, 1, 1, 'S'),
    mp('AR-D203', 'residential', 2, 5.3, 1, 1, 'S'),
    // Block E
    mp('AR-E101', 'residential', 6.5, 4.3, 1, 1, 'N'), mp('AR-E102', 'residential', 7.5, 4.3, 1, 1, 'N'),
    mp('AR-E103', 'residential', 8.5, 4.3, 1, 1, 'N'), mp('AR-E104', 'residential', 9.5, 4.3, 1, 1, 'N'),
    mp('AR-E201', 'residential', 6.5, 5.3, 1, 1, 'S'), mp('AR-E202', 'residential', 7.5, 5.3, 1, 1, 'S'),
    mp('AR-E203', 'residential', 8.5, 5.3, 1, 1, 'S'), mp('AR-E204', 'residential', 9.5, 5.3, 1, 1, 'S'),
    // Block F
    mp('AR-F101', 'residential', 0, 6.8, 1, 1, 'N'), mp('AR-F102', 'residential', 1, 6.8, 1, 1, 'N'),
    mp('AR-F103', 'residential', 2, 6.8, 1, 1, 'N'), mp('AR-F104', 'residential', 3.4, 6.8, 1, 1, 'N'),
    mp('AR-F105', 'residential', 6.5, 6.8, 1, 1, 'N'), mp('AR-F106', 'residential', 7.5, 6.8, 1, 1, 'N'),
    mp('AR-F107', 'residential', 8.5, 6.8, 1, 1, 'N'), mp('AR-F108', 'residential', 9.5, 6.8, 1, 1, 'N'),
    mp('AR-F201', 'residential', 0, 7.9, 1, 1, 'S'), mp('AR-F202', 'residential', 1, 7.9, 1, 1, 'S'),
    mp('AR-F203', 'residential', 2, 7.9, 1, 1, 'S'), mp('AR-F204', 'residential', 3.4, 7.9, 1, 1, 'S'),
    // Amenities
    { id: 'CLUB-MUDON', type: 'community', polygon: rect(BLng + U * 10.2, BLat - U * 2.5, U * 1.5, U * 1) },
    { id: 'MOSQUE-MUD', type: 'mosque', polygon: rect(BLng + U * 10.2, BLat - U * 4.5, U * .8, U * .8) },
  ];

  const amenities = [
    { id: 'am-park-c', type: 'park', name: 'Al Rafeef Park', centroid: [BLng + U * 4.55, BLat - U * 3.95] as [number, number] },
    { id: 'am-park-n', type: 'park', name: 'North Greenway', centroid: [BLng + U * 7.6, BLat - U * .6] as [number, number] },
    { id: 'am-park-s', type: 'park', name: 'South Garden', centroid: [BLng + U * 4.55, BLat - U * 6.55] as [number, number] },
    { id: 'am-pool-1', type: 'pool', name: 'Mudon Pool A', centroid: [BLng + U * 10.5, BLat - U * 1.5] as [number, number] },
    { id: 'am-pool-2', type: 'pool', name: 'Mudon Pool B', centroid: [BLng + U * 4.0, BLat - U * 8.0] as [number, number] },
    { id: 'am-school', type: 'school', name: 'Mudon School', centroid: [BLng + U * 11.0, BLat - U * 6.0] as [number, number] },
    { id: 'am-mosque', type: 'mosque', name: 'Mudon Mosque', centroid: [BLng + U * 10.6, BLat - U * 4.9] as [number, number] },
    { id: 'am-club', type: 'clubhouse', name: 'Mudon Clubhouse', centroid: [BLng + U * 11.0, BLat - U * 3.0] as [number, number] },
    { id: 'am-play1', type: 'playground', name: 'Play Zone A', centroid: [BLng + U * 5.2, BLat - U * 2.5] as [number, number] },
    { id: 'am-play2', type: 'playground', name: 'Play Zone B', centroid: [BLng + U * 5.2, BLat - U * 5.2] as [number, number] },
    { id: 'am-retail', type: 'retail', name: 'Retail Centre', centroid: [BLng + U * 11.5, BLat - U * 1.0] as [number, number] },
  ];

  return {
    id: 'mudon', name: 'Mudon', developer: 'Dubai Properties', areaType: 'Townhouses & Villas',
    launchYear: 2012, centerLng: BLng, centerLat: BLat, unitSize: U,
    boundaryTolerance: 10, plots, amenities
  };
}
