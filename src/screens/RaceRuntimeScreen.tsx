import { Redirect, router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  ToastAndroid,
  View,
} from 'react-native';

import { EventCard, type EventCardActionInput } from '../components/runtime/EventCard';
import {
  describeEvent,
  EVENT_TYPE_COLOR,
  EVENT_TYPE_ICON,
  formatChrono,
  formatRelativeMinute,
} from '../components/runtime/event-description';
import type { PersistedPlannedEvent } from '../db/repos/planned-event-repo';
import { listFoodItems } from '../db/repos/food-item-repo';
import { getOrCreateProfile } from '../db/repos/profile-repo';
import { generatePlan } from '../engine/planning/generate';
import { useActiveRace } from '../hooks/use-active-race';
import { useDatabase } from '../hooks/use-database';
import type { AidStation } from '../models/aid-station';
import type { EventLog } from '../models/event-log';
import type { FoodItem } from '../models/food-item';
import type { Profile } from '../models/profile';
import type { Race } from '../models/race';
import { subscribeLogInserted } from '../services/notifications/log-emitter';
import { endRace } from '../services/race-runtime/end-race';
import { logEvent } from '../services/race-runtime/log-event';
import {
  NotificationPermissionDeniedError,
  startRace,
} from '../services/race-runtime/start-race';
import { verifyAndRescheduleIfNeeded } from '../services/race-runtime/watchdog';

// ─── Helpers ────────────────────────────────────────────────────────────────

function buildFoodItemMap(items: FoodItem[]): Map<string, FoodItem> {
  return new Map(items.map((f) => [f.id, f]));
}

function buildAidStationMap(stations: AidStation[]): Map<string, AidStation> {
  return new Map(stations.map((a) => [a.id, a]));
}

// ─── Screen ─────────────────────────────────────────────────────────────────

export default function RaceRuntimeScreen() {
  const params = useLocalSearchParams<{ id: string; focus?: string }>();
  const raceId = params.id;
  const dbState = useDatabase();
  const state = useActiveRace(raceId);

  const [foodItems, setFoodItems] = useState<FoodItem[] | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);

  useEffect(() => {
    if (dbState.status !== 'ready') return;
    let cancelled = false;
    void Promise.all([
      listFoodItems(dbState.db),
      getOrCreateProfile(dbState.db),
    ]).then(([items, p]) => {
      if (cancelled) return;
      setFoodItems(items);
      setProfile(p);
    });
    return () => {
      cancelled = true;
    };
  }, [dbState]);

  // Listen for notif-driven logs (e.g. user taps "Done" from lock screen
  // while the screen is mounted) so the cursor reflects the change.
  useEffect(() => {
    if (!raceId) return;
    return subscribeLogInserted((touchedRaceId) => {
      if (touchedRaceId === raceId) void state.refresh();
    });
  }, [raceId, state.refresh]);

  const foodItemsById = useMemo(
    () => buildFoodItemMap(foodItems ?? []),
    [foodItems],
  );
  const aidStationsById = useMemo(
    () => buildAidStationMap(state.race?.aid_stations ?? []),
    [state.race?.aid_stations],
  );

  if (
    dbState.status === 'loading' ||
    state.status === 'loading' ||
    foodItems === null ||
    profile === null
  ) {
    return <CenteredMessage spinner label="Chargement…" />;
  }

  if (dbState.status === 'error') {
    return <CenteredMessage label={`Erreur DB : ${dbState.error.message}`} />;
  }

  if (state.status === 'error') {
    return <CenteredMessage label={`Erreur : ${state.error.message}`} />;
  }

  if (state.status === 'not_found') {
    return <CenteredMessage label="Course introuvable." />;
  }

  const { race, cursor, elapsedMs } = state;

  if (race.status === 'completed' || race.status === 'abandoned') {
    return <Redirect href={{ pathname: '/race/[id]/summary', params: { id: race.id } }} />;
  }

  if (race.status === 'planned') {
    return (
      <PlannedView
        race={race}
        profile={profile}
        foodItems={foodItems}
        foodItemsById={foodItemsById}
        aidStationsById={aidStationsById}
        db={dbState.db}
        onStarted={state.refresh}
      />
    );
  }

  return (
    <InProgressView
      race={race}
      cursor={cursor}
      elapsedMs={elapsedMs}
      foodItemsById={foodItemsById}
      aidStationsById={aidStationsById}
      db={dbState.db}
      refresh={state.refresh}
    />
  );
}

