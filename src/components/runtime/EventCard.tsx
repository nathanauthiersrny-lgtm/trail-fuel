import { StyleSheet, Text, View } from 'react-native';

import type { PersistedPlannedEvent } from '../../db/repos/planned-event-repo';
import type {
  EventLog,
  EventLogFeeling,
  EventLogStatus,
} from '../../models/event-log';
import type { AidStation } from '../../models/aid-station';
import type { FoodItem } from '../../models/food-item';

import { AidStationCard } from './AidStationCard';
import { CheckInCard } from './CheckInCard';
import {
  describeEvent,
  formatRelativeMinute,
  summarizeIntakeNutrition,
} from './event-description';
import { IntakeSwipeCard } from './IntakeSwipeCard';

export type EventCardActionInput = {
  status: EventLogStatus;
  feeling?: EventLogFeeling;
};

export type EventCardProps = {
  event: PersistedPlannedEvent;
  foodItemsById: Map<string, FoodItem>;
  aidStationsById: Map<string, AidStation>;
  log?: EventLog;
  onAction: (input: EventCardActionInput) => void;
};

export function EventCard({
  event,
  foodItemsById,
  aidStationsById,
  log,
  onAction,
}: EventCardProps) {
  switch (event.type) {
    case 'intake': {
      const title = describeEvent(event, foodItemsById, aidStationsById);
      const nutrition = summarizeIntakeNutrition(event, foodItemsById);
      const subtitle =
        nutrition !== null
          ? `${formatRelativeMinute(event.scheduled_at_minute)} · ${nutrition}`
          : formatRelativeMinute(event.scheduled_at_minute);
      return (
        <IntakeSwipeCard
          title={title}
          subtitle={subtitle}
          alreadyLogged={log?.status}
          onDone={() => onAction({ status: 'done' })}
          onSkip={() => onAction({ status: 'skipped' })}
        />
      );
    }

    case 'fluid_reminder': {
      const title = describeEvent(event, foodItemsById, aidStationsById);
      return (
        <IntakeSwipeCard
          title={title}
          subtitle={formatRelativeMinute(event.scheduled_at_minute)}
          alreadyLogged={log?.status}
          onDone={() => onAction({ status: 'done' })}
          onSkip={() => onAction({ status: 'skipped' })}
        />
      );
    }

    case 'check_in':
      return (
        <CheckInCard
          alreadyAnswered={log?.feeling}
          onFeeling={(feeling) => onAction({ status: 'done', feeling })}
        />
      );

    case 'aid_station': {
      const stationId = event.payload.aid_station_id;
      const station = stationId ? aidStationsById.get(stationId) : undefined;
      if (!station) return <UnknownAidStationCard event={event} />;
      const phase = event.payload.aid_phase ?? 'arrived';
      return <AidStationCard station={station} phase={phase} />;
    }
  }
}

function UnknownAidStationCard({ event }: { event: PersistedPlannedEvent }) {
  return (
    <View style={styles.fallbackCard}>
      <Text style={styles.fallbackTitle}>Ravito (info manquante)</Text>
      <Text style={styles.fallbackSubtitle}>
        {formatRelativeMinute(event.scheduled_at_minute)}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  fallbackCard: {
    backgroundColor: '#fafafa',
    borderRadius: 12,
    padding: 16,
    marginVertical: 8,
    borderLeftWidth: 4,
    borderLeftColor: '#bbb',
  },
  fallbackTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#444',
  },
  fallbackSubtitle: {
    fontSize: 13,
    color: '#888',
    marginTop: 4,
  },
});
