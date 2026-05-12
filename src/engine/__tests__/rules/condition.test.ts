import { evaluateCondition, readPath } from '../../rules/condition';

const ctx = {
  temperature_c: 22,
  humidity_high: true,
  session_type: 'long',
  duration_min: 200,
  next_window: {
    allowed_kinds: ['gel'],
    startMin: 60,
  },
  window: {
    allowed_kinds: ['gel', 'bar', 'real_food'],
    startMin: 40,
  },
  empty_array: [],
};

describe('readPath', () => {
  it('reads a top-level field', () => {
    expect(readPath(ctx, 'temperature_c')).toBe(22);
  });
  it('reads a nested field', () => {
    expect(readPath(ctx, 'next_window.startMin')).toBe(60);
  });
  it('returns undefined for missing root', () => {
    expect(readPath(ctx, 'foo')).toBeUndefined();
  });
  it('returns undefined for missing nested', () => {
    expect(readPath(ctx, 'next_window.nope')).toBeUndefined();
  });
  it('returns undefined when traversing through a non-object', () => {
    expect(readPath(ctx, 'temperature_c.something')).toBeUndefined();
  });
});

describe('evaluateCondition — boolean combinators', () => {
  it('always returns true', () => {
    expect(evaluateCondition({ always: true }, ctx)).toBe(true);
  });
  it('all = AND', () => {
    expect(
      evaluateCondition(
        { all: [{ field: 'humidity_high', op: 'equals', value: true }, { always: true }] },
        ctx,
      ),
    ).toBe(true);
    expect(
      evaluateCondition(
        { all: [{ field: 'humidity_high', op: 'equals', value: false }, { always: true }] },
        ctx,
      ),
    ).toBe(false);
  });
  it('any = OR', () => {
    expect(
      evaluateCondition(
        {
          any: [
            { field: 'session_type', op: 'equals', value: 'plaisir' },
            { field: 'session_type', op: 'equals', value: 'long' },
          ],
        },
        ctx,
      ),
    ).toBe(true);
  });
  it('not = NOT', () => {
    expect(
      evaluateCondition({ not: { field: 'humidity_high', op: 'equals', value: false } }, ctx),
    ).toBe(true);
  });
});

describe('evaluateCondition — equals / not_equals', () => {
  it('matches a scalar', () => {
    expect(evaluateCondition({ field: 'session_type', op: 'equals', value: 'long' }, ctx)).toBe(
      true,
    );
    expect(
      evaluateCondition({ field: 'session_type', op: 'equals', value: 'plaisir' }, ctx),
    ).toBe(false);
  });
  it('not_equals is the complement', () => {
    expect(
      evaluateCondition({ field: 'session_type', op: 'not_equals', value: 'plaisir' }, ctx),
    ).toBe(true);
  });
  it('returns false for missing field on equals (no match)', () => {
    expect(evaluateCondition({ field: 'foo', op: 'equals', value: 'bar' }, ctx)).toBe(false);
  });
  it('returns false for missing field on not_equals (no match)', () => {
    expect(evaluateCondition({ field: 'foo', op: 'not_equals', value: 'bar' }, ctx)).toBe(false);
  });
});

describe('evaluateCondition — numeric comparisons', () => {
  it('gt with numeric value', () => {
    expect(evaluateCondition({ field: 'temperature_c', op: 'gt', value: 20 }, ctx)).toBe(true);
    expect(evaluateCondition({ field: 'temperature_c', op: 'gt', value: 25 }, ctx)).toBe(false);
  });
  it('gte includes equality', () => {
    expect(evaluateCondition({ field: 'temperature_c', op: 'gte', value: 22 }, ctx)).toBe(true);
  });
  it('lt with numeric value', () => {
    expect(evaluateCondition({ field: 'temperature_c', op: 'lt', value: 25 }, ctx)).toBe(true);
    expect(evaluateCondition({ field: 'temperature_c', op: 'lt', value: 22 }, ctx)).toBe(false);
  });
  it('returns false on missing field', () => {
    expect(evaluateCondition({ field: 'foo', op: 'gt', value: 0 }, ctx)).toBe(false);
  });
  it('throws if the value is an expression (4.A.3 will lift this)', () => {
    expect(() =>
      evaluateCondition(
        { field: 'temperature_c', op: 'gt', value: { expr: '20' } },
        ctx,
      ),
    ).toThrow(/ExpressionValue/);
  });
});

describe('evaluateCondition — in / between', () => {
  it('in matches a value in the list', () => {
    expect(
      evaluateCondition(
        { field: 'session_type', op: 'in', value: ['competition', 'long'] },
        ctx,
      ),
    ).toBe(true);
  });
  it('in returns false when not in list', () => {
    expect(
      evaluateCondition({ field: 'session_type', op: 'in', value: ['competition'] }, ctx),
    ).toBe(false);
  });
  it('between is inclusive', () => {
    expect(
      evaluateCondition({ field: 'temperature_c', op: 'between', value: [20, 22] }, ctx),
    ).toBe(true);
    expect(
      evaluateCondition({ field: 'temperature_c', op: 'between', value: [22, 22] }, ctx),
    ).toBe(true);
  });
  it('between returns false outside the range', () => {
    expect(
      evaluateCondition({ field: 'temperature_c', op: 'between', value: [25, 30] }, ctx),
    ).toBe(false);
  });
});

