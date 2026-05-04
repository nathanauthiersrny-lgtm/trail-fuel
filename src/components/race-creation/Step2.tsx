import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';
import React, { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

import { ElevationChart } from '../ElevationChart';
import { buildGpxTrack } from '../../engine/gpx/track';
import type { Profile } from '../../models/profile';
import type { TerrainType } from '../../models/race';
import type { RaceCreationDraft } from '../../services/race-creation-store';

type Props = {
  draft: RaceCreationDraft;
  updateDraft: (patch: Partial<RaceCreationDraft>) => void;
  profile: Profile | null;
  chartWidth: number;
};

const TERRAIN_OPTIONS: { value: TerrainType; label: string }[] = [
  { value: 'road', label: 'Route' },
  { value: 'rolling', label: 'Roulant' },
  { value: 'mixed_trail', label: 'Trail mixte' },
  { value: 'technical', label: 'Technique' },
  { value: 'alpine', label: 'Haute montagne' },
];

function autoEstimateDuration(
  distanceKm: number,
  elevationGainM: number,
  profile: Profile | null,
): number {
  const pace = profile?.flat_pace_min_per_km ?? 6;
  const factor = profile?.pace_calibration_factor ?? 1;
  const flatMin = distanceKm * pace;
  // Naismith: +1 min per 10 m D+
  const gainMin = (elevationGainM ?? 0) / 10;
  return Math.round(((flatMin + gainMin) * factor) / 5) * 5; // round to nearest 5 min
}

export function Step2({ draft, updateDraft, profile, chartWidth }: Props) {
  const [isProcessing, setIsProcessing] = useState(false);
  const hasGpx = draft.gpx_track !== null;

  async function handlePickGpx() {
    let result: DocumentPicker.DocumentPickerResult;
    try {
      result = await DocumentPicker.getDocumentAsync({
        type: ['*/*'],
        copyToCacheDirectory: true,
      });
    } catch {
      Alert.alert('Erreur', 'Impossible d\'ouvrir le sélecteur de fichier.');
      return;
    }

    if (result.canceled) return;
    const file = result.assets[0];

    setIsProcessing(true);
    const t0 = Date.now();
    try {
      const content = await FileSystem.readAsStringAsync(file.uri);
      const track = buildGpxTrack({
        gpxString: content,
        flatPaceMinPerKm: profile?.flat_pace_min_per_km ?? 6,
        calibrationFactor: profile?.pace_calibration_factor ?? 1,
      });
      const elapsed = Date.now() - t0;
      console.log(
        `[GPX] buildGpxTrack: ${elapsed}ms — ${track.segments.length} segments, ${track.total_distance_km.toFixed(1)} km, D+${Math.round(track.total_elevation_gain_m)} m`,
      );
      updateDraft({
        gpx_track: track,
        estimated_duration_min: track.segments.at(-1)?.estimated_time_min ?? null,
        distance_km: track.total_distance_km,
        elevation_gain_m: track.total_elevation_gain_m,
        elevation_loss_m: track.total_elevation_loss_m,
        terrain_type: draft.terrain_type ?? 'mixed_trail',
      });
    } catch (err) {
      Alert.alert('Erreur GPX', `Impossible de lire ce fichier.\n${String(err)}`);
    } finally {
      setIsProcessing(false);
    }
  }

  function clearGpx() {
    updateDraft({
      gpx_track: null,
      estimated_duration_min: null,
      distance_km: null,
      elevation_gain_m: null,
      elevation_loss_m: null,
    });
  }

  // ── GPX path ────────────────────────────────────────────────────────────────
  if (isProcessing) {
    return (
      <View style={styles.loadingBox}>
        <ActivityIndicator size="large" color="#FF6B35" />
        <Text style={styles.loadingTxt}>Traitement du GPX…</Text>
      </View>
    );
  }

  return (
    <View>
      <Text style={styles.heading}>Parcours</Text>

      {/* Mode toggle */}
      <View style={styles.modeRow}>
        <TouchableOpacity
          style={[styles.modeBtn, hasGpx && styles.modeBtnActive]}
          onPress={hasGpx ? undefined : handlePickGpx}
        >
          <Text style={[styles.modeBtnTxt, hasGpx && styles.modeBtnTxtActive]}>
            📂 Tracé GPX
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.modeBtn, !hasGpx && styles.modeBtnActive]}
          onPress={hasGpx ? clearGpx : undefined}
        >
          <Text style={[styles.modeBtnTxt, !hasGpx && styles.modeBtnTxtActive]}>
            ✏️ Manuel
          </Text>
        </TouchableOpacity>
      </View>

      {hasGpx ? (
        <GpxSummary draft={draft} chartWidth={chartWidth} onClear={clearGpx} />
      ) : (
        <ManualForm
          draft={draft}
          updateDraft={updateDraft}
          profile={profile}
          onPickGpx={handlePickGpx}
        />
      )}
    </View>
  );
}

// ─── GPX summary ─────────────────────────────────────────────────────────────

