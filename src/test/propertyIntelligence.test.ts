/**
 * Property Intelligence Engine — Full Test Suite
 * Coverage: geometry, vastu, distance, NL parser, boundary detection
 */
import { describe, it, expect } from 'vitest';
import { Geo, type Polygon } from '@/services/property-intelligence/geometry';
import {
  classifyDistance,
  classifyVastu,
  proximityLabel,
  proximityColor,
} from '@/services/property-intelligence/classifiers';
import { parseNaturalLanguageQuery } from '@/services/property-intelligence/nl-parser';
import { DEFAULT_THRESHOLDS } from '@/services/property-intelligence/types';

// ═══════════════════════════════════════════════════════════════════════
// GEOMETRY
// ═══════════════════════════════════════════════════════════════════════

describe('Geo.distanceM', () => {
  it('returns 0 for identical points', () => {
    expect(Geo.distanceM([55.248, 25.064], [55.248, 25.064])).toBe(0);
  });

  it('computes correct distance between two Dubai points (±10%)', () => {
    // ~470m apart (Burj Khalifa area)
    const a: [number, number] = [55.2744, 25.1972];
    const b: [number, number] = [55.2796, 25.1977];
    const dist = Geo.distanceM(a, b);
    expect(dist).toBeGreaterThan(400);
    expect(dist).toBeLessThan(600);
  });

  it('is symmetric: A→B equals B→A', () => {
    const a: [number, number] = [55.248, 25.064];
    const b: [number, number] = [55.270, 25.058];
    expect(Math.abs(Geo.distanceM(a, b) - Geo.distanceM(b, a))).toBeLessThan(0.01);
  });
});

describe('Geo.centroid', () => {
  it('returns center of a square', () => {
    const sq: Polygon = [[0,0],[1,0],[1,1],[0,1]];
    const [cx, cy] = Geo.centroid(sq);
    expect(cx).toBeCloseTo(0.5);
    expect(cy).toBeCloseTo(0.5);
  });

  it('handles triangle', () => {
    const tri: Polygon = [[0,0],[3,0],[0,3]];
    const [cx, cy] = Geo.centroid(tri);
    expect(cx).toBeCloseTo(1);
    expect(cy).toBeCloseTo(1);
  });
});

describe('Geo.edges', () => {
  it('returns same count as polygon vertices', () => {
    const sq: Polygon = [[0,0],[1,0],[1,1],[0,1]];
    expect(Geo.edges(sq)).toHaveLength(4);
  });

  it('each edge has a, b, and mid', () => {
    const sq: Polygon = [[0,0],[1,0],[1,1],[0,1]];
    const edges = Geo.edges(sq);
    for (const e of edges) {
      expect(e.a).toHaveLength(2);
      expect(e.b).toHaveLength(2);
      expect(e.mid).toHaveLength(2);
    }
  });

  it('mid is average of a and b', () => {
    const sq: Polygon = [[0,0],[2,0],[2,2],[0,2]];
    const edges = Geo.edges(sq);
    for (const e of edges) {
      expect(e.mid[0]).toBeCloseTo((e.a[0] + e.b[0]) / 2);
      expect(e.mid[1]).toBeCloseTo((e.a[1] + e.b[1]) / 2);
    }
  });
});

describe('Geo.sharesBoundary', () => {
  it('detects adjacent polygons (large tolerance for degree-scale coords)', () => {
    // Two unit squares sharing right/left edge at x=1
    const polyA: Polygon = [[0,0],[1,0],[1,1],[0,1]];
    const polyB: Polygon = [[1,0],[2,0],[2,1],[1,1]];
    const edgesA = Geo.edges(polyA);
    const edgesB = Geo.edges(polyB);
    // 1 degree ≈ 111km; use large tolerance for unit-scale test
    expect(Geo.sharesBoundary(edgesA, edgesB, 111_000)).toBe(true);
  });

  it('non-adjacent polygons do not share boundary with small tolerance', () => {
    const polyA: Polygon = [[0,0],[0.001,0],[0.001,0.001],[0,0.001]];
    const polyC: Polygon = [[0.1,0.1],[0.2,0.1],[0.2,0.2],[0.1,0.2]];
    const edgesA = Geo.edges(polyA);
    const edgesC = Geo.edges(polyC);
    expect(Geo.sharesBoundary(edgesA, edgesC, 5)).toBe(false);
  });
});

// ═══════════════════════════════════════════════════════════════════════
// DISTANCE CLASSIFICATION
// ═══════════════════════════════════════════════════════════════════════

