import { describe, it, expect } from 'vitest';
import { Geo, type Polygon } from '@/services/property-intelligence/geometry';
import { classifyDistance, classifyVastu, proximityLabel, proximityColor } from '@/services/property-intelligence/classifiers';
import { parseNaturalLanguageQuery } from '@/services/property-intelligence/nl-parser';
import { DEFAULT_THRESHOLDS } from '@/services/property-intelligence/types';

// ─── Geometry ────────────────────────────────────────────────────────────────
describe('Geo.distanceM', () => {
  it('0 for same point', () => expect(Geo.distanceM([55.248, 25.064], [55.248, 25.064])).toBe(0));
  it('~470m for Dubai points', () => {
    const d = Geo.distanceM([55.2744, 25.1972], [55.2796, 25.1977]);
    expect(d).toBeGreaterThan(400); expect(d).toBeLessThan(600);
  });
  it('symmetric', () => {
    const a: [number,number] = [55.248,25.064], b: [number,number] = [55.27,25.058];
    expect(Math.abs(Geo.distanceM(a,b) - Geo.distanceM(b,a))).toBeLessThan(0.01);
  });
});

describe('Geo.centroid', () => {
  it('square center', () => {
    const [cx,cy] = Geo.centroid([[0,0],[1,0],[1,1],[0,1]]);
    expect(cx).toBeCloseTo(0.5); expect(cy).toBeCloseTo(0.5);
  });
});

describe('Geo.edges', () => {
  it('returns N edges for N-vertex polygon', () => {
    expect(Geo.edges([[0,0],[1,0],[1,1],[0,1]])).toHaveLength(4);
  });
  it('mid is average of a and b', () => {
    Geo.edges([[0,0],[2,0],[2,2],[0,2]]).forEach(e => {
      expect(e.mid[0]).toBeCloseTo((e.a[0]+e.b[0])/2);
    });
  });
});

describe('Geo.sharesBoundary', () => {
  it('adjacent unit squares share boundary with large tolerance', () => {
    const A: Polygon = [[0,0],[1,0],[1,1],[0,1]];
    const B: Polygon = [[1,0],[2,0],[2,1],[1,1]];
    expect(Geo.sharesBoundary(Geo.edges(A), Geo.edges(B), 111_000)).toBe(true);
  });
  it('non-adjacent polygons do not share boundary', () => {
    const A: Polygon = [[0,0],[0.001,0],[0.001,0.001],[0,0.001]];
    const C: Polygon = [[0.1,0.1],[0.2,0.1],[0.2,0.2],[0.1,0.2]];
    expect(Geo.sharesBoundary(Geo.edges(A), Geo.edges(C), 5)).toBe(false);
  });
});

// ─── Distance Classification ──────────────────────────────────────────────────
describe('classifyDistance', () => {
  const { veryClose, near, walkable } = DEFAULT_THRESHOLDS;
  it('0m → very_close', () => expect(classifyDistance(0)).toBe('very_close'));
  it('at veryClose → very_close', () => expect(classifyDistance(veryClose)).toBe('very_close'));
  it('veryClose+1 → near', () => expect(classifyDistance(veryClose+1)).toBe('near'));
  it('at near → near', () => expect(classifyDistance(near)).toBe('near'));
  it('near+1 → walkable', () => expect(classifyDistance(near+1)).toBe('walkable'));
  it('at walkable → walkable', () => expect(classifyDistance(walkable)).toBe('walkable'));
  it('walkable+1 → not_nearby', () => expect(classifyDistance(walkable+1)).toBe('not_nearby'));
  it('1000m → not_nearby', () => expect(classifyDistance(1000)).toBe('not_nearby'));
  it('custom thresholds', () => expect(classifyDistance(10,{veryClose:5,near:20,walkable:50})).toBe('near'));
});

describe('proximityLabel', () => {
  it('all four classes map', () => {
    expect(proximityLabel('very_close')).toBe('Very Close');
    expect(proximityLabel('near')).toBe('Near');
    expect(proximityLabel('walkable')).toBe('Walkable');
    expect(proximityLabel('not_nearby')).toBe('Not Nearby');
  });
});

describe('proximityColor', () => {
  it('returns Tailwind classes', () => {
    expect(proximityColor('very_close')).toContain('emerald');
    expect(proximityColor('near')).toContain('cyan');
    expect(proximityColor('walkable')).toContain('amber');
    expect(proximityColor('not_nearby')).toContain('gray');
  });
});

