import type { SQLiteDatabase } from 'expo-sqlite';

import type { Profile } from '../../models/profile';
import { DEFAULT_PROFILE } from '../../models/profile';

type ProfileRow = {
  id: number;
  weight_kg: number;
  carbs_per_hour_g: number;
  fluid_per_hour_ml: number;
  sodium_per_hour_mg: number;
  flat_pace_min_per_km: number;
  pace_calibration_factor: number;
  gel_tolerance: 'high' | 'medium' | 'low';
  solid_food_tolerance: 'high' | 'medium' | 'low';
  updated_at: number;
};

function rowToProfile(row: ProfileRow): Profile {
  return {
    id: row.id,
    weight_kg: row.weight_kg,
    carbs_per_hour_g: row.carbs_per_hour_g,
    fluid_per_hour_ml: row.fluid_per_hour_ml,
    sodium_per_hour_mg: row.sodium_per_hour_mg,
    flat_pace_min_per_km: row.flat_pace_min_per_km,
    pace_calibration_factor: row.pace_calibration_factor,
    preferences: {
      gel_tolerance: row.gel_tolerance,
      solid_food_tolerance: row.solid_food_tolerance,
    },
    updated_at: row.updated_at,
  };
}

export async function getOrCreateProfile(
  db: SQLiteDatabase,
  now: number = Date.now(),
): Promise<Profile> {
  const existing = await db.getFirstAsync<ProfileRow>(
    'SELECT * FROM profiles ORDER BY id ASC LIMIT 1',
  );
  if (existing) return rowToProfile(existing);

  const result = await db.runAsync(
    `INSERT INTO profiles
      (weight_kg, carbs_per_hour_g, fluid_per_hour_ml, sodium_per_hour_mg,
       flat_pace_min_per_km, pace_calibration_factor,
       gel_tolerance, solid_food_tolerance, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      DEFAULT_PROFILE.weight_kg,
      DEFAULT_PROFILE.carbs_per_hour_g,
      DEFAULT_PROFILE.fluid_per_hour_ml,
      DEFAULT_PROFILE.sodium_per_hour_mg,
      DEFAULT_PROFILE.flat_pace_min_per_km,
      DEFAULT_PROFILE.pace_calibration_factor,
      DEFAULT_PROFILE.preferences.gel_tolerance,
      DEFAULT_PROFILE.preferences.solid_food_tolerance,
      now,
    ],
  );

  return {
    id: result.lastInsertRowId,
    ...DEFAULT_PROFILE,
    updated_at: now,
  };
}

export async function updateProfile(
  db: SQLiteDatabase,
  profile: Profile,
  now: number = Date.now(),
): Promise<Profile> {
  await db.runAsync(
    `UPDATE profiles SET
       weight_kg = ?, carbs_per_hour_g = ?, fluid_per_hour_ml = ?,
       sodium_per_hour_mg = ?, flat_pace_min_per_km = ?,
       pace_calibration_factor = ?, gel_tolerance = ?,
       solid_food_tolerance = ?, updated_at = ?
     WHERE id = ?`,
    [
      profile.weight_kg,
      profile.carbs_per_hour_g,
      profile.fluid_per_hour_ml,
      profile.sodium_per_hour_mg,
      profile.flat_pace_min_per_km,
      profile.pace_calibration_factor,
      profile.preferences.gel_tolerance,
      profile.preferences.solid_food_tolerance,
      now,
      profile.id,
    ],
  );
  return { ...profile, updated_at: now };
}
