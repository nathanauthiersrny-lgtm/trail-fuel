import type { AidStation } from '../../models/aid-station';
import type { FoodItem } from '../../models/food-item';
import type { PlanWarning } from '../../models/planned-event';
import type { InventoryItem } from '../../models/race';

import type { Needs } from './needs';

export const FEASIBILITY_THRESHOLD = 0.85;

export const CARBS_PER_SOLID_STOP_G = 30;
export const CARBS_PER_ISOTONIC_STOP_G = 30;
export const FLUID_PER_WATER_STOP_ML = 500;
export const FLUID_PER_ISOTONIC_STOP_ML = 500;

export function checkFeasibility(input: {
  inventory: InventoryItem[];
  foodItems: FoodItem[];
  aidStations: AidStation[];
  needs: Needs;
}): PlanWarning[] {
  const { inventory, foodItems, aidStations, needs } = input;
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

  const totalCarbs = carbsFromInventory + carbsFromAids;
  const totalFluid = fluidFromInventory + fluidFromAids;

  const warnings: PlanWarning[] = [];

  if (totalCarbs < needs.totalCarbs_g * FEASIBILITY_THRESHOLD) {
    const missing = Math.round(needs.totalCarbs_g - totalCarbs);
    warnings.push({
      severity: 'high',
      code: 'carbs_insufficient',
      message: `Inventaire insuffisant : ${missing}g de glucides manquants (besoin ${Math.round(needs.totalCarbs_g)}g, dispo ${Math.round(totalCarbs)}g).`,
    });
  }

  if (totalFluid < needs.totalFluid_ml * FEASIBILITY_THRESHOLD) {
    const missing = Math.round(needs.totalFluid_ml - totalFluid);
    warnings.push({
      severity: 'high',
      code: 'fluid_insufficient',
      message: `Inventaire insuffisant : ${missing}ml de fluide manquants (besoin ${Math.round(needs.totalFluid_ml)}ml, dispo ${Math.round(totalFluid)}ml).`,
    });
  }

  return warnings;
}
