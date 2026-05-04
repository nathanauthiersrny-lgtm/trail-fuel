import {
  CalibrationInputError,
  MAX_CALIBRATION_FACTOR,
  MIN_CALIBRATION_FACTOR,
  nextCalibrationFactor,
} from '../../gpx/calibration';

describe('nextCalibrationFactor', () => {
  it('keeps factor unchanged when real == predicted', () => {
    expect(
      nextCalibrationFactor({
        realDurationMin: 180,
        predictedDurationMin: 180,
        oldFactor: 1.0,
      }),
    ).toBeCloseTo(1.0, 6);
  });

  it('moves factor up by 30% of overshoot when real > predicted', () => {
    // ratio = 200/180 = 1.111...
    // newFactor = 1.0 × (0.7 + 0.3 × 1.111) ≈ 1.0333
    expect(
      nextCalibrationFactor({
        realDurationMin: 200,
        predictedDurationMin: 180,
        oldFactor: 1.0,
      }),
    ).toBeCloseTo(0.7 + 0.3 * (200 / 180), 6);
  });

  it('moves factor down by 30% of undershoot when real < predicted', () => {
    expect(
      nextCalibrationFactor({
        realDurationMin: 150,
        predictedDurationMin: 180,
        oldFactor: 1.0,
      }),
    ).toBeCloseTo(0.7 + 0.3 * (150 / 180), 6);
  });

  it('is a fixed point when ratio = 1 (factor does not drift on accurate predictions)', () => {
    const result = nextCalibrationFactor({
      realDurationMin: 200,
      predictedDurationMin: 200,
      oldFactor: 1.234,
    });
    expect(result).toBeCloseTo(1.234, 6);
  });

  it('respects 70/30 weighting bound', () => {
    // For any ratio, newFactor must be in [oldFactor × 0.7, oldFactor × (0.7 + 0.3 × ratio)]
    const result = nextCalibrationFactor({
      realDurationMin: 240,
      predictedDurationMin: 60,
      oldFactor: 1.0,
    });
    // Even with 4x ratio, weighting tempers the swing.
    // Raw = 1.0 × (0.7 + 0.3 × 4) = 1.9, within [0.5, 2.0] clamp.
    expect(result).toBe(1.9);
  });

  it('clamps the result to MAX_CALIBRATION_FACTOR (2.0)', () => {
    // Raw = 1.0 × (0.7 + 0.3 × 5) = 2.2, clamped to 2.0
    const result = nextCalibrationFactor({
      realDurationMin: 300,
      predictedDurationMin: 60,
      oldFactor: 1.0,
    });
    expect(result).toBe(MAX_CALIBRATION_FACTOR);
  });

  it('clamps the result to MIN_CALIBRATION_FACTOR (0.5)', () => {
    // Raw = 0.6 × (0.7 + 0.3 × 0.1) = 0.6 × 0.73 = 0.438, clamped to 0.5
    const result = nextCalibrationFactor({
      realDurationMin: 6,
      predictedDurationMin: 60,
      oldFactor: 0.6,
    });
    expect(result).toBe(MIN_CALIBRATION_FACTOR);
  });

  it('keeps factor at 2.0 when already at the ceiling and ratio = 2', () => {
    // Raw = 2.0 × (0.7 + 0.3 × 2) = 2.0 × 1.3 = 2.6, clamped to 2.0
    const result = nextCalibrationFactor({
      realDurationMin: 360,
      predictedDurationMin: 180,
      oldFactor: 2.0,
    });
    expect(result).toBe(MAX_CALIBRATION_FACTOR);
  });

  it('keeps factor at 0.5 when already at the floor and ratio = 0.5', () => {
    // Raw = 0.5 × (0.7 + 0.3 × 0.5) = 0.5 × 0.85 = 0.425, clamped to 0.5
    const result = nextCalibrationFactor({
      realDurationMin: 90,
      predictedDurationMin: 180,
      oldFactor: 0.5,
    });
    expect(result).toBe(MIN_CALIBRATION_FACTOR);
  });

  it('exposes MIN/MAX constants at 0.5 and 2.0', () => {
    expect(MIN_CALIBRATION_FACTOR).toBe(0.5);
    expect(MAX_CALIBRATION_FACTOR).toBe(2.0);
  });

  it('throws on zero or negative inputs', () => {
    expect(() =>
      nextCalibrationFactor({ realDurationMin: 0, predictedDurationMin: 180, oldFactor: 1 }),
    ).toThrow(CalibrationInputError);
    expect(() =>
      nextCalibrationFactor({ realDurationMin: 180, predictedDurationMin: 0, oldFactor: 1 }),
    ).toThrow(CalibrationInputError);
    expect(() =>
      nextCalibrationFactor({ realDurationMin: 180, predictedDurationMin: 180, oldFactor: 0 }),
    ).toThrow(CalibrationInputError);
  });
});
