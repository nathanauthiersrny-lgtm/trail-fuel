import React, { useEffect, useMemo, useState } from 'react';
import {
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

import { checkFeasibility } from '../../engine/planning/feasibility';
import { computeNeeds } from '../../engine/planning/needs';
import { resolveParams } from '../../engine/planning/resolve-params';
import type { FoodItem, FoodItemKind } from '../../models/food-item';
import type { Profile } from '../../models/profile';
import type { PlanWarning } from '../../models/planned-event';
import type { Race } from '../../models/race';
import type { RaceCreationDraft } from '../../services/race-creation-store';

type Props = {
  draft: RaceCreationDraft;
  updateDraft: (patch: Partial<RaceCreationDraft>) => void;
  profile: Profile | null;
  foodItems: FoodItem[];
};

const KIND_ORDER: FoodItemKind[] = ['gel', 'bar', 'drink_mix', 'real_food', 'water'];
const KIND_LABELS: Record<FoodItemKind, string> = {
  gel: 'Gels',
  bar: 'Barres',
  drink_mix: 'Boissons',
  real_food: 'Real food',
  water: 'Eau',
};

// Construct a partial Race from the draft for resolveParams.
function draftToRaceForParams(draft: RaceCreationDraft): Race {
  return {
    id: '',
    created_at: 0,
    session_type: draft.session_type ?? 'long',
    intensity: draft.intensity ?? 'moderate',
    temperature_c: draft.temperature_c,
    humidity_high: draft.humidity_high,
    exposure: draft.exposure,
    terrain_type: draft.terrain_type ?? 'mixed_trail',
    estimated_duration_min: draft.estimated_duration_min ?? 0,
    inventory: draft.inventory,
    refill_in_nature: draft.refill_in_nature,
    aid_stations: draft.aid_stations,
    scheduled_start_at: draft.scheduled_start_at,
    started_at: null,
    ended_at: null,
    paused_segments: [],
    scheduled_notification_ids: [],
    status: 'planned',
    ...(draft.overrides ? { overrides: draft.overrides } : {}),
    ...(draft.distance_km !== null ? { distance_km: draft.distance_km } : {}),
    ...(draft.elevation_gain_m !== null ? { elevation_gain_m: draft.elevation_gain_m } : {}),
    ...(draft.elevation_loss_m !== null ? { elevation_loss_m: draft.elevation_loss_m } : {}),
  };
}

export function Step6({ draft, updateDraft, profile, foodItems }: Props) {
  const [warnings, setWarnings] = useState<PlanWarning[]>([]);

  // Compute nutritional needs (memoised, cheap).
  const needs = useMemo(() => {
    if (!profile || !draft.estimated_duration_min) return null;
    const race = draftToRaceForParams(draft);
    const params = resolveParams({ profile, race, durationMin: draft.estimated_duration_min });
    return computeNeeds({ params, durationMin: draft.estimated_duration_min });
  }, [profile, draft.session_type, draft.temperature_c, draft.humidity_high, draft.exposure, draft.estimated_duration_min, draft.overrides]);

  // Feasibility check — debounced 200ms on inventory changes.
  useEffect(() => {
    if (!needs) return;
    const timer = setTimeout(() => {
      const ws = checkFeasibility({
        inventory: draft.inventory,
        foodItems,
        aidStations: draft.aid_stations,
        needs,
      });
      setWarnings(ws);
    }, 200);
    return () => clearTimeout(timer);
  }, [draft.inventory, draft.aid_stations, foodItems, needs]);

  // Build quantity map from draft.inventory.
  const quantityById = useMemo(() => {
    const map: Record<string, number> = {};
    for (const slot of draft.inventory) {
      map[slot.food_item_id] = slot.quantity;
    }
    return map;
  }, [draft.inventory]);

  function setQuantity(foodItemId: string, quantity: number) {
    const next = draft.inventory.filter((i) => i.food_item_id !== foodItemId);
    if (quantity > 0) next.push({ food_item_id: foodItemId, quantity });
    updateDraft({ inventory: next });
  }

  // Total fluid from inventory.
  const totalFluidMl = useMemo(() => {
    return draft.inventory.reduce((sum, slot) => {
      const item = foodItems.find((f) => f.id === slot.food_item_id);
      return sum + (item?.volume_ml ?? 0) * slot.quantity;
    }, 0);
  }, [draft.inventory, foodItems]);

  // Group food items by type.
  const grouped = useMemo(() => {
    const out: Partial<Record<FoodItemKind, FoodItem[]>> = {};
    for (const item of foodItems) {
      const arr = out[item.type] ?? [];
      arr.push(item);
      out[item.type] = arr;
    }
    return out;
  }, [foodItems]);

  const inventoryCount = draft.inventory.length;

  return (
    <View>
      <Text style={styles.heading}>Inventaire embarqué</Text>

      {/* Feasibility warnings */}
      {warnings.map((w) => (
        <View key={w.code} style={styles.warning}>
          <Text style={styles.warningTxt}>⚠️ {w.message}</Text>
        </View>
      ))}

      {/* Summary bar */}
      <View style={styles.summaryBar}>
        <Text style={styles.summaryTxt}>
          {inventoryCount} item{inventoryCount !== 1 ? 's' : ''} sélectionné{inventoryCount !== 1 ? 's' : ''}
          {totalFluidMl > 0 ? ` · ${totalFluidMl} ml` : ''}
        </Text>
      </View>

      {/* Food items by type */}
      {KIND_ORDER.map((kind) => {
        const list = grouped[kind];
        if (!list?.length) return null;
        return (
          <View key={kind} style={styles.section}>
            <Text style={styles.sectionTitle}>{KIND_LABELS[kind]}</Text>
            {list.map((item) => {
              const qty = quantityById[item.id] ?? 0;
              return (
                <View key={item.id} style={styles.itemRow}>
                  <View style={styles.itemInfo}>
                    <Text style={styles.itemName}>{item.name}</Text>
                    <Text style={styles.itemMeta}>
                      {item.carbs_g}g gluc
                      {item.volume_ml !== undefined ? ` · ${item.volume_ml}ml` : ''}
                    </Text>
                  </View>
                  <View style={styles.qtyControl}>
                    <TouchableOpacity
                      style={styles.qtyBtn}
                      onPress={() => setQuantity(item.id, Math.max(0, qty - 1))}
                      disabled={qty === 0}
                    >
                      <Text style={[styles.qtyBtnTxt, qty === 0 && styles.qtyBtnDisabled]}>−</Text>
                    </TouchableOpacity>
                    <Text style={styles.qtyValue}>{qty}</Text>
                    <TouchableOpacity
                      style={styles.qtyBtn}
                      onPress={() => setQuantity(item.id, qty + 1)}
                    >
                      <Text style={styles.qtyBtnTxt}>＋</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              );
            })}
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  heading: { fontSize: 20, fontWeight: '700', marginBottom: 16, color: '#111' },

  warning: {
    backgroundColor: '#fef2f2',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#fca5a5',
    padding: 12,
    marginBottom: 10,
  },
  warningTxt: { fontSize: 13, color: '#b91c1c', lineHeight: 18 },

  summaryBar: {
    backgroundColor: '#f5f5f5',
    borderRadius: 8,
    padding: 10,
    marginBottom: 16,
  },
  summaryTxt: { fontSize: 13, color: '#555', textAlign: 'center' },

  section: { marginBottom: 20 },
  sectionTitle: { fontSize: 14, fontWeight: '600', color: '#555', marginBottom: 8 },

  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#f0f0f0',
    gap: 8,
  },
  itemInfo: { flex: 1 },
  itemName: { fontSize: 14, fontWeight: '500', color: '#111' },
  itemMeta: { fontSize: 11, color: '#888', marginTop: 1 },

  qtyControl: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  qtyBtn: {
    width: 32,
    height: 32,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#ddd',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fafafa',
  },
  qtyBtnTxt: { fontSize: 16, color: '#FF6B35', fontWeight: '600' },
  qtyBtnDisabled: { color: '#ddd' },
  qtyValue: { width: 28, textAlign: 'center', fontSize: 15, fontWeight: '600', color: '#111' },
});
