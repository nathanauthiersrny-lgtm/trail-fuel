import { Pressable, StyleSheet, Text, View } from 'react-native';

import {
  FEEDBACK_TAGS,
  QUANTITY_ACTUALS,
  type EventFeedback,
  type FeedbackTag,
  type QuantityActual,
} from '../../models/event-feedback';

export type EventFeedbackBlockProps = {
  feedback?: EventFeedback;
  /** Whether the event was logged as done — controls quantity selector visibility. */
  isDone: boolean;
  /** Whether to show the quantity selector at all (only for intake-typed events). */
  showQuantity: boolean;
  onChangeTags: (tags: FeedbackTag[]) => void;
  onChangeQuantity: (quantity: QuantityActual | null) => void;
};

const TAG_META: Record<FeedbackTag, { emoji: string; label: string }> = {
  stomach: { emoji: '🤢', label: 'Estomac' },
  taste: { emoji: '🍴', label: 'Goût' },
  too_early: { emoji: '⏰', label: 'Trop tôt' },
  too_late: { emoji: '🕐', label: 'Trop tard' },
  too_close: { emoji: '🤏', label: 'Trop proche' },
  terrain: { emoji: '🏃', label: 'Terrain' },
  other: { emoji: '🤷', label: 'Autre' },
  ok: { emoji: '👍', label: 'OK' },
};

const QUANTITY_LABEL: Record<QuantityActual, string> = {
  full: 'Tout',
  half: 'Moitié',
  quarter: 'Quart',
};

export function EventFeedbackBlock({
  feedback,
  isDone,
  showQuantity,
  onChangeTags,
  onChangeQuantity,
}: EventFeedbackBlockProps) {
  const tags = feedback?.tags ?? [];
  const quantity = feedback?.actual_quantity;

  const toggleTag = (tag: FeedbackTag) => {
    const next = tags.includes(tag) ? tags.filter((t) => t !== tag) : [...tags, tag];
    onChangeTags(next);
  };

  const pickQuantity = (q: QuantityActual) => {
    onChangeQuantity(quantity === q ? null : q);
  };

  return (
    <View style={styles.container}>
      <Text style={styles.sectionLabel}>Ressenti</Text>
      <View style={styles.chipsGrid}>
        {FEEDBACK_TAGS.map((tag) => {
          const active = tags.includes(tag);
          const meta = TAG_META[tag];
          return (
            <Pressable
              key={tag}
              onPress={() => toggleTag(tag)}
              style={({ pressed }) => [
                styles.chip,
                active && styles.chipActive,
                pressed && styles.chipPressed,
              ]}
            >
              <Text style={styles.chipEmoji}>{meta.emoji}</Text>
              <Text
                style={[styles.chipLabel, active && styles.chipLabelActive]}
              >
                {meta.label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {showQuantity && isDone ? (
        <>
          <Text style={[styles.sectionLabel, styles.sectionLabelSpaced]}>
            Quantité prise
          </Text>
          <View style={styles.quantityRow}>
            {QUANTITY_ACTUALS.map((q) => {
              const active = quantity === q;
              return (
                <Pressable
                  key={q}
                  onPress={() => pickQuantity(q)}
                  style={({ pressed }) => [
                    styles.quantityButton,
                    active && styles.quantityButtonActive,
                    pressed && styles.quantityButtonPressed,
                  ]}
                >
                  <Text
                    style={[
                      styles.quantityLabel,
                      active && styles.quantityLabelActive,
                    ]}
                  >
                    {QUANTITY_LABEL[q]}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#fafafa',
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#e0e0e0',
  },
  sectionLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: '#888',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  sectionLabelSpaced: {
    marginTop: 14,
  },
  chipsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 16,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#dcdcdc',
  },
  chipActive: {
    backgroundColor: '#0a7ea4',
    borderColor: '#0a7ea4',
  },
  chipPressed: {
    opacity: 0.7,
  },
  chipEmoji: {
    fontSize: 14,
  },
  chipLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#444',
  },
  chipLabelActive: {
    color: '#fff',
  },
  quantityRow: {
    flexDirection: 'row',
    gap: 6,
  },
  quantityButton: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#dcdcdc',
    alignItems: 'center',
  },
  quantityButtonActive: {
    backgroundColor: '#0a7ea4',
    borderColor: '#0a7ea4',
  },
  quantityButtonPressed: {
    opacity: 0.7,
  },
  quantityLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#444',
  },
  quantityLabelActive: {
    color: '#fff',
  },
});
