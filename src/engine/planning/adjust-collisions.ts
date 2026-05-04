import type { DraftEvent } from './check-ins';

export const CHECK_IN_SHIFT_MIN = 2;
export const FLUID_REMINDER_SHIFT_MIN = 2;
export const MAX_COLLISION_PASSES = 3;

const PRIORITY: Record<string, number> = {
  aid_station: 0,
  intake: 1,
  check_in: 2,
  fluid_reminder: 3,
};

function shouldShift(eventType: string, otherType: string): boolean {
  return (PRIORITY[eventType] ?? 99) > (PRIORITY[otherType] ?? 99);
}

export function adjustCollisions(events: DraftEvent[]): DraftEvent[] {
  const out = events.map((e) => ({ ...e }));

  for (let pass = 0; pass < MAX_COLLISION_PASSES; pass += 1) {
    let didShift = false;

    for (const event of out) {
      if (event.type !== 'check_in' && event.type !== 'fluid_reminder') continue;

      const hasCrossTypeAtSameMinute = out.some(
        (other) =>
          other !== event &&
          other.scheduled_at_minute === event.scheduled_at_minute &&
          shouldShift(event.type, other.type),
      );

      if (hasCrossTypeAtSameMinute) {
        const shift = event.type === 'fluid_reminder' ? FLUID_REMINDER_SHIFT_MIN : CHECK_IN_SHIFT_MIN;
        event.scheduled_at_minute += shift;
        didShift = true;
      }
    }

    if (!didShift) break;
  }

  return out;
}
