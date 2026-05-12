import type {
  IntakePickRule,
  RaceRule,
  WindowRule,
} from '../../../models/rule';
import {
  applyIntakePickAction,
  applyIntakePickRules,
  applyRaceAction,
  applyRaceRules,
  applyWindowAction,
  applyWindowRules,
  EMPTY_PREFERENCES,
  type RaceTargets,
  type WindowState,
} from '../../rules/action';

// ─── Race scope ──────────────────────────────────────────────────────────────

const initialTargets: RaceTargets = {
  carbs_per_hour_g: 60,
  fluid_per_hour_ml: 500,
  sodium_per_hour_mg: 500,
  intensity_modifier: 1.0,
  first_intake_after_min: 30,
  intake_interval_min: 20,
  first_fluid_reminder_min: 15,
  fluid_reminder_interval_min: 30,
  check_in_frequency_min: 50,
};

describe('applyRaceAction', () => {
  it('add with numeric value', () => {
    const next = applyRaceAction(
      initialTargets,
      { target: 'sodium_per_hour_mg', op: 'add', value: 200 },
      {},
    );
    expect(next.sodium_per_hour_mg).toBe(700);
    expect(next.fluid_per_hour_ml).toBe(500);
  });

  it('multiply with numeric value', () => {
    const next = applyRaceAction(
      initialTargets,
      { target: 'fluid_per_hour_ml', op: 'multiply', value: 1.15 },
      {},
    );
    expect(next.fluid_per_hour_ml).toBeCloseTo(575, 6);
  });

  it('subtract with numeric value', () => {
    const next = applyRaceAction(
      initialTargets,
      { target: 'intake_interval_min', op: 'subtract', value: 5 },
      {},
    );
    expect(next.intake_interval_min).toBe(15);
  });

  it('set replaces the value entirely', () => {
    const next = applyRaceAction(
      initialTargets,
      { target: 'intensity_modifier', op: 'set', value: 0.85 },
      {},
    );
    expect(next.intensity_modifier).toBe(0.85);
  });

  it('evaluates an expression value', () => {
    const ctx = { temperature_c: 25 };
    const next = applyRaceAction(
      initialTargets,
      {
        target: 'fluid_per_hour_ml',
        op: 'add',
        value: { expr: '(temperature_c - 20) * 50' },
      },
      ctx,
    );
    expect(next.fluid_per_hour_ml).toBe(750); // 500 + 5*50
  });

  it('does not mutate the input state', () => {
    applyRaceAction(
      initialTargets,
      { target: 'fluid_per_hour_ml', op: 'multiply', value: 2 },
      {},
    );
    expect(initialTargets.fluid_per_hour_ml).toBe(500);
  });
});

describe('applyRaceRules', () => {
  const ctx = { humidity_high: true, temperature_c: 28, session_type: 'long' };

  const baseRule = (
    id: string,
    overrides: Partial<RaceRule>,
  ): RaceRule => ({
    id,
    source: 'base',
    category: 'nutrition',
    description: id,
    scope: 'race',
    condition: { always: true },
    action: { target: 'fluid_per_hour_ml', op: 'add', value: 0 },
    ...overrides,
  });

  it('applies only rules whose condition matches', () => {
    const rules: RaceRule[] = [
      baseRule('humid', {
        condition: { field: 'humidity_high', op: 'equals', value: true },
        action: { target: 'fluid_per_hour_ml', op: 'multiply', value: 1.15 },
      }),
      baseRule('cold', {
        condition: { field: 'temperature_c', op: 'lt', value: 10 },
        action: { target: 'fluid_per_hour_ml', op: 'add', value: 999 },
      }),
    ];
    const next = applyRaceRules(rules, ctx, initialTargets);
    // Only humid rule fires
    expect(next.fluid_per_hour_ml).toBeCloseTo(575, 6);
  });

  it('applies rules in JSON declaration order — add then multiply differs from reverse', () => {
    const addFirst: RaceRule[] = [
      baseRule('add', {
        action: { target: 'fluid_per_hour_ml', op: 'add', value: 100 },
      }),
      baseRule('mul', {
        action: { target: 'fluid_per_hour_ml', op: 'multiply', value: 2 },
      }),
    ];
    const mulFirst: RaceRule[] = [
      baseRule('mul', {
        action: { target: 'fluid_per_hour_ml', op: 'multiply', value: 2 },
      }),
      baseRule('add', {
        action: { target: 'fluid_per_hour_ml', op: 'add', value: 100 },
      }),
    ];
    expect(applyRaceRules(addFirst, ctx, initialTargets).fluid_per_hour_ml).toBe(1200); // (500+100)*2
    expect(applyRaceRules(mulFirst, ctx, initialTargets).fluid_per_hour_ml).toBe(1100); // 500*2+100
  });
});

// ─── Window scope ────────────────────────────────────────────────────────────

describe('applyWindowAction', () => {
  const initial: WindowState = { allowed_kinds: ['gel', 'bar', 'real_food'] };

  it('set_allowed_kinds replaces the list', () => {
    const next = applyWindowAction(initial, { op: 'set_allowed_kinds', kinds: ['gel'] });
    expect(next.allowed_kinds).toEqual(['gel']);
  });

  it('set_allowed_kinds to null forbids all intake', () => {
    const next = applyWindowAction(initial, { op: 'set_allowed_kinds', kinds: null });
    expect(next.allowed_kinds).toBeNull();
  });

  it('forbid_kind removes a specific kind from the list', () => {
    const next = applyWindowAction(initial, { op: 'forbid_kind', kind: 'real_food' });
    expect(next.allowed_kinds).toEqual(['gel', 'bar']);
  });

  it('forbid_kind on a null list is a no-op', () => {
    const next = applyWindowAction(
      { allowed_kinds: null },
      { op: 'forbid_kind', kind: 'gel' },
    );
    expect(next.allowed_kinds).toBeNull();
  });
});

