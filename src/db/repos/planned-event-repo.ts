import type { SQLiteDatabase } from 'expo-sqlite';

import type {
  PlannedEvent,
  PlannedEventPayload,
  PlannedEventType,
} from '../../models/planned-event';

// ─── Types ──────────────────────────────────────────────────────────────────

export type PersistedPlannedEvent = PlannedEvent & {
  scheduled_at_ms: number;
  notification_id: string | null;
  order_index: number;
};

export type PlannedEventRow = {
  id: string;
  race_id: string;
  scheduled_at_minute: number;
  scheduled_at_ms: number;
  type: string;
  payload_json: string;
  notification_id: string | null;
  order_index: number;
};

// ─── Serialization ──────────────────────────────────────────────────────────

export function toRow(
  event: PlannedEvent,
  startedAtMs: number,
  orderIndex: number,
  notificationId: string | null = null,
): PlannedEventRow {
  return {
    id: event.id,
    race_id: event.race_id,
    scheduled_at_minute: event.scheduled_at_minute,
    scheduled_at_ms: startedAtMs + event.scheduled_at_minute * 60_000,
    type: event.type,
    payload_json: JSON.stringify(event.payload),
    notification_id: notificationId,
    order_index: orderIndex,
  };
}

export function fromRow(row: PlannedEventRow): PersistedPlannedEvent {
  return {
    id: row.id,
    race_id: row.race_id,
    scheduled_at_minute: row.scheduled_at_minute,
    scheduled_at_ms: row.scheduled_at_ms,
    type: row.type as PlannedEventType,
    payload: JSON.parse(row.payload_json) as PlannedEventPayload,
    notification_id: row.notification_id,
    order_index: row.order_index,
  };
}

// ─── CRUD ────────────────────────────────────────────────────────────────────

export async function createBatch(
  db: SQLiteDatabase,
  raceId: string,
  events: PlannedEvent[],
  startedAtMs: number,
): Promise<void> {
  if (events.length === 0) return;
  for (let i = 0; i < events.length; i++) {
    const event = events[i];
    if (event.race_id !== raceId) {
      throw new Error(
        `createBatch: event ${event.id} has race_id=${event.race_id}, expected ${raceId}`,
      );
    }
    const r = toRow(event, startedAtMs, i);
    await db.runAsync(
      `INSERT INTO planned_events
        (id, race_id, scheduled_at_minute, scheduled_at_ms, type, payload_json, notification_id, order_index)
        VALUES (?,?,?,?,?,?,?,?)`,
      [
        r.id,
        r.race_id,
        r.scheduled_at_minute,
        r.scheduled_at_ms,
        r.type,
        r.payload_json,
        r.notification_id,
        r.order_index,
      ],
    );
  }
}

export async function listByRace(
  db: SQLiteDatabase,
  raceId: string,
): Promise<PersistedPlannedEvent[]> {
  const rows = await db.getAllAsync<PlannedEventRow>(
    'SELECT * FROM planned_events WHERE race_id = ? ORDER BY scheduled_at_minute ASC, order_index ASC',
    [raceId],
  );
  return rows.map(fromRow);
}

export async function getByEventId(
  db: SQLiteDatabase,
  eventId: string,
): Promise<PersistedPlannedEvent | null> {
  const row = await db.getFirstAsync<PlannedEventRow>(
    'SELECT * FROM planned_events WHERE id = ?',
    [eventId],
  );
  return row ? fromRow(row) : null;
}

export async function getByNotificationId(
  db: SQLiteDatabase,
  notificationId: string,
): Promise<PersistedPlannedEvent | null> {
  const row = await db.getFirstAsync<PlannedEventRow>(
    'SELECT * FROM planned_events WHERE notification_id = ?',
    [notificationId],
  );
  return row ? fromRow(row) : null;
}

export async function attachNotificationIds(
  db: SQLiteDatabase,
  mapping: { event_id: string; notification_id: string }[],
): Promise<void> {
  for (const m of mapping) {
    await db.runAsync(
      'UPDATE planned_events SET notification_id = ? WHERE id = ?',
      [m.notification_id, m.event_id],
    );
  }
}

export async function clearNotificationIdsForFutureEvents(
  db: SQLiteDatabase,
  raceId: string,
  nowMs: number,
): Promise<void> {
  await db.runAsync(
    'UPDATE planned_events SET notification_id = NULL WHERE race_id = ? AND scheduled_at_ms > ?',
    [raceId, nowMs],
  );
}

export async function listFutureEventsWithNotificationId(
  db: SQLiteDatabase,
  raceId: string,
  nowMs: number,
): Promise<PersistedPlannedEvent[]> {
  const rows = await db.getAllAsync<PlannedEventRow>(
    'SELECT * FROM planned_events WHERE race_id = ? AND scheduled_at_ms > ? AND notification_id IS NOT NULL ORDER BY scheduled_at_ms ASC',
    [raceId, nowMs],
  );
  return rows.map(fromRow);
}
