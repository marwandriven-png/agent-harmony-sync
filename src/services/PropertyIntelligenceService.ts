/**
 * PropertyIntelligenceService — Re-exports from refactored modules.
 * This file maintained for backward compatibility.
 */

export {
  // Types
  type ProximityClass, type ProximityThresholds, type AmenityType, type DetectedAmenity,
  type LayoutType, type PositionType, type BackFacingType, type LayoutAnalysis,
  type VastuRating, type VastuAnalysis, type SmartTag, type PISearchFilters,
  // Constants
  DEFAULT_THRESHOLDS, AMENITY_CONFIG, AMENITY_ICONS, TAG_COLORS,
  // Classifiers
  classifyDistance, proximityLabel, proximityColor, proximityCssClass,
  classifyVastu, vastuRatingColor, vastuRatingHex, classifyLandUse,
  // Geometry
  Geo, type Polygon, type Edge,
  // NL Parser
  parseNaturalLanguageQuery, describeFilters,
  // Engine
  PropertyIntelligenceEngine, propertyIntelligence,
} from './property-intelligence';
