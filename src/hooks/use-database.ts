import type { SQLiteDatabase } from 'expo-sqlite';
import { useEffect, useState } from 'react';

import { getDatabase } from '../db/database';

type DbState =
  | { status: 'loading'; db: null; error: null }
  | { status: 'ready'; db: SQLiteDatabase; error: null }
  | { status: 'error'; db: null; error: Error };

export function useDatabase(): DbState {
  const [state, setState] = useState<DbState>({ status: 'loading', db: null, error: null });

  useEffect(() => {
    let cancelled = false;
    getDatabase()
      .then((db) => {
        if (!cancelled) setState({ status: 'ready', db, error: null });
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          const error = err instanceof Error ? err : new Error(String(err));
          setState({ status: 'error', db: null, error });
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return state;
}
