import { MockCommunity, makePlotFn, MockPlot } from './types';

export function buildDamacHills(): MockCommunity {
  const BLng = 55.2310, BLat = 25.0370, U = 0.00048; // Larger unit = bigger luxury plots
  const rect = (lng: number, lat: number, dLng: number, dLat: number): [number, number][] => [[lng, lat], [lng + dLng, lat], [lng + dLng, lat - dLat], [lng, lat - dLat]];
  const mp = makePlotFn(BLng, BLat, U);

  const plots: MockPlot[] = [
    // Roads
    { id: 'R-TOP', type: 'road', polygon: rect(BLng - U * .5, BLat + U * .8, U * 13, U * .4) },
    { id: 'R-BOT', type: 'road', polygon: rect(BLng - U * .5, BLat - U * 9, U * 13, U * .4) },
    { id: 'R-LEFT', type: 'road', polygon: rect(BLng - U * .5, BLat + U * .5, U * .45, U * 10) },
    { id: 'R-RIGHT', type: 'road', polygon: rect(BLng + U * 11, BLat + U * .5, U * .45, U * 10) },
    { id: 'R-MAIN', type: 'road', polygon: rect(BLng + U * 2, BLat - U * 1.5, U * 9, U * .4) },
    { id: 'R-H2', type: 'road', polygon: rect(BLng, BLat - U * 4.5, U * 11, U * .4) },
    { id: 'R-H3', type: 'road', polygon: rect(BLng + U * 1, BLat - U * 7, U * 10, U * .4) },
    { id: 'R-V1', type: 'road', polygon: rect(BLng + U * 4.5, BLat + U * .3, U * .4, U * 9) },
    { id: 'R-V2', type: 'road', polygon: rect(BLng + U * 8.0, BLat + U * .3, U * .4, U * 6) },
    // Golf course
    { id: 'GOLF-COURSE', type: 'golf', polygon: rect(BLng + U * .5, BLat - U * 8.0, U * 10.5, U * 1.8) },
    { id: 'GOLF-FAIRWAY', type: 'golf', polygon: rect(BLng + U * 3.0, BLat - U * 6.5, U * 5, U * 1.3) },
    // Parks & amenity zones
    { id: 'PARK-CLUB', type: 'park', polygon: rect(BLng + U * 4.9, BLat - U * 2.0, U * 2.8, U * 2.2) },
    { id: 'PARK-EAST', type: 'park', polygon: rect(BLng + U * 8.5, BLat - U * 2.0, U * 2, U * 2) },
    { id: 'PARK-POCKET', type: 'park', polygon: rect(BLng + U * 1.0, BLat - U * 2.5, U * 1.5, U * .8) },
    // Block A - Premium north-facing (single row, golf views)
    mp('DH-A101', 'residential', 0, -.3, 1.4, 1.2, 'N'), mp('DH-A102', 'residential', 1.5, -.3, 1.4, 1.2, 'N'),
    mp('DH-A103', 'residential', 3.0, -.3, 1.4, 1.2, 'N'), mp('DH-A104', 'residential', 6.5, -.3, 1.4, 1.2, 'N'),
    mp('DH-A105', 'residential', 8.0, -.3, 1.4, 1.2, 'N'), mp('DH-A106', 'residential', 9.5, -.3, 1.4, 1.2, 'N'),
    // Block B - Mid (B2B)
    mp('DH-B101', 'residential', 0, 2.0, 1.4, 1.2, 'N'), mp('DH-B102', 'residential', 1.5, 2.0, 1.4, 1.2, 'N'),
    mp('DH-B103', 'residential', 3.0, 2.0, 1.4, 1.2, 'N'), mp('DH-B104', 'residential', 8.0, 4.4, 1.4, 1.2, 'N'),
    mp('DH-B201', 'residential', 0, 3.2, 1.4, 1.2, 'S'), mp('DH-B202', 'residential', 1.5, 3.2, 1.4, 1.2, 'S'),
    mp('DH-B203', 'residential', 3.0, 3.2, 1.4, 1.2, 'S'), mp('DH-B204', 'residential', 8.0, 5.6, 1.4, 1.2, 'S'),
    // Block C - Deep South near Golf
    mp('DH-C101', 'residential', 0, 5.0, 1.4, 1.2, 'N'), mp('DH-C102', 'residential', 1.5, 5.0, 1.4, 1.2, 'N'),
    mp('DH-C103', 'residential', 3.0, 5.0, 1.4, 1.2, 'N'), mp('DH-C104', 'residential', 4.5, 5.0, 1.4, 1.2, 'N'),
    mp('DH-C105', 'residential', 6.0, 5.0, 1.4, 1.2, 'N'),
    mp('DH-C201', 'residential', 0, 6.2, 1.4, 1.2, 'S'), mp('DH-C202', 'residential', 1.5, 6.2, 1.4, 1.2, 'S'),
    mp('DH-C203', 'residential', 3.0, 6.2, 1.4, 1.2, 'S'), mp('DH-C204', 'residential', 4.5, 6.2, 1.4, 1.2, 'S'),
    mp('DH-C205', 'residential', 6.0, 6.2, 1.4, 1.2, 'S'),
  ];

  const amenities = [
    { id: 'am-golf', type: 'playground', name: 'Trump Intl Golf Club', centroid: [BLng + U * 5.0, BLat - U * 7.5] as [number, number] },
    { id: 'am-park-club', type: 'park', name: 'Malibu Bay Park', centroid: [BLng + U * 6.3, BLat - U * 3.1] as [number, number] },
    { id: 'am-pool-main', type: 'pool', name: 'Wave Pool', centroid: [BLng + U * 5.6, BLat - U * 2.5] as [number, number] },
    { id: 'am-school', type: 'school', name: 'Jebel Ali School', centroid: [BLng + U * 9.5, BLat - U * 2.8] as [number, number] },
    { id: 'am-mosque', type: 'mosque', name: 'DAMAC Mosque', centroid: [BLng + U * 8.8, BLat - U * 2.8] as [number, number] },
    { id: 'am-retail', type: 'retail', name: 'Trump Clubhouse', centroid: [BLng + U * 5.0, BLat - U * 8.5] as [number, number] },
  ];

  return {
    id: 'damac_hills', name: 'DAMAC Hills', developer: 'DAMAC', areaType: 'Luxury Villas',
    launchYear: 2013, centerLng: BLng, centerLat: BLat, unitSize: U,
    boundaryTolerance: 12, plots, amenities
  };
}
