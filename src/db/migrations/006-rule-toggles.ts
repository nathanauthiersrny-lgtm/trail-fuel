import type { SQLiteDatabase } from 'expo-sqlite';

import type { Migration } from './index';

export const migration006RuleToggles: Migration = {
  version: 6,
  description: 'Add disabled_rule_ids column to profile for per-rule toggles',
  up: async (db: SQLiteDatabase): Promise<void> => {
    await db.execAsync(`
      ALTER TABLE profiles ADD COLUMN disabled_rule_ids TEXT NOT NULL DEFAULT '[]';
    `);
  },
};
