/**
 * Natural Language query parser for property intelligence search.
 * Converts free-text queries into structured filter objects.
 *
 * Enhanced with:
 *  - Full synonym dictionary (ported from community_unit_types HTML engine)
 *  - Negation support: "not corner", "no b2b", "without park view"
 *  - OR logic: "corner, end unit" → either
 *  - AND logic (default): "corner backs park" → both
 *  - Safe logging: no console.group (not supported in all environments)
 */

import type { PISearchFilters, AmenityType } from './types';

// ─── Amenity keyword map ───────────────────────────────────────────────────────
const AMENITY_KEYWORDS: Record<string, AmenityType> = {
  pool: 'pool', swimming: 'pool', swim: 'pool',
  park: 'park', garden: 'park', green: 'park', gardens: 'park',
  play: 'playground', kids: 'playground', playground: 'playground',
  mall: 'mall', shopping: 'mall',
  school: 'school', nursery: 'school', education: 'school',
  mosque: 'mosque', masjid: 'mosque', prayer: 'mosque',
  community: 'community_center', clubhouse: 'community_center',
  hospital: 'healthcare', clinic: 'healthcare', medical: 'healthcare',
  retail: 'retail', shop: 'retail', supermarket: 'retail', store: 'retail',
  gate: 'community_center', entrance: 'community_center',
};

// ─── Full synonym dictionary ───────────────────────────────────────────────────
// Each key maps to a list of phrases that mean the same thing.
// Longer phrases checked first to prevent partial match shadowing.
const SYNONYMS: Record<string, string[]> = {
  // Layout
  back_to_back: [
    'back to back','back-to-back','b2b','b-2-b','mirror row','paired row',
    'backs unit','backs villa','opposing row','shared rear wall',
    'no rear privacy','backed by villa','two rows','villa behind',
    'backs another unit','btb',
  ],
  single_row: [
    'single row','single-row','sr','standalone','open back','no back unit',
    'one row','no opposing','isolated row','open rear','solo row',
    'single file','single line',
  ],
  backs_park: [
    'backs park','back park','park view','park facing','park back','backing park',
    'faces park','green view','green belt','overlooks park','park side','park rear',
    'garden view','green space','nature view','park front','faces green',
    'backs green','green behind','park behind',
  ],
  backs_road: [
    'back road','back-road','road behind','service road','rear access','road access',
    'rear road','road at back','service access','vehicle access','rear vehicle',
    'backs road','road back',
  ],
  open_space: [
    'open view','open space','open land','open back','open rear',
    'no rear building','desert view','land behind','vacant behind',
    'empty behind','open outlook',
  ],
  // Position
  corner: [
    'corner unit','corner-unit','cu','corner','intersection unit','junction',
    'two frontage','dual frontage','double frontage','corner position','road corner',
    'corner plot','double road','two roads','double road','meets road',
    'front and side road',
  ],
  end_unit: [
    'end unit','end-unit','eu','edge unit','edge','side unit','terminal unit',
    'row end','last unit','first unit','exposed side','free side','exposed wall',
    'end of row','row terminal','corner of row',
  ],
  // Vastu
  vastu: ['vastu','vaastu','vastu compliant','vastu friendly','auspicious facing'],
  // Facing directions
  east_facing: ['east facing','east-facing','faces east','eastern facing','e facing'],
  north_facing: ['north facing','north-facing','faces north','northern facing','n facing'],
  west_facing:  ['west facing','west-facing','faces west','western facing','w facing'],
  south_facing: ['south facing','south-facing','faces south','southern facing','s facing'],
  ne_facing:    ['north east facing','northeast facing','ne facing','north-east facing'],
  nw_facing:    ['north west facing','northwest facing','nw facing','north-west facing'],
  se_facing:    ['south east facing','southeast facing','se facing','south-east facing'],
  sw_facing:    ['south west facing','southwest facing','sw facing','south-west facing'],
};

// Sort synonyms longest-first to prevent partial shadowing
const SORTED_SYNONYMS: Record<string, string[]> = {};
Object.entries(SYNONYMS).forEach(([k, terms]) => {
  SORTED_SYNONYMS[k] = [...terms].sort((a, b) => b.length - a.length);
});

