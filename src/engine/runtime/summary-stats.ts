import type { PersistedPlannedEvent } from '../../db/repos/planned-event-repo';
import type { EventLog, EventLogFeeling } from '../../models/event-log';
import type { PlannedEventType } from '../../models/planned-event';

export type ActionStats = {
  done: number;
  skipped: number;
  /** Scheduled but no log was inserted (notif missed or skipped without action). */
  missed: number;
  total: number;
};

export type CheckInStats = {
  /** Breakdown by feeling for events that were answered. */
  good: number;
  meh: number;
  bad: number;
  /** Logged "done" without a feeling (shouldn't happen for check_in but kept for safety). */
  doneNoFeeling: number;
  missed: number;
  total: number;
};

export type SummaryStats = {
  intake: ActionStats;
  fluid_reminder: ActionStats;
  check_in: CheckInStats;
  aid_station: { total: number };
  /** Real elapsed duration in ms (started_at → ended_at, or now if still running). */
  durationMs: number;
};

export type ComputeSummaryStatsInput = {
  plannedEvents: PersistedPlannedEvent[];
  logs: EventLog[];
  startedAt: number | null;
  endedAt: number | null;
  now: number;
};

const EMPTY_ACTION: ActionStats = { done: 0, skipped: 0, missed: 0, total: 0 };
const EMPTY_CHECKIN: CheckInStats = {
  good: 0,
  meh: 0,
  bad: 0,
  doneNoFeeling: 0,
  missed: 0,
  total: 0,
};

function indexLogs(logs: EventLog[]): Map<string, EventLog> {
  const map = new Map<string, EventLog>();
  for (const log of logs) {
    if (log.planned_event_id !== undefined) {
      map.set(log.planned_event_id, log);
    }
  }
  return map;
}

/**
 * Aggregates per-type completion stats for a finished (or still running) race.
 * Pure: takes everything as parameters, returns plain data. The screen renders
 * these counts; no logic on its side.
 *
 * "Missed" = a planned event with no matching log. For intake/fluid_reminder it
 * means the user neither tapped Done/Skip from the notif nor swiped in-app.
 */
export function computeSummaryStats(input: ComputeSummaryStatsInput): SummaryStats {
  const { plannedEvents, logs, startedAt, endedAt, now } = input;
  const logsByEventId = indexLogs(logs);

  const stats: Record<PlannedEventType, ActionStats | CheckInStats | { total: number }> = {
    intake: { ...EMPTY_ACTION },
    fluid_reminder: { ...EMPTY_ACTION },
    check_in: { ...EMPTY_CHECKIN },
    aid_station: { total: 0 },
  };

  for (const event of plannedEvents) {
    const log = logsByEventId.get(event.id);

    switch (event.type) {
      case 'intake':
      case 'fluid_reminder': {
        const target = stats[event.type] as ActionStats;
        target.total += 1;
        if (!log) target.missed += 1;
        else if (log.status === 'done') target.done += 1;
        else target.skipped += 1;
        break;
      }
      case 'check_in': {
        const target = stats.check_in as CheckInStats;
        target.total += 1;
        if (!log) {
          target.missed += 1;
        } else if (log.status === 'done') {
          if (log.feeling) {
            incrementFeeling(target, log.feeling);
          } else {
            target.doneNoFeeling += 1;
          }
        } else {
          // 'skipped' for a check_in is unexpected (no skip button) but if it
          // shows up, treat as missed for display.
          target.missed += 1;
        }
        break;
      }
      case 'aid_station': {
        const target = stats.aid_station as { total: number };
        target.total += 1;
        break;
      }
    }
  }

  const durationMs =
    startedAt === null
      ? 0
      : Math.max(0, (endedAt ?? now) - startedAt);

  return {
    intake: stats.intake as ActionStats,
    fluid_reminder: stats.fluid_reminder as ActionStats,
    check_in: stats.check_in as CheckInStats,
    aid_station: stats.aid_station as { total: number },
    durationMs,
  };
}

function incrementFeeling(target: CheckInStats, feeling: EventLogFeeling): void {
  switch (feeling) {
    case 'good':
      target.good += 1;
      break;
    case 'meh':
      target.meh += 1;
      break;
    case 'bad':
      target.bad += 1;
      break;
  }
}
