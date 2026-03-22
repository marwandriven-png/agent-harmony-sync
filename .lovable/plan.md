
Goal: make the yellow-circled villas classify and appear under `Backs Park` when their rear boundary directly faces the red park polygon.

What I found:
- The label mismatch is already addressed; this is now a classification/mapping problem.
- `Backs Park` filtering ultimately depends on `intel.layout.backFacing === 'park'` in `src/services/property-intelligence/unit-reference.ts`.
- So if those villas are missing, the real failure is upstream in `src/services/property-intelligence/engine.ts`, where the rear-facing class is inferred.
- The screenshot symptom (`Backs Park` toggle on, `0 results`, some pins still showing `No classes detected`) strongly suggests the villas are being found, but their rear-facing class is resolving to the wrong side or to no class at all.

Implementation plan:
1. Fix rear-side inference for park-ring villas
   - Refine `_resolveFrontBearing()` / `_backEdges()` so villas around an inner park do not pick a side road as the “front” and accidentally classify the wrong edge as rear.
   - Prefer the true road-facing frontage when multiple nearby roads exist, instead of relying on a weak nearest-edge fallback.

2. Relax the right part of park detection, not the wrong part
   - Update `_hasDirectRearPolygonExposure()` so it recognizes direct rear park contact when the park only overlaps part of the rear edge or has an irregular/curved boundary.
   - Keep the strict “direct rear park only” rule:
     - direct rear park = `Backs Park`
     - road/open-space/residential separator = not `Backs Park`
     - side park = not `Backs Park`

3. Keep filter/map/result parity intact
   - Continue using `resolveDisplayedVillaClass()` as the shared source for pins and results.
   - Ensure villas that truly resolve to rear park are no longer falling through to neutral/no-class display when the `Backs Park` filter is active.

4. Add targeted regression coverage
   - Add a test that models the screenshot case: a row of villas wrapping an internal park, where the villas’ rear edges touch the park and must classify as `park`.
   - Add a test where a side road is closer than the real frontage, to ensure front/rear inference still selects the correct rear edge.
   - Keep negative tests for road-buffer, open-space buffer, and side-park false positives.

Files to update:
- `src/services/property-intelligence/engine.ts`
- `src/test/propertyIntelligence.test.ts`

Expected outcome after the fix:
- the yellow-circled plots classify under `Backs Park`
- the red area remains the park context only, not a villa result
- `Backs Park` filter returns those villas instead of `0 results`
- selected villas stop showing `No classes detected` when they truly back onto the park
