import bundledPackV1 from '../../../../assets/knowledge/v1.json';
import type { KnowledgePack } from '../../../models/knowledge-pack';
import { validateRuleList } from '../../rules/validate';

function buildTestPack(): KnowledgePack {
  const raw = bundledPackV1 as Record<string, unknown>;
  const rawRules = Array.isArray(raw.rules) ? raw.rules : [];
  const { rules, errors } = validateRuleList(rawRules);
  if (errors.length > 0) {
    // Tests should never see invalid base rules — fail loudly if v1.json drifts.
    throw new Error(`bundled v1 pack has invalid rules: ${errors.join('; ')}`);
  }
  return { ...(raw as Omit<KnowledgePack, 'rules'>), rules };
}

/**
 * The bundled v1 pack, fully validated, including parsed rules. Use this in
 * engine unit tests so the tests exercise the same constants and rules the
 * production app ships with.
 */
export const TEST_PACK: KnowledgePack = buildTestPack();

/**
 * Returns a deep clone of TEST_PACK with the given fields overridden.
 * Use sparingly — most tests should use TEST_PACK directly.
 */
export function makeTestPack(overrides?: Partial<KnowledgePack>): KnowledgePack {
  const clone = JSON.parse(JSON.stringify(TEST_PACK)) as KnowledgePack;
  return { ...clone, ...overrides };
}
