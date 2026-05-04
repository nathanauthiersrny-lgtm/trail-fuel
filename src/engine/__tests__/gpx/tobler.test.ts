import {
  calibratedSpeedKmh,
  clampSlope,
  paceMinPerKmToSpeedKmh,
  SLOPE_BOUND,
  toblerSpeedKmh,
} from '../../gpx/tobler';

describe('toblerSpeedKmh', () => {
  it('peaks at slope = -0.05 with exactly 6 km/h', () => {
    expect(toblerSpeedKmh(-0.05)).toBeCloseTo(6, 6);
  });

  it('returns ~5.04 km/h on flat ground', () => {
    expect(toblerSpeedKmh(0)).toBeCloseTo(5.0367, 3);
  });

  it('is symmetric around slope = -0.05', () => {
    for (const delta of [0.05, 0.1, 0.2, 0.3]) {
      expect(toblerSpeedKmh(-0.05 + delta)).toBeCloseTo(toblerSpeedKmh(-0.05 - delta), 6);
    }
  });

  it('decreases monotonically away from -0.05', () => {
    const peak = toblerSpeedKmh(-0.05);
    const slopes = [-0.4, -0.3, -0.2, -0.1, 0, 0.1, 0.2, 0.3, 0.4];
    for (const s of slopes) {
      if (s !== -0.05) expect(toblerSpeedKmh(s)).toBeLessThan(peak);
    }
  });
});

describe('calibratedSpeedKmh', () => {
  it('returns userFlatSpeedKmh exactly on flat with factor=1.0', () => {
    expect(calibratedSpeedKmh(0, 10, 1.0)).toBeCloseTo(10, 6);
  });

  it('scales linearly with calibrationFactor', () => {
    expect(calibratedSpeedKmh(0, 10, 0.9)).toBeCloseTo(9, 6);
    expect(calibratedSpeedKmh(0, 10, 1.1)).toBeCloseTo(11, 6);
  });

  it('preserves the Tobler ratio across slopes', () => {
    const userFlatSpeed = 10;
    const factor = 1.0;
    const ratioAt10pc = toblerSpeedKmh(0.10) / toblerSpeedKmh(0);
    expect(calibratedSpeedKmh(0.10, userFlatSpeed, factor)).toBeCloseTo(
      userFlatSpeed * ratioAt10pc,
      6,
    );
  });
});

describe('clampSlope', () => {
  it('clamps positive extreme to +SLOPE_BOUND', () => {
    expect(clampSlope(0.6)).toBe(SLOPE_BOUND);
  });

  it('clamps negative extreme to -SLOPE_BOUND', () => {
    expect(clampSlope(-0.6)).toBe(-SLOPE_BOUND);
  });

  it('passes through values within bounds', () => {
    expect(clampSlope(0)).toBe(0);
    expect(clampSlope(0.1)).toBe(0.1);
    expect(clampSlope(-0.1)).toBe(-0.1);
  });
});

describe('paceMinPerKmToSpeedKmh', () => {
  it('converts 6 min/km to 10 km/h', () => {
    expect(paceMinPerKmToSpeedKmh(6)).toBe(10);
  });

  it('converts 5 min/km to 12 km/h', () => {
    expect(paceMinPerKmToSpeedKmh(5)).toBe(12);
  });
});
