
Goal: fix the villa map so every searched residential result is illustrated on the map, counts match the results panel, B2B is no longer over-applied, and all mock community code is removed from the project.

Plan

1. Remove all mock community dependencies
- Delete the mock-community selector and all related state from `src/pages/PlotsPage.tsx`.
- Stop importing/merging any data from `src/data/mock/communities`.
- Remove the entire `src/data/mock/communities/` usage path from the app so classification relies only on real GIS/context data.
- Remove any leftover labels/comments/UI copy that mention mock communities.

2. Make the map render every matched result
- Refactor the `/plots` villa flow so the result source of truth is the GIS search result set, not only `mergedVillas`.
- Build a complete “display candidates” layer:
  - database villas matched by plot
  - synthetic GIS villas for residential/buildable plots without DB records
  - neutral fallback pins for matched residential plots that still have no resolved class
- Keep deduplication by plot key, but only for duplicate records representing the same plot; do not let deduplication reduce visible pin coverage.
- Ensure `matchedPlotIds`, `renderedPlotIds`, and results count are derived from the same normalized plot-key logic.

3. Tighten classification to match the illustrated community model
- Update shared classification in `src/services/property-intelligence/classify-class.ts` and `unit-reference.ts` so default visual class follows the illustrated row model:
  - rear-facing illustrated row classes first (`backs_park`, `backs_road`, `open_view`)
  - then `single_row`
  - positional overlays only when no row class exists
  - `back_to_back` only when the rear actually shares residential with no buffer
- Remove the current behavior where B2B visually dominates cases that should appear as single-row / backs-park / backs-road.
- Keep end-unit excluding corner, matching the recent refactor.

4. Fix engine-side B2B false positives
- Refine `src/services/property-intelligence/engine.ts` so B2B is assigned only from true rear-boundary adjacency, not general surrounding density or side-touch conditions.
- Make rear-side analysis stricter:
  - use resolved front bearing consistently
  - evaluate only rear edges for rear classification
  - treat any road/park/open separator on the rear as non-B2B
- Align centroid fallback with the same stricter rule so no loose heuristic reintroduces false B2B labels.

5. Unify results panel and map parity
- Update `src/pages/PlotsPage.tsx` + `src/components/villas/VillaRightPanel.tsx` so:
  - total results = all visible mapped villas + residual matched residential plots
  - map pin count and results count are guaranteed to match
  - unclassified residential matches use the neutral fallback pin you chose
  - zero-GFA / utility-only context plots stay excluded from both counts and visible search results
- Keep non-residential context plots available for intelligence context, but not counted as villa result pins.

6. Regression coverage
- Update/add tests in `src/test/propertyIntelligence.test.ts` to cover:
  - every matched plot produces exactly one visible plotted result
  - DB + synthetic villa records for the same plot collapse to one result without losing the pin
  - single-row with rear road/park/open buffer is never classified as B2B
  - class priority matches the illustrated community model
- Add a regression around plot-key normalization so rendered pin IDs and sidebar counts stay aligned.

7. Verify against the community reference HTML
- Use `tmp/community_unit_types-2.html` as the visual logic reference only for class hierarchy/illustration behavior.
- Match the implemented priority to that reference without depending on any mock dataset in runtime code.

Files most likely to change
- `src/pages/PlotsPage.tsx`
- `src/components/villas/VillaMapView.tsx`
- `src/components/villas/VillaRightPanel.tsx`
- `src/services/property-intelligence/classify-class.ts`
- `src/services/property-intelligence/unit-reference.ts`
- `src/services/property-intelligence/engine.ts`
- `src/test/propertyIntelligence.test.ts`

Technical notes
- Main bug today: `mergedVillas` is the map input, so only plots that successfully become villas survive into the primary marker layer. That is why you can get fewer pins than results.
- Secondary bug: mock-community context is still injected on `/plots`, which can distort classification and must be removed completely.
- Third bug: the current default resolver still lets B2B win too aggressively; that conflicts with the intended illustrated row logic and causes wrong labels.