describe('classifyDistance', () => {
  const { veryClose, near, walkable } = DEFAULT_THRESHOLDS;

  it('0m → very_close', () => expect(classifyDistance(0)).toBe('very_close'));
  it('at veryClose threshold → very_close', () => expect(classifyDistance(veryClose)).toBe('very_close'));
  it('veryClose+1 → near', () => expect(classifyDistance(veryClose + 1)).toBe('near'));
  it('at near threshold → near', () => expect(classifyDistance(near)).toBe('near'));
  it('near+1 → walkable', () => expect(classifyDistance(near + 1)).toBe('walkable'));
  it('at walkable threshold → walkable', () => expect(classifyDistance(walkable)).toBe('walkable'));
  it('walkable+1 → not_nearby', () => expect(classifyDistance(walkable + 1)).toBe('not_nearby'));
  it('1000m → not_nearby', () => expect(classifyDistance(1000)).toBe('not_nearby'));
  it('custom thresholds respected', () => {
    expect(classifyDistance(10, { veryClose: 5, near: 20, walkable: 50 })).toBe('near');
  });
});

describe('proximityLabel', () => {
  it('maps all four classes to human-readable strings', () => {
    expect(proximityLabel('very_close')).toBe('Very Close');
    expect(proximityLabel('near')).toBe('Near');
    expect(proximityLabel('walkable')).toBe('Walkable');
    expect(proximityLabel('not_nearby')).toBe('Not Nearby');
  });
});

describe('proximityColor', () => {
  it('returns a Tailwind CSS class for each proximity level', () => {
    expect(typeof proximityColor('very_close')).toBe('string');
    expect(proximityColor('very_close')).toContain('emerald');
    expect(proximityColor('near')).toContain('cyan');
    expect(proximityColor('walkable')).toContain('amber');
    expect(proximityColor('not_nearby')).toContain('gray');
  });
});

// ═══════════════════════════════════════════════════════════════════════
// VASTU CLASSIFICATION
// ═══════════════════════════════════════════════════════════════════════

describe('classifyVastu — cardinal directions', () => {
  it('E → excellent, score 4, compliant', () => {
    const v = classifyVastu('E');
    expect(v.rating).toBe('excellent');
    expect(v.score).toBe(4);
    expect(v.compliant).toBe(true);
  });

  it('East (full word) → excellent', () => {
    expect(classifyVastu('East').rating).toBe('excellent');
  });

  it('N → good, score 3, compliant', () => {
    const v = classifyVastu('N');
    expect(v.rating).toBe('good');
    expect(v.score).toBe(3);
    expect(v.compliant).toBe(true);
  });

  it('NE → good, compliant', () => {
    const v = classifyVastu('NE');
    expect(v.rating).toBe('good');
    expect(v.compliant).toBe(true);
  });

  it('NW → neutral, NOT compliant (bug was: good)', () => {
    const v = classifyVastu('NW');
    expect(v.rating).toBe('neutral');
    expect(v.compliant).toBe(false);
  });

  it('W → neutral, not compliant', () => {
    expect(classifyVastu('W').rating).toBe('neutral');
    expect(classifyVastu('W').compliant).toBe(false);
  });

  it('SE → neutral', () => {
    expect(classifyVastu('SE').rating).toBe('neutral');
  });

  it('S → less_preferred, score 1', () => {
    const v = classifyVastu('S');
    expect(v.rating).toBe('less_preferred');
    expect(v.score).toBe(1);
    expect(v.compliant).toBe(false);
  });

  it('SW → less_preferred', () => {
    expect(classifyVastu('SW').rating).toBe('less_preferred');
  });
});

describe('classifyVastu — edge cases', () => {
  it('null → returns fallback result (no throw)', () => {
    expect(() => classifyVastu(null)).not.toThrow();
    expect(classifyVastu(null)).toBeDefined();
  });

  it('undefined → returns fallback result', () => {
    expect(() => classifyVastu(undefined)).not.toThrow();
  });

  it('empty string → returns fallback result', () => {
    expect(classifyVastu('')).toBeDefined();
  });

  it('unknown string → returns a result with defined fields', () => {
    const v = classifyVastu('UNKNOWN');
    expect(v.rating).toBeDefined();
    expect(typeof v.score).toBe('number');
    expect(typeof v.compliant).toBe('boolean');
  });

  it('lowercase east → recognized', () => {
    expect(classifyVastu('east').rating).toBe('excellent');
  });
});

// ═══════════════════════════════════════════════════════════════════════
// NATURAL LANGUAGE PARSER
// ═══════════════════════════════════════════════════════════════════════

