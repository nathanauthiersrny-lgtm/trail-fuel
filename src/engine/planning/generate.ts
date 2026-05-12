import type { FoodItem } from '../../models/food-item';
import type { KnowledgePack } from '../../models/knowledge-pack';
import type { PlannedEvent, PlanWarning } from '../../models/planned-event';
import type { Profile } from '../../models/profile';
import type { Race } from '../../models/race';

import { buildRaceContext } from '../rules/context';

import { adjustCollisions } from './adjust-collisions';
import { buildAidStationEvents } from './aid-stations';
import type { DraftEvent } from './check-ins';
import { buildCheckIns } from './check-ins';
import { placeFluidReminders } from './fluid-reminders';
import { mergeEvents, offsetFluidsNearIntakes } from './merge';
import { computeEffectiveRates } from './needs';
import { placeIntakes } from './placement';
import { resolveParams } from './resolve-params';
import { buildTimeline } from './timeline';
import { buildWindows } from './windows';

// Plafond du warmup (mn) au-delà duquel placeIntakes ne pose rien. Réduit
// uniquement par override `first_intake_after_min` plus petit.
const PLACEMENT_WARMUP_CAP_MIN = 20;

export type GeneratePlanInput = {
  profile: Profile;
  race: Race;
  foodItems: FoodItem[];
  now: number;
  pack: KnowledgePack;
};

export type GeneratePlanResult = {
  events: PlannedEvent[];
  warnings: PlanWarning[];
};

export function generatePlan(input: GeneratePlanInput): GeneratePlanResult {
  const { profile, race, foodItems, pack } = input;

  const timeline = buildTimeline(race);
  const params = resolveParams({ profile, race, durationMin: timeline.totalDurationMin, pack });

  const rates = computeEffectiveRates({
    params,
    durationMin: timeline.totalDurationMin,
    foodItems,
    inventory: race.inventory,
    aidStations: race.aid_stations,
    refillInNature: race.refill_in_nature,
    pack,
  });

  // Si l'override `first_intake_after_min` est plus petit que la fenêtre warmup
  // par défaut (20 min), on abaisse le start des windows pour que placeIntakes
  // puisse réellement placer un intake avant la minute 20.
  const firstWindowStartMin = Math.min(
    PLACEMENT_WARMUP_CAP_MIN,
    params.first_intake_after_min,
  );

  const windows = buildWindows({
    totalDurationMin: timeline.totalDurationMin,
    gpxTrack: race.gpx_track,
    firstWindowStartMin,
  });

  // first_intake_after_min sert aussi de "warmup" pour les check-ins. Avant, c'était
  // hardcodé à 30 ; on aligne sur le param pour qu'un override flow correctement.
  const checkInDrafts = buildCheckIns({
    totalDurationMin: timeline.totalDurationMin,
    firstCheckInMin: params.first_intake_after_min,
    frequencyMin: params.check_in_frequency_min,
  });

  const raceContext = buildRaceContext(profile, race, timeline.totalDurationMin);

  const intakeDrafts = placeIntakes({
    windows,
    params,
    totalDurationMin: timeline.totalDurationMin,
    foodItems,
    inventory: race.inventory,
    raceContext,
    pack,
    intakeIntervalMin: params.intake_interval_min,
  });

  const fluidDrafts = placeFluidReminders({
    effectiveFluidPerH: rates.effective.fluid_per_hour_ml,
    totalDurationMin: timeline.totalDurationMin,
    firstReminderMin: params.first_fluid_reminder_min,
    intervalMin: params.fluid_reminder_interval_min,
  });

  const aidDrafts = buildAidStationEvents({
    aidStations: race.aid_stations,
    aidStationMinutes: timeline.aidStationMinutes,
    totalDurationMin: timeline.totalDurationMin,
  });

  const merged = mergeEvents([...intakeDrafts, ...checkInDrafts, ...fluidDrafts, ...aidDrafts]);
  const offset = offsetFluidsNearIntakes(merged);
  const adjusted = adjustCollisions(offset);
  const sorted = [...adjusted].sort((a, b) => a.scheduled_at_minute - b.scheduled_at_minute);
  const events = assignIds(sorted, race.id);

  const warnings = buildRationingWarnings(rates);

  return { events, warnings };
}

function buildRationingWarnings(rates: ReturnType<typeof computeEffectiveRates>): PlanWarning[] {
  const warnings: PlanWarning[] = [];
  if (rates.isRationing.carbs) {
    const eff = Math.round(rates.effective.carbs_per_hour_g);
    const tgt = Math.round(rates.target.carbs_per_hour_g);
    warnings.push({
      severity: 'medium',
      code: 'carbs_rationing',
      message: `Inventaire glucides insuffisant : plan ajusté à ${eff}g/h au lieu de ${tgt}g/h.`,
      data: { target_g_per_h: tgt, effective_g_per_h: eff },
    });
  }
  if (rates.isRationing.fluid) {
    const eff = Math.round(rates.effective.fluid_per_hour_ml);
    const tgt = Math.round(rates.target.fluid_per_hour_ml);
    warnings.push({
      severity: 'medium',
      code: 'fluid_rationing',
      message: `Inventaire fluide insuffisant : plan ajusté à ${eff}ml/h au lieu de ${tgt}ml/h.`,
      data: { target_ml_per_h: tgt, effective_ml_per_h: eff },
    });
  }
  return warnings;
}

function assignIds(drafts: DraftEvent[], raceId: string): PlannedEvent[] {
  return drafts.map((d, i) => ({
    id: `${raceId}::event-${i}`,
    race_id: raceId,
    scheduled_at_minute: d.scheduled_at_minute,
    type: d.type,
    payload: d.payload,
  }));
}
