import type { DraftEvent } from '../../planning/check-ins';
import {
  FLUID_INTAKE_OFFSET_MIN,
  MERGE_WINDOW_MIN,
  mergeEvents,
  offsetFluidsNearIntakes,
} from '../../planning/merge';

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

describe('offsetFluidsNearIntakes', () => {
  it('exposes FLUID_INTAKE_OFFSET_MIN = 2', () => {
    expect(FLUID_INTAKE_OFFSET_MIN).toBe(2);
  });

  it('leaves fluid_reminders unchanged when no intake is nearby', () => {
    const events = [fluidReminder(15, 250), fluidReminder(45, 250)];
    const out = offsetFluidsNearIntakes(events);
    expect(out.map((e) => e.scheduled_at_minute)).toEqual([15, 45]);
  });

  it('leaves intakes unchanged', () => {
    const events = [intake(30, 'gel'), intake(50, 'bar'), fluidReminder(80, 250)];
    const out = offsetFluidsNearIntakes(events);
    const intakes = out.filter((e) => e.type === 'intake');
    expect(intakes.map((e) => e.scheduled_at_minute)).toEqual([30, 50]);
  });

  it('shifts a fluid_reminder colliding with an intake to intake_time + 2', () => {
    const out = offsetFluidsNearIntakes([intake(30, 'gel'), fluidReminder(31, 250)]);
    const fluid = out.find((e) => e.type === 'fluid_reminder')!;
    expect(fluid.scheduled_at_minute).toBe(32);
  });

  it('shifts even when the fluid is BEFORE the intake (1 min earlier)', () => {
    const out = offsetFluidsNearIntakes([intake(30, 'gel'), fluidReminder(29, 250)]);
    const fluid = out.find((e) => e.type === 'fluid_reminder')!;
    expect(fluid.scheduled_at_minute).toBe(32);
  });

  it('does NOT shift when the fluid is exactly MERGE_WINDOW_MIN away (strict <)', () => {
    // intake@30, fluid@33 → distance = 3 = MERGE_WINDOW_MIN → not "near"
    const out = offsetFluidsNearIntakes([intake(30, 'gel'), fluidReminder(33, 250)]);
    const fluid = out.find((e) => e.type === 'fluid_reminder')!;
    expect(fluid.scheduled_at_minute).toBe(33);
  });

  it('shifts to the CLOSEST nearby intake (not the first one found)', () => {
    // intakes@28 and @33, fluid@32 → closer to 33 (dist 1) than 28 (dist 4)
    const out = offsetFluidsNearIntakes([
      intake(28, 'gel'),
      intake(33, 'bar'),
      fluidReminder(32, 250),
    ]);
    const fluid = out.find((e) => e.type === 'fluid_reminder')!;
    expect(fluid.scheduled_at_minute).toBe(35);
  });

  it('returns events sorted by scheduled_at_minute after shifting', () => {
    const out = offsetFluidsNearIntakes([
      intake(30, 'gel'),
      fluidReminder(29, 250), // → 32
      intake(40, 'bar'),
    ]);
    const times = out.map((e) => e.scheduled_at_minute);
    expect(times).toEqual([...times].sort((a, b) => a - b));
  });

  it('handles multiple fluid_reminders, shifting only those colliding', () => {
    const out = offsetFluidsNearIntakes([
      intake(30, 'gel'),
      fluidReminder(15, 250), // far → unchanged
      fluidReminder(31, 250), // collides → 32
      fluidReminder(60, 250), // far → unchanged
    ]);
    const fluidTimes = out
      .filter((e) => e.type === 'fluid_reminder')
      .map((e) => e.scheduled_at_minute);
    expect(fluidTimes.sort((a, b) => a - b)).toEqual([15, 32, 60]);
  });

  it('preserves the fluid_reminder payload after shifting', () => {
    const out = offsetFluidsNearIntakes([
      intake(30, 'gel'),
      fluidReminder(31, 250),
    ]);
    const fluid = out.find((e) => e.type === 'fluid_reminder')!;
    expect(fluid.payload).toEqual({ target_volume_ml: 250 });
  });
});
