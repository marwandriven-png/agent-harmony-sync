/**
 * LandMatchingService — Unit Tests
 * Fixed: parseTextFile returns ParcelInput[] not string[]; bench() removed
 */
import { describe, it, expect } from 'vitest';
import { parseTextFile } from '../LandMatchingService';

// parseTextFile parses "---"-delimited blocks with "key: value" lines
// Returns ParcelInput[] with fields: area, plotArea, plotAreaUnit, gfa, gfaUnit,
//   zoning, use, heightFloors, far, plotNumber, plotAreaSqm, gfaSqm

describe('parseTextFile', () => {
  it('returns an array', () => {
    const result = parseTextFile('area: Dubai\nplotArea: 500 sqm\n');
    expect(Array.isArray(result)).toBe(true);
  });

  it('parses a single block with plot area', () => {
    const input = 'area: Arabian Ranches\nplotArea: 800 sqm\ngfa: 1200 sqm\nzoning: Residential Villa\n';
    const result = parseTextFile(input);
    expect(result).toHaveLength(1);
    expect(result[0].area).toBe('Arabian Ranches');
    expect(result[0].plotArea).toBe(800);
    expect(result[0].gfa).toBe(1200);
    expect(result[0].zoning).toBe('Residential Villa');
  });

  it('parses multiple ---delimited blocks', () => {
    const input = [
      'area: Block A\nplotArea: 500 sqm',
      'area: Block B\nplotArea: 600 sqm',
      'area: Block C\nplotArea: 700 sqm',
    ].join('\n---\n');
    const result = parseTextFile(input);
    expect(result).toHaveLength(3);
    expect(result[0].area).toBe('Block A');
    expect(result[1].area).toBe('Block B');
    expect(result[2].area).toBe('Block C');
  });

  it('parses plotNumber field', () => {
    const input = 'plotNumber: 3730170\nplotArea: 500 sqm\n';
    const result = parseTextFile(input);
    expect(result[0].plotNumber).toBe('3730170');
  });

  it('handles sqft unit conversion', () => {
    // 1 sqft = 0.0929 sqm; 1000 sqft ≈ 92.9 sqm
    const input = 'plotArea: 1000 sqft\n';
    const result = parseTextFile(input);
    expect(result[0].plotAreaSqm).toBeGreaterThan(90);
    expect(result[0].plotAreaSqm).toBeLessThan(95);
    expect(result[0].plotAreaUnit).toBe('sqft');
  });

  it('defaults missing numeric fields to 0', () => {
    const input = 'area: Test\n';
    const result = parseTextFile(input);
    expect(result[0].plotArea).toBe(0);
    expect(result[0].gfa).toBe(0);
    expect(result[0].heightFloors).toBe(0);
    expect(result[0].far).toBe(0);
  });

  it('returns empty array for empty input', () => {
    expect(parseTextFile('')).toEqual([]);
  });

  it('returns empty array for whitespace-only input', () => {
    expect(parseTextFile('   \n\n   ')).toEqual([]);
  });

  it('skips blocks without colon-separated fields', () => {
    const input = 'just some text without colons';
    const result = parseTextFile(input);
    // Parsed but fields will be empty/default
    expect(Array.isArray(result)).toBe(true);
  });

  it('caches identical content (returns same reference)', () => {
    const input = 'area: Cached Test\nplotArea: 300 sqm\n';
    const first = parseTextFile(input);
    const second = parseTextFile(input);
    expect(first).toBe(second); // same array reference from cache
  });

  it('handles floors/FAR fields', () => {
    const input = 'area: Commercial\nplots: G+2\nheightFloors: 3\nfar: 2.5\n';
    const result = parseTextFile(input);
    expect(result[0].heightFloors).toBe(3);
    expect(result[0].far).toBe(2.5);
  });

  it('performance: 5000 blocks under 500ms', () => {
    const blocks = Array.from({ length: 5000 }, (_, i) =>
      `plotNumber: PLOT-${i}\nplotArea: ${300 + i} sqm\narea: Community ${i % 10}\n`
    ).join('\n---\n');
    const start = performance.now();
    const result = parseTextFile(blocks);
    const elapsed = performance.now() - start;
    expect(result).toHaveLength(5000);
    expect(elapsed).toBeLessThan(500);
  });
});
