import type { SQLiteDatabase } from 'expo-sqlite';

import seedFoodItems from '../../../assets/seed/food-items.json';
import type { FoodItemKind } from '../../models/food-item';

import type { Migration } from './index';

type SeedRecord = {
  id: string;
  name: string;
  type: FoodItemKind;
  carbs_g: number;
  sodium_mg: number;
  weight_g?: number;
  volume_ml?: number;
  notes?: string;
};

export const migration002SeedFoodItems: Migration = {
  version: 2,
  description: 'Seed default FoodItem library (idempotent: INSERT OR IGNORE)',
  up: async (db: SQLiteDatabase): Promise<void> => {
    const items = seedFoodItems as SeedRecord[];

    for (const item of items) {
      // TODO: seed v3 update strategy — détecter édition utilisateur avant overwrite.
      //   Aujourd'hui INSERT OR IGNORE skip toute ligne dont l'id existe déjà, donc
      //   un seed bumpé ne sera jamais ré-appliqué. Quand on bumpera (migration 003+),
      //   stocker un canonical_hash par item seed et comparer : si la row courante
      //   diffère du canonique précédent (= utilisateur a édité), warn et skip ;
      //   sinon, UPDATE vers le nouveau canonique.
      await db.runAsync(
        `INSERT OR IGNORE INTO food_items
          (id, name, type, carbs_g, sodium_mg, weight_g, volume_ml, notes, is_seed)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1)`,
        [
          item.id,
          item.name,
          item.type,
          item.carbs_g,
          item.sodium_mg,
          item.weight_g ?? null,
          item.volume_ml ?? null,
          item.notes ?? null,
        ],
      );
    }
  },
};