// ─── Negation prefixes ────────────────────────────────────────────────────────
const NEG_PATTERN = /\b(?:not|no|without|exclude|non[- ]?|don't want|avoid|except)\s+/gi;

// ─── Helper: check if text contains a synonym ────────────────────────────────
function matchesSynonym(text: string, key: string): boolean {
  return (SORTED_SYNONYMS[key] || []).some(t => text.includes(t));
}

// ─── Core parser ─────────────────────────────────────────────────────────────

export function parseNaturalLanguageQuery(query: string): PISearchFilters {
  if (!query?.trim()) return {};

  const raw = query.toLowerCase().trim();

  // Support OR segments (comma-separated or " or ")
  const orSegments = raw.split(/\s*,\s*|\s+or\s+/);

  if (orSegments.length > 1) {
    // OR mode: merge filters across segments (any positive match qualifies)
    const merged: PISearchFilters = {};
    orSegments.forEach(seg => {
      const f = _parseSingleSegment(seg.trim());
      // Merge: prefer set values over undefined
      (Object.keys(f) as (keyof PISearchFilters)[]).forEach(k => {
        if (f[k] !== undefined && merged[k] === undefined) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (merged as any)[k] = f[k];
        }
      });
    });
    merged.naturalQuery = query;
    return merged;
  }

  const filters = _parseSingleSegment(raw);
  filters.naturalQuery = query;
  return filters;
}

