import type { PersistedPlannedEvent } from '../../../db/repos/planned-event-repo';
import type { EventLog } from '../../../models/event-log';
import type { FoodItem } from '../../../models/food-item';
import { makeBaseProfile, makeBaseRace } from '../../../engine/__tests__/fixtures/races/base-race';
import { buildAnalyzePayload } from '../build-payload';

const GEL: FoodItem = {
  id: 'gel-1',
  name: 'Gel',
  type: 'gel',
  carbs_g: 25,
  sodium_mg: 50,
  weight_g: 32,
  is_seed: true,
};

const BAR: FoodItem = {
  id: 'bar-1',
  name: 'Barre',
  type: 'bar',
  carbs_g: 30,
  sodium_mg: 80,
  weight_g: 60,
  is_seed: true,
};

function makePlanned(overrides: Partial<PersistedPlannedEvent>): PersistedPlannedEvent {
  return {
    id: 'evt-1',
    race_id: 'r-1',
    scheduled_at_minute: 30,
    scheduled_at_ms: 0,
    type: 'intake',
    payload: { food_item_id: 'gel-1', quantity: 1 },
    notification_id: null,
    order_index: 0,
    ...overrides,
  } as PersistedPlannedEvent;
}

describe('buildAnalyzePayload', () => {
  const startedAt = new Date('2026-05-19T08:00:00Z').getTime();
  const endedAt = startedAt + 180 * 60_000; // 3h

  test('produit un payload avec race_summary + profile_baseline + plan_summary', () => {
    const race = makeBaseRace({
      id: 'r-1',
      started_at: startedAt,
      ended_at: endedAt,
      status: 'completed',
      temperature_c: 22,
    });
    const profile = makeBaseProfile();
    const payload = buildAnalyzePayload({
      race,
      profile,
      plannedEvents: [],
      logs: [],
      foodItems: [],
    });

    expect(payload.race_summary.status).toBe('completed');
    expect(payload.race_summary.duration_min_actual).toBe(180);
    expect(payload.race_summary.temperature_c).toBe(22);
    expect(payload.profile_baseline.carbs_per_hour_g).toBe(profile.carbs_per_hour_g);
    expect(payload.plan_summary.was_enriched).toBe(false);
  });

  test("plan_summary utilise les valeurs du timeline_plan si présent (default des targets)", () => {
    const race = makeBaseRace({
      started_at: startedAt,
      ended_at: endedAt,
      status: 'completed',
      timeline_plan: {
        version: 1,
        race_id: 'r-1',
        generated_at: 'now',
        generator: { llm_enrichment_applied: true, llm_model: 'haiku' },
        race_targets: {
          carbs_per_hour_g: { default: 75 },
          fluid_per_hour_ml: { default: 600 },
          sodium_per_hour_mg: { default: 800 },
        },
        events: [],
        branches: [],
        validation: { passed: true, warnings: [] },
      },
    });
    const payload = buildAnalyzePayload({
      race,
      profile: makeBaseProfile(),
      plannedEvents: [],
      logs: [],
      foodItems: [],
    });
    expect(payload.plan_summary.carbs_per_hour_g).toBe(75);
    expect(payload.plan_summary.was_enriched).toBe(true);
  });

  test('logs : at_min calculé depuis logged_at - started_at, en minutes', () => {
    const race = makeBaseRace({
      id: 'r-1',
      started_at: startedAt,
      ended_at: endedAt,
      status: 'completed',
    });
    const logs: EventLog[] = [
      { id: 'l1', race_id: 'r-1', planned_event_id: 'evt-1', logged_at: startedAt + 30 * 60_000, status: 'done', feeling: 'good' },
    ];
    const planned = [makePlanned({ id: 'evt-1', type: 'intake', payload: { food_item_id: 'gel-1', quantity: 1 } })];
    const payload = buildAnalyzePayload({
      race,
      profile: makeBaseProfile(),
      plannedEvents: planned,
      logs,
      foodItems: [GEL],
    });
    expect(payload.logs).toHaveLength(1);
    expect(payload.logs[0].at_min).toBe(30);
    expect(payload.logs[0].type).toBe('intake');
    expect(payload.logs[0].item_kind).toBe('gel');
    expect(payload.logs[0].feeling).toBe('good');
  });

  test('logs : trié par logged_at + cap à 200 entries', () => {
    const race = makeBaseRace({
      id: 'r-1',
      started_at: startedAt,
      ended_at: endedAt,
      status: 'completed',
    });
    const logs: EventLog[] = Array.from({ length: 250 }, (_, i) => ({
      id: `l${i}`,
      race_id: 'r-1',
      logged_at: startedAt + i * 60_000,
      status: 'done',
    }));
    // Mélange pour vérifier le tri
    const shuffled = [...logs].reverse();
    const payload = buildAnalyzePayload({
      race,
      profile: makeBaseProfile(),
      plannedEvents: [],
      logs: shuffled,
      foodItems: [],
    });
    expect(payload.logs).toHaveLength(200);
    // Premier log = celui avec le plus petit logged_at
    expect(payload.logs[0].at_min).toBe(0);
  });

  test('abandoned race → status abandoned', () => {
    const race = makeBaseRace({
      started_at: startedAt,
      ended_at: startedAt + 30 * 60_000,
      status: 'abandoned',
    });
    const payload = buildAnalyzePayload({
      race,
      profile: makeBaseProfile(),
      plannedEvents: [],
      logs: [],
      foodItems: [],
    });
    expect(payload.race_summary.status).toBe('abandoned');
    expect(payload.race_summary.duration_min_actual).toBe(30);
  });

  test('total_intakes_planned et total_check_ins_planned filtrés par type', () => {
    const planned = [
      makePlanned({ id: 'e1', type: 'intake' }),
      makePlanned({ id: 'e2', type: 'intake' }),
      makePlanned({ id: 'e3', type: 'check_in', payload: {} }),
      makePlanned({ id: 'e4', type: 'fluid_reminder', payload: { target_volume_ml: 300 } }),
    ];
    const payload = buildAnalyzePayload({
      race: makeBaseRace({ started_at: startedAt, ended_at: endedAt, status: 'completed' }),
      profile: makeBaseProfile(),
      plannedEvents: planned,
      logs: [],
      foodItems: [GEL, BAR],
    });
    expect(payload.plan_summary.total_intakes_planned).toBe(2);
    expect(payload.plan_summary.total_check_ins_planned).toBe(1);
  });
});
