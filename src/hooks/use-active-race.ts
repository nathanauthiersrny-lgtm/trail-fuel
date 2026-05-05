import { useFocusEffect } from 'expo-router';
import type { SQLiteDatabase } from 'expo-sqlite';
import { useCallback, useEffect, useRef, useState } from 'react';

import {
  listByRace as listLogsByRace,
} from '../db/repos/event-log-repo';
import {
  listByRace as listEventsByRace,
  type PersistedPlannedEvent,
} from '../db/repos/planned-event-repo';
import { getRace } from '../db/repos/race-repo';
import {
  computeRuntimeCursor,
  type RuntimeCursor,
} from '../engine/runtime/cursor';
import type { EventLog } from '../models/event-log';
import type { Race } from '../models/race';

import { useDatabase } from './use-database';

type LoadedData = {
  race: Race;
  events: PersistedPlannedEvent[];
  logs: EventLog[];
};

export type UseActiveRaceState =
  | { status: 'loading'; race: null; cursor: null; elapsedMs: 0; now: number; refresh: () => Promise<void>; error: null }
  | { status: 'not_found'; race: null; cursor: null; elapsedMs: 0; now: number; refresh: () => Promise<void>; error: null }
  | { status: 'error'; race: null; cursor: null; elapsedMs: 0; now: number; refresh: () => Promise<void>; error: Error }
  | {
      status: 'ready';
      race: Race;
      cursor: RuntimeCursor;
      elapsedMs: number;
      now: number;
      refresh: () => Promise<void>;
      error: null;
    };

async function loadAll(db: SQLiteDatabase, raceId: string): Promise<LoadedData | null> {
  const race = await getRace(db, raceId);
  if (!race) return null;
  const [events, logs] = await Promise.all([
    listEventsByRace(db, raceId),
    listLogsByRace(db, raceId),
  ]);
  return { race, events, logs };
}

/**
 * Loads a race + its planned events + event logs from the DB and exposes a
 * cursor (past / current / upcoming) recomputed every second while the race
 * is `in_progress`. Re-fetches on focus and exposes a manual `refresh()` for
 * post-action invalidation (e.g. after a swipe logs an event).
 */
export function useActiveRace(raceId: string | null | undefined): UseActiveRaceState {
  const dbState = useDatabase();
  const [data, setData] = useState<LoadedData | null | 'not_found'>(null);
  const [error, setError] = useState<Error | null>(null);
  const [now, setNow] = useState<number>(() => Date.now());
  const inFlight = useRef<Promise<void> | null>(null);

  const refresh = useCallback(async (): Promise<void> => {
    if (dbState.status !== 'ready' || !raceId) return;
    if (inFlight.current) return inFlight.current;
    const db = dbState.db;
    const promise = (async () => {
      try {
        const loaded = await loadAll(db, raceId);
        setData(loaded ?? 'not_found');
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err : new Error(String(err)));
      } finally {
        inFlight.current = null;
      }
    })();
    inFlight.current = promise;
    return promise;
  }, [dbState, raceId]);

  // Initial fetch + re-fetch when the underlying race id changes.
  useEffect(() => {
    if (dbState.status !== 'ready' || !raceId) return;
    setData(null);
    setError(null);
    void refresh();
  }, [dbState.status, raceId, refresh]);

  // Re-fetch on screen focus so swipes that log events on the same screen,
  // and notif actions that fire while the screen is mounted, are reflected.
  useFocusEffect(
    useCallback(() => {
      void refresh();
    }, [refresh]),
  );

  // Tick once per second while the race is running so the cursor advances
  // and elapsedMs in the header keeps moving. Skipped for planned/ended races.
  const isRunning =
    data && data !== 'not_found' && data.race.status === 'in_progress';
  useEffect(() => {
    if (!isRunning) return;
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, [isRunning]);

  // ─── Derive returned state ───────────────────────────────────────────────

  if (dbState.status === 'loading' || (data === null && error === null)) {
    return {
      status: 'loading',
      race: null,
      cursor: null,
      elapsedMs: 0,
      now,
      refresh,
      error: null,
    };
  }

  if (dbState.status === 'error') {
    return {
      status: 'error',
      race: null,
      cursor: null,
      elapsedMs: 0,
      now,
      refresh,
      error: dbState.error,
    };
  }

  if (error) {
    return {
      status: 'error',
      race: null,
      cursor: null,
      elapsedMs: 0,
      now,
      refresh,
      error,
    };
  }

  if (data === 'not_found' || !raceId) {
    return {
      status: 'not_found',
      race: null,
      cursor: null,
      elapsedMs: 0,
      now,
      refresh,
      error: null,
    };
  }

  if (!data) {
    return {
      status: 'loading',
      race: null,
      cursor: null,
      elapsedMs: 0,
      now,
      refresh,
      error: null,
    };
  }

  const cursor = computeRuntimeCursor({
    events: data.events,
    logs: data.logs,
    now,
  });

  const elapsedMs =
    data.race.started_at !== null && data.race.status === 'in_progress'
      ? Math.max(0, now - data.race.started_at)
      : 0;

  return {
    status: 'ready',
    race: data.race,
    cursor,
    elapsedMs,
    now,
    refresh,
    error: null,
  };
}
