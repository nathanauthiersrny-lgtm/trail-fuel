import { smoothElevations } from '../../gpx/smooth';

describe('smoothElevations', () => {
  it('returns empty array on empty input', () => {
    expect(smoothElevations([])).toEqual([]);
  });

  it('preserves a constant signal', () => {
    expect(smoothElevations([100, 100, 100, 100, 100])).toEqual([100, 100, 100, 100, 100]);
  });

  it('flattens a single spike (window=5)', () => {
    const raw = [100, 100, 200, 100, 100, 100, 100];
    const smooth = smoothElevations(raw, 5);
    // Centered window at index 2 covers indices 0..4: avg = (100+100+200+100+100)/5 = 120
    expect(smooth[2]).toBeCloseTo(120, 6);
    // Far from spike: should remain 100
    expect(smooth[6]).toBeCloseTo(100, 6);
  });

  it('reduces sawtooth amplitude', () => {
    const raw = [0, 100, 0, 100, 0, 100, 0, 100, 0, 100];
    const smooth = smoothElevations(raw, 5);
    // Each smoothed value should be near 50 (the average), with some boundary variation
    const interior = smooth.slice(2, -2);
    for (const v of interior) {
      expect(v).toBeGreaterThan(35);
      expect(v).toBeLessThan(65);
    }
    // The original max (100) and min (0) should be reduced
    expect(Math.max(...interior)).toBeLessThan(70);
    expect(Math.min(...interior)).toBeGreaterThan(30);
  });

  it('handles asymmetric window at edges (start)', () => {
    // window=5, at index 0 only [0, 1, 2] are available → avg of these 3
    const raw = [0, 10, 20, 30, 40, 50, 60];
    const smooth = smoothElevations(raw, 5);
    expect(smooth[0]).toBeCloseTo((0 + 10 + 20) / 3, 6);
    expect(smooth[1]).toBeCloseTo((0 + 10 + 20 + 30) / 4, 6);
  });

  it('returns identity when window <= 1', () => {
    const raw = [1, 2, 3];
    expect(smoothElevations(raw, 1)).toEqual([1, 2, 3]);
    expect(smoothElevations(raw, 0)).toEqual([1, 2, 3]);
  });
});
