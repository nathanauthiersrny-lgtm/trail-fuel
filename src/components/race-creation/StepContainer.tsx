import React from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

import type { CreationStep } from '../../services/race-creation-store';

const TOTAL_STEPS = 6;

type Props = {
  step: CreationStep;
  canNext: boolean;
  nextLabel?: string;
  onNext: () => void;
  onBack: () => void;
  onDebug?: () => void;
  children: React.ReactNode;
};

export function StepContainer({
  step,
  canNext,
  nextLabel,
  onNext,
  onBack,
  onDebug,
  children,
}: Props) {
  const progress = step / TOTAL_STEPS;
  const isFirst = step === 1;
  const label = nextLabel ?? (step === TOTAL_STEPS ? 'Terminer' : 'Suivant →');

  return (
    <KeyboardAvoidingView
      style={styles.root}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      {/* ── Stepper ─────────────────────────────────────────────── */}
      <View style={styles.stepper}>
        <Text style={styles.stepLabel}>
          Étape {step} / {TOTAL_STEPS}
        </Text>
        <View style={styles.progressTrack}>
          <View style={[styles.progressFill, { width: `${progress * 100}%` }]} />
        </View>
      </View>

      {/* ── Content ─────────────────────────────────────────────── */}
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        {children}
        <View style={styles.scrollPad} />
      </ScrollView>

      {/* ── Nav footer ──────────────────────────────────────────── */}
      <View style={styles.footer}>
        {__DEV__ && onDebug ? (
          <TouchableOpacity onPress={onDebug} style={styles.debugBtn}>
            <Text style={styles.debugTxt}>Voir draft</Text>
          </TouchableOpacity>
        ) : null}

        <View style={styles.navRow}>
          <TouchableOpacity
            style={[styles.navBtn, styles.backBtn, isFirst && styles.navBtnDisabled]}
            onPress={onBack}
            disabled={isFirst}
          >
            <Text style={[styles.navBtnTxt, isFirst && styles.navBtnTxtDisabled]}>
              ← Précédent
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.navBtn, styles.nextBtn, !canNext && styles.nextBtnDisabled]}
            onPress={onNext}
            disabled={!canNext}
            activeOpacity={canNext ? 0.7 : 1}
          >
            <Text style={styles.nextBtnTxt}>{label}</Text>
          </TouchableOpacity>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#fff' },

  stepper: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#eee',
  },
  stepLabel: { fontSize: 13, color: '#666', marginBottom: 6 },
  progressTrack: {
    height: 4,
    backgroundColor: '#f0f0f0',
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressFill: {
    height: 4,
    backgroundColor: '#FF6B35',
    borderRadius: 2,
  },

  scroll: { flex: 1 },
  scrollContent: { padding: 20 },
  scrollPad: { height: 8 },

  footer: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#eee',
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 16,
    backgroundColor: '#fff',
  },
  debugBtn: { alignSelf: 'center', marginBottom: 6 },
  debugTxt: { fontSize: 11, color: '#aaa', textDecorationLine: 'underline' },

  navRow: { flexDirection: 'row', gap: 10 },
  navBtn: {
    flex: 1,
    paddingVertical: 13,
    borderRadius: 10,
    alignItems: 'center',
  },
  backBtn: { backgroundColor: '#f5f5f5' },
  navBtnDisabled: { opacity: 0.3 },
  navBtnTxt: { fontSize: 15, fontWeight: '500', color: '#333' },
  navBtnTxtDisabled: { color: '#bbb' },
  nextBtn: { backgroundColor: '#FF6B35' },
  nextBtnDisabled: { backgroundColor: '#FBBFA7' },
  nextBtnTxt: { fontSize: 15, fontWeight: '600', color: '#fff' },
});
