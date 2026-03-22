import type { CommunityVilla, VillaSearchFilters } from '@/hooks/useVillas';
import type { VillaIntelligence } from '@/hooks/usePropertyIntelligence';
import { classifyVastu, resolveDirectionText } from './classifiers';
import {
  VILLA_CLASSES,
  resolveVillaClass,
  type VillaClass,
} from './classify-class';

export const COMMUNITY_UNIT_REFERENCE_TYPES = {
  b2b: {
    label: 'Back to back',
    description: 'Two mirror rows share a single rear boundary wall with no road or open buffer between them.',
  },
  sr: {
    label: 'Single row',
    description: 'One row only, with no opposing residential row directly behind the unit.',
  },
  bp: {
    label: 'Backs park',
    description: 'Rear boundary directly faces a park or green belt.',
  },
  br: {
    label: 'Backs road',
    description: 'Rear boundary directly faces a road or service lane.',
  },
  eu: {
    label: 'End unit',
    description: 'The terminating unit of a row, excluding corner units.',
  },
  cu: {
    label: 'Corner unit',
    description: 'A unit exposed to two road-facing sides at an intersection.',
  },
} as const;

export function isSyntheticGisVilla(villa: Pick<CommunityVilla, 'id'>): boolean {
  return villa.id.startsWith('gis:');
}

export function normalizePlotKey(value: string | null | undefined): string | null {
  const normalized = value?.trim().toLowerCase();
  return normalized ? normalized : null;
}

export function getVillaPlotKey(
  villa: Pick<CommunityVilla, 'id' | 'plot_number' | 'plot_id'>,
): string | null {
  return normalizePlotKey(
    villa.plot_number
      ?? villa.plot_id
      ?? (isSyntheticGisVilla(villa) ? villa.id.replace(/^gis:/, '') : null)
  );
}

function getVillaQualityScore(villa: CommunityVilla): number {
  let score = 0;
  if (!isSyntheticGisVilla(villa)) score += 100;
  if (villa.latitude != null && villa.longitude != null) score += 20;
  if (villa.facing_direction) score += 8;
  if (villa.bedrooms != null) score += 5;
  if (villa.plot_size_sqft != null) score += 3;
  return score;
}

export function mergeVillasByPlotKey(villas: CommunityVilla[]): CommunityVilla[] {
  const keyed = new Map<string, CommunityVilla>();
  const unkeyed: CommunityVilla[] = [];

  villas.forEach((villa) => {
    const plotKey = getVillaPlotKey(villa);
    if (!plotKey) {
      unkeyed.push(villa);
      return;
    }

    const existing = keyed.get(plotKey);
    if (!existing || getVillaQualityScore(villa) > getVillaQualityScore(existing)) {
      keyed.set(plotKey, villa);
    }
  });

  return [...keyed.values(), ...unkeyed];
}

export function hasVastu(villa: CommunityVilla, intel: VillaIntelligence | undefined): boolean {
  const resolvedVastu = classifyVastu(resolveDirectionText(villa.facing_direction, villa.orientation, villa.vastu_details)).compliant;
  return !!(intel?.tags.some((t) => t.label.includes('Vastu')) || villa.vastu_compliant || resolvedVastu);
}

export function matchesCorner(villa: CommunityVilla, intel: VillaIntelligence | undefined): boolean {
  return intel?.layout.positionType === 'corner' || villa.is_corner;
}

export function matchesEndUnit(villa: CommunityVilla, intel: VillaIntelligence | undefined): boolean {
  if (matchesCorner(villa, intel)) return false;
  return intel?.layout.positionType === 'end' || villa.position_type === 'end';
}

export function matchesBackToBack(intel: VillaIntelligence | undefined): boolean {
  return intel?.layout.layoutType === 'back_to_back';
}

export function matchesSingleRow(villa: CommunityVilla, intel: VillaIntelligence | undefined): boolean {
  if (intel?.layout.layoutType === 'back_to_back') return false;
  return intel?.layout.layoutType === 'single_row' || villa.is_single_row;
}

export function matchesBacksPark(villa: CommunityVilla, intel: VillaIntelligence | undefined): boolean {
  return intel?.layout.backFacing === 'park' || villa.backs_park;
}

export function matchesBacksRoad(villa: CommunityVilla, intel: VillaIntelligence | undefined): boolean {
  return intel?.layout.backFacing === 'road' || villa.backs_road;
}

