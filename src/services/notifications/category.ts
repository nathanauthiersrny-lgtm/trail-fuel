import * as Notifications from 'expo-notifications';

export const INTAKE_ACTION_CATEGORY = 'intake_action';

export const ACTION_DONE = 'done';
export const ACTION_SKIP = 'skip';

/**
 * Idempotent: declares the `intake_action` category with two action buttons
 * (Done / Skip) that log directly without opening the app.
 *
 * Used for `intake` and `fluid_reminder` notifications. `check_in` and
 * `aid_station` don't get action buttons — taps open the in-app screen.
 */
export async function registerNotificationCategories(): Promise<void> {
  await Notifications.setNotificationCategoryAsync(INTAKE_ACTION_CATEGORY, [
    {
      identifier: ACTION_DONE,
      buttonTitle: '✓ Fait',
      options: { opensAppToForeground: false },
    },
    {
      identifier: ACTION_SKIP,
      buttonTitle: '✗ Passer',
      options: { opensAppToForeground: false },
    },
  ]);
}
