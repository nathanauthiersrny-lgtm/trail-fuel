import { placeFluidReminders } from '../../planning/fluid-reminders';

describe('placeFluidReminders', () => {
  it('places reminders at T+15, T+45, T+75... for a 3h flat course with defaults', () => {
    const events = placeFluidReminders({
      effectiveFluidPerH: 500,
      totalDurationMin: 180,
      firstReminderMin: 15,
      intervalMin: 30,
    });
    expect(events.map((e) => e.scheduled_at_minute)).toEqual([
      15, 45, 75, 105, 135, 165,
    ]);
    expect(events.every((e) => e.type === 'fluid_reminder')).toBe(true);
  });

  it('computes volume per reminder as effectiveFluidPerH × (intervalMin / 60)', () => {
    const events = placeFluidReminders({
      effectiveFluidPerH: 500,
      totalDurationMin: 180,
      firstReminderMin: 15,
      intervalMin: 30,
    });
    // 500 ml/h × (30/60) = 250 ml per reminder
    for (const ev of events) {
      expect(ev.payload.target_volume_ml).toBe(250);
    }
  });

  it('uses rationed rate when fluid is insufficient', () => {
    const events = placeFluidReminders({
      effectiveFluidPerH: 300,
      totalDurationMin: 180,
      firstReminderMin: 15,
      intervalMin: 30,
    });
    for (const ev of events) {
      expect(ev.payload.target_volume_ml).toBe(150);
    }
  });

  it('produces correct events for a 1h30 course (no event after T+90)', () => {
    const events = placeFluidReminders({
      effectiveFluidPerH: 500,
      totalDurationMin: 90,
      firstReminderMin: 15,
      intervalMin: 30,
    });
    expect(events.map((e) => e.scheduled_at_minute)).toEqual([15, 45, 75]);
    expect(events.every((e) => e.scheduled_at_minute < 90)).toBe(true);
  });

  it('returns empty array when effective rate is 0 (no fluid available)', () => {
    const events = placeFluidReminders({
      effectiveFluidPerH: 0,
      totalDurationMin: 180,
      firstReminderMin: 15,
      intervalMin: 30,
    });
    expect(events).toEqual([]);
  });

  it('honours custom firstReminderMin (e.g. start earlier)', () => {
    const events = placeFluidReminders({
      effectiveFluidPerH: 500,
      totalDurationMin: 120,
      firstReminderMin: 5,
      intervalMin: 30,
    });
    expect(events.map((e) => e.scheduled_at_minute)).toEqual([5, 35, 65, 95]);
  });

  it('honours custom intervalMin (e.g. tighter cadence, smaller volume)', () => {
    const events = placeFluidReminders({
      effectiveFluidPerH: 600,
      totalDurationMin: 60,
      firstReminderMin: 10,
      intervalMin: 20,
    });
    expect(events.map((e) => e.scheduled_at_minute)).toEqual([10, 30, 50]);
    // 600 × (20/60) = 200 ml per reminder
    for (const ev of events) {
      expect(ev.payload.target_volume_ml).toBe(200);
    }
  });

  it('returns empty array when intervalMin is 0 (guards against infinite loop)', () => {
    const events = placeFluidReminders({
      effectiveFluidPerH: 500,
      totalDurationMin: 180,
      firstReminderMin: 15,
      intervalMin: 0,
    });
    expect(events).toEqual([]);
  });
});
