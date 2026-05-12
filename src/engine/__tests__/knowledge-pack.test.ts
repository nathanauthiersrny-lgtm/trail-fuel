import { TEST_PACK } from './test-helpers/knowledge-pack';

describe('bundled knowledge pack v1', () => {
  it('has version 1.x.y (compatible with current SUPPORTED_PACK_MAJOR)', () => {
    expect(TEST_PACK.version).toMatch(/^1\.\d+\.\d+$/);
  });

  it('exposes all 5 session_defaults', () => {
    const sessions = Object.keys(TEST_PACK.session_defaults).sort();
    expect(sessions).toEqual(['competition', 'dur', 'long', 'plaisir', 'test']);
  });

  it('competition session uses tightened thresholds', () => {
    expect(TEST_PACK.session_defaults.competition.skip_alert_threshold).toBe(1);
    expect(TEST_PACK.session_defaults.competition.deficit_alert_pct).toBeCloseTo(0.20, 6);
  });

  it('preserves the historical defaults the engine was built around', () => {
    expect(TEST_PACK.param_defaults.first_intake_after_min).toBe(30);
    expect(TEST_PACK.param_defaults.intake_interval_min).toBe(20);
    expect(TEST_PACK.param_defaults.first_fluid_reminder_min).toBe(15);
    expect(TEST_PACK.param_defaults.fluid_reminder_interval_min).toBe(30);
    expect(TEST_PACK.first_hour.reduction_factor).toBeCloseTo(0.70, 6);
    expect(TEST_PACK.first_hour.duration_min).toBe(60);
    expect(TEST_PACK.feasibility_threshold).toBeCloseTo(0.85, 6);
  });

  it('has rate bounds that match the previous hardcoded floor/ceiling', () => {
    expect(TEST_PACK.rate_bounds.fluid_floor_ml).toBe(300);
    expect(TEST_PACK.rate_bounds.fluid_ceiling_ml).toBe(800);
    expect(TEST_PACK.rate_bounds.sodium_floor_mg).toBe(300);
    expect(TEST_PACK.rate_bounds.sodium_ceiling_mg).toBe(1000);
  });

  it('has aid station estimates that match the previous hardcoded constants', () => {
    expect(TEST_PACK.aid_station_estimates.carbs_per_solid_stop_g).toBe(30);
    expect(TEST_PACK.aid_station_estimates.carbs_per_isotonic_stop_g).toBe(30);
    expect(TEST_PACK.aid_station_estimates.fluid_per_water_stop_ml).toBe(500);
    expect(TEST_PACK.aid_station_estimates.fluid_per_isotonic_stop_ml).toBe(500);
  });
});
