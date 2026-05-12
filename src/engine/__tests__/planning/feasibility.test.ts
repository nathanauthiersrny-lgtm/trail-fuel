import type { AidStation } from '../../../models/aid-station';
import type { FoodItem } from '../../../models/food-item';

import { checkFeasibility } from '../../planning/feasibility';
import type { Needs } from '../../planning/needs';
import { TEST_PACK } from '../test-helpers/knowledge-pack';

const gel: FoodItem = {
  id: 'gel', name: 'Gel', type: 'gel', carbs_g: 25, sodium_mg: 0,
  weight_g: 60, is_seed: false,
};
const water: FoodItem = {
  id: 'water', name: 'Water', type: 'water', carbs_g: 0, sodium_mg: 0,
  volume_ml: 500, is_seed: false,
};

const baseNeeds: Needs = {
  totalCarbs_g: 200,
  totalFluid_ml: 2000,
  totalSodium_mg: 1500,
  durationHours: 4,
};

const aidWithEverything: AidStation = {
  id: 'a', at_km: 10, estimated_at_minute: 60,
  available: { water: true, isotonic: true, solid_food: true, refill_possible: true },
};

describe('checkFeasibility', () => {
  it('returns no warnings when inventory covers all needs', () => {
    const warnings = checkFeasibility({
      inventory: [
        { food_item_id: 'gel', quantity: 10 },     // 250g carbs
        { food_item_id: 'water', quantity: 5 },     // 2500ml fluid
      ],
      foodItems: [gel, water],
      aidStations: [],
      needs: baseNeeds,
      pack: TEST_PACK,
    });
    expect(warnings).toEqual([]);
  });

  it('emits a carbs warning when carbs are below 85% threshold', () => {
    const warnings = checkFeasibility({
      inventory: [
        { food_item_id: 'gel', quantity: 4 },       // 100g carbs (< 170 = 85%)
        { food_item_id: 'water', quantity: 5 },
      ],
      foodItems: [gel, water],
      aidStations: [],
      needs: baseNeeds,
      pack: TEST_PACK,
    });
    expect(warnings).toHaveLength(1);
    expect(warnings[0].code).toBe('carbs_insufficient');
    expect(warnings[0].severity).toBe('high');
  });

  it('emits a fluid warning when fluid is below 85% threshold', () => {
    const warnings = checkFeasibility({
      inventory: [
        { food_item_id: 'gel', quantity: 10 },
        { food_item_id: 'water', quantity: 2 },     // 1000ml < 1700 = 85%
      ],
      foodItems: [gel, water],
      aidStations: [],
      needs: baseNeeds,
      pack: TEST_PACK,
    });
    expect(warnings).toHaveLength(1);
    expect(warnings[0].code).toBe('fluid_insufficient');
  });

  it('emits both warnings when both are insufficient', () => {
    const warnings = checkFeasibility({
      inventory: [],
      foodItems: [gel, water],
      aidStations: [],
      needs: baseNeeds,
      pack: TEST_PACK,
    });
    expect(warnings.map((w) => w.code).sort()).toEqual([
      'carbs_insufficient',
      'fluid_insufficient',
    ]);
  });

  it('counts aid station contributions toward feasibility', () => {
    const noWarnings = checkFeasibility({
      inventory: [
        { food_item_id: 'gel', quantity: 4 }, // 100g carbs alone
      ],
      foodItems: [gel, water],
      aidStations: [aidWithEverything, aidWithEverything, aidWithEverything], // 3×60g + 3×1000ml
      needs: baseNeeds,
      pack: TEST_PACK,
    });
    expect(noWarnings.find((w) => w.code === 'carbs_insufficient')).toBeUndefined();
  });

  it('ignores inventory items that are not in the food library', () => {
    const warnings = checkFeasibility({
      inventory: [{ food_item_id: 'unknown', quantity: 100 }],
      foodItems: [gel, water],
      aidStations: [],
      needs: baseNeeds,
      pack: TEST_PACK,
    });
    expect(warnings.map((w) => w.code).sort()).toEqual([
      'carbs_insufficient',
      'fluid_insufficient',
    ]);
  });
});
