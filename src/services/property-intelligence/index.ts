/**
 * Property Intelligence Service — Main entry point.
 * Re-exports all public APIs from the intelligence sub-modules.
 */

// Re-export types
export type {
  ProximityClass, ProximityThresholds, AmenityType, DetectedAmenity,
  LayoutType, PositionType, BackFacingType, LayoutAnalysis,
  VastuRating, VastuAnalysis, SmartTag, PISearchFilters,
} from './types';

export {
  DEFAULT_THRESHOLDS, AMENITY_CONFIG, AMENITY_ICONS,
  TAG_COLORS,
} from './types';

// Re-export classifiers
export {
  classifyDistance, proximityLabel, proximityColor, proximityCssClass,
  classifyVastu, vastuRatingColor, vastuRatingHex,
  classifyLandUse,
} from './classifiers';

// Re-export geometry
export { Geo } from './geometry';
export type { Polygon, Edge } from './geometry';

// Re-export NL parser
export { parseNaturalLanguageQuery, describeFilters } from './nl-parser';

// Re-export engine
export { PropertyIntelligenceEngine, propertyIntelligence } from './engine';
