import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { router } from 'expo-router';

import {
  createFoodItem,
  deleteFoodItem,
  getFoodItem,
  updateFoodItem,
} from '../db/repos/food-item-repo';
import type { FoodItem, FoodItemKind } from '../models/food-item';
import { SeedItemDeleteError, assertValidFoodItem } from '../models/food-item';
import { useDatabase } from '../hooks/use-database';

// ─── Constants ───────────────────────────────────────────────────────────────

const KIND_ORDER: FoodItemKind[] = ['gel', 'bar', 'drink_mix', 'real_food', 'water'];

const KIND_LABELS: Record<FoodItemKind, string> = {
  gel: 'Gel',
  bar: 'Barre',
  drink_mix: 'Boisson',
  real_food: 'Real food',
  water: 'Eau',
};

// Types that require weight_g; volume_ml is optional for them.
const WEIGHT_REQUIRED: Set<FoodItemKind> = new Set(['gel', 'bar', 'real_food']);
// Types that require volume_ml; weight_g is optional for them.
const VOLUME_REQUIRED: Set<FoodItemKind> = new Set(['drink_mix', 'water']);

// ─── Form state ──────────────────────────────────────────────────────────────

type FormState = {
  name: string;
  type: FoodItemKind;
  carbs_g: string;
  sodium_mg: string;
  weight_g: string;
  volume_ml: string;
  notes: string;
};

function defaultForm(): FormState {
  return {
    name: '',
    type: 'gel',
    carbs_g: '',
    sodium_mg: '0',
    weight_g: '',
    volume_ml: '',
    notes: '',
  };
}

function itemToForm(item: FoodItem): FormState {
  return {
    name: item.name,
    type: item.type,
    carbs_g: String(item.carbs_g),
    sodium_mg: String(item.sodium_mg),
    weight_g: item.weight_g !== undefined ? String(item.weight_g) : '',
    volume_ml: item.volume_ml !== undefined ? String(item.volume_ml) : '',
    notes: item.notes ?? '',
  };
}

// ─── Validation ──────────────────────────────────────────────────────────────

type FormErrors = Partial<Record<keyof FormState, string>>;

