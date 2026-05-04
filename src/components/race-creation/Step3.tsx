import React from 'react';
import { StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';

import type { Exposure } from '../../models/race';
import type { RaceCreationDraft } from '../../services/race-creation-store';

type Props = {
  draft: RaceCreationDraft;
  updateDraft: (patch: Partial<RaceCreationDraft>) => void;
};

const EXPOSURE_OPTIONS: { value: Exposure; label: string; description: string }[] = [
  { value: 'sun', label: '☀️ Soleil direct', description: 'Exposition plein soleil' },
  { value: 'shade', label: '🌲 Ombre majorit.', description: 'Forêt, versant nord…' },
  { value: 'variable', label: '⛅ Variable', description: 'Mixte' },
];

export function Step3({ draft, updateDraft }: Props) {
  const tempStr = draft.temperature_c !== undefined ? String(draft.temperature_c) : '';

  return (
    <View>
      <Text style={styles.heading}>Conditions météo</Text>

      {/* Température */}
      <Text style={styles.label}>Température moyenne prévue (°C)</Text>
      <TextInput
        style={styles.input}
        value={tempStr}
        onChangeText={(t) => {
          const n = parseFloat(t);
          if (!isNaN(n)) updateDraft({ temperature_c: n });
        }}
        keyboardType="numbers-and-punctuation"
        placeholder="15"
        returnKeyType="done"
      />

      {/* Humidité */}
      <Text style={[styles.label, { marginTop: 16 }]}>Humidité élevée ?</Text>
      <View style={styles.toggleRow}>
        <TouchableOpacity
          style={[styles.toggleBtn, !draft.humidity_high && styles.toggleBtnActive]}
          onPress={() => updateDraft({ humidity_high: false })}
        >
          <Text style={[styles.toggleTxt, !draft.humidity_high && styles.toggleTxtActive]}>
            Non
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.toggleBtn, draft.humidity_high && styles.toggleBtnActive]}
          onPress={() => updateDraft({ humidity_high: true })}
        >
          <Text style={[styles.toggleTxt, draft.humidity_high && styles.toggleTxtActive]}>
            Oui
          </Text>
        </TouchableOpacity>
      </View>

      {/* Exposition */}
      <Text style={[styles.label, { marginTop: 20 }]}>Exposition au soleil</Text>
      <View style={styles.exposureCol}>
        {EXPOSURE_OPTIONS.map(({ value, label, description }) => (
          <TouchableOpacity
            key={value}
            style={[styles.exposureBtn, draft.exposure === value && styles.exposureBtnActive]}
            onPress={() => updateDraft({ exposure: value })}
          >
            <Text style={[styles.exposureBtnLabel, draft.exposure === value && styles.exposureBtnLabelActive]}>
              {label}
            </Text>
            <Text style={styles.exposureBtnDesc}>{description}</Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  heading: { fontSize: 20, fontWeight: '700', marginBottom: 20, color: '#111' },
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
    marginBottom: 4,
  },
  toggleRow: { flexDirection: 'row', gap: 10 },
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

  exposureCol: { gap: 8 },
  exposureBtn: {
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#ddd',
    backgroundColor: '#fafafa',
  },
  exposureBtnActive: { borderColor: '#FF6B35', backgroundColor: '#FFF4F0' },
  exposureBtnLabel: { fontSize: 14, fontWeight: '500', color: '#333' },
  exposureBtnLabelActive: { color: '#FF6B35' },
  exposureBtnDesc: { fontSize: 12, color: '#888', marginTop: 2 },
});
