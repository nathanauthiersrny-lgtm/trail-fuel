import type { PersistedPlannedEvent } from '../../db/repos/planned-event-repo';

export type RescheduleDiffInput = {
  /** Planned events still in the future (scheduled_at_ms > now). */
  futureEvents: PersistedPlannedEvent[];
  /** Notification ids currently registered with the OS. */
  osScheduledIds: Set<string>;
};

export type RescheduleDiffResult = {
  /** Events that need scheduling (notification_id is null OR id absent from OS). */
  toReschedule: PersistedPlannedEvent[];
  /** Events whose notification_id is still registered — leave alone. */
  alive: PersistedPlannedEvent[];
};

/**
 * Pure diff: which future planned_events still have a live OS notification, and
 * which need to be (re)scheduled. Used by the watchdog at runtime mount.
 *
 * An event needs reschedule when:
 *   - its `notification_id` is null (never scheduled, e.g. start-race batch
 *     skipped it because it was past at the time, but we're back), OR
 *   - its `notification_id` is not in the OS scheduled set (Android force-stop
 *     dropped it, or the app was wiped after install).
 */
export function diffReschedule(input: RescheduleDiffInput): RescheduleDiffResult {
  const { futureEvents, osScheduledIds } = input;
  const toReschedule: PersistedPlannedEvent[] = [];
  const alive: PersistedPlannedEvent[] = [];

  for (const event of futureEvents) {
    if (event.notification_id === null) {
      toReschedule.push(event);
      continue;
    }
    if (!osScheduledIds.has(event.notification_id)) {
      toReschedule.push(event);
      continue;
    }
    alive.push(event);
  }

  return { toReschedule, alive };
}
