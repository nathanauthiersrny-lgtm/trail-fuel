/**
 * Orchestrateur haut niveau : produit un plan utilisable par le runtime
 * (PlannedEvent[]) en combinant :
 *   1. l'engine builder déterministe (TimelinePlan brut)
 *   2. l'enrichissement LLM optionnel (TimelinePlan enrichi via companion)
 *   3. l'adapter TimelinePlan → PlannedEvent[]
 *
 * Si l'enrichissement échoue (no_url/offline/timeout/erreur), on continue
 * proprement avec le plan brut. Le runtime ne voit pas la différence.
 *
 * Cible : remplacer à terme l'appel `generatePlan` du vieux pipeline.
 * Pour l'instant les deux coexistent — voir A.5 pour la bascule complète.
 */

import type { FoodItem } from '../../models/food-item';
import type { PlannedEvent, PlanWarning } from '../../models/planned-event';
import type { Profile } from '../../models/profile';
import type { Race } from '../../models/race';
import type { TimelinePlan } from '../../models/timeline-plan';
import { buildPlan } from '../../engine/builder/build-plan';
import { timelinePlanToEvents } from '../../engine/builder/timeline-plan-to-events';
import {
  describeFailure,
  enrichPlan as callEnrichmentApi,
  type EnrichRequestRaceContext,
} from './client';

export type OrchestratorMode = 'engine_only' | 'try_enrich';

export type OrchestratorInput = {
  profile: Profile;
  race: Race;
  foodItems: FoodItem[];
  mode: OrchestratorMode;
  now?: Date;
};

export type OrchestratorResult = {
  /** Plan exécutable par le runtime (legacy shape). */
  events: PlannedEvent[];
  /** Warnings cumulés (engine + adapter + enrichment failures). */
  warnings: PlanWarning[];
  /** Plan brut produit par l'engine (avant enrichment). */
  brutPlan: TimelinePlan;
  /** Plan finalement utilisé (brut si pas enrichi, enrichi sinon). */
  finalPlan: TimelinePlan;
  /** True si l'enrichment LLM a été appliqué avec succès. */
  wasEnriched: boolean;
  /** Métadonnées d'enrichment si dispo. */
  enrichmentMeta?: {
    appliedOps: number;
    rejectedOps: number;
    articlesUsed: string[];
    tokensInput: number;
    tokensOutput: number;
    cacheReadTokens: number;
    cacheWriteTokens: number;
  };
};

export async function generateEnrichedPlan(
  input: OrchestratorInput,
): Promise<OrchestratorResult> {
  const { profile, race, foodItems, mode, now } = input;

  const { plan: brutPlan, totalDurationMin } = buildPlan({ profile, race, now });
  const warnings: PlanWarning[] = [];

  let finalPlan = brutPlan;
  let wasEnriched = false;
  let enrichmentMeta: OrchestratorResult['enrichmentMeta'] | undefined;

  if (mode === 'try_enrich') {
    const result = await callEnrichmentApi({
      brutPlan,
      raceContext: buildRaceContext(race, totalDurationMin, foodItems),
    });
    if (result.ok) {
      finalPlan = result.response.plan;
      wasEnriched = true;
      enrichmentMeta = {
        appliedOps: result.response.applied.length,
        rejectedOps: result.response.rejected.length,
        articlesUsed: result.response.articles_considered.map((a) => a.slug),
        tokensInput: result.response.usage.inputTokens,
        tokensOutput: result.response.usage.outputTokens,
        cacheReadTokens: result.response.usage.cacheReadTokens,
        cacheWriteTokens: result.response.usage.cacheWriteTokens,
      };
    } else {
      // Fallback transparent. On garde la trace en warning bas niveau.
      warnings.push({
        severity: 'low',
        code: 'enrichment_unavailable',
        message: `Enrichment LLM indisponible — plan brut conservé. ${describeFailure(result)}`,
      });
    }
  }

  const adapted = timelinePlanToEvents({
    plan: finalPlan,
    foodItems,
    inventory: race.inventory,
  });

  return {
    events: adapted.events,
    warnings: [...warnings, ...adapted.warnings],
    brutPlan,
    finalPlan,
    wasEnriched,
    enrichmentMeta,
  };
}

// ─── Race context builder ───────────────────────────────────────────────────

function buildRaceContext(
  race: Race,
  durationMin: number,
  foodItems: FoodItem[],
): EnrichRequestRaceContext {
  const itemsById = new Map(foodItems.map((it) => [it.id, it]));

  // Agrège l'inventaire par kind pour réduire la taille du payload (et
  // éviter de leak des item ids privés au LLM).
  const byKind = new Map<string, { count: number; total_carbs_g: number }>();
  for (const slot of race.inventory) {
    const item = itemsById.get(slot.food_item_id);
    if (!item) continue;
    const cur = byKind.get(item.type) ?? { count: 0, total_carbs_g: 0 };
    cur.count += slot.quantity;
    cur.total_carbs_g += item.carbs_g * slot.quantity;
    byKind.set(item.type, cur);
  }
  const inventory_summary = Array.from(byKind.entries()).map(([kind, v]) => ({
    kind,
    count: v.count,
    total_carbs_g: Math.round(v.total_carbs_g),
  }));

  const filter_tags = buildFilterTags(race);
  const gpx_summary = race.gpx_track
    ? {
        total_climb_m: Math.round(race.elevation_gain_m ?? race.gpx_track.elevation_gain_m ?? 0),
        total_descent_m: Math.round(race.elevation_loss_m ?? race.gpx_track.elevation_loss_m ?? 0),
      }
    : undefined;

  return {
    duration_min: Math.round(durationMin),
    distance_km: race.gpx_track?.total_distance_km ?? race.distance_km ?? 0,
    session_type: race.session_type,
    intensity: race.intensity,
    temperature_c: race.temperature_c,
    humidity_high: race.humidity_high,
    exposure: race.exposure,
    terrain_type: race.terrain_type,
    inventory_summary,
    has_gpx: !!race.gpx_track,
    gpx_summary,
    filter_tags,
  };
}

/**
 * Mappe les caractéristiques de la race en tags utilisés pour filtrer la KB
 * côté companion. Cohérent avec le frontmatter des articles markdown.
 */
function buildFilterTags(race: Race): EnrichRequestRaceContext['filter_tags'] {
  const terrain: string[] = ['trail'];
  if (race.gpx_track && (race.gpx_track.total_distance_km ?? 0) >= 50) terrain.push('ultra');
  if (race.terrain_type === 'technical' || race.terrain_type === 'alpine') terrain.push('technical');
  if (race.terrain_type === 'alpine') terrain.push('alpine');
  if (race.terrain_type === 'road') terrain.push('road');

  const conditions: string[] = [];
  if (race.temperature_c >= 25) conditions.push('heat');
  else if (race.temperature_c <= 10) conditions.push('cold');
  else conditions.push('normal');
  if (race.humidity_high) conditions.push('humid');

  return { terrain, conditions };
}
