export const SLOPE_THRESHOLDS = {
  technicalDescent: -0.08,
  descent: -0.03,
  flat: 0.03,
  climbSteep: 0.10,
} as const;

export type SlopeCategory =
  | 'descent_technical'
  | 'descent'
  | 'flat'
  | 'climb'
  | 'climb_steep';

export function categorizeSlope(slope: number): SlopeCategory {
  if (slope < SLOPE_THRESHOLDS.technicalDescent) return 'descent_technical';
  if (slope < SLOPE_THRESHOLDS.descent) return 'descent';
  if (slope <= SLOPE_THRESHOLDS.flat) return 'flat';
  if (slope <= SLOPE_THRESHOLDS.climbSteep) return 'climb';
  return 'climb_steep';
}