// ─── Planned state ──────────────────────────────────────────────────────────

type PlannedViewProps = {
  race: Race;
  profile: Profile;
  foodItems: FoodItem[];
  foodItemsById: Map<string, FoodItem>;
  aidStationsById: Map<string, AidStation>;
  db: import('expo-sqlite').SQLiteDatabase;
  onStarted: () => Promise<void>;
};

function PlannedView({
  race,
  profile,
  foodItems,
  foodItemsById,
  aidStationsById,
  db,
  onStarted,
}: PlannedViewProps) {
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleStart = useCallback(async () => {
    if (starting) return;
    setStarting(true);
    setError(null);
    try {
      const now = Date.now();
      const plan = generatePlan({ profile, race, foodItems, now });
      const result = await startRace({
        db,
        race,
        events: plan.events,
        foodItemsById: Object.fromEntries(foodItemsById),
        aidStationsById: Object.fromEntries(aidStationsById),
        now,
      });
      console.log(
        `[runtime] race started: ${result.scheduledCount} notifs scheduled, ${result.skippedCount} skipped`,
      );
      await onStarted();
    } catch (err) {
      if (err instanceof NotificationPermissionDeniedError) {
        setError('Permissions notif refusées. Active-les dans les réglages Android.');
      } else {
        setError(err instanceof Error ? err.message : String(err));
      }
      setStarting(false);
    }
  }, [starting, profile, race, foodItems, foodItemsById, aidStationsById, db, onStarted]);

  return (
    <View style={styles.plannedContainer}>
      <View style={styles.plannedHeader}>
        <Text style={styles.plannedTitle}>{race.name ?? 'Course'}</Text>
        <Text style={styles.plannedSubtitle}>
          {Math.round(race.estimated_duration_min / 60 * 10) / 10}h estimées · {race.session_type}
        </Text>
      </View>

      <Pressable
        onPress={handleStart}
        disabled={starting}
        style={({ pressed }) => [
          styles.startButton,
          starting && styles.startButtonDisabled,
          pressed && !starting && styles.startButtonPressed,
        ]}
      >
        {starting ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.startButtonText}>C'est parti</Text>
        )}
      </Pressable>

      {error ? <Text style={styles.errorText}>{error}</Text> : null}

      <Text style={styles.plannedHint}>
        Au tap, le plan est figé et les notifs sont programmées. Le téléphone peut
        rester verrouillé.
      </Text>
    </View>
  );
}

// ─── In-progress state ──────────────────────────────────────────────────────

type InProgressViewProps = {
  race: Race;
  cursor: NonNullable<ReturnType<typeof useActiveRace> extends infer R ? R extends { cursor: infer C } ? C : never : never>;
  elapsedMs: number;
  foodItemsById: Map<string, FoodItem>;
  aidStationsById: Map<string, AidStation>;
  db: import('expo-sqlite').SQLiteDatabase;
  refresh: () => Promise<void>;
};

