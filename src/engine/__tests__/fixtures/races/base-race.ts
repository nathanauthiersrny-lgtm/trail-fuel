import type { Profile } from '../../../../models/profile';
import type { Race } from '../../../../models/race';

export function makeBaseProfile(overrides: Partial<Profile> = {}): Profile {
  return {
    id: 1,
    weight_kg: 70,
    carbs_per_hour_g: 60,
    fluid_per_hour_ml: 500,
    sodium_per_hour_mg: 500,
    flat_pace_min_per_km: 6,
    pace_calibration_factor: 1.0,
    preferences: { gel_tolerance: 'medium', solid_food_tolerance: 'medium' },
    disabled_rule_ids: [],
    updated_at: 0,
    ...overrides,
  };
}

export function makeBaseRace(overrides: Partial<Race> = {}): Race {
  return {
    id: 'race-test',
    created_at: 0,
    session_type: 'long',
    estimated_duration_min: 180,
    intensity: 'moderate',
    temperature_c: 15,
    humidity_high: false,
    exposure: 'variable',
    terrain_type: 'rolling',
    inventory: [],
    refill_in_nature: false,
    aid_stations: [],
    scheduled_start_at: 0,
    started_at: null,
    ended_at: null,
    paused_segments: [],
    scheduled_notification_ids: [],
    status: 'planned',
    ...overrides,
  };
}
