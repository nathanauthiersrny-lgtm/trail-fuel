import type { SQLiteDatabase } from 'expo-sqlite';

import type {
  EventLog,
  EventLogFeeling,
  EventLogStatus,
} from '../../models/event-log';

// ─── Types ──────────────────────────────────────────────────────────────────

export type EventLogRow = {
  id: string;
  race_id: string;
  planned_event_id: string | null;
  logged_at: number;
  status: string;
  feeling: string | null;
};

// ─── Serialization ──────────────────────────────────────────────────────────

export function toRow(log: EventLog): EventLogRow {
  return {
    id: log.id,
    race_id: log.race_id,
    planned_event_id: log.planned_event_id ?? null,
    logged_at: log.logged_at,
    status: log.status,
    feeling: log.feeling ?? null,
  };
}

export function fromRow(row: EventLogRow): EventLog {
  return {
    id: row.id,
    race_id: row.race_id,
    ...(row.planned_event_id !== null
      ? { planned_event_id: row.planned_event_id }
      : {}),
    logged_at: row.logged_at,
    status: row.status as EventLogStatus,
    ...(row.feeling !== null
      ? { feeling: row.feeling as EventLogFeeling }
      : {}),
  };
}

// ─── CRUD ────────────────────────────────────────────────────────────────────

/**
 * Inserts a log idempotently. The unique index on planned_event_id (where not null)
 * means a second insert for the same planned_event_id is silently ignored.
 */
export async function insertLog(
  db: SQLiteDatabase,
  log: EventLog,
): Promise<void> {
  await db.runAsync(
    `INSERT OR IGNORE INTO event_logs
      (id, race_id, planned_event_id, logged_at, status, feeling)
      VALUES (?,?,?,?,?,?)`,
    [
      log.id,
      log.race_id,
      log.planned_event_id ?? null,
      log.logged_at,
      log.status,
      log.feeling ?? null,
    ],
  );
}

export async function listByRace(
  db: SQLiteDatabase,
  raceId: string,
): Promise<EventLog[]> {
  const rows = await db.getAllAsync<EventLogRow>(
    'SELECT * FROM event_logs WHERE race_id = ? ORDER BY logged_at ASC',
    [raceId],
  );
  return rows.map(fromRow);
}

export async function hasLogForEvent(
  db: SQLiteDatabase,
  plannedEventId: string,
): Promise<boolean> {
  const row = await db.getFirstAsync<{ c: number }>(
    'SELECT COUNT(*) AS c FROM event_logs WHERE planned_event_id = ?',
    [plannedEventId],
  );
  return (row?.c ?? 0) > 0;
}

export async function countByStatus(
  db: SQLiteDatabase,
  raceId: string,
): Promise<Record<EventLogStatus, number>> {
  const rows = await db.getAllAsync<{ status: string; c: number }>(
    'SELECT status, COUNT(*) AS c FROM event_logs WHERE race_id = ? GROUP BY status',
    [raceId],
  );
  const result: Record<EventLogStatus, number> = { done: 0, skipped: 0 };
  for (const row of rows) {
    if (row.status === 'done' || row.status === 'skipped') {
      result[row.status] = row.c;
    }
  }
  return result;
}
