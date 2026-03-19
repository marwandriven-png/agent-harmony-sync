/**
 * Shared geo utilities — single source of truth.
 * Eliminates haversineDistance defined 3 times across codebase.
 */

/**
 * Haversine distance in metres between two (lat, lng) points.
 * Accurate to ±0.1% for distances up to ~1000 km.
 */
export function haversineDistance(
  lat1: number, lng1: number,
  lat2: number, lng2: number,
): number {
  const R = 6_371_000;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/** Format metres as human-readable string: "85m" or "1.2km" */
export function formatDistance(metres: number): string {
  return metres < 1000
    ? `${Math.round(metres)}m`
    : `${(metres / 1000).toFixed(1)}km`;
}

/** Validate that a lat/lng pair is within the UAE bounding box. */
export function isValidUAECoord(lat: number, lng: number): boolean {
  return lat >= 22 && lat <= 27 && lng >= 51 && lng <= 57;
}

/** Offset a lat/lng point by a given distance and bearing. */
export function offsetLatLng(
  lat: number, lng: number,
  distM: number, bearingDeg: number,
): { lat: number; lng: number } {
  const R = 6_371_000;
  const δ = distM / R;
  const θ = (bearingDeg * Math.PI) / 180;
  const φ1 = (lat * Math.PI) / 180;
  const λ1 = (lng * Math.PI) / 180;
  const φ2 = Math.asin(Math.sin(φ1) * Math.cos(δ) + Math.cos(φ1) * Math.sin(δ) * Math.cos(θ));
  const λ2 = λ1 + Math.atan2(
    Math.sin(θ) * Math.sin(δ) * Math.cos(φ1),
    Math.cos(δ) - Math.sin(φ1) * Math.sin(φ2),
  );
  return { lat: (φ2 * 180) / Math.PI, lng: (λ2 * 180) / Math.PI };
}
