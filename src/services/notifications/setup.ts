import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

export type NotificationSetupResult = {
  permissionGranted: boolean;
};

/**
 * Idempotent: requests notification permission and (on Android) registers the
 * three channels used by the runtime: `intake`, `checkin`, `alert`.
 *
 * Safe to call at app boot AND defensively before scheduling — Expo deduplicates
 * channel registration internally, and permission requests are no-ops once granted.
 */
export async function ensurePermissionsAndChannels(): Promise<NotificationSetupResult> {
  const permission = await Notifications.requestPermissionsAsync();
  const permissionGranted = permission.granted ?? permission.status === 'granted';

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('intake', {
      name: 'Intake nutrition',
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 250, 250, 250],
      sound: 'default',
    });

    await Notifications.setNotificationChannelAsync('checkin', {
      name: 'Check-in ressenti',
      importance: Notifications.AndroidImportance.DEFAULT,
      vibrationPattern: [0, 500],
    });

    await Notifications.setNotificationChannelAsync('alert', {
      name: 'Alerte dérive',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 500, 250, 500, 250, 500],
      sound: 'default',
    });
  }

  return { permissionGranted };
}
