import type { PersistedPlannedEvent } from '../../db/repos/planned-event-repo';
import type { EventLog } from '../../models/event-log';

/**
 * Window in ms during which a fired event stays the "current" focus even if
 * its scheduled time has passed. Lets the user act on a notification that
 * just rang without the UI immediately flipping it to the past list.
 */
export const CURRENT_EVENT_GRACE_MS = 30_000;

export type RuntimeCursor = {
  pastEvents: PersistedPlannedEvent[];
  currentEvent: PersistedPlannedEvent | null;
  upcomingEvents: PersistedPlannedEvent[];
  logsByEventId: Record<string, EventLog>;
};

export type ComputeCursorInput = {
  events: PersistedPlannedEvent[];
  logs: EventLog[];
  now: number;
};

function indexLogs(logs: EventLog[]): Record<string, EventLog> {
  const map: Record<string, EventLog> = {};
  for (const log of logs) {
    if (log.planned_event_id !== undefined) {
      map[log.planned_event_id] = log;
    }
  }
  return map;
}

/**
 * Splits planned events into past / current / upcoming relative to `now`.
 *
 * Rules (events are assumed sorted by scheduled_at_ms ASC, but we re-sort
 * defensively so callers don't have to care):
 * - Logged events → past (regardless of scheduled time).
 * - Non-logged events whose scheduled_at_ms ≤ now − grace → past (missed).
 * - First non-logged event with scheduled_at_ms > now − grace → current.
 * - Remaining non-logged future events → upcoming.
 */
export function computeRuntimeCursor(input: ComputeCursorInput): RuntimeCursor {
  const { events, logs, now } = input;
  const logsByEventId = indexLogs(logs);

  const sorted = [...events].sort((a, b) => a.scheduled_at_ms - b.scheduled_at_ms);

  const pastEvents: PersistedPlannedEvent[] = [];
  const upcomingEvents: PersistedPlannedEvent[] = [];
  let currentEvent: PersistedPlannedEvent | null = null;

  const graceCutoff = now - CURRENT_EVENT_GRACE_MS;

  for (const event of sorted) {
    const logged = logsByEventId[event.id] !== undefined;

    if (logged) {
      pastEvents.push(event);
      continue;
    }

    if (event.scheduled_at_ms <= graceCutoff) {
      pastEvents.push(event);
      continue;
    }

    if (currentEvent === null) {
      currentEvent = event;
    } else {
      upcomingEvents.push(event);
    }
  }

  return { pastEvents, currentEvent, upcomingEvents, logsByEventId };
}
