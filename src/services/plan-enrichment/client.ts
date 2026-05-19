/**
 * Client HTTP pour appeler le companion /api/generate-plan.
 *
 * Le runtime mobile reste 100% offline si :
 *   - le user n'a pas configuré d'URL companion (EXPO_PUBLIC_COMPANION_URL)
 *   - le réseau est down
 *   - l'endpoint répond une erreur
 *
 * Dans tous ces cas, on retourne null + warning. Le caller fallback sur le
 * brut plan (cf. doc Phase A "fallback companion down").
 */

import type { TimelinePlan } from '../../models/timeline-plan';

const COMPANION_URL = process.env.EXPO_PUBLIC_COMPANION_URL ?? '';
const TIMEOUT_MS = 30_000;

export type EnrichRequestRaceContext = {
  duration_min: number;
  distance_km: number;
  session_type: string;
  intensity: string;
  temperature_c: number;
  humidity_high: boolean;
  exposure: string;
  terrain_type: string;
  inventory_summary: Array<{ kind: string; total_carbs_g: number; count: number }>;
  has_gpx: boolean;
  gpx_summary?: {
    total_climb_m: number;
    total_descent_m: number;
    notable_climbs?: Array<{ from_km: number; to_km: number; avg_grade: number }>;
  };
  filter_tags: {
    terrain: string[];
    conditions: string[];
    profile?: string;
  };
};

export type EnrichResponse = {
  plan: TimelinePlan;
  applied: unknown[];
  rejected: Array<{ op: unknown; reason: string }>;
  articles_considered: Array<{ slug: string; title: string; quality: string }>;
  usage: {
    inputTokens: number;
    outputTokens: number;
    cacheReadTokens: number;
    cacheWriteTokens: number;
  };
};

export type EnrichFailure = {
  ok: false;
  reason: 'no_url_configured' | 'offline' | 'timeout' | 'http_error' | 'invalid_response';
  detail?: string;
  status?: number;
};

export type EnrichSuccess = { ok: true; response: EnrichResponse };

export type EnrichResult = EnrichSuccess | EnrichFailure;

export async function enrichPlan(input: {
  brutPlan: TimelinePlan;
  raceContext: EnrichRequestRaceContext;
}): Promise<EnrichResult> {
  if (!COMPANION_URL) {
    return { ok: false, reason: 'no_url_configured' };
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const res = await fetch(`${COMPANION_URL.replace(/\/$/, '')}/api/generate-plan`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        brutPlan: input.brutPlan,
        raceContext: input.raceContext,
      }),
      signal: controller.signal,
    });
    clearTimeout(timer);

    if (!res.ok) {
      const text = await res.text().catch(() => '');
      return { ok: false, reason: 'http_error', status: res.status, detail: text.slice(0, 500) };
    }

    const body = (await res.json()) as EnrichResponse;
    if (!body.plan || body.plan.version !== 1) {
      return { ok: false, reason: 'invalid_response', detail: 'missing or wrong version' };
    }
    return { ok: true, response: body };
  } catch (err) {
    clearTimeout(timer);
    if (err instanceof Error && err.name === 'AbortError') {
      return { ok: false, reason: 'timeout' };
    }
    return {
      ok: false,
      reason: 'offline',
      detail: err instanceof Error ? err.message : String(err),
    };
  }
}

export function describeFailure(failure: EnrichFailure): string {
  switch (failure.reason) {
    case 'no_url_configured': return 'Companion non configuré (EXPO_PUBLIC_COMPANION_URL absent)';
    case 'offline':           return `Réseau indisponible : ${failure.detail ?? ''}`;
    case 'timeout':           return `Timeout (>${TIMEOUT_MS / 1000}s)`;
    case 'http_error':        return `Companion HTTP ${failure.status} : ${failure.detail ?? ''}`;
    case 'invalid_response':  return `Réponse companion invalide : ${failure.detail ?? ''}`;
  }
}
