import { resolveParams } from '../../planning/resolve-params';
import { makeBaseProfile, makeBaseRace } from '../fixtures/races/base-race';
import { makeTestPack, TEST_PACK } from '../test-helpers/knowledge-pack';

describe('resolveParams — rules engine integration', () => {
  it('applies a custom overlay rule injected into the pack', () => {
    const customPack = makeTestPack({
      rules: [
        ...TEST_PACK.rules,
        {
          id: 'test-custom-add-50-carbs',
          source: 'overlay',
          category: 'nutrition',
          scope: 'race',
          description: 'Add 50g carbs always',
          condition: { always: true },
          action: { target: 'carbs_per_hour_g', op: 'add', value: 50 },
        },
      ],
    });
    const params = resolveParams({
      profile: makeBaseProfile({ carbs_per_hour_g: 60 }),
      race: makeBaseRace({ session_type: 'long' }), // long = no carbs modifier
      durationMin: 180,
      pack: customPack,
    });
    // 60 (profile) + 50 (overlay rule) = 110, no further multiplier on `long`
    expect(params.carbs_per_hour_g).toBe(110);
  });

  it('lets the user override carbs and skip the rule pipeline for that field', () => {
    const customPack = makeTestPack({
      rules: [
        ...TEST_PACK.rules,
        {
          id: 'test-add-1000-carbs',
          source: 'overlay',
          category: 'nutrition',
          scope: 'race',
          description: 'Should be skipped because user overrode carbs',
          condition: { always: true },
          action: { target: 'carbs_per_hour_g', op: 'add', value: 1000 },
        },
      ],
    });
    const params = resolveParams({
      profile: makeBaseProfile({ carbs_per_hour_g: 60 }),
      race: makeBaseRace({
        session_type: 'long',
        overrides: { carbs_per_hour_g: 80 },
      }),
      durationMin: 180,
      pack: customPack,
    });
    // Override wins, rule does not apply
    expect(params.carbs_per_hour_g).toBe(80);
  });

  it('applies an expression-based rule (validates expr pipeline integration)', () => {
    const customPack = makeTestPack({
      rules: [
        {
          id: 'test-expr-rule',
          source: 'overlay',
          category: 'nutrition',
          scope: 'race',
          description: 'Add duration_min / 10 to sodium',
          condition: { always: true },
          action: {
            target: 'sodium_per_hour_mg',
            op: 'add',
            value: { expr: 'duration_min / 10' },
          },
        },
      ],
    });
    const params = resolveParams({
      profile: makeBaseProfile({ sodium_per_hour_mg: 500 }),
      race: makeBaseRace(),
      durationMin: 180,
      pack: customPack,
    });
    // 500 + 18 = 518, then sodium clamp [300, 1000] → 518
    expect(params.sodium_per_hour_mg).toBe(518);
  });
});
