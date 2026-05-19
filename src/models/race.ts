import type { AidStation } from './aid-station';
import type { GPXTrack } from './gpx-track';
import type { TimelinePlan } from './timeline-plan';

export type SessionType = 'plaisir' | 'long' | 'dur' | 'test' | 'competition';
export type Intensity = 'easy' | 'moderate' | 'hard';
export type Exposure = 'sun' | 'shade' | 'variable';
export type TerrainType = 'road' | 'rolling' | 'mixed_trail' | 'technical' | 'alpine';
export type RaceStatus = 'planned' | 'in_progress' | 'completed' | 'abandoned';

export type InventoryItem = {
  food_item_id: string;
  quantity: number;
};

export type RaceOverrides = {
  carbs_per_hour_g?: number;
  fluid_per_hour_ml?: number;
  first_intake_after_min?: number;
  check_in_frequency_min?: number;
  intake_interval_min?: number;
  first_fluid_reminder_min?: number;
  fluid_reminder_interval_min?: number;
};

export type PausedSegment = {
  from: number;
  to: number | null;
};

export type Race = {
  id: string;
  created_at: number;
  name?: string;
  session_type: SessionType;
  gpx_track?: GPXTrack;
  estimated_duration_min: number;
  intensity: Intensity;
  temperature_c: number;
  humidity_high: boolean;
  exposure: Exposure;
  terrain_type: TerrainType;
  inventory: InventoryItem[];
  refill_in_nature: boolean;
  aid_stations: AidStation[];
  overrides?: RaceOverrides;
  scheduled_start_at: number;
  started_at: number | null;
  ended_at: number | null;
  paused_segments: PausedSegment[];
  scheduled_notification_ids: string[];
  status: RaceStatus;
  // Used by the no-GPX fallback for duration estimation. Optional because the GPX path
  // overrides this entirely (track.total_distance_km / segments drive the timeline).
  distance_km?: number;
  elevation_gain_m?: number;
  elevation_loss_m?: number;
  /**
   * TimelinePlan persisté à la création de la race (engine brut ou enrichi
   * par le LLM via le companion). Le runtime le matérialise en PlannedEvent[].
   * Optional : NULL sur les races créées avant la migration 007 → fallback
   * sur l'ancien pipeline generatePlan().
   */
  timeline_plan?: TimelinePlan;
};