function _parseSingleSegment(s: string): PISearchFilters {
  const filters: PISearchFilters = {};

  // ── Extract negation phrases first ──────────────────────────────────────────
  const negSegments: string[] = [];
  const negMatches = s.match(/\b(?:not|no|without|exclude|non[- ]?|don't want|avoid|except)\s+[\w\s-]+/g) || [];
  negMatches.forEach(nm => negSegments.push(nm.replace(NEG_PATTERN, '').trim()));

  // Positive text: remove negation phrases
  const posText = s.replace(/\b(?:not|no|without|exclude|non[- ]?|don't want|avoid|except)\s+[\w\s-]+/g, '').trim();

  // ── Layout type (MUTUALLY EXCLUSIVE — B2B wins if both somehow present) ─────
  const posB2B = matchesSynonym(posText, 'back_to_back');
  const posSR  = matchesSynonym(posText, 'single_row');
  const negB2B = negSegments.some(n => matchesSynonym(n, 'back_to_back'));
  const negSR  = negSegments.some(n => matchesSynonym(n, 'single_row'));

  // B2B excluded negation guard (single row includes "no b2b" pattern)
  const impliesSR = negB2B && !posSR && !posB2B;

  if (posB2B && !negB2B)      filters.layoutType = 'back_to_back';
  else if (posSR && !negSR)   filters.layoutType = 'single_row';
  else if (impliesSR)         filters.layoutType = 'single_row'; // "not b2b" → SR

  // ── Position ─────────────────────────────────────────────────────────────────
  const posCorner = matchesSynonym(posText, 'corner');
  const posEnd    = matchesSynonym(posText, 'end_unit');
  const negCorner = negSegments.some(n => matchesSynonym(n, 'corner'));
  const negEnd    = negSegments.some(n => matchesSynonym(n, 'end_unit'));

  if (posCorner && !negCorner) filters.position = 'corner';
  else if (posEnd && !negEnd)  filters.position = 'end';

  // ── Back facing ───────────────────────────────────────────────────────────────
  const negPark = negSegments.some(n => matchesSynonym(n, 'backs_park'));
  const negRoad = negSegments.some(n => matchesSynonym(n, 'backs_road'));
  const negOpen = negSegments.some(n => matchesSynonym(n, 'open_space'));

  if (matchesSynonym(posText, 'backs_park') && !negPark)   filters.backFacing = 'park';
  else if (matchesSynonym(posText, 'backs_road') && !negRoad) filters.backFacing = 'road';
  else if (matchesSynonym(posText, 'open_space') && !negOpen) filters.backFacing = 'open_space';

  // ── Vastu ─────────────────────────────────────────────────────────────────────
  if (matchesSynonym(posText, 'vastu')) filters.vastuCompliant = true;

  // Direction detection (ordered longest-match first)
  if (matchesSynonym(posText, 'ne_facing'))    { filters.vastuDirection = 'NE'; }
  else if (matchesSynonym(posText, 'nw_facing')) { filters.vastuDirection = 'NW'; }
  else if (matchesSynonym(posText, 'se_facing')) { filters.vastuDirection = 'SE'; }
  else if (matchesSynonym(posText, 'sw_facing')) { filters.vastuDirection = 'SW'; }
  else if (matchesSynonym(posText, 'east_facing')) { filters.vastuDirection = 'E'; filters.vastuCompliant = true; }
  else if (matchesSynonym(posText, 'north_facing')) { filters.vastuDirection = 'N'; filters.vastuCompliant = true; }
  else if (matchesSynonym(posText, 'west_facing')) { filters.vastuDirection = 'W'; }
  else if (matchesSynonym(posText, 'south_facing')) { filters.vastuDirection = 'S'; }

  // ── Amenities ─────────────────────────────────────────────────────────────────
  const detectedAmenities: AmenityType[] = [];
  for (const [keyword, type] of Object.entries(AMENITY_KEYWORDS)) {
    if (posText.includes(keyword) && !detectedAmenities.includes(type)) {
      // Don't double-count park as both backFacing and amenity
      if (type === 'park' && filters.backFacing === 'park') continue;
      detectedAmenities.push(type);
    }
  }
  if (detectedAmenities.length > 0) {
    filters.nearAmenity = detectedAmenities;
  }

  // ── Max distance ──────────────────────────────────────────────────────────────
  const distMatch = posText.match(/(?:within|under|<)\s*(\d+)\s*m/);
  if (distMatch) filters.maxDistance = parseInt(distMatch[1]);

  // ── "Near" keyword ────────────────────────────────────────────────────────────
  if (/\bnear\b/.test(posText) && !filters.nearAmenity?.length) {
    const nearMatch = posText.match(/near\s+(\w+)/);
    if (nearMatch) {
      const type = AMENITY_KEYWORDS[nearMatch[1]];
      if (type) filters.nearAmenity = [type];
    }
  }

  return filters;
}

// ─── Describe filters (human-readable) ───────────────────────────────────────

export function describeFilters(filters: PISearchFilters): string[] {
  const parts: string[] = [];
  if (filters.layoutType === 'single_row')   parts.push('Single Row');
  if (filters.layoutType === 'back_to_back') parts.push('Back-to-Back');
  if (filters.position === 'corner')         parts.push('Corner');
  if (filters.position === 'end')            parts.push('End Unit');
  if (filters.backFacing === 'park')         parts.push('Backs Park');
  if (filters.backFacing === 'road')         parts.push('Backs Road');
  if (filters.backFacing === 'open_space')   parts.push('Open View');
  if (filters.vastuCompliant)               parts.push('Vastu Compliant');
  if (filters.vastuDirection)               parts.push(`${filters.vastuDirection} Facing`);
  if (filters.nearAmenity) {
    for (const a of filters.nearAmenity) {
      parts.push(`Near ${a.replace('_', ' ')}`);
    }
  }
  return parts;
}

// ─── Validation runner (safe — no console.group) ─────────────────────────────
// Used for development/testing only. Safe for all JS environments.

interface ValidationCase {
  desc: string;
  query: string;
  expect: Partial<PISearchFilters>;
}

const VALIDATION_CASES: ValidationCase[] = [
  { desc: '"b2b" → back_to_back',        query: 'b2b',              expect: { layoutType: 'back_to_back' } },
  { desc: '"sr" → single_row',           query: 'sr',               expect: { layoutType: 'single_row' } },
  { desc: '"park view" → backFacing park', query: 'park view',      expect: { backFacing: 'park' } },
  { desc: '"corner" → position corner',  query: 'corner',           expect: { position: 'corner' } },
  { desc: '"edge" → position end',       query: 'edge',             expect: { position: 'end' } },
  { desc: '"not b2b" → single_row',      query: 'not back to back', expect: { layoutType: 'single_row' } },
  { desc: '"east facing" → vastu+dir',   query: 'east facing villa', expect: { vastuCompliant: true, vastuDirection: 'E' } },
  { desc: 'compound: corner backs park', query: 'corner backs park', expect: { position: 'corner', backFacing: 'park' } },
  { desc: 'synonym: "b2b"==="back to back"', query: 'b2b', expect: { layoutType: 'back_to_back' } },
  { desc: 'synonym: "green belt"→park',  query: 'green belt',       expect: { backFacing: 'park' } },
];

export function runParserValidation(): { pass: number; fail: number; results: Array<{desc: string; pass: boolean; note?: string}> } {
  let pass = 0, fail = 0;
  const results: Array<{desc: string; pass: boolean; note?: string}> = [];

  for (const tc of VALIDATION_CASES) {
    const f = parseNaturalLanguageQuery(tc.query);
    let ok = true;
    let note: string | undefined;

    for (const [k, v] of Object.entries(tc.expect)) {
      const actual = (f as Record<string, unknown>)[k];
      if (JSON.stringify(actual) !== JSON.stringify(v)) {
        ok = false;
        note = `${k}: expected ${JSON.stringify(v)}, got ${JSON.stringify(actual)}`;
        break;
      }
    }

    if (ok) pass++; else fail++;
    results.push({ desc: tc.desc, pass: ok, note });
  }

  // Safe logging — no console.group (not available in all environments)
  if (typeof console !== 'undefined' && console.log) {
    console.log('[NL Parser Validation]', `${pass}/${pass + fail} passed`);
    results.filter(r => !r.pass).forEach(r => {
      if (console.warn) console.warn(`  FAIL: ${r.desc} — ${r.note}`);
    });
  }

  return { pass, fail, results };
}
