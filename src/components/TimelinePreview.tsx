import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import type { AidStation } from '../models/aid-station';
import type { FoodItem } from '../models/food-item';
import type { PlannedEvent, PlannedEventType } from '../models/planned-event';

type Props = {
  events: PlannedEvent[];
  foodItems: FoodItem[];
  aidStations: AidStation[];
};

// ─── Formatting helpers ───────────────────────────────────────────────────────

function formatMinute(m: number): string {
  const h = Math.floor(m / 60);
  const min = Math.round(m % 60);
  return min === 0 ? `+${h}h` : `+${h}h${String(min).padStart(2, '0')}`;
}

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

function describeEvent(
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

// ─── Type colors / icons (text-based) ────────────────────────────────────────

const TYPE_COLOR: Record<PlannedEventType, string> = {
  intake: '#FF6B35',
  check_in: '#4A90D9',
  aid_station: '#4CAF50',
  fluid_reminder: '#2196F3',
};

const TYPE_ICON: Record<PlannedEventType, string> = {
  intake: '🍊',
  check_in: '💬',
  aid_station: '⛺',
  fluid_reminder: '💧',
};

// ─── Component ───────────────────────────────────────────────────────────────

export function TimelinePreview({ events, foodItems, aidStations }: Props) {
  const foodItemsById = new Map(foodItems.map((fi) => [fi.id, fi]));
  const aidStationsById = new Map(aidStations.map((a) => [a.id, a]));

  // Group events by hour bucket
  const buckets = new Map<number, PlannedEvent[]>();
  for (const ev of events) {
    const h = Math.floor(ev.scheduled_at_minute / 60);
    const bucket = buckets.get(h) ?? [];
    bucket.push(ev);
    buckets.set(h, bucket);
  }

  const sortedHours = [...buckets.keys()].sort((a, b) => a - b);

  if (events.length === 0) {
    return (
      <View style={styles.empty}>
        <Text style={styles.emptyText}>Aucun événement planifié.</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {sortedHours.map((h) => {
        const hourEvents = buckets.get(h)!;
        return (
          <View key={h} style={styles.hourGroup}>
            <Text style={styles.hourLabel}>h+{h}</Text>
            {hourEvents.map((ev, idx) => (
              <View key={idx} style={styles.eventRow}>
                <View style={[styles.dot, { backgroundColor: TYPE_COLOR[ev.type] }]} />
                <Text style={styles.timeText}>{formatMinute(ev.scheduled_at_minute)}</Text>
                <Text style={styles.icon}>{TYPE_ICON[ev.type]}</Text>
                <Text style={styles.descText} numberOfLines={2}>
                  {describeEvent(ev, foodItemsById, aidStationsById)}
                </Text>
              </View>
            ))}
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 20,
    paddingBottom: 16,
  },
  hourGroup: {
    marginBottom: 12,
  },
  hourLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#888',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  eventRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: 5,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#f0f0f0',
    gap: 8,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginTop: 4,
    flexShrink: 0,
  },
  timeText: {
    fontSize: 12,
    color: '#555',
    width: 52,
    flexShrink: 0,
  },
  icon: {
    fontSize: 14,
    flexShrink: 0,
  },
  descText: {
    fontSize: 13,
    color: '#222',
    flex: 1,
  },
  empty: {
    padding: 24,
    alignItems: 'center',
  },
  emptyText: {
    color: '#888',
    fontSize: 14,
  },
});
