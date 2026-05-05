import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { mountNotificationHandler } from '@/services/notifications/notification-handler';

export default function RootLayout() {
  useEffect(() => mountNotificationHandler(), []);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <Stack>
        <Stack.Screen name="index" options={{ title: 'Trail Fuel' }} />
        <Stack.Screen name="profile" options={{ title: 'Profil' }} />
        <Stack.Screen name="food-items" options={{ title: 'Bibliothèque' }} />
        <Stack.Screen name="food-item-form" options={{ title: 'Item' }} />
        <Stack.Screen name="race-creation" options={{ title: 'Nouvelle sortie' }} />
        <Stack.Screen name="race-preview" options={{ title: 'Aperçu' }} />
        <Stack.Screen name="race/[id]/index" options={{ title: 'Course' }} />
        <Stack.Screen name="race/[id]/summary" options={{ title: 'Résumé' }} />
        <Stack.Screen name="dev/notification-test" options={{ title: 'Notif test' }} />
      </Stack>
      <StatusBar style="auto" />
    </GestureHandlerRootView>
  );
}
