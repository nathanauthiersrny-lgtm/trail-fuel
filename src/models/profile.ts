export type GelTolerance = 'high' | 'medium' | 'low';
export type SolidTolerance = 'high' | 'medium' | 'low';

export type ProfilePreferences = {
  gel_tolerance: GelTolerance;
  solid_food_tolerance: SolidTolerance;
};

export type Profile = {
  id: number;
  weight_kg: number;
  carbs_per_hour_g: number;
  fluid_per_hour_ml: number;
  sodium_per_hour_mg: number;
  flat_pace_min_per_km: number;
  pace_calibration_factor: number;
  preferences: ProfilePreferences;
  updated_at: number;
};

export const DEFAULT_PROFILE: Omit<Profile, 'id' | 'updated_at'> = {
  weight_kg: 70,
  carbs_per_hour_g: 60,
  fluid_per_hour_ml: 500,
  sodium_per_hour_mg: 500,
  flat_pace_min_per_km: 6.0,
  pace_calibration_factor: 1.0,
  preferences: {
    gel_tolerance: 'medium',
    solid_food_tolerance: 'medium',
  },
};
