import { File, Paths } from 'expo-file-system';

import bundledPackV1 from '../../../assets/knowledge/v1.json';
import {
  SUPPORTED_PACK_MAJOR,
  type KnowledgePack,
} from '../../models/knowledge-pack';

const OVERRIDE_FILENAME = 'knowledge-pack.json';

/**
 * Loads the active knowledge pack. Looks first in the app's document directory
 * for a user-overridden file (pushed by the future web companion / by hand),
 * falling back to the bundled v1 pack shipped with the binary.
 *
 * Any unreadable, malformed, or major-version-mismatched override is silently
 * ignored — we always have the bundle as a safe baseline.
 */
export async function loadKnowledgePack(): Promise<KnowledgePack> {
  const overridden = await tryLoadOverride();
  if (overridden) return overridden;
  return bundledPackV1 as KnowledgePack;
}

async function tryLoadOverride(): Promise<KnowledgePack | null> {
  try {
    const file = new File(Paths.document, OVERRIDE_FILENAME);
    if (!file.exists) return null;
    const raw = await file.text();
    const parsed = JSON.parse(raw) as unknown;
    if (!isValidPack(parsed)) {
      console.warn('[knowledge-pack] override invalid, falling back to bundle');
      return null;
    }
    return parsed;
  } catch (err) {
    console.warn('[knowledge-pack] override load failed, falling back to bundle', err);
    return null;
  }
}

function isValidPack(value: unknown): value is KnowledgePack {
  if (typeof value !== 'object' || value === null) return false;
  const v = (value as { version?: unknown }).version;
  if (typeof v !== 'string') return false;
  const major = Number.parseInt(v.split('.')[0] ?? '', 10);
  return Number.isFinite(major) && major === SUPPORTED_PACK_MAJOR;
}
