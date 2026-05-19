import { TIMELINE_PLAN_VERSION } from '../../../models/timeline-plan';
import { buildPlan } from '../../builder/build-plan';
import { makeBaseProfile, makeBaseRace } from '../fixtures/races/base-race';

describe('buildPlan', () => {
  const FIXED_NOW = new Date('2026-05-19T18:00:00.000Z');

  test('produit un TimelinePlan version 1 avec generator engine', () => {
    const { plan } = buildPlan({
      profile: makeBaseProfile(),
      race: makeBaseRace(),
      now: FIXED_NOW,
    });
    expect(plan.version).toBe(TIMELINE_PLAN_VERSION);
    expect(plan.race_id).toBe('race-test');
    expect(plan.generator.llm_enrichment_applied).toBe(false);
    expect(plan.generator.engine_version).toMatch(/^2\./);
    expect(plan.generated_at).toBe(FIXED_NOW.toISOString());
  });

  test('placement périodique sur race 3h sans GPX → ~9 intakes (intervalle 20min)', () => {
    const { plan } = buildPlan({
      profile: makeBaseProfile(),
      race: makeBaseRace({ estimated_duration_min: 180 }),
      now: FIXED_NOW,
    });
    const intakes = plan.events.filter((e) => e.type === 'intake');
    // first_intake_after_min=30, intake_interval_min=20, total=180 → t=30,50,...170 = 8 intakes
    expect(intakes.length).toBe(8);
    expect(intakes[0].at_min).toBe(30);
    expect(intakes[intakes.length - 1].at_min).toBeLessThan(180);
    for (let i = 1; i < intakes.length; i += 1) {
      expect(intakes[i].at_min - intakes[i - 1].at_min).toBeGreaterThanOrEqual(20);
    }
  });

  test('check-ins placés à la fréquence du session_type long (50 min)', () => {
    const { plan } = buildPlan({
      profile: makeBaseProfile(),
      race: makeBaseRace({ estimated_duration_min: 180, session_type: 'long' }),
      now: FIXED_NOW,
    });
    const checkIns = plan.events.filter((e) => e.type === 'check_in');
    expect(checkIns.length).toBeGreaterThanOrEqual(3);
    expect(checkIns[0].at_min).toBe(50);
  });

  test('events triés par at_min', () => {
    const { plan } = buildPlan({
      profile: makeBaseProfile(),
      race: makeBaseRace({ estimated_duration_min: 240 }),
      now: FIXED_NOW,
    });
    for (let i = 1; i < plan.events.length; i += 1) {
      expect(plan.events[i].at_min).toBeGreaterThanOrEqual(plan.events[i - 1].at_min);
    }
  });

  test('chaque intake porte une advice avec carbs_target_g et preferred_kinds', () => {
    const { plan } = buildPlan({
      profile: makeBaseProfile(),
      race: makeBaseRace({ estimated_duration_min: 180 }),
      now: FIXED_NOW,
    });
    const intakes = plan.events.filter((e) => e.type === 'intake');
    for (const intake of intakes) {
      expect(intake.advice?.carbs_target_g).toBeGreaterThan(0);
      expect(intake.advice?.preferred_kinds).toBeDefined();
      expect(intake.advice?.preferred_kinds?.length).toBeGreaterThan(0);
    }
  });

  test('branche skip-recovery présente par défaut', () => {
    const { plan } = buildPlan({
      profile: makeBaseProfile(),
      race: makeBaseRace(),
      now: FIXED_NOW,
    });
    expect(plan.branches.length).toBeGreaterThan(0);
    const skipBranch = plan.branches.find((b) => b.trigger.type === 'skipped_count');
    expect(skipBranch).toBeDefined();
    expect(skipBranch?.source).toBe('engine');
  });

  test('plan respectant les bornes physiologiques → validation passed', () => {
    const { plan } = buildPlan({
      profile: makeBaseProfile(),
      race: makeBaseRace(),
      now: FIXED_NOW,
    });
    expect(plan.validation.passed).toBe(true);
    // Aucune warning high sur un cas baseline
    const high = plan.validation.warnings.filter((w) => w.severity === 'high');
    expect(high).toHaveLength(0);
  });

  test('race overrides propagent au plan', () => {
    const { plan } = buildPlan({
      profile: makeBaseProfile(),
      race: makeBaseRace({
        estimated_duration_min: 180,
        overrides: { intake_interval_min: 30, first_intake_after_min: 15 },
      }),
      now: FIXED_NOW,
    });
    const intakes = plan.events.filter((e) => e.type === 'intake');
    expect(intakes[0].at_min).toBe(15);
    // Tous les intakes à 30 min d'écart
    for (let i = 1; i < intakes.length; i += 1) {
      expect(intakes[i].at_min - intakes[i - 1].at_min).toBeGreaterThanOrEqual(30);
    }
  });
});
