import type { PlannedEvent } from '../../models/planned-event';
import { fromRow, toRow } from '../repos/planned-event-repo';

const STARTED_AT = 1_700_000_000_000; // arbitrary epoch ms

function intakeEvent(overrides: Partial<PlannedEvent> = {}): PlannedEvent {
  return {
    id: 'race-001::event-0',
    race_id: 'race-001',
    scheduled_at_minute: 30,
    type: 'intake',
    payload: { food_item_id: 'gel-001', quantity: 1 },
    ...overrides,
  };
}

describe('planned-event-repo round-trip', () => {
  it('preserves a single intake', () => {
    const event = intakeEvent();
    const row = toRow(event, STARTED_AT, 0);
    const back = fromRow(row);
    expect(back.id).toBe(event.id);
    expect(back.race_id).toBe(event.race_id);
    expect(back.scheduled_at_minute).toBe(30);
    expect(back.type).toBe('intake');
    expect(back.payload).toEqual(event.payload);
    expect(back.notification_id).toBeNull();
    expect(back.order_index).toBe(0);
  });

  it('computes scheduled_at_ms from startedAt + minute*60000', () => {
    const event = intakeEvent({ scheduled_at_minute: 45 });
    const row = toRow(event, STARTED_AT, 0);
    expect(row.scheduled_at_ms).toBe(STARTED_AT + 45 * 60_000);
  });

  it('preserves merged intake (items array)', () => {
    const event = intakeEvent({
      payload: {
        items: [
          { food_item_id: 'gel-001', quantity: 1 },
          { food_item_id: 'water-001', quantity: 1, volume_ml: 150 },
        ],
      },
    });
    const back = fromRow(toRow(event, STARTED_AT, 2));
    expect(back.payload.items).toEqual(event.payload.items);
  });

  it('preserves check_in event', () => {
    const event = intakeEvent({ type: 'check_in', payload: {} });
    const back = fromRow(toRow(event, STARTED_AT, 1));
    expect(back.type).toBe('check_in');
    expect(back.payload).toEqual({});
  });

  it('preserves aid_station event', () => {
    const event = intakeEvent({
      type: 'aid_station',
      payload: { aid_station_id: 'as-001', aid_phase: 'arrived' },
    });
    const back = fromRow(toRow(event, STARTED_AT, 3));
    expect(back.type).toBe('aid_station');
    expect(back.payload.aid_station_id).toBe('as-001');
    expect(back.payload.aid_phase).toBe('arrived');
  });

  it('preserves fluid_reminder event', () => {
    const event = intakeEvent({
      type: 'fluid_reminder',
      payload: { target_volume_ml: 250 },
    });
    const back = fromRow(toRow(event, STARTED_AT, 4));
    expect(back.type).toBe('fluid_reminder');
    expect(back.payload.target_volume_ml).toBe(250);
  });

  it('preserves notification_id and order_index', () => {
    const event = intakeEvent();
    const row = toRow(event, STARTED_AT, 7, 'notif-abc');
    const back = fromRow(row);
    expect(back.notification_id).toBe('notif-abc');
    expect(back.order_index).toBe(7);
  });
});
