/**
 * Shared unit conversion constants and helpers.
 * Single source of truth — eliminates duplication across 6+ files.
 */

export const SQFT_TO_SQM = 0.092903;
export const SQM_TO_SQFT = 10.7639;

export const sqftToSqm  = (sqft: number): number => Math.round(sqft * SQFT_TO_SQM);
export const sqmToSqft  = (sqm: number): number  => Math.round(sqm  * SQM_TO_SQFT);
export const formatArea = (sqft: number, unit: 'sqft' | 'sqm'): string =>
  unit === 'sqm' ? `${sqftToSqm(sqft).toLocaleString()} m²` : `${sqft.toLocaleString()} sqft`;
