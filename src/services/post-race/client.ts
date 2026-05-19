/**
 * Client HTTP pour /api/analyze-race.
 *
 * Même config que plan-enrichment (EXPO_PUBLIC_COMPANION_URL). Différent
 * endpoint, différentes propositions retournées. Pas appelé en course
 * (analyse post-course uniquement).
 */

import type {
  PostRaceProposal,
  ProfileAdjustmentField,
} from '../../models/post-race-analysis';

export type { PostRaceProposal, ProfileAdjustmentField };

const COMPANION_URL = process.env.EXPO_PUBLIC_COMPANION_URL ?? '';
const TIMEOUT_MS = 60_000; // analyse plus longue qu'un enrichment, sonnet vs haiku

export type AnalyzeRaceRequest = {
  race_summary: {
    duration_min_actual: number;
    duration_min_planned: number;
    temperature_c: number;
    humidity_high: boolean;
    exposure: string;
    session_type: string;
    terrain_type: string;
    status: 'completed' | 'abandoned';
  };
  profile_baseline: {
    carbs_per_hour_g: number;
    fluid_per_hour_ml: number;
    sodium_per_hour_mg: number;
  };
  plan_summary: {
    carbs_per_hour_g: number;
    fluid_per_hour_ml: number;
    sodium_per_hour_mg: number;
    total_intakes_planned: number;
    total_check_ins_planned: number;
    was_enriched: boolean;
  };
  logs: Array<{
    planned_event_id?: string;
    type: 'intake' | 'fluid_reminder' | 'check_in' | 'aid_station';
    at_min: number;
    status: 'done' | 'skipped';
    feeling?: 'good' | 'meh' | 'bad';
    item_kind?: string;
  }>;
};

export type AnalyzeRaceResponse = {
  summary_fr: string;
  proposals: PostRaceProposal[];
  usage: { inputTokens: number; outputTokens: number };
};

export type AnalyzeRaceFailure = {
  ok: false;
  reason: 'no_url_configured' | 'offline' | 'timeout' | 'http_error' | 'invalid_response';
  detail?: string;
  status?: number;
};

export type AnalyzeRaceSuccess = { ok: true; response: AnalyzeRaceResponse };
export type AnalyzeRaceResult = AnalyzeRaceSuccess | AnalyzeRaceFailure;

export async function analyzeRace(
  payload: AnalyzeRaceRequest,
): Promise<AnalyzeRaceResult> {
  if (!COMPANION_URL) return { ok: false, reason: 'no_url_configured' };

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const res = await fetch(`${COMPANION_URL.replace(/\/$/, '')}/api/analyze-race`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
    clearTimeout(timer);

    if (!res.ok) {
      const text = await res.text().catch(() => '');
      return { ok: false, reason: 'http_error', status: res.status, detail: text.slice(0, 500) };
    }

    const body = (await res.json()) as AnalyzeRaceResponse;
    if (!Array.isArray(body.proposals) || typeof body.summary_fr !== 'string') {
      return { ok: false, reason: 'invalid_response', detail: 'missing fields' };
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

export function describeAnalyzeFailure(failure: AnalyzeRaceFailure): string {
  switch (failure.reason) {
    case 'no_url_configured': return 'Companion non configuré (EXPO_PUBLIC_COMPANION_URL absent)';
    case 'offline':           return `Réseau indisponible : ${failure.detail ?? ''}`;
    case 'timeout':           return `Timeout (>${TIMEOUT_MS / 1000}s) — Claude trop lent`;
    case 'http_error':        return `Companion HTTP ${failure.status} : ${failure.detail ?? ''}`;
    case 'invalid_response':  return `Réponse companion invalide : ${failure.detail ?? ''}`;
  }
}
