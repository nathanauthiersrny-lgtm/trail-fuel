import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

import { useDatabase } from '../hooks/use-database';
import { getOrCreateProfile, updateProfile } from '../db/repos/profile-repo';
import type { GelTolerance, Profile, SolidTolerance } from '../models/profile';

const TOLERANCE_OPTIONS: GelTolerance[] = ['low', 'medium', 'high'];

export default function ProfileScreen() {
  const dbState = useDatabase();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (dbState.status !== 'ready') return;
    getOrCreateProfile(dbState.db).then(setProfile).catch((err) => {
      Alert.alert('Erreur DB', String(err));
    });
  }, [dbState]);

  if (dbState.status === 'loading' || !profile) {
    return (
      <View style={styles.center}>
        <ActivityIndicator />
      </View>
    );
  }
  if (dbState.status === 'error') {
    return (
      <View style={styles.center}>
        <Text>Erreur DB : {dbState.error.message}</Text>
      </View>
    );
  }

  const handleSave = async () => {
    if (dbState.status !== 'ready') return;
    setSaving(true);
    try {
      const updated = await updateProfile(dbState.db, profile);
      setProfile(updated);
      Alert.alert('Profil enregistré');
    } catch (err) {
      Alert.alert('Erreur', String(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>Profil</Text>

      <NumberField
        label="Poids (kg)"
        value={profile.weight_kg}
        onChange={(v) => setProfile({ ...profile, weight_kg: v })}
      />
      <NumberField
        label="Glucides / heure (g)"
        value={profile.carbs_per_hour_g}
        onChange={(v) => setProfile({ ...profile, carbs_per_hour_g: v })}
      />
      <NumberField
        label="Fluide / heure (ml)"
        value={profile.fluid_per_hour_ml}
        onChange={(v) => setProfile({ ...profile, fluid_per_hour_ml: v })}
      />
      <NumberField
        label="Sodium / heure (mg)"
        value={profile.sodium_per_hour_mg}
        onChange={(v) => setProfile({ ...profile, sodium_per_hour_mg: v })}
      />
      <NumberField
        label="Pace plat (min/km)"
        value={profile.flat_pace_min_per_km}
        onChange={(v) => setProfile({ ...profile, flat_pace_min_per_km: v })}
      />
      <NumberField
        label="Facteur calibration pace"
        value={profile.pace_calibration_factor}
        onChange={(v) => setProfile({ ...profile, pace_calibration_factor: v })}
      />

      <ToleranceField
        label="Tolérance gels"
        value={profile.preferences.gel_tolerance}
        onChange={(v) =>
          setProfile({
            ...profile,
            preferences: { ...profile.preferences, gel_tolerance: v },
          })
        }
      />
      <ToleranceField<SolidTolerance>
        label="Tolérance solide"
        value={profile.preferences.solid_food_tolerance}
        onChange={(v) =>
          setProfile({
            ...profile,
            preferences: { ...profile.preferences, solid_food_tolerance: v },
          })
        }
      />

      <TouchableOpacity
        style={[styles.saveButton, saving && styles.saveButtonDisabled]}
        onPress={handleSave}
        disabled={saving}
      >
        <Text style={styles.saveButtonText}>{saving ? 'Enregistrement…' : 'Enregistrer'}</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

function NumberField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
}) {
  const [text, setText] = useState(String(value));

  useEffect(() => {
    setText(String(value));
  }, [value]);

  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        style={styles.fieldInput}
        keyboardType="decimal-pad"
        value={text}
        onChangeText={setText}
        onBlur={() => {
          const parsed = Number.parseFloat(text.replace(',', '.'));
          if (Number.isFinite(parsed)) onChange(parsed);
          else setText(String(value));
        }}
      />
    </View>
  );
}

function ToleranceField<T extends GelTolerance | SolidTolerance>({
  label,
  value,
  onChange,
}: {
  label: string;
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <View style={styles.toleranceRow}>
        {TOLERANCE_OPTIONS.map((option) => {
          const selected = option === value;
          return (
            <TouchableOpacity
              key={option}
              style={[styles.toleranceChip, selected && styles.toleranceChipSelected]}
              onPress={() => onChange(option as T)}
            >
              <Text style={[styles.toleranceChipText, selected && styles.toleranceChipTextSelected]}>
                {option}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { padding: 24, paddingTop: 32, gap: 16, backgroundColor: '#fff' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#fff' },
  title: { fontSize: 28, fontWeight: '700', marginBottom: 8 },
  field: { gap: 6 },
  fieldLabel: { fontSize: 14, color: '#444' },
  fieldInput: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
  },
  toleranceRow: { flexDirection: 'row', gap: 8 },
  toleranceChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#ddd',
  },
  toleranceChipSelected: { backgroundColor: '#0a7ea4', borderColor: '#0a7ea4' },
  toleranceChipText: { fontSize: 14, color: '#444' },
  toleranceChipTextSelected: { color: '#fff', fontWeight: '600' },
  saveButton: {
    marginTop: 16,
    backgroundColor: '#0a7ea4',
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
  },
  saveButtonDisabled: { opacity: 0.5 },
  saveButtonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
});
