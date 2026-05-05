import type { SQLiteDatabase } from 'expo-sqlite';

import type { AidStation } from '../../models/aid-station';
import type { GPXTrack } from '../../models/gpx-track';
import type {
  InventoryItem,
  PausedSegment,
  Race,
  RaceOverrides,
  RaceStatus,
} from '../../models/race';

// ─── Row type ───────────────────────────────────────────────────────────────

export type RaceRow = {
  id: string;
  created_at: number;
  name: string | null;
  session_type: string;
  gpx_track_json: string | null;
  estimated_duration_min: number;
  intensity: string;
  temperature_c: number;
  humidity_high: 0 | 1;
  exposure: string;
  terrain_type: string;
  inventory_json: string;
  refill_in_nature: 0 | 1;
  aid_stations_json: string;
  overrides_json: string | null;
  scheduled_start_at: number;
  started_at: number | null;
  ended_at: number | null;
  paused_segments_json: string;
  scheduled_notification_ids_json: string;
  status: string;
  distance_km: number | null;
  elevation_gain_m: number | null;
  elevation_loss_m: number | null;
};

// ─── Serialization ──────────────────────────────────────────────────────────

export function toRow(race: Race): RaceRow {
  return {
    id: race.id,
    created_at: race.created_at,
    name: race.name ?? null,
    session_type: race.session_type,
    gpx_track_json: race.gpx_track ? JSON.stringify(race.gpx_track) : null,
    estimated_duration_min: race.estimated_duration_min,
    intensity: race.intensity,
    temperature_c: race.temperature_c,
    humidity_high: race.humidity_high ? 1 : 0,
    exposure: race.exposure,
    terrain_type: race.terrain_type,
    inventory_json: JSON.stringify(race.inventory),
    refill_in_nature: race.refill_in_nature ? 1 : 0,
    aid_stations_json: JSON.stringify(race.aid_stations),
    overrides_json: race.overrides ? JSON.stringify(race.overrides) : null,
    scheduled_start_at: race.scheduled_start_at,
    started_at: race.started_at,
    ended_at: race.ended_at,
    paused_segments_json: JSON.stringify(race.paused_segments),
    scheduled_notification_ids_json: JSON.stringify(
      race.scheduled_notification_ids,
    ),
    status: race.status,
    distance_km: race.distance_km ?? null,
    elevation_gain_m: race.elevation_gain_m ?? null,
    elevation_loss_m: race.elevation_loss_m ?? null,
  };
}

export function fromRow(row: RaceRow): Race {
  return {
    id: row.id,
    created_at: row.created_at,
    ...(row.name !== null ? { name: row.name } : {}),
    session_type: row.session_type as Race['session_type'],
    ...(row.gpx_track_json !== null
      ? { gpx_track: JSON.parse(row.gpx_track_json) as GPXTrack }
      : {}),
    estimated_duration_min: row.estimated_duration_min,
    intensity: row.intensity as Race['intensity'],
    temperature_c: row.temperature_c,
    humidity_high: row.humidity_high === 1,
    exposure: row.exposure as Race['exposure'],
    terrain_type: row.terrain_type as Race['terrain_type'],
    inventory: JSON.parse(row.inventory_json) as InventoryItem[],
    refill_in_nature: row.refill_in_nature === 1,
    aid_stations: JSON.parse(row.aid_stations_json) as AidStation[],
    ...(row.overrides_json !== null
      ? { overrides: JSON.parse(row.overrides_json) as RaceOverrides }
      : {}),
    scheduled_start_at: row.scheduled_start_at,
    started_at: row.started_at,
    ended_at: row.ended_at,
    paused_segments: JSON.parse(row.paused_segments_json) as PausedSegment[],
    scheduled_notification_ids: JSON.parse(
      row.scheduled_notification_ids_json,
    ) as string[],
    status: row.status as RaceStatus,
    ...(row.distance_km !== null ? { distance_km: row.distance_km } : {}),
    ...(row.elevation_gain_m !== null
      ? { elevation_gain_m: row.elevation_gain_m }
      : {}),
    ...(row.elevation_loss_m !== null
      ? { elevation_loss_m: row.elevation_loss_m }
      : {}),
  };
}