function buildErrors(f: FormState): FormErrors {
  const e: FormErrors = {};

  if (!f.name.trim()) e.name = 'Nom requis';

  const carbs = parseFloat(f.carbs_g);
  if (!f.carbs_g.trim() || isNaN(carbs) || carbs < 0)
    e.carbs_g = 'Nombre ≥ 0 requis';

  const sodium = parseFloat(f.sodium_mg);
  if (!f.sodium_mg.trim() || isNaN(sodium) || sodium < 0)
    e.sodium_mg = 'Nombre ≥ 0 requis';

  if (WEIGHT_REQUIRED.has(f.type)) {
    const w = parseFloat(f.weight_g);
    if (!f.weight_g.trim() || isNaN(w) || w <= 0)
      e.weight_g = 'Poids requis (> 0 g)';
  }

  if (VOLUME_REQUIRED.has(f.type)) {
    const v = parseFloat(f.volume_ml);
    if (!f.volume_ml.trim() || isNaN(v) || v <= 0)
      e.volume_ml = 'Volume requis (> 0 ml)';
  }

  return e;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function generateId(): string {
  return `fi_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

function formToItem(f: FormState, id: string, isSeed: boolean): FoodItem {
  const candidate = {
    id,
    name: f.name.trim(),
    type: f.type,
    carbs_g: parseFloat(f.carbs_g),
    sodium_mg: parseFloat(f.sodium_mg),
    is_seed: isSeed,
    ...(f.notes.trim() ? { notes: f.notes.trim() } : {}),
    ...(f.weight_g.trim() ? { weight_g: parseFloat(f.weight_g) } : {}),
    ...(f.volume_ml.trim() ? { volume_ml: parseFloat(f.volume_ml) } : {}),
  };
  assertValidFoodItem(candidate);
  return candidate;
}

// ─── Screen ──────────────────────────────────────────────────────────────────

type Props = { id?: string };

export default function FoodItemFormScreen({ id }: Props) {
  const isEdit = !!id;
  const dbState = useDatabase();
  const [loading, setLoading] = useState(isEdit);
  const [saving, setSaving] = useState(false);
  const [isSeed, setIsSeed] = useState(false);
  const [form, setForm] = useState<FormState>(defaultForm());
  const [touched, setTouched] = useState<Set<keyof FormState>>(new Set());
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    if (!isEdit || dbState.status !== 'ready') return;
    setLoading(true);
    getFoodItem(dbState.db, id!)
      .then((item) => {
        if (!item) { setLoadError('Item introuvable'); return; }
        setForm(itemToForm(item));
        setIsSeed(item.is_seed);
      })
      .catch((err) => setLoadError(String(err)))
      .finally(() => setLoading(false));
  }, [isEdit, dbState, id]);

  const errors = useMemo(() => buildErrors(form), [form]);
  const isValid = Object.keys(errors).length === 0;

  const touch = useCallback((field: keyof FormState) => {
    setTouched((prev) => new Set([...prev, field]));
  }, []);

  function setField<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSave() {
    if (!isValid || dbState.status !== 'ready' || saving) return;
    setSaving(true);
    try {
      const item = formToItem(form, id ?? generateId(), isSeed);
      if (isEdit) {
        await updateFoodItem(dbState.db, item);
      } else {
        await createFoodItem(dbState.db, item);
      }
      router.back();
    } catch (err) {
      Alert.alert('Erreur', String(err));
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!isEdit || dbState.status !== 'ready') return;
    Alert.alert(
      'Supprimer ?',
      `Supprimer "${form.name}" de la bibliothèque ?`,
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Supprimer',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteFoodItem(dbState.db, id!);
              router.back();
            } catch (err) {
              if (err instanceof SeedItemDeleteError) {
                Alert.alert('Action impossible', err.message);
              } else {
                Alert.alert('Erreur', String(err));
              }
            }
          },
        },
      ],
    );
  }

  if (loadError) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorText}>{loadError}</Text>
      </View>
    );
  }

  if (loading || dbState.status === 'loading') {
    return (
      <View style={styles.center}>
        <ActivityIndicator />
      </View>
    );
  }

  const needsWeight = WEIGHT_REQUIRED.has(form.type);
  const needsVolume = VOLUME_REQUIRED.has(form.type);

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView
        contentContainerStyle={styles.container}
        keyboardShouldPersistTaps="handled"
      >
        {/* Type selector */}
        <Text style={styles.label}>Type</Text>
        <View style={styles.typeRow}>
          {KIND_ORDER.map((kind) => (
            <TouchableOpacity
              key={kind}
              style={[
                styles.typePill,
                form.type === kind && styles.typePillActive,
              ]}
              onPress={() => setField('type', kind)}
            >
              <Text
                style={[
                  styles.typePillText,
                  form.type === kind && styles.typePillTextActive,
                ]}
              >
                {KIND_LABELS[kind]}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Name */}
        <Field
          label="Nom"
          required
          error={touched.has('name') ? errors.name : undefined}
        >
          <TextInput
            style={styles.input}
            value={form.name}
            onChangeText={(v) => setField('name', v)}
            onBlur={() => touch('name')}
            placeholder="ex. Maurten Gel 100"
            returnKeyType="next"
          />
        </Field>

        {/* Carbs */}
        <Field
          label="Glucides (g)"
          required
          error={touched.has('carbs_g') ? errors.carbs_g : undefined}
        >
          <TextInput
            style={styles.input}
            value={form.carbs_g}
            onChangeText={(v) => setField('carbs_g', v)}
            onBlur={() => touch('carbs_g')}
            keyboardType="decimal-pad"
            placeholder="0"
          />
        </Field>

        {/* Sodium */}
        <Field
          label="Sodium (mg)"
          required
          error={touched.has('sodium_mg') ? errors.sodium_mg : undefined}
        >
          <TextInput
            style={styles.input}
            value={form.sodium_mg}
            onChangeText={(v) => setField('sodium_mg', v)}
            onBlur={() => touch('sodium_mg')}
            keyboardType="decimal-pad"
            placeholder="0"
          />
        </Field>

        {/* Weight */}
        <Field
          label={needsWeight ? 'Poids (g)' : 'Poids (g) — optionnel'}
          required={needsWeight}
          error={touched.has('weight_g') ? errors.weight_g : undefined}
        >
          <TextInput
            style={styles.input}
            value={form.weight_g}
            onChangeText={(v) => setField('weight_g', v)}
            onBlur={() => touch('weight_g')}
            keyboardType="decimal-pad"
            placeholder={needsWeight ? 'ex. 40' : '—'}
          />
        </Field>

        {/* Volume */}
        <Field
          label={needsVolume ? 'Volume (ml)' : 'Volume (ml) — optionnel'}
          required={needsVolume}
          error={touched.has('volume_ml') ? errors.volume_ml : undefined}
        >
          <TextInput
            style={styles.input}
            value={form.volume_ml}
            onChangeText={(v) => setField('volume_ml', v)}
            onBlur={() => touch('volume_ml')}
            keyboardType="decimal-pad"
            placeholder={needsVolume ? 'ex. 500' : '—'}
          />
        </Field>

        {/* Notes */}
        <Field label="Notes (optionnel)">
          <TextInput
            style={[styles.input, styles.inputMultiline]}
            value={form.notes}
            onChangeText={(v) => setField('notes', v)}
            placeholder="Marque, remarques..."
            multiline
            numberOfLines={3}
          />
        </Field>

        {/* Seed notice */}
        {isSeed ? (
          <View style={styles.seedNotice}>
            <Text style={styles.seedNoticeText}>
              Item de la bibliothèque par défaut — les modifications sont enregistrées.
            </Text>
          </View>
        ) : null}

        {/* Save */}
        <TouchableOpacity
          style={[styles.saveButton, !isValid && styles.saveButtonDisabled]}
          onPress={handleSave}
          disabled={!isValid || saving}
          activeOpacity={isValid ? 0.7 : 1}
        >
          <Text style={styles.saveButtonText}>
            {saving ? 'Enregistrement…' : isEdit ? 'Enregistrer' : 'Créer'}
          </Text>
        </TouchableOpacity>

        {/* Delete — non-seed edit only */}
        {isEdit && !isSeed ? (
          <TouchableOpacity style={styles.deleteButton} onPress={handleDelete}>
            <Text style={styles.deleteButtonText}>Supprimer cet item</Text>
          </TouchableOpacity>
        ) : null}

        <View style={styles.bottomPad} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

// ─── Field wrapper ────────────────────────────────────────────────────────────

type FieldProps = {
  label: string;
  required?: boolean;
  error?: string;
  children: React.ReactNode;
};

function Field({ label, required, error, children }: FieldProps) {
  return (
    <View style={styles.fieldGroup}>
      <Text style={styles.label}>
        {label}
        {required ? <Text style={styles.requiredStar}> *</Text> : null}
      </Text>
      {children}
      {error ? <Text style={styles.fieldError}>{error}</Text> : null}
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: '#fff' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#fff' },
  container: { padding: 20 },

  // Type pills
  typeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 20 },
  typePill: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#ddd',
    backgroundColor: '#fafafa',
  },
  typePillActive: { borderColor: '#FF6B35', backgroundColor: '#FFF4F0' },
  typePillText: { fontSize: 13, color: '#555' },
  typePillTextActive: { color: '#FF6B35', fontWeight: '600' },

  // Form fields
  fieldGroup: { marginBottom: 16 },
  label: { fontSize: 13, fontWeight: '500', color: '#444', marginBottom: 6 },
  requiredStar: { color: '#e53e3e' },
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
  inputMultiline: { minHeight: 72, textAlignVertical: 'top' },
  fieldError: { marginTop: 4, fontSize: 12, color: '#e53e3e' },

  // Seed notice
  seedNotice: {
    backgroundColor: '#FFF9E6',
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#F5D67A',
  },
  seedNoticeText: { fontSize: 13, color: '#7A5A00' },

  // Buttons
  saveButton: {
    backgroundColor: '#FF6B35',
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 8,
    marginBottom: 12,
  },
  saveButtonDisabled: { backgroundColor: '#FBBFA7' },
  saveButtonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  deleteButton: { alignItems: 'center', paddingVertical: 12 },
  deleteButtonText: { fontSize: 14, color: '#e53e3e' },
  bottomPad: { height: 32 },
  errorText: { color: '#e53e3e', fontSize: 14 },
});