describe('parseNaturalLanguageQuery — layout', () => {
  it('"single row" → layoutType: single_row', () => {
    expect(parseNaturalLanguageQuery('single row villa').layoutType).toBe('single_row');
  });

  it('"back to back" → layoutType: back_to_back', () => {
    expect(parseNaturalLanguageQuery('back to back').layoutType).toBe('back_to_back');
  });

  it('"back-to-back" (hyphen) → back_to_back', () => {
    expect(parseNaturalLanguageQuery('back-to-back').layoutType).toBe('back_to_back');
  });

  it('"b2b" → back_to_back', () => {
    expect(parseNaturalLanguageQuery('b2b villa').layoutType).toBe('back_to_back');
  });
});

describe('parseNaturalLanguageQuery — position', () => {
  it('"corner" → position: corner', () => {
    expect(parseNaturalLanguageQuery('corner villa near park').position).toBe('corner');
  });

  it('"end unit" → position: end', () => {
    expect(parseNaturalLanguageQuery('end unit single row').position).toBe('end');
  });
});

describe('parseNaturalLanguageQuery — back facing', () => {
  it('"backs park" → backFacing: park', () => {
    expect(parseNaturalLanguageQuery('backs park').backFacing).toBe('park');
  });

  it('"park back" → backFacing: park', () => {
    expect(parseNaturalLanguageQuery('park back villa').backFacing).toBe('park');
  });

  it('"back road" → backFacing: road', () => {
    expect(parseNaturalLanguageQuery('back road villa').backFacing).toBe('road');
  });

  it('"open view" → backFacing: open_space', () => {
    expect(parseNaturalLanguageQuery('open view villa').backFacing).toBe('open_space');
  });
});

describe('parseNaturalLanguageQuery — amenities', () => {
  it('"near pool" → nearAmenity includes pool', () => {
    expect(parseNaturalLanguageQuery('villa near pool').nearAmenity).toContain('pool');
  });

  it('"near swimming" → nearAmenity includes pool', () => {
    expect(parseNaturalLanguageQuery('near swimming pool').nearAmenity).toContain('pool');
  });

  it('"near garden" → nearAmenity includes park', () => {
    expect(parseNaturalLanguageQuery('near garden').nearAmenity).toContain('park');
  });

  it('"near masjid" → nearAmenity includes mosque', () => {
    expect(parseNaturalLanguageQuery('near masjid').nearAmenity).toContain('mosque');
  });

  it('"near nursery" → nearAmenity includes school', () => {
    expect(parseNaturalLanguageQuery('near nursery').nearAmenity).toContain('school');
  });

  it('"near clubhouse" → nearAmenity includes community_center', () => {
    expect(parseNaturalLanguageQuery('near clubhouse').nearAmenity).toContain('community_center');
  });
});

describe('parseNaturalLanguageQuery — vastu & distance', () => {
  it('"vastu" → vastuCompliant: true', () => {
    expect(parseNaturalLanguageQuery('vastu compliant').vastuCompliant).toBe(true);
  });

  it('"east facing" → vastuCompliant: true', () => {
    expect(parseNaturalLanguageQuery('east facing villa').vastuCompliant).toBe(true);
  });

  it('within 200m → maxDistance: 200', () => {
    expect(parseNaturalLanguageQuery('corner villa within 200m').maxDistance).toBe(200);
  });
});

describe('parseNaturalLanguageQuery — combined & edge cases', () => {
  it('combined: corner + single row + vastu', () => {
    const r = parseNaturalLanguageQuery('corner single row vastu compliant');
    expect(r.position).toBe('corner');
    expect(r.layoutType).toBe('single_row');
    expect(r.vastuCompliant).toBe(true);
  });

  it('empty string → all filters undefined', () => {
    const r = parseNaturalLanguageQuery('');
    expect(r.layoutType).toBeUndefined();
    expect(r.position).toBeUndefined();
    expect(r.vastuCompliant).toBeUndefined();
    expect(r.nearAmenity).toBeUndefined();
  });

  it('case-insensitive matching', () => {
    const r = parseNaturalLanguageQuery('SINGLE ROW CORNER NEAR POOL');
    expect(r.layoutType).toBe('single_row');
    expect(r.position).toBe('corner');
    expect(r.nearAmenity).toContain('pool');
  });

  it('multiple amenities detected', () => {
    const r = parseNaturalLanguageQuery('near pool and park and school');
    expect(r.nearAmenity?.length).toBeGreaterThanOrEqual(2);
  });
});
