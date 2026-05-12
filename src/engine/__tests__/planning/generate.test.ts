import type { FoodItem } from '../../../models/food-item';

import { generatePlan } from '../../planning/generate';
import { makeBaseProfile, makeBaseRace } from '../fixtures/races/base-race';
import { TEST_PACK } from '../test-helpers/knowledge-pack';

const gel: FoodItem = {
  id: 'gel', name: 'Gel', type: 'gel', carbs_g: 25, sodium_mg: 0,
  weight_g: 60, is_seed: false,
};
const water: FoodItem = {
  id: 'water', name: 'Water', type: 'water', carbs_g: 0, sodium_mg: 0,
  volume_ml: 500, is_seed: false,
};

describe('generatePlan', () => {
  it('produces intakes + check-ins for a 3h flat race with full inventory', () => {
    const result = generatePlan({
      profile: makeBaseProfile(),
      race: makeBaseRace({
        estimated_duration_min: 180,
        distance_km: 30,
        inventory: [
          { food_item_id: 'gel', quantity: 10 },
          { food_item_id: 'water', quantity: 5 },
        ],
      }),
      foodItems: [gel, water],
      now: 0,
      pack: TEST_PACK,
    });

    const intakes = result.events.filter((e) => e.type === 'intake');
    const checkIns = result.events.filter((e) => e.type === 'check_in');

    expect(intakes.length).toBeGreaterThan(0);
    expect(checkIns.length).toBeGreaterThan(0);
    // Sorted by minute
    for (let i = 1; i < result.events.length; i += 1) {
      expect(result.events[i].scheduled_at_minute).toBeGreaterThanOrEqual(
        result.events[i - 1].scheduled_at_minute,
      );
    }
    // Sufficient inventory → no carbs/fluid warnings
    expect(result.warnings).toEqual([]);
  });

  it('emits rationing warnings when inventory is empty (no aid stations)', () => {
    const result = generatePlan({
      profile: makeBaseProfile(),
      race: makeBaseRace({
        estimated_duration_min: 180,
        distance_km: 30,
        inventory: [],
      }),
      foodItems: [gel, water],
      now: 0,
      pack: TEST_PACK,
    });
    expect(result.warnings.map((w) => w.code).sort()).toEqual([
      'carbs_rationing',
      'fluid_rationing',
    ]);
    // With no inventory, no intakes or fluid reminders can be placed — only check-ins
    expect(result.events.every((e) => e.type === 'check_in')).toBe(true);
  });

  it('inserts aid_station events at the correct minute (fallback timeline)', () => {
    const result = generatePlan({
      profile: makeBaseProfile(),
      race: makeBaseRace({
        estimated_duration_min: 180,
        distance_km: 30,
        aid_stations: [
          {
            id: 'aid-mid',
            at_km: 15,
            estimated_at_minute: 0,
            available: { water: true, isotonic: false, solid_food: false, refill_possible: true },
          },
        ],
        inventory: [
          { food_item_id: 'gel', quantity: 10 },
          { food_item_id: 'water', quantity: 5 },
        ],
      }),
      foodItems: [gel, water],
      now: 0,
      pack: TEST_PACK,
    });

    const aidEvents = result.events.filter((e) => e.type === 'aid_station');
    expect(aidEvents).toHaveLength(2);
    const arrived = aidEvents.find((e) => e.payload.aid_phase === 'arrived');
    const approaching = aidEvents.find((e) => e.payload.aid_phase === 'approaching');
    expect(arrived!.scheduled_at_minute).toBeCloseTo(90, 6);
    expect(approaching!.scheduled_at_minute).toBeCloseTo(87, 6);
  });

  it('respects first_intake_after_min override', () => {
    const result = generatePlan({
      profile: makeBaseProfile(),
      race: makeBaseRace({
        estimated_duration_min: 180,
        distance_km: 30,
        overrides: { first_intake_after_min: 60 },
        inventory: [{ food_item_id: 'gel', quantity: 10 }],
      }),
      foodItems: [gel, water],
      now: 0,
      pack: TEST_PACK,
    });
    const firstIntake = result.events.find((e) => e.type === 'intake');
    expect(firstIntake!.scheduled_at_minute).toBe(60);
  });

  it('stress overrides: first_intake=1, interval=3 → multiple intakes early', () => {
    // Cas du test runtime : on veut beaucoup de notifs rapprochées.
    // Note : MERGE_WINDOW_MIN = 3, donc interval < 3 fusionne tout en 1 seul event.
    const result = generatePlan({
      profile: makeBaseProfile(),
      race: makeBaseRace({
        estimated_duration_min: 30,
        distance_km: 5,
        overrides: {
          first_intake_after_min: 1,
          intake_interval_min: 3,
          check_in_frequency_min: 5,
        },
        inventory: [{ food_item_id: 'gel', quantity: 30 }],
      }),
      foodItems: [gel, water],
      now: 0,
      pack: TEST_PACK,
    });
    const intakes = result.events.filter((e) => e.type === 'intake');
    const checkIns = result.events.filter((e) => e.type === 'check_in');
    // Premier intake ≤ 3 min (collision-adjust peut décaler de quelques min)
    expect(intakes[0].scheduled_at_minute).toBeLessThanOrEqual(3);
    // ~10 intakes attendus (1, 4, 7, ..., 28). Quelques-uns peuvent être déplacés
    // par la collision-resolution avec les check-ins, mais il en reste ≥ 5.
    expect(intakes.length).toBeGreaterThanOrEqual(5);
    expect(checkIns.length).toBeGreaterThanOrEqual(3);
  });

  it('clamps absurd overrides (e.g. interval=0) to safe bounds', () => {
    const result = generatePlan({
      profile: makeBaseProfile(),
      race: makeBaseRace({
        estimated_duration_min: 60,
        distance_km: 10,
        overrides: { intake_interval_min: 0, check_in_frequency_min: 0 },
        inventory: [{ food_item_id: 'gel', quantity: 30 }],
      }),
      foodItems: [gel, water],
      now: 0,
      pack: TEST_PACK,
    });
    // Avec clamp 1 min, on ne doit pas avoir de boucle infinie.
    expect(result.events.length).toBeGreaterThan(0);
    expect(result.events.length).toBeLessThan(500);
  });

  it('assigns deterministic ids prefixed with race_id', () => {
    const result = generatePlan({
      profile: makeBaseProfile(),
      race: makeBaseRace({
        id: 'my-race',
        estimated_duration_min: 60,
        distance_km: 10,
        inventory: [{ food_item_id: 'gel', quantity: 2 }],
      }),
      foodItems: [gel, water],
      now: 0,
      pack: TEST_PACK,
    });
    expect(result.events.length).toBeGreaterThan(0);
    for (const event of result.events) {
      expect(event.race_id).toBe('my-race');
      expect(event.id.startsWith('my-race::event-')).toBe(true);
    }
    const ids = new Set(result.events.map((e) => e.id));
    expect(ids.size).toBe(result.events.length);
  });

  it('handles a short race (45 min): 1 check-in, 1 intake (collision-adjusted)', () => {
    const result = generatePlan({
      profile: makeBaseProfile(),
      race: makeBaseRace({
        estimated_duration_min: 45,
        distance_km: 7,
        inventory: [{ food_item_id: 'gel', quantity: 5 }],
      }),
      foodItems: [gel, water],
      now: 0,
      pack: TEST_PACK,
    });
    const checkIns = result.events.filter((e) => e.type === 'check_in');
    const intakes = result.events.filter((e) => e.type === 'intake');
    expect(checkIns).toHaveLength(1);
    expect(intakes).toHaveLength(1);
    // Intake holds at minute 30; check-in shifts to 32 (cross-type collision rule).
    expect(intakes[0].scheduled_at_minute).toBe(30);
    expect(checkIns[0].scheduled_at_minute).toBe(32);
  });

  it('produces both solid intakes and fluid reminders when inventory is sufficient', () => {
    const result = generatePlan({
      profile: makeBaseProfile(),
      race: makeBaseRace({
        estimated_duration_min: 180,
        distance_km: 30,
        inventory: [
          { food_item_id: 'gel', quantity: 10 },
          { food_item_id: 'water', quantity: 5 },
        ],
      }),
      foodItems: [gel, water],
      now: 0,
      pack: TEST_PACK,
    });

    const intakes = result.events.filter((e) => e.type === 'intake');
    const fluidReminders = result.events.filter((e) => e.type === 'fluid_reminder');

    expect(intakes.length).toBeGreaterThan(0);
    expect(fluidReminders.length).toBeGreaterThan(0);
    // Intakes should only carry solid items (gel), not water
    for (const ev of intakes) {
      if (ev.payload.food_item_id) {
        expect(ev.payload.food_item_id).toBe('gel');
      }
    }
    // Fluid reminders have target_volume_ml
    for (const ev of fluidReminders) {
      expect(ev.payload.target_volume_ml).toBeGreaterThan(0);
    }
    expect(result.warnings).toEqual([]);
  });

  it('generates reduced fluid reminders + rationing warning when fluid is at 70%', () => {
    // 3h race, 500ml/h → need 1500ml total. 2 × 500ml = 1000ml (67%).
    const result = generatePlan({
      profile: makeBaseProfile(),
      race: makeBaseRace({
        estimated_duration_min: 180,
        distance_km: 30,
        inventory: [
          { food_item_id: 'gel', quantity: 10 },
          { food_item_id: 'water', quantity: 2 },
        ],
      }),
      foodItems: [gel, water],
      now: 0,
      pack: TEST_PACK,
    });

    const fluidWarning = result.warnings.find((w) => w.code === 'fluid_rationing');
    expect(fluidWarning).toBeDefined();
    expect(fluidWarning!.data!.effective_ml_per_h).toBeLessThan(
      fluidWarning!.data!.target_ml_per_h,
    );

    const fluidReminders = result.events.filter((e) => e.type === 'fluid_reminder');
    expect(fluidReminders.length).toBeGreaterThan(0);
    // All reminders should reflect the reduced rate
    const expectedVol = Math.round((1000 / 180) * 60 * 0.5);
    for (const ev of fluidReminders) {
      expect(ev.payload.target_volume_ml).toBe(expectedVol);
    }
  });

  it('places no intake during a steep descent window (GPX-driven)', () => {
    const segments = Array.from({ length: 18 }, (_, i) => ({
      km: (i + 1) * 0.5,
      elevation_m: 1000,
      // Minutes 40..60 are a steep descent window
      gradient: i >= 4 && i < 6 ? -0.12 : 0,
      estimated_time_min: (i + 1) * 10,
    }));
    const result = generatePlan({
      profile: makeBaseProfile(),
      race: makeBaseRace({
        gpx_track: {
          total_distance_km: 9,
          total_elevation_gain_m: 0,
          total_elevation_loss_m: 200,
          segments,
        },
        estimated_duration_min: 180,
        inventory: [{ food_item_id: 'gel', quantity: 20 }],
      }),
      foodItems: [gel],
      now: 0,
      pack: TEST_PACK,
    });
    const intakeMinutes = result.events
      .filter((e) => e.type === 'intake')
      .map((e) => e.scheduled_at_minute);
    // No intake should land at minute 50 (mid of descent window)
    expect(intakeMinutes).not.toContain(50);
  });
});
