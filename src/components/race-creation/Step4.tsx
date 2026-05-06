import React from 'react';
import {
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

import type { Intensity, SessionType } from '../../models/race';
import type { RaceCreationDraft } from '../../services/race-creation-store';

type Props = {
  draft: RaceCreationDraft;
  updateDraft: (patch: Partial<RaceCreationDraft>) => void;
};

type SessionOption = {
  value: SessionType;
  label: string;
  description: string;
  intensity: Intensity;
};

const SESSION_OPTIONS: SessionOption[] = [
  { value: 'plaisir', label: '🏃 Sortie plaisir', description: 'Allure facile, objectif km et bonne humeur', intensity: 'easy' },
  { value: 'long', label: '🌄 Entraînement long', description: 'Volume, allure modérée, plan nutritionnel complet', intensity: 'moderate' },
  { value: 'dur', label: '💪 Entraînement dur', description: 'Intensité élevée, besoins augmentés', intensity: 'hard' },
  { value: 'test', label: '🧪 Test nutrition', description: 'Protocole test, alertes précoces actives', intensity: 'moderate' },
  { value: 'competition', label: '🏆 Course / Compétition', description: 'Alertes renforcées, tolérance réduite', intensity: 'hard' },
];

export function Step4({ draft, updateDraft }: Props) {
  const showAdvanced = draft.show_advanced;

  function selectSession(opt: SessionOption) {
    updateDraft({
      session_type: opt.value,
      intensity: opt.intensity,
      // Auto-open advanced panel for 'test' type.
      show_advanced: opt.value === 'test' ? true : draft.show_advanced,
    });
  }

  return (
    <View>
      <Text style={styles.heading}>Type de sortie</Text>

      {/* Session type selector */}
      <View style={styles.optionList}>
        {SESSION_OPTIONS.map((opt) => {
          const active = draft.session_type === opt.value;
          return (
            <TouchableOpacity
              key={opt.value}
              style={[styles.optionBtn, active && styles.optionBtnActive]}
              onPress={() => selectSession(opt)}
              activeOpacity={0.7}
            >
              <Text style={[styles.optionLabel, active && styles.optionLabelActive]}>
                {opt.label}
              </Text>
              <Text style={styles.optionDesc}>{opt.description}</Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Advanced panel toggle */}
      <TouchableOpacity
        style={styles.advancedToggle}
        onPress={() => updateDraft({ show_advanced: !showAdvanced })}
      >
        <Text style={styles.advancedToggleTxt}>
          {showAdvanced ? '▼' : '▶'} Paramètres avancés
        </Text>
      </TouchableOpacity>

      {showAdvanced && (
        <View style={styles.advancedPanel}>
          <OverrideField
            label="Glucides/heure (g)"
            placeholder={`défaut profil`}
            value={draft.overrides?.carbs_per_hour_g ?? null}
            onChange={(v) =>
              updateDraft({ overrides: { ...draft.overrides, carbs_per_hour_g: v ?? undefined } })
            }
          />
          <OverrideField
            label="Eau/heure (ml)"
            placeholder="défaut profil"
            value={draft.overrides?.fluid_per_hour_ml ?? null}
            onChange={(v) =>
              updateDraft({ overrides: { ...draft.overrides, fluid_per_hour_ml: v ?? undefined } })
            }
          />
          <OverrideField
            label="Premier intake après (min)"
            placeholder="30"
            value={draft.overrides?.first_intake_after_min ?? null}
            onChange={(v) =>
              updateDraft({
                overrides: { ...draft.overrides, first_intake_after_min: v ?? undefined },
              })
            }
          />
          <OverrideField
            label="Fréquence check-ins (min)"
            placeholder="défaut type de sortie"
            value={draft.overrides?.check_in_frequency_min ?? null}
            onChange={(v) =>
              updateDraft({
                overrides: { ...draft.overrides, check_in_frequency_min: v ?? undefined },
              })
            }
          />
          <OverrideField
            label="Intervalle entre intakes (min, ≥3 recommandé)"
            placeholder="20"
            value={draft.overrides?.intake_interval_min ?? null}
            onChange={(v) =>
              updateDraft({
                overrides: { ...draft.overrides, intake_interval_min: v ?? undefined },
              })
            }
          />

          <TouchableOpacity
            style={styles.resetOverrides}
            onPress={() => updateDraft({ overrides: null })}
          >
            <Text style={styles.resetOverridesTxt}>Réinitialiser les paramètres avancés</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

function OverrideField({
  label,
  placeholder,
  value,
  onChange,
}: {
  label: string;
  placeholder: string;
  value: number | null;
  onChange: (v: number | null) => void;
}) {
  return (
    <View style={styles.overrideField}>
      <Text style={styles.overrideLabel}>{label}</Text>
      <TextInput
        style={styles.overrideInput}
        value={value !== null ? String(value) : ''}
        onChangeText={(t) => {
          const n = parseFloat(t);
          onChange(isNaN(n) ? null : n);
        }}
        keyboardType="decimal-pad"
        placeholder={placeholder}
        placeholderTextColor="#bbb"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  heading: { fontSize: 20, fontWeight: '700', marginBottom: 20, color: '#111' },

  optionList: { gap: 10, marginBottom: 24 },
  optionBtn: {
    padding: 14,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#e5e5e5',
    backgroundColor: '#fafafa',
  },
  optionBtnActive: { borderColor: '#FF6B35', backgroundColor: '#FFF4F0' },
  optionLabel: { fontSize: 15, fontWeight: '600', color: '#333' },
  optionLabelActive: { color: '#FF6B35' },
  optionDesc: { fontSize: 12, color: '#888', marginTop: 3 },

  advancedToggle: { paddingVertical: 10 },
  advancedToggleTxt: { fontSize: 14, color: '#555', fontWeight: '500' },

  advancedPanel: {
    backgroundColor: '#f9f9f9',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#eee',
    padding: 14,
    gap: 12,
    marginTop: 4,
  },
  overrideField: { gap: 4 },
  overrideLabel: { fontSize: 12, color: '#666', fontWeight: '500' },
  overrideInput: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 14,
    backgroundColor: '#fff',
    color: '#111',
  },
  resetOverrides: { alignItems: 'center', paddingTop: 4 },
  resetOverridesTxt: { fontSize: 12, color: '#999', textDecorationLine: 'underline' },
});
