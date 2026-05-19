import type { SQLiteDatabase } from 'expo-sqlite';

import type { Migration } from './index';

/**
 * Ajoute la colonne timeline_plan_json à races.
 *
 * Le TimelinePlan (engine brut ou enrichi par le LLM) est sérialisé tel quel
 * en TEXT. NULL pour les races créées avant cette migration — le runtime
 * fallback alors sur l'ancien pipeline `generatePlan()`.
 *
 * À terme (A.5) on supprimera le fallback et la colonne deviendra NOT NULL.
 */
export const migration007TimelinePlan: Migration = {
  version: 7,
  description: 'Add timeline_plan_json column to races',
  up: async (db: SQLiteDatabase): Promise<void> => {
    await db.execAsync(`
      ALTER TABLE races ADD COLUMN timeline_plan_json TEXT;
    `);
  },
};
