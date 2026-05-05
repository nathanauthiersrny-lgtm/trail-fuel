import type { PersistedPlannedEvent } from '../../../db/repos/planned-event-repo';
import { computeSummaryStats } from '../../runtime/summary-stats';
import type { EventLog, EventLogFeeling } from '../../../models/event-log';
import type { PlannedEventType } from '../../../models/planned-event';

const RACE = 'race-1';
const T0 = 1_700_000_000_000;

function makeEvent(
  id: string,
  type: PlannedEventType,
  offsetMs: number = 60_000,
): PersistedPlannedEvent {
  return {
    id,
    race_id: RACE,
    scheduled_at_minute: offsetMs / 60_000,
    scheduled_at_ms: T0 + offsetMs,
    type,
    payload: { food_item_id: 'gel', quantity: 1 },
    notification_id: null,
    order_index: Number(id.replace(/\D/g, '')) || 0,
  };
}

function makeLog(
  eventId: string,
  status: 'done' | 'skipped',
  feeling?: EventLogFeeling,
): EventLog {
  return {
    id: `log-${eventId}`,
    race_id: RACE,
    planned_event_id: eventId,
    logged_at: T0,
    status,
    ...(feeling ? { feeling } : {}),
  };
}

describe('computeSummaryStats', () => {
  it('returns empty totals for an empty plan', () => {
    const stats = computeSummaryStats({
      plannedEvents: [],
      logs: [],
      startedAt: null,
      endedAt: null,
      now: T0,
    });

    expect(stats.intake).toEqual({ done: 0, skipped: 0, missed: 0, total: 0 });
    expect(stats.check_in.total).toBe(0);
    expect(stats.aid_station.total).toBe(0);
    expect(stats.durationMs).toBe(0);
  });

  it('counts intakes by status (done / skipped / missed)', () => {
    const stats = computeSummaryStats({
      plannedEvents: [
        makeEvent('i1', 'intake'),
        makeEvent('i2', 'intake'),
        makeEvent('i3', 'intake'),
        makeEvent('i4', 'intake'),
      ],
      logs: [makeLog('i1', 'done'), makeLog('i2', 'skipped'), makeLog('i3', 'done')],
      startedAt: T0,
      endedAt: T0 + 3_600_000,
      now: T0 + 3_600_000,
    });

    expect(stats.intake).toEqual({ done: 2, skipped: 1, missed: 1, total: 4 });
  });

  it('counts fluid_reminders separately from intakes', () => {
    const stats = computeSummaryStats({
      plannedEvents: [
        makeEvent('i1', 'intake'),
        makeEvent('f1', 'fluid_reminder'),
        makeEvent('f2', 'fluid_reminder'),
      ],
      logs: [makeLog('f1', 'done')],
      startedAt: T0,
      endedAt: null,
      now: T0,
    });

    expect(stats.intake).toEqual({ done: 0, skipped: 0, missed: 1, total: 1 });
    expect(stats.fluid_reminder).toEqual({
      done: 1,
      skipped: 0,
      missed: 1,
      total: 2,
    });
  });

  it('breaks down check-ins by feeling', () => {
    const stats = computeSummaryStats({
      plannedEvents: [
        makeEvent('c1', 'check_in'),
        makeEvent('c2', 'check_in'),
        makeEvent('c3', 'check_in'),
        makeEvent('c4', 'check_in'),
        makeEvent('c5', 'check_in'),
      ],
      logs: [
        makeLog('c1', 'done', 'good'),
        makeLog('c2', 'done', 'good'),
        makeLog('c3', 'done', 'meh'),
        makeLog('c4', 'done', 'bad'),
      ],
      startedAt: T0,
      endedAt: null,
      now: T0,
    });

    expect(stats.check_in).toEqual({
      good: 2,
      meh: 1,
      bad: 1,
      doneNoFeeling: 0,
      missed: 1,
      total: 5,
    });
  });

  it('counts check-in done without feeling separately (defensive)', () => {
    const stats = computeSummaryStats({
      plannedEvents: [makeEvent('c1', 'check_in')],
      logs: [makeLog('c1', 'done')],
      startedAt: T0,
      endedAt: null,
      now: T0,
    });

    expect(stats.check_in.doneNoFeeling).toBe(1);
    expect(stats.check_in.good).toBe(0);
  });

  it('counts aid stations as totals only', () => {
    const stats = computeSummaryStats({
      plannedEvents: [
        makeEvent('a1', 'aid_station'),
        makeEvent('a2', 'aid_station'),
        makeEvent('i1', 'intake'),
      ],
      logs: [],
      startedAt: T0,
      endedAt: null,
      now: T0,
    });

    expect(stats.aid_station.total).toBe(2);
    expect(stats.intake.total).toBe(1);
  });

  it('computes durationMs from started_at → ended_at', () => {
    const stats = computeSummaryStats({
      plannedEvents: [],
      logs: [],
      startedAt: T0,
      endedAt: T0 + 7200_000, // 2h
      now: T0 + 9_000_000,
    });

    expect(stats.durationMs).toBe(7200_000);
  });

  it('falls back to now when ended_at is null (race still running)', () => {
    const stats = computeSummaryStats({
      plannedEvents: [],
      logs: [],
      startedAt: T0,
      endedAt: null,
      now: T0 + 3_600_000, // 1h elapsed
    });

    expect(stats.durationMs).toBe(3_600_000);
  });

  it('clamps duration to 0 when started_at is null', () => {
    const stats = computeSummaryStats({
      plannedEvents: [],
      logs: [],
      startedAt: null,
      endedAt: null,
      now: T0,
    });

    expect(stats.durationMs).toBe(0);
  });

  it('ignores spontaneous logs (planned_event_id undefined)', () => {
    const orphanLog: EventLog = {
      id: 'log-x',
      race_id: RACE,
      logged_at: T0,
      status: 'done',
    };
    const stats = computeSummaryStats({
      plannedEvents: [makeEvent('i1', 'intake')],
      logs: [orphanLog],
      startedAt: T0,
      endedAt: null,
      now: T0,
    });

    expect(stats.intake).toEqual({ done: 0, skipped: 0, missed: 1, total: 1 });
  });
});
