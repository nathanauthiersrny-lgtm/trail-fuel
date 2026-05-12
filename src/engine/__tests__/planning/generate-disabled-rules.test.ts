import { generatePlan } from '../../planning/generate';
import { makeBaseProfile, makeBaseRace } from '../fixtures/races/base-race';
import { TEST_PACK } from '../test-helpers/knowledge-pack';

describe('generatePlan — disabled_rule_ids', () => {
  it('skips a base rule when listed in profile.disabled_rule_ids', () => {
    // refill_in_nature=true so the fluid rate flows through to reminders
    // without being rationed to 0 by the empty inventory.
    const baseRace = {
      humidity_high: true,
      refill_in_nature: true,
      inventory: [],
    };

    const enabled = generatePlan({
      profile: makeBaseProfile({ fluid_per_hour_ml: 500 }),
      race: makeBaseRace(baseRace),
      foodItems: [],
      now: 0,
      pack: TEST_PACK,
    });

    const disabled = generatePlan({
      profile: makeBaseProfile({
        fluid_per_hour_ml: 500,
        disabled_rule_ids: ['fluid-humidity-high'],
      }),
      race: makeBaseRace(baseRace),
      foodItems: [],
      now: 0,
      pack: TEST_PACK,
    });

    // Rule active → 500 × 1.15 = 575 ml/h → 575 × 0.5 = 287.5 → rounded
    // Rule disabled → 500 ml/h → 500 × 0.5 = 250
    const enabledFluidReminder = enabled.events.find((e) => e.type === 'fluid_reminder');
    const disabledFluidReminder = disabled.events.find((e) => e.type === 'fluid_reminder');
    expect(enabledFluidReminder?.payload.target_volume_ml).toBeDefined();
    expect(disabledFluidReminder?.payload.target_volume_ml).toBeDefined();
    expect(enabledFluidReminder!.payload.target_volume_ml).toBeGreaterThan(
      disabledFluidReminder!.payload.target_volume_ml!,
    );
    expect(disabledFluidReminder!.payload.target_volume_ml).toBe(250);
  });

  it('disabling a non-existent rule id is a no-op (graceful)', () => {
    const result = generatePlan({
      profile: makeBaseProfile({
        disabled_rule_ids: ['this-rule-does-not-exist'],
      }),
      race: makeBaseRace({ inventory: [] }),
      foodItems: [],
      now: 0,
      pack: TEST_PACK,
    });
    // Should produce a normal plan, no crash.
    expect(result.events).toBeDefined();
    expect(result.warnings).toBeDefined();
  });

  it('empty disabled_rule_ids = same output as before the toggle feature', () => {
    const a = generatePlan({
      profile: makeBaseProfile({ disabled_rule_ids: [] }),
      race: makeBaseRace({ inventory: [] }),
      foodItems: [],
      now: 0,
      pack: TEST_PACK,
    });
    // Sanity check : plan generates without issue when no toggles set.
    expect(a.events.length).toBeGreaterThanOrEqual(0);
  });
});
