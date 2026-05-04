import React from 'react';
import {
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

import type { AidStation, AidStationAvailability } from '../../models/aid-station';
import type { RaceCreationDraft } from '../../services/race-creation-store';

type Props = {
  draft: RaceCreationDraft;
  updateDraft: (patch: Partial<RaceCreationDraft>) => void;
};

function generateId(): string {
  return `as_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
}

function estimateMinuteAtKm(atKm: number, draft: RaceCreationDraft): number {
  if (draft.gpx_track) {
    const segs = draft.gpx_track.segments;
    const seg = segs.find((s) => s.km >= atKm) ?? segs[segs.length - 1];
    return Math.round(seg?.estimated_time_min ?? 0);
  }
  if (draft.estimated_duration_min && draft.distance_km && draft.distance_km > 0) {
    return Math.round((atKm / draft.distance_km) * draft.estimated_duration_min);
  }
  return Math.round(atKm * 8); // fallback 8 min/km
}

const AVAILABILITY_LABELS: { key: keyof AidStationAvailability; label: string }[] = [
  { key: 'water', label: 'Eau' },
  { key: 'isotonic', label: 'Iso' },
  { key: 'solid_food', label: 'Solide' },
  { key: 'refill_possible', label: 'Refill' },
];

export function Step5({ draft, updateDraft }: Props) {
  const hasAids = draft.aid_stations.length > 0;

  function addAidStation() {
    const newStation: AidStation = {
      id: generateId(),
      at_km: 0,
      estimated_at_minute: 0,
      available: { water: true, isotonic: false, solid_food: false, refill_possible: false },
    };
    updateDraft({ aid_stations: [...draft.aid_stations, newStation] });
  }

  function removeAidStation(id: string) {
    updateDraft({ aid_stations: draft.aid_stations.filter((s) => s.id !== id) });
  }

  function updateStation(id: string, patch: Partial<AidStation>) {
    updateDraft({
      aid_stations: draft.aid_stations.map((s) =>
        s.id === id ? { ...s, ...patch } : s,
      ),
    });
  }

  function handleKmChange(id: string, text: string) {
    const atKm = parseFloat(text);
    if (isNaN(atKm)) {
      updateStation(id, { at_km: 0 });
      return;
    }
    const estimated_at_minute = estimateMinuteAtKm(atKm, draft);
    updateStation(id, { at_km: atKm, estimated_at_minute });
  }

  function toggleAvailability(id: string, key: keyof AidStationAvailability) {
    const station = draft.aid_stations.find((s) => s.id === id);
    if (!station) return;
    updateStation(id, {
      available: { ...station.available, [key]: !station.available[key] },
    });
  }

  return (
    <View>
      <Text style={styles.heading}>Ravitaillements</Text>

      {/* Main toggle */}
      <View style={styles.toggleRow}>
        <TouchableOpacity
          style={[styles.toggleBtn, !hasAids && styles.toggleBtnActive]}
          onPress={() => updateDraft({ aid_stations: [] })}
        >
          <Text style={[styles.toggleTxt, !hasAids && styles.toggleTxtActive]}>
            Pas de ravitos
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.toggleBtn, hasAids && styles.toggleBtnActive]}
          onPress={() => { if (!hasAids) addAidStation(); }}
        >
          <Text style={[styles.toggleTxt, hasAids && styles.toggleTxtActive]}>
            Avec ravitos
          </Text>
        </TouchableOpacity>
      </View>

      {/* Aid station list */}
      {hasAids && (
        <View style={styles.stationList}>
          {draft.aid_stations.map((station, idx) => (
            <View key={station.id} style={styles.stationCard}>
              <View style={styles.stationHeader}>
                <Text style={styles.stationTitle}>Ravito {idx + 1}</Text>
                <TouchableOpacity onPress={() => removeAidStation(station.id)}>
                  <Text style={styles.removeBtn}>✕</Text>
                </TouchableOpacity>
              </View>

              {/* KM + name */}
              <View style={styles.stationRow}>
                <View style={styles.stationKm}>
                  <Text style={styles.fieldLabel}>Km</Text>
                  <TextInput
                    style={styles.input}
                    value={station.at_km > 0 ? String(station.at_km) : ''}
                    onChangeText={(t) => handleKmChange(station.id, t)}
                    keyboardType="decimal-pad"
                    placeholder="0"
                  />
                </View>
                <View style={styles.stationName}>
                  <Text style={styles.fieldLabel}>Nom (opt.)</Text>
                  <TextInput
                    style={styles.input}
                    value={station.name ?? ''}
                    onChangeText={(t) =>
                      updateStation(station.id, { name: t || undefined })
                    }
                    placeholder="ex. Col du Galibier"
                  />
                </View>
              </View>

              {/* Estimated time (read-only) */}
              {station.estimated_at_minute > 0 && (
                <Text style={styles.estTime}>
                  ≈ {Math.floor(station.estimated_at_minute / 60)}h
                  {String(station.estimated_at_minute % 60).padStart(2, '0')} depuis le départ
                </Text>
              )}

              {/* Availability */}
              <Text style={[styles.fieldLabel, { marginTop: 8 }]}>Disponible</Text>
              <View style={styles.availRow}>
                {AVAILABILITY_LABELS.map(({ key, label }) => {
                  const active = station.available[key];
                  return (
                    <TouchableOpacity
                      key={key}
                      style={[styles.availPill, active && styles.availPillActive]}
                      onPress={() => toggleAvailability(station.id, key)}
                    >
                      <Text style={[styles.availTxt, active && styles.availTxtActive]}>
                        {label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          ))}

          <TouchableOpacity style={styles.addBtn} onPress={addAidStation}>
            <Text style={styles.addBtnTxt}>＋ Ajouter un ravitaillement</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Refill in nature */}
      <View style={styles.refillSection}>
        <Text style={styles.refillLabel}>Remplissage possible en nature ?</Text>
        <Text style={styles.refillHint}>(fontaine, refuge, torrent…)</Text>
        <View style={styles.toggleRow}>
          <TouchableOpacity
            style={[styles.toggleBtn, !draft.refill_in_nature && styles.toggleBtnActive]}
            onPress={() => updateDraft({ refill_in_nature: false })}
          >
            <Text style={[styles.toggleTxt, !draft.refill_in_nature && styles.toggleTxtActive]}>
              Non
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.toggleBtn, draft.refill_in_nature && styles.toggleBtnActive]}
            onPress={() => updateDraft({ refill_in_nature: true })}
          >
            <Text style={[styles.toggleTxt, draft.refill_in_nature && styles.toggleTxtActive]}>
              Oui
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  heading: { fontSize: 20, fontWeight: '700', marginBottom: 20, color: '#111' },

  toggleRow: { flexDirection: 'row', gap: 10, marginBottom: 16 },
  toggleBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#ddd',
    alignItems: 'center',
    backgroundColor: '#fafafa',
  },
  toggleBtnActive: { borderColor: '#FF6B35', backgroundColor: '#FFF4F0' },
  toggleTxt: { fontSize: 14, color: '#555' },
  toggleTxtActive: { color: '#FF6B35', fontWeight: '600' },

  stationList: { gap: 12, marginBottom: 16 },
  stationCard: {
    backgroundColor: '#fafafa',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#eee',
    padding: 12,
  },
  stationHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  stationTitle: { fontSize: 14, fontWeight: '600', color: '#333' },
  removeBtn: { fontSize: 16, color: '#e53e3e', paddingHorizontal: 4 },

  stationRow: { flexDirection: 'row', gap: 10, marginBottom: 6 },
  stationKm: { width: 80 },
  stationName: { flex: 1 },
  fieldLabel: { fontSize: 11, color: '#888', marginBottom: 4, fontWeight: '500' },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 7,
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 14,
    backgroundColor: '#fff',
    color: '#111',
  },
  estTime: { fontSize: 11, color: '#6366f1', fontStyle: 'italic', marginTop: 2 },

  availRow: { flexDirection: 'row', gap: 6, flexWrap: 'wrap', marginTop: 4 },
  availPill: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#ddd',
    backgroundColor: '#fff',
  },
  availPillActive: { borderColor: '#22c55e', backgroundColor: '#f0fdf4' },
  availTxt: { fontSize: 12, color: '#666' },
  availTxtActive: { color: '#16a34a', fontWeight: '600' },

  addBtn: {
    borderWidth: 1,
    borderColor: '#FF6B35',
    borderStyle: 'dashed',
    borderRadius: 8,
    paddingVertical: 10,
    alignItems: 'center',
  },
  addBtnTxt: { fontSize: 14, color: '#FF6B35' },

  refillSection: { marginTop: 8 },
  refillLabel: { fontSize: 13, fontWeight: '500', color: '#444', marginBottom: 2 },
  refillHint: { fontSize: 11, color: '#999', marginBottom: 10 },
});
