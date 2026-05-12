import type { SQLiteDatabase } from 'expo-sqlite';

import type { Migration } from './index';

export const migration005EventFeedback: Migration = {
  version: 5,
  description: 'Add event_feedback table for in-race skip reasons + post-race debrief tags',
  up: async (db: SQLiteDatabase): Promise<void> => {
    await db.execAsync(`
      CREATE TABLE event_feedback (
        id TEXT PRIMARY KEY,
        race_id TEXT NOT NULL,
        planned_event_id TEXT NOT NULL UNIQUE,
        skip_reason TEXT
          CHECK (skip_reason IN ('stomach','taste','too_early','too_close','terrain','other')),
        tags TEXT,
        actual_quantity TEXT
          CHECK (actual_quantity IN ('full','half','quarter')),
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL,
        FOREIGN KEY (race_id) REFERENCES races(id) ON DELETE CASCADE,
        FOREIGN KEY (planned_event_id) REFERENCES planned_events(id) ON DELETE CASCADE
      );

      CREATE INDEX idx_event_feedback_race ON event_feedback(race_id);
    `);
  },
};
