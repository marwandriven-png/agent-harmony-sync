import { describe, it, expect } from 'vitest';
import { parseTextFile } from '../LandMatchingService';

describe('parseTextFile', () => {
  it('returns array of ParcelInput objects', () => {
    const result = parseTextFile('area: Arabian Ranches\nplotArea: 800 sqm\ngfa: 1200 sqm\n');
    expect(Array.isArray(result)).toBe(true);
    expect(result[0].area).toBe('Arabian Ranches');
    expect(result[0].plotArea).toBe(800);
    expect(result[0].gfa).toBe(1200);
  });
  it('parses multiple --- blocks', () => {
    const input = ['area: Block A\nplotArea: 500 sqm', 'area: Block B\nplotArea: 600 sqm'].join('\n---\n');
    expect(parseTextFile(input)).toHaveLength(2);
  });
  it('parses plotNumber field', () => {
    expect(parseTextFile('plotNumber: 3730170\nplotArea: 500 sqm\n')[0].plotNumber).toBe('3730170');
  });
  it('converts sqft to sqm', () => {
    const r = parseTextFile('plotArea: 1000 sqft\n')[0];
    expect(r.plotAreaSqm).toBeGreaterThan(90);
    expect(r.plotAreaSqm).toBeLessThan(95);
  });
  it('defaults missing fields to 0', () => {
    const r = parseTextFile('area: Test\n')[0];
    expect(r.plotArea).toBe(0);
    expect(r.gfa).toBe(0);
  });
  it('returns [] for empty input', () => {
    expect(parseTextFile('')).toEqual([]);
  });
  it('caches identical content', () => {
    const input = 'area: Cached\nplotArea: 300 sqm\n';
    expect(parseTextFile(input)).toBe(parseTextFile(input));
  });
  it('performance: 5000 blocks under 500ms', () => {
    const blocks = Array.from({ length: 5000 }, (_, i) =>
      `plotNumber: P-${i}\nplotArea: ${300 + i} sqm\n`
    ).join('\n---\n');
    const t0 = performance.now();
    const r = parseTextFile(blocks);
    expect(r).toHaveLength(5000);
    expect(performance.now() - t0).toBeLessThan(500);
  });
});
