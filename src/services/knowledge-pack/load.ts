import { File, Paths } from 'expo-file-system';

import bundledPackV1 from '../../../assets/knowledge/v1.json';
import { validateRuleList } from '../../engine/rules/validate';
import {
  SUPPORTED_PACK_MAJOR,
  type KnowledgePack,
  type KnowledgePackOverlay,
} from '../../models/knowledge-pack';

import { mergeKnowledgePack } from './merge';

const OVERLAY_FILENAME = 'knowledge-pack.json';

/**
 * Loads the active knowledge pack. Always loads the bundled v1 baseline,
 * then deep-merges an optional override file from the app's document directory
 * if one exists (and parses cleanly with a compatible major version).
 *
 * The override file is a PARTIAL overlay : only the fields it specifies get
 * merged into the base. Rules merge by id (overlay replaces base on same id,
 * or appends as new). Invalid rules are filtered with a warning rather than
 * crashing the pack.
 */
export async function loadKnowledgePack(): Promise<KnowledgePack> {
  const base = finalizeBundle();
  const overlay = await tryLoadOverlay();
  if (!overlay) return base;
  return mergeKnowledgePack(base, overlay);
}

function finalizeBundle(): KnowledgePack {
  const raw = bundledPackV1 as Record<string, unknown>;
  const rawRules = Array.isArray(raw.rules) ? raw.rules : [];
  const { rules, errors } = validateRuleList(rawRules);
  if (errors.length > 0) {
    console.warn('[knowledge-pack:bundle] invalid rules in v1.json:', errors);
  }
  return { ...(raw as Omit<KnowledgePack, 'rules'>), rules };
}

async function tryLoadOverlay(): Promise<KnowledgePackOverlay | null> {
  try {
    const file = new File(Paths.document, OVERLAY_FILENAME);
    if (!file.exists) return null;
    const raw = await file.text();
    const parsed = JSON.parse(raw) as unknown;
    if (!isValidOverlayEnvelope(parsed)) {
      console.warn('[knowledge-pack:overlay] invalid envelope, falling back to bundle only');
      return null;
    }
    return finalizeOverlay(parsed as Record<string, unknown>);
  } catch (err) {
    console.warn('[knowledge-pack:overlay] load failed, falling back to bundle only', err);
    return null;
  }
}

function finalizeOverlay(raw: Record<string, unknown>): KnowledgePackOverlay {
  // Validate + filter rules. Anything else is passed through as-is; the merge
  // function does shallow per-section override and tolerates partial shapes.
  let rules: KnowledgePackOverlay['rules'] = undefined;
  if (Array.isArray(raw.rules)) {
    const { rules: valid, errors } = validateRuleList(raw.rules);
    if (errors.length > 0) {
      console.warn(`[knowledge-pack:overlay] dropped ${errors.length} invalid rule(s):`, errors);
    }
    rules = valid;
  }
  return { ...(raw as Omit<KnowledgePackOverlay, 'rules'>), rules };
}

function isValidOverlayEnvelope(value: unknown): boolean {
  if (typeof value !== 'object' || value === null) return false;
  const v = (value as { version?: unknown }).version;
  if (typeof v !== 'string') return false;
  const major = Number.parseInt(v.split('.')[0] ?? '', 10);
  return Number.isFinite(major) && major === SUPPORTED_PACK_MAJOR;
}
