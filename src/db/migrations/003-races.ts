import type { SQLiteDatabase } from 'expo-sqlite';

import type { Migration } from './index';

export const migration003Races: Migration = {
  version: 3,
  description: 'Add races table',
  up: async (db: SQLiteDatabase): Promise<void> => {
    await db.execAsync(`
      CREATE TABLE races (
        id TEXT PRIMARY KEY,
        created_at INTEGER NOT NULL,
        name TEXT,
        session_type TEXT NOT NULL
          CHECK (session_type IN ('plaisir','long','dur','test','competition')),
        gpx_track_json TEXT,
        estimated_duration_min REAL NOT NULL,
        intensity TEXT NOT NULL
          CHECK (intensity IN ('easy','moderate','hard')),
        temperature_c REAL NOT NULL,
        humidity_high INTEGER NOT NULL CHECK (humidity_high IN (0,1)),
        exposure TEXT NOT NULL CHECK (exposure IN ('sun','shade','variable')),
        terrain_type TEXT NOT NULL
          CHECK (terrain_type IN ('road','rolling','mixed_trail','technical','alpine')),
        inventory_json TEXT NOT NULL,
        refill_in_nature INTEGER NOT NULL CHECK (refill_in_nature IN (0,1)),
        aid_stations_json TEXT NOT NULL,
        overrides_json TEXT,
        scheduled_start_at INTEGER NOT NULL,
        started_at INTEGER,
        ended_at INTEGER,
        paused_segments_json TEXT NOT NULL,
        scheduled_notification_ids_json TEXT NOT NULL,
        status TEXT NOT NULL
          CHECK (status IN ('planned','in_progress','completed','abandoned')),
        distance_km REAL,
        elevation_gain_m REAL,
        elevation_loss_m REAL
      );

      CREATE INDEX idx_races_status ON races(status);
      CREATE INDEX idx_races_scheduled_start ON races(scheduled_start_at DESC);
    `);
  },
};
