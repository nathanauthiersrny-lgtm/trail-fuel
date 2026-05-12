import bundledPackV1 from '../../../../assets/knowledge/v1.json';
import type { KnowledgePack } from '../../../models/knowledge-pack';

/**
 * The bundled v1 pack, typed. Use this in engine unit tests so the tests
 * exercise the same constants the production app ships with.
 */
export const TEST_PACK: KnowledgePack = bundledPackV1 as KnowledgePack;

/**
 * Returns a deep clone of TEST_PACK with the given fields overridden.
 * Use sparingly — most tests should use TEST_PACK directly to keep them
 * aligned with what the app actually runs.
 */
export function makeTestPack(overrides?: Partial<KnowledgePack>): KnowledgePack {
  const clone = JSON.parse(JSON.stringify(TEST_PACK)) as KnowledgePack;
  return { ...clone, ...overrides };
}
