import type { Race } from '../models/race';
import type { RaceCreationDraft } from './race-creation-store';

function generateLocalId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}-${Math.random().toString(36).slice(2, 9)}`;
}

export function draftToRace(draft: RaceCreationDraft): Race {
  if (!draft.session_type) throw new Error('draftToRace: session_type is required');
  if (!draft.intensity) throw new Error('draftToRace: intensity is required');
  if (!draft.estimated_duration_min) throw new Error('draftToRace: estimated_duration_min is required (must be > 0)');
  if (!draft.terrain_type) throw new Error('draftToRace: terrain_type is required');

  return {
    id: generateLocalId(),
    created_at: Date.now(),
    ...(draft.name ? { name: draft.name } : {}),
    session_type: draft.session_type,
    ...(draft.gpx_track ? { gpx_track: draft.gpx_track } : {}),
    estimated_duration_min: draft.estimated_duration_min,
    intensity: draft.intensity,
    temperature_c: draft.temperature_c,
    humidity_high: draft.humidity_high,
    exposure: draft.exposure,
    terrain_type: draft.terrain_type,
    inventory: draft.inventory,
    refill_in_nature: draft.refill_in_nature,
    aid_stations: draft.aid_stations,
    ...(draft.overrides ? { overrides: draft.overrides } : {}),
    scheduled_start_at: draft.scheduled_start_at,
    started_at: null,
    ended_at: null,
    paused_segments: [],
    scheduled_notification_ids: [],
    status: 'planned',
    ...(draft.distance_km !== null ? { distance_km: draft.distance_km } : {}),
    ...(draft.elevation_gain_m !== null ? { elevation_gain_m: draft.elevation_gain_m } : {}),
    ...(draft.elevation_loss_m !== null ? { elevation_loss_m: draft.elevation_loss_m } : {}),
  };
}
