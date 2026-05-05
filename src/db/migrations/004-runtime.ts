import type { SQLiteDatabase } from 'expo-sqlite';

import type { Migration } from './index';

export const migration004Runtime: Migration = {
  version: 4,
  description: 'Add planned_events and event_logs tables for race runtime',
  up: async (db: SQLiteDatabase): Promise<void> => {
    await db.execAsync(`
      CREATE TABLE planned_events (
        id TEXT PRIMARY KEY,
        race_id TEXT NOT NULL,
        scheduled_at_minute REAL NOT NULL,
        scheduled_at_ms INTEGER NOT NULL,
        type TEXT NOT NULL
          CHECK (type IN ('intake','check_in','aid_station','fluid_reminder')),
        payload_json TEXT NOT NULL,
        notification_id TEXT,
        order_index INTEGER NOT NULL,
        FOREIGN KEY (race_id) REFERENCES races(id) ON DELETE CASCADE
      );

      CREATE INDEX idx_planned_events_race
        ON planned_events(race_id, scheduled_at_minute);
      CREATE INDEX idx_planned_events_notification
        ON planned_events(notification_id);

      CREATE TABLE event_logs (
        id TEXT PRIMARY KEY,
        race_id TEXT NOT NULL,
        planned_event_id TEXT,
        logged_at INTEGER NOT NULL,
        status TEXT NOT NULL CHECK (status IN ('done','skipped')),
        feeling TEXT CHECK (feeling IN ('good','meh','bad')),
        FOREIGN KEY (race_id) REFERENCES races(id) ON DELETE CASCADE,
        FOREIGN KEY (planned_event_id) REFERENCES planned_events(id) ON DELETE SET NULL
      );

      CREATE INDEX idx_event_logs_race ON event_logs(race_id, logged_at);
      CREATE UNIQUE INDEX idx_event_logs_unique_planned
        ON event_logs(planned_event_id)
        WHERE planned_event_id IS NOT NULL;
    `);
  },
};
