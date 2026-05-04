import type { AidStation } from '../../models/aid-station';
import type { FoodItem } from '../../models/food-item';
import type { InventoryItem } from '../../models/race';

import {
  CARBS_PER_ISOTONIC_STOP_G,
  CARBS_PER_SOLID_STOP_G,
  FLUID_PER_ISOTONIC_STOP_ML,
  FLUID_PER_WATER_STOP_ML,
} from './feasibility';
import type { ResolvedParams } from './resolve-params';

export type Needs = {
  totalCarbs_g: number;
  totalFluid_ml: number;
  totalSodium_mg: number;
  durationHours: number;
};

/**
 * MVP rule: during the first hour, intakes are reduced by 30% (stomach under
 * adrenaline, absorption is degraded). Source: nutrition-rules skill, doc.md §6.
 *
 * Applied at the totals level (not per-window) since placement.ts v1 does not
 * yet support per-window target weighting. The reduction surfaces in feasibility
 * checks (softer carb/fluid floors).
 */
export const FIRST_HOUR_REDUCTION_FACTOR = 0.70;
const FIRST_HOUR_DURATION_MIN = 60;

export function computeNeeds(input: {
  params: ResolvedParams;
  durationMin: number;
}): Needs {
  const { params, durationMin } = input;
  const durationHours = durationMin / 60;
  return {
    totalCarbs_g: reducedTotal(params.carbs_per_hour_g, durationMin),
    totalFluid_ml: reducedTotal(params.fluid_per_hour_ml, durationMin),
    totalSodium_mg: reducedTotal(params.sodium_per_hour_mg, durationMin),
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
}): EffectiveRates {
  const { params, durationMin, foodItems, inventory, aidStations, refillInNature } = input;
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

  let carbsFromAids = 0;
  let fluidFromAids = 0;
  for (const aid of aidStations) {
    if (aid.available.solid_food) carbsFromAids += CARBS_PER_SOLID_STOP_G;
    if (aid.available.isotonic) {
      carbsFromAids += CARBS_PER_ISOTONIC_STOP_G;
      fluidFromAids += FLUID_PER_ISOTONIC_STOP_ML;
    }
    if (aid.available.water) fluidFromAids += FLUID_PER_WATER_STOP_ML;
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

function reducedTotal(ratePerHour: number, durationMin: number): number {
  const firstHourMin = Math.min(FIRST_HOUR_DURATION_MIN, durationMin);
  const remainingMin = Math.max(0, durationMin - FIRST_HOUR_DURATION_MIN);
  const firstHourTotal = (firstHourMin / 60) * FIRST_HOUR_REDUCTION_FACTOR * ratePerHour;
  const remainingTotal = (remainingMin / 60) * ratePerHour;
  return firstHourTotal + remainingTotal;
}
