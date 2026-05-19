import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
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
import { EventFeedbackBlock } from '../components/summary/EventFeedbackBlock';
import {
  listByRace as listFeedbackByRace,
  upsertBy as upsertFeedback,
} from '../db/repos/event-feedback-repo';
import { listFoodItems } from '../db/repos/food-item-repo';
import type { PersistedPlannedEvent } from '../db/repos/planned-event-repo';
import { getOrCreateProfile } from '../db/repos/profile-repo';
import {
  computeSummaryStats,
  type ActionStats,
  type CheckInStats,
} from '../engine/runtime/summary-stats';
import { useActiveRace } from '../hooks/use-active-race';
import { useDatabase } from '../hooks/use-database';
import type { AidStation } from '../models/aid-station';
import type { Profile } from '../models/profile';
import { applyProposalToProfile } from '../services/post-race/apply-proposal';
import { buildAnalyzePayload } from '../services/post-race/build-payload';
import {
  analyzeRace,
  describeAnalyzeFailure,
  type PostRaceProposal,
} from '../services/post-race/client';
import {
  skipReasonToTag,
  type EventFeedback,
  type FeedbackTag,
  type QuantityActual,
} from '../models/event-feedback';
import type { EventLog } from '../models/event-log';
import type { FoodItem } from '../models/food-item';
import type { RaceStatus } from '../models/race';

// ─── Screen ─────────────────────────────────────────────────────────────────

