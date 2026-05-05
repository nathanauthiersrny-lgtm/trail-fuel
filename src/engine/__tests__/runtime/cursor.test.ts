import type { PersistedPlannedEvent } from '../../../db/repos/planned-event-repo';
import { computeRuntimeCursor, CURRENT_EVENT_GRACE_MS } from '../../runtime/cursor';
import type { EventLog } from '../../../models/event-log';

const RACE = 'race-1';
const T0 = 1_700_000_000_000;

function makeEvent(
  id: string,
  offsetMs: number,
  partial: Partial<PersistedPlannedEvent> = {},
): PersistedPlannedEvent {
  return {
    id,
    race_id: RACE,
    scheduled_at_minute: offsetMs / 60_000,
    scheduled_at_ms: T0 + offsetMs,
    type: 'intake',
    payload: { food_item_id: 'gel', quantity: 1 },
    notification_id: null,
    order_index: Number(id.replace(/\D/g, '')) || 0,
    ...partial,
  };
}

function makeLog(eventId: string, status: 'done' | 'skipped' = 'done'): EventLog {
  return {
    id: `log-${eventId}`,
    race_id: RACE,
    planned_event_id: eventId,
    logged_at: T0,
    status,
  };
}

describe('computeRuntimeCursor', () => {
  it('returns all upcoming when nothing has fired yet', () => {
    const events = [
      makeEvent('e1', 60_000),
      makeEvent('e2', 120_000),
      makeEvent('e3', 180_000),
    ];
    const result = computeRuntimeCursor({ events, logs: [], now: T0 });

    expect(result.pastEvents).toHaveLength(0);
    expect(result.currentEvent?.id).toBe('e1');
    expect(result.upcomingEvents.map((e) => e.id)).toEqual(['e2', 'e3']);
  });

  it('promotes the next non-logged event after a recent fire', () => {
    const events = [
      makeEvent('e1', -10_000),
      makeEvent('e2', 60_000),
    ];
    // e1 fired 10s ago — within the grace window, still current.
    const result = computeRuntimeCursor({ events, logs: [], now: T0 });

    expect(result.currentEvent?.id).toBe('e1');
    expect(result.upcomingEvents.map((e) => e.id)).toEqual(['e2']);
    expect(result.pastEvents).toHaveLength(0);
  });

  it('moves missed events (>grace) into past', () => {
    const events = [
      makeEvent('e1', -CURRENT_EVENT_GRACE_MS - 5_000),
      makeEvent('e2', 60_000),
    ];
    const result = computeRuntimeCursor({ events, logs: [], now: T0 });

    expect(result.pastEvents.map((e) => e.id)).toEqual(['e1']);
    expect(result.currentEvent?.id).toBe('e2');
    expect(result.upcomingEvents).toHaveLength(0);
  });

  it('treats logged events as past even if still within grace', () => {
    const events = [
      makeEvent('e1', -5_000),
      makeEvent('e2', 60_000),
    ];
    const result = computeRuntimeCursor({
      events,
      logs: [makeLog('e1')],
      now: T0,
    });

    expect(result.pastEvents.map((e) => e.id)).toEqual(['e1']);
    expect(result.currentEvent?.id).toBe('e2');
  });

  it('skips logged events when picking the current one', () => {
    const events = [
      makeEvent('e1', 30_000),
      makeEvent('e2', 60_000),
      makeEvent('e3', 90_000),
    ];
    const result = computeRuntimeCursor({
      events,
      logs: [makeLog('e1', 'skipped')],
      now: T0,
    });

    expect(result.pastEvents.map((e) => e.id)).toEqual(['e1']);
    expect(result.currentEvent?.id).toBe('e2');
    expect(result.upcomingEvents.map((e) => e.id)).toEqual(['e3']);
  });

  it('returns null current when all events are logged or missed', () => {
    const events = [
      makeEvent('e1', -CURRENT_EVENT_GRACE_MS - 60_000),
      makeEvent('e2', -10_000),
    ];
    const result = computeRuntimeCursor({
      events,
      logs: [makeLog('e2')],
      now: T0,
    });

    expect(result.currentEvent).toBeNull();
    expect(result.pastEvents.map((e) => e.id)).toEqual(['e1', 'e2']);
    expect(result.upcomingEvents).toHaveLength(0);
  });

  it('sorts events defensively by scheduled_at_ms', () => {
    const events = [
      makeEvent('e3', 180_000),
      makeEvent('e1', 60_000),
      makeEvent('e2', 120_000),
    ];
    const result = computeRuntimeCursor({ events, logs: [], now: T0 });

    expect(result.currentEvent?.id).toBe('e1');
    expect(result.upcomingEvents.map((e) => e.id)).toEqual(['e2', 'e3']);
  });

  it('exposes logsByEventId for downstream lookups', () => {
    const events = [makeEvent('e1', -5_000), makeEvent('e2', 60_000)];
    const log = makeLog('e1', 'skipped');
    const result = computeRuntimeCursor({ events, logs: [log], now: T0 });

    expect(result.logsByEventId['e1']).toBe(log);
    expect(result.logsByEventId['e2']).toBeUndefined();
  });

  it('ignores logs without planned_event_id (V2 spontaneous logs)', () => {
    const events = [makeEvent('e1', 60_000)];
    const orphanLog: EventLog = {
      id: 'log-spontaneous',
      race_id: RACE,
      logged_at: T0,
      status: 'done',
    };
    const result = computeRuntimeCursor({
      events,
      logs: [orphanLog],
      now: T0,
    });

    expect(result.currentEvent?.id).toBe('e1');
    expect(Object.keys(result.logsByEventId)).toHaveLength(0);
  });
});