function InProgressView({
  race,
  cursor,
  elapsedMs,
  foodItemsById,
  aidStationsById,
  db,
  refresh,
}: InProgressViewProps) {
  const watchdogRanFor = useRef<string | null>(null);

  // Watchdog: Android force-stop drops scheduled notifications. Run once per
  // mount per race to detect missing notifs and reschedule them. Idempotent —
  // a no-op when nothing is missing.
  useEffect(() => {
    if (watchdogRanFor.current === race.id) return;
    watchdogRanFor.current = race.id;
    void verifyAndRescheduleIfNeeded({
      db,
      race,
      foodItemsById: Object.fromEntries(foodItemsById),
      aidStationsById: Object.fromEntries(aidStationsById),
      now: Date.now(),
    })
      .then((result) => {
        if (result.rescheduled > 0) {
          console.log(
            `[watchdog] re-scheduled ${result.rescheduled}/${result.rescheduleAttempted} notifs (${result.aliveCount} were already alive)`,
          );
          if (Platform.OS === 'android') {
            ToastAndroid.show(
              `Notifs restaurées (${result.rescheduled})`,
              ToastAndroid.SHORT,
            );
          }
          void refresh();
        } else if (result.failed > 0) {
          console.warn(
            `[watchdog] ${result.failed} reschedule failures, ${result.aliveCount} alive`,
          );
        }
      })
      .catch((err) => {
        console.error('[watchdog] failed', err);
      });
  }, [race, db, foodItemsById, aidStationsById, refresh]);

  const handleAction = useCallback(
    async (event: PersistedPlannedEvent, input: EventCardActionInput) => {
      try {
        await logEvent({
          db,
          raceId: race.id,
          plannedEventId: event.id,
          status: input.status,
          ...(input.feeling !== undefined ? { feeling: input.feeling } : {}),
          now: Date.now(),
        });
        await refresh();
      } catch (err) {
        console.error('[runtime] logEvent failed', err);
      }
    },
    [db, race.id, refresh],
  );

  const handleEnd = useCallback(() => {
    Alert.alert(
      'Fin de course',
      'Comment veux-tu la marquer ?',
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Abandonnée',
          style: 'destructive',
          onPress: () => {
            void finishRace('abandoned');
          },
        },
        {
          text: 'Terminée',
          onPress: () => {
            void finishRace('completed');
          },
        },
      ],
      { cancelable: true },
    );

    async function finishRace(status: 'completed' | 'abandoned') {
      try {
        await endRace({ db, raceId: race.id, status, now: Date.now() });
        router.replace({
          pathname: '/race/[id]/summary',
          params: { id: race.id },
        });
      } catch (err) {
        console.error('[runtime] endRace failed', err);
        Alert.alert('Erreur', err instanceof Error ? err.message : String(err));
      }
    }
  }, [db, race.id]);

  return (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
      <View style={styles.chronoCard}>
        <Text style={styles.chronoLabel}>Course en cours</Text>
        <Text style={styles.chronoValue}>{formatChrono(elapsedMs)}</Text>
      </View>

      <Text style={styles.sectionLabel}>Maintenant</Text>
      {cursor.currentEvent ? (
        <EventCard
          event={cursor.currentEvent}
          foodItemsById={foodItemsById}
          aidStationsById={aidStationsById}
          log={cursor.logsByEventId[cursor.currentEvent.id]}
          onAction={(input) => {
            void handleAction(cursor.currentEvent!, input);
          }}
        />
      ) : (
        <View style={styles.idleCard}>
          <Text style={styles.idleText}>
            {cursor.upcomingEvents.length > 0
              ? 'Rien à faire pour l\'instant — la prochaine arrivera bientôt.'
              : 'Plus rien au planning.'}
          </Text>
        </View>
      )}

      {cursor.upcomingEvents.length > 0 ? (
        <>
          <Text style={styles.sectionLabel}>À venir</Text>
          {cursor.upcomingEvents.map((e) => (
            <CompactEventRow
              key={e.id}
              event={e}
              foodItemsById={foodItemsById}
              aidStationsById={aidStationsById}
            />
          ))}
        </>
      ) : null}

      {cursor.pastEvents.length > 0 ? (
        <>
          <Text style={styles.sectionLabel}>Passé</Text>
          {cursor.pastEvents.map((e) => (
            <CompactEventRow
              key={e.id}
              event={e}
              foodItemsById={foodItemsById}
              aidStationsById={aidStationsById}
              log={cursor.logsByEventId[e.id]}
              past
            />
          ))}
        </>
      ) : null}

      <Pressable
        onPress={handleEnd}
        style={({ pressed }) => [styles.endButton, pressed && styles.endButtonPressed]}
      >
        <Text style={styles.endButtonText}>Fin de course</Text>
      </Pressable>
    </ScrollView>
  );
}

// ─── Compact row (upcoming / past) ──────────────────────────────────────────

type CompactEventRowProps = {
  event: PersistedPlannedEvent;
  foodItemsById: Map<string, FoodItem>;
  aidStationsById: Map<string, AidStation>;
  log?: EventLog;
  past?: boolean;
};

function CompactEventRow({
  event,
  foodItemsById,
  aidStationsById,
  log,
  past,
}: CompactEventRowProps) {
  const description = describeEvent(event, foodItemsById, aidStationsById);
  const statusBadge = past ? renderStatusBadge(log) : null;

  return (
    <View style={[styles.row, past && styles.rowPast]}>
      <View style={[styles.dot, { backgroundColor: EVENT_TYPE_COLOR[event.type] }]} />
      <Text style={styles.rowTime}>
        {formatRelativeMinute(event.scheduled_at_minute)}
      </Text>
      <Text style={styles.rowIcon}>{EVENT_TYPE_ICON[event.type]}</Text>
      <Text
        style={[styles.rowDesc, past && styles.rowDescPast]}
        numberOfLines={2}
      >
        {description}
      </Text>
      {statusBadge}
    </View>
  );
}

