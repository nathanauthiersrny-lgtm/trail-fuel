import * as Notifications from 'expo-notifications';
import type { SQLiteDatabase } from 'expo-sqlite';

import {
  attachNotificationIds,
  listByRace,
  type PersistedPlannedEvent,
} from '../../db/repos/planned-event-repo';
import { updateScheduledNotificationIds } from '../../db/repos/race-repo';
import { diffReschedule } from '../../engine/runtime/reschedule-diff';
import type { AidStation } from '../../models/aid-station';
import type { FoodItem } from '../../models/food-item';
import type { PlannedEvent } from '../../models/planned-event';
import type { Race } from '../../models/race';
import { scheduleEventBatch } from '../notifications/schedule-batch';

export type WatchdogInput = {
  db: SQLiteDatabase;
  race: Race;
  foodItemsById: Record<string, FoodItem>;
  aidStationsById: Record<string, AidStation>;
  now: number;
};

export type WatchdogResult = {
  /** Total future events found in DB. */
  futureCount: number;
  /** Notifications still scheduled at the OS level (intersection with our race). */
  aliveCount: number;
  /** Events that needed rescheduling (notification_id null or dropped by OS). */
  rescheduleAttempted: number;
  /** Successfully re-scheduled by scheduleEventBatch. */
  rescheduled: number;
  /** Failed (per-event try/catch in scheduleEventBatch). */
  failed: number;
};

export class WatchdogPreconditionError extends Error {}

/**
 * Detects whether the OS has dropped any of the race's scheduled notifications
 * (typical case: Android force-stop after the user swiped the app from recents)
 * and reschedules the missing ones.
 *
 * Idempotent: runs the diff first, only acts on events that need rescheduling.
 * Safe to call at every mount of RaceRuntimeScreen — repeated runs are no-ops
 * once everything is alive.
 */
export async function verifyAndRescheduleIfNeeded(
  input: WatchdogInput,
): Promise<WatchdogResult> {
  const { db, race, foodItemsById, aidStationsById, now } = input;

  if (race.status !== 'in_progress') {
    throw new WatchdogPreconditionError(
      `Watchdog only runs on in_progress races, got '${race.status}'`,
    );
  }
  if (race.started_at === null) {
    throw new WatchdogPreconditionError(
      'Watchdog requires race.started_at to be set',
    );
  }
  const startedAt = race.started_at;

  const allEvents = await listByRace(db, race.id);
  const futureEvents = allEvents.filter((e) => e.scheduled_at_ms > now);

  const osList = await Notifications.getAllScheduledNotificationsAsync();
  const osScheduledIds = new Set(osList.map((n) => n.identifier));

  const { toReschedule, alive } = diffReschedule({ futureEvents, osScheduledIds });

  if (toReschedule.length === 0) {
    return {
      futureCount: futureEvents.length,
      aliveCount: alive.length,
      rescheduleAttempted: 0,
      rescheduled: 0,
      failed: 0,
    };
  }

  const eventsForBatch: PlannedEvent[] = toReschedule.map(toPlannedEvent);

  const batchResult = await scheduleEventBatch({
    events: eventsForBatch,
    foodItemsById,
    aidStationsById,
    startedAt,
    now,
  });

  if (batchResult.scheduled.length > 0) {
    await db.withTransactionAsync(async () => {
      await attachNotificationIds(db, batchResult.scheduled);

      // Refresh the race-level snapshot so cancel-remaining and downstream
      // reads see the merged set (alive + newly rescheduled).
      const aliveIds = alive
        .map((e) => e.notification_id)
        .filter((id): id is string => id !== null);
      const newIds = batchResult.scheduled.map((s) => s.notification_id);
      await updateScheduledNotificationIds(db, race.id, [...aliveIds, ...newIds]);
    });
  }

  return {
    futureCount: futureEvents.length,
    aliveCount: alive.length,
    rescheduleAttempted: toReschedule.length,
    rescheduled: batchResult.scheduled.length,
    failed: batchResult.skipped.length,
  };
}

/**
 * Strips the persistence-only fields off so scheduleEventBatch (which still
 * speaks the engine PlannedEvent shape) sees what it expects.
 */
function toPlannedEvent(persisted: PersistedPlannedEvent): PlannedEvent {
  return {
    id: persisted.id,
    race_id: persisted.race_id,
    scheduled_at_minute: persisted.scheduled_at_minute,
    type: persisted.type,
    payload: persisted.payload,
  };
}
