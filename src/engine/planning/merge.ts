import type { IntakeItem } from '../../models/planned-event';

import type { DraftEvent } from './check-ins';

export const MERGE_WINDOW_MIN = 3;

export function mergeEvents(events: DraftEvent[]): DraftEvent[] {
  if (events.length === 0) return [];

  const sorted = [...events].sort((a, b) => a.scheduled_at_minute - b.scheduled_at_minute);

  const groups: DraftEvent[][] = [];
  let current: DraftEvent[] = [sorted[0]];

  for (let i = 1; i < sorted.length; i += 1) {
    const last = current[current.length - 1];
    if (sorted[i].scheduled_at_minute - last.scheduled_at_minute < MERGE_WINDOW_MIN) {
      current.push(sorted[i]);
    } else {
      groups.push(current);
      current = [sorted[i]];
    }
  }
  groups.push(current);

  const merged: DraftEvent[] = [];
  for (const group of groups) {
    merged.push(...mergeGroup(group));
  }
  return merged.sort((a, b) => a.scheduled_at_minute - b.scheduled_at_minute);
}

function mergeGroup(group: DraftEvent[]): DraftEvent[] {
  const intakes: DraftEvent[] = [];
  const checkIns: DraftEvent[] = [];
  const aidStations: DraftEvent[] = [];
  const fluidReminders: DraftEvent[] = [];

  for (const ev of group) {
    if (ev.type === 'intake') intakes.push(ev);
    else if (ev.type === 'check_in') checkIns.push(ev);
    else if (ev.type === 'fluid_reminder') fluidReminders.push(ev);
    else aidStations.push(ev);
  }

  const out: DraftEvent[] = [...aidStations, ...fluidReminders];
  if (checkIns.length > 0) out.push(checkIns[0]);
  if (intakes.length === 1) out.push(intakes[0]);
  else if (intakes.length > 1) out.push(mergeIntakes(intakes));
  return out;
}

function mergeIntakes(intakes: DraftEvent[]): DraftEvent {
  const items: IntakeItem[] = [];
  for (const ev of intakes) {
    if (ev.payload.items) {
      items.push(...ev.payload.items);
    } else if (ev.payload.food_item_id !== undefined) {
      items.push({
        food_item_id: ev.payload.food_item_id,
        quantity: ev.payload.quantity ?? 1,
        ...(ev.payload.volume_ml !== undefined ? { volume_ml: ev.payload.volume_ml } : {}),
      });
    }
  }
  return {
    scheduled_at_minute: intakes[0].scheduled_at_minute,
    type: 'intake',
    payload: { items },
  };
}
