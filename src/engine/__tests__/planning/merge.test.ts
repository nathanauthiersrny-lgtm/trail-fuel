import type { DraftEvent } from '../../planning/check-ins';
import { mergeEvents, MERGE_WINDOW_MIN } from '../../planning/merge';

const intake = (minute: number, foodId: string): DraftEvent => ({
  scheduled_at_minute: minute,
  type: 'intake',
  payload: { food_item_id: foodId, quantity: 1 },
});

const fluidReminder = (minute: number, vol: number = 250): DraftEvent => ({
  scheduled_at_minute: minute,
  type: 'fluid_reminder',
  payload: { target_volume_ml: vol },
});

const checkIn = (minute: number): DraftEvent => ({
  scheduled_at_minute: minute,
  type: 'check_in',
  payload: {},
});

const aidStation = (minute: number, id: string, phase: 'approaching' | 'arrived'): DraftEvent => ({
  scheduled_at_minute: minute,
  type: 'aid_station',
  payload: { aid_station_id: id, aid_phase: phase },
});

describe('mergeEvents', () => {
  it('returns an empty array for empty input', () => {
    expect(mergeEvents([])).toEqual([]);
  });

  it('preserves a single event unchanged', () => {
    const events = [intake(30, 'gel')];
    expect(mergeEvents(events)).toEqual(events);
  });

  it('sorts unsorted input by scheduled_at_minute', () => {
    const events = [intake(60, 'a'), intake(30, 'b'), intake(45, 'c')];
    const out = mergeEvents(events);
    expect(out.map((e) => e.scheduled_at_minute)).toEqual([30, 45, 60]);
  });

  it('does not merge two intakes spaced exactly 3 min (strict <)', () => {
    const out = mergeEvents([intake(30, 'a'), intake(33, 'b')]);
    expect(out).toHaveLength(2);
  });

  it('merges two intakes spaced 2 min into a single event with items[]', () => {
    const out = mergeEvents([intake(30, 'gel'), intake(32, 'water')]);
    expect(out).toHaveLength(1);
    expect(out[0]).toEqual({
      scheduled_at_minute: 30,
      type: 'intake',
      payload: {
        items: [
          { food_item_id: 'gel', quantity: 1 },
          { food_item_id: 'water', quantity: 1 },
        ],
      },
    });
  });

  it('chains a 3-intake merge when each pair is < 3 min', () => {
    const out = mergeEvents([intake(30, 'a'), intake(32, 'b'), intake(33, 'c')]);
    expect(out).toHaveLength(1);
    expect(out[0].payload.items).toHaveLength(3);
  });

  it('preserves volume_ml when merging liquid intakes', () => {
    const liquid: DraftEvent = {
      scheduled_at_minute: 30,
      type: 'intake',
      payload: { food_item_id: 'water', quantity: 1, volume_ml: 500 },
    };
    const out = mergeEvents([liquid, intake(32, 'gel')]);
    expect(out[0].payload.items).toContainEqual({
      food_item_id: 'water',
      quantity: 1,
      volume_ml: 500,
    });
  });

  it('does NOT merge a check_in with an intake within 3 min (cross-type rule)', () => {
    const out = mergeEvents([intake(30, 'gel'), checkIn(31)]);
    expect(out).toHaveLength(2);
    expect(out.map((e) => e.type).sort()).toEqual(['check_in', 'intake']);
  });

  it('dedupes two check_ins at the same minute (keeps first)', () => {
    const out = mergeEvents([checkIn(30), checkIn(30)]);
    expect(out).toHaveLength(1);
    expect(out[0].type).toBe('check_in');
  });

  it('NEVER merges aid_station events even within the merge window', () => {
    const out = mergeEvents([
      aidStation(57, 'a', 'approaching'),
      aidStation(60, 'a', 'arrived'),
    ]);
    expect(out).toHaveLength(2);
    expect(out[0].payload.aid_phase).toBe('approaching');
    expect(out[1].payload.aid_phase).toBe('arrived');
  });

  it('keeps an aid_station alongside a co-occurring intake (no merge)', () => {
    const out = mergeEvents([
      aidStation(60, 'a', 'arrived'),
      intake(60, 'gel'),
    ]);
    expect(out).toHaveLength(2);
  });

  it('handles already-merged intakes (items[]) correctly when re-merging', () => {
    const preMerged: DraftEvent = {
      scheduled_at_minute: 30,
      type: 'intake',
      payload: {
        items: [
          { food_item_id: 'a', quantity: 1 },
          { food_item_id: 'b', quantity: 1 },
        ],
      },
    };
    const out = mergeEvents([preMerged, intake(31, 'c')]);
    expect(out).toHaveLength(1);
    expect(out[0].payload.items).toHaveLength(3);
  });

  it('exposes MERGE_WINDOW_MIN = 3', () => {
    expect(MERGE_WINDOW_MIN).toBe(3);
  });

  it('does NOT merge two fluid_reminders within the merge window', () => {
    const out = mergeEvents([fluidReminder(30, 250), fluidReminder(32, 250)]);
    expect(out).toHaveLength(2);
    expect(out.every((e) => e.type === 'fluid_reminder')).toBe(true);
  });

  it('does NOT merge a fluid_reminder with an intake within the merge window', () => {
    const out = mergeEvents([intake(30, 'gel'), fluidReminder(31, 250)]);
    expect(out).toHaveLength(2);
  });
});
