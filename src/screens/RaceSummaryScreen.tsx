import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import {
  describeEvent,
  EVENT_TYPE_COLOR,
  EVENT_TYPE_ICON,
  formatChrono,
  formatRelativeMinute,
} from '../components/runtime/event-description';
import { listFoodItems } from '../db/repos/food-item-repo';
import type { PersistedPlannedEvent } from '../db/repos/planned-event-repo';
import {
  computeSummaryStats,
  type ActionStats,
  type CheckInStats,
} from '../engine/runtime/summary-stats';
import { useActiveRace } from '../hooks/use-active-race';
import { useDatabase } from '../hooks/use-database';
import type { AidStation } from '../models/aid-station';
import type { EventLog } from '../models/event-log';
import type { FoodItem } from '../models/food-item';
import type { RaceStatus } from '../models/race';

// ─── Screen ─────────────────────────────────────────────────────────────────

export default function RaceSummaryScreen() {
  const { id: raceId } = useLocalSearchParams<{ id: string }>();
  const dbState = useDatabase();
  const state = useActiveRace(raceId);
  const [foodItems, setFoodItems] = useState<FoodItem[] | null>(null);

  useEffect(() => {
    if (dbState.status !== 'ready') return;
    let cancelled = false;
    void listFoodItems(dbState.db).then((items) => {
      if (cancelled) return;
      setFoodItems(items);
    });
    return () => {
      cancelled = true;
    };
  }, [dbState]);

  const foodItemsById = useMemo(
    () => new Map((foodItems ?? []).map((f) => [f.id, f])),
    [foodItems],
  );
  const aidStationsById = useMemo(
    () => new Map((state.race?.aid_stations ?? []).map((a) => [a.id, a])),
    [state.race?.aid_stations],
  );

  const plannedEvents = useMemo(() => {
    if (state.status !== 'ready') return [];
    return [
      ...state.cursor.pastEvents,
      ...(state.cursor.currentEvent ? [state.cursor.currentEvent] : []),
      ...state.cursor.upcomingEvents,
    ].sort((a, b) => a.scheduled_at_ms - b.scheduled_at_ms);
  }, [state]);

  const logs: EventLog[] = useMemo(() => {
    if (state.status !== 'ready') return [];
    return Object.values(state.cursor.logsByEventId);
  }, [state]);

  if (state.status === 'loading' || foodItems === null) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#0a7ea4" />
      </View>
    );
  }
  if (state.status === 'not_found') {
    return <CenteredText label="Course introuvable." />;
  }
  if (state.status === 'error') {
    return <CenteredText label={`Erreur : ${state.error.message}`} />;
  }

  const { race } = state;
  const stats = computeSummaryStats({
    plannedEvents,
    logs,
    startedAt: race.started_at,
    endedAt: race.ended_at,
    now: Date.now(),
  });

  return (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
      <Header
        title={race.name ?? 'Course'}
        status={race.status}
        durationMs={stats.durationMs}
      />

      <Text style={styles.sectionLabel}>Stats</Text>
      <ActionStatRow label="Intakes" icon="🍊" stats={stats.intake} />
      {stats.fluid_reminder.total > 0 ? (
        <ActionStatRow label="Fluid" icon="💧" stats={stats.fluid_reminder} />
      ) : null}
      {stats.check_in.total > 0 ? <CheckInStatRow stats={stats.check_in} /> : null}
      {stats.aid_station.total > 0 ? (
        <View style={styles.statRow}>
          <Text style={styles.statIcon}>⛺</Text>
          <Text style={styles.statLabel}>Ravitos</Text>
          <Text style={styles.statTotalOnly}>{stats.aid_station.total}</Text>
        </View>
      ) : null}

      <Text style={styles.sectionLabel}>Détail</Text>
      {plannedEvents.length === 0 ? (
        <Text style={styles.emptyDetail}>Aucun événement planifié.</Text>
      ) : (
        plannedEvents.map((event) => (
          <DetailRow
            key={event.id}
            event={event}
            log={state.cursor.logsByEventId[event.id]}
            foodItemsById={foodItemsById}
            aidStationsById={aidStationsById}
          />
        ))
      )}

      <Pressable
        onPress={() => router.replace('/')}
        style={({ pressed }) => [styles.backButton, pressed && styles.backButtonPressed]}
      >
        <Text style={styles.backButtonText}>Retour</Text>
      </Pressable>
    </ScrollView>
  );
}