function renderStatusBadge(log?: EventLog) {
  if (!log) return <Text style={styles.statusMissed}>· manqué</Text>;
  if (log.status === 'done') {
    const feeling = log.feeling
      ? ` ${log.feeling === 'good' ? '😀' : log.feeling === 'meh' ? '😐' : '😖'}`
      : '';
    return <Text style={styles.statusDone}>✓{feeling}</Text>;
  }
  return <Text style={styles.statusSkipped}>✗</Text>;
}

// ─── Misc ───────────────────────────────────────────────────────────────────

function CenteredMessage({ label, spinner }: { label: string; spinner?: boolean }) {
  return (
    <View style={styles.centered}>
      {spinner ? <ActivityIndicator size="large" color="#0a7ea4" /> : null}
      <Text style={styles.centeredText}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
    gap: 12,
    backgroundColor: '#fff',
  },
  centeredText: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
  },
  // Planned
  plannedContainer: {
    flex: 1,
    padding: 24,
    backgroundColor: '#fff',
    justifyContent: 'center',
    gap: 24,
  },
  plannedHeader: {
    alignItems: 'center',
    gap: 6,
  },
  plannedTitle: {
    fontSize: 28,
    fontWeight: '700',
    color: '#111',
  },
  plannedSubtitle: {
    fontSize: 15,
    color: '#666',
  },
  startButton: {
    backgroundColor: '#1f9d55',
    borderRadius: 16,
    paddingVertical: 28,
    alignItems: 'center',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
  },
  startButtonDisabled: {
    backgroundColor: '#888',
  },
  startButtonPressed: {
    backgroundColor: '#187340',
  },
  startButtonText: {
    color: '#fff',
    fontSize: 24,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  plannedHint: {
    fontSize: 13,
    color: '#888',
    textAlign: 'center',
    paddingHorizontal: 12,
  },
  errorText: {
    color: '#cc3333',
    fontSize: 14,
    textAlign: 'center',
  },
  // In-progress
  scroll: {
    flex: 1,
    backgroundColor: '#f7f7f7',
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 48,
  },
  chronoCard: {
    backgroundColor: '#111',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    marginBottom: 16,
  },
  chronoLabel: {
    fontSize: 11,
    color: '#999',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  chronoValue: {
    fontSize: 36,
    fontWeight: '700',
    color: '#fff',
    fontVariant: ['tabular-nums'],
    marginTop: 4,
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#888',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginTop: 12,
    marginBottom: 6,
  },
  idleCard: {
    padding: 24,
    backgroundColor: '#fff',
    borderRadius: 12,
    alignItems: 'center',
  },
  idleText: {
    fontSize: 14,
    color: '#888',
    textAlign: 'center',
  },
  // Compact rows
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 4,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#e0e0e0',
    gap: 8,
  },
  rowPast: {
    opacity: 0.7,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    flexShrink: 0,
  },
  rowTime: {
    fontSize: 12,
    color: '#555',
    width: 52,
    flexShrink: 0,
  },
  rowIcon: {
    fontSize: 14,
    flexShrink: 0,
  },
  rowDesc: {
    flex: 1,
    fontSize: 13,
    color: '#222',
  },
  rowDescPast: {
    color: '#666',
  },
  statusDone: {
    color: '#1f9d55',
    fontSize: 13,
    fontWeight: '700',
  },
  statusSkipped: {
    color: '#cc3333',
    fontSize: 13,
    fontWeight: '700',
  },
  statusMissed: {
    color: '#999',
    fontSize: 12,
    fontStyle: 'italic',
  },
  // End button
  endButton: {
    marginTop: 24,
    backgroundColor: '#fff',
    borderRadius: 12,
    paddingVertical: 18,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#cc3333',
  },
  endButtonPressed: {
    backgroundColor: '#fff5f5',
  },
  endButtonText: {
    color: '#cc3333',
    fontSize: 16,
    fontWeight: '700',
  },
});
