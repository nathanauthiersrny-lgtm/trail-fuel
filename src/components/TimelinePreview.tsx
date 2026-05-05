import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import type { AidStation } from '../models/aid-station';
import type { FoodItem } from '../models/food-item';
import type { PlannedEvent } from '../models/planned-event';

import {
  describeEvent,
  EVENT_TYPE_COLOR,
  EVENT_TYPE_ICON,
  formatRelativeMinute,
} from './runtime/event-description';

type Props = {
  events: PlannedEvent[];
  foodItems: FoodItem[];
  aidStations: AidStation[];
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
                <View style={[styles.dot, { backgroundColor: EVENT_TYPE_COLOR[ev.type] }]} />
                <Text style={styles.timeText}>{formatRelativeMinute(ev.scheduled_at_minute)}</Text>
                <Text style={styles.icon}>{EVENT_TYPE_ICON[ev.type]}</Text>
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
