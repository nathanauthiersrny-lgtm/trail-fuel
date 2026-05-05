import * as Haptics from 'expo-haptics';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { EventLogFeeling } from '../../models/event-log';

export type CheckInCardProps = {
  /** Set when the user already responded — disables buttons and highlights the chosen feeling. */
  alreadyAnswered?: EventLogFeeling;
  onFeeling: (feeling: EventLogFeeling) => void;
};

const FEELINGS: { id: EventLogFeeling; emoji: string; label: string }[] = [
  { id: 'good', emoji: '😀', label: 'OK' },
  { id: 'meh', emoji: '😐', label: 'Bof' },
  { id: 'bad', emoji: '😖', label: 'Dur' },
];

const COLOR_GOOD = '#1f9d55';
const COLOR_MEH = '#d99e00';
const COLOR_BAD = '#cc3333';

const FEELING_COLOR: Record<EventLogFeeling, string> = {
  good: COLOR_GOOD,
  meh: COLOR_MEH,
  bad: COLOR_BAD,
};

function tapHaptics(): void {
  void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
}

export function CheckInCard({ alreadyAnswered, onFeeling }: CheckInCardProps) {
  const handlePress = (feeling: EventLogFeeling) => {
    if (alreadyAnswered) return;
    tapHaptics();
    onFeeling(feeling);
  };

  return (
    <View style={styles.card}>
      <Text style={styles.title}>Comment ça va ?</Text>
      <View style={styles.row}>
        {FEELINGS.map((f) => {
          const selected = alreadyAnswered === f.id;
          const dimmed = alreadyAnswered !== undefined && !selected;
          return (
            <Pressable
              key={f.id}
              onPress={() => handlePress(f.id)}
              disabled={alreadyAnswered !== undefined}
              accessibilityRole="button"
              accessibilityLabel={f.label}
              style={({ pressed }) => [
                styles.button,
                selected && { borderColor: FEELING_COLOR[f.id], borderWidth: 3 },
                dimmed && styles.buttonDimmed,
                pressed && !alreadyAnswered && styles.buttonPressed,
              ]}
            >
              <Text style={styles.emoji}>{f.emoji}</Text>
              <Text style={styles.label}>{f.label}</Text>
            </Pressable>
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
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111',
    marginBottom: 16,
    textAlign: 'center',
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  button: {
    flex: 1,
    minHeight: 80,
    borderRadius: 12,
    backgroundColor: '#f4f4f4',
    borderWidth: 1,
    borderColor: '#e0e0e0',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 8,
  },
  buttonDimmed: {
    opacity: 0.4,
  },
  buttonPressed: {
    backgroundColor: '#e8e8e8',
  },
  emoji: {
    fontSize: 36,
    lineHeight: 42,
  },
  label: {
    fontSize: 12,
    color: '#666',
    marginTop: 2,
  },
});
