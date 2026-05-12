import { validateRule, validateRuleList } from '../../rules/validate';

const baseFields = {
  id: 'test-rule',
  source: 'base',
  category: 'nutrition',
  description: 'Test rule',
};

describe('validateRule — common fields', () => {
  it('rejects non-objects', () => {
    expect(validateRule(null).ok).toBe(false);
    expect(validateRule(42).ok).toBe(false);
    expect(validateRule('rule').ok).toBe(false);
    expect(validateRule([]).ok).toBe(false);
  });

  it('rejects missing id', () => {
    const r = validateRule({ source: 'base', scope: 'race' });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/id/);
  });

  it('rejects unknown source', () => {
    const r = validateRule({ ...baseFields, source: 'pluto', scope: 'race' });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/source/);
  });

  it('rejects unknown scope', () => {
    const r = validateRule({ ...baseFields, scope: 'galaxy' });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/scope/);
  });

  it('rejects unknown category', () => {
    const r = validateRule({ ...baseFields, category: 'soup', scope: 'race' });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/category/);
  });

  it('accepts optional provenance with valid string fields', () => {
    const r = validateRule({
      ...baseFields,
      scope: 'race',
      condition: { always: true },
      action: { target: 'fluid_per_hour_ml', op: 'multiply', value: 1.15 },
      provenance: { extracted_from: 'doc.md §6', notes: 'classic' },
    });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value.provenance?.extracted_from).toBe('doc.md §6');
  });

  it('rejects provenance with non-string fields', () => {
    const r = validateRule({
      ...baseFields,
      scope: 'race',
      condition: { always: true },
      action: { target: 'fluid_per_hour_ml', op: 'multiply', value: 1.15 },
      provenance: { extracted_from: 42 },
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/extracted_from/);
  });
});

describe('validateRule — race scope action', () => {
  function makeRace(action: unknown) {
    return {
      ...baseFields,
      scope: 'race',
      condition: { always: true },
      action,
    };
  }

  it('accepts a numeric multiply action on a nutrition target', () => {
    const r = validateRule(
      makeRace({ target: 'fluid_per_hour_ml', op: 'multiply', value: 1.15 }),
    );
    expect(r.ok).toBe(true);
  });

  it('accepts an expression value', () => {
    const r = validateRule(
      makeRace({
        target: 'fluid_per_hour_ml',
        op: 'add',
        value: { expr: '(temperature_c - 20) * 50' },
      }),
    );
    expect(r.ok).toBe(true);
  });

  it('rejects an empty expression', () => {
    const r = validateRule(
      makeRace({
        target: 'fluid_per_hour_ml',
        op: 'add',
        value: { expr: '' },
      }),
    );
    expect(r.ok).toBe(false);
  });

  it('rejects an unknown target', () => {
    const r = validateRule(
      makeRace({ target: 'temperature_c', op: 'multiply', value: 1.15 }),
    );
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/target/);
  });

  it('rejects an unknown op', () => {
    const r = validateRule(
      makeRace({ target: 'fluid_per_hour_ml', op: 'divide', value: 2 }),
    );
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/op/);
  });

  it('accepts a timing target', () => {
    const r = validateRule(
      makeRace({ target: 'intake_interval_min', op: 'set', value: 25 }),
    );
    expect(r.ok).toBe(true);
  });
});

describe('validateRule — window scope action', () => {
  function makeWin(action: unknown) {
    return {
      ...baseFields,
      category: 'placement',
      scope: 'window',
      condition: { always: true },
      action,
    };
  }

  it('accepts set_allowed_kinds with null (forbid intake)', () => {
    const r = validateRule(makeWin({ op: 'set_allowed_kinds', kinds: null }));
    expect(r.ok).toBe(true);
  });

  it('accepts set_allowed_kinds with FoodItemKind[]', () => {
    const r = validateRule(makeWin({ op: 'set_allowed_kinds', kinds: ['gel', 'bar'] }));
    expect(r.ok).toBe(true);
  });

  it('rejects set_allowed_kinds with invalid kind', () => {
    const r = validateRule(makeWin({ op: 'set_allowed_kinds', kinds: ['gel', 'banana'] }));
    expect(r.ok).toBe(false);
  });

  it('accepts forbid_kind', () => {
    const r = validateRule(makeWin({ op: 'forbid_kind', kind: 'real_food' }));
    expect(r.ok).toBe(true);
  });

  it('rejects forbid_kind with unknown kind', () => {
    const r = validateRule(makeWin({ op: 'forbid_kind', kind: 'salad' }));
    expect(r.ok).toBe(false);
  });

  it('rejects unknown window op', () => {
    const r = validateRule(makeWin({ op: 'set_window_size', value: 30 }));
    expect(r.ok).toBe(false);
  });
});

