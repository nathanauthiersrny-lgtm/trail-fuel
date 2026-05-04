import type { FoodItem } from '../../models/food-item';
import type { PlannedEvent, PlanWarning } from '../../models/planned-event';
import type { Profile } from '../../models/profile';
import type { Race } from '../../models/race';

import { adjustCollisions } from './adjust-collisions';
import { buildAidStationEvents } from './aid-stations';
import type { DraftEvent } from './check-ins';
import { buildCheckIns } from './check-ins';
import { placeFluidReminders } from './fluid-reminders';
import { mergeEvents } from './merge';
import { computeEffectiveRates } from './needs';
import { placeIntakes } from './placement';
import { resolveParams } from './resolve-params';
import { buildTimeline } from './timeline';
import { buildWindows } from './windows';

export type GeneratePlanInput = {
  profile: Profile;
  race: Race;
  foodItems: FoodItem[];
  now: number;
};

export type GeneratePlanResult = {
  events: PlannedEvent[];
  warnings: PlanWarning[];
};

export function generatePlan(input: GeneratePlanInput): GeneratePlanResult {
  const { profile, race, foodItems } = input;

  const timeline = buildTimeline(race);
  const params = resolveParams({ profile, race, durationMin: timeline.totalDurationMin });

  const rates = computeEffectiveRates({
    params,
    durationMin: timeline.totalDurationMin,
    foodItems,
    inventory: race.inventory,
    aidStations: race.aid_stations,
    refillInNature: race.refill_in_nature,
  });

  const windows = buildWindows({
    totalDurationMin: timeline.totalDurationMin,
    gpxTrack: race.gpx_track,
  });

  const checkInDrafts = buildCheckIns({
    totalDurationMin: timeline.totalDurationMin,
    firstCheckInMin: 30,
    frequencyMin: params.check_in_frequency_min,
  });

  const intakeDrafts = placeIntakes({
    windows,
    params,
    totalDurationMin: timeline.totalDurationMin,
    foodItems,
    inventory: race.inventory,
  });

  const fluidDrafts = placeFluidReminders({
    effectiveFluidPerH: rates.effective.fluid_per_hour_ml,
    totalDurationMin: timeline.totalDurationMin,
  });

  const aidDrafts = buildAidStationEvents({
    aidStations: race.aid_stations,
    aidStationMinutes: timeline.aidStationMinutes,
    totalDurationMin: timeline.totalDurationMin,
  });

  const merged = mergeEvents([...intakeDrafts, ...checkInDrafts, ...fluidDrafts, ...aidDrafts]);
  const adjusted = adjustCollisions(merged);
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
