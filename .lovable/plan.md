
Goal: make the bottom labels match the actual villa class names everywhere, so users see the same wording as the class system (for example `Backs Park` instead of `Park View`, and consistent Vastu naming).

Plan:
1. Audit the current class-label sources
   - Review the shared class definitions in `src/services/property-intelligence/classify-class.ts`
   - Review any secondary label maps/hardcoded strings in:
     - `src/components/villas/VillaRightPanel.tsx`
     - `src/components/villas/VillaMapView.tsx`
     - `src/components/villas/VillaDetailPanel.tsx`
     - `src/services/property-intelligence/unit-reference.ts`
   - Identify mismatches like:
     - `Park View` vs `Backs Park`
     - `Road Back` vs `Backs Road`
     - `Vastu` vs `Vastu Compliant`
     - `Backs park` casing mismatch

2. Unify naming under one source of truth
   - Reuse `VILLA_CLASSES` labels wherever the UI shows a class name
   - Replace hardcoded bottom filter-chip labels in `VillaRightPanel` with the same shared labels used by class resolution
   - Normalize any helper/reference labels in `unit-reference.ts` so the terminology is identical across filters, results, legend, and detail panel

3. Fix the bottom UI specifically
   - Update the “Active Filters” badges at the bottom of the right sidebar so they show the real class names:
     - `Backs Park`
     - `Backs Road`
     - `Open View`
     - `Vastu Compliant`
   - Ensure the selected class shown on result cards and map legend uses the same text as the active filter chips

4. Align tag/legend/detail naming
   - Update the detail/tag color map to use the same class names as the resolver
   - Remove outdated aliases like `Backs Open Land` if the visible class is `Open View`
   - Keep label casing and punctuation consistent everywhere

5. Validate class-to-label parity
   - Confirm that when a villa resolves to `backs_park`, every visible UI surface says `Backs Park`
   - Confirm that when Vastu is active, the UI says `Vastu Compliant`
   - Check that “No classes detected” only appears when there truly is no resolved class, not when labels are merely mismatched

Technical notes:
- Likely files to update:
  - `src/services/property-intelligence/classify-class.ts`
  - `src/services/property-intelligence/unit-reference.ts`
  - `src/components/villas/VillaRightPanel.tsx`
  - `src/components/villas/VillaDetailPanel.tsx`
  - possibly `src/components/villas/VillaMapView.tsx`
- Main issue found from the current code:
  - `VillaRightPanel` bottom active badges still use old names (`Park View`, `Road Back`, `Vastu`)
  - `unit-reference.ts` contains inconsistent casing (`Backs park`)
  - `VillaDetailPanel` still includes an outdated label alias (`Backs Open Land`)
- Desired outcome:
  - one shared naming system
  - bottom labels exactly match the resolved class labels
  - no more mismatch between filters, cards, legend, and detail tags
