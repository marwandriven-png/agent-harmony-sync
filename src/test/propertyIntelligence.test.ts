import { describe, it, expect } from 'vitest';
import { Geo, type Polygon } from '@/services/property-intelligence/geometry';
import { classifyDistance, classifyLandUse, classifyVastu, isEntranceLandUse, proximityLabel, proximityColor } from '@/services/property-intelligence/classifiers';
import { parseNaturalLanguageQuery } from '@/services/property-intelligence/nl-parser';
import { DEFAULT_THRESHOLDS } from '@/services/property-intelligence/types';
import { propertyIntelligence } from '@/services/property-intelligence/engine';
import type { PlotData } from '@/services/DDAGISService';

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
  it('corner-touching polygons do not count as a shared boundary', () => {
    const A: Polygon = [[0,0],[1,0],[1,1],[0,1]];
    const B: Polygon = [[1,1],[2,1],[2,2],[1,2]];
    expect(Geo.sharesBoundary(Geo.edges(A), Geo.edges(B), 111_000)).toBe(false);
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
  it('North East phrase → good', () => expect(classifyVastu('North East').rating).toBe('good'));
  it('north-east hyphenated → good', () => expect(classifyVastu('north-east').rating).toBe('good'));
  it('unknown → fallback with defined fields', () => { const v = classifyVastu('UNKNOWN'); expect(v.rating).toBeDefined(); expect(typeof v.score).toBe('number'); });
});

