import { Link, router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Alert, DevSettings, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { resetDatabaseForTests } from '../db/database';
import { listRaces } from '../db/repos/race-repo';
import { useDatabase } from '../hooks/use-database';
import type { Race } from '../models/race';

const RECENT_RACE_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;

export default function HomeScreen() {
  const dbState = useDatabase();
  const [activeRace, setActiveRace] = useState<Race | null>(null);

  useFocusEffect(
    useCallback(() => {
      if (dbState.status !== 'ready') return;
      let cancelled = false;
      void listRaces(dbState.db).then((races) => {
        if (cancelled) return;
        const now = Date.now();
        const next =
          races.find((r) => r.status === 'in_progress') ??
          races.find((r) => r.status === 'planned') ??
          races.find(
            (r) =>
              (r.status === 'completed' || r.status === 'abandoned') &&
              r.ended_at !== null &&
              now - r.ended_at < RECENT_RACE_WINDOW_MS,
          ) ??
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

type BannerVariant = {
  bannerStyle: 'planned' | 'in_progress' | 'completed' | 'abandoned';
  label: string;
  cta: string;
  href: { pathname: '/race/[id]' | '/race/[id]/summary'; params: { id: string } };
};

function bannerVariant(race: Race): BannerVariant {
  switch (race.status) {
    case 'in_progress':
      return {
        bannerStyle: 'in_progress',
        label: 'Course en cours',
        cta: 'Reprendre →',
        href: { pathname: '/race/[id]', params: { id: race.id } },
      };
    case 'planned':
      return {
        bannerStyle: 'planned',
        label: 'Course prête',
        cta: 'Démarrer →',
        href: { pathname: '/race/[id]', params: { id: race.id } },
      };
    case 'completed':
      return {
        bannerStyle: 'completed',
        label: 'Dernière course',
        cta: 'Voir le résumé →',
        href: { pathname: '/race/[id]/summary', params: { id: race.id } },
      };
    case 'abandoned':
      return {
        bannerStyle: 'abandoned',
        label: 'Dernière course (abandonnée)',
        cta: 'Voir le résumé →',
        href: { pathname: '/race/[id]/summary', params: { id: race.id } },
      };
  }
}

function ActiveRaceBanner({ race }: { race: Race }) {
  const variant = bannerVariant(race);
  const bannerStyle =
    variant.bannerStyle === 'in_progress'
      ? styles.activeBannerInProgress
      : variant.bannerStyle === 'completed'
        ? styles.activeBannerCompleted
        : variant.bannerStyle === 'abandoned'
          ? styles.activeBannerAbandoned
          : styles.activeBannerPlanned;
  const labelStyle =
    variant.bannerStyle === 'in_progress'
      ? styles.activeLabelInProgress
      : variant.bannerStyle === 'completed'
        ? styles.activeLabelCompleted
        : variant.bannerStyle === 'abandoned'
          ? styles.activeLabelAbandoned
          : styles.activeLabelPlanned;
  return (
    <TouchableOpacity
      style={[styles.activeBanner, bannerStyle]}
      onPress={() => router.push(variant.href)}
      activeOpacity={0.8}
    >
      <Text style={[styles.activeLabel, labelStyle]}>{variant.label}</Text>
      <Text style={styles.activeName}>{race.name ?? 'Sortie sans nom'}</Text>
      <Text style={styles.activeCta}>{variant.cta}</Text>
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
    borderLeftWidth: 4,
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
  },
  activeBannerPlanned: {
    backgroundColor: '#e8f5e9',
    borderLeftColor: '#1f9d55',
  },
  activeBannerInProgress: {
    backgroundColor: '#fff8e1',
    borderLeftColor: '#FF6B35',
  },
  activeBannerCompleted: {
    backgroundColor: '#e3f2fd',
    borderLeftColor: '#0a7ea4',
  },
  activeBannerAbandoned: {
    backgroundColor: '#fafafa',
    borderLeftColor: '#999',
  },
  activeLabel: {
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  activeLabelPlanned: {
    color: '#1f7a32',
  },
  activeLabelInProgress: {
    color: '#cc5200',
  },
  activeLabelCompleted: {
    color: '#075f7d',
  },
  activeLabelAbandoned: {
    color: '#666',
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