// ─── Vastu ───────────────────────────────────────────────────────────────────
describe('classifyVastu', () => {
  it('E → excellent, compliant', () => { const v = classifyVastu('E'); expect(v.rating).toBe('excellent'); expect(v.compliant).toBe(true); });
  it('N → good, compliant', () => { const v = classifyVastu('N'); expect(v.rating).toBe('good'); expect(v.compliant).toBe(true); });
  it('NE → good, compliant', () => { expect(classifyVastu('NE').rating).toBe('good'); });
  it('NW → neutral, NOT compliant (regression test)', () => { const v = classifyVastu('NW'); expect(v.rating).toBe('neutral'); expect(v.compliant).toBe(false); });
  it('W → neutral', () => expect(classifyVastu('W').rating).toBe('neutral'));
  it('SE → neutral', () => expect(classifyVastu('SE').rating).toBe('neutral'));
  it('S → less_preferred', () => { const v = classifyVastu('S'); expect(v.rating).toBe('less_preferred'); expect(v.score).toBe(1); });
  it('SW → less_preferred', () => expect(classifyVastu('SW').rating).toBe('less_preferred'));
  it('null → no throw', () => { expect(() => classifyVastu(null)).not.toThrow(); });
  it('undefined → no throw', () => { expect(() => classifyVastu(undefined)).not.toThrow(); });
  it('empty string → defined result', () => { expect(classifyVastu('')).toBeDefined(); });
  it('lowercase east → excellent', () => expect(classifyVastu('east').rating).toBe('excellent'));
  it('EAST full word → excellent', () => expect(classifyVastu('East').rating).toBe('excellent'));
  it('unknown → fallback with defined fields', () => { const v = classifyVastu('UNKNOWN'); expect(v.rating).toBeDefined(); expect(typeof v.score).toBe('number'); });
});

// ─── NL Parser ───────────────────────────────────────────────────────────────
describe('parseNaturalLanguageQuery', () => {
  it('"single row" → single_row', () => expect(parseNaturalLanguageQuery('single row villa').layoutType).toBe('single_row'));
  it('"back to back" → back_to_back', () => expect(parseNaturalLanguageQuery('back to back').layoutType).toBe('back_to_back'));
  it('"b2b" → back_to_back', () => expect(parseNaturalLanguageQuery('b2b villa').layoutType).toBe('back_to_back'));
  it('"corner" → corner', () => expect(parseNaturalLanguageQuery('corner villa').position).toBe('corner'));
  it('"end unit" → end', () => expect(parseNaturalLanguageQuery('end unit villa').position).toBe('end'));
  it('"backs park" → park', () => expect(parseNaturalLanguageQuery('backs park').backFacing).toBe('park'));
  it('"back road" → road', () => expect(parseNaturalLanguageQuery('back road villa').backFacing).toBe('road'));
  it('"open view" → open_space', () => expect(parseNaturalLanguageQuery('open view villa').backFacing).toBe('open_space'));
  it('"vastu" → vastuCompliant', () => expect(parseNaturalLanguageQuery('vastu compliant').vastuCompliant).toBe(true));
  it('"east facing" → vastuCompliant', () => expect(parseNaturalLanguageQuery('east facing villa').vastuCompliant).toBe(true));
  it('"near pool" → pool amenity', () => expect(parseNaturalLanguageQuery('near pool').nearAmenity).toContain('pool'));
  it('"near swimming" → pool', () => expect(parseNaturalLanguageQuery('near swimming pool').nearAmenity).toContain('pool'));
  it('"near garden" → park', () => expect(parseNaturalLanguageQuery('near garden').nearAmenity).toContain('park'));
  it('"near masjid" → mosque', () => expect(parseNaturalLanguageQuery('near masjid').nearAmenity).toContain('mosque'));
  it('"near nursery" → school', () => expect(parseNaturalLanguageQuery('near nursery').nearAmenity).toContain('school'));
  it('"within 200m" → maxDistance 200', () => expect(parseNaturalLanguageQuery('corner villa within 200m').maxDistance).toBe(200));
  it('combined query', () => {
    const r = parseNaturalLanguageQuery('corner single row vastu near pool within 300m');
    expect(r.position).toBe('corner');
    expect(r.layoutType).toBe('single_row');
    expect(r.vastuCompliant).toBe(true);
    expect(r.nearAmenity).toContain('pool');
    expect(r.maxDistance).toBe(300);
  });
  it('empty string → empty filters', () => {
    const r = parseNaturalLanguageQuery('');
    expect(r.layoutType).toBeUndefined();
    expect(r.position).toBeUndefined();
  });
  it('case-insensitive', () => {
    expect(parseNaturalLanguageQuery('SINGLE ROW CORNER NEAR POOL').layoutType).toBe('single_row');
    expect(parseNaturalLanguageQuery('SINGLE ROW CORNER NEAR POOL').position).toBe('corner');
  });
  it('multiple amenities', () => {
    const r = parseNaturalLanguageQuery('near pool and park and school');
    expect(r.nearAmenity?.length).toBeGreaterThanOrEqual(2);
  });
});
