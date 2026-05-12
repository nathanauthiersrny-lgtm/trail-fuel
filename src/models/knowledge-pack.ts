import type { Exposure, Intensity, SessionType } from './race';

export type KnowledgePackVersion = `${number}.${number}.${number}`;

export type SessionDefaults = {
  intensity: Intensity;
  intensity_modifier: number;
  check_in_freq_min: number;
  skip_alert_threshold: number;
  deficit_alert_pct: number;
};

export type ParamRange = { min: number; max: number };

export type KnowledgePack = {
  version: KnowledgePackVersion;

  session_defaults: Record<SessionType, SessionDefaults>;

  param_defaults: {
    first_intake_after_min: number;
    intake_interval_min: number;
    first_fluid_reminder_min: number;
    fluid_reminder_interval_min: number;
  };

  param_clamps: {
    first_intake_after_min: ParamRange;
    intake_interval_min: ParamRange;
    check_in_frequency_min: ParamRange;
    first_fluid_reminder_min: ParamRange;
    fluid_reminder_interval_min: ParamRange;
  };

  rate_bounds: {
    fluid_floor_ml: number;
    fluid_ceiling_ml: number;
    sodium_floor_mg: number;
    sodium_ceiling_mg: number;
  };

  fluid_modifiers: {
    temperature: {
      hot_threshold_c: number;
      hot_increment_per_c: number;
      cold_threshold_c: number;
      cold_increment_per_c: number;
    };
    humidity_high_factor: number;
  };

  sodium_modifiers: {
    long_duration_threshold_min: number;
    long_duration_add_mg: number;
    hot_temperature_threshold_c: number;
    hot_temperature_add_mg: number;
    humidity_high_add_mg: number;
  };

  exposure_modifiers: Record<Exposure, number>;

  first_hour: {
    reduction_factor: number;
    duration_min: number;
  };

  aid_station_estimates: {
    carbs_per_solid_stop_g: number;
    carbs_per_isotonic_stop_g: number;
    fluid_per_water_stop_ml: number;
    fluid_per_isotonic_stop_ml: number;
  };

  feasibility_threshold: number;
};

export const SUPPORTED_PACK_MAJOR = 1;
