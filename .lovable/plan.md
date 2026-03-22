
Goal: fix `/plots` so every in-radius result is visible on the map, and make `Backs Park`, `Back-to-Back`, and `Corner Unit` filters classify and return the correct villas.

What I found:
- Do I know what the issue is? Yes — it looks like 2 separate bugs:
  1. Map/result parity bug: the page builds pins from multiple sources (`displayedVillas`, residual GIS pins, matched plot IDs), so some in-radius plots are dropped or hidden.
  2. Classification bug: the spatial engine is collapsing too many villas into `End Unit`, so `Backs Park`, `Back-to-Back`, and `Corner` rarely survive into filters/results.
- The screenshot confirms this: the legend shows `End Unit (24)` while the community layout should contain mixed classes.
- The current class filter behavior already matches your preference (`Any selected class`), so the issue is not the filter operator — it is bad upstream classification plus inconsistent map rendering.
- The current fallback-pin behavior is split across two layers:
  - classified villas render in `VillaMapView`
  - leftover GIS plots render as orange diamonds
  This is likely why “not all pins in radius” happens.

Implementation plan:
1. Unify the map/result source of truth
   - Refactor the `/plots` pipeline so one radius-filtered, plot-key-deduped dataset drives:
     - result count
     - sidebar results
     - map pins
   - Stop relying on separate “classified villa layer + residual GIS layer” logic for parity.
   - Ensure every in-radius searchable plot produces exactly one marker:
     - classified villa pin if a class is resolved
     - neutral fallback pin if it is still unclassified

2. Fix map pin visibility/parity
   - Update `PlotsPage.tsx` and `VillaMapView.tsx` so:
     - no in-radius result is silently skipped because it already exists in another set
     - deduping happens by normalized plot key, not by whichever array happened to render first
     - fallback pins remain visible for unclassified plots, per your preference
   - Keep multi-pin offsetting for same coordinates so overlapping units are still visible.

3. Repair class inference in the spatial engine
   - Re-audit `engine.ts` for the three failing classes:
     - `Backs Park`: rear exposure to real park polygon
     - `Back-to-Back`: true rear residential adjacency only
     - `Corner`: two meaningful road-exposed sides
   - Tighten the end-unit fallback so plots are not incorrectly defaulting to `end`.
   - Re-check front/rear orientation inference so side roads do not overpower the true community geometry.

4. Keep filter behavior aligned with your confirmed rules
   - Preserve `Any selected class` matching for combined class toggles.
   - Make sure a villa can still match a specific environmental class even if it also has another layout/position attribute.
   - Keep `Vastu` independent from the primary visual class.

5. Add regression coverage
   - Add tests for:
     - all in-radius searchable plots producing one marker/result entry
     - park-ring / internal-park `Backs Park`
     - true rear row `Back-to-Back`
     - genuine two-road `Corner`
     - “not corner / not B2B / not Backs Park” negatives
   - Add a parity test so map pins and sidebar counts stay 1:1.

Files to update:
- `src/pages/PlotsPage.tsx`
- `src/components/villas/VillaMapView.tsx`
- `src/components/villas/VillaRightPanel.tsx` (results/count parity if needed)
- `src/services/property-intelligence/engine.ts`
- `src/services/property-intelligence/unit-reference.ts`
- `src/test/propertyIntelligence.test.ts`

Expected outcome:
- all searchable plots inside the selected radius appear on the map
- unclassified in-radius plots still show with a neutral fallback pin
- `Backs Park`, `Back-to-Back`, and `Corner Unit` return real matches again
- map pins, legend, and sidebar result count stay in sync
