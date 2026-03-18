/**
 * Geometry engine for spatial analysis — ported from AR3 Property Intelligence HTML.
 * Handles boundary-sharing detection, back-edge analysis, and distance calculations.
 */

export type Polygon = [number, number][]; // [lng, lat][]
export interface Edge {
  a: [number, number];
  b: [number, number];
  mid: [number, number];
}

const toMeters = ([lng, lat]: [number, number], refLat: number): [number, number] => {
  const metersPerDegLat = 111320;
  const metersPerDegLng = Math.cos((refLat * Math.PI) / 180) * 111320;
  return [lng * metersPerDegLng, lat * metersPerDegLat];
};

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

const pointToSegmentDistanceMeters = (
  point: [number, number],
  start: [number, number],
  end: [number, number],
  refLat: number,
): number => {
  const [px, py] = toMeters(point, refLat);
  const [ax, ay] = toMeters(start, refLat);
  const [bx, by] = toMeters(end, refLat);
  const abx = bx - ax;
  const aby = by - ay;
  const lenSq = abx * abx + aby * aby;

  if (lenSq === 0) return Math.hypot(px - ax, py - ay);

  const t = clamp(((px - ax) * abx + (py - ay) * aby) / lenSq, 0, 1);
  const projX = ax + t * abx;
  const projY = ay + t * aby;
  return Math.hypot(px - projX, py - projY);
};

const orientation = (p: [number, number], q: [number, number], r: [number, number]): number => {
  const value = (q[1] - p[1]) * (r[0] - q[0]) - (q[0] - p[0]) * (r[1] - q[1]);
  if (Math.abs(value) < 1e-10) return 0;
  return value > 0 ? 1 : 2;
};

const onSegment = (p: [number, number], q: [number, number], r: [number, number]): boolean => {
  return (
    q[0] <= Math.max(p[0], r[0]) &&
    q[0] >= Math.min(p[0], r[0]) &&
    q[1] <= Math.max(p[1], r[1]) &&
    q[1] >= Math.min(p[1], r[1])
  );
};

const segmentsIntersect = (
  p1: [number, number],
  q1: [number, number],
  p2: [number, number],
  q2: [number, number],
): boolean => {
  const o1 = orientation(p1, q1, p2);
  const o2 = orientation(p1, q1, q2);
  const o3 = orientation(p2, q2, p1);
  const o4 = orientation(p2, q2, q1);

  if (o1 !== o2 && o3 !== o4) return true;
  if (o1 === 0 && onSegment(p1, p2, q1)) return true;
  if (o2 === 0 && onSegment(p1, q2, q1)) return true;
  if (o3 === 0 && onSegment(p2, p1, q2)) return true;
  if (o4 === 0 && onSegment(p2, q1, q2)) return true;
  return false;
};

const segmentDistanceMeters = (a: Edge, b: Edge): number => {
  const refLat = (a.a[1] + a.b[1] + b.a[1] + b.b[1]) / 4;
  if (segmentsIntersect(a.a, a.b, b.a, b.b)) return 0;
  return Math.min(
    pointToSegmentDistanceMeters(a.a, b.a, b.b, refLat),
    pointToSegmentDistanceMeters(a.b, b.a, b.b, refLat),
    pointToSegmentDistanceMeters(b.a, a.a, a.b, refLat),
    pointToSegmentDistanceMeters(b.b, a.a, a.b, refLat),
  );
};

export const Geo = {
  /** Calculate centroid of a polygon */
  centroid(poly: Polygon): [number, number] {
    let x = 0, y = 0;
    for (const [a, b] of poly) { x += a; y += b; }
    return [x / poly.length, y / poly.length];
  },

  /** Haversine distance in meters between two [lng, lat] points */
  distanceM([aLng, aLat]: [number, number], [bLng, bLat]: [number, number]): number {
    const R = 6371000;
    const dLat = (bLat - aLat) * Math.PI / 180;
    const dLng = (bLng - aLng) * Math.PI / 180;
    const a = Math.sin(dLat / 2) ** 2 +
      Math.cos(aLat * Math.PI / 180) * Math.cos(bLat * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  },

  /** Haversine distance in meters between two (lat, lng) points */
  haversineDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371000;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  },

  /** Get polygon edges with endpoints and midpoint */
  edges(poly: Polygon): Edge[] {
    return poly.map((a, i) => {
      const b = poly[(i + 1) % poly.length];
      return {
        a,
        b,
        mid: [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2] as [number, number],
      };
    });
  },

  /** Bearing from center to point (degrees, 0=N clockwise) */
  bearingFrom([cx, cy]: [number, number], [px, py]: [number, number]): number {
    return ((Math.atan2(px - cx, py - cy) * 180 / Math.PI) + 360) % 360;
  },

  /** Classify edge side relative to entrance bearing: front/back/right/left */
  sideFB(bearing: number, frontBearing: number): 'front' | 'back' | 'right' | 'left' {
    const r = ((bearing - frontBearing) + 360) % 360;
    if (r < 45 || r >= 315) return 'front';
    if (r >= 135 && r < 225) return 'back';
    if (r >= 45 && r < 135) return 'right';
    return 'left';
  },

  pointInPolygon([px, py]: [number, number], polygon: Polygon): boolean {
    let inside = false;
    for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
      const [xi, yi] = polygon[i];
      const [xj, yj] = polygon[j];
      const intersects = ((yi > py) !== (yj > py)) &&
        (px < ((xj - xi) * (py - yi)) / ((yj - yi) || Number.EPSILON) + xi);
      if (intersects) inside = !inside;
    }
    return inside;
  },

  distancePointToPolygonM(point: [number, number], polygon: Polygon): number {
    if (polygon.length === 0) return Infinity;
    if (Geo.pointInPolygon(point, polygon)) return 0;

    const edges = Geo.edges(polygon);
    const refLat = point[1];
    return Math.min(
      ...edges.map((edge) => pointToSegmentDistanceMeters(point, edge.a, edge.b, refLat)),
    );
  },

  /** Check if two sets of edges share a boundary using segment proximity, not just midpoints */
  sharesBoundary(edgesA: Edge[], edgesB: Edge[], toleranceMeters: number = 9): boolean {
    for (const a of edgesA) {
      for (const b of edgesB) {
        if (Geo.distanceM(a.mid, b.mid) < toleranceMeters) return true;
        if (segmentDistanceMeters(a, b) <= toleranceMeters) return true;
      }
    }
    return false;
  },

  /** Convert compass bearing to cardinal direction */
  bearingToCardinal(degrees: number): string {
    const dirs = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
    return dirs[Math.round(degrees / 45) % 8];
  },
};
