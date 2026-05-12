import { resolveParams } from '../../planning/resolve-params';
import { makeBaseProfile, makeBaseRace } from '../fixtures/races/base-race';

describe('resolveParams', () => {
  describe('alert thresholds derived from session_type', () => {
    it('competition uses tightened thresholds (1 skip, 20% deficit)', () => {
      const params = resolveParams({
        profile: makeBaseProfile(),
        race: makeBaseRace({ session_type: 'competition' }),
        durationMin: 180,
      });
      expect(params.skip_alert_threshold).toBe(1);
      expect(params.deficit_alert_pct).toBeCloseTo(0.20, 6);
    });

    it('long uses normal thresholds (2 skips, 30% deficit)', () => {
      const params = resolveParams({
        profile: makeBaseProfile(),
        race: makeBaseRace({ session_type: 'long' }),
        durationMin: 180,
      });
      expect(params.skip_alert_threshold).toBe(2);
      expect(params.deficit_alert_pct).toBeCloseTo(0.30, 6);
    });

    it('plaisir uses normal thresholds (2 skips, 30% deficit)', () => {
      const params = resolveParams({
        profile: makeBaseProfile(),
        race: makeBaseRace({ session_type: 'plaisir' }),
        durationMin: 180,
      });
      expect(params.skip_alert_threshold).toBe(2);
      expect(params.deficit_alert_pct).toBeCloseTo(0.30, 6);
    });
  });

  describe('check-in frequency from session_type', () => {
    it.each([
      ['plaisir', 60],
      ['long', 50],
      ['dur', 45],
      ['test', 40],
      ['competition', 45],
    ] as const)('%s → %i min', (sessionType, expected) => {
      const params = resolveParams({
        profile: makeBaseProfile(),
        race: makeBaseRace({ session_type: sessionType }),
        durationMin: 180,
      });
      expect(params.check_in_frequency_min).toBe(expected);
    });
  });

  describe('carbs', () => {
    it('applies the session intensity modifier (long = 1.0)', () => {
      const params = resolveParams({
        profile: makeBaseProfile({ carbs_per_hour_g: 60 }),
        race: makeBaseRace({ session_type: 'long' }),
        durationMin: 180,
      });
      expect(params.carbs_per_hour_g).toBeCloseTo(60, 6);
    });

    it('applies the session intensity modifier (competition = 1.20)', () => {
      const params = resolveParams({
        profile: makeBaseProfile({ carbs_per_hour_g: 60 }),
        race: makeBaseRace({ session_type: 'competition' }),
        durationMin: 180,
      });
      expect(params.carbs_per_hour_g).toBeCloseTo(72, 6);
    });

    it('override takes precedence over the session modifier', () => {
      const params = resolveParams({
        profile: makeBaseProfile({ carbs_per_hour_g: 60 }),
        race: makeBaseRace({
          session_type: 'competition',
          overrides: { carbs_per_hour_g: 90 },
        }),
        durationMin: 180,
      });
      expect(params.carbs_per_hour_g).toBe(90);
    });
  });

  describe('fluid modifiers', () => {
    it('adds 50 ml/h per °C above 20°C', () => {
      const params = resolveParams({
        profile: makeBaseProfile({ fluid_per_hour_ml: 500 }),
        race: makeBaseRace({ temperature_c: 25, exposure: 'variable' }),
        durationMin: 180,
      });
      expect(params.fluid_per_hour_ml).toBeCloseTo(750, 6);
    });

    it('subtracts 50 ml/h per °C below 10°C (above the floor)', () => {
      const params = resolveParams({
        profile: makeBaseProfile({ fluid_per_hour_ml: 500 }),
        race: makeBaseRace({ temperature_c: 7, exposure: 'variable' }),
        durationMin: 180,
      });
      expect(params.fluid_per_hour_ml).toBeCloseTo(500 + (7 - 10) * 50, 6);
    });

    it('high humidity multiplies by 1.15', () => {
      const params = resolveParams({
        profile: makeBaseProfile({ fluid_per_hour_ml: 500 }),
        race: makeBaseRace({ humidity_high: true, exposure: 'variable' }),
        durationMin: 180,
      });
      expect(params.fluid_per_hour_ml).toBeCloseTo(500 * 1.15, 6);
    });

    it('clamps to ceiling 800 ml/h on extreme heat', () => {
      const params = resolveParams({
        profile: makeBaseProfile({ fluid_per_hour_ml: 500 }),
        race: makeBaseRace({ temperature_c: 40, humidity_high: true, exposure: 'sun' }),
        durationMin: 180,
      });
      expect(params.fluid_per_hour_ml).toBe(800);
    });

    it('clamps to floor 300 ml/h on extreme cold', () => {
      const params = resolveParams({
        profile: makeBaseProfile({ fluid_per_hour_ml: 500 }),
        race: makeBaseRace({ temperature_c: -10, exposure: 'shade' }),
        durationMin: 180,
      });
      expect(params.fluid_per_hour_ml).toBe(300);
    });

    it('exposure sun adds 10%', () => {
      const variable = resolveParams({
        profile: makeBaseProfile({ fluid_per_hour_ml: 500 }),
        race: makeBaseRace({ exposure: 'variable' }),
        durationMin: 180,
      });
      const sun = resolveParams({
        profile: makeBaseProfile({ fluid_per_hour_ml: 500 }),
        race: makeBaseRace({ exposure: 'sun' }),
        durationMin: 180,
      });
      expect(sun.fluid_per_hour_ml).toBeCloseTo(variable.fluid_per_hour_ml * 1.10, 6);
    });

    it('override takes precedence over modifiers', () => {
      const params = resolveParams({
        profile: makeBaseProfile({ fluid_per_hour_ml: 500 }),
        race: makeBaseRace({
          temperature_c: 30,
          humidity_high: true,
          overrides: { fluid_per_hour_ml: 600 },
        }),
        durationMin: 180,
      });
      expect(params.fluid_per_hour_ml).toBe(600);
    });
  });

  describe('sodium modifiers', () => {
    it('adds +100 mg/h when duration > 180 min', () => {
      const short = resolveParams({
        profile: makeBaseProfile({ sodium_per_hour_mg: 500 }),
        race: makeBaseRace(),
        durationMin: 120,
      });
      const long = resolveParams({
        profile: makeBaseProfile({ sodium_per_hour_mg: 500 }),
        race: makeBaseRace(),
        durationMin: 200,
      });
      expect(long.sodium_per_hour_mg - short.sodium_per_hour_mg).toBeCloseTo(100, 6);
    });

    it('adds +200 mg/h when temperature > 25°C', () => {
      const cool = resolveParams({
        profile: makeBaseProfile({ sodium_per_hour_mg: 500 }),
        race: makeBaseRace({ temperature_c: 20 }),
        durationMin: 120,
      });
      const hot = resolveParams({
        profile: makeBaseProfile({ sodium_per_hour_mg: 500 }),
        race: makeBaseRace({ temperature_c: 30 }),
        durationMin: 120,
      });
      expect(hot.sodium_per_hour_mg - cool.sodium_per_hour_mg).toBeCloseTo(200, 6);
    });

    it('adds +100 mg/h when humidity is high', () => {
      const dry = resolveParams({
        profile: makeBaseProfile({ sodium_per_hour_mg: 500 }),
        race: makeBaseRace({ humidity_high: false }),
        durationMin: 120,
      });
      const humid = resolveParams({
        profile: makeBaseProfile({ sodium_per_hour_mg: 500 }),
        race: makeBaseRace({ humidity_high: true }),
        durationMin: 120,
      });
      expect(humid.sodium_per_hour_mg - dry.sodium_per_hour_mg).toBeCloseTo(100, 6);
    });

    it('clamps to ceiling 1000 mg/h on extreme conditions', () => {
      const params = resolveParams({
        profile: makeBaseProfile({ sodium_per_hour_mg: 700 }),
        race: makeBaseRace({ temperature_c: 35, humidity_high: true }),
        durationMin: 240,
      });
      expect(params.sodium_per_hour_mg).toBe(1000);
    });
  });

  describe('first_intake_after_min', () => {
    it('defaults to 30 min', () => {
      const params = resolveParams({
        profile: makeBaseProfile(),
        race: makeBaseRace(),
        durationMin: 180,
      });
      expect(params.first_intake_after_min).toBe(30);
    });

    it('respects the override', () => {
      const params = resolveParams({
        profile: makeBaseProfile(),
        race: makeBaseRace({ overrides: { first_intake_after_min: 20 } }),
        durationMin: 180,
      });
      expect(params.first_intake_after_min).toBe(20);
    });
  });

  describe('fluid reminders', () => {
    it('defaults to first_fluid_reminder_min=15 and fluid_reminder_interval_min=30', () => {
      const params = resolveParams({
        profile: makeBaseProfile(),
        race: makeBaseRace(),
        durationMin: 180,
      });
      expect(params.first_fluid_reminder_min).toBe(15);
      expect(params.fluid_reminder_interval_min).toBe(30);
    });

    it('respects the first_fluid_reminder_min override', () => {
      const params = resolveParams({
        profile: makeBaseProfile(),
        race: makeBaseRace({ overrides: { first_fluid_reminder_min: 5 } }),
        durationMin: 180,
      });
      expect(params.first_fluid_reminder_min).toBe(5);
    });

    it('respects the fluid_reminder_interval_min override', () => {
      const params = resolveParams({
        profile: makeBaseProfile(),
        race: makeBaseRace({ overrides: { fluid_reminder_interval_min: 20 } }),
        durationMin: 180,
      });
      expect(params.fluid_reminder_interval_min).toBe(20);
    });

    it('clamps first_fluid_reminder_min into [0..240]', () => {
      const tooLow = resolveParams({
        profile: makeBaseProfile(),
        race: makeBaseRace({ overrides: { first_fluid_reminder_min: -10 } }),
        durationMin: 180,
      });
      expect(tooLow.first_fluid_reminder_min).toBe(0);

      const tooHigh = resolveParams({
        profile: makeBaseProfile(),
        race: makeBaseRace({ overrides: { first_fluid_reminder_min: 999 } }),
        durationMin: 180,
      });
      expect(tooHigh.first_fluid_reminder_min).toBe(240);
    });

    it('clamps fluid_reminder_interval_min into [1..120]', () => {
      const tooLow = resolveParams({
        profile: makeBaseProfile(),
        race: makeBaseRace({ overrides: { fluid_reminder_interval_min: 0 } }),
        durationMin: 180,
      });
      expect(tooLow.fluid_reminder_interval_min).toBe(1);

      const tooHigh = resolveParams({
        profile: makeBaseProfile(),
        race: makeBaseRace({ overrides: { fluid_reminder_interval_min: 999 } }),
        durationMin: 180,
      });
      expect(tooHigh.fluid_reminder_interval_min).toBe(120);
    });
  });
});
