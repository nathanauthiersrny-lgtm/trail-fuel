import * as DocumentPicker from 'expo-document-picker';
import { File, Paths } from 'expo-file-system';

import { SUPPORTED_PACK_MAJOR } from '../../models/knowledge-pack';

const OVERLAY_FILENAME = 'knowledge-pack.json';

export type ImportResult =
  | { ok: true; ruleCount: number; version: string }
  | { ok: false; error: string };

export type OverlayStatus = {
  present: boolean;
  /** File mtime (ms), only meaningful when present=true. */
  modifiedAt?: number;
  /** Size in bytes, present=true only. */
  sizeBytes?: number;
};

/**
 * Launches the document picker, validates the chosen file is a usable overlay,
 * and writes it to the app's document directory under the standard filename.
 * The pack loader will pick it up at the next launch.
 *
 * Returns ImportResult so the caller can surface a tailored message.
 */
export async function pickAndImportOverlay(): Promise<ImportResult> {
  const picked = await DocumentPicker.getDocumentAsync({
    type: 'application/json',
    copyToCacheDirectory: true,
  });
  if (picked.canceled) return { ok: false, error: 'cancelled' };
  const asset = picked.assets[0];
  if (!asset) return { ok: false, error: 'no file selected' };

  try {
    const srcFile = new File(asset.uri);
    const raw = await srcFile.text();
    const parsed = JSON.parse(raw) as unknown;
    if (!isObject(parsed)) {
      return { ok: false, error: 'not a JSON object' };
    }
    const versionCheck = checkVersion(parsed);
    if (!versionCheck.ok) return versionCheck;
    const ruleCount = Array.isArray((parsed as { rules?: unknown }).rules)
      ? ((parsed as { rules: unknown[] }).rules.length)
      : 0;

    const dest = new File(Paths.document, OVERLAY_FILENAME);
    if (dest.exists) dest.delete();
    dest.create();
    await dest.write(raw);

    return { ok: true, ruleCount, version: versionCheck.version };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

export function getOverlayStatus(): OverlayStatus {
  try {
    const file = new File(Paths.document, OVERLAY_FILENAME);
    if (!file.exists) return { present: false };
    return {
      present: true,
      modifiedAt: file.modificationTime ?? undefined,
      sizeBytes: file.size ?? undefined,
    };
  } catch {
    return { present: false };
  }
}

export function deleteOverlay(): { ok: boolean; error?: string } {
  try {
    const file = new File(Paths.document, OVERLAY_FILENAME);
    if (file.exists) file.delete();
    return { ok: true };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function checkVersion(parsed: Record<string, unknown>):
  | { ok: true; version: string }
  | { ok: false; error: string } {
  const v = parsed.version;
  if (typeof v !== 'string') {
    return { ok: false, error: 'overlay missing or invalid "version" field' };
  }
  const major = Number.parseInt(v.split('.')[0] ?? '', 10);
  if (!Number.isFinite(major) || major !== SUPPORTED_PACK_MAJOR) {
    return {
      ok: false,
      error: `overlay version ${v} not compatible (need major ${SUPPORTED_PACK_MAJOR})`,
    };
  }
  return { ok: true, version: v };
}
