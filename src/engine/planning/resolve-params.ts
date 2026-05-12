import type { KnowledgePack } from '../../models/knowledge-pack';
import type { Profile } from '../../models/profile';
import type { Exposure, Intensity, Race } from '../../models/race';

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

  const carbs =
    overrides.carbs_per_hour_g ??
    profile.carbs_per_hour_g * defaults.intensity_modifier;
  const fluid =
    overrides.fluid_per_hour_ml ?? applyFluidModifiers(profile.fluid_per_hour_ml, race, pack);
  const sodium = applySodiumModifiers(profile.sodium_per_hour_mg, race, durationMin, pack);

  const firstIntakeRaw =
    overrides.first_intake_after_min ?? pack.param_defaults.first_intake_after_min;
  const checkInFreqRaw =
    overrides.check_in_frequency_min ?? defaults.check_in_freq_min;
  const intakeIntervalRaw =
    overrides.intake_interval_min ?? pack.param_defaults.intake_interval_min;
  const firstFluidRaw =
    overrides.first_fluid_reminder_min ?? pack.param_defaults.first_fluid_reminder_min;
  const fluidIntervalRaw =
    overrides.fluid_reminder_interval_min ??
    pack.param_defaults.fluid_reminder_interval_min;

  const c = pack.param_clamps;
  return {
    carbs_per_hour_g: carbs,
    fluid_per_hour_ml: fluid,
    sodium_per_hour_mg: sodium,
    first_intake_after_min: clamp(
      firstIntakeRaw,
      c.first_intake_after_min.min,
      c.first_intake_after_min.max,
    ),
    check_in_frequency_min: clamp(
      checkInFreqRaw,
      c.check_in_frequency_min.min,
      c.check_in_frequency_min.max,
    ),
    intake_interval_min: clamp(
      intakeIntervalRaw,
      c.intake_interval_min.min,
      c.intake_interval_min.max,
    ),
    first_fluid_reminder_min: clamp(
      firstFluidRaw,
      c.first_fluid_reminder_min.min,
      c.first_fluid_reminder_min.max,
    ),
    fluid_reminder_interval_min: clamp(
      fluidIntervalRaw,
      c.fluid_reminder_interval_min.min,
      c.fluid_reminder_interval_min.max,
    ),
    skip_alert_threshold: defaults.skip_alert_threshold,
    deficit_alert_pct: defaults.deficit_alert_pct,
    intensity: race.intensity ?? defaults.intensity,
  };
}

function applyFluidModifiers(
  baseFluid: number,
  race: Race,
  pack: KnowledgePack,
): number {
  let fluid = baseFluid;
  const temp = pack.fluid_modifiers.temperature;

  if (race.temperature_c > temp.hot_threshold_c) {
    fluid += (race.temperature_c - temp.hot_threshold_c) * temp.hot_increment_per_c;
  } else if (race.temperature_c < temp.cold_threshold_c) {
    fluid +=
      (race.temperature_c - temp.cold_threshold_c) * temp.cold_increment_per_c;
  }

  if (race.humidity_high) fluid *= pack.fluid_modifiers.humidity_high_factor;

  fluid *= exposureModifier(race.exposure, pack);

  return clamp(fluid, pack.rate_bounds.fluid_floor_ml, pack.rate_bounds.fluid_ceiling_ml);
}

function applySodiumModifiers(
  baseSodium: number,
  race: Race,
  durationMin: number,
  pack: KnowledgePack,
): number {
  let sodium = baseSodium;
  const mods = pack.sodium_modifiers;
  if (durationMin > mods.long_duration_threshold_min) sodium += mods.long_duration_add_mg;
  if (race.temperature_c > mods.hot_temperature_threshold_c) {
    sodium += mods.hot_temperature_add_mg;
  }
  if (race.humidity_high) sodium += mods.humidity_high_add_mg;
  return clamp(sodium, pack.rate_bounds.sodium_floor_mg, pack.rate_bounds.sodium_ceiling_mg);
}

function exposureModifier(exposure: Exposure, pack: KnowledgePack): number {
  return pack.exposure_modifiers[exposure];
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