describe('validateRule — intake_pick scope action', () => {
  function makePick(action: unknown) {
    return {
      ...baseFields,
      category: 'placement',
      scope: 'intake_pick',
      condition: { always: true },
      action,
    };
  }

  it('accepts prefer_kinds with static array', () => {
    const r = validateRule(makePick({ op: 'prefer_kinds', kinds: ['bar', 'real_food'] }));
    expect(r.ok).toBe(true);
  });

  it('accepts avoid_kinds with kinds_from reference', () => {
    const r = validateRule(
      makePick({ op: 'avoid_kinds', kinds: { kinds_from: 'next_window.allowed_kinds' } }),
    );
    expect(r.ok).toBe(true);
  });

  it('accepts forbid_kinds', () => {
    const r = validateRule(makePick({ op: 'forbid_kinds', kinds: ['water'] }));
    expect(r.ok).toBe(true);
  });

  it('rejects op typo', () => {
    const r = validateRule(makePick({ op: 'preferr_kinds', kinds: ['bar'] }));
    expect(r.ok).toBe(false);
  });

  it('rejects kinds that is neither array nor kinds_from object', () => {
    const r = validateRule(makePick({ op: 'prefer_kinds', kinds: 'gel' }));
    expect(r.ok).toBe(false);
  });

  it('rejects kinds_from with non-string path', () => {
    const r = validateRule(makePick({ op: 'avoid_kinds', kinds: { kinds_from: 42 } }));
    expect(r.ok).toBe(false);
  });
});

describe('validateRule — conditions', () => {
  function withCondition(condition: unknown) {
    return {
      ...baseFields,
      scope: 'race',
      condition,
      action: { target: 'fluid_per_hour_ml', op: 'multiply', value: 1.0 },
    };
  }

  it('accepts { always: true }', () => {
    expect(validateRule(withCondition({ always: true })).ok).toBe(true);
  });

  it('accepts equals with scalar value', () => {
    expect(
      validateRule(withCondition({ field: 'humidity_high', op: 'equals', value: true })).ok,
    ).toBe(true);
  });

  it('accepts gt with numeric value', () => {
    expect(
      validateRule(withCondition({ field: 'temperature_c', op: 'gt', value: 25 })).ok,
    ).toBe(true);
  });

  it('accepts gt with expression value', () => {
    expect(
      validateRule(
        withCondition({
          field: 'fluid_per_hour_ml_base',
          op: 'gt',
          value: { expr: 'duration_min / 10' },
        }),
      ).ok,
    ).toBe(true);
  });

  it('accepts in with scalar[]', () => {
    expect(
      validateRule(
        withCondition({ field: 'session_type', op: 'in', value: ['competition', 'dur'] }),
      ).ok,
    ).toBe(true);
  });

  it('rejects in with non-array', () => {
    expect(
      validateRule(withCondition({ field: 'session_type', op: 'in', value: 'competition' })).ok,
    ).toBe(false);
  });

  it('accepts between with [number, number]', () => {
    expect(
      validateRule(withCondition({ field: 'temperature_c', op: 'between', value: [10, 25] })).ok,
    ).toBe(true);
  });

  it('rejects between with wrong arity', () => {
    expect(
      validateRule(withCondition({ field: 'temperature_c', op: 'between', value: [10, 25, 30] })).ok,
    ).toBe(false);
  });

  it('accepts is_subset_of with set path', () => {
    expect(
      validateRule(
        withCondition({
          field: 'next_window.allowed_kinds',
          op: 'is_subset_of',
          set: 'window.allowed_kinds',
        }),
      ).ok,
    ).toBe(true);
  });

  it('rejects is_subset_of without set path', () => {
    expect(
      validateRule(
        withCondition({ field: 'next_window.allowed_kinds', op: 'is_subset_of' }),
      ).ok,
    ).toBe(false);
  });

  it('accepts exists (no value field needed)', () => {
    expect(
      validateRule(withCondition({ field: 'next_window', op: 'exists' })).ok,
    ).toBe(true);
  });

  it('accepts nested all/any/not', () => {
    expect(
      validateRule(
        withCondition({
          all: [
            { field: 'humidity_high', op: 'equals', value: true },
            {
              any: [
                { field: 'temperature_c', op: 'gt', value: 25 },
                { not: { field: 'session_type', op: 'equals', value: 'plaisir' } },
              ],
            },
          ],
        }),
      ).ok,
    ).toBe(true);
  });

  it('rejects unknown condition op', () => {
    expect(
      validateRule(withCondition({ field: 'temperature_c', op: 'is_close_to', value: 20 })).ok,
    ).toBe(false);
  });

  it('rejects an inner condition that is malformed (propagates error)', () => {
    const r = validateRule(
      withCondition({
        all: [
          { field: 'humidity_high', op: 'equals', value: true },
          { field: 'broken' },
        ],
      }),
    );
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/all/);
  });
});

describe('validateRuleList', () => {
  it('separates valid from invalid rules', () => {
    const result = validateRuleList([
      {
        ...baseFields,
        id: 'good-1',
        scope: 'race',
        condition: { always: true },
        action: { target: 'fluid_per_hour_ml', op: 'multiply', value: 1.15 },
      },
      { id: 'bad-1' }, // missing fields
      {
        ...baseFields,
        id: 'good-2',
        scope: 'race',
        condition: { always: true },
        action: { target: 'sodium_per_hour_mg', op: 'add', value: 100 },
      },
    ]);
    expect(result.rules.map((r) => r.id)).toEqual(['good-1', 'good-2']);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]).toMatch(/rule\[1\]/);
  });
});
