import type { PersistedPlannedEvent } from '../../../db/repos/planned-event-repo';
import { diffReschedule } from '../../runtime/reschedule-diff';

const RACE = 'race-1';
const T0 = 1_700_000_000_000;

function makeEvent(
  id: string,
  offsetMs: number,
  notificationId: string | null,
): PersistedPlannedEvent {
  return {
    id,
    race_id: RACE,
    scheduled_at_minute: offsetMs / 60_000,
    scheduled_at_ms: T0 + offsetMs,
    type: 'intake',
    payload: { food_item_id: 'gel', quantity: 1 },
    notification_id: notificationId,
    order_index: Number(id.replace(/\D/g, '')) || 0,
  };
}

describe('diffReschedule', () => {
  it('marks events alive when notification_id is in the OS set', () => {
    const futureEvents = [
      makeEvent('e1', 60_000, 'notif-1'),
      makeEvent('e2', 120_000, 'notif-2'),
    ];
    const osScheduledIds = new Set(['notif-1', 'notif-2']);
    const result = diffReschedule({ futureEvents, osScheduledIds });

    expect(result.toReschedule).toHaveLength(0);
    expect(result.alive.map((e) => e.id)).toEqual(['e1', 'e2']);
  });

  it('marks events for reschedule when notification_id is null', () => {
    const futureEvents = [
      makeEvent('e1', 60_000, null),
      makeEvent('e2', 120_000, 'notif-2'),
    ];
    const osScheduledIds = new Set(['notif-2']);
    const result = diffReschedule({ futureEvents, osScheduledIds });

    expect(result.toReschedule.map((e) => e.id)).toEqual(['e1']);
    expect(result.alive.map((e) => e.id)).toEqual(['e2']);
  });

  it('marks events for reschedule when OS dropped the id (force-stop case)', () => {
    const futureEvents = [
      makeEvent('e1', 60_000, 'notif-1'),
      makeEvent('e2', 120_000, 'notif-2'),
      makeEvent('e3', 180_000, 'notif-3'),
    ];
    // OS only kept notif-2 (e.g. partial loss is theoretical, but practically
    // force-stop drops them all; we still test the granular case).
    const osScheduledIds = new Set(['notif-2']);
    const result = diffReschedule({ futureEvents, osScheduledIds });

    expect(result.toReschedule.map((e) => e.id)).toEqual(['e1', 'e3']);
    expect(result.alive.map((e) => e.id)).toEqual(['e2']);
  });

  it('reschedules everything when the OS set is empty (Android force-stop)', () => {
    const futureEvents = [
      makeEvent('e1', 60_000, 'notif-1'),
      makeEvent('e2', 120_000, 'notif-2'),
    ];
    const result = diffReschedule({
      futureEvents,
      osScheduledIds: new Set(),
    });

    expect(result.toReschedule.map((e) => e.id)).toEqual(['e1', 'e2']);
    expect(result.alive).toHaveLength(0);
  });

  it('handles empty future events list (race ended or no upcoming)', () => {
    const result = diffReschedule({
      futureEvents: [],
      osScheduledIds: new Set(['stale-notif']),
    });

    expect(result.toReschedule).toHaveLength(0);
    expect(result.alive).toHaveLength(0);
  });
});
