import type { PlannedEvent } from '../../models/planned-event';

export type DraftEvent = Omit<PlannedEvent, 'id' | 'race_id'>;

export function buildCheckIns(input: {
  totalDurationMin: number;
  firstCheckInMin: number;
  frequencyMin: number;
}): DraftEvent[] {
  const { totalDurationMin, firstCheckInMin, frequencyMin } = input;

  if (firstCheckInMin >= totalDurationMin) return [];
  if (frequencyMin <= 0) {
    return [{ scheduled_at_minute: firstCheckInMin, type: 'check_in', payload: {} }];
  }

  const events: DraftEvent[] = [];
  let t = firstCheckInMin;
  while (t < totalDurationMin) {
    events.push({ scheduled_at_minute: t, type: 'check_in', payload: {} });
    t += frequencyMin;
  }
  return events;
}