describe('classifyLandUse', () => {
  it('normalizes neighborhood park as park', () => expect(classifyLandUse('NEIGHBORHOOD PARK')).toBe('park'));
  it('keeps play area as playground amenity', () => expect(classifyLandUse('KIDS PLAY AREA')).toBe('playground'));
  it('normalizes clubhouse as community center', () => expect(classifyLandUse('COMMUNITY CLUBHOUSE')).toBe('community_center'));
  it('does not treat landscape as park', () => expect(classifyLandUse('LANDSCAPE BUFFER')).toBe('open_space'));
  it('treats guard house as entrance/gate amenity', () => expect(classifyLandUse('GUARD HOUSE')).toBe('community_center'));
  it('detects entrance land use aliases', () => expect(isEntranceLandUse('MAIN GATE GUARD HOUSE')).toBe(true));
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

// ─── Classification Priority — B2B vs Single Row mutual exclusion ─────────────

import { resolveVillaClass, VILLA_CLASSES } from '@/services/property-intelligence/classify-class';
import {
  getVillaPlotKey,
  hasVastu,
  matchesActiveVillaClassFilters,
  mergeVillasByPlotKey,
  normalizePlotKey,
  resolveDisplayedVillaClass,
} from '@/services/property-intelligence/unit-reference';
import { isVillaWithinSearchRadius } from '@/services/property-intelligence/search-radius';

const baseVilla = {
  id: 'test', is_corner: false, is_single_row: false,
  backs_park: false, backs_road: false, vastu_compliant: false,
};

const makeIntel = (lt: 'back_to_back'|'single_row'|'unknown', bf: string, pt = 'middle') => ({
  layout: { layoutType: lt as any, positionType: pt as any, backFacing: bf as any },
  tags: [],
});

describe('resolveVillaClass — strict priority (regression)', () => {
  it('rear-facing illustrated class overrides B2B when backFacing resolves to park', () => {
    const cls = resolveVillaClass(baseVilla, makeIntel('back_to_back', 'park'), true);
    expect(cls?.key).toBe('backs_park');
  });

  it('B2B still overrides stale db single-row flags when rear stays villa-facing', () => {
    const villa = { ...baseVilla, is_single_row: true };
    const cls = resolveVillaClass(villa, makeIntel('back_to_back', 'villa'), true);
    expect(cls?.key).toBe('back_to_back');
  });

  it('does not illustrate B2B when rear-facing evidence is missing', () => {
    const cls = resolveVillaClass(baseVilla, makeIntel('back_to_back', 'community_edge'), true);
    expect(cls?.key).toBe('back_to_back');
  });

  it('keeps B2B illustration when back-facing is unknown but layout is confirmed', () => {
    const cls = resolveVillaClass(baseVilla, makeIntel('back_to_back', 'unknown'), true);
    expect(cls?.key).toBe('back_to_back');
  });

  it('backs_park db flag still illustrates as park-facing', () => {
    const villa = { ...baseVilla, backs_park: true };
    const cls = resolveVillaClass(villa, makeIntel('back_to_back', 'park'), true);
    expect(cls?.key).toBe('backs_park');
  });

  it('Single Row with park backFacing → backs_park pin', () => {
    const cls = resolveVillaClass(baseVilla, makeIntel('single_row', 'park'), true);
    expect(cls?.key).toBe('backs_park');
  });

  it('Single Row with road backFacing → backs_road pin', () => {
    const cls = resolveVillaClass(baseVilla, makeIntel('single_row', 'road'), true);
    expect(cls?.key).toBe('backs_road');
  });

  it('Single Row with open_space → open_view pin', () => {
    const cls = resolveVillaClass(baseVilla, makeIntel('single_row', 'open_space'), true);
    expect(cls?.key).toBe('open_view');
  });

  it('Single Row with villa backFacing → single_row pin', () => {
    const cls = resolveVillaClass(baseVilla, makeIntel('single_row', 'villa'), true);
    expect(cls?.key).toBe('single_row');
  });

  it('Corner with no row classification → corner', () => {
    const cls2 = resolveVillaClass(baseVilla, makeIntel('unknown', 'park', 'corner'), true);
    expect(cls2?.key).toBe('backs_park');
    const cls3 = resolveVillaClass(baseVilla, makeIntel('unknown', 'community_edge', 'corner'), true);
    expect(cls3?.key).toBe('corner');
  });

  it('End Unit with rear road classification → backs_road', () => {
    const cls = resolveVillaClass(baseVilla, makeIntel('unknown', 'road', 'end'), true);
    expect(cls?.key).toBe('backs_road');
  });

  it('End Unit with no row classification → end_unit', () => {
    const cls = resolveVillaClass(baseVilla, makeIntel('unknown', 'community_edge', 'end'), true);
    expect(cls?.key).toBe('end_unit');
  });

  it('No intel loaded → null (no premature pin)', () => {
    expect(resolveVillaClass(baseVilla, undefined, false)).toBeNull();
  });

  it('Intel loaded but no class matches → null (no pin)', () => {
    expect(resolveVillaClass(baseVilla, makeIntel('unknown', 'community_edge'), true)).toBeNull();
  });

  it('Vastu fallback only when no layout/position/facing detected', () => {
    const villa = { ...baseVilla, vastu_compliant: true };
    const cls = resolveVillaClass(villa, makeIntel('unknown', 'community_edge'), true);
    expect(cls?.key).toBe('vastu');
  });

  it('VILLA_CLASSES has all 8 expected keys', () => {
    const keys = Object.keys(VILLA_CLASSES);
    expect(keys).toContain('back_to_back');
    expect(keys).toContain('single_row');
    expect(keys).toContain('corner');
    expect(keys).toContain('end_unit');
    expect(keys).toContain('backs_park');
    expect(keys).toContain('backs_road');
    expect(keys).toContain('open_view');
    expect(keys).toContain('vastu');
    expect(keys).toHaveLength(8);
  });

  it('All class fill colors are unique (no two classes share a color)', () => {
    const fills = Object.values(VILLA_CLASSES).map(c => c.fill);
    const unique = new Set(fills);
    expect(unique.size).toBe(fills.length);
  });
});

describe('search radius parity', () => {
  it('keeps plot-linked villas inside radius using plot coordinates', () => {
    const villa = {
      ...baseVilla,
      id: 'villa-1',
      villa_number: '101',
      plot_number: 'P-1',
      plot_id: null,
      latitude: null,
      longitude: null,
      community_name: 'Test',
      sub_community: null,
      cluster_name: null,
      orientation: null,
      facing_direction: null,
      position_type: null,
      near_pool: false,
      near_entrance: false,
      near_school: false,
      near_community_center: false,
      vastu_details: null,
      land_usage: null,
      plot_size_sqft: null,
      built_up_area_sqft: null,
      bedrooms: null,
      floors: null,
      year_built: null,
      notes: null,
      metadata: {},
      created_by: null,
      created_at: '',
      updated_at: '',
    };

    const lookup = new Map([
      ['p-1', { lat: 25.0004, lng: 55.0004 }],
    ]);

    expect(isVillaWithinSearchRadius(villa as any, { lat: 25, lng: 55 }, 100, lookup)).toBe(true);
    expect(isVillaWithinSearchRadius(villa as any, { lat: 25, lng: 55 }, 40, lookup)).toBe(false);
  });
});

describe('unit-reference integration regression', () => {
  it('dedupes synthetic and db villas by plot key while keeping richer record', () => {
    const synthetic = { ...baseVilla, id: 'gis:123', plot_number: '123', plot_id: '123', latitude: 25.2, longitude: 55.2, facing_direction: null, bedrooms: null, plot_size_sqft: null };
    const db = { ...baseVilla, id: 'db-1', plot_number: '123', plot_id: '123', latitude: 25.2, longitude: 55.2, facing_direction: 'N', bedrooms: 4, plot_size_sqft: 3000 };
    const merged = mergeVillasByPlotKey([synthetic as any, db as any]);
    expect(merged).toHaveLength(1);
    expect(merged[0].id).toBe('db-1');
  });

  it('uses plot_number / plot_id / gis id consistently for rendered pins', () => {
    expect(getVillaPlotKey({ id: 'gis:456', plot_number: null, plot_id: null } as any)).toBe('456');
    expect(getVillaPlotKey({ id: 'villa-1', plot_number: ' P-12 ', plot_id: null } as any)).toBe('p-12');
    expect(getVillaPlotKey({ id: 'villa-2', plot_number: null, plot_id: 'Plot-9' } as any)).toBe('plot-9');
  });

  it('normalizes raw plot keys for map/list parity', () => {
    expect(normalizePlotKey(' 6482941 ')).toBe('6482941');
    expect(normalizePlotKey(' Plot-A1 ')).toBe('plot-a1');
  });

  it('returns filtered display class from shared resolver', () => {
    const cls = resolveDisplayedVillaClass(
      baseVilla as any,
      makeIntel('single_row', 'park') as any,
      true,
      { backsPark: true },
    );
    expect(cls?.key).toBe('backs_park');
  });

  it('treats orientation fallback as vastu-compliant', () => {
    expect(hasVastu({ ...baseVilla, orientation: 'North East' } as any, undefined)).toBe(true);
  });
});

describe('PropertyIntelligenceEngine polygon layout regression', () => {
  const makePlot = (id: string, polygon: Polygon, landUseDetails: string): PlotData => ({
    id,
    area: 100,
    gfa: 100,
    floors: 'G+1',
    zoning: landUseDetails,
    location: 'Test',
    x: polygon[0][0],
    y: polygon[0][1],
    color: '#000',
    status: 'Available',
    constructionCost: 0,
    salePrice: 0,
    landUseDetails,
    isFrozen: false,
    rawAttributes: {
      geometry: { rings: [polygon] },
    },
    verificationSource: 'Manual',
  });

  it('keeps a plot single_row when the rear side faces a road buffer', () => {
    propertyIntelligence.clearCache();
    const villa = makePlot('villa', [[55.0000,25.0000],[55.0001,25.0000],[55.0001,25.0001],[55.0000,25.0001]], 'RESIDENTIAL ATTACHED VILLAS');
    const rearRoad = makePlot('road', [[55.0000,25.0001],[55.0001,25.0001],[55.0001,25.0002],[55.0000,25.0002]], 'ROAD');
    const sideResidential = makePlot('rear', [[55.0001,25.0000],[55.0002,25.0000],[55.0002,25.0001],[55.0001,25.0001]], 'RESIDENTIAL ATTACHED VILLAS');

    const batch = propertyIntelligence.buildBatch([villa, rearRoad, sideResidential]);
    const result = propertyIntelligence.analyzeWithBatch(villa, batch, 'S');

    expect(result.layout.layoutType).toBe('single_row');
    expect(result.layout.backFacing).toBe('road');
  });

  it('marks rear park beyond a narrow road buffer as backs_park', () => {
    propertyIntelligence.clearCache();
    const villa = makePlot('villa', [[55.0000,25.0000],[55.0001,25.0000],[55.0001,25.0001],[55.0000,25.0001]], 'RESIDENTIAL ATTACHED VILLAS');
    const frontRoad = makePlot('front-road', [[55.0000,24.9999],[55.0001,24.9999],[55.0001,25.0000],[55.0000,25.0000]], 'ROAD');
    const rearRoad = makePlot('rear-road', [[55.0000,25.0001],[55.0001,25.0001],[55.0001,25.00013],[55.0000,25.00013]], 'ROAD');
    const rearPark = makePlot('rear-park', [[55.0000,25.00013],[55.0001,25.00013],[55.0001,25.00032],[55.0000,25.00032]], 'NEIGHBORHOOD PARK');

    const batch = propertyIntelligence.buildBatch([villa, frontRoad, rearRoad, rearPark]);
    const result = propertyIntelligence.analyzeWithBatch(villa, batch, 'S');

    expect(result.layout.layoutType).toBe('single_row');
    expect(result.layout.backFacing).toBe('park');
  });

  it('keeps park-facing class even when vastu is also compliant', () => {
    const cls = resolveDisplayedVillaClass(
      { ...baseVilla, vastu_compliant: true, facing_direction: 'E' } as any,
      makeIntel('single_row', 'park') as any,
      true,
      { backsPark: true, vastuCompliant: true },
    );

    expect(cls?.key).toBe('backs_park');
  });

  it('allows B2B villas through backs park filter when rear also faces park', () => {
    expect(
      matchesActiveVillaClassFilters(
        baseVilla as any,
        makeIntel('back_to_back', 'park') as any,
        { backsPark: true },
      )
    ).toBe(true);
  });

  it('allows park-facing villas through back-to-back filter when layout is also B2B', () => {
    expect(
      matchesActiveVillaClassFilters(
        baseVilla as any,
        makeIntel('back_to_back', 'park') as any,
        { isBackToBack: true },
      )
    ).toBe(true);
  });

  it('does not mark B2B when rear residential only touches at one corner', () => {
    propertyIntelligence.clearCache();
    const villa = makePlot('villa', [[55.0000,25.0000],[55.0001,25.0000],[55.0001,25.0001],[55.0000,25.0001]], 'RESIDENTIAL ATTACHED VILLAS');
    const frontRoad = makePlot('front-road', [[55.0000,24.9999],[55.0001,24.9999],[55.0001,25.0000],[55.0000,25.0000]], 'ROAD');
    const cornerTouchRear = makePlot('corner-rear', [[55.0001,25.0001],[55.0002,25.0001],[55.0002,25.0002],[55.0001,25.0002]], 'RESIDENTIAL ATTACHED VILLAS');

    const batch = propertyIntelligence.buildBatch([villa, frontRoad, cornerTouchRear]);
    const result = propertyIntelligence.analyzeWithBatch(villa, batch, 'N');

    expect(result.layout.layoutType).toBe('single_row');
    expect(result.layout.backFacing).not.toBe('villa');
  });

  it('dedupes db and gis records with case-insensitive plot ids', () => {
    const synthetic = { ...baseVilla, id: 'gis:ABC-1', plot_number: ' ABC-1 ', plot_id: ' ABC-1 ', latitude: 25.2, longitude: 55.2, facing_direction: null, bedrooms: null, plot_size_sqft: null };
    const db = { ...baseVilla, id: 'db-1', plot_number: 'abc-1', plot_id: 'abc-1', latitude: 25.2, longitude: 55.2, facing_direction: 'N', bedrooms: 4, plot_size_sqft: 3000 };
    const merged = mergeVillasByPlotKey([synthetic as any, db as any]);
    expect(merged).toHaveLength(1);
    expect(merged[0].id).toBe('db-1');
  });

  it('includes park and community-center plots in amenity search batch', () => {
    propertyIntelligence.clearCache();
    const villa = makePlot('villa', [[55.0000,25.0000],[55.0001,25.0000],[55.0001,25.0001],[55.0000,25.0001]], 'RESIDENTIAL ATTACHED VILLAS');
    const park = makePlot('6482996', [[55.0000,25.0001],[55.0001,25.0001],[55.0001,25.0002],[55.0000,25.0002]], 'NEIGHBORHOOD PARK');
    const clubhouse = makePlot('club', [[55.0001,25.0000],[55.0002,25.0000],[55.0002,25.0001],[55.0001,25.0001]], 'COMMUNITY CLUBHOUSE');

    const batch = propertyIntelligence.buildBatch([villa, park, clubhouse]);
    expect(batch.parks.map((plot) => plot.plot.id)).toContain('6482996');
    expect(batch.amenities.map((plot) => plot.plot.id)).toContain('6482996');
    expect(batch.amenities.map((plot) => plot.plot.id)).toContain('club');
  });
});
