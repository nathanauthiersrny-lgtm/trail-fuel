import type { SQLiteDatabase } from 'expo-sqlite';

import { migration001Initial } from './001-initial';
import { migration002SeedFoodItems } from './002-seed-food-items';
import { migration003Races } from './003-races';
import { migration004Runtime } from './004-runtime';
import { migration005EventFeedback } from './005-event-feedback';

export type Migration = {
  version: number;
  description: string;
  up: (db: SQLiteDatabase) => Promise<void>;
};

const MIGRATIONS: Migration[] = [
  migration001Initial,
  migration002SeedFoodItems,
  migration003Races,
  migration004Runtime,
  migration005EventFeedback,
];

export async function runMigrations(db: SQLiteDatabase): Promise<number> {
  const before = await getCurrentVersion(db);
  let applied = before;

  for (const migration of MIGRATIONS) {
    if (migration.version <= applied) continue;

    await db.withTransactionAsync(async () => {
      await migration.up(db);
      await db.execAsync(`PRAGMA user_version = ${migration.version}`);
    });
    applied = migration.version;
  }

  return applied;
}

async function getCurrentVersion(db: SQLiteDatabase): Promise<number> {
  const row = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version');
  return row?.user_version ?? 0;
}