function GpxSummary({
  draft,
  chartWidth,
  onClear,
}: {
  draft: RaceCreationDraft;
  chartWidth: number;
  onClear: () => void;
}) {
  const track = draft.gpx_track!;
  const durationH = Math.floor((draft.estimated_duration_min ?? 0) / 60);
  const durationM = Math.round((draft.estimated_duration_min ?? 0) % 60);

  return (
    <View>
      <View style={styles.statRow}>
        <Stat label="Distance" value={`${track.total_distance_km.toFixed(1)} km`} />
        <Stat label="D+" value={`${Math.round(track.total_elevation_gain_m)} m`} />
        <Stat label="D-" value={`${Math.round(track.total_elevation_loss_m)} m`} />
        <Stat label="Durée estimée" value={`${durationH}h${String(durationM).padStart(2, '0')}`} />
      </View>

      <View style={styles.chartBox}>
        <ElevationChart track={track} width={chartWidth} height={120} />
      </View>

      <TouchableOpacity style={styles.clearBtn} onPress={onClear}>
        <Text style={styles.clearTxt}>Changer de tracé</Text>
      </TouchableOpacity>
    </View>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.stat}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

// ─── Manual form ─────────────────────────────────────────────────────────────

function ManualForm({
  draft,
  updateDraft,
  profile,
  onPickGpx,
}: {
  draft: RaceCreationDraft;
  updateDraft: (patch: Partial<RaceCreationDraft>) => void;
  profile: Profile | null;
  onPickGpx: () => void;
}) {
  function handleDistanceBlur() {
    if (!draft.distance_km) return;
    const suggested = autoEstimateDuration(
      draft.distance_km,
      draft.elevation_gain_m ?? 0,
      profile,
    );
    if (!draft.estimated_duration_min) {
      updateDraft({ estimated_duration_min: suggested });
    }
  }

  return (
    <View>
      <TouchableOpacity style={styles.gpxHintBtn} onPress={onPickGpx}>
        <Text style={styles.gpxHintTxt}>
          📂 Importer un tracé GPX pour un profil automatique
        </Text>
      </TouchableOpacity>

      <NumericField
        label="Distance (km)"
        required
        value={draft.distance_km}
        onChangeNumber={(v) => updateDraft({ distance_km: v })}
        onBlur={handleDistanceBlur}
        placeholder="ex. 42"
      />

      <NumericField
        label="Dénivelé positif (m)"
        value={draft.elevation_gain_m}
        onChangeNumber={(v) => {
          updateDraft({ elevation_gain_m: v });
        }}
        placeholder="ex. 2000"
      />

      <NumericField
        label="Durée estimée (min)"
        required
        value={draft.estimated_duration_min}
        onChangeNumber={(v) => updateDraft({ estimated_duration_min: v })}
        placeholder="auto-calculée d'après le pace"
      />

      <Text style={styles.label}>Type de terrain</Text>
      <View style={styles.terrainRow}>
        {TERRAIN_OPTIONS.map(({ value, label }) => (
          <TouchableOpacity
            key={value}
            style={[styles.terrainPill, draft.terrain_type === value && styles.terrainPillActive]}
            onPress={() => updateDraft({ terrain_type: value })}
          >
            <Text
              style={[
                styles.terrainPillTxt,
                draft.terrain_type === value && styles.terrainPillTxtActive,
              ]}
            >
              {label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function NumericField({
  label,
  required,
  value,
  onChangeNumber,
  onBlur,
  placeholder,
}: {
  label: string;
  required?: boolean;
  value: number | null;
  onChangeNumber: (v: number | null) => void;
  onBlur?: () => void;
  placeholder?: string;
}) {
  return (
    <View style={styles.fieldGroup}>
      <Text style={styles.label}>
        {label}
        {required ? <Text style={{ color: '#e53e3e' }}> *</Text> : null}
      </Text>
      <TextInput
        style={styles.input}
        value={value !== null ? String(value) : ''}
        onChangeText={(t) => {
          const n = parseFloat(t);
          onChangeNumber(isNaN(n) ? null : n);
        }}
        onBlur={onBlur}
        keyboardType="decimal-pad"
        placeholder={placeholder}
        placeholderTextColor="#aaa"
      />
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  heading: { fontSize: 20, fontWeight: '700', marginBottom: 20, color: '#111' },
  loadingBox: { alignItems: 'center', justifyContent: 'center', paddingVertical: 80, gap: 12 },
  loadingTxt: { fontSize: 14, color: '#888' },

  modeRow: { flexDirection: 'row', gap: 10, marginBottom: 20 },
  modeBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#ddd',
    alignItems: 'center',
    backgroundColor: '#fafafa',
  },
  modeBtnActive: { borderColor: '#FF6B35', backgroundColor: '#FFF4F0' },
  modeBtnTxt: { fontSize: 13, color: '#555' },
  modeBtnTxtActive: { color: '#FF6B35', fontWeight: '600' },

  statRow: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  stat: { flex: 1, backgroundColor: '#f5f5f5', borderRadius: 8, padding: 10, alignItems: 'center' },
  statValue: { fontSize: 14, fontWeight: '700', color: '#111' },
  statLabel: { fontSize: 10, color: '#666', marginTop: 2 },

  chartBox: { borderRadius: 8, overflow: 'hidden', backgroundColor: '#f5f5f5', marginBottom: 12 },
  clearBtn: { alignItems: 'center', paddingVertical: 8 },
  clearTxt: { fontSize: 13, color: '#888', textDecorationLine: 'underline' },

  gpxHintBtn: {
    backgroundColor: '#f0f9ff',
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#bae6fd',
    borderStyle: 'dashed',
  },
  gpxHintTxt: { fontSize: 13, color: '#0284c7', textAlign: 'center' },

  fieldGroup: { marginBottom: 14 },
  label: { fontSize: 13, fontWeight: '500', color: '#444', marginBottom: 6 },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
    backgroundColor: '#fafafa',
    color: '#111',
  },

  terrainRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  terrainPill: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#ddd',
    backgroundColor: '#fafafa',
  },
  terrainPillActive: { borderColor: '#FF6B35', backgroundColor: '#FFF4F0' },
  terrainPillTxt: { fontSize: 13, color: '#555' },
  terrainPillTxtActive: { color: '#FF6B35', fontWeight: '600' },
});
