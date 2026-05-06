import type { Profile } from '../../models/profile';
import type { Exposure, Intensity, Race, SessionType } from '../../models/race';

export type ResolvedParams = {
  carbs_per_hour_g: number;
  fluid_per_hour_ml: number;
  sodium_per_hour_mg: number;
  first_intake_after_min: number;
  check_in_frequency_min: number;
  intake_interval_min: number;
  skip_alert_threshold: number;
  deficit_alert_pct: number;
  intensity: Intensity;
};

type SessionDefaults = {
  intensity: Intensity;
  intensity_modifier: number;
  check_in_freq_min: number;
  skip_alert_threshold: number;
  deficit_alert_pct: number;
};

const SESSION_DEFAULTS: Record<SessionType, SessionDefaults> = {
  plaisir: {
    intensity: 'easy',
    intensity_modifier: 0.85,
    check_in_freq_min: 60,
    skip_alert_threshold: 2,
    deficit_alert_pct: 0.30,
  },
  long: {
    intensity: 'moderate',
    intensity_modifier: 1.0,
    check_in_freq_min: 50,
    skip_alert_threshold: 2,
    deficit_alert_pct: 0.30,
  },
  dur: {
    intensity: 'hard',
    intensity_modifier: 1.15,
    check_in_freq_min: 45,
    skip_alert_threshold: 2,
    deficit_alert_pct: 0.30,
  },
  test: {
    intensity: 'moderate',
    intensity_modifier: 1.0,
    check_in_freq_min: 40,
    skip_alert_threshold: 2,
    deficit_alert_pct: 0.30,
  },
  competition: {
    intensity: 'hard',
    intensity_modifier: 1.20,
    check_in_freq_min: 45,
    skip_alert_threshold: 1,
    deficit_alert_pct: 0.20,
  },
};

const FLUID_FLOOR_ML = 300;
const FLUID_CEILING_ML = 800;
const SODIUM_FLOOR_MG = 300;
const SODIUM_CEILING_MG = 1000;

const DEFAULT_FIRST_INTAKE_AFTER_MIN = 30;
const DEFAULT_INTAKE_INTERVAL_MIN = 20;

// Bornes de sécurité pour les overrides — évite des valeurs absurdes (0, négatives, ou
// trop grandes) qui casseraient les boucles de placement (placeIntakes itère par pas de
// intake_interval_min, et buildCheckIns par check_in_frequency_min).
const FIRST_INTAKE_MIN = 0;
const FIRST_INTAKE_MAX = 240;
const INTAKE_INTERVAL_MIN = 1;
const INTAKE_INTERVAL_MAX = 60;
const CHECK_IN_FREQ_MIN = 1;
const CHECK_IN_FREQ_MAX = 120;

function applyFluidModifiers(baseFluid: number, race: Race): number {
  let fluid = baseFluid;

  if (race.temperature_c > 20) fluid += (race.temperature_c - 20) * 50;
  else if (race.temperature_c < 10) fluid += (race.temperature_c - 10) * 50;

  if (race.humidity_high) fluid *= 1.15;

  fluid *= exposureModifier(race.exposure);

  return clamp(fluid, FLUID_FLOOR_ML, FLUID_CEILING_ML);
}

function applySodiumModifiers(
  baseSodium: number,
  race: Race,
  durationMin: number,
): number {
  let sodium = baseSodium;
  if (durationMin > 180) sodium += 100;
  if (race.temperature_c > 25) sodium += 200;
  if (race.humidity_high) sodium += 100;
  return clamp(sodium, SODIUM_FLOOR_MG, SODIUM_CEILING_MG);
}

function exposureModifier(exposure: Exposure): number {
  switch (exposure) {
    case 'sun':
      return 1.10;
    case 'shade':
      return 0.95;
    case 'variable':
      return 1.0;
  }
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function resolveParams(input: {
  profile: Profile;
  race: Race;
  durationMin: number;
}): ResolvedParams {
  const { profile, race, durationMin } = input;
  const defaults = SESSION_DEFAULTS[race.session_type];
  const overrides = race.overrides ?? {};

  const carbs =
    overrides.carbs_per_hour_g ??
    profile.carbs_per_hour_g * defaults.intensity_modifier;
  const fluid =
    overrides.fluid_per_hour_ml ?? applyFluidModifiers(profile.fluid_per_hour_ml, race);
  const sodium = applySodiumModifiers(profile.sodium_per_hour_mg, race, durationMin);

  const firstIntakeRaw = overrides.first_intake_after_min ?? DEFAULT_FIRST_INTAKE_AFTER_MIN;
  const checkInFreqRaw = overrides.check_in_frequency_min ?? defaults.check_in_freq_min;
  const intakeIntervalRaw = overrides.intake_interval_min ?? DEFAULT_INTAKE_INTERVAL_MIN;

  return {
    carbs_per_hour_g: carbs,
    fluid_per_hour_ml: fluid,
    sodium_per_hour_mg: sodium,
    first_intake_after_min: clamp(firstIntakeRaw, FIRST_INTAKE_MIN, FIRST_INTAKE_MAX),
    check_in_frequency_min: clamp(checkInFreqRaw, CHECK_IN_FREQ_MIN, CHECK_IN_FREQ_MAX),
    intake_interval_min: clamp(intakeIntervalRaw, INTAKE_INTERVAL_MIN, INTAKE_INTERVAL_MAX),
    skip_alert_threshold: defaults.skip_alert_threshold,
    deficit_alert_pct: defaults.deficit_alert_pct,
    intensity: race.intensity ?? defaults.intensity,
  };
}
