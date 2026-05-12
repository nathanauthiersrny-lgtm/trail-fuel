import type { KnowledgePack } from '../../models/knowledge-pack';
import type { Profile } from '../../models/profile';
import type { Intensity, Race } from '../../models/race';
import type { RaceRule } from '../../models/rule';
import {
  applyRaceRules,
  type RaceTargets,
} from '../rules/action';
import type { EvalContext } from '../rules/condition';

export type ResolvedParams = {
  carbs_per_hour_g: number;
  fluid_per_hour_ml: number;
  sodium_per_hour_mg: number;
  first_intake_after_min: number;
  check_in_frequency_min: number;
  intake_interval_min: number;
  first_fluid_reminder_min: number;
  fluid_reminder_interval_min: number;
  skip_alert_threshold: number;
  deficit_alert_pct: number;
  intensity: Intensity;
};

export function resolveParams(input: {
  profile: Profile;
  race: Race;
  durationMin: number;
  pack: KnowledgePack;
}): ResolvedParams {
  const { profile, race, durationMin, pack } = input;
  const defaults = pack.session_defaults[race.session_type];
  const overrides = race.overrides ?? {};

  const ctx = buildRaceContext(profile, race, durationMin);

  // Baseline rates from profile, before any rule-driven modifier kicks in.
  // Timing params come from pack defaults (session-independent for v1).
  const initial: RaceTargets = {
    carbs_per_hour_g: profile.carbs_per_hour_g,
    fluid_per_hour_ml: profile.fluid_per_hour_ml,
    sodium_per_hour_mg: profile.sodium_per_hour_mg,
    intensity_modifier: 1.0,
    first_intake_after_min: pack.param_defaults.first_intake_after_min,
    intake_interval_min: pack.param_defaults.intake_interval_min,
    first_fluid_reminder_min: pack.param_defaults.first_fluid_reminder_min,
    fluid_reminder_interval_min: pack.param_defaults.fluid_reminder_interval_min,
    check_in_frequency_min: defaults.check_in_freq_min,
  };

  // Race rules. Lock fields that the user overrode at the race level so rules
  // don't fight a deliberate override — matches the pre-rules-engine behavior.
  const lockedTargets = collectLockedTargets(overrides);
  const eligibleRules = pack.rules
    .filter((r): r is RaceRule => r.scope === 'race')
    .filter((r) => !lockedTargets.has(r.action.target));
  const afterRules = applyRaceRules(eligibleRules, ctx, initial);

  // Rate finalization :
  //  - carbs : override wins as-is (no clamp historically)
  //  - fluid : override wins as-is, else apply rate clamp on rule-modified value
  //  - sodium : no override field, rule-modified value always clamped
  const carbs = overrides.carbs_per_hour_g ?? afterRules.carbs_per_hour_g;
  const fluid =
    overrides.fluid_per_hour_ml ??
    clamp(
      afterRules.fluid_per_hour_ml,
      pack.rate_bounds.fluid_floor_ml,
      pack.rate_bounds.fluid_ceiling_ml,
    );
  const sodium = clamp(
    afterRules.sodium_per_hour_mg,
    pack.rate_bounds.sodium_floor_mg,
    pack.rate_bounds.sodium_ceiling_mg,
  );

  const c = pack.param_clamps;
  return {
    carbs_per_hour_g: carbs,
    fluid_per_hour_ml: fluid,
    sodium_per_hour_mg: sodium,
    first_intake_after_min: clamp(
      overrides.first_intake_after_min ?? afterRules.first_intake_after_min,
      c.first_intake_after_min.min,
      c.first_intake_after_min.max,
    ),
    check_in_frequency_min: clamp(
      overrides.check_in_frequency_min ?? afterRules.check_in_frequency_min,
      c.check_in_frequency_min.min,
      c.check_in_frequency_min.max,
    ),
    intake_interval_min: clamp(
      overrides.intake_interval_min ?? afterRules.intake_interval_min,
      c.intake_interval_min.min,
      c.intake_interval_min.max,
    ),
    first_fluid_reminder_min: clamp(
      overrides.first_fluid_reminder_min ?? afterRules.first_fluid_reminder_min,
      c.first_fluid_reminder_min.min,
      c.first_fluid_reminder_min.max,
    ),
    fluid_reminder_interval_min: clamp(
      overrides.fluid_reminder_interval_min ?? afterRules.fluid_reminder_interval_min,
      c.fluid_reminder_interval_min.min,
      c.fluid_reminder_interval_min.max,
    ),
    skip_alert_threshold: defaults.skip_alert_threshold,
    deficit_alert_pct: defaults.deficit_alert_pct,
    intensity: race.intensity ?? defaults.intensity,
  };
}

function buildRaceContext(profile: Profile, race: Race, durationMin: number): EvalContext {
  return {
    session_type: race.session_type,
    intensity: race.intensity,
    temperature_c: race.temperature_c,
    humidity_high: race.humidity_high,
    exposure: race.exposure,
    terrain_type: race.terrain_type,
    duration_min: durationMin,
    refill_in_nature: race.refill_in_nature,
    has_gpx: race.gpx_track !== undefined,
    total_elevation_gain_m: race.gpx_track?.total_elevation_gain_m ?? 0,
    total_distance_km: race.gpx_track?.total_distance_km ?? 0,
    carbs_per_hour_g_base: profile.carbs_per_hour_g,
    fluid_per_hour_ml_base: profile.fluid_per_hour_ml,
    sodium_per_hour_mg_base: profile.sodium_per_hour_mg,
  };
}

function collectLockedTargets(overrides: NonNullable<Race['overrides']>): Set<string> {
  const locked = new Set<string>();
  if (overrides.carbs_per_hour_g !== undefined) locked.add('carbs_per_hour_g');
  if (overrides.fluid_per_hour_ml !== undefined) locked.add('fluid_per_hour_ml');
  // Timing overrides are applied AFTER rules + clamps, so we don't lock them
  // here — rules that target them still run, and the override replaces the
  // result at the end. This preserves the old behavior where overrides flow
  // through the clamp pipeline.
  return locked;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
