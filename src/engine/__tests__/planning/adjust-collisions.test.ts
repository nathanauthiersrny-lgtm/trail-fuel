import {
  adjustCollisions,
  CHECK_IN_SHIFT_MIN,
  FLUID_REMINDER_SHIFT_MIN,
  MAX_COLLISION_PASSES,
} from '../../planning/adjust-collisions';
import type { DraftEvent } from '../../planning/check-ins';

const intake = (minute: number): DraftEvent => ({
  scheduled_at_minute: minute,
  type: 'intake',
  payload: { food_item_id: 'gel', quantity: 1 },
});

const checkIn = (minute: number): DraftEvent => ({
  scheduled_at_minute: minute,
  type: 'check_in',
  payload: {},
});

const aidStation = (minute: number, phase: 'approaching' | 'arrived'): DraftEvent => ({
  scheduled_at_minute: minute,
  type: 'aid_station',
  payload: { aid_station_id: 'aid', aid_phase: phase },
});

const fluidReminder = (minute: number): DraftEvent => ({
  scheduled_at_minute: minute,
  type: 'fluid_reminder',
  payload: { target_volume_ml: 250 },
});

describe('adjustCollisions', () => {
  it('shifts a check-in colliding with an intake by +2 min', () => {
    const out = adjustCollisions([intake(30), checkIn(30)]);
    const ci = out.find((e) => e.type === 'check_in')!;
    const it = out.find((e) => e.type === 'intake')!;
    expect(ci.scheduled_at_minute).toBe(32);
    expect(it.scheduled_at_minute).toBe(30);
  });

  it('shifts a check-in colliding with an aid_station by +2 min', () => {
    const out = adjustCollisions([aidStation(60, 'arrived'), checkIn(60)]);
    const ci = out.find((e) => e.type === 'check_in')!;
    const aid = out.find((e) => e.type === 'aid_station')!;
    expect(ci.scheduled_at_minute).toBe(62);
    expect(aid.scheduled_at_minute).toBe(60);
  });

  it('leaves intake + aid_station at the same minute alone (neither shifts)', () => {
    const out = adjustCollisions([intake(60), aidStation(60, 'arrived')]);
    expect(out.every((e) => e.scheduled_at_minute === 60)).toBe(true);
  });

  it('does not shift co-located events of the same type', () => {
    const out = adjustCollisions([checkIn(30), checkIn(30)]);
    expect(out.every((e) => e.scheduled_at_minute === 30)).toBe(true);
  });

  it('cascades when a shifted check-in lands on another collision', () => {
    // Pass 1: ci@30 collides with intake@30 → ci moves to 32
    //         intake@32 also exists → ci@32 still collides
    // Pass 2: ci@32 collides with intake@32 → ci moves to 34
    // Pass 3: no collision at 34 → done
    const out = adjustCollisions([intake(30), checkIn(30), intake(32)]);
    const ci = out.find((e) => e.type === 'check_in')!;
    expect(ci.scheduled_at_minute).toBe(34);
  });

  it('stops after MAX_COLLISION_PASSES iterations even if collisions remain', () => {
    // Construct a wall of intakes at 30, 32, 34, 36 (every shift hits a new collision)
    const events = [intake(30), intake(32), intake(34), intake(36), checkIn(30)];
    const out = adjustCollisions(events);
    const ci = out.find((e) => e.type === 'check_in')!;
    // Pass 1: 30 → 32 (collides with intake@32)
    // Pass 2: 32 → 34
    // Pass 3: 34 → 36 — done by max pass count
    expect(ci.scheduled_at_minute).toBe(36);
  });

  it('shifts both check-ins independently when 2 collide with intakes at the same minute', () => {
    const out = adjustCollisions([intake(30), checkIn(30), checkIn(30)]);
    const checkIns = out.filter((e) => e.type === 'check_in');
    expect(checkIns).toHaveLength(2);
    expect(checkIns.every((e) => e.scheduled_at_minute === 32)).toBe(true);
  });

  it('does not mutate input events (returns new array of clones)', () => {
    const original = [intake(30), checkIn(30)];
    const originalMinutes = original.map((e) => e.scheduled_at_minute);
    adjustCollisions(original);
    expect(original.map((e) => e.scheduled_at_minute)).toEqual(originalMinutes);
  });

  it('handles empty input', () => {
    expect(adjustCollisions([])).toEqual([]);
  });

  it('exposes constants CHECK_IN_SHIFT_MIN = 2 and MAX_COLLISION_PASSES = 3', () => {
    expect(CHECK_IN_SHIFT_MIN).toBe(2);
    expect(MAX_COLLISION_PASSES).toBe(3);
  });

  it('shifts a fluid_reminder colliding with an intake by +2 min', () => {
    const out = adjustCollisions([intake(30), fluidReminder(30)]);
    const fr = out.find((e) => e.type === 'fluid_reminder')!;
    const it = out.find((e) => e.type === 'intake')!;
    expect(fr.scheduled_at_minute).toBe(32);
    expect(it.scheduled_at_minute).toBe(30);
  });

  it('shifts a fluid_reminder colliding with an aid_station by +2 min', () => {
    const out = adjustCollisions([aidStation(60, 'arrived'), fluidReminder(60)]);
    const fr = out.find((e) => e.type === 'fluid_reminder')!;
    expect(fr.scheduled_at_minute).toBe(62);
  });

  it('shifts a fluid_reminder colliding with a check_in by +2 min (lower priority)', () => {
    const out = adjustCollisions([checkIn(45), fluidReminder(45)]);
    const fr = out.find((e) => e.type === 'fluid_reminder')!;
    const ci = out.find((e) => e.type === 'check_in')!;
    expect(fr.scheduled_at_minute).toBe(47);
    expect(ci.scheduled_at_minute).toBe(45);
  });

  it('exposes FLUID_REMINDER_SHIFT_MIN = 2', () => {
    expect(FLUID_REMINDER_SHIFT_MIN).toBe(2);
  });
});
