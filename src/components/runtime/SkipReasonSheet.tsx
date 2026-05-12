import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';

import { SKIP_REASONS, type SkipReason } from '../../models/event-feedback';

export type SkipReasonSheetProps = {
  visible: boolean;
  /** Optional context line, e.g. the name of the intake being skipped. */
  subject?: string;
  /**
   * Called when the user picks a reason, or "passer sans préciser" (reason=undefined).
   * The parent is then expected to log the skip + persist the reason.
   */
  onConfirm: (reason: SkipReason | undefined) => void;
  /** Called when the user dismisses the sheet without confirming — skip is cancelled. */
  onCancel: () => void;
};

type ReasonMeta = { emoji: string; label: string };

const REASON_META: Record<SkipReason, ReasonMeta> = {
  stomach: { emoji: '🤢', label: 'Estomac' },
  taste: { emoji: '🍴', label: 'Goût' },
  too_early: { emoji: '⏰', label: 'Trop tôt' },
  too_close: { emoji: '🤏', label: 'Trop proche' },
  terrain: { emoji: '🏃', label: 'Terrain' },
  other: { emoji: '🤷', label: 'Autre' },
};

export function SkipReasonSheet({
  visible,
  subject,
  onConfirm,
  onCancel,
}: SkipReasonSheetProps) {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onCancel}
    >
      <View style={styles.fill}>
        <Pressable style={styles.backdrop} onPress={onCancel} />
        <View style={styles.sheet}>
          <View style={styles.handle} />
          <Text style={styles.heading}>Pourquoi tu passes ?</Text>
          {subject ? <Text style={styles.subject}>{subject}</Text> : null}
          <View style={styles.chipsGrid}>
            {SKIP_REASONS.map((reason) => {
              const meta = REASON_META[reason];
              return (
                <Pressable
                  key={reason}
                  style={({ pressed }) => [
                    styles.chip,
                    pressed && styles.chipPressed,
                  ]}
                  onPress={() => onConfirm(reason)}
                >
                  <Text style={styles.chipEmoji}>{meta.emoji}</Text>
                  <Text style={styles.chipLabel}>{meta.label}</Text>
                </Pressable>
              );
            })}
          </View>
          <Pressable
            style={({ pressed }) => [
              styles.skipNoReason,
              pressed && styles.skipNoReasonPressed,
            ]}
            onPress={() => onConfirm(undefined)}
          >
            <Text style={styles.skipNoReasonText}>Passer sans préciser</Text>
          </Pressable>
          <Pressable style={styles.cancel} onPress={onCancel}>
            <Text style={styles.cancelText}>Annuler</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  fill: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  sheet: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 32,
  },
  handle: {
    alignSelf: 'center',
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#ddd',
    marginBottom: 12,
  },
  heading: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111',
    textAlign: 'center',
  },
  subject: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    marginTop: 4,
  },
  chipsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: 8,
    marginTop: 20,
  },
  chip: {
    flexBasis: '48%',
    flexGrow: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 14,
    paddingHorizontal: 14,
    borderRadius: 10,
    backgroundColor: '#f4f4f4',
    borderWidth: 1,
    borderColor: '#e4e4e4',
  },
  chipPressed: {
    backgroundColor: '#e8e8e8',
  },
  chipEmoji: {
    fontSize: 20,
  },
  chipLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: '#222',
  },
  skipNoReason: {
    marginTop: 16,
    paddingVertical: 14,
    borderRadius: 10,
    backgroundColor: '#fff5e5',
    borderWidth: 1,
    borderColor: '#ffd58a',
    alignItems: 'center',
  },
  skipNoReasonPressed: {
    backgroundColor: '#ffeacc',
  },
  skipNoReasonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#8a5a00',
  },
  cancel: {
    marginTop: 8,
    paddingVertical: 12,
    alignItems: 'center',
  },
  cancelText: {
    fontSize: 14,
    color: '#888',
  },
});
