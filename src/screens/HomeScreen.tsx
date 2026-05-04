import { Link, router } from 'expo-router';
import { Alert, DevSettings, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { resetDatabaseForTests } from '../db/database';

export default function HomeScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Trail Fuel</Text>
      <Text style={styles.subtitle}>Phase 2 — création de course</Text>

      {/* Primary action */}
      <TouchableOpacity
        style={styles.createBtn}
        onPress={() => router.push('/race-creation')}
        activeOpacity={0.8}
      >
        <Text style={styles.createBtnTxt}>＋ Nouvelle sortie</Text>
      </TouchableOpacity>

      <View style={styles.linkGroup}>
        <Link href="/profile" style={styles.link}>
          → Profil
        </Link>
        <Link href="/food-items" style={styles.link}>
          → Bibliothèque FoodItem
        </Link>
      </View>

      {__DEV__ ? <DevWipeDbButton /> : null}
    </View>
  );
}

function DevWipeDbButton() {
  const handleWipe = () => {
    Alert.alert(
      'Wipe DB ?',
      'Supprime trail-fuel.db et reload l\'app. Action dev only.',
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Wipe',
          style: 'destructive',
          onPress: async () => {
            try {
              await resetDatabaseForTests();
              DevSettings.reload();
            } catch (err) {
              Alert.alert('Erreur wipe', String(err));
            }
          },
        },
      ],
    );
  };

  return (
    <TouchableOpacity style={styles.devButton} onPress={handleWipe}>
      <Text style={styles.devButtonText}>[DEV] Wipe DB + reload</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 24,
    paddingTop: 64,
    backgroundColor: '#fff',
  },
  title: {
    fontSize: 32,
    fontWeight: '700',
  },
  subtitle: {
    fontSize: 14,
    color: '#888',
    marginBottom: 32,
  },
  createBtn: {
    backgroundColor: '#FF6B35',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    marginBottom: 28,
  },
  createBtnTxt: {
    fontSize: 18,
    fontWeight: '700',
    color: '#fff',
  },
  linkGroup: {
    gap: 16,
  },
  link: {
    fontSize: 18,
    color: '#0a7ea4',
    paddingVertical: 12,
  },
  devButton: {
    marginTop: 'auto',
    marginBottom: 24,
    alignSelf: 'flex-start',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: '#cc3333',
    borderRadius: 4,
    borderStyle: 'dashed',
  },
  devButtonText: {
    fontSize: 12,
    color: '#cc3333',
    fontFamily: 'monospace',
  },
});
