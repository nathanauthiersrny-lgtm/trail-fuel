import type { SQLiteDatabase } from 'expo-sqlite';

import { insertLog } from '../../db/repos/event-log-repo';
import type {
  EventLog,
  EventLogFeeling,
  EventLogStatus,
} from '../../models/event-log';

export type LogEventInput = {
  db: SQLiteDatabase;
  raceId: string;
  /** Set when the log corresponds to a known planned event. Null for spontaneous logs (V2). */
  plannedEventId?: string;
  status: EventLogStatus;
  /** Only set for check_in events. */
  feeling?: EventLogFeeling;
  now: number;
};

/**
 * Inserts an event log idempotently. The unique index on planned_event_id makes
 * a second call for the same event a silent no-op — desired when the user taps
 * the notification action AND the in-app swipe.
 *
 * The generated log id is deterministic when planned_event_id is set so retries
 * don't pollute the table even if the unique constraint were missing.
 */
export async function logEvent(input: LogEventInput): Promise<EventLog> {
  const { db, raceId, plannedEventId, status, feeling, now } = input;

  const id = plannedEventId
    ? `log-${plannedEventId}`
    : `log-spontaneous-${now}-${Math.random().toString(36).slice(2, 8)}`;

  const log: EventLog = {
    id,
    race_id: raceId,
    ...(plannedEventId !== undefined ? { planned_event_id: plannedEventId } : {}),
    logged_at: now,
    status,
    ...(feeling !== undefined ? { feeling } : {}),
  };

  await insertLog(db, log);
  return log;
}
