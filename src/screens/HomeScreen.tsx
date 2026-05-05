import { Link, router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Alert, DevSettings, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { resetDatabaseForTests } from '../db/database';
import { listRaces } from '../db/repos/race-repo';
import { useDatabase } from '../hooks/use-database';
import type { Race } from '../models/race';

export default function HomeScreen() {
  const dbState = useDatabase();
  const [activeRace, setActiveRace] = useState<Race | null>(null);

  useFocusEffect(
    useCallback(() => {
      if (dbState.status !== 'ready') return;
      let cancelled = false;
      void listRaces(dbState.db).then((races) => {
        if (cancelled) return;
        const next =
          races.find((r) => r.status === 'in_progress') ??
          races.find((r) => r.status === 'planned') ??
          null;
        setActiveRace(next);
      });
      return () => {
        cancelled = true;
      };
    }, [dbState]),
  );

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Trail Fuel</Text>
      <Text style={styles.subtitle}>Phase 3 — runtime course</Text>

      {activeRace ? <ActiveRaceBanner race={activeRace} /> : null}

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

      {__DEV__ ? (
        <View style={styles.devGroup}>
          <DevNotifTestButton />
          <DevWipeDbButton />
        </View>
      ) : null}
    </View>
  );
}

function ActiveRaceBanner({ race }: { race: Race }) {
  const isInProgress = race.status === 'in_progress';
  return (
    <TouchableOpacity
      style={[styles.activeBanner, isInProgress && styles.activeBannerInProgress]}
      onPress={() =>
        router.push({ pathname: '/race/[id]', params: { id: race.id } })
      }
      activeOpacity={0.8}
    >
      <Text style={[styles.activeLabel, isInProgress && styles.activeLabelInProgress]}>
        {isInProgress ? 'Course en cours' : 'Course prête'}
      </Text>
      <Text style={styles.activeName}>{race.name ?? 'Sortie sans nom'}</Text>
      <Text style={styles.activeCta}>
        {isInProgress ? 'Reprendre →' : 'Démarrer →'}
      </Text>
    </TouchableOpacity>
  );
}

function DevNotifTestButton() {
  return (
    <TouchableOpacity
      style={styles.devButton}
      onPress={() => router.push('/dev/notification-test')}
    >
      <Text style={styles.devButtonText}>[DEV] Notif test</Text>
    </TouchableOpacity>
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
    marginBottom: 24,
  },
  activeBanner: {
    backgroundColor: '#e8f5e9',
    borderLeftWidth: 4,
    borderLeftColor: '#1f9d55',
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
  },
  activeBannerInProgress: {
    backgroundColor: '#fff8e1',
    borderLeftColor: '#FF6B35',
  },
  activeLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#1f7a32',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  activeLabelInProgress: {
    color: '#cc5200',
  },
  activeName: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111',
    marginBottom: 6,
  },
  activeCta: {
    fontSize: 14,
    color: '#444',
    fontWeight: '600',
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
  devGroup: {
    marginTop: 'auto',
    marginBottom: 24,
    gap: 8,
    alignItems: 'flex-start',
  },
  devButton: {
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
