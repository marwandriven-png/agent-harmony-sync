
Goal: fix the “Backs Park” class so the villas inside the marked area appear in match results only when their rear boundary truly faces a park, not just because a park is nearby.

What I found:
- The current filter/result pipeline on `/plots` is mostly wired correctly:
  - `applyVillaFilters()` uses `matchesOrDefersActiveVillaClassFilters()`
  - `resolveDisplayedVillaClass()` is shared between map pins and results
- The likely bug is in the spatial classifier, not the UI filter:
  - `engine.ts` marks `backsPark` using `_hasRearContextCandidate(...)`
  - that helper still relies heavily on the candidate centroid plus a broad polygon distance check
  - for irregular/large park polygons, a villa can be truly rear-facing while the centroid sits off-axis, so the class is missed
- Your clarification matters: Backs Park should mean `direct rear park only` — not “near park” and not “rear park across a buffer”.

Implementation plan:
1. Tighten the spatial rule for Backs Park in `src/services/property-intelligence/engine.ts`
   - Refactor `_hasRearContextCandidate()` so park classification is based on true rear-edge relationship to the park polygon, not centroid bias.
   - Require the park polygon itself to align behind at least one rear edge.
   - Remove/limit permissive fallback behavior that can miss or over-generalize elongated park shapes.
   - Keep landscape/open-space separate from park.

2. Preserve class parity between results and pins
   - Keep `resolveDisplayedVillaClass()` as the single display source of truth.
   - Verify that a villa with `layoutType: 'back_to_back'` or `single_row` can still resolve to `backs_park` when rear-facing park is confirmed, since facing and layout are independent dimensions.
   - Ensure no “No classes detected” case happens for true rear-park villas once intelligence is computed.

3. Add regression tests in `src/test/propertyIntelligence.test.ts`
   - Add a polygon test where:
     - the park is directly behind the villa and should classify as `backFacing: 'park'`
     - the park polygon is offset/elongated so centroid-only logic would fail
   - Add a negative test where a side park does not classify as Backs Park.
   - Add a resolver/filter parity test confirming Backs Park appears in class-filtered results.

4. Validate the `/plots` search flow after the patch
   - Confirm the red-circled villas are included when `Backs Park` is active.
   - Confirm landscape/open space does not leak into park results.
   - Confirm results count, sidebar matches, and map pins stay in sync.

Technical notes:
- Main files:
  - `src/services/property-intelligence/engine.ts`
  - `src/services/property-intelligence/unit-reference.ts` (verify only)
  - `src/services/property-intelligence/classify-class.ts` (verify priority only)
  - `src/pages/PlotsPage.tsx` (verify parity only)
  - `src/test/propertyIntelligence.test.ts`
- Intended behavior after fix:
  - direct rear park = `Backs Park`
  - side park = not `Backs Park`
  - nearby park only = not `Backs Park`
  - landscape = not `Backs Park`
