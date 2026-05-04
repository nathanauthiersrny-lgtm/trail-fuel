import { Stack, router, useFocusEffect } from 'expo-router';
import React, { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

import { listFoodItems } from '../db/repos/food-item-repo';
import type { FoodItem, FoodItemKind } from '../models/food-item';
import { useDatabase } from '../hooks/use-database';

const KIND_LABELS: Record<FoodItemKind, string> = {
  gel: 'Gels',
  bar: 'Barres',
  drink_mix: 'Boissons',
  real_food: 'Real food',
  water: 'Eau',
};

const KIND_ORDER: FoodItemKind[] = ['gel', 'bar', 'drink_mix', 'water', 'real_food'];

export default function FoodItemListScreen() {
  const dbState = useDatabase();
  const [items, setItems] = useState<FoodItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    if (dbState.status !== 'ready') return;
    listFoodItems(dbState.db)
      .then(setItems)
      .catch((err) => setError(String(err)));
  }, [dbState]);

  useFocusEffect(load);

  const grouped = useMemo(() => {
    if (!items) return null;
    const out: Partial<Record<FoodItemKind, FoodItem[]>> = {};
    for (const item of items) {
      const arr = out[item.type] ?? [];
      arr.push(item);
      out[item.type] = arr;
    }
    return out;
  }, [items]);

  if (error) {
    return (
      <View style={styles.center}>
        <Text>Erreur : {error}</Text>
      </View>
    );
  }
  if (!items || !grouped) {
    return (
      <View style={styles.center}>
        <ActivityIndicator />
      </View>
    );
  }

  return (
    <>
      <Stack.Screen
        options={{
          headerRight: () => (
            <TouchableOpacity
              onPress={() => router.push('/food-item-form')}
              style={styles.headerAdd}
              hitSlop={8}
            >
              <Text style={styles.headerAddText}>＋</Text>
            </TouchableOpacity>
          ),
        }}
      />
      <ScrollView contentContainerStyle={styles.container}>
        <Text style={styles.title}>Bibliothèque ({items.length})</Text>

        {KIND_ORDER.map((kind) => {
          const list = grouped[kind];
          if (!list || list.length === 0) return null;
          return (
            <View key={kind} style={styles.section}>
              <Text style={styles.sectionTitle}>{KIND_LABELS[kind]}</Text>
              {list.map((item) => (
                <FoodItemRow key={item.id} item={item} />
              ))}
            </View>
          );
        })}
      </ScrollView>
    </>
  );
}

function FoodItemRow({ item }: { item: FoodItem }) {
  const portion =
    item.weight_g !== undefined && item.volume_ml !== undefined
      ? `${item.weight_g} g / ${item.volume_ml} ml`
      : item.weight_g !== undefined
        ? `${item.weight_g} g`
        : `${item.volume_ml} ml`;

  return (
    <TouchableOpacity
      style={styles.row}
      onPress={() => router.push(`/food-item-form?id=${item.id}`)}
      activeOpacity={0.7}
    >
      <View style={styles.rowMain}>
        <Text style={styles.rowName}>{item.name}</Text>
        <Text style={styles.rowMeta}>
          {item.carbs_g} g glucides · {item.sodium_mg} mg Na · {portion}
        </Text>
      </View>
      <View style={styles.rowRight}>
        {item.is_seed ? <Text style={styles.seedTag}>seed</Text> : null}
        <Text style={styles.chevron}>›</Text>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: { padding: 24, paddingTop: 32, backgroundColor: '#fff' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#fff' },
  title: { fontSize: 28, fontWeight: '700', marginBottom: 16 },
  section: { marginBottom: 24 },
  sectionTitle: { fontSize: 18, fontWeight: '600', marginBottom: 8, color: '#333' },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#eee',
    gap: 8,
  },
  rowMain: { flex: 1 },
  rowRight: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  rowName: { fontSize: 16, fontWeight: '500' },
  rowMeta: { fontSize: 13, color: '#666', marginTop: 2 },
  seedTag: {
    fontSize: 11,
    color: '#888',
    backgroundColor: '#f0f0f0',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  chevron: { fontSize: 20, color: '#ccc' },
  headerAdd: { marginRight: 4 },
  headerAddText: { fontSize: 22, color: '#FF6B35', fontWeight: '400' },
});
