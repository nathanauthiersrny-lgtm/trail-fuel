import type { Profile } from '../../models/profile';
import type { Race } from '../../models/race';

import type { EvalContext } from './condition';

/**
 * Builds the race-level evaluation context : a flattened snapshot of the race,
 * profile, and derived GPX info that rules can match against. Shared between
 * race-scope rules (resolveParams) and window/intake_pick scope contexts
 * (placement) so all scopes see the same baseline.
 */
export function buildRaceContext(
  profile: Profile,
  race: Race,
  durationMin: number,
): EvalContext {
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