export function matchesOpenView(intel: VillaIntelligence | undefined): boolean {
  return intel?.layout.backFacing === 'open_space';
}

export function hasActiveClassFilter(filters: VillaSearchFilters | undefined): boolean {
  if (!filters) return false;
  return !!(
    filters.isCorner || filters.isEndUnit || filters.isBackToBack || filters.isSingleRow ||
    filters.backsPark || filters.backsRoad || filters.backsOpenSpace ||
    filters.vastuCompliant || filters.nearPool || filters.nearSchool || filters.nearEntrance ||
    (filters.nearAmenity?.length ?? 0) > 0
  );
}

export type VillaClassKey = keyof typeof VILLA_CLASSES;

export function getMatchedVillaClassKeys(
  villa: CommunityVilla,
  intel: VillaIntelligence | undefined,
): Set<VillaClassKey> {
  const matched = new Set<VillaClassKey>();

  if (matchesBacksPark(villa, intel)) matched.add('backs_park');
  if (matchesBacksRoad(villa, intel)) matched.add('backs_road');
  if (matchesOpenView(intel)) matched.add('open_view');
  if (matchesCorner(villa, intel)) matched.add('corner');
  if (matchesEndUnit(villa, intel)) matched.add('end_unit');
  if (matchesBackToBack(intel)) matched.add('back_to_back');
  if (matchesSingleRow(villa, intel)) matched.add('single_row');
  if (hasVastu(villa, intel)) matched.add('vastu');

  return matched;
}

export function matchesActiveVillaClassFilters(
  villa: CommunityVilla,
  intel: VillaIntelligence | undefined,
  filters: VillaSearchFilters | undefined,
): boolean {
  if (!filters || !hasActiveClassFilter(filters)) return true;

  const matched = getMatchedVillaClassKeys(villa, intel);

  if (filters.backsPark && matched.has('backs_park')) return true;
  if (filters.backsRoad && matched.has('backs_road')) return true;
  if (filters.backsOpenSpace && matched.has('open_view')) return true;
  if (filters.isCorner && matched.has('corner')) return true;
  if (filters.isEndUnit && matched.has('end_unit')) return true;
  if (filters.isBackToBack && matched.has('back_to_back')) return true;
  if (filters.isSingleRow && matched.has('single_row')) return true;
  if (filters.vastuCompliant && matched.has('vastu')) return true;

  return false;
}

export function resolveDisplayedVillaClass(
  villa: CommunityVilla,
  intel: VillaIntelligence | undefined,
  intelLoaded: boolean,
  filters: VillaSearchFilters | undefined,
): VillaClass | null {
  const primary = resolveVillaClass(villa, intel, intelLoaded);

  if (!filters || !hasActiveClassFilter(filters)) return primary;

  const matched = getMatchedVillaClassKeys(villa, intel);
  const matchedFilteredClass: VillaClass[] = [];

  if (filters.backsPark && matched.has('backs_park')) matchedFilteredClass.push(VILLA_CLASSES.backs_park);
  if (filters.backsRoad && matched.has('backs_road')) matchedFilteredClass.push(VILLA_CLASSES.backs_road);
  if (filters.backsOpenSpace && matched.has('open_view')) matchedFilteredClass.push(VILLA_CLASSES.open_view);
  if (filters.isCorner && matched.has('corner')) matchedFilteredClass.push(VILLA_CLASSES.corner);
  if (filters.isEndUnit && matched.has('end_unit')) matchedFilteredClass.push(VILLA_CLASSES.end_unit);
  if (filters.isBackToBack && matched.has('back_to_back')) matchedFilteredClass.push(VILLA_CLASSES.back_to_back);
  if (filters.isSingleRow && matched.has('single_row')) matchedFilteredClass.push(VILLA_CLASSES.single_row);
  if (filters.vastuCompliant && matched.has('vastu')) matchedFilteredClass.push(VILLA_CLASSES.vastu);

  if (matchedFilteredClass.length > 0) return matchedFilteredClass[0];

  const hasExplicitClassToggle = !!(
    filters.isCorner || filters.isEndUnit || filters.isBackToBack || filters.isSingleRow ||
    filters.backsPark || filters.backsRoad || filters.backsOpenSpace || filters.vastuCompliant
  );

  if (hasExplicitClassToggle) return null;

  return primary;
}