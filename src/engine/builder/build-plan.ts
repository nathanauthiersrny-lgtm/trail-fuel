/**
 * buildPlan — orchestrateur de l'engine déterministe.
 *
 * Produit un TimelinePlan brut à partir d'un Profile et d'une Race. Aucun
 * LLM ici, juste de la logique TS directe. Le companion appellera ce builder
 * puis enrichira le résultat via Claude (cf. lib/plan-builder côté companion).
 *
 * Le runtime mobile peut aussi appeler buildPlan directement quand le mode
 * "enrichissement LLM" est désactivé ou que le companion est indisponible
 * (fallback offline-only).
 */

import type { Profile } from '../../models/profile';
import type { Race } from '../../models/race';
import type { TimelinePlan } from '../../models/timeline-plan';
import { TIMELINE_PLAN_VERSION } from '../../models/timeline-plan';
import { buildTimeline } from '../planning/timeline';
import { buildWindows } from '../planning/windows';
import { SESSION_DEFAULTS, PARAM_DEFAULTS } from './constants';
import { placeEvents } from './placement';
import { validatePlan } from './safety';
import { computeRaceTargets } from './targets';

export const ENGINE_VERSION = '2.0.0-a2' as const;

export type BuildPlanInput = {
  profile: Profile;
  race: Race;
  now?: Date; // injecté pour testabilité
};

export type BuildPlanResult = {
  plan: TimelinePlan;
  /** Durée totale estimée — utile aux callers (companion enrichment, UI debug). */
  totalDurationMin: number;
};

export function buildPlan(input: BuildPlanInput): BuildPlanResult {
  const { profile, race, now = new Date() } = input;

  const timeline = buildTimeline(race);
  const totalDurationMin = timeline.totalDurationMin;
  const session = SESSION_DEFAULTS[race.session_type];

  const raceTargets = computeRaceTargets({ profile, race, durationMin: totalDurationMin });

  const firstIntakeAfterMin = race.overrides?.first_intake_after_min ?? PARAM_DEFAULTS.first_intake_after_min;
  const intakeIntervalMin = race.overrides?.intake_interval_min ?? PARAM_DEFAULTS.intake_interval_min;
  const checkInFrequencyMin = race.overrides?.check_in_frequency_min ?? session.check_in_freq_min;
  const firstFluidReminderMin = race.overrides?.first_fluid_reminder_min ?? PARAM_DEFAULTS.first_fluid_reminder_min;
  const fluidReminderIntervalMin = race.overrides?.fluid_reminder_interval_min ?? PARAM_DEFAULTS.fluid_reminder_interval_min;

  const windows = buildWindows({
    totalDurationMin,
    gpxTrack: race.gpx_track,
    firstWindowStartMin: Math.min(20, firstIntakeAfterMin),
  });

  const aidStationMinutes = race.aid_stations.map(
    (a) => timeline.aidStationMinutes.get(a.id) ?? -1,
  );

  const events = placeEvents({
    totalDurationMin,
    windows,
    aidStations: race.aid_stations,
    aidStationMinutes,
    raceTargets,
    firstIntakeAfterMin,
    intakeIntervalMin,
    checkInFrequencyMin,
    firstFluidReminderMin,
    fluidReminderIntervalMin,
  });

  // Branche par défaut : si 3 skips dans la dernière heure, booster le prochain.
  // C'est une garde minimale ; le LLM enrichment peut en ajouter d'autres
  // selon les articles KB. Voir docs/timeline-plan-examples/.
  const branches: TimelinePlan['branches'] = [
    {
      id: 'br-skip-recovery',
      trigger: { type: 'skipped_count', window_min: 60, operator: '>=', value: 3 },
      action: { type: 'boost_next_intake', factor: 1.5 },
      why: 'Si 3 skips en 1h : prochain intake +50% pour compenser le déficit',
      source: 'engine',
      max_fires: 3,
    },
  ];

  const plan: TimelinePlan = {
    version: TIMELINE_PLAN_VERSION,
    race_id: race.id,
    generated_at: now.toISOString(),
    generator: {
      engine_version: ENGINE_VERSION,
      llm_enrichment_applied: false,
    },
    race_targets: raceTargets,
    events,
    branches,
    validation: { passed: true, warnings: [] }, // remplacé juste après
  };

  plan.validation = validatePlan(plan, { totalDurationMin });
  return { plan, totalDurationMin };
}
