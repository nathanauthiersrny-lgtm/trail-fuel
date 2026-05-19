import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  ToastAndroid,
  TouchableOpacity,
  View,
  useWindowDimensions,
} from 'react-native';
import { router } from 'expo-router';

import { ElevationChart } from '../components/ElevationChart';
import { TimelinePreview } from '../components/TimelinePreview';
import { createRace } from '../db/repos/race-repo';
import { listFoodItems } from '../db/repos/food-item-repo';
import { getOrCreateProfile } from '../db/repos/profile-repo';
import { generatePlan } from '../engine/planning/generate';
import type { GeneratePlanResult } from '../engine/planning/generate';
import { useDatabase } from '../hooks/use-database';
import { useKnowledgePack } from '../hooks/use-knowledge-pack';
import type { FoodItem } from '../models/food-item';
import type { Profile } from '../models/profile';
import type { Race } from '../models/race';
import { draftToRace } from '../services/draft-to-race';
import { generateEnrichedPlan } from '../services/plan-enrichment/orchestrator';
import type { OrchestratorResult } from '../services/plan-enrichment/orchestrator';
import { useRaceCreationStore } from '../services/race-creation-store';

// ─── Severity colors ──────────────────────────────────────────────────────────

const SEVERITY_BG: Record<string, string> = {
  high: '#FFEBEE',
  medium: '#FFF8E1',
  low: '#E8F5E9',
};
const SEVERITY_BORDER: Record<string, string> = {
  high: '#EF9A9A',
  medium: '#FFE082',
  low: '#A5D6A7',
};

// ─── Screen ──────────────────────────────────────────────────────────────────

