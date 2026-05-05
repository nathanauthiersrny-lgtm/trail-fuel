import type { AidStation } from '../../models/aid-station';
import type { FoodItem } from '../../models/food-item';
import type {
  PlannedEvent,
  PlannedEventType,
} from '../../models/planned-event';

// ─── Display tokens (shared by TimelinePreview, EventCard, SummaryScreen) ───

export const EVENT_TYPE_COLOR: Record<PlannedEventType, string> = {
  intake: '#FF6B35',
  check_in: '#4A90D9',
  aid_station: '#4CAF50',
  fluid_reminder: '#2196F3',
};

export const EVENT_TYPE_ICON: Record<PlannedEventType, string> = {
  intake: '🍊',
  check_in: '💬',
  aid_station: '⛺',
  fluid_reminder: '💧',
};

// ─── Time formatter ─────────────────────────────────────────────────────────

/** "+1h", "+1h22", "+0h05" — relative offset from race start. */
export function formatRelativeMinute(minute: number): string {
  const h = Math.floor(minute / 60);
  const m = Math.round(minute % 60);
  return m === 0 ? `+${h}h` : `+${h}h${String(m).padStart(2, '0')}`;
}

// ─── Per-type description ──────────────────────────────────────────────────

function describeIntake(
  event: PlannedEvent,
  foodItemsById: Map<string, FoodItem>,
): string {
  const { payload } = event;

  if (payload.items && payload.items.length > 0) {
    return payload.items
      .map((item) => {
        const fi = foodItemsById.get(item.food_item_id);
        const name = fi ? fi.name : '?';
        if (item.volume_ml !== undefined) {
          return `${item.quantity * item.volume_ml}ml ${name}`;
        }
        return `${item.quantity} ${name}`;
      })
      .join(' + ');
  }

  if (payload.food_item_id !== undefined) {
    const fi = foodItemsById.get(payload.food_item_id);
    const name = fi ? fi.name : '?';
    const qty = payload.quantity ?? 1;
    if (payload.volume_ml !== undefined) {
      return `${qty * payload.volume_ml}ml ${name}`;
    }
    return `${qty} ${name}`;
  }

  return '—';
}

function describeAidStation(
  event: PlannedEvent,
  aidStationsById: Map<string, AidStation>,
): string {
  const { aid_station_id, aid_phase } = event.payload;
  const aid = aid_station_id ? aidStationsById.get(aid_station_id) : undefined;
  const label = aid ? (aid.name ?? `km ${aid.at_km}`) : 'Ravito';
  const km = aid ? ` (km ${aid.at_km})` : '';
  return aid_phase === 'approaching'
    ? `Dans 3 min · ${label}${km}`
    : `Arrivée · ${label}${km}`;
}

function describeFluidReminder(event: PlannedEvent): string {
  const vol = event.payload.target_volume_ml;
  return vol ? `Vise ${vol}ml` : 'Bois un coup';
}

export function describeEvent(
  event: PlannedEvent,
  foodItemsById: Map<string, FoodItem>,
  aidStationsById: Map<string, AidStation>,
): string {
  switch (event.type) {
    case 'intake':
      return describeIntake(event, foodItemsById);
    case 'check_in':
      return 'Comment ça va ?';
    case 'aid_station':
      return describeAidStation(event, aidStationsById);
    case 'fluid_reminder':
      return describeFluidReminder(event);
  }
}

// ─── Nutritional summary (subtitle for EventCard) ───────────────────────────

/**
 * Compact carbs/sodium total string for an intake event, e.g. "22g · 30mg Na".
 * Returns null when the payload doesn't reference a known food item.
 */
export function summarizeIntakeNutrition(
  event: PlannedEvent,
  foodItemsById: Map<string, FoodItem>,
): string | null {
  if (event.type !== 'intake') return null;

  const items = event.payload.items?.length
    ? event.payload.items
    : event.payload.food_item_id !== undefined
      ? [
          {
            food_item_id: event.payload.food_item_id,
            quantity: event.payload.quantity ?? 1,
          },
        ]
      : [];

  if (items.length === 0) return null;

  let carbs = 0;
  let sodium = 0;
  let known = false;
  for (const it of items) {
    const fi = foodItemsById.get(it.food_item_id);
    if (!fi) continue;
    known = true;
    carbs += (fi.carbs_g ?? 0) * it.quantity;
    sodium += (fi.sodium_mg ?? 0) * it.quantity;
  }
  if (!known) return null;

  const parts: string[] = [];
  if (carbs > 0) parts.push(`${Math.round(carbs)}g glucides`);
  if (sodium > 0) parts.push(`${Math.round(sodium)}mg Na`);
  return parts.length > 0 ? parts.join(' · ') : null;
}
