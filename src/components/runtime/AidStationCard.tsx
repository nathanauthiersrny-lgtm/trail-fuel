import { StyleSheet, Text, View } from 'react-native';

import type { AidStation } from '../../models/aid-station';
import type { AidPhase } from '../../models/planned-event';

export type AidStationCardProps = {
  station: AidStation;
  phase: AidPhase;
};

type Availability = { label: string; key: keyof AidStation['available'] };

const AVAILABILITIES: Availability[] = [
  { label: 'Eau', key: 'water' },
  { label: 'Iso', key: 'isotonic' },
  { label: 'Solide', key: 'solid_food' },
  { label: 'Refill', key: 'refill_possible' },
];

export function AidStationCard({ station, phase }: AidStationCardProps) {
  const heading = phase === 'approaching' ? 'Ravito dans ~3 min' : 'Ravito atteint';
  const name = station.name ?? `Ravito km ${station.at_km}`;

  return (
    <View style={styles.card}>
      <Text style={styles.heading}>{heading}</Text>
      <Text style={styles.title}>{name}</Text>
      <Text style={styles.km}>km {station.at_km}</Text>

      <View style={styles.chips}>
        {AVAILABILITIES.map((a) => {
          const ok = station.available[a.key];
          return (
            <View
              key={a.key}
              style={[styles.chip, ok ? styles.chipOk : styles.chipKo]}
            >
              <Text style={[styles.chipText, ok ? styles.chipTextOk : styles.chipTextKo]}>
                {ok ? '✓' : '✗'} {a.label}
              </Text>
            </View>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 20,
    marginVertical: 8,
    borderLeftWidth: 4,
    borderLeftColor: '#4CAF50',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 3,
  },
  heading: {
    fontSize: 12,
    fontWeight: '700',
    color: '#4CAF50',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 6,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111',
  },
  km: {
    fontSize: 14,
    color: '#555',
    marginTop: 2,
    marginBottom: 12,
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    borderWidth: 1,
  },
  chipOk: {
    backgroundColor: '#e8f5e9',
    borderColor: '#4CAF50',
  },
  chipKo: {
    backgroundColor: '#fafafa',
    borderColor: '#ccc',
  },
  chipText: {
    fontSize: 12,
    fontWeight: '600',
  },
  chipTextOk: {
    color: '#1f7a32',
  },
  chipTextKo: {
    color: '#999',
  },
});
