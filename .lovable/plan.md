

# Villa Intelligence System Refactor & Enhancement Plan

## Current State Analysis

The project has **two parallel intelligence systems**:

1. **Existing (in-project)**: A modular `property-intelligence/` service layer with separate `engine.ts`, `geometry.ts`, `classifiers.ts`, `types.ts`, and `nl-parser.ts` — integrated into `PlotsPage.tsx` via the `usePropertyIntelligence` hook and `useVillas` DB hook. This system works with Supabase-backed `community_villas` data and GIS plot data.

2. **Uploaded (standalone HyperPlot)**: A monolithic `VillaIntelligenceEngine.ts` (657 lines) with its own geometry, classification, NL search, and community amenity registry — designed for a standalone `HyperPlotAI` component that references ~15 missing sub-components and services (`SheetSyncService`, `LastSeenService`, `ManualLandForm`, `LeafletMap`, etc.).

The uploaded code cannot be dropped in as-is — it depends on services and components that don't exist in the project. However, it contains valuable improvements over the current engine that should be extracted and merged.

---

## What the Uploaded Engine Does Better

- **Unified `VillaIntelligenceEngine` class** with built-in caching, `analyzeAll()` batch method, and `clearCache()` for invalidation
- **Stronger entrance direction inference** — infers from nearest road polygon when not explicitly set
- **Integrated amenity registry** per community (AR3, Meadows, Mudon, DAMAC Hills) with GPS-accurate positions
- **Composite scoring system** (layout + position + back-facing + vastu + amenity proximity = weighted score)
- **`applyVillaFilters()` function** with NL query merging and score-ranked results
- **`plotsToVillaInputs()` adapter** for bridging GIS `PlotData` to engine inputs
- **`SearchFilters` component** with pill-based Villa Intel filter panel (layout, position, back-facing, vastu direction, amenity proximity with distance slider)

---

## Implementation Plan

### Step 1: Merge VillaIntelligenceEngine scoring into existing engine

Enhance `src/services/property-intelligence/engine.ts`:
- Add a **composite scoring method** (`computeScore`) using the uploaded engine's weighted formula (layout: 18, corner: 14, end: 7, park-backing: 12, vastu: 4x, amenity proximity bonuses)
- Add a **batch `analyzeAll()` method** with internal caching (Map) so repeated calls are O(1)
- Add **entrance direction inference** from nearest road when `facingDirection` is null — port the `inferEntranceDirection()` logic
- Add a `clearCache()` method for invalidation when data changes

### Step 2: Add community amenity registry

Create `src/services/property-intelligence/amenity-registry.ts`:
- Port the `COMMUNITY_AMENITIES` data (AR3, Meadows, Mudon, DAMAC Hills, default fallback) from the uploaded engine
- Port `resolveAmenities()` function that picks the closest community set by centroid distance
- Integrate with the existing `detectAmenities()` method as a secondary amenity source when GIS plots lack amenity-typed features

### Step 3: Enhance NL parser with uploaded keywords

Update `src/services/property-intelligence/nl-parser.ts`:
- Add missing amenity keywords from uploaded engine: `swimming→pool`, `garden→park`, `green→park`, `kids→playground`, `shop→mall`, `club→clubhouse`, `golf`, `spa`, `gym`, `clinic`
- Add distance override parsing: `"within 100m"` / `"under 200m"` → `maxDistance`
- Add vastu direction detection: `"east facing"` → `vastuDirection: 'E'`

### Step 4: Add score-ranked filter function

Create `src/services/property-intelligence/filter.ts`:
- Port `applyVillaFilters()` with score-ranked results
- Merge NL query parsing into structured filters (explicit keys override NL)
- Return `{ villa, intel, score }[]` sorted by composite score

### Step 5: Refactor `usePropertyIntelligence` hook

Update `src/hooks/usePropertyIntelligence.ts`:
- Expose `score` per villa in the intelligence map
- Add `analyzeAll()` usage with caching instead of per-villa processing in chunks
- Integrate community amenity registry as fallback amenity source
- Export the `allAmenities` aggregation with deduplication

### Step 6: Update PlotsPage villa filtering

Update `src/pages/PlotsPage.tsx`:
- Replace inline `applyVillaFilters` callback with the new score-ranked filter function
- Use composite scores for result ordering
- Ensure all filter combinations (layout + position + back-facing + vastu + amenity proximity) work together without conflict

### Step 7: Clean up dead code

- Remove the stub `src/components/HyperPlot/DCShareModal.tsx`
- Remove the stub `src/hooks/useMarketDataFromDB.ts`
- Remove duplicate type definitions across files (unify on `property-intelligence/types.ts`)
- Remove `PropertyIntelligenceService.ts` barrel file if all consumers can import from `property-intelligence/` directly

---

## Technical Details

**Files created:**
- `src/services/property-intelligence/amenity-registry.ts` — community amenity GPS data + resolver
- `src/services/property-intelligence/filter.ts` — score-ranked villa filter function

**Files modified:**
- `src/services/property-intelligence/engine.ts` — scoring, caching, entrance inference, batch analysis
- `src/services/property-intelligence/nl-parser.ts` — expanded keyword set, distance/vastu parsing
- `src/services/property-intelligence/types.ts` — add `score` field to relevant interfaces
- `src/hooks/usePropertyIntelligence.ts` — use batch analysis, expose scores
- `src/pages/PlotsPage.tsx` — use new filter function, score-based ordering

**Files deleted:**
- `src/components/HyperPlot/DCShareModal.tsx` (stub)
- `src/hooks/useMarketDataFromDB.ts` (stub)

**No database changes required** — all enhancements are client-side computation.

