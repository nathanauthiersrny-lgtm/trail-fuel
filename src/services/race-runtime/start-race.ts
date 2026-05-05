import type { SQLiteDatabase } from 'expo-sqlite';

import {
  attachNotificationIds,
  createBatch,
} from '../../db/repos/planned-event-repo';
import {
  updateRaceStatus,
  updateScheduledNotificationIds,
} from '../../db/repos/race-repo';
import type { AidStation } from '../../models/aid-station';
import type { FoodItem } from '../../models/food-item';
import type { PlannedEvent } from '../../models/planned-event';
import type { Race } from '../../models/race';
import { registerNotificationCategories } from '../notifications/category';
import { scheduleEventBatch } from '../notifications/schedule-batch';
import {
  ensurePermissionsAndChannels,
  type NotificationSetupResult,
} from '../notifications/setup';

export type StartRaceInput = {
  db: SQLiteDatabase;
  race: Race;
  events: PlannedEvent[];
  foodItemsById: Record<string, FoodItem>;
  aidStationsById: Record<string, AidStation>;
  now: number;
};

export type StartRaceResult = {
  startedAt: number;
  setup: NotificationSetupResult;
  scheduledCount: number;
  skippedCount: number;
};

export class RaceNotStartableError extends Error {
  constructor(currentStatus: string) {
    super(
      `Cannot start race: status is '${currentStatus}', expected 'planned'`,
    );
    this.name = 'RaceNotStartableError';
  }
}

export class NotificationPermissionDeniedError extends Error {
  constructor() {
    super('Notification permission was denied — race cannot be started');
    this.name = 'NotificationPermissionDeniedError';
  }
}

/**
 * Tap "C'est parti" orchestration. Two DB transactions bracket the (non-DB)
 * native scheduling call so the runtime is recoverable mid-batch:
 *
 *   1. TX1: race.status='in_progress' + insert all planned_events (notification_id=NULL)
 *   2. (no TX) scheduleEventBatch — native side effects, may partially fail
 *   3. TX2: attach notification_ids to events + sync race.scheduled_notification_ids
 *
 * Idempotence: rejects if race.status !== 'planned'. UI must disable the
 * button after the first tap to avoid a double-batch.
 */
export async function startRace(input: StartRaceInput): Promise<StartRaceResult> {
  const { db, race, events, foodItemsById, aidStationsById, now } = input;

  if (race.status !== 'planned') {
    throw new RaceNotStartableError(race.status);
  }

  const setup = await ensurePermissionsAndChannels();
  if (!setup.permissionGranted) {
    throw new NotificationPermissionDeniedError();
  }
  await registerNotificationCategories();

  const startedAt = now;

  await db.withTransactionAsync(async () => {
    await updateRaceStatus(db, race.id, 'in_progress', { started_at: startedAt });
    await createBatch(db, race.id, events, startedAt);
  });

  const batchResult = await scheduleEventBatch({
    events,
    foodItemsById,
    aidStationsById,
    startedAt,
    now,
  });

  await db.withTransactionAsync(async () => {
    if (batchResult.scheduled.length > 0) {
      await attachNotificationIds(db, batchResult.scheduled);
    }
    await updateScheduledNotificationIds(
      db,
      race.id,
      batchResult.scheduled.map((s) => s.notification_id),
    );
  });

  return {
    startedAt,
    setup,
    scheduledCount: batchResult.scheduled.length,
    skippedCount: batchResult.skipped.length,
  };
}
