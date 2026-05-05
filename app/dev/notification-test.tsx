import * as Notifications from 'expo-notifications';
import { Redirect } from 'expo-router';
import React, { useState } from 'react';
import {
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

import type { FoodItem } from '../../src/models/food-item';
import type { PlannedEvent } from '../../src/models/planned-event';
import { registerNotificationCategories } from '../../src/services/notifications/category';
import { scheduleEventBatch } from '../../src/services/notifications/schedule-batch';
import { ensurePermissionsAndChannels } from '../../src/services/notifications/setup';

type LogEntry = { ts: string; line: string };

export default function DevNotificationTest() {
  const [log, setLog] = useState<LogEntry[]>([]);

  if (!__DEV__) return <Redirect href="/" />;

  const append = (line: string) => {
    const ts = new Date().toLocaleTimeString();
    setLog((prev) => [{ ts, line }, ...prev].slice(0, 50));
    console.log(`[notif-test ${ts}] ${line}`);
  };

  const handleRequestPermission = async () => {
    try {
      const result = await Notifications.requestPermissionsAsync();
      append(
        `Permission: status=${result.status} granted=${result.granted} canAskAgain=${result.canAskAgain}`,
      );
    } catch (err) {
      append(`Permission ERROR: ${String(err)}`);
    }
  };

  const handleCreateChannel = async () => {
    if (Platform.OS !== 'android') {
      append('Channel: skipped (not Android)');
      return;
    }
    try {
      await Notifications.setNotificationChannelAsync('intake', {
        name: 'Intake nutrition',
        importance: Notifications.AndroidImportance.HIGH,
        vibrationPattern: [0, 250, 250, 250],
        sound: 'default',
      });
      append('Channel "intake" créé');
    } catch (err) {
      append(`Channel ERROR: ${String(err)}`);
    }
  };

  const scheduleAt = async (offsetMs: number, label: string) => {
    const trigger: Notifications.DateTriggerInput = {
      type: Notifications.SchedulableTriggerInputTypes.DATE,
      date: new Date(Date.now() + offsetMs),
      channelId: 'intake',
    };
    return Notifications.scheduleNotificationAsync({
      content: {
        title: 'Trail Fuel test',
        body: `Si tu vois ça, les notifs marchent (${label})`,
      },
      trigger,
    });
  };

  const handleSchedule30s = async () => {
    try {
      const id = await scheduleAt(30_000, '+30s');
      append(`Scheduled +30s → id=${id}`);
    } catch (err) {
      append(`Schedule ERROR: ${String(err)}`);
    }
  };

  const handleScheduleBatch = async () => {
    try {
      const id1 = await scheduleAt(10_000, '+10s');
      const id2 = await scheduleAt(20_000, '+20s');
      const id3 = await scheduleAt(30_000, '+30s');
      append(`Batch scheduled → [${id1}, ${id2}, ${id3}]`);
    } catch (err) {
      append(`Batch ERROR: ${String(err)}`);
    }
  };

  const handleListScheduled = async () => {
    try {
      const all = await Notifications.getAllScheduledNotificationsAsync();
      append(`Scheduled count=${all.length}`);
      for (const n of all) {
        append(`  • ${n.identifier} — ${n.content.title}`);
      }
    } catch (err) {
      append(`List ERROR: ${String(err)}`);
    }
  };

  const handleCancelAll = async () => {
    try {
      await Notifications.cancelAllScheduledNotificationsAsync();
      append('Toutes notifs annulées');
    } catch (err) {
      append(`Cancel ERROR: ${String(err)}`);
    }
  };

  const handleRunPipelineTest = async () => {
    try {
      const setup = await ensurePermissionsAndChannels();
      append(`Setup: granted=${setup.permissionGranted}`);
      await registerNotificationCategories();
      append('Category intake_action registered');

      const fakeFood: FoodItem = {
        id: 'fake-gel-pipeline',
        name: 'Test Gel',
        type: 'gel',
        carbs_g: 22,
        sodium_mg: 30,
        weight_g: 60,
        is_seed: false,
      };

      const raceId = `pipeline-${Date.now()}`;
      const events: PlannedEvent[] = [
        {
          id: `${raceId}::event-0`,
          race_id: raceId,
          scheduled_at_minute: 10 / 60,
          type: 'intake',
          payload: { food_item_id: fakeFood.id, quantity: 1 },
        },
        {
          id: `${raceId}::event-1`,
          race_id: raceId,
          scheduled_at_minute: 20 / 60,
          type: 'check_in',
          payload: {},
        },
        {
          id: `${raceId}::event-2`,
          race_id: raceId,
          scheduled_at_minute: 30 / 60,
          type: 'fluid_reminder',
          payload: { target_volume_ml: 250 },
        },
      ];

      const now = Date.now();
      const result = await scheduleEventBatch({
        events,
        foodItemsById: { [fakeFood.id]: fakeFood },
        aidStationsById: {},
        startedAt: now,
        now,
      });
      append(
        `Pipeline: scheduled=${result.scheduled.length} skipped=${result.skipped.length}`,
      );
      for (const s of result.scheduled) {
        append(`  + ${s.event_id} → notif=${s.notification_id.slice(0, 8)}…`);
      }
      for (const s of result.skipped) {
        append(`  - ${s.event_id} skipped: ${s.reason} (${s.detail ?? ''})`);
      }
    } catch (err) {
      append(`Pipeline ERROR: ${String(err)}`);
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>Notif test — dev sandbox</Text>
      <Text style={styles.subtitle}>
        Canary pour valider permissions, channel et scheduling avant la
        phase 3.
      </Text>

      <Button label="1. Demander permission notifs" onPress={handleRequestPermission} />
      <Button label="2. Créer le channel intake (Android)" onPress={handleCreateChannel} />
      <Button label="3. Programmer une notif dans 30s" onPress={handleSchedule30s} />
      <Button label="4. Programmer 3 notifs en batch (10s, 20s, 30s)" onPress={handleScheduleBatch} />
      <Button label="5. Lister notifs programmées" onPress={handleListScheduled} />
      <Button label="6. Annuler toutes" onPress={handleCancelAll} variant="danger" />
      <Button
        label="7. Pipeline test (3 events @ +10/+20/+30s)"
        onPress={handleRunPipelineTest}
      />

      <Text style={styles.logTitle}>Log</Text>
      <View style={styles.logBox}>
        {log.length === 0 ? (
          <Text style={styles.logEmpty}>(aucun event pour l'instant)</Text>
        ) : (
          log.map((entry, idx) => (
            <Text key={idx} style={styles.logLine}>
              [{entry.ts}] {entry.line}
            </Text>
          ))
        )}
      </View>
    </ScrollView>
  );
}

function Button({
  label,
  onPress,
  variant,
}: {
  label: string;
  onPress: () => void;
  variant?: 'danger';
}) {
  return (
    <TouchableOpacity
      style={[styles.button, variant === 'danger' && styles.buttonDanger]}
      onPress={onPress}
      activeOpacity={0.8}
    >
      <Text
        style={[
          styles.buttonText,
          variant === 'danger' && styles.buttonTextDanger,
        ]}
      >
        {label}
      </Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 16,
    paddingBottom: 64,
    backgroundColor: '#fff',
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 13,
    color: '#666',
    marginBottom: 20,
  },
  button: {
    backgroundColor: '#0a7ea4',
    borderRadius: 8,
    paddingVertical: 14,
    paddingHorizontal: 16,
    marginBottom: 10,
  },
  buttonDanger: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#cc3333',
  },
  buttonText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
  },
  buttonTextDanger: {
    color: '#cc3333',
  },
  logTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginTop: 24,
    marginBottom: 8,
  },
  logBox: {
    backgroundColor: '#111',
    borderRadius: 8,
    padding: 12,
    minHeight: 120,
  },
  logEmpty: {
    color: '#666',
    fontFamily: 'monospace',
    fontSize: 12,
  },
  logLine: {
    color: '#0f0',
    fontFamily: 'monospace',
    fontSize: 11,
    marginBottom: 2,
  },
});
