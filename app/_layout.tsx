import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';

export default function RootLayout() {
  return (
    <>
      <Stack>
        <Stack.Screen name="index" options={{ title: 'Trail Fuel' }} />
        <Stack.Screen name="profile" options={{ title: 'Profil' }} />
        <Stack.Screen name="food-items" options={{ title: 'Bibliothèque' }} />
        <Stack.Screen name="food-item-form" options={{ title: 'Item' }} />
        <Stack.Screen name="race-creation" options={{ title: 'Nouvelle sortie' }} />
        <Stack.Screen name="race-preview" options={{ title: 'Aperçu' }} />
      </Stack>
      <StatusBar style="auto" />
    </>
  );
}
