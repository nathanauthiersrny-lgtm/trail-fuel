import { cumulativeDistances } from '../../gpx/haversine';
import type { RawPoint } from '../../gpx/parse';
import { resampleAt100m } from '../../gpx/resample';

describe('resampleAt100m', () => {
  it('returns empty array on empty input', () => {
    expect(resampleAt100m([])).toEqual([]);
  });

  it('returns a single point unchanged', () => {
    const single: RawPoint[] = [{ lat: 45, lon: 6, ele: 1000 }];
    expect(resampleAt100m(single)).toEqual(single);
  });

  it('produces 11 evenly-spaced points on a ~1 km flat track', () => {
    const points: RawPoint[] = Array.from({ length: 11 }, (_, i) => ({
      lat: 45 + i * 0.0009,
      lon: 6,
      ele: 1000,
    }));
    const resampled = resampleAt100m(points);
    expect(resampled).toHaveLength(11);

    const cum = cumulativeDistances(resampled);
    for (let i = 0; i < cum.length; i += 1) {
      expect(cum[i]).toBeCloseTo(i * 100, 0);
    }
  });

  it('reduces a dense track (100 raw points over 1 km) to ~11 evenly-spaced points', () => {
    const dense: RawPoint[] = Array.from({ length: 101 }, (_, i) => ({
      lat: 45 + i * (0.009 / 100),
      lon: 6,
      ele: 1000,
    }));
    const resampled = resampleAt100m(dense);
    expect(resampled.length).toBeGreaterThanOrEqual(10);
    expect(resampled.length).toBeLessThanOrEqual(12);

    const cum = cumulativeDistances(resampled);
    for (let i = 1; i < cum.length; i += 1) {
      expect(cum[i] - cum[i - 1]).toBeCloseTo(100, 0);
    }
  });

  it('linearly interpolates elevation between sparse raw points', () => {
    // Two points 1000m apart with +500m of elevation
    const sparse: RawPoint[] = [
      { lat: 45, lon: 6, ele: 0 },
      { lat: 45.009, lon: 6, ele: 500 },
    ];
    const resampled = resampleAt100m(sparse);
    expect(resampled).toHaveLength(11);
    for (let i = 0; i < 11; i += 1) {
      expect(resampled[i].ele).toBeCloseTo(i * 50, 0);
    }
  });
});