// ─── Header ────────────────────────────────────────────────────────────────

function Header({
  title,
  status,
  durationMs,
}: {
  title: string;
  status: RaceStatus;
  durationMs: number;
}) {
  const badge = STATUS_BADGE[status];
  return (
    <View style={styles.header}>
      <View style={[styles.badge, { backgroundColor: badge.bg }]}>
        <Text style={[styles.badgeText, { color: badge.fg }]}>{badge.label}</Text>
      </View>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.duration}>{formatChrono(durationMs)}</Text>
    </View>
  );
}

const STATUS_BADGE: Record<RaceStatus, { label: string; bg: string; fg: string }> = {
  planned: { label: 'Planifiée', bg: '#e0e0e0', fg: '#444' },
  in_progress: { label: 'En cours', bg: '#fff8e1', fg: '#cc5200' },
  completed: { label: 'Terminée', bg: '#e8f5e9', fg: '#1f7a32' },
  abandoned: { label: 'Abandonnée', bg: '#fff0f0', fg: '#cc3333' },
};

// ─── Stat rows ─────────────────────────────────────────────────────────────

function ActionStatRow({
  label,
  icon,
  stats,
}: {
  label: string;
  icon: string;
  stats: ActionStats;
}) {
  return (
    <View style={styles.statRow}>
      <Text style={styles.statIcon}>{icon}</Text>
      <Text style={styles.statLabel}>{label}</Text>
      <View style={styles.statValues}>
        <StatValue value={stats.done} label="pris" color="#1f9d55" />
        <StatValue value={stats.skipped} label="passé" color="#cc3333" />
        <StatValue value={stats.missed} label="manqué" color="#888" />
        <Text style={styles.statTotal}>/ {stats.total}</Text>
      </View>
    </View>
  );
}

function CheckInStatRow({ stats }: { stats: CheckInStats }) {
  return (
    <View style={styles.statRow}>
      <Text style={styles.statIcon}>💬</Text>
      <Text style={styles.statLabel}>Check-ins</Text>
      <View style={styles.statValues}>
        <StatValue value={stats.good} label="😀" color="#1f9d55" />
        <StatValue value={stats.meh} label="😐" color="#d99e00" />
        <StatValue value={stats.bad} label="😖" color="#cc3333" />
        {stats.missed > 0 ? (
          <StatValue value={stats.missed} label="manqué" color="#888" />
        ) : null}
        <Text style={styles.statTotal}>/ {stats.total}</Text>
      </View>
    </View>
  );
}

function StatValue({
  value,
  label,
  color,
}: {
  value: number;
  label: string;
  color: string;
}) {
  return (
    <View style={styles.statValue}>
      <Text style={[styles.statValueNum, { color }]}>{value}</Text>
      <Text style={styles.statValueLabel}>{label}</Text>
    </View>
  );
}

// ─── Detail row ────────────────────────────────────────────────────────────

function DetailRow({
  event,
  log,
  foodItemsById,
  aidStationsById,
}: {
  event: PersistedPlannedEvent;
  log?: EventLog;
  foodItemsById: Map<string, FoodItem>;
  aidStationsById: Map<string, AidStation>;
}) {
  const description = describeEvent(event, foodItemsById, aidStationsById);
  return (
    <View style={styles.detailRow}>
      <View style={[styles.detailDot, { backgroundColor: EVENT_TYPE_COLOR[event.type] }]} />
      <Text style={styles.detailTime}>
        {formatRelativeMinute(event.scheduled_at_minute)}
      </Text>
      <Text style={styles.detailIcon}>{EVENT_TYPE_ICON[event.type]}</Text>
      <Text style={styles.detailDesc} numberOfLines={2}>
        {description}
      </Text>
      <DetailBadge event={event} log={log} />
    </View>
  );
}

