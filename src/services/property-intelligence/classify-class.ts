/**
 * Villa class resolver — pure function, no Leaflet/DOM dependencies.
 * Single source of truth used by both VillaMapView and VillaRightPanel.
 */

export interface VillaClass {
  key:    string;
  fill:   string;
  ring:   string;
  badge:  string;
  label:  string;
}

export const VILLA_CLASSES: Record<string, VillaClass> = {
  corner:       { key:'corner',       fill:'#3b82f6', ring:'#93c5fd', badge:'C',   label:'Corner'          },
  end_unit:     { key:'end_unit',     fill:'#7c3aed', ring:'#c4b5fd', badge:'EU',  label:'End Unit'        },
  single_row:   { key:'single_row',   fill:'#10b981', ring:'#6ee7b7', badge:'SR',  label:'Single Row'      },
  back_to_back: { key:'back_to_back', fill:'#ef4444', ring:'#fca5a5', badge:'B2B', label:'Back-to-Back'    },
  backs_park:   { key:'backs_park',   fill:'#059669', ring:'#a7f3d0', badge:'PK',  label:'Backs Park'      },
  backs_road:   { key:'backs_road',   fill:'#d97706', ring:'#fde68a', badge:'RD',  label:'Backs Road'      },
  open_view:    { key:'open_view',    fill:'#0284c7', ring:'#7dd3fc', badge:'OV',  label:'Open View'       },
  vastu:        { key:'vastu',        fill:'#db2777', ring:'#fbcfe8', badge:'V\u2713', label:'Vastu Compliant' },
};

export interface ClassifiableVilla {
  id: string;
  is_corner?: boolean;
  is_single_row?: boolean;
  backs_park?: boolean;
  backs_road?: boolean;
  vastu_compliant?: boolean | null;
}

export interface ClassifiableIntel {
  layout: {
    layoutType:   'back_to_back' | 'single_row' | 'unknown';
    positionType: 'corner' | 'end' | 'middle' | 'unknown';
    backFacing:   'park' | 'road' | 'open_space' | 'villa' | 'community_edge' | 'unknown';
  };
  tags: Array<{ label: string }>;
}

/**
 * Resolve the single primary classification for a villa.
 *
 * Priority (strict, no coexistence allowed):
 *  1. back_to_back  — highest, overrides everything
 *  2. single_row    — confirmed rear is non-residential
 *  3. corner / end  — positional
 *  4. backs_park / backs_road / open_view — single-row sub-classification
 *  5. vastu         — lowest non-default
 *  null             — no classification (no pin)
 */
export function resolveVillaClass(
  villa: ClassifiableVilla,
  intel: ClassifiableIntel | undefined,
  intelLoaded: boolean,
): VillaClass | null {
  const lt  = intel?.layout.layoutType;
  const pt  = intel?.layout.positionType;
  const bf  = intel?.layout.backFacing;
  const hasVastu = intel?.tags.some(t => t.label.includes('Vastu')) || !!villa.vastu_compliant;

  // Row-type illustration follows the community type reference:
  // specific rear condition (park/road/open) should illustrate before generic row layout.
  if (bf === 'park'        || villa.backs_park)    return VILLA_CLASSES.backs_park;
  if (bf === 'road'        || villa.backs_road)    return VILLA_CLASSES.backs_road;
  if (bf === 'open_space')                         return VILLA_CLASSES.open_view;
  if (lt === 'back_to_back')                       return VILLA_CLASSES.back_to_back;
  if (lt === 'single_row')                         return VILLA_CLASSES.single_row;

  // Positional (only when layout is not B2B/SR from intel)
  if (pt === 'corner'      || villa.is_corner)    return VILLA_CLASSES.corner;
  if (pt === 'end')                                return VILLA_CLASSES.end_unit;

  // DB flag fallback (when intel hasn't run yet for this villa)
  if (villa.is_single_row)                         return VILLA_CLASSES.single_row;

  if (hasVastu)                                    return VILLA_CLASSES.vastu;

  if (!intelLoaded) return null; // intel still processing
  return null;                   // loaded, no class → no pin
}
