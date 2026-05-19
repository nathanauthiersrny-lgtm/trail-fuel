import type { SQLiteDatabase } from 'expo-sqlite';

import type { Migration } from './index';

/**
 * Ajoute la colonne post_race_analysis_json à races.
 *
 * Stocke le résultat de l'analyse Claude post-course (summary + proposals
 * restantes après accept/dismiss) pour qu'on n'aie pas à re-payer un call
 * sonnet quand l'user rouvre l'écran summary. Mutable au fil des decisions
 * accept/dismiss.
 */
export const migration008PostRaceAnalysis: Migration = {
  version: 8,
  description: 'Add post_race_analysis_json column to races',
  up: async (db: SQLiteDatabase): Promise<void> => {
    await db.execAsync(`
      ALTER TABLE races ADD COLUMN post_race_analysis_json TEXT;
    `);
  },
};
