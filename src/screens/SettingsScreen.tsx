import { Link } from 'expo-router';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

export default function SettingsScreen() {
  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.section}>
        <Text style={styles.sectionLabel}>Knowledge pack</Text>
        <Link href="/settings/rules" style={styles.row}>
          <Text style={styles.rowLabel}>Règles nutritionnelles</Text>
          <Text style={styles.rowChevron}>›</Text>
        </Link>
        <Text style={styles.sectionHint}>
          Active ou désactive individuellement chaque règle qui pilote le plan
          de nutrition (modificateurs température/humidité, restrictions de
          terrain, look-ahead, etc.).
        </Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f7f7f7',
  },
  content: {
    padding: 16,
    paddingBottom: 48,
  },
  section: {
    marginBottom: 24,
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#888',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#fff',
    borderRadius: 10,
    paddingVertical: 16,
    paddingHorizontal: 14,
    marginBottom: 8,
  },
  rowLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: '#222',
  },
  rowChevron: {
    fontSize: 20,
    color: '#aaa',
    fontWeight: '600',
  },
  sectionHint: {
    fontSize: 12,
    color: '#888',
    paddingHorizontal: 4,
    lineHeight: 16,
  },
});
