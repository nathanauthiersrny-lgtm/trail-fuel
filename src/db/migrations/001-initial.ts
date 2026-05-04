import type { SQLiteDatabase } from 'expo-sqlite';

import type { Migration } from './index';

export const migration001Initial: Migration = {
  version: 1,
  description: 'Initial schema: profiles + food_items',
  up: async (db: SQLiteDatabase): Promise<void> => {
    await db.execAsync(`
      CREATE TABLE profiles (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        weight_kg REAL NOT NULL,
        carbs_per_hour_g REAL NOT NULL,
        fluid_per_hour_ml REAL NOT NULL,
        sodium_per_hour_mg REAL NOT NULL,
        flat_pace_min_per_km REAL NOT NULL,
        pace_calibration_factor REAL NOT NULL,
        gel_tolerance TEXT NOT NULL CHECK (gel_tolerance IN ('high', 'medium', 'low')),
        solid_food_tolerance TEXT NOT NULL CHECK (solid_food_tolerance IN ('high', 'medium', 'low')),
        updated_at INTEGER NOT NULL
      );

      CREATE TABLE food_items (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        type TEXT NOT NULL CHECK (type IN ('gel', 'bar', 'drink_mix', 'real_food', 'water')),
        carbs_g REAL NOT NULL,
        sodium_mg REAL NOT NULL,
        weight_g REAL,
        volume_ml REAL,
        notes TEXT,
        is_seed INTEGER NOT NULL DEFAULT 0 CHECK (is_seed IN (0, 1)),
        CHECK (weight_g IS NOT NULL OR volume_ml IS NOT NULL)
      );

      CREATE INDEX idx_food_items_type ON food_items(type);
    `);
  },
};
