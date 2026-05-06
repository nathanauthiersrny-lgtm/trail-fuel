import type { DraftEvent } from './check-ins';

// TODO(post-trail 2026-05-10): ces deux constantes sont totalement décorrélées des
// `ResolvedParams`. Conséquence : aucun override (first_intake_after_min, fréquence,
// fluid_per_hour_ml) ne peut décaler la 1ʳᵉ rappel ni changer son intervalle. À câbler
// sur params.first_intake_after_min + nouveau `fluid_reminder_interval_min`.
export const FIRST_FLUID_REMINDER_MIN = 15;
export const FLUID_REMINDER_INTERVAL_MIN = 30;

export function placeFluidReminders(input: {
  effectiveFluidPerH: number;
  totalDurationMin: number;
}): DraftEvent[] {
  const { effectiveFluidPerH, totalDurationMin } = input;
  if (effectiveFluidPerH <= 0) return [];

  const volumePerReminder = effectiveFluidPerH * (FLUID_REMINDER_INTERVAL_MIN / 60);

  const events: DraftEvent[] = [];
  for (
    let t = FIRST_FLUID_REMINDER_MIN;
    t < totalDurationMin;
    t += FLUID_REMINDER_INTERVAL_MIN
  ) {
    events.push({
      scheduled_at_minute: t,
      type: 'fluid_reminder',
      payload: { target_volume_ml: Math.round(volumePerReminder) },
    });
  }
  return events;
}
