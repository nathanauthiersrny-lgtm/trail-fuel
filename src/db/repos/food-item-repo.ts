import type { SQLiteDatabase } from 'expo-sqlite';

import type { FoodItem, FoodItemKind } from '../../models/food-item';
import { SeedItemDeleteError, assertValidFoodItem } from '../../models/food-item';

type FoodItemRow = {
  id: string;
  name: string;
  type: FoodItemKind;
  carbs_g: number;
  sodium_mg: number;
  weight_g: number | null;
  volume_ml: number | null;
  notes: string | null;
  is_seed: 0 | 1;
};

function rowToFoodItem(row: FoodItemRow): FoodItem {
  const candidate = {
    id: row.id,
    name: row.name,
    type: row.type,
    carbs_g: row.carbs_g,
    sodium_mg: row.sodium_mg,
    is_seed: row.is_seed === 1,
    ...(row.weight_g !== null ? { weight_g: row.weight_g } : {}),
    ...(row.volume_ml !== null ? { volume_ml: row.volume_ml } : {}),
    ...(row.notes !== null ? { notes: row.notes } : {}),
  };
  assertValidFoodItem(candidate);
  return candidate;
}

export async function listFoodItems(db: SQLiteDatabase): Promise<FoodItem[]> {
  const rows = await db.getAllAsync<FoodItemRow>(
    'SELECT * FROM food_items ORDER BY type ASC, name ASC',
  );
  return rows.map(rowToFoodItem);
}

export async function getFoodItem(
  db: SQLiteDatabase,
  id: string,
): Promise<FoodItem | null> {
  const row = await db.getFirstAsync<FoodItemRow>(
    'SELECT * FROM food_items WHERE id = ?',
    [id],
  );
  return row ? rowToFoodItem(row) : null;
}

export async function createFoodItem(
  db: SQLiteDatabase,
  item: FoodItem,
): Promise<void> {
  await db.runAsync(
    `INSERT INTO food_items
      (id, name, type, carbs_g, sodium_mg, weight_g, volume_ml, notes, is_seed)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      item.id,
      item.name,
      item.type,
      item.carbs_g,
      item.sodium_mg,
      item.weight_g ?? null,
      item.volume_ml ?? null,
      item.notes ?? null,
      item.is_seed ? 1 : 0,
    ],
  );
}

export async function updateFoodItem(
  db: SQLiteDatabase,
  item: FoodItem,
): Promise<void> {
  await db.runAsync(
    `UPDATE food_items
     SET name = ?, type = ?, carbs_g = ?, sodium_mg = ?,
         weight_g = ?, volume_ml = ?, notes = ?
     WHERE id = ?`,
    [
      item.name,
      item.type,
      item.carbs_g,
      item.sodium_mg,
      item.weight_g ?? null,
      item.volume_ml ?? null,
      item.notes ?? null,
      item.id,
    ],
  );
}

export async function deleteFoodItem(
  db: SQLiteDatabase,
  id: string,
): Promise<void> {
  const row = await db.getFirstAsync<{ is_seed: 0 | 1 }>(
    'SELECT is_seed FROM food_items WHERE id = ?',
    [id],
  );
  if (row?.is_seed === 1) throw new SeedItemDeleteError();
  await db.runAsync('DELETE FROM food_items WHERE id = ?', [id]);
}
