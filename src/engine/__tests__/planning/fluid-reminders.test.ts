import {
  FIRST_FLUID_REMINDER_MIN,
  FLUID_REMINDER_INTERVAL_MIN,
  placeFluidReminders,
} from '../../planning/fluid-reminders';

describe('placeFluidReminders', () => {
  it('places reminders at T+15, T+45, T+75... for a 3h flat course', () => {
    const events = placeFluidReminders({
      effectiveFluidPerH: 500,
      totalDurationMin: 180,
    });
    expect(events.map((e) => e.scheduled_at_minute)).toEqual([
      15, 45, 75, 105, 135, 165,
    ]);
    expect(events.every((e) => e.type === 'fluid_reminder')).toBe(true);
  });

  it('computes volume per reminder as effectiveFluidPerH × 0.5', () => {
    const events = placeFluidReminders({
      effectiveFluidPerH: 500,
      totalDurationMin: 180,
    });
    // 500 ml/h × (30/60) = 250 ml per reminder
    for (const ev of events) {
      expect(ev.payload.target_volume_ml).toBe(250);
    }
  });

  it('uses rationed rate when fluid is insufficient', () => {
    // Effective rate reduced to 300 ml/h → 300 × 0.5 = 150 ml per reminder
    const events = placeFluidReminders({
      effectiveFluidPerH: 300,
      totalDurationMin: 180,
    });
    for (const ev of events) {
      expect(ev.payload.target_volume_ml).toBe(150);
    }
  });

  it('produces correct events for a 1h30 course (no event after T+90)', () => {
    const events = placeFluidReminders({
      effectiveFluidPerH: 500,
      totalDurationMin: 90,
    });
    expect(events.map((e) => e.scheduled_at_minute)).toEqual([15, 45, 75]);
    expect(events.every((e) => e.scheduled_at_minute < 90)).toBe(true);
  });

  it('returns empty array when effective rate is 0 (no fluid available)', () => {
    const events = placeFluidReminders({
      effectiveFluidPerH: 0,
      totalDurationMin: 180,
    });
    expect(events).toEqual([]);
  });

  it('exposes FIRST_FLUID_REMINDER_MIN = 15 and FLUID_REMINDER_INTERVAL_MIN = 30', () => {
    expect(FIRST_FLUID_REMINDER_MIN).toBe(15);
    expect(FLUID_REMINDER_INTERVAL_MIN).toBe(30);
  });
});
