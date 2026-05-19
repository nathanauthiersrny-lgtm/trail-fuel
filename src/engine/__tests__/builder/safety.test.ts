import type { TimelinePlan } from '../../../models/timeline-plan';
import { TIMELINE_PLAN_VERSION } from '../../../models/timeline-plan';
import { validatePlan } from '../../builder/safety';

function makePlan(overrides: Partial<TimelinePlan> = {}): TimelinePlan {
  return {
    version: TIMELINE_PLAN_VERSION,
    race_id: 'r',
    generated_at: '2026-01-01T00:00:00Z',
    generator: { llm_enrichment_applied: false, engine_version: 'test' },
    race_targets: {
      carbs_per_hour_g: { default: 60 },
      fluid_per_hour_ml: { default: 500 },
      sodium_per_hour_mg: { default: 600 },
    },
    events: [],
    branches: [],
    validation: { passed: true, warnings: [] },
    ...overrides,
  };
}

describe('validatePlan', () => {
  test('plan baseline → passed', () => {
    const r = validatePlan(makePlan(), { totalDurationMin: 180 });
    expect(r.passed).toBe(true);
    expect(r.warnings.filter((w) => w.severity === 'high')).toHaveLength(0);
  });

  test('carbs > 120 → warning high carbs_above_ceiling', () => {
    const plan = makePlan({
      race_targets: {
        carbs_per_hour_g: { default: 150 },
        fluid_per_hour_ml: { default: 500 },
        sodium_per_hour_mg: { default: 600 },
      },
    });
    const r = validatePlan(plan, { totalDurationMin: 180 });
    expect(r.passed).toBe(false);
    expect(r.warnings.some((w) => w.code === 'carbs_above_ceiling' && w.severity === 'high')).toBe(true);
  });

  test('sodium > 1500 → warning high', () => {
    const plan = makePlan({
      race_targets: {
        carbs_per_hour_g: { default: 60 },
        fluid_per_hour_ml: { default: 500 },
        sodium_per_hour_mg: { default: 2000 },
      },
    });
    const r = validatePlan(plan, { totalDurationMin: 180 });
    expect(r.warnings.some((w) => w.code === 'sodium_above_ceiling' && w.severity === 'high')).toBe(true);
  });

  test('phase à 0 carbs (pause volontaire) ne déclenche pas le floor warning', () => {
    const plan = makePlan({
      race_targets: {
        carbs_per_hour_g: {
          default: 60,
          timeline: [{ from_min: 60, to_min: 120, value: 0, source: 'llm' }],
        },
        fluid_per_hour_ml: { default: 500 },
        sodium_per_hour_mg: { default: 600 },
      },
    });
    const r = validatePlan(plan, { totalDurationMin: 180 });
    const floorWarnings = r.warnings.filter((w) => w.code === 'carbs_below_floor');
    expect(floorWarnings).toHaveLength(0);
  });

  test('intakes espacés de 5 min → warning intake_too_close', () => {
    const plan = makePlan({
      events: [
        { id: 'e1', type: 'intake', at_min: 30, why: '', source: 'engine', confidence: 1 },
        { id: 'e2', type: 'intake', at_min: 35, why: '', source: 'engine', confidence: 1 },
      ],
    });
    const r = validatePlan(plan, { totalDurationMin: 180 });
    expect(r.warnings.some((w) => w.code === 'intake_too_close')).toBe(true);
  });

  test('event à at_min négatif → warning high', () => {
    const plan = makePlan({
      events: [
        { id: 'e1', type: 'intake', at_min: -5, why: '', source: 'engine', confidence: 1 },
      ],
    });
    const r = validatePlan(plan, { totalDurationMin: 180 });
    expect(r.warnings.some((w) => w.code === 'event_negative_time' && w.severity === 'high')).toBe(true);
    expect(r.passed).toBe(false);
  });
});
