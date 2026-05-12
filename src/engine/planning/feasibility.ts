import type { AidStation } from '../../models/aid-station';
import type { FoodItem } from '../../models/food-item';
import type { KnowledgePack } from '../../models/knowledge-pack';
import type { PlanWarning } from '../../models/planned-event';
import type { InventoryItem } from '../../models/race';

import type { Needs } from './needs';

export function checkFeasibility(input: {
  inventory: InventoryItem[];
  foodItems: FoodItem[];
  aidStations: AidStation[];
  needs: Needs;
  pack: KnowledgePack;
}): PlanWarning[] {
  const { inventory, foodItems, aidStations, needs, pack } = input;
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

  const totalCarbs = carbsFromInventory + carbsFromAids;
  const totalFluid = fluidFromInventory + fluidFromAids;
  const threshold = pack.feasibility_threshold;

  const warnings: PlanWarning[] = [];

  if (totalCarbs < needs.totalCarbs_g * threshold) {
    const missing = Math.round(needs.totalCarbs_g - totalCarbs);
    warnings.push({
      severity: 'high',
      code: 'carbs_insufficient',
      message: `Inventaire insuffisant : ${missing}g de glucides manquants (besoin ${Math.round(needs.totalCarbs_g)}g, dispo ${Math.round(totalCarbs)}g).`,
    });
  }

  if (totalFluid < needs.totalFluid_ml * threshold) {
    const missing = Math.round(needs.totalFluid_ml - totalFluid);
    warnings.push({
      severity: 'high',
      code: 'fluid_insufficient',
      message: `Inventaire insuffisant : ${missing}ml de fluide manquants (besoin ${Math.round(needs.totalFluid_ml)}ml, dispo ${Math.round(totalFluid)}ml).`,
    });
  }

  return warnings;
}
