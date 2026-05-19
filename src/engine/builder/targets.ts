/**
 * computeRaceTargets — produit les targets carbs/fluid/sodium pour une race.
 *
 * Fonction pure, déterministe, sans rules engine. Les modificateurs (chaleur,
 * humidité, durée, intensité) sont en TS direct depuis ./constants. Le LLM
 * du companion enrichira le plan en aval avec les patterns plus complexes
 * (G1 modulation temporelle, G2 séquences) issus de la KB.
 */

import type { Profile } from '../../models/profile';
import type { Race } from '../../models/race';
import type { RaceTargets, TargetTimeline } from '../../models/timeline-plan';
import {
  EXPOSURE_MODIFIERS,
  FLUID_MODIFIERS,
  SESSION_DEFAULTS,
  SODIUM_MODIFIERS,
} from './constants';

export type ComputeTargetsInput = {
  profile: Profile;
  race: Race;
  durationMin: number;
};

export function computeRaceTargets(input: ComputeTargetsInput): RaceTargets {
  const { profile, race, durationMin } = input;
  const session = SESSION_DEFAULTS[race.session_type];

  // ── Carbs : profile baseline × intensity_modifier, override race level si présent.
  const carbsBase = race.overrides?.carbs_per_hour_g
    ?? profile.carbs_per_hour_g * session.intensity_modifier;

  // ── Fluid : profile baseline modulé par température + humidité + exposure.
  const fluidBase = race.overrides?.fluid_per_hour_ml
    ?? applyFluidModifiers({
      base: profile.fluid_per_hour_ml,
      temperature_c: race.temperature_c,
      humidity_high: race.humidity_high,
      exposure: race.exposure,
    });

  // ── Sodium : profile baseline + bonus durée + bonus chaleur + bonus humidité.
  const sodiumBase = applySodiumModifiers({
    base: profile.sodium_per_hour_mg,
    temperature_c: race.temperature_c,
    humidity_high: race.humidity_high,
    durationMin,
  });

  return {
    carbs_per_hour_g: scalarTarget(carbsBase),
    fluid_per_hour_ml: scalarTarget(fluidBase),
    sodium_per_hour_mg: scalarTarget(sodiumBase),
  };
}

function scalarTarget(value: number): TargetTimeline {
  return { default: Math.round(value) };
}

// ─── Fluid modifiers ────────────────────────────────────────────────────────

function applyFluidModifiers(input: {
  base: number;
  temperature_c: number;
  humidity_high: boolean;
  exposure: Race['exposure'];
}): number {
  const { base, temperature_c, humidity_high, exposure } = input;
  const m = FLUID_MODIFIERS;
  let value = base;

  if (temperature_c > m.temperature.hot_threshold_c) {
    value += (temperature_c - m.temperature.hot_threshold_c) * m.temperature.hot_increment_per_c;
  } else if (temperature_c < m.temperature.cold_threshold_c) {
    value -= (m.temperature.cold_threshold_c - temperature_c) * m.temperature.cold_increment_per_c;
  }

  if (humidity_high) value *= m.humidity_high_factor;
  value *= EXPOSURE_MODIFIERS[exposure];

  return value;
}

// ─── Sodium modifiers ───────────────────────────────────────────────────────

function applySodiumModifiers(input: {
  base: number;
  temperature_c: number;
  humidity_high: boolean;
  durationMin: number;
}): number {
  const { base, temperature_c, humidity_high, durationMin } = input;
  const m = SODIUM_MODIFIERS;
  let value = base;

  if (durationMin > m.long_duration_threshold_min) value += m.long_duration_add_mg;
  if (temperature_c > m.hot_temperature_threshold_c) value += m.hot_temperature_add_mg;
  if (humidity_high) value += m.humidity_high_add_mg;

  return value;
}