function DetailBadge({
  event,
  log,
}: {
  event: PersistedPlannedEvent;
  log?: EventLog;
}) {
  if (event.type === 'aid_station') {
    return null;
  }
  if (!log) {
    return <Text style={styles.detailMissed}>· manqué</Text>;
  }
  if (log.status === 'done') {
    if (event.type === 'check_in' && log.feeling) {
      const emoji =
        log.feeling === 'good' ? '😀' : log.feeling === 'meh' ? '😐' : '😖';
      return <Text style={styles.detailDone}>{emoji}</Text>;
    }
    return <Text style={styles.detailDone}>✓</Text>;
  }
  return <Text style={styles.detailSkipped}>✗</Text>;
}

// ─── Misc ──────────────────────────────────────────────────────────────────

function CenteredText({ label }: { label: string }) {
  return (
    <View style={styles.centered}>
      <Text style={styles.centeredLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fff',
    padding: 24,
  },
  centeredLabel: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
  },
  scroll: {
    flex: 1,
    backgroundColor: '#f7f7f7',
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 48,
  },
  header: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 20,
    alignItems: 'center',
    marginBottom: 12,
  },
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 999,
    marginBottom: 8,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    color: '#111',
    marginBottom: 4,
    textAlign: 'center',
  },
  duration: {
    fontSize: 32,
    fontWeight: '700',
    color: '#111',
    fontVariant: ['tabular-nums'],
    marginTop: 4,
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#888',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginTop: 16,
    marginBottom: 8,
  },
  statRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 14,
    marginBottom: 8,
    gap: 12,
  },
  statIcon: {
    fontSize: 20,
    width: 24,
    textAlign: 'center',
  },
  statLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#222',
    width: 72,
  },
  statValues: {
    flexDirection: 'row',
    alignItems: 'baseline',
    flex: 1,
    justifyContent: 'flex-end',
    gap: 12,
  },
  statValue: {
    alignItems: 'center',
  },
  statValueNum: {
    fontSize: 18,
    fontWeight: '700',
  },
  statValueLabel: {
    fontSize: 10,
    color: '#888',
    marginTop: 1,
  },
  statTotal: {
    fontSize: 13,
    color: '#888',
    fontWeight: '600',
    marginLeft: 4,
  },
  statTotalOnly: {
    fontSize: 18,
    fontWeight: '700',
    color: '#222',
    flex: 1,
    textAlign: 'right',
  },
  emptyDetail: {
    color: '#888',
    fontStyle: 'italic',
    textAlign: 'center',
    paddingVertical: 24,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 4,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#e0e0e0',
    gap: 8,
  },
  detailDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    flexShrink: 0,
  },
  detailTime: {
    fontSize: 12,
    color: '#555',
    width: 52,
    flexShrink: 0,
  },
  detailIcon: {
    fontSize: 14,
    flexShrink: 0,
  },
  detailDesc: {
    flex: 1,
    fontSize: 13,
    color: '#222',
  },
  detailDone: {
    color: '#1f9d55',
    fontSize: 14,
    fontWeight: '700',
  },
  detailSkipped: {
    color: '#cc3333',
    fontSize: 14,
    fontWeight: '700',
  },
  detailMissed: {
    color: '#999',
    fontSize: 12,
    fontStyle: 'italic',
  },
  backButton: {
    marginTop: 24,
    backgroundColor: '#0a7ea4',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
  },
  backButtonPressed: {
    backgroundColor: '#075f7d',
  },
  backButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
});
