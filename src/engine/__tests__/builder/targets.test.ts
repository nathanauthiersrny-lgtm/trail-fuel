import { computeRaceTargets } from '../../builder/targets';
import { makeBaseProfile, makeBaseRace } from '../fixtures/races/base-race';

describe('computeRaceTargets', () => {
  test('profile baseline at 15°C, no humidity, variable exposure → targets unchanged', () => {
    const targets = computeRaceTargets({
      profile: makeBaseProfile(),
      race: makeBaseRace(),
      durationMin: 180,
    });
    // session_type 'long' has intensity_modifier 1.0 → carbs unchanged
    expect(targets.carbs_per_hour_g.default).toBe(60);
    expect(targets.fluid_per_hour_ml.default).toBe(500);
    // 180min == long_duration_threshold (not strictly > 180), so no bonus
    expect(targets.sodium_per_hour_mg.default).toBe(500);
  });

  test('session_type plaisir reduces carbs by 15%', () => {
    const targets = computeRaceTargets({
      profile: makeBaseProfile(),
      race: makeBaseRace({ session_type: 'plaisir' }),
      durationMin: 180,
    });
    // 60 * 0.85 = 51
    expect(targets.carbs_per_hour_g.default).toBe(51);
  });

  test('session_type competition bumps carbs by 20%', () => {
    const targets = computeRaceTargets({
      profile: makeBaseProfile(),
      race: makeBaseRace({ session_type: 'competition' }),
      durationMin: 180,
    });
    // 60 * 1.20 = 72
    expect(targets.carbs_per_hour_g.default).toBe(72);
  });

  test('hot race (>20°C) increases fluid linearly', () => {
    const targets = computeRaceTargets({
      profile: makeBaseProfile(),
      race: makeBaseRace({ temperature_c: 25 }),
      durationMin: 180,
    });
    // 500 + (25-20)*50 = 750, * 1.0 (variable exposure) = 750
    expect(targets.fluid_per_hour_ml.default).toBe(750);
  });

  test('cold race (<10°C) decreases fluid linearly', () => {
    const targets = computeRaceTargets({
      profile: makeBaseProfile(),
      race: makeBaseRace({ temperature_c: 5 }),
      durationMin: 180,
    });
    // 500 - (10-5)*50 = 250, * 1.0 = 250
    expect(targets.fluid_per_hour_ml.default).toBe(250);
  });

  test('humidity high multiplies fluid by 1.15', () => {
    const targets = computeRaceTargets({
      profile: makeBaseProfile(),
      race: makeBaseRace({ humidity_high: true }),
      durationMin: 180,
    });
    // 500 * 1.15 = 575
    expect(targets.fluid_per_hour_ml.default).toBe(575);
  });

  test('exposure sun multiplies fluid by 1.10', () => {
    const targets = computeRaceTargets({
      profile: makeBaseProfile(),
      race: makeBaseRace({ exposure: 'sun' }),
      durationMin: 180,
    });
    // 500 * 1.10 = 550
    expect(targets.fluid_per_hour_ml.default).toBe(550);
  });

  test('sodium gets +100 for duration > 180', () => {
    const targets = computeRaceTargets({
      profile: makeBaseProfile(),
      race: makeBaseRace(),
      durationMin: 240,
    });
    expect(targets.sodium_per_hour_mg.default).toBe(600);
  });

  test('sodium gets +200 for temp > 25°C, +100 for long duration, +100 for humidity', () => {
    const targets = computeRaceTargets({
      profile: makeBaseProfile(),
      race: makeBaseRace({ temperature_c: 30, humidity_high: true }),
      durationMin: 240,
    });
    // 500 + 100 (>180min) + 200 (>25°C) + 100 (humidity) = 900
    expect(targets.sodium_per_hour_mg.default).toBe(900);
  });

  test('race overrides take precedence over modifiers', () => {
    const targets = computeRaceTargets({
      profile: makeBaseProfile(),
      race: makeBaseRace({
        temperature_c: 30,
        humidity_high: true,
        overrides: { carbs_per_hour_g: 100, fluid_per_hour_ml: 800 },
      }),
      durationMin: 240,
    });
    expect(targets.carbs_per_hour_g.default).toBe(100);
    expect(targets.fluid_per_hour_ml.default).toBe(800);
  });
});
