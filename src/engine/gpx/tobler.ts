const TOBLER_MAX_SLOPE_OFFSET = 0.05;
const TOBLER_DECAY = 3.5;
const TOBLER_BASE_KMH = 6;

export const SLOPE_BOUND = 0.4;

export function toblerSpeedKmh(slope: number): number {
  return TOBLER_BASE_KMH * Math.exp(-TOBLER_DECAY * Math.abs(slope + TOBLER_MAX_SLOPE_OFFSET));
}

export function calibratedSpeedKmh(
  slope: number,
  userFlatSpeedKmh: number,
  calibrationFactor: number,
): number {
  const ratio = toblerSpeedKmh(slope) / toblerSpeedKmh(0);
  return userFlatSpeedKmh * ratio * calibrationFactor;
}

export function clampSlope(slope: number): number {
  if (slope > SLOPE_BOUND) return SLOPE_BOUND;
  if (slope < -SLOPE_BOUND) return -SLOPE_BOUND;
  return slope;
}

export function paceMinPerKmToSpeedKmh(paceMinPerKm: number): number {
  return 60 / paceMinPerKm;
}
