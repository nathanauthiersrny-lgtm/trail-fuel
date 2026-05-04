export type GPXSegment = {
  km: number;
  elevation_m: number;
  gradient: number;
  estimated_time_min: number;
};

export type GPXTrack = {
  total_distance_km: number;
  total_elevation_gain_m: number;
  total_elevation_loss_m: number;
  segments: GPXSegment[];
};
