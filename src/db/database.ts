import * as SQLite from 'expo-sqlite';

import { runMigrations } from './migrations';

const DB_NAME = 'trail-fuel.db';

let _db: SQLite.SQLiteDatabase | null = null;
let _readyPromise: Promise<SQLite.SQLiteDatabase> | null = null;

export async function getDatabase(): Promise<SQLite.SQLiteDatabase> {
  if (_db) return _db;
  if (_readyPromise) return _readyPromise;

  _readyPromise = (async () => {
    const db = await SQLite.openDatabaseAsync(DB_NAME);
    await db.execAsync('PRAGMA journal_mode = WAL');
    await db.execAsync('PRAGMA foreign_keys = ON');
    await runMigrations(db);
    _db = db;
    return db;
  })();

  return _readyPromise;
}

export async function resetDatabaseForTests(): Promise<void> {
  if (_db) {
    await _db.closeAsync();
    _db = null;
  }
  _readyPromise = null;
  await SQLite.deleteDatabaseAsync(DB_NAME);
}
