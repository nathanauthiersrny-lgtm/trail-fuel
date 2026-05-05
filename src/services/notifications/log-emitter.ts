type Listener = (raceId: string) => void;

const listeners = new Set<Listener>();

/**
 * Lightweight in-process pub/sub. The notification-handler emits when a
 * notification action ("Done"/"Skip") inserts an event_log; RaceRuntimeScreen
 * subscribes so its UI reflects the change without needing to poll the DB.
 *
 * Stays in-process — no React-context or Reanimated worklet plumbing needed.
 */
export function subscribeLogInserted(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function emitLogInserted(raceId: string): void {
  for (const listener of listeners) {
    try {
      listener(raceId);
    } catch (err) {
      console.error('[log-emitter] listener threw', err);
    }
  }
}
