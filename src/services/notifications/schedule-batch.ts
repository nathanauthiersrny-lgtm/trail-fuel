import * as Notifications from 'expo-notifications';

import type { AidStation } from '../../models/aid-station';
import type { FoodItem } from '../../models/food-item';
import type { PlannedEvent } from '../../models/planned-event';

import {
  buildNotificationContent,
  eventChannelId,
} from './format-content';

export type ScheduledMapping = {
  event_id: string;
  notification_id: string;
};

export type SkippedEvent = {
  event_id: string;
  reason: 'past' | 'error';
  detail?: string;
};

export type ScheduleBatchResult = {
  scheduled: ScheduledMapping[];
  skipped: SkippedEvent[];
};

export type ScheduleBatchInput = {
  events: PlannedEvent[];
  foodItemsById: Record<string, FoodItem>;
  aidStationsById: Record<string, AidStation>;
  /** When the race started (ms since epoch). Each event fires at startedAt + minute*60_000. */
  startedAt: number;
  /** Current time, passed in for testability. Events triggering before now+5s are skipped. */
  now: number;
};

const PAST_GUARD_MS = 5_000;

/**
 * Schedules a batch of notifications for race events. Robust to per-event failures:
 * each scheduling is wrapped in try/catch and reported in the `skipped` array.
 *
 * Caller should persist the returned mapping via planned-event-repo.attachNotificationIds.
 */
export async function scheduleEventBatch(
  input: ScheduleBatchInput,
): Promise<ScheduleBatchResult> {
  const { events, foodItemsById, aidStationsById, startedAt, now } = input;
  const scheduled: ScheduledMapping[] = [];
  const skipped: SkippedEvent[] = [];

  for (const event of events) {
    const triggerMs = startedAt + event.scheduled_at_minute * 60_000;

    if (triggerMs < now + PAST_GUARD_MS) {
      skipped.push({
        event_id: event.id,
        reason: 'past',
        detail: `trigger=${triggerMs} now=${now}`,
      });
      continue;
    }

    try {
      const content = buildNotificationContent(
        event,
        foodItemsById,
        aidStationsById,
      );
      const notificationId = await Notifications.scheduleNotificationAsync({
        content,
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.DATE,
          date: new Date(triggerMs),
          channelId: eventChannelId(event.type),
        },
      });
      scheduled.push({ event_id: event.id, notification_id: notificationId });
    } catch (err) {
      skipped.push({
        event_id: event.id,
        reason: 'error',
        detail: String(err),
      });
    }
  }

  return { scheduled, skipped };
}
