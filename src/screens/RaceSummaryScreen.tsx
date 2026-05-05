import { useLocalSearchParams } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';

// TODO J3 — résumé minimal (durée, intakes done/skipped/non répondus, fluid, check-ins, liste event-par-event)
export default function RaceSummaryScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Résumé course</Text>
      <Text style={styles.line}>race id: {id}</Text>
      <Text style={styles.todo}>TODO J3 — stats à venir</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, backgroundColor: '#fff' },
  title: { fontSize: 22, fontWeight: '700', marginBottom: 12 },
  line: { fontSize: 14, marginBottom: 4, fontFamily: 'monospace' },
  todo: { marginTop: 24, color: '#888', fontStyle: 'italic' },
});
