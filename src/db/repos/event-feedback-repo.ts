import type { SQLiteDatabase } from 'expo-sqlite';

import {
  feedbackIdFor,
  type EventFeedback,
  type FeedbackTag,
  type QuantityActual,
  type SkipReason,
} from '../../models/event-feedback';

// ─── Types ──────────────────────────────────────────────────────────────────

export type EventFeedbackRow = {
  id: string;
  race_id: string;
  planned_event_id: string;
  skip_reason: string | null;
  tags: string | null;
  actual_quantity: string | null;
  created_at: number;
  updated_at: number;
};

/**
 * Fields the caller can change on an upsert. `undefined` means "leave alone",
 * `null` means "clear this field". For `tags`, pass `[]` to clear (since
 * `null` would conflict with the spread-based merge semantics).
 */
export type EventFeedbackPatch = {
  skip_reason?: SkipReason | null;
  tags?: FeedbackTag[];
  actual_quantity?: QuantityActual | null;
};

// ─── Serialization ──────────────────────────────────────────────────────────

export function toRow(fb: EventFeedback): EventFeedbackRow {
  return {
    id: fb.id,
    race_id: fb.race_id,
    planned_event_id: fb.planned_event_id,
    skip_reason: fb.skip_reason ?? null,
    tags: fb.tags ? JSON.stringify(fb.tags) : null,
    actual_quantity: fb.actual_quantity ?? null,
    created_at: fb.created_at,
    updated_at: fb.updated_at,
  };
}

export function fromRow(row: EventFeedbackRow): EventFeedback {
  return {
    id: row.id,
    race_id: row.race_id,
    planned_event_id: row.planned_event_id,
    ...(row.skip_reason !== null
      ? { skip_reason: row.skip_reason as SkipReason }
      : {}),
    ...(row.tags !== null
      ? { tags: JSON.parse(row.tags) as FeedbackTag[] }
      : {}),
    ...(row.actual_quantity !== null
      ? { actual_quantity: row.actual_quantity as QuantityActual }
      : {}),
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

// ─── CRUD ────────────────────────────────────────────────────────────────────

export async function findByPlannedEvent(
  db: SQLiteDatabase,
  plannedEventId: string,
): Promise<EventFeedback | null> {
  const row = await db.getFirstAsync<EventFeedbackRow>(
    'SELECT * FROM event_feedback WHERE planned_event_id = ?',
    [plannedEventId],
  );
  return row ? fromRow(row) : null;
}

export async function listByRace(
  db: SQLiteDatabase,
  raceId: string,
): Promise<EventFeedback[]> {
  const rows = await db.getAllAsync<EventFeedbackRow>(
    'SELECT * FROM event_feedback WHERE race_id = ? ORDER BY created_at ASC',
    [raceId],
  );
  return rows.map(fromRow);
}

/**
 * Inserts a feedback row for a planned event, or merges the patch into the
 * existing one. Partial: a field absent from `patch` is preserved.
 *
 * Note: not transactional with concurrent writers. For Trail Fuel's single-user
 * offline model this is fine — the swipe handler and the debrief screen never
 * write the same row simultaneously.
 */
export async function upsertBy(
  db: SQLiteDatabase,
  raceId: string,
  plannedEventId: string,
  patch: EventFeedbackPatch,
  now: number,
): Promise<EventFeedback> {
  const existing = await findByPlannedEvent(db, plannedEventId);
  const merged: EventFeedback = mergeFeedback(existing, {
    raceId,
    plannedEventId,
    patch,
    now,
  });
  const row = toRow(merged);
  await db.runAsync(
    `INSERT OR REPLACE INTO event_feedback
      (id, race_id, planned_event_id, skip_reason, tags, actual_quantity, created_at, updated_at)
      VALUES (?,?,?,?,?,?,?,?)`,
    [
      row.id,
      row.race_id,
      row.planned_event_id,
      row.skip_reason,
      row.tags,
      row.actual_quantity,
      row.created_at,
      row.updated_at,
    ],
  );
  return merged;
}

// ─── Pure helper (exported for testing) ─────────────────────────────────────

export function mergeFeedback(
  existing: EventFeedback | null,
  args: {
    raceId: string;
    plannedEventId: string;
    patch: EventFeedbackPatch;
    now: number;
  },
): EventFeedback {
  const { raceId, plannedEventId, patch, now } = args;

  const base: EventFeedback = existing ?? {
    id: feedbackIdFor(plannedEventId),
    race_id: raceId,
    planned_event_id: plannedEventId,
    created_at: now,
    updated_at: now,
  };

  const next: EventFeedback = { ...base, updated_at: now };

  if (patch.skip_reason !== undefined) {
    if (patch.skip_reason === null) {
      delete next.skip_reason;
    } else {
      next.skip_reason = patch.skip_reason;
    }
  }

  if (patch.tags !== undefined) {
    if (patch.tags.length === 0) {
      delete next.tags;
    } else {
      next.tags = patch.tags;
    }
  }

  if (patch.actual_quantity !== undefined) {
    if (patch.actual_quantity === null) {
      delete next.actual_quantity;
    } else {
      next.actual_quantity = patch.actual_quantity;
    }
  }

  return next;
}
