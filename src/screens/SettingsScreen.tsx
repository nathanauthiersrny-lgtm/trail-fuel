import { Link } from 'expo-router';
import { useCallback, useState } from 'react';
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import {
  deleteOverlay,
  getOverlayStatus,
  pickAndImportOverlay,
  type OverlayStatus,
} from '../services/knowledge-pack/import-overlay';

export default function SettingsScreen() {
  const [status, setStatus] = useState<OverlayStatus>(() => getOverlayStatus());
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(() => setStatus(getOverlayStatus()), []);

  const handleImport = useCallback(async () => {
    setBusy(true);
    try {
      const result = await pickAndImportOverlay();
      if (result.ok) {
        Alert.alert(
          'Overlay importé',
          `Version ${result.version} (${result.ruleCount} règle${result.ruleCount > 1 ? 's' : ''}).\n\nRedémarre l'app pour appliquer les changements.`,
        );
        refresh();
      } else if (result.error !== 'cancelled') {
        Alert.alert("Import impossible", result.error);
      }
    } finally {
      setBusy(false);
    }
  }, [refresh]);

  const handleDelete = useCallback(() => {
    Alert.alert(
      'Supprimer l\'overlay ?',
      "Le knowledge pack reviendra au bundle d'origine. Redémarre l'app pour appliquer.",
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Supprimer',
          style: 'destructive',
          onPress: () => {
            const result = deleteOverlay();
            if (result.ok) {
              refresh();
            } else {
              Alert.alert('Erreur', result.error ?? 'Suppression échouée');
            }
          },
        },
      ],
    );
  }, [refresh]);

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.section}>
        <Text style={styles.sectionLabel}>Knowledge pack</Text>
        <Link href="/settings/rules" asChild>
          <Pressable style={styles.row}>
            <Text style={styles.rowLabel}>Règles nutritionnelles</Text>
            <Text style={styles.rowChevron}>›</Text>
          </Pressable>
        </Link>
        <Text style={styles.sectionHint}>
          Active ou désactive individuellement chaque règle qui pilote le plan
          de nutrition.
        </Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionLabel}>Overlay</Text>
        <View style={styles.statusRow}>
          <View style={[styles.statusDot, status.present ? styles.statusDotActive : styles.statusDotInactive]} />
          <Text style={styles.statusText}>
            {status.present ? 'Overlay actif' : 'Aucun overlay'}
          </Text>
          {status.present && status.modifiedAt ? (
            <Text style={styles.statusMeta}>
              · importé le {formatDate(status.modifiedAt)}
            </Text>
          ) : null}
        </View>

        <Pressable
          style={({ pressed }) => [
            styles.actionButton,
            pressed && styles.actionButtonPressed,
            busy && styles.actionButtonDisabled,
          ]}
          onPress={handleImport}
          disabled={busy}
        >
          <Text style={styles.actionButtonText}>
            {status.present ? 'Remplacer l\'overlay' : 'Importer un overlay'}
          </Text>
        </Pressable>

        {status.present ? (
          <Pressable
            style={({ pressed }) => [
              styles.actionButton,
              styles.actionButtonDanger,
              pressed && styles.actionButtonPressed,
            ]}
            onPress={handleDelete}
          >
            <Text style={[styles.actionButtonText, styles.actionButtonTextDanger]}>
              Supprimer l'overlay
            </Text>
          </Pressable>
        ) : null}

        <Text style={styles.sectionHint}>
          Un overlay est un fichier JSON produit par le web companion (ou écrit à
          la main) qui ajoute/remplace des règles dans le pack. Format :{' '}
          <Text style={styles.code}>knowledge-pack.json</Text> avec au minimum un
          champ <Text style={styles.code}>version</Text>.
        </Text>
      </View>
    </ScrollView>
  );
}

function formatDate(ms: number): string {
  return new Date(ms).toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
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
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 14,
    marginBottom: 8,
    gap: 8,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  statusDotActive: {
    backgroundColor: '#1f9d55',
  },
  statusDotInactive: {
    backgroundColor: '#bbb',
  },
  statusText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#222',
  },
  statusMeta: {
    fontSize: 12,
    color: '#888',
  },
  actionButton: {
    backgroundColor: '#0a7ea4',
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 16,
    alignItems: 'center',
    marginBottom: 8,
  },
  actionButtonPressed: {
    opacity: 0.75,
  },
  actionButtonDisabled: {
    opacity: 0.5,
  },
  actionButtonDanger: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#cc3333',
  },
  actionButtonText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#fff',
  },
  actionButtonTextDanger: {
    color: '#cc3333',
  },
  code: {
    fontFamily: 'monospace',
    fontSize: 11,
    color: '#666',
  },
});
