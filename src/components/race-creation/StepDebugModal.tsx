import React from 'react';
import {
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

import type { RaceCreationDraft } from '../../services/race-creation-store';

type Props = {
  draft: RaceCreationDraft;
  visible: boolean;
  onClose: () => void;
};

export function StepDebugModal({ draft, visible, onClose }: Props) {
  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>Draft state</Text>
          <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
            <Text style={styles.closeTxt}>Fermer</Text>
          </TouchableOpacity>
        </View>
        <ScrollView contentContainerStyle={styles.body}>
          <Text style={styles.json}>{JSON.stringify(draft, null, 2)}</Text>
        </ScrollView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#1a1a2e' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    paddingTop: 52,
    borderBottomWidth: 1,
    borderBottomColor: '#333',
  },
  title: { fontSize: 16, fontWeight: '600', color: '#e2e8f0' },
  closeBtn: { paddingHorizontal: 12, paddingVertical: 6 },
  closeTxt: { color: '#FF6B35', fontSize: 14 },
  body: { padding: 16 },
  json: { fontSize: 11, color: '#a8d8a8', fontFamily: 'monospace', lineHeight: 16 },
});