export default function PreviewScreen() {
  const dbState = useDatabase();
  const packState = useKnowledgePack();
  const draft = useRaceCreationStore((s) => s.draft);
  const reset = useRaceCreationStore((s) => s.reset);

  const [race, setRace] = useState<Race | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [foodItems, setFoodItems] = useState<FoodItem[]>([]);
  const [plan, setPlan] = useState<GeneratePlanResult | null>(null);
  const [saving, setSaving] = useState(false);
  const [enriching, setEnriching] = useState(false);
  const [enrichMeta, setEnrichMeta] = useState<OrchestratorResult['enrichmentMeta'] | null>(null);
  const [enrichError, setEnrichError] = useState<string | null>(null);
  const loadedRef = useRef(false);

  const { width } = useWindowDimensions();
  const chartWidth = width - 40;

  useEffect(() => {
    if (dbState.status !== 'ready' || packState.status !== 'ready' || loadedRef.current) {
      return;
    }
    loadedRef.current = true;
    const pack = packState.pack;

    Promise.all([
      getOrCreateProfile(dbState.db),
      listFoodItems(dbState.db),
    ]).then(([loadedProfile, fi]) => {
      setProfile(loadedProfile);
      setFoodItems(fi);
      let r: Race;
      try {
        r = draftToRace(draft);
      } catch (err) {
        console.error('[PreviewScreen] draftToRace failed:', err);
        Alert.alert('Erreur', 'Le brouillon est incomplet. Reviens en arrière et complète tous les champs.');
        return;
      }
      setRace(r);
      const result = generatePlan({ profile: loadedProfile, race: r, foodItems: fi, now: Date.now(), pack });
      setPlan(result);
    });
  }, [dbState, packState, draft]);

  async function handleEnrich() {
    if (!race || !profile) return;
    setEnriching(true);
    setEnrichError(null);
    try {
      const result = await generateEnrichedPlan({
        profile,
        race,
        foodItems,
        mode: 'try_enrich',
      });
      if (result.wasEnriched && result.enrichmentMeta) {
        setPlan({ events: result.events, warnings: result.warnings });
        setEnrichMeta(result.enrichmentMeta);
      } else {
        const failure = result.warnings.find((w) => w.code === 'enrichment_unavailable');
        setEnrichError(failure?.message ?? 'Enrichment indisponible — plan brut conservé.');
      }
    } catch (err) {
      setEnrichError(err instanceof Error ? err.message : String(err));
    } finally {
      setEnriching(false);
    }
  }

  async function doCreate() {
    if (!race || dbState.status !== 'ready') return;
    setSaving(true);
    try {
      await createRace(dbState.db, race);
      reset();
      ToastAndroid.show('Sortie créée !', ToastAndroid.SHORT);
      router.replace({ pathname: '/race/[id]', params: { id: race.id } });
    } catch (err) {
      setSaving(false);
      Alert.alert('Erreur', `Impossible de créer la course : ${String(err)}`);
    }
  }

  function handleCreate() {
    if (!race || !plan || dbState.status !== 'ready' || saving) return;

    const rationingWarnings = plan.warnings.filter(
      (w) => w.code === 'carbs_rationing' || w.code === 'fluid_rationing',
    );

    if (rationingWarnings.length > 0) {
      const lines = rationingWarnings.map((w) => w.message);
      Alert.alert(
        'Inventaire insuffisant',
        lines.join('\n') +
          "\n\nL'app va ajuster les rappels à ce que tu emportes réellement. Tu confirmes ?",
        [
          { text: 'Annuler', style: 'cancel' },
          { text: 'Continuer', onPress: () => doCreate() },
        ],
      );
      return;
    }

    doCreate();
  }

  function handleModify() {
    router.back();
  }

  if (dbState.status === 'loading' || (dbState.status === 'ready' && !plan)) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#FF6B35" />
      </View>
    );
  }

  if (dbState.status === 'error') {
    return (
      <View style={styles.center}>
        <Text style={styles.errorText}>Erreur DB : {dbState.error.message}</Text>
      </View>
    );
  }

  if (!race || !plan) return null;

  const hasGpx = !!race.gpx_track;

  return (
    <View style={styles.root}>
      {/* Warnings */}
      {plan.warnings.length > 0 && (
        <View style={styles.warningsBanner}>
          {plan.warnings.map((w, i) => (
            <View
              key={i}
              style={[
                styles.warningItem,
                {
                  backgroundColor: SEVERITY_BG[w.severity] ?? '#FFF',
                  borderColor: SEVERITY_BORDER[w.severity] ?? '#DDD',
                },
              ]}
            >
              <Text style={styles.warningText}>{w.message}</Text>
            </View>
          ))}
        </View>
      )}

      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
        {/* Elevation chart or placeholder */}
        {hasGpx ? (
          <View style={styles.chartWrapper}>
            <ElevationChart
              track={race.gpx_track!}
              width={chartWidth}
              height={140}
              events={plan.events}
            />
          </View>
        ) : (
          <View style={[styles.chartPlaceholder, { width: chartWidth }]}>
            <Text style={styles.chartPlaceholderText}>Mode sans GPX — profil non disponible</Text>
          </View>
        )}

        {/* Summary strip */}
        <View style={styles.summary}>
          <SummaryChip
            label={`${Math.round(race.estimated_duration_min / 60 * 10) / 10}h`}
            sublabel="durée"
          />
          <SummaryChip label={`${plan.events.length}`} sublabel="événements" />
          {plan.warnings.length > 0 && (
            <SummaryChip
              label={`${plan.warnings.length}`}
              sublabel="alertes"
              accent="#FF5252"
            />
          )}
        </View>

        <Text style={styles.sectionTitle}>Planning</Text>
        <TimelinePreview
          events={plan.events}
          foodItems={foodItems}
          aidStations={race.aid_stations}
        />
      </ScrollView>

      {/* Enrichment section (A.4 — preview-only, ne persiste pas dans la race) */}
      <View style={styles.enrichSection}>
        {enrichMeta && (
          <View style={styles.enrichBanner}>
            <Text style={styles.enrichBannerTitle}>✨ Plan enrichi par Claude</Text>
            <Text style={styles.enrichBannerText}>
              {enrichMeta.appliedOps} modif{enrichMeta.appliedOps > 1 ? 's' : ''} appliquée{enrichMeta.appliedOps > 1 ? 's' : ''}
              {enrichMeta.rejectedOps > 0 ? ` · ${enrichMeta.rejectedOps} rejetée${enrichMeta.rejectedOps > 1 ? 's' : ''}` : ''}
              {enrichMeta.articlesUsed.length > 0 ? ` · ${enrichMeta.articlesUsed.length} article${enrichMeta.articlesUsed.length > 1 ? 's' : ''} KB` : ''}
            </Text>
          </View>
        )}
        {enrichError && <Text style={styles.enrichError}>{enrichError}</Text>}
        <TouchableOpacity
          style={[styles.enrichBtn, (enriching || !profile) && styles.enrichBtnDisabled]}
          onPress={handleEnrich}
          disabled={enriching || !profile}
          activeOpacity={0.75}
        >
          {enriching ? (
            <ActivityIndicator size="small" color="#FF6B35" />
          ) : (
            <Text style={styles.enrichBtnText}>
              {enrichMeta ? 'Réenrichir avec Claude' : 'Enrichir avec Claude (test)'}
            </Text>
          )}
        </TouchableOpacity>
      </View>

      {/* Buttons */}
      <View style={styles.actions}>
        <TouchableOpacity style={styles.secondaryBtn} onPress={handleModify} activeOpacity={0.75}>
          <Text style={styles.secondaryBtnText}>Modifier</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.primaryBtn, saving && styles.primaryBtnDisabled]}
          onPress={handleCreate}
          disabled={saving}
          activeOpacity={0.8}
        >
          {saving ? (
            <ActivityIndicator color="#fff" size="small" />
          ) : (
            <Text style={styles.primaryBtnText}>Créer la course</Text>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
}

function SummaryChip({
  label,
  sublabel,
  accent = '#FF6B35',
}: {
  label: string;
  sublabel: string;
  accent?: string;
}) {
  return (
    <View style={styles.chip}>
      <Text style={[styles.chipLabel, { color: accent }]}>{label}</Text>
      <Text style={styles.chipSublabel}>{sublabel}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#fff',
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
  },
  errorText: {
    color: '#c00',
    textAlign: 'center',
    paddingHorizontal: 24,
  },
  warningsBanner: {
    paddingHorizontal: 16,
    paddingTop: 12,
    gap: 6,
  },
  warningItem: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  warningText: {
    fontSize: 13,
    color: '#333',
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingTop: 16,
    paddingBottom: 8,
  },
  chartWrapper: {
    paddingHorizontal: 20,
    marginBottom: 12,
  },
  chartPlaceholder: {
    height: 80,
    marginHorizontal: 20,
    marginBottom: 12,
    borderRadius: 8,
    backgroundColor: '#f5f5f5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  chartPlaceholderText: {
    fontSize: 13,
    color: '#999',
  },
  summary: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    marginBottom: 16,
    gap: 12,
  },
  chip: {
    alignItems: 'center',
    backgroundColor: '#f9f9f9',
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  chipLabel: {
    fontSize: 18,
    fontWeight: '700',
  },
  chipSublabel: {
    fontSize: 11,
    color: '#888',
    marginTop: 1,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111',
    paddingHorizontal: 20,
    marginBottom: 8,
  },
  enrichSection: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 4,
    gap: 8,
  },
  enrichBanner: {
    borderWidth: 1,
    borderColor: '#FFD180',
    backgroundColor: '#FFF8E1',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  enrichBannerTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#E65100',
    marginBottom: 2,
  },
  enrichBannerText: {
    fontSize: 12,
    color: '#5D4037',
  },
  enrichError: {
    fontSize: 12,
    color: '#C62828',
    paddingHorizontal: 4,
  },
  enrichBtn: {
    height: 40,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: '#FF6B35',
    alignItems: 'center',
    justifyContent: 'center',
  },
  enrichBtnDisabled: {
    opacity: 0.5,
  },
  enrichBtnText: {
    color: '#FF6B35',
    fontSize: 13,
    fontWeight: '600',
  },
  actions: {
    flexDirection: 'row',
    padding: 16,
    gap: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#e0e0e0',
    backgroundColor: '#fff',
  },
  secondaryBtn: {
    flex: 1,
    height: 48,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: '#ccc',
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryBtnText: {
    fontSize: 16,
    color: '#555',
    fontWeight: '600',
  },
  primaryBtn: {
    flex: 2,
    height: 48,
    borderRadius: 10,
    backgroundColor: '#FF6B35',
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryBtnDisabled: {
    opacity: 0.6,
  },
  primaryBtnText: {
    fontSize: 16,
    color: '#fff',
    fontWeight: '700',
  },
});
