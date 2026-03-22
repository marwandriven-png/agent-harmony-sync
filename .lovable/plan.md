
Goal: fix the wrong villa classes on `/plots`, make map/list/filter behavior use the same class logic, and remove mock/demo access from the whole project.

What I found
- The current `/plots` pipeline is not failing in one place; it has 3 separate mismatches:
  1. `engine.ts` still over-labels `back_to_back` because rear-neighbour detection is too loose.
  2. Filters in `PlotsPage.tsx` use raw helpers like `matchesBackToBack()` instead of the shared displayed-class resolver, so a plot can be visually “Backs Park / Backs Road” but still be filtered/count as B2B.
  3. Geometry adjacency is too permissive: `Geo.sharesBoundary()` treats point/corner touches like a shared rear wall, which is a major source of false B2B and wrong end-unit results.
- The screenshot matches that: many units that should be “single row + backs road” or “single row end unit” are currently classified/counting as B2B.
- There is still project-wide mock/demo code outside `/plots` (`src/store/crmStore.ts`, demo naming in GIS/test data, etc.), so “remove from all project” is broader than the villa module.

Implementation plan

1. Fix the actual classification bug at the geometry level
- Tighten boundary logic in `src/services/property-intelligence/geometry.ts` so corner-only contact does not count as a shared boundary.
- Add a stricter “shared wall overlap” check for residential rear adjacency and use that for B2B detection.
- Keep point/near-distance checks only as fallback, not as proof of a rear shared wall.

2. Tighten engine-side front/rear detection
- Refine `src/services/property-intelligence/engine.ts` so front bearing is resolved from the true road-facing side first.
- Only classify B2B when:
  - the rear side is confidently identified,
  - the rear side shares meaningful wall overlap with residential,
  - and there is no rear road/park/open-space separator.
- Make polygon and centroid fallback agree on the same stricter rule.

3. Make filters and counts use the same class source of truth
- Refactor `src/pages/PlotsPage.tsx` to stop using raw `matchesBackToBack / matchesSingleRow / matchesEndUnit` as the main class-filter truth.
- Use the shared displayed-class resolver from `unit-reference.ts` for:
  - filtering,
  - result counting,
  - matched plot IDs,
  - rendered plot IDs.
- This will make B2B filter return only true B2B display-class results, not plots whose raw layout says B2B but should illustrate as PK/RD/SR.

4. Align map pins, legend, and right-panel cards
- Update `src/components/villas/VillaMapView.tsx` and `src/components/villas/VillaRightPanel.tsx` so:
  - primary class badge = shared displayed class,
  - legend counts = same resolver,
  - result cards = same resolver,
  - neutral pins remain only for truly unclassified matched results.
- Keep secondary tags optional, but do not let them override the primary displayed class.

5. Re-check class hierarchy against your illustration
- Keep the visual priority strict:
  - `backs_park / backs_road / open_view`
  - then `single_row`
  - then `back_to_back`
  - then `corner / end_unit`
  - then `vastu`
- Also preserve “end unit excludes corner”.

6. Remove mock/demo access from the whole project
- Audit and remove runtime mock/demo sources across the app, starting with:
  - `src/store/crmStore.ts`
  - any remaining demo/mock helpers in GIS/property services
  - demo terminology that appears in runtime code paths
- Replace with empty states or real backend-driven defaults so no section depends on fabricated data.
- Keep tests using synthetic fixtures if needed, but rename/remove “demo” runtime semantics so the shipped app has no mock access path.

7. Add regression coverage for the exact bugs shown
- Extend `src/test/propertyIntelligence.test.ts` to cover:
  - corner-touch must not count as B2B,
  - rear road separator keeps a unit single-row,
  - displayed class and filter class are identical,
  - one plot key = one result card + one rendered pin,
  - end-unit/corner cases from the illustrated pattern.
- Add a test around the shared resolver so future edits cannot reintroduce B2B overreach.

Files most likely to change
- `src/services/property-intelligence/geometry.ts`
- `src/services/property-intelligence/engine.ts`
- `src/services/property-intelligence/classify-class.ts`
- `src/services/property-intelligence/unit-reference.ts`
- `src/pages/PlotsPage.tsx`
- `src/components/villas/VillaMapView.tsx`
- `src/components/villas/VillaRightPanel.tsx`
- `src/store/crmStore.ts`
- `src/test/propertyIntelligence.test.ts`

Expected outcome
- Units like the ones in your screenshot stop collapsing into B2B.
- “single row + backs road”, “single row end unit”, and park-backed rows render with the correct primary class.
- Filters, sidebar totals, legend totals, and map pins all agree.
- Mock/demo runtime data is removed project-wide.