describe('evaluateCondition — set ops', () => {
  it('is_subset_of matches a strict subset', () => {
    expect(
      evaluateCondition(
        {
          field: 'next_window.allowed_kinds',
          op: 'is_subset_of',
          set: 'window.allowed_kinds',
        },
        ctx,
      ),
    ).toBe(true);
  });
  it('is_subset_of matches equal sets (subset is reflexive)', () => {
    expect(
      evaluateCondition(
        {
          field: 'window.allowed_kinds',
          op: 'is_subset_of',
          set: 'window.allowed_kinds',
        },
        ctx,
      ),
    ).toBe(true);
  });
  it('is_subset_of returns false when not a subset', () => {
    expect(
      evaluateCondition(
        {
          field: 'window.allowed_kinds',
          op: 'is_subset_of',
          set: 'next_window.allowed_kinds',
        },
        ctx,
      ),
    ).toBe(false);
  });
  it('is_superset_of inverts the relation', () => {
    expect(
      evaluateCondition(
        {
          field: 'window.allowed_kinds',
          op: 'is_superset_of',
          set: 'next_window.allowed_kinds',
        },
        ctx,
      ),
    ).toBe(true);
  });

  it('is_strict_subset_of excludes equality', () => {
    expect(
      evaluateCondition(
        {
          field: 'next_window.allowed_kinds',
          op: 'is_strict_subset_of',
          set: 'window.allowed_kinds',
        },
        ctx,
      ),
    ).toBe(true);
    // Equal sets : NOT strict
    expect(
      evaluateCondition(
        {
          field: 'window.allowed_kinds',
          op: 'is_strict_subset_of',
          set: 'window.allowed_kinds',
        },
        ctx,
      ),
    ).toBe(false);
  });

  it('is_strict_superset_of inverts strict subset', () => {
    expect(
      evaluateCondition(
        {
          field: 'window.allowed_kinds',
          op: 'is_strict_superset_of',
          set: 'next_window.allowed_kinds',
        },
        ctx,
      ),
    ).toBe(true);
    expect(
      evaluateCondition(
        {
          field: 'window.allowed_kinds',
          op: 'is_strict_superset_of',
          set: 'window.allowed_kinds',
        },
        ctx,
      ),
    ).toBe(false);
  });
});

describe('evaluateCondition — existence / emptiness', () => {
  it('exists is true for any defined field', () => {
    expect(evaluateCondition({ field: 'session_type', op: 'exists' }, ctx)).toBe(true);
    expect(evaluateCondition({ field: 'empty_array', op: 'exists' }, ctx)).toBe(true);
  });
  it('exists is false for a missing field', () => {
    expect(evaluateCondition({ field: 'foo', op: 'exists' }, ctx)).toBe(false);
  });
  it('exists is false for a missing nested field', () => {
    expect(evaluateCondition({ field: 'next_window.nope', op: 'exists' }, ctx)).toBe(false);
  });
  it('is_empty matches empty array', () => {
    expect(evaluateCondition({ field: 'empty_array', op: 'is_empty' }, ctx)).toBe(true);
  });
  it('is_empty matches missing field (treated as undefined)', () => {
    expect(evaluateCondition({ field: 'foo', op: 'is_empty' }, ctx)).toBe(true);
  });
  it('is_not_empty matches a non-empty array', () => {
    expect(evaluateCondition({ field: 'next_window.allowed_kinds', op: 'is_not_empty' }, ctx)).toBe(
      true,
    );
  });
  it('is_not_empty is false for a missing field', () => {
    expect(evaluateCondition({ field: 'foo', op: 'is_not_empty' }, ctx)).toBe(false);
  });
});

describe('evaluateCondition — composed look-ahead-like rule', () => {
  it('matches when next window is strictly more restrictive than current', () => {
    const condition = {
      all: [
        { field: 'next_window', op: 'exists' as const },
        {
          field: 'next_window.allowed_kinds' as const,
          op: 'is_strict_subset_of' as const,
          set: 'window.allowed_kinds',
        },
        { field: 'next_window.allowed_kinds' as const, op: 'is_not_empty' as const },
      ],
    };
    expect(evaluateCondition(condition, ctx)).toBe(true);
  });

  it('does NOT match when next window has the same allowed_kinds as current', () => {
    const same = {
      ...ctx,
      next_window: { ...ctx.next_window, allowed_kinds: ['gel', 'bar', 'real_food'] },
    };
    const condition = {
      all: [
        { field: 'next_window', op: 'exists' as const },
        {
          field: 'next_window.allowed_kinds' as const,
          op: 'is_strict_subset_of' as const,
          set: 'window.allowed_kinds',
        },
      ],
    };
    expect(evaluateCondition(condition, same)).toBe(false);
  });
});
