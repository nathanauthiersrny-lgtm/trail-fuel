import { TEST_PACK } from '../../../engine/__tests__/test-helpers/knowledge-pack';
import type { KnowledgePack, KnowledgePackOverlay } from '../../../models/knowledge-pack';
import type { RaceRule } from '../../../models/rule';
import { mergeKnowledgePack } from '../merge';

describe('mergeKnowledgePack — passthrough', () => {
  it('returns the base unchanged when overlay is empty (only version)', () => {
    const empty: KnowledgePackOverlay = { version: '1.0.0' };
    const result = mergeKnowledgePack(TEST_PACK, empty);
    expect(result).toEqual(TEST_PACK);
  });
});

describe('mergeKnowledgePack — static config', () => {
  it('overrides a single param_defaults field, leaves others intact', () => {
    const overlay: KnowledgePackOverlay = {
      version: '1.0.0',
      param_defaults: { first_intake_after_min: 15 },
    };
    const result = mergeKnowledgePack(TEST_PACK, overlay);
    expect(result.param_defaults.first_intake_after_min).toBe(15);
    expect(result.param_defaults.intake_interval_min).toBe(
      TEST_PACK.param_defaults.intake_interval_min,
    );
  });

  it('overrides one fluid_modifiers.temperature subfield', () => {
    const overlay: KnowledgePackOverlay = {
      version: '1.0.0',
      fluid_modifiers: { temperature: { hot_increment_per_c: 75 } },
    };
    const result = mergeKnowledgePack(TEST_PACK, overlay);
    expect(result.fluid_modifiers.temperature.hot_increment_per_c).toBe(75);
    // Sibling fields preserved
    expect(result.fluid_modifiers.temperature.hot_threshold_c).toBe(20);
    expect(result.fluid_modifiers.temperature.cold_threshold_c).toBe(10);
    expect(result.fluid_modifiers.humidity_high_factor).toBe(1.15);
  });

  it('overrides humidity_high_factor without touching temperature', () => {
    const overlay: KnowledgePackOverlay = {
      version: '1.0.0',
      fluid_modifiers: { humidity_high_factor: 1.20 },
    };
    const result = mergeKnowledgePack(TEST_PACK, overlay);
    expect(result.fluid_modifiers.humidity_high_factor).toBeCloseTo(1.20, 6);
    expect(result.fluid_modifiers.temperature).toEqual(TEST_PACK.fluid_modifiers.temperature);
  });

  it('overrides feasibility_threshold (scalar field)', () => {
    const overlay: KnowledgePackOverlay = { version: '1.0.0', feasibility_threshold: 0.90 };
    const result = mergeKnowledgePack(TEST_PACK, overlay);
    expect(result.feasibility_threshold).toBeCloseTo(0.90, 6);
  });

  it('overrides one session_defaults entry, preserves others', () => {
    const overlay: KnowledgePackOverlay = {
      version: '1.0.0',
      session_defaults: {
        competition: { intensity_modifier: 1.30 },
      },
    };
    const result = mergeKnowledgePack(TEST_PACK, overlay);
    expect(result.session_defaults.competition.intensity_modifier).toBeCloseTo(1.30, 6);
    // Other competition fields preserved
    expect(result.session_defaults.competition.skip_alert_threshold).toBe(1);
    // Other sessions untouched
    expect(result.session_defaults.long).toEqual(TEST_PACK.session_defaults.long);
  });
});

describe('mergeKnowledgePack — rules', () => {
  function makeRule(id: string, addValue: number): RaceRule {
    return {
      id,
      source: 'overlay',
      category: 'nutrition',
      scope: 'race',
      description: `test rule ${id}`,
      condition: { always: true },
      action: { target: 'carbs_per_hour_g', op: 'add', value: addValue },
    };
  }

  it('appends new overlay rule IDs at the end', () => {
    const overlay: KnowledgePackOverlay = {
      version: '1.0.0',
      rules: [makeRule('new-rule-1', 10)],
    };
    const result = mergeKnowledgePack(TEST_PACK, overlay);
    expect(result.rules).toHaveLength(TEST_PACK.rules.length + 1);
    expect(result.rules[result.rules.length - 1].id).toBe('new-rule-1');
  });

  it('replaces a base rule when overlay shares its id', () => {
    const replacement = makeRule('fluid-humidity-high', 999);
    const overlay: KnowledgePackOverlay = {
      version: '1.0.0',
      rules: [replacement],
    };
    const result = mergeKnowledgePack(TEST_PACK, overlay);
    const replaced = result.rules.find((r) => r.id === 'fluid-humidity-high');
    expect(replaced).toBeDefined();
    expect(replaced!.source).toBe('overlay');
    expect((replaced as RaceRule).action.value).toBe(999);
    // No duplication
    expect(result.rules.filter((r) => r.id === 'fluid-humidity-high')).toHaveLength(1);
  });

  it('preserves the JSON order of base rules', () => {
    const overlay: KnowledgePackOverlay = {
      version: '1.0.0',
      rules: [makeRule('new-rule', 10)],
    };
    const result = mergeKnowledgePack(TEST_PACK, overlay);
    const baseIds = TEST_PACK.rules.map((r) => r.id);
    const mergedIds = result.rules.slice(0, baseIds.length).map((r) => r.id);
    expect(mergedIds).toEqual(baseIds);
  });

  it('handles both add and replace in the same overlay', () => {
    const overlay: KnowledgePackOverlay = {
      version: '1.0.0',
      rules: [
        makeRule('fluid-humidity-high', 1), // replace base
        makeRule('new-overlay-rule', 50), // add
      ],
    };
    const result = mergeKnowledgePack(TEST_PACK, overlay);
    expect(result.rules.length).toBe(TEST_PACK.rules.length + 1);
    expect(result.rules.find((r) => r.id === 'fluid-humidity-high')?.source).toBe('overlay');
    expect(result.rules.find((r) => r.id === 'new-overlay-rule')).toBeDefined();
  });
});

describe('mergeKnowledgePack — immutability', () => {
  it('does not mutate the base pack', () => {
    const baseSnapshot: KnowledgePack = JSON.parse(JSON.stringify(TEST_PACK));
    const overlay: KnowledgePackOverlay = {
      version: '1.0.0',
      param_defaults: { intake_interval_min: 5 },
      rules: [
        {
          id: 'fluid-humidity-high',
          source: 'overlay',
          category: 'nutrition',
          scope: 'race',
          description: 'replaced',
          condition: { always: true },
          action: { target: 'fluid_per_hour_ml', op: 'multiply', value: 2 },
        },
      ],
    };
    mergeKnowledgePack(TEST_PACK, overlay);
    expect(TEST_PACK).toEqual(baseSnapshot);
  });
});
