import type { AidStation } from '../../models/aid-station';
import type { FoodItem } from '../../models/food-item';
import type { KnowledgePack } from '../../models/knowledge-pack';
import type { InventoryItem } from '../../models/race';

import type { ResolvedParams } from './resolve-params';

export type Needs = {
  totalCarbs_g: number;
  totalFluid_ml: number;
  totalSodium_mg: number;
  durationHours: number;
};

export function computeNeeds(input: {
  params: ResolvedParams;
  durationMin: number;
  pack: KnowledgePack;
}): Needs {
  const { params, durationMin, pack } = input;
  const durationHours = durationMin / 60;
  return {
    totalCarbs_g: reducedTotal(params.carbs_per_hour_g, durationMin, pack),
    totalFluid_ml: reducedTotal(params.fluid_per_hour_ml, durationMin, pack),
    totalSodium_mg: reducedTotal(params.sodium_per_hour_mg, durationMin, pack),
    durationHours,
  };
}

// ─── Effective rates (rationing) ─────────────────────────────────────────────

export type EffectiveRates = {
  effective: { carbs_per_hour_g: number; fluid_per_hour_ml: number };
  target: { carbs_per_hour_g: number; fluid_per_hour_ml: number };
  isRationing: { carbs: boolean; fluid: boolean };
};

export function computeEffectiveRates(input: {
  params: ResolvedParams;
  durationMin: number;
  foodItems: FoodItem[];
  inventory: InventoryItem[];
  aidStations: AidStation[];
  refillInNature: boolean;
  pack: KnowledgePack;
}): EffectiveRates {
  const { params, durationMin, foodItems, inventory, aidStations, refillInNature, pack } = input;
  if (durationMin <= 0) {
    return {
      effective: { carbs_per_hour_g: params.carbs_per_hour_g, fluid_per_hour_ml: params.fluid_per_hour_ml },
      target: { carbs_per_hour_g: params.carbs_per_hour_g, fluid_per_hour_ml: params.fluid_per_hour_ml },
      isRationing: { carbs: false, fluid: false },
    };
  }

  const targetCarbsPerH = params.carbs_per_hour_g;
  const targetFluidPerH = params.fluid_per_hour_ml;

  const itemsById = new Map(foodItems.map((f) => [f.id, f]));
  let carbsFromInventory = 0;
  let fluidFromInventory = 0;
  for (const slot of inventory) {
    const item = itemsById.get(slot.food_item_id);
    if (!item) continue;
    carbsFromInventory += item.carbs_g * slot.quantity;
    if (item.volume_ml !== undefined) {
      fluidFromInventory += item.volume_ml * slot.quantity;
    }
  }

  const stops = pack.aid_station_estimates;
  let carbsFromAids = 0;
  let fluidFromAids = 0;
  for (const aid of aidStations) {
    if (aid.available.solid_food) carbsFromAids += stops.carbs_per_solid_stop_g;
    if (aid.available.isotonic) {
      carbsFromAids += stops.carbs_per_isotonic_stop_g;
      fluidFromAids += stops.fluid_per_isotonic_stop_ml;
    }
    if (aid.available.water) fluidFromAids += stops.fluid_per_water_stop_ml;
  }

  const totalCarbsResource = carbsFromInventory + carbsFromAids;
  const totalFluidResource = fluidFromInventory + fluidFromAids;

  const effectiveCarbsPerH = Math.min(
    targetCarbsPerH,
    (totalCarbsResource / durationMin) * 60,
  );
  const effectiveFluidPerH = refillInNature
    ? targetFluidPerH
    : Math.min(targetFluidPerH, (totalFluidResource / durationMin) * 60);

  return {
    effective: { carbs_per_hour_g: effectiveCarbsPerH, fluid_per_hour_ml: effectiveFluidPerH },
    target: { carbs_per_hour_g: targetCarbsPerH, fluid_per_hour_ml: targetFluidPerH },
    isRationing: {
      carbs: effectiveCarbsPerH < targetCarbsPerH,
      fluid: effectiveFluidPerH < targetFluidPerH,
    },
  };
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function reducedTotal(
  ratePerHour: number,
  durationMin: number,
  pack: KnowledgePack,
): number {
  const { duration_min: firstHourDuration, reduction_factor: reductionFactor } =
    pack.first_hour;
  const firstHourMin = Math.min(firstHourDuration, durationMin);
  const remainingMin = Math.max(0, durationMin - firstHourDuration);
  const firstHourTotal = (firstHourMin / 60) * reductionFactor * ratePerHour;
  const remainingTotal = (remainingMin / 60) * ratePerHour;
  return firstHourTotal + remainingTotal;
}