describe('applyWindowRules', () => {
  const baseRule = (overrides: Partial<WindowRule>): WindowRule => ({
    id: 'r',
    source: 'base',
    category: 'placement',
    description: 'r',
    scope: 'window',
    condition: { always: true },
    action: { op: 'forbid_kind', kind: 'real_food' },
    ...overrides,
  });

  it('chains forbid_kind operations', () => {
    const rules: WindowRule[] = [
      baseRule({ action: { op: 'forbid_kind', kind: 'real_food' } }),
      baseRule({ action: { op: 'forbid_kind', kind: 'bar' } }),
    ];
    const next = applyWindowRules(rules, {}, { allowed_kinds: ['gel', 'bar', 'real_food'] });
    expect(next.allowed_kinds).toEqual(['gel']);
  });
});

// ─── IntakePick scope ────────────────────────────────────────────────────────

describe('applyIntakePickAction', () => {
  it('prefer_kinds appends to preferences', () => {
    const next = applyIntakePickAction(
      EMPTY_PREFERENCES,
      { op: 'prefer_kinds', kinds: ['bar', 'real_food'] },
      {},
    );
    expect(next.prefer).toEqual(['bar', 'real_food']);
  });

  it('avoid_kinds appends to avoid list', () => {
    const next = applyIntakePickAction(
      EMPTY_PREFERENCES,
      { op: 'avoid_kinds', kinds: ['gel'] },
      {},
    );
    expect(next.avoid).toEqual(['gel']);
  });

  it('resolves kinds_from path against context', () => {
    const ctx = { next_window: { allowed_kinds: ['gel'] } };
    const next = applyIntakePickAction(
      EMPTY_PREFERENCES,
      { op: 'avoid_kinds', kinds: { kinds_from: 'next_window.allowed_kinds' } },
      ctx,
    );
    expect(next.avoid).toEqual(['gel']);
  });

  it('dedupes when concatenating same kind twice', () => {
    let state = applyIntakePickAction(
      EMPTY_PREFERENCES,
      { op: 'prefer_kinds', kinds: ['bar'] },
      {},
    );
    state = applyIntakePickAction(state, { op: 'prefer_kinds', kinds: ['bar', 'real_food'] }, {});
    expect(state.prefer).toEqual(['bar', 'real_food']);
  });

  it('throws when kinds_from path is not an array', () => {
    const ctx = { next_window: { allowed_kinds: 'not-an-array' } };
    expect(() =>
      applyIntakePickAction(
        EMPTY_PREFERENCES,
        { op: 'avoid_kinds', kinds: { kinds_from: 'next_window.allowed_kinds' } },
        ctx,
      ),
    ).toThrow(/array/);
  });

  it('treats null at kinds_from path as empty list', () => {
    const ctx = { next_window: { allowed_kinds: null } };
    const next = applyIntakePickAction(
      EMPTY_PREFERENCES,
      { op: 'avoid_kinds', kinds: { kinds_from: 'next_window.allowed_kinds' } },
      ctx,
    );
    expect(next.avoid).toEqual([]);
  });
});

describe('applyIntakePickRules — look-ahead realistic case', () => {
  it('avoids next window kinds when next is strict subset', () => {
    const lookaheadRule: IntakePickRule = {
      id: 'lookahead',
      source: 'base',
      category: 'placement',
      description: 'avoid kinds reserved for upcoming restricted window',
      scope: 'intake_pick',
      condition: {
        all: [
          { field: 'next_window', op: 'exists' },
          {
            field: 'next_window.allowed_kinds',
            op: 'is_strict_subset_of',
            set: 'window.allowed_kinds',
          },
          { field: 'next_window.allowed_kinds', op: 'is_not_empty' },
        ],
      },
      action: {
        op: 'avoid_kinds',
        kinds: { kinds_from: 'next_window.allowed_kinds' },
      },
    };

    const ctx = {
      window: { allowed_kinds: ['gel', 'bar', 'real_food'] },
      next_window: { allowed_kinds: ['gel'] },
    };
    const prefs = applyIntakePickRules([lookaheadRule], ctx);
    expect(prefs.avoid).toEqual(['gel']);
  });

  it('does NOT avoid when next window has same allowed_kinds', () => {
    const lookaheadRule: IntakePickRule = {
      id: 'lookahead',
      source: 'base',
      category: 'placement',
      description: 'avoid kinds reserved for upcoming restricted window',
      scope: 'intake_pick',
      condition: {
        field: 'next_window.allowed_kinds',
        op: 'is_strict_subset_of',
        set: 'window.allowed_kinds',
      },
      action: {
        op: 'avoid_kinds',
        kinds: { kinds_from: 'next_window.allowed_kinds' },
      },
    };
    const ctx = {
      window: { allowed_kinds: ['gel', 'bar'] },
      next_window: { allowed_kinds: ['gel', 'bar'] },
    };
    const prefs = applyIntakePickRules([lookaheadRule], ctx);
    expect(prefs.avoid).toEqual([]);
  });
});
