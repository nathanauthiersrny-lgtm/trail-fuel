import * as Haptics from 'expo-haptics';
import * as Notifications from 'expo-notifications';
import { router } from 'expo-router';
import { Platform, ToastAndroid } from 'react-native';

import { getDatabase } from '../../db/database';
import { getByEventId } from '../../db/repos/planned-event-repo';
import { logEvent } from '../race-runtime/log-event';

import { ACTION_DONE, ACTION_SKIP } from './category';
import type { EventNotificationData } from './format-content';
import { emitLogInserted } from './log-emitter';

type NotifResponse = Notifications.NotificationResponse;

let subscription: Notifications.Subscription | null = null;
let coldStartHandled = false;
const handledResponseIds = new Set<string>();

function extractData(response: NotifResponse): EventNotificationData | null {
  const data = response.notification.request.content.data as
    | Partial<EventNotificationData>
    | undefined;
  if (!data || typeof data.event_id !== 'string' || typeof data.race_id !== 'string') {
    return null;
  }
  return data as EventNotificationData;
}

async function handleResponse(response: NotifResponse): Promise<void> {
  const responseId = response.notification.request.identifier;
  if (handledResponseIds.has(responseId)) return;
  handledResponseIds.add(responseId);

  const data = extractData(response);
  if (!data) {
    console.warn('[notif-handler] response without event data, ignoring');
    return;
  }

  const action = response.actionIdentifier;
  const now = Date.now();

  if (action === ACTION_DONE || action === ACTION_SKIP) {
    const status = action === ACTION_DONE ? 'done' : 'skipped';
    try {
      const db = await getDatabase();
      // The event may not exist in DB (canary fake events, or a race that was
      // wiped between schedule and fire). Inserting would trip the FK on
      // event_logs.planned_event_id → planned_events.id. Skip cleanly.
      const planned = await getByEventId(db, data.event_id);
      if (!planned) {
        console.warn('[notif-handler] no planned_event for', data.event_id);
        if (Platform.OS === 'android') {
          ToastAndroid.show('Notif orpheline (ignorée)', ToastAndroid.SHORT);
        }
        return;
      }
      await logEvent({
        db,
        raceId: data.race_id,
        plannedEventId: data.event_id,
        status,
        now,
      });
      emitLogInserted(data.race_id);
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      if (Platform.OS === 'android') {
        ToastAndroid.show(
          status === 'done' ? 'Pris ✓' : 'Passé',
          ToastAndroid.SHORT,
        );
      }
    } catch (err) {
      console.error('[notif-handler] logEvent failed', err);
      if (Platform.OS === 'android') {
        ToastAndroid.show('Erreur log', ToastAndroid.SHORT);
      }
    }
    return;
  }

  // Default action (notif body tap) → open runtime screen focused on this event.
  router.navigate({
    pathname: '/race/[id]',
    params: { id: data.race_id, focus: data.event_id },
  });
}

/**
 * Mounts the global notification response listener and replays any cold-start
 * tap (when the app was launched by a notification interaction). Idempotent —
 * safe to call from `_layout.tsx` mount.
 */
export function mountNotificationHandler(): () => void {
  if (!subscription) {
    subscription = Notifications.addNotificationResponseReceivedListener((response) => {
      void handleResponse(response);
    });
  }

  if (!coldStartHandled) {
    coldStartHandled = true;
    void Notifications.getLastNotificationResponseAsync().then((response) => {
      if (response) void handleResponse(response);
    });
  }

  return () => {
    subscription?.remove();
    subscription = null;
  };
}