export default function RaceSummaryScreen() {
  const { id: raceId } = useLocalSearchParams<{ id: string }>();
  const dbState = useDatabase();
  const state = useActiveRace(raceId);
  const [foodItems, setFoodItems] = useState<FoodItem[] | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [feedbacks, setFeedbacks] = useState<Map<string, EventFeedback>>(
    () => new Map(),
  );
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set());
  const [analyzing, setAnalyzing] = useState(false);
  const [analysis, setAnalysis] = useState<{
    summary_fr: string;
    proposals: PostRaceProposal[];
  } | null>(null);
  const [analysisError, setAnalysisError] = useState<string | null>(null);

  useEffect(() => {
    if (dbState.status !== 'ready') return;
    let cancelled = false;
    void Promise.all([listFoodItems(dbState.db), getOrCreateProfile(dbState.db)]).then(
      ([items, p]) => {
        if (cancelled) return;
        setFoodItems(items);
        setProfile(p);
      },
    );
    return () => {
      cancelled = true;
    };
  }, [dbState]);

  useEffect(() => {
    if (dbState.status !== 'ready' || !raceId) return;
    let cancelled = false;
    void (async () => {
      const rows = await listFeedbackByRace(dbState.db, raceId);
      // Auto-promote skip_reason into tags on first load of an untouched feedback row.
      // Heuristic : updated_at === created_at means the user hasn't touched it post-creation,
      // so we safely promote without overriding an explicit user choice.
      const now = Date.now();
      const promoted = await Promise.all(
        rows.map(async (fb) => {
          if (!fb.skip_reason) return fb;
          if (fb.updated_at !== fb.created_at) return fb;
          const mapped = skipReasonToTag(fb.skip_reason);
          if (fb.tags?.includes(mapped)) return fb;
          const nextTags: FeedbackTag[] = [...(fb.tags ?? []), mapped];
          return upsertFeedback(
            dbState.db,
            raceId,
            fb.planned_event_id,
            { tags: nextTags },
            now,
          );
        }),
      );
      if (cancelled) return;
      setFeedbacks(new Map(promoted.map((fb) => [fb.planned_event_id, fb])));
    })();
    return () => {
      cancelled = true;
    };
  }, [dbState, raceId]);

  const toggleExpand = useCallback((plannedEventId: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(plannedEventId)) next.delete(plannedEventId);
      else next.add(plannedEventId);
      return next;
    });
  }, []);

  const persistFeedback = useCallback(
    async (
      plannedEventId: string,
      patch: { tags?: FeedbackTag[]; actual_quantity?: QuantityActual | null },
    ) => {
      if (dbState.status !== 'ready' || !raceId) return;
      try {
        const next = await upsertFeedback(
          dbState.db,
          raceId,
          plannedEventId,
          patch,
          Date.now(),
        );
        setFeedbacks((prev) => {
          const map = new Map(prev);
          map.set(plannedEventId, next);
          return map;
        });
      } catch (err) {
        console.error('[summary] upsertFeedback failed', err);
      }
    },
    [dbState, raceId],
  );

  const handleChangeTags = useCallback(
    (plannedEventId: string, tags: FeedbackTag[]) => {
      void persistFeedback(plannedEventId, { tags });
    },
    [persistFeedback],
  );

  const handleChangeQuantity = useCallback(
    (plannedEventId: string, quantity: QuantityActual | null) => {
      void persistFeedback(plannedEventId, { actual_quantity: quantity });
    },
    [persistFeedback],
  );

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

  const canAnalyze =
    (race.status === 'completed' || race.status === 'abandoned') &&
    !!profile &&
    !!foodItems;

  const handleAnalyze = async () => {
    if (!profile || !foodItems) return;
    setAnalyzing(true);
    setAnalysisError(null);
    try {
      const payload = buildAnalyzePayload({
        race,
        profile,
        plannedEvents,
        logs,
        foodItems,
      });
      const result = await analyzeRace(payload);
      if (!result.ok) {
        setAnalysisError(describeAnalyzeFailure(result));
        return;
      }
      setAnalysis({
        summary_fr: result.response.summary_fr,
        proposals: result.response.proposals,
      });
    } catch (err) {
      setAnalysisError(err instanceof Error ? err.message : String(err));
    } finally {
      setAnalyzing(false);
    }
  };

  const handleAcceptProposal = async (idx: number) => {
    if (dbState.status !== 'ready' || !profile || !analysis) return;
    const proposal = analysis.proposals[idx];
    if (proposal.kind !== 'profile_adjustment') {
      setAnalysis((cur) => (cur ? removeAt(cur, idx) : null));
      return;
    }
    try {
      const updated = await applyProposalToProfile(dbState.db, profile, proposal);
      if (updated) {
        setProfile(updated);
        Alert.alert(
          'Profil mis à jour',
          `${labelForField(proposal.field)} : ${proposal.current_value} → ${proposal.suggested_value}`,
        );
      }
      setAnalysis((cur) => (cur ? removeAt(cur, idx) : null));
    } catch (err) {
      Alert.alert('Erreur', `Impossible d'appliquer : ${String(err)}`);
    }
  };

  const handleDismissProposal = (idx: number) => {
    setAnalysis((cur) => (cur ? removeAt(cur, idx) : null));
  };

  return (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
      <Header
        title={race.name ?? 'Course'}
        status={race.status}
        durationMs={stats.durationMs}
      />

      {/* Post-race recalibration (A.4) */}
      {canAnalyze && (
        <View style={styles.analysisSection}>
          {!analysis && !analysisError && (
            <Pressable
              onPress={handleAnalyze}
              disabled={analyzing}
              style={({ pressed }) => [
                styles.analyzeBtn,
                pressed && styles.analyzeBtnPressed,
                analyzing && styles.analyzeBtnDisabled,
              ]}
            >
              {analyzing ? (
                <ActivityIndicator color="#0a7ea4" size="small" />
              ) : (
                <Text style={styles.analyzeBtnText}>🧪 Analyser cette course avec Claude</Text>
              )}
            </Pressable>
          )}

          {analysisError && (
            <View style={styles.analysisErrorBox}>
              <Text style={styles.analysisErrorText}>{analysisError}</Text>
              <Pressable onPress={() => setAnalysisError(null)}>
                <Text style={styles.analysisErrorDismiss}>OK</Text>
              </Pressable>
            </View>
          )}

          {analysis && (
            <View style={styles.analysisBox}>
              <Text style={styles.analysisSummary}>{analysis.summary_fr}</Text>
              {analysis.proposals.length === 0 ? (
                <Text style={styles.analysisEmpty}>Aucune proposition particulière sur cette course.</Text>
              ) : (
                analysis.proposals.map((p, i) => (
                  <ProposalCard
                    key={i}
                    proposal={p}
                    onAccept={() => handleAcceptProposal(i)}
                    onDismiss={() => handleDismissProposal(i)}
                  />
                ))
              )}
            </View>
          )}
        </View>
      )}

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
            feedback={feedbacks.get(event.id)}
            expanded={expanded.has(event.id)}
            onToggleExpand={() => toggleExpand(event.id)}
            onChangeTags={(tags) => handleChangeTags(event.id, tags)}
            onChangeQuantity={(q) => handleChangeQuantity(event.id, q)}
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

function ProposalCard({
  proposal,
  onAccept,
  onDismiss,
}: {
  proposal: PostRaceProposal;
  onAccept: () => void;
  onDismiss: () => void;
}) {
  const confidencePct = Math.round(proposal.confidence * 100);
  if (proposal.kind === 'profile_adjustment') {
    const delta = proposal.suggested_value - proposal.current_value;
    const arrow = delta > 0 ? '↑' : '↓';
    return (
      <View style={styles.proposalCard}>
        <View style={styles.proposalHeaderRow}>
          <Text style={styles.proposalBadge}>Profil</Text>
          <Text style={styles.proposalConfidence}>{confidencePct}%</Text>
        </View>
        <Text style={styles.proposalTitle}>
          {labelForField(proposal.field)} : {proposal.current_value} → {proposal.suggested_value}{' '}
          <Text style={{ color: delta > 0 ? '#1f7a32' : '#cc5200' }}>{arrow}</Text>
        </Text>
        <Text style={styles.proposalWhy}>{proposal.why}</Text>
        <View style={styles.proposalActions}>
          <Pressable onPress={onDismiss} style={({ pressed }) => [styles.proposalSecondaryBtn, pressed && { opacity: 0.6 }]}>
            <Text style={styles.proposalSecondaryText}>Refuser</Text>
          </Pressable>
          <Pressable onPress={onAccept} style={({ pressed }) => [styles.proposalPrimaryBtn, pressed && { opacity: 0.8 }]}>
            <Text style={styles.proposalPrimaryText}>Appliquer</Text>
          </Pressable>
        </View>
      </View>
    );
  }
  if (proposal.kind === 'race_note') {
    return (
      <View style={[styles.proposalCard, proposal.severity === 'warning' && styles.proposalWarn]}>
        <View style={styles.proposalHeaderRow}>
          <Text style={styles.proposalBadge}>
            {proposal.severity === 'warning' ? 'Attention' : 'Note'}
          </Text>
          <Text style={styles.proposalConfidence}>{confidencePct}%</Text>
        </View>
        <Text style={styles.proposalTitle}>{proposal.observation}</Text>
        <Text style={styles.proposalWhy}>{proposal.why}</Text>
        <View style={styles.proposalActions}>
          <Pressable onPress={onDismiss} style={({ pressed }) => [styles.proposalPrimaryBtn, pressed && { opacity: 0.8 }]}>
            <Text style={styles.proposalPrimaryText}>Compris</Text>
          </Pressable>
        </View>
      </View>
    );
  }
  // kb_suggestion
  return (
    <View style={styles.proposalCard}>
      <View style={styles.proposalHeaderRow}>
        <Text style={styles.proposalBadge}>Idée KB</Text>
        <Text style={styles.proposalConfidence}>{confidencePct}%</Text>
      </View>
      <Text style={styles.proposalTitle}>{proposal.article_idea}</Text>
      <Text style={styles.proposalWhy}>{proposal.why}</Text>
      <View style={styles.proposalActions}>
        <Pressable onPress={onDismiss} style={({ pressed }) => [styles.proposalPrimaryBtn, pressed && { opacity: 0.8 }]}>
          <Text style={styles.proposalPrimaryText}>Noté</Text>
        </Pressable>
      </View>
    </View>
  );
}

function removeAt(cur: { summary_fr: string; proposals: PostRaceProposal[] }, idx: number) {
  return { ...cur, proposals: cur.proposals.filter((_, i) => i !== idx) };
}

function labelForField(field: 'carbs_per_hour_g' | 'fluid_per_hour_ml' | 'sodium_per_hour_mg'): string {
  switch (field) {
    case 'carbs_per_hour_g':   return 'Carbs/h';
    case 'fluid_per_hour_ml':  return 'Fluide/h';
    case 'sodium_per_hour_mg': return 'Sodium/h';
  }
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
  feedback,
  expanded,
  onToggleExpand,
  onChangeTags,
  onChangeQuantity,
}: {
  event: PersistedPlannedEvent;
  log?: EventLog;
  foodItemsById: Map<string, FoodItem>;
  aidStationsById: Map<string, AidStation>;
  feedback?: EventFeedback;
  expanded: boolean;
  onToggleExpand: () => void;
  onChangeTags: (tags: FeedbackTag[]) => void;
  onChangeQuantity: (quantity: QuantityActual | null) => void;
}) {
  const description = describeEvent(event, foodItemsById, aidStationsById);
  const supportsFeedback = event.type !== 'aid_station';
  const tagCount = feedback?.tags?.length ?? 0;
  const hasQuantity = feedback?.actual_quantity !== undefined;
  const annotationCount = tagCount + (hasQuantity ? 1 : 0);
  const showQuantity = event.type === 'intake' || event.type === 'fluid_reminder';
  const isDone = log?.status === 'done';

  const row = (
    <View style={styles.detailRow}>
      <View style={[styles.detailDot, { backgroundColor: EVENT_TYPE_COLOR[event.type] }]} />
      <Text style={styles.detailTime}>
        {formatRelativeMinute(event.scheduled_at_minute)}
      </Text>
      <Text style={styles.detailIcon}>{EVENT_TYPE_ICON[event.type]}</Text>
      <Text style={styles.detailDesc} numberOfLines={2}>
        {description}
      </Text>
      {supportsFeedback && annotationCount > 0 ? (
        <Text style={styles.feedbackBadge}>· {annotationCount}</Text>
      ) : null}
      <DetailBadge event={event} log={log} />
      {supportsFeedback ? (
        <Text style={styles.expandCaret}>{expanded ? '▾' : '▸'}</Text>
      ) : null}
    </View>
  );

  if (!supportsFeedback) return row;

  return (
    <View>
      <Pressable
        onPress={onToggleExpand}
        style={({ pressed }) => [pressed && styles.detailRowPressed]}
      >
        {row}
      </Pressable>
      {expanded ? (
        <EventFeedbackBlock
          feedback={feedback}
          isDone={isDone}
          showQuantity={showQuantity}
          onChangeTags={onChangeTags}
          onChangeQuantity={onChangeQuantity}
        />
      ) : null}
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
  detailRowPressed: {
    backgroundColor: '#f0f0f0',
  },
  feedbackBadge: {
    fontSize: 12,
    color: '#0a7ea4',
    fontWeight: '700',
  },
  expandCaret: {
    fontSize: 12,
    color: '#999',
    width: 14,
    textAlign: 'right',
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
  analysisSection: {
    marginHorizontal: 16,
    marginTop: 12,
    gap: 8,
  },
  analyzeBtn: {
    borderWidth: 1.5,
    borderColor: '#0a7ea4',
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
  },
  analyzeBtnPressed: {
    backgroundColor: '#e6f4f8',
  },
  analyzeBtnDisabled: {
    opacity: 0.5,
  },
  analyzeBtnText: {
    color: '#0a7ea4',
    fontSize: 14,
    fontWeight: '600',
  },
  analysisErrorBox: {
    borderWidth: 1,
    borderColor: '#EF9A9A',
    backgroundColor: '#FFEBEE',
    borderRadius: 8,
    padding: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  analysisErrorText: {
    flex: 1,
    color: '#c62828',
    fontSize: 13,
    marginRight: 8,
  },
  analysisErrorDismiss: {
    color: '#0a7ea4',
    fontWeight: '600',
  },
  analysisBox: {
    gap: 8,
  },
  analysisSummary: {
    fontSize: 13,
    fontStyle: 'italic',
    color: '#444',
    backgroundColor: '#f4f8fb',
    padding: 10,
    borderRadius: 6,
  },
  analysisEmpty: {
    fontSize: 13,
    color: '#888',
    fontStyle: 'italic',
    textAlign: 'center',
    paddingVertical: 8,
  },
  proposalCard: {
    borderWidth: 1,
    borderColor: '#d8e6ed',
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 12,
    gap: 6,
  },
  proposalWarn: {
    borderColor: '#FFD180',
    backgroundColor: '#FFF8E1',
  },
  proposalHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  proposalBadge: {
    fontSize: 11,
    fontWeight: '700',
    color: '#0a7ea4',
    backgroundColor: '#e6f4f8',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
    overflow: 'hidden',
  },
  proposalConfidence: {
    fontSize: 11,
    color: '#888',
  },
  proposalTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111',
  },
  proposalWhy: {
    fontSize: 12,
    color: '#555',
    lineHeight: 17,
  },
  proposalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 8,
    marginTop: 4,
  },
  proposalSecondaryBtn: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#bbb',
  },
  proposalSecondaryText: {
    color: '#666',
    fontSize: 13,
    fontWeight: '500',
  },
  proposalPrimaryBtn: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 6,
    backgroundColor: '#0a7ea4',
  },
  proposalPrimaryText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '600',
  },
});
