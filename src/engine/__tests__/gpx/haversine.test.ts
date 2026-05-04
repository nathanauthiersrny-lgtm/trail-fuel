import { cumulativeDistances, haversineMeters } from '../../gpx/haversine';

describe('haversineMeters', () => {
  it('returns 0 for identical points', () => {
    expect(haversineMeters({ lat: 45, lon: 6 }, { lat: 45, lon: 6 })).toBeCloseTo(0, 3);
  });

  it('matches Paris-Lyon known distance (~392 km, ±2 km)', () => {
    const paris = { lat: 48.8566, lon: 2.3522 };
    const lyon = { lat: 45.7640, lon: 4.8357 };
    const km = haversineMeters(paris, lyon) / 1000;
    expect(km).toBeGreaterThan(390);
    expect(km).toBeLessThan(394);
  });

  it('1 degree of latitude at the equator is ~111 km', () => {
    const a = { lat: 0, lon: 0 };
    const b = { lat: 1, lon: 0 };
    const km = haversineMeters(a, b) / 1000;
    expect(km).toBeGreaterThan(110.5);
    expect(km).toBeLessThan(111.5);
  });

  it('is symmetric', () => {
    const a = { lat: 45, lon: 6 };
    const b = { lat: 46, lon: 7 };
    expect(haversineMeters(a, b)).toBeCloseTo(haversineMeters(b, a), 6);
  });
});

describe('cumulativeDistances', () => {
  it('returns empty array for empty input', () => {
    expect(cumulativeDistances([])).toEqual([]);
  });

  it('returns [0] for a single point', () => {
    expect(cumulativeDistances([{ lat: 45, lon: 6 }])).toEqual([0]);
  });

  it('accumulates monotonically along the flat-1km fixture geometry', () => {
    const points = Array.from({ length: 11 }, (_, i) => ({
      lat: 45 + i * 0.0009,
      lon: 6,
    }));
    const cum = cumulativeDistances(points);

    expect(cum).toHaveLength(11);
    expect(cum[0]).toBe(0);
    for (let i = 1; i < cum.length; i += 1) {
      expect(cum[i]).toBeGreaterThan(cum[i - 1]);
    }
    // Total ~1000m, ±5m tolerance
    expect(cum[10]).toBeGreaterThan(995);
    expect(cum[10]).toBeLessThan(1005);
  });
});
