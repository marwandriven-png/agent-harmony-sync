
Goal: fix the current `/plots` build breakage and complete the radius/class filtering cleanup so the map only shows plots inside the selected radius, class filters work on the same dataset as the sidebar, and marker rendering stays in sync.

What I found:
- The current errors are from a partial refactor, not one root bug.
- `VillaMapView.tsx` still contains stale references to removed GIS-layer logic (`gisLayerRef`, `renderedPlotIds`, `buildGisDiamond`, `hasActiveClassFilter`) while the component already has a newer unified marker path.
- `VillaRightPanel.tsx` is missing imports for:
  - `GISSearchResult`
  - `formatDistance`
- `PlotsPage.tsx` passes `onGoToPlotLocation`, but `VillaRightPanelProps` no longer defines that prop.
- The filtering pipeline in `PlotsPage.tsx` is close to correct already:
  - `radiusFilteredSearchableGISResults`
  - `radiusFilteredGisMatchedVillas`
  - `radiusFilteredAllVillas`
  - `displayedVillas`
  But it needs cleanup so only one final dataset drives both the sidebar and the map.

Implementation plan:

1. Fix the TypeScript build errors first
- In `VillaMapView.tsx`:
  - ensure `normalizePlotKey` stays imported
  - remove the leftover stale GIS marker effect/block that references:
    - `gisLayerRef`
    - `hasActiveClassFilter`
    - `renderedPlotIds`
    - `buildGisDiamond`
- In `VillaRightPanel.tsx`:
  - import `GISSearchResult` from `useVillaGISSearch`
  - import `formatDistance` from `@/lib/geo`
- In `PlotsPage.tsx`:
  - either remove `onGoToPlotLocation` from the component call, or restore it consistently in `VillaRightPanelProps` only if still used by UI
  - prefer removing it if there is no active control using it

2. Make one shared filtered dataset the source of truth
- Keep `displayedVillas` as the single final result set used by:
  - `VillaMapView`
  - `VillaRightPanel`
  - result count / listing count input
- Ensure this final set is built in this order:
  1. GIS results filtered by radius
  2. matched DB villas substituted by plot key where available
  3. remaining filtered DB villas added after that
  4. final dedupe by normalized plot key
- This preserves fallback pins while preventing duplicates.

3. Enforce radius filtering at one place only
- Keep `isVillaWithinSearchRadius` + `resolveVillaSearchCoordinates` as the only radius rule.
- Use plot-linked GIS coordinates first, villa lat/lng second.
- Remove any leftover ad hoc radius checks from the map rendering layer except display-only distance labels.
- Result: if an item appears in `displayedVillas`, it is inside radius; if not, it never renders.

4. Align class filters with rendered class logic
- Keep class filtering based on the same shared helpers:
  - `matchesOrDefersActiveVillaClassFilters`
  - `resolveDisplayedVillaClass`
- Since you asked to remove unreliable illustrated classes, keep only the supported illustrated set:
  - Back-to-Back
  - Backs Road
  - Single Row
  - End Unit
  - Vastu
  - neutral fallback pin for unclassified matches
- Ensure both sidebar badges and map pins use the same resolved class outcome.

5. Remove duplicate/legacy rendering branches
- In `VillaMapView.tsx`, keep only:
  - main villa marker layer
  - search radius layer
  - amenity layer
- Remove any second-pass GIS residual marker logic if it is still present.
- Marker overlap handling should stay, but only operate on the final `villas` prop.

6. Verify map/sidebar parity rules in code
- Every item in `displayedVillas` should produce exactly:
  - one sidebar card
  - one map marker
- Legend counts should be derived from `displayedVillas`, not from a broader source.
- No separate “hidden GIS results” set should exist after final merge.

7. Add/repair regression tests
- Update `src/test/propertyIntelligence.test.ts` to cover:
  - radius filtering excludes outside plots
  - radius filtering includes GIS-linked villas with plot-coordinate lookup
  - plot-key dedupe keeps one result per unique plot
  - class filters only return supported matching classes
  - fallback/unclassified results still render as neutral matches

Files to update:
- `src/pages/PlotsPage.tsx`
- `src/components/villas/VillaMapView.tsx`
- `src/components/villas/VillaRightPanel.tsx`
- `src/test/propertyIntelligence.test.ts`

Filtering pipeline after fix:
```text
GIS/raw inputs
  -> normalize coordinates
  -> radius filter
  -> merge DB villas + GIS-derived villas by plot key
  -> apply class / amenity / size filters
  -> final displayedVillas
       -> map markers
       -> sidebar cards
       -> result counts / legend
```

Expected outcome:
- build errors are resolved
- only plots inside the selected radius appear
- class filters affect both sidebar and map consistently
- unsupported classes no longer try to illustrate
- no duplicate markers
- map pins and result list stay 1:1
