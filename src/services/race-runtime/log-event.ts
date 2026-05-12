import type { SQLiteDatabase } from 'expo-sqlite';

import { upsertBy as upsertFeedback } from '../../db/repos/event-feedback-repo';
import { insertLog } from '../../db/repos/event-log-repo';
import type {
  EventLog,
  EventLogFeeling,
  EventLogStatus,
} from '../../models/event-log';
import type { SkipReason } from '../../models/event-feedback';

export type LogEventInput = {
  db: SQLiteDatabase;
  raceId: string;
  /** Set when the log corresponds to a known planned event. Null for spontaneous logs (V2). */
  plannedEventId?: string;
  status: EventLogStatus;
  /** Only set for check_in events. */
  feeling?: EventLogFeeling;
  /**
   * Captured at swipe time when the user skips an intake outside competition mode.
   * Persisted into event_feedback alongside the log. Ignored if plannedEventId is unset.
   */
  skipReason?: SkipReason;
  now: number;
};

/**
 * Inserts an event log idempotently. The unique index on planned_event_id makes
 * a second call for the same event a silent no-op — desired when the user taps
 * the notification action AND the in-app swipe.
 *
 * The generated log id is deterministic when planned_event_id is set so retries
 * don't pollute the table even if the unique constraint were missing.
 *
 * When `skipReason` is set with a known `plannedEventId`, upserts the feedback
 * row in the same transaction so the log and its reason stay in sync.
 */
export async function logEvent(input: LogEventInput): Promise<EventLog> {
  const { db, raceId, plannedEventId, status, feeling, skipReason, now } = input;

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

  const shouldPersistReason =
    skipReason !== undefined && plannedEventId !== undefined;

  if (shouldPersistReason) {
    await db.withTransactionAsync(async () => {
      await insertLog(db, log);
      await upsertFeedback(
        db,
        raceId,
        plannedEventId,
        { skip_reason: skipReason },
        now,
      );
    });
  } else {
    await insertLog(db, log);
  }

  return log;
}