// ─── CRUD ────────────────────────────────────────────────────────────────────

export async function createRace(
  db: SQLiteDatabase,
  race: Race,
): Promise<void> {
  const r = toRow(race);
  await db.runAsync(
    `INSERT INTO races (
      id, created_at, name, session_type, gpx_track_json, estimated_duration_min,
      intensity, temperature_c, humidity_high, exposure, terrain_type,
      inventory_json, refill_in_nature, aid_stations_json, overrides_json,
      scheduled_start_at, started_at, ended_at,
      paused_segments_json, scheduled_notification_ids_json, status,
      distance_km, elevation_gain_m, elevation_loss_m
    ) VALUES (
      ?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?
    )`,
    [
      r.id,
      r.created_at,
      r.name,
      r.session_type,
      r.gpx_track_json,
      r.estimated_duration_min,
      r.intensity,
      r.temperature_c,
      r.humidity_high,
      r.exposure,
      r.terrain_type,
      r.inventory_json,
      r.refill_in_nature,
      r.aid_stations_json,
      r.overrides_json,
      r.scheduled_start_at,
      r.started_at,
      r.ended_at,
      r.paused_segments_json,
      r.scheduled_notification_ids_json,
      r.status,
      r.distance_km,
      r.elevation_gain_m,
      r.elevation_loss_m,
    ],
  );
}

export async function getRace(
  db: SQLiteDatabase,
  id: string,
): Promise<Race | null> {
  const row = await db.getFirstAsync<RaceRow>(
    'SELECT * FROM races WHERE id = ?',
    [id],
  );
  return row ? fromRow(row) : null;
}

export async function listRaces(db: SQLiteDatabase): Promise<Race[]> {
  const rows = await db.getAllAsync<RaceRow>(
    'SELECT * FROM races ORDER BY scheduled_start_at DESC',
  );
  return rows.map(fromRow);
}

export async function updateRace(
  db: SQLiteDatabase,
  race: Race,
): Promise<void> {
  const r = toRow(race);
  await db.runAsync(
    `UPDATE races SET
      name = ?, session_type = ?, gpx_track_json = ?, estimated_duration_min = ?,
      intensity = ?, temperature_c = ?, humidity_high = ?, exposure = ?,
      terrain_type = ?, inventory_json = ?, refill_in_nature = ?,
      aid_stations_json = ?, overrides_json = ?, scheduled_start_at = ?,
      started_at = ?, ended_at = ?, paused_segments_json = ?,
      scheduled_notification_ids_json = ?, status = ?,
      distance_km = ?, elevation_gain_m = ?, elevation_loss_m = ?
    WHERE id = ?`,
    [
      r.name,
      r.session_type,
      r.gpx_track_json,
      r.estimated_duration_min,
      r.intensity,
      r.temperature_c,
      r.humidity_high,
      r.exposure,
      r.terrain_type,
      r.inventory_json,
      r.refill_in_nature,
      r.aid_stations_json,
      r.overrides_json,
      r.scheduled_start_at,
      r.started_at,
      r.ended_at,
      r.paused_segments_json,
      r.scheduled_notification_ids_json,
      r.status,
      r.distance_km,
      r.elevation_gain_m,
      r.elevation_loss_m,
      r.id,
    ],
  );
}

export async function updateRaceStatus(
  db: SQLiteDatabase,
  id: string,
  status: RaceStatus,
  extraFields?: { started_at?: number; ended_at?: number },
): Promise<void> {
  await db.runAsync(
    `UPDATE races SET status = ?, started_at = COALESCE(?, started_at), ended_at = COALESCE(?, ended_at) WHERE id = ?`,
    [status, extraFields?.started_at ?? null, extraFields?.ended_at ?? null, id],
  );
}

export async function updateScheduledNotificationIds(
  db: SQLiteDatabase,
  id: string,
  ids: string[],
): Promise<void> {
  await db.runAsync(
    'UPDATE races SET scheduled_notification_ids_json = ? WHERE id = ?',
    [JSON.stringify(ids), id],
  );
}

export async function deleteRace(
  db: SQLiteDatabase,
  id: string,
): Promise<void> {
  await db.runAsync('DELETE FROM races WHERE id = ?', [id]);
}
