const OLD_FACTOR_WEIGHT = 0.7;
const NEW_FACTOR_WEIGHT = 0.3;

export const MIN_CALIBRATION_FACTOR = 0.5;
export const MAX_CALIBRATION_FACTOR = 2.0;

export class CalibrationInputError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CalibrationInputError';
  }
}

export function nextCalibrationFactor(input: {
  realDurationMin: number;
  predictedDurationMin: number;
  oldFactor: number;
}): number {
  const { realDurationMin, predictedDurationMin, oldFactor } = input;

  if (predictedDurationMin <= 0) {
    throw new CalibrationInputError('predictedDurationMin must be > 0');
  }
  if (realDurationMin <= 0) {
    throw new CalibrationInputError('realDurationMin must be > 0');
  }
  if (oldFactor <= 0) {
    throw new CalibrationInputError('oldFactor must be > 0');
  }

  const ratio = realDurationMin / predictedDurationMin;
  const raw = oldFactor * (OLD_FACTOR_WEIGHT + NEW_FACTOR_WEIGHT * ratio);
  return Math.max(MIN_CALIBRATION_FACTOR, Math.min(MAX_CALIBRATION_FACTOR, raw));
}
