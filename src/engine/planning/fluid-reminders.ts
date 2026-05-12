import type { DraftEvent } from './check-ins';

export function placeFluidReminders(input: {
  effectiveFluidPerH: number;
  totalDurationMin: number;
  firstReminderMin: number;
  intervalMin: number;
}): DraftEvent[] {
  const { effectiveFluidPerH, totalDurationMin, firstReminderMin, intervalMin } = input;
  if (effectiveFluidPerH <= 0) return [];
  if (intervalMin <= 0) return [];

  const volumePerReminder = effectiveFluidPerH * (intervalMin / 60);

  const events: DraftEvent[] = [];
  for (let t = firstReminderMin; t < totalDurationMin; t += intervalMin) {
    events.push({
      scheduled_at_minute: t,
      type: 'fluid_reminder',
      payload: { target_volume_ml: Math.round(volumePerReminder) },
    });
  }
  return events;
}
