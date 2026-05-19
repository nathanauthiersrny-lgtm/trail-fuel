import type { FoodItem } from '../../../models/food-item';
import type { InventoryItem } from '../../../models/race';
import type { TimelinePlan } from '../../../models/timeline-plan';
import { TIMELINE_PLAN_VERSION } from '../../../models/timeline-plan';
import { timelinePlanToEvents } from '../../builder/timeline-plan-to-events';

const GEL: FoodItem = {
  id: 'gel-1',
  name: 'Gel maltodex',
  type: 'gel',
  carbs_g: 25,
  sodium_mg: 50,
  weight_g: 32,
  volume_ml: 30,
  is_seed: true,
};

const BAR: FoodItem = {
  id: 'bar-1',
  name: 'Barre amande',
  type: 'bar',
  carbs_g: 30,
  sodium_mg: 80,
  weight_g: 60,
  is_seed: true,
};

const WATER: FoodItem = {
  id: 'water-1',
  name: 'Eau',
  type: 'water',
  carbs_g: 0,
  sodium_mg: 0,
  volume_ml: 500,
  is_seed: true,
};

function makePlan(events: TimelinePlan['events']): TimelinePlan {
  return {
    version: TIMELINE_PLAN_VERSION,
    race_id: 'r-1',
    generated_at: '2026-01-01T00:00:00Z',
    generator: { llm_enrichment_applied: false, engine_version: 'test' },
    race_targets: {
      carbs_per_hour_g: { default: 60 },
      fluid_per_hour_ml: { default: 500 },
      sodium_per_hour_mg: { default: 600 },
    },
    events,
    branches: [],
    validation: { passed: true, warnings: [] },
  };
}

