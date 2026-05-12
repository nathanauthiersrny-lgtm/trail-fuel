import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
} from 'react-native';

import { getOrCreateProfile, updateProfile } from '../db/repos/profile-repo';
import { useDatabase } from '../hooks/use-database';
import { useKnowledgePack } from '../hooks/use-knowledge-pack';
import type { Profile } from '../models/profile';
import type { Rule, RuleCategory } from '../models/rule';

const CATEGORY_ORDER: RuleCategory[] = ['nutrition', 'placement', 'timing'];
const CATEGORY_LABEL: Record<RuleCategory, string> = {
  nutrition: 'Nutrition',
  placement: 'Placement',
  timing: 'Timing',
};

export default function RulesScreen() {
  const dbState = useDatabase();
  const packState = useKnowledgePack();
  const [profile, setProfile] = useState<Profile | null>(null);

  useEffect(() => {
    if (dbState.status !== 'ready') return;
    let cancelled = false;
    void getOrCreateProfile(dbState.db).then((p) => {
      if (!cancelled) setProfile(p);
    });
    return () => {
      cancelled = true;
    };
  }, [dbState]);

  const handleToggle = useCallback(
    async (ruleId: string, enabled: boolean) => {
      if (dbState.status !== 'ready' || !profile) return;
      const disabled = new Set(profile.disabled_rule_ids);
      if (enabled) disabled.delete(ruleId);
      else disabled.add(ruleId);
      const next = { ...profile, disabled_rule_ids: Array.from(disabled).sort() };
      // Optimistic update so the toggle feels instant.
      setProfile(next);
      try {
        const saved = await updateProfile(dbState.db, next);
        setProfile(saved);
      } catch (err) {
        console.error('[rules] updateProfile failed', err);
        // Revert on error.
        setProfile(profile);
      }
    },
    [dbState, profile],
  );

  if (dbState.status === 'loading' || packState.status === 'loading' || profile === null) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#0a7ea4" />
      </View>
    );
  }
  if (dbState.status === 'error') {
    return <CenteredText label={`Erreur DB : ${dbState.error.message}`} />;
  }
  if (packState.status === 'error') {
    return <CenteredText label={`Erreur knowledge pack : ${packState.error.message}`} />;
  }

  const disabledSet = new Set(profile.disabled_rule_ids);
  const rulesByCategory = groupByCategory(packState.pack.rules);
  const totalEnabled = packState.pack.rules.length - disabledSet.size;

  return (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
      <Text style={styles.headerHint}>
        {totalEnabled} sur {packState.pack.rules.length} règles actives.
        Désactiver une règle l'ignore lors de la prochaine génération de plan.
      </Text>

      {CATEGORY_ORDER.map((cat) => {
        const rules = rulesByCategory[cat] ?? [];
        if (rules.length === 0) return null;
        return (
          <View key={cat} style={styles.section}>
            <Text style={styles.sectionLabel}>{CATEGORY_LABEL[cat]}</Text>
            {rules.map((rule) => (
              <RuleRow
                key={rule.id}
                rule={rule}
                enabled={!disabledSet.has(rule.id)}
                onToggle={(enabled) => handleToggle(rule.id, enabled)}
              />
            ))}
          </View>
        );
      })}
    </ScrollView>
  );
}

function RuleRow({
  rule,
  enabled,
  onToggle,
}: {
  rule: Rule;
  enabled: boolean;
  onToggle: (enabled: boolean) => void;
}) {
  return (
    <View style={styles.row}>
      <View style={styles.rowMain}>
        <View style={styles.rowHeader}>
          <Text style={styles.ruleId}>{rule.id}</Text>
          <SourceBadge source={rule.source} />
        </View>
        <Text style={styles.ruleDescription}>{rule.description}</Text>
      </View>
      <Switch
        value={enabled}
        onValueChange={onToggle}
        trackColor={{ false: '#ccc', true: '#0a7ea4' }}
      />
    </View>
  );
}

function SourceBadge({ source }: { source: 'base' | 'overlay' }) {
  const isOverlay = source === 'overlay';
  return (
    <View style={[styles.badge, isOverlay ? styles.badgeOverlay : styles.badgeBase]}>
      <Text style={[styles.badgeText, isOverlay && styles.badgeTextOverlay]}>
        {isOverlay ? 'overlay' : 'base'}
      </Text>
    </View>
  );
}

function CenteredText({ label }: { label: string }) {
  return (
    <View style={styles.centered}>
      <Text style={styles.centeredLabel}>{label}</Text>
    </View>
  );
}

function groupByCategory(rules: readonly Rule[]): Partial<Record<RuleCategory, Rule[]>> {
  const out: Partial<Record<RuleCategory, Rule[]>> = {};
  for (const rule of rules) {
    (out[rule.category] ??= []).push(rule);
  }
  return out;
}

const styles = StyleSheet.create({
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fff',
    padding: 24,
  },
  centeredLabel: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
  },
  scroll: {
    flex: 1,
    backgroundColor: '#f7f7f7',
  },
  content: {
    padding: 16,
    paddingBottom: 48,
  },
  headerHint: {
    fontSize: 13,
    color: '#555',
    paddingHorizontal: 4,
    marginBottom: 16,
    lineHeight: 18,
  },
  section: {
    marginBottom: 20,
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
    backgroundColor: '#fff',
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 14,
    marginBottom: 6,
    gap: 12,
  },
  rowMain: {
    flex: 1,
  },
  rowHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  ruleId: {
    fontSize: 11,
    color: '#999',
    fontFamily: 'monospace',
  },
  ruleDescription: {
    fontSize: 14,
    color: '#222',
    lineHeight: 18,
  },
  badge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 999,
  },
  badgeBase: {
    backgroundColor: '#e8eef2',
  },
  badgeOverlay: {
    backgroundColor: '#fff0d9',
  },
  badgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#5a7385',
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  badgeTextOverlay: {
    color: '#a06800',
  },
});
