/**
 * Builder constants — extraits de assets/knowledge/v1.json mais en code TS direct.
 *
 * Pas un DSL : ce sont des constantes physiologiques + bornes. Les rules d'ajustement
 * (chaleur, humidité, durée) sont implémentées en TypeScript dans targets.ts.
 *
 * Pour ajouter un modificateur : on touche directement ce fichier + targets.ts.
 * Pour ajouter un *principe* (article scientifique, note coach), on l'écrit dans
 * la KB markdown du companion et le LLM enrichment patche le plan.
 */

import type { Intensity, SessionType } from '../../models/race';

export type SessionDefaults = {
  intensity: Intensity;
  intensity_modifier: number;
  check_in_freq_min: number;
  skip_alert_threshold: number;
  deficit_alert_pct: number;
};

export const SESSION_DEFAULTS: Record<SessionType, SessionDefaults> = {
  plaisir:     { intensity: 'easy',     intensity_modifier: 0.85, check_in_freq_min: 60, skip_alert_threshold: 2, deficit_alert_pct: 0.30 },
  long:        { intensity: 'moderate', intensity_modifier: 1.00, check_in_freq_min: 50, skip_alert_threshold: 2, deficit_alert_pct: 0.30 },
  dur:         { intensity: 'hard',     intensity_modifier: 1.15, check_in_freq_min: 45, skip_alert_threshold: 2, deficit_alert_pct: 0.30 },
  test:        { intensity: 'moderate', intensity_modifier: 1.00, check_in_freq_min: 40, skip_alert_threshold: 2, deficit_alert_pct: 0.30 },
  competition: { intensity: 'hard',     intensity_modifier: 1.20, check_in_freq_min: 45, skip_alert_threshold: 1, deficit_alert_pct: 0.20 },
};

export const PARAM_DEFAULTS = {
  first_intake_after_min: 30,
  intake_interval_min: 20,
  first_fluid_reminder_min: 15,
  fluid_reminder_interval_min: 30,
} as const;

/**
 * Safety bounds — bornes physiologiques que le validator applique en dur sur le
 * plan final, peu importe qui l'a produit (engine ou LLM). Voir safety.ts.
 *
 * Sources : Costa et al. 2019, Hoffman & Stuempfle 2015, consensus communauté trail.
 */
export const SAFETY_BOUNDS = {
  carbs_per_hour_g: { min: 30, max: 120 },
  fluid_per_hour_ml: { min: 300, max: 1000 },
  sodium_per_hour_mg: { min: 300, max: 1500 },
  intake_interval_min: { min: 10, max: 90 },
  check_in_frequency_min: { min: 20, max: 120 },
  first_intake_after_min: { min: 0, max: 60 },
} as const;

/**
 * Fluid modifiers — ajustements linéaires sur fluid_per_hour_ml en fonction
 * de la température et de l'humidité.
 *
 * Source : sodium-baseline.md (companion KB) + connaissance de base trail.
 */
export const FLUID_MODIFIERS = {
  temperature: {
    hot_threshold_c: 20,
    hot_increment_per_c: 50,
    cold_threshold_c: 10,
    cold_increment_per_c: 50, // soustrait par degré sous le seuil
  },
  humidity_high_factor: 1.15,
} as const;

/**
 * Sodium modifiers — additions sur sodium_per_hour_mg selon durée, chaleur, humidité.
 *
 * Source : sodium-baseline.md (companion KB).
 */
export const SODIUM_MODIFIERS = {
  long_duration_threshold_min: 180,
  long_duration_add_mg: 100,
  hot_temperature_threshold_c: 25,
  hot_temperature_add_mg: 200,
  humidity_high_add_mg: 100,
} as const;

/**
 * Exposure modifiers — facteur appliqué sur fluid selon ensoleillement.
 */
export const EXPOSURE_MODIFIERS = {
  sun: 1.10,
  shade: 0.95,
  variable: 1.00,
} as const;

/**
 * Réduction de la 1re heure : on planifie moins agressivement le warmup pour
 * éviter les ennuis digestifs en début de course.
 */
export const FIRST_HOUR = {
  reduction_factor: 0.70,
  duration_min: 60,
} as const;