describe('timelinePlanToEvents', () => {
  test('intake avec preferred_kinds=[gel] résout vers gel disponible', () => {
    const plan = makePlan([
      {
        id: 'evt-001',
        type: 'intake',
        at_min: 30,
        why: '',
        source: 'engine',
        confidence: 1,
        advice: { preferred_kinds: ['gel'], carbs_target_g: 25 },
      },
    ]);
    const inventory: InventoryItem[] = [
      { food_item_id: 'gel-1', quantity: 5 },
      { food_item_id: 'bar-1', quantity: 3 },
    ];
    const r = timelinePlanToEvents({ plan, foodItems: [GEL, BAR], inventory });
    expect(r.events).toHaveLength(1);
    expect(r.events[0].payload.food_item_id).toBe('gel-1');
    expect(r.events[0].payload.quantity).toBe(1);
    expect(r.events[0].scheduled_at_minute).toBe(30);
  });

  test('quantity calculée depuis carbs_target_g / item.carbs_g', () => {
    const plan = makePlan([
      {
        id: 'evt-001',
        type: 'intake',
        at_min: 30,
        why: '',
        source: 'engine',
        confidence: 1,
        advice: { preferred_kinds: ['gel'], carbs_target_g: 50 },
      },
    ]);
    const r = timelinePlanToEvents({
      plan,
      foodItems: [GEL],
      inventory: [{ food_item_id: 'gel-1', quantity: 5 }],
    });
    expect(r.events[0].payload.quantity).toBe(2); // 50 / 25 = 2
  });

  test('preferred=gel mais inventaire vide en gel → fallback sur autre kind', () => {
    const plan = makePlan([
      {
        id: 'evt-001',
        type: 'intake',
        at_min: 30,
        why: '',
        source: 'engine',
        confidence: 1,
        advice: { preferred_kinds: ['gel'] },
      },
    ]);
    const r = timelinePlanToEvents({
      plan,
      foodItems: [GEL, BAR],
      inventory: [{ food_item_id: 'bar-1', quantity: 3 }],
    });
    expect(r.events[0].payload.food_item_id).toBe('bar-1');
  });

  test('forbidden_kinds → ne pick pas cet item même si preferred_kinds le permet', () => {
    const plan = makePlan([
      {
        id: 'evt-001',
        type: 'intake',
        at_min: 30,
        why: '',
        source: 'engine',
        confidence: 1,
        advice: { forbidden_kinds: ['gel'] },
      },
    ]);
    const r = timelinePlanToEvents({
      plan,
      foodItems: [GEL, BAR],
      inventory: [
        { food_item_id: 'gel-1', quantity: 5 },
        { food_item_id: 'bar-1', quantity: 3 },
      ],
    });
    expect(r.events[0].payload.food_item_id).toBe('bar-1');
  });

  test('inventaire décrémenté entre 2 intakes consécutifs', () => {
    const plan = makePlan([
      { id: 'e1', type: 'intake', at_min: 30, why: '', source: 'engine', confidence: 1, advice: { preferred_kinds: ['gel'], carbs_target_g: 25 } },
      { id: 'e2', type: 'intake', at_min: 50, why: '', source: 'engine', confidence: 1, advice: { preferred_kinds: ['gel'], carbs_target_g: 25 } },
      { id: 'e3', type: 'intake', at_min: 70, why: '', source: 'engine', confidence: 1, advice: { preferred_kinds: ['gel'], carbs_target_g: 25 } },
    ]);
    const r = timelinePlanToEvents({
      plan,
      foodItems: [GEL, BAR],
      inventory: [
        { food_item_id: 'gel-1', quantity: 2 },
        { food_item_id: 'bar-1', quantity: 5 },
      ],
    });
    // Les 2 premiers : gel. Le 3e : gel épuisé → fallback bar.
    expect(r.events[0].payload.food_item_id).toBe('gel-1');
    expect(r.events[1].payload.food_item_id).toBe('gel-1');
    expect(r.events[2].payload.food_item_id).toBe('bar-1');
  });

  test('fluid_reminder propage target_volume_ml', () => {
    const plan = makePlan([
      {
        id: 'evt-001',
        type: 'fluid_reminder',
        at_min: 15,
        why: '',
        source: 'engine',
        confidence: 1,
        advice: { fluid_target_ml: 250 },
      },
    ]);
    const r = timelinePlanToEvents({ plan, foodItems: [WATER], inventory: [] });
    expect(r.events[0].payload.target_volume_ml).toBe(250);
  });

  test('aid_station propage aid_station_id + aid_phase=arrived', () => {
    const plan = makePlan([
      { id: 'evt-001', type: 'aid_station', at_min: 120, why: '', source: 'engine', confidence: 1, aid_station_id: 'ravito-1' },
    ]);
    const r = timelinePlanToEvents({ plan, foodItems: [], inventory: [] });
    expect(r.events[0].payload.aid_station_id).toBe('ravito-1');
    expect(r.events[0].payload.aid_phase).toBe('arrived');
  });

  test('branches → warning legacy "branches_not_executed"', () => {
    const plan: TimelinePlan = {
      ...makePlan([]),
      branches: [
        {
          id: 'br-1',
          trigger: { type: 'skipped_count', window_min: 60, operator: '>=', value: 3 },
          action: { type: 'boost_next_intake', factor: 1.5 },
          why: '',
          source: 'engine',
        },
      ],
    };
    const r = timelinePlanToEvents({ plan, foodItems: [], inventory: [] });
    expect(r.warnings.some((w) => w.code === 'branches_not_executed')).toBe(true);
  });

  test('event id préfixé par race_id pour cohérence avec runtime', () => {
    const plan = makePlan([
      { id: 'evt-001', type: 'check_in', at_min: 50, why: '', source: 'engine', confidence: 1 },
    ]);
    const r = timelinePlanToEvents({ plan, foodItems: [], inventory: [] });
    expect(r.events[0].id).toBe('r-1::evt-001');
    expect(r.events[0].race_id).toBe('r-1');
  });
});
