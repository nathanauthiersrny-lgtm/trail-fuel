import type { FoodItem } from '../../../models/food-item';
import type { InventoryItem } from '../../../models/race';

import { placeIntakes } from '../../planning/placement';
import type { ResolvedParams } from '../../planning/resolve-params';
import type { PlanningWindow } from '../../planning/windows';

const baseParams: ResolvedParams = {
  carbs_per_hour_g: 60,
  fluid_per_hour_ml: 500,
  sodium_per_hour_mg: 500,
  first_intake_after_min: 30,
  check_in_frequency_min: 50,
  intake_interval_min: 20,
  first_fluid_reminder_min: 15,
  fluid_reminder_interval_min: 30,
  skip_alert_threshold: 2,
  deficit_alert_pct: 0.30,
  intensity: 'moderate',
};

const gel: FoodItem = {
  id: 'gel', name: 'Gel', type: 'gel', carbs_g: 22, sodium_mg: 0,
  weight_g: 60, is_seed: false,
};
const bar: FoodItem = {
  id: 'bar', name: 'Bar', type: 'bar', carbs_g: 40, sodium_mg: 100,
  weight_g: 55, is_seed: false,
};
const water: FoodItem = {
  id: 'water', name: 'Water', type: 'water', carbs_g: 0, sodium_mg: 0,
  volume_ml: 500, is_seed: false,
};
const isotonic: FoodItem = {
  id: 'iso', name: 'Iso', type: 'drink_mix', carbs_g: 30, sodium_mg: 300,
  volume_ml: 500, is_seed: false,
};

function flatWindows(totalDurationMin: number, slope: number = 0): PlanningWindow[] {
  const windows: PlanningWindow[] = [];
  for (let start = 20; start < totalDurationMin; start += 20) {
    windows.push({
      index: windows.length + 1,
      startMin: start,
      endMin: Math.min(start + 20, totalDurationMin),
      medianSlope: slope,
    });
  }
  return windows;
}

describe('placeIntakes', () => {
  it('places intakes every 20 min starting at first_intake_after_min', () => {
    const inventory: InventoryItem[] = [{ food_item_id: 'gel', quantity: 10 }];
    const events = placeIntakes({
      windows: flatWindows(180),
      params: baseParams,
      totalDurationMin: 180,
      foodItems: [gel],
      inventory,
    });
    expect(events.map((e) => e.scheduled_at_minute)).toEqual([30, 50, 70, 90, 110, 130, 150, 170]);
  });

  it('shifts the first intake when first_intake_after_min is overridden', () => {
    const params = { ...baseParams, first_intake_after_min: 60 };
    const inventory: InventoryItem[] = [{ food_item_id: 'gel', quantity: 10 }];
    const events = placeIntakes({
      windows: flatWindows(180),
      params,
      totalDurationMin: 180,
      foodItems: [gel],
      inventory,
    });
    expect(events.map((e) => e.scheduled_at_minute)).toEqual([60, 80, 100, 120, 140, 160]);
  });

  it('places no intake during a steep descent (slope < -8%)', () => {
    const windows: PlanningWindow[] = [
      { index: 1, startMin: 20, endMin: 40, medianSlope: 0 },
      { index: 2, startMin: 40, endMin: 60, medianSlope: -0.10 },
      { index: 3, startMin: 60, endMin: 80, medianSlope: 0 },
    ];
    const events = placeIntakes({
      windows,
      params: baseParams,
      totalDurationMin: 80,
      foodItems: [gel],
      inventory: [{ food_item_id: 'gel', quantity: 10 }],
    });
    expect(events.map((e) => e.scheduled_at_minute)).toEqual([30, 70]);
  });

  it('forbids bars during a steep climb (slope > 10%)', () => {
    const windows: PlanningWindow[] = [
      { index: 1, startMin: 20, endMin: 40, medianSlope: 0 },
      { index: 2, startMin: 40, endMin: 60, medianSlope: 0.15 }, // steep climb
      { index: 3, startMin: 60, endMin: 80, medianSlope: 0 },
    ];
    const events = placeIntakes({
      windows,
      params: baseParams,
      totalDurationMin: 80,
      foodItems: [bar, gel],
      inventory: [
        { food_item_id: 'bar', quantity: 5 },
        { food_item_id: 'gel', quantity: 5 },
      ],
    });
    const climbEvent = events.find((e) => e.scheduled_at_minute === 50);
    expect(climbEvent).toBeDefined();
    expect(climbEvent!.payload.food_item_id).toBe('gel');
  });

  it('alternates between item types when possible (anti-écœurement)', () => {
    const events = placeIntakes({
      windows: flatWindows(120),
      params: baseParams,
      totalDurationMin: 120,
      foodItems: [gel, bar],
      inventory: [
        { food_item_id: 'gel', quantity: 5 },
        { food_item_id: 'bar', quantity: 5 },
      ],
    });
    const types = events.map((e) =>
      e.payload.food_item_id === 'gel' ? 'gel' : e.payload.food_item_id === 'bar' ? 'bar' : 'other',
    );
    // No two consecutive items should be the same type
    for (let i = 1; i < types.length; i += 1) {
      expect(types[i]).not.toBe(types[i - 1]);
    }
  });

  it('decrements inventory and stops emitting when exhausted', () => {
    const events = placeIntakes({
      windows: flatWindows(180),
      params: baseParams,
      totalDurationMin: 180,
      foodItems: [gel],
      inventory: [{ food_item_id: 'gel', quantity: 3 }],
    });
    expect(events).toHaveLength(3);
  });

  it('emits no events when inventory is empty', () => {
    const events = placeIntakes({
      windows: flatWindows(180),
      params: baseParams,
      totalDurationMin: 180,
      foodItems: [gel],
      inventory: [],
    });
    expect(events).toEqual([]);
  });

  it('excludes liquids (water, drink_mix) — they are handled by fluid reminders', () => {
    const events = placeIntakes({
      windows: flatWindows(60),
      params: baseParams,
      totalDurationMin: 60,
      foodItems: [water, isotonic, gel],
      inventory: [
        { food_item_id: 'water', quantity: 5 },
        { food_item_id: 'iso', quantity: 5 },
        { food_item_id: 'gel', quantity: 5 },
      ],
    });
    for (const ev of events) {
      expect(ev.payload.food_item_id).toBe('gel');
    }
  });

  it('returns empty array when there are no windows', () => {
    expect(
      placeIntakes({
        windows: [],
        params: baseParams,
        totalDurationMin: 0,
        foodItems: [gel],
        inventory: [{ food_item_id: 'gel', quantity: 5 }],
      }),
    ).toEqual([]);
  });
});
