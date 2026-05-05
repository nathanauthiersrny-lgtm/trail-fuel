import type { SQLiteDatabase } from 'expo-sqlite';

import {
  updateRaceStatus,
  updateScheduledNotificationIds,
} from '../../db/repos/race-repo';
import type { RaceStatus } from '../../models/race';
import { cancelRemainingNotifications } from '../notifications/cancel-remaining';

export type EndRaceInput = {
  db: SQLiteDatabase;
  raceId: string;
  status: Extract<RaceStatus, 'completed' | 'abandoned'>;
  now: number;
};

export type EndRaceResult = {
  cancelledCount: number;
  cancelErrors: number;
};

/**
 * Marks a race as completed or abandoned and cancels any remaining future
 * notifications. Always clears race.scheduled_notification_ids so the watchdog
 * has a clean slate.
 */
export async function endRace(input: EndRaceInput): Promise<EndRaceResult> {
  const { db, raceId, status, now } = input;

  const cancelResult = await cancelRemainingNotifications(db, raceId, now);

  await db.withTransactionAsync(async () => {
    await updateRaceStatus(db, raceId, status, { ended_at: now });
    await updateScheduledNotificationIds(db, raceId, []);
  });

  return {
    cancelledCount: cancelResult.cancelled,
    cancelErrors: cancelResult.errors.length,
  };
}
