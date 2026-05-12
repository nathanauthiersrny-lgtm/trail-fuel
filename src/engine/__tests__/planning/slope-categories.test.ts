import { categorizeSlope, SLOPE_THRESHOLDS } from '../../planning/slope-categories';

describe('categorizeSlope', () => {
  it('returns descent_technical for slope strictly below -0.08', () => {
    expect(categorizeSlope(-0.09)).toBe('descent_technical');
    expect(categorizeSlope(-0.20)).toBe('descent_technical');
  });

  it('returns descent at the technical-descent boundary (slope = -0.08)', () => {
    expect(categorizeSlope(-0.08)).toBe('descent');
  });

  it('returns descent between -0.08 and -0.03', () => {
    expect(categorizeSlope(-0.05)).toBe('descent');
    expect(categorizeSlope(-0.04)).toBe('descent');
  });

  it('returns flat at the descent boundary (slope = -0.03)', () => {
    expect(categorizeSlope(-0.03)).toBe('flat');
  });

  it('returns flat between -0.03 and 0.03 inclusive', () => {
    expect(categorizeSlope(0)).toBe('flat');
    expect(categorizeSlope(0.02)).toBe('flat');
    expect(categorizeSlope(0.03)).toBe('flat');
  });

  it('returns climb between 0.03 and 0.10 inclusive', () => {
    expect(categorizeSlope(0.04)).toBe('climb');
    expect(categorizeSlope(0.07)).toBe('climb');
    expect(categorizeSlope(0.10)).toBe('climb');
  });

  it('returns climb_steep for slope strictly above 0.10', () => {
    expect(categorizeSlope(0.11)).toBe('climb_steep');
    expect(categorizeSlope(0.25)).toBe('climb_steep');
  });

  it('exposes the threshold constants', () => {
    expect(SLOPE_THRESHOLDS.technicalDescent).toBe(-0.08);
    expect(SLOPE_THRESHOLDS.descent).toBe(-0.03);
    expect(SLOPE_THRESHOLDS.flat).toBe(0.03);
    expect(SLOPE_THRESHOLDS.climbSteep).toBe(0.10);
  });
});
