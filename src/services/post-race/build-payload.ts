/**
 * Construit le payload pour /api/analyze-race à partir des données mobile.
 *
 * Pure function : reçoit race + plan + logs + profile + foodItems, retourne
 * un AnalyzeRaceRequest prêt à envoyer. Cap les logs à 200 entries (cohérent
 * avec la validation côté endpoint).
 */

import type { EventLog } from '../../models/event-log';
import type { FoodItem } from '../../models/food-item';
import type { PersistedPlannedEvent } from '../../db/repos/planned-event-repo';
import type { Profile } from '../../models/profile';
import type { Race } from '../../models/race';
import type { AnalyzeRaceRequest } from './client';

const MAX_LOGS = 200;

export type BuildPayloadInput = {
  race: Race;
  profile: Profile;
  plannedEvents: PersistedPlannedEvent[];
  logs: EventLog[];
  foodItems: FoodItem[];
};

export function buildAnalyzePayload(input: BuildPayloadInput): AnalyzeRaceRequest {
  const { race, profile, plannedEvents, logs, foodItems } = input;
  const foodById = new Map(foodItems.map((it) => [it.id, it]));
  const plannedById = new Map(plannedEvents.map((e) => [e.id, e]));

  const startedAt = race.started_at ?? race.scheduled_start_at;
  const endedAt = race.ended_at ?? Date.now();
  const durationMinActual = Math.max(0, (endedAt - startedAt) / 60_000);

  const totalIntakesPlanned = plannedEvents.filter((e) => e.type === 'intake').length;
  const totalCheckInsPlanned = plannedEvents.filter((e) => e.type === 'check_in').length;

  // Targets : si on a un timeline_plan persisté, on utilise ses defaults.
  // Sinon on retombe sur le profil baseline.
  const carbs = race.timeline_plan?.race_targets.carbs_per_hour_g.default ?? profile.carbs_per_hour_g;
  const fluid = race.timeline_plan?.race_targets.fluid_per_hour_ml.default ?? profile.fluid_per_hour_ml;
  const sodium = race.timeline_plan?.race_targets.sodium_per_hour_mg.default ?? profile.sodium_per_hour_mg;

  const logsPayload = logs
    .sort((a, b) => a.logged_at - b.logged_at)
    .slice(0, MAX_LOGS)
    .map((log) => {
      const planned = log.planned_event_id ? plannedById.get(log.planned_event_id) : undefined;
      const at_min = Math.max(0, (log.logged_at - startedAt) / 60_000);
      const item = planned?.payload.food_item_id ? foodById.get(planned.payload.food_item_id) : undefined;
      return {
        ...(log.planned_event_id ? { planned_event_id: log.planned_event_id } : {}),
        type: (planned?.type ?? 'intake') as AnalyzeRaceRequest['logs'][number]['type'],
        at_min: Math.round(at_min * 10) / 10,
        status: log.status,
        ...(log.feeling ? { feeling: log.feeling } : {}),
        ...(item ? { item_kind: item.type } : {}),
      };
    });

  return {
    race_summary: {
      duration_min_actual: Math.round(durationMinActual),
      duration_min_planned: Math.round(race.estimated_duration_min),
      temperature_c: race.temperature_c,
      humidity_high: race.humidity_high,
      exposure: race.exposure,
      session_type: race.session_type,
      terrain_type: race.terrain_type,
      status: race.status === 'completed' ? 'completed' : 'abandoned',
    },
    profile_baseline: {
      carbs_per_hour_g: profile.carbs_per_hour_g,
      fluid_per_hour_ml: profile.fluid_per_hour_ml,
      sodium_per_hour_mg: profile.sodium_per_hour_mg,
    },
    plan_summary: {
      carbs_per_hour_g: carbs,
      fluid_per_hour_ml: fluid,
      sodium_per_hour_mg: sodium,
      total_intakes_planned: totalIntakesPlanned,
      total_check_ins_planned: totalCheckInsPlanned,
      was_enriched: race.timeline_plan?.generator.llm_enrichment_applied ?? false,
    },
    logs: logsPayload,
  };
}
