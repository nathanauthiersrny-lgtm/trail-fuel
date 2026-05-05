import * as Notifications from 'expo-notifications';
import type { SQLiteDatabase } from 'expo-sqlite';

import {
  clearNotificationIdsForFutureEvents,
  listFutureEventsWithNotificationId,
} from '../../db/repos/planned-event-repo';

export type CancelRemainingResult = {
  cancelled: number;
  errors: { notification_id: string; error: string }[];
};

/**
 * Cancels every scheduled notification for events still in the future for a race,
 * then clears their notification_id in DB so the watchdog won't think they're alive.
 */
export async function cancelRemainingNotifications(
  db: SQLiteDatabase,
  raceId: string,
  now: number,
): Promise<CancelRemainingResult> {
  const events = await listFutureEventsWithNotificationId(db, raceId, now);
  const errors: CancelRemainingResult['errors'] = [];
  let cancelled = 0;

  for (const event of events) {
    if (!event.notification_id) continue;
    try {
      await Notifications.cancelScheduledNotificationAsync(event.notification_id);
      cancelled++;
    } catch (err) {
      errors.push({
        notification_id: event.notification_id,
        error: String(err),
      });
    }
  }

  await clearNotificationIdsForFutureEvents(db, raceId, now);

  return { cancelled, errors };
}
