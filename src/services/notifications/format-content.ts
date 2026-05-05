import type * as Notifications from 'expo-notifications';

import type { AidStation } from '../../models/aid-station';
import type { FoodItem } from '../../models/food-item';
import type {
  IntakeItem,
  PlannedEvent,
} from '../../models/planned-event';

import { INTAKE_ACTION_CATEGORY } from './category';

export type NotificationContent = Notifications.NotificationContentInput;

export type EventNotificationData = {
  event_id: string;
  race_id: string;
  type: PlannedEvent['type'];
};

// ─── Helpers ────────────────────────────────────────────────────────────────

function describeIntakeItem(
  item: IntakeItem,
  foodItemsById: Record<string, FoodItem>,
): string {
  const food = foodItemsById[item.food_item_id];
  const name = food?.name ?? 'item inconnu';
  const qtyLabel = item.quantity > 1 ? `${item.quantity}× ` : '';
  if (food?.type === 'water' || item.volume_ml !== undefined) {
    const ml = item.volume_ml ?? food?.volume_ml;
    return ml !== undefined ? `${qtyLabel}${ml}ml ${name}` : `${qtyLabel}${name}`;
  }
  return `${qtyLabel}${name}`;
}

function describeIntake(
  event: PlannedEvent,
  foodItemsById: Record<string, FoodItem>,
): string {
  if (event.payload.items && event.payload.items.length > 0) {
    return event.payload.items
      .map((it) => describeIntakeItem(it, foodItemsById))
      .join(' + ');
  }
  if (event.payload.food_item_id !== undefined) {
    return describeIntakeItem(
      {
        food_item_id: event.payload.food_item_id,
        quantity: event.payload.quantity ?? 1,
        ...(event.payload.volume_ml !== undefined
          ? { volume_ml: event.payload.volume_ml }
          : {}),
      },
      foodItemsById,
    );
  }
  return 'Intake';
}

function buildData(event: PlannedEvent): EventNotificationData {
  return {
    event_id: event.id,
    race_id: event.race_id,
    type: event.type,
  };
}

// ─── Per-type formatters ────────────────────────────────────────────────────

export function buildIntakeNotificationContent(
  event: PlannedEvent,
  foodItemsById: Record<string, FoodItem>,
): NotificationContent {
  const description = describeIntake(event, foodItemsById);
  return {
    title: `Maintenant : ${description}`,
    body: 'Swipe pour valider',
    categoryIdentifier: INTAKE_ACTION_CATEGORY,
    data: buildData(event),
  };
}

export function buildCheckInNotificationContent(
  event: PlannedEvent,
): NotificationContent {
  return {
    title: 'Check-in — comment ça va ?',
    body: 'Tape pour répondre',
    data: buildData(event),
  };
}

export function buildAidStationNotificationContent(
  event: PlannedEvent,
  aidStationsById: Record<string, AidStation>,
): NotificationContent {
  const stationId = event.payload.aid_station_id;
  const station = stationId ? aidStationsById[stationId] : undefined;
  const phase = event.payload.aid_phase ?? 'arrived';
  const kmLabel = station ? `km ${station.at_km}` : 'ravito';
  const nameLabel = station?.name ? ` · ${station.name}` : '';

  const title =
    phase === 'approaching'
      ? `Ravito dans ~3 min · ${kmLabel}${nameLabel}`
      : `Ravito · ${kmLabel}${nameLabel}`;

  return {
    title,
    body: phase === 'approaching' ? 'Anticipe la pause' : 'Tape pour les détails',
    data: buildData(event),
  };
}

export function buildFluidReminderNotificationContent(
  event: PlannedEvent,
): NotificationContent {
  const target = event.payload.target_volume_ml;
  const body = target !== undefined ? `Vise ${target}ml` : 'Une gorgée';
  return {
    title: 'Bois',
    body,
    categoryIdentifier: INTAKE_ACTION_CATEGORY,
    data: buildData(event),
  };
}

// ─── Dispatcher ──────────────────────────────────────────────────────────────

export function buildNotificationContent(
  event: PlannedEvent,
  foodItemsById: Record<string, FoodItem>,
  aidStationsById: Record<string, AidStation>,
): NotificationContent {
  switch (event.type) {
    case 'intake':
      return buildIntakeNotificationContent(event, foodItemsById);
    case 'check_in':
      return buildCheckInNotificationContent(event);
    case 'aid_station':
      return buildAidStationNotificationContent(event, aidStationsById);
    case 'fluid_reminder':
      return buildFluidReminderNotificationContent(event);
  }
}

export function eventChannelId(eventType: PlannedEvent['type']): string {
  return eventType === 'check_in' ? 'checkin' : 'intake';
}
