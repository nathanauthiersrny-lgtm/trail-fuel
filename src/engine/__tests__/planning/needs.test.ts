import type { AidStation } from '../../../models/aid-station';
import type { FoodItem } from '../../../models/food-item';

import { computeEffectiveRates, computeNeeds, FIRST_HOUR_REDUCTION_FACTOR } from '../../planning/needs';
import type { ResolvedParams } from '../../planning/resolve-params';

const baseParams: ResolvedParams = {
  carbs_per_hour_g: 60,
  fluid_per_hour_ml: 500,
  sodium_per_hour_mg: 500,
  first_intake_after_min: 30,
  check_in_frequency_min: 50,
  intake_interval_min: 20,
  skip_alert_threshold: 2,
  deficit_alert_pct: 0.30,
  intensity: 'moderate',
};

const gel: FoodItem = {
  id: 'gel', name: 'Gel', type: 'gel', carbs_g: 25, sodium_mg: 0,
  weight_g: 60, is_seed: false,
};
const water: FoodItem = {
  id: 'water', name: 'Water', type: 'water', carbs_g: 0, sodium_mg: 0,
  volume_ml: 500, is_seed: false,
};

const aidFull: AidStation = {
  id: 'a', at_km: 10, estimated_at_minute: 60,
  available: { water: true, isotonic: true, solid_food: true, refill_possible: true },
};

describe('computeNeeds', () => {
  it('applies the first-hour reduction (-30%) to a 3h race', () => {
    // First hour: 60 × 0.7 = 42g. Remaining 2h: 60 × 2 = 120g. Total = 162g.
    const needs = computeNeeds({ params: baseParams, durationMin: 180 });
    expect(needs.totalCarbs_g).toBeCloseTo(162, 6);
    expect(needs.totalFluid_ml).toBeCloseTo(1350, 6); // 500 × 0.7 + 500 × 2
    expect(needs.totalSodium_mg).toBeCloseTo(1350, 6);
    expect(needs.durationHours).toBe(3);
  });

  it('reduces a 90-min race correctly (1h reduced + 30 min full)', () => {
    // First 60: 60 × 0.7 = 42. Remaining 30 min: 60 × 0.5 = 30. Total = 72.
    const needs = computeNeeds({ params: baseParams, durationMin: 90 });
    expect(needs.totalCarbs_g).toBeCloseTo(72, 6);
    expect(needs.totalFluid_ml).toBeCloseTo(600, 6); // 500 × 0.7 + 500 × 0.5
  });

  it('reduces a 30-min race entirely (still inside the first hour)', () => {
    // 30 min entirely within first hour: 60 × 0.5 × 0.7 = 21.
    const needs = computeNeeds({ params: baseParams, durationMin: 30 });
    expect(needs.totalCarbs_g).toBeCloseTo(21, 6);
  });

  it('caps the reduction at the first hour: a 4h race has only 1h reduced', () => {
    // First 60: 42. Remaining 180 min: 60 × 3 = 180. Total = 222.
    const needs = computeNeeds({ params: baseParams, durationMin: 240 });
    expect(needs.totalCarbs_g).toBeCloseTo(222, 6);
  });

  it('returns zero needs for zero duration', () => {
    const needs = computeNeeds({ params: baseParams, durationMin: 0 });
    expect(needs.totalCarbs_g).toBe(0);
    expect(needs.totalFluid_ml).toBe(0);
    expect(needs.durationHours).toBe(0);
  });

  it('FIRST_HOUR_REDUCTION_FACTOR is 0.70 (= -30%)', () => {
    expect(FIRST_HOUR_REDUCTION_FACTOR).toBeCloseTo(0.70, 6);
  });
});

describe('computeEffectiveRates', () => {
  it('returns target = effective when inventory covers the full need', () => {
    // 3h race, 60g/h carbs → need 180g. Have 10 gels × 25g = 250g. OK.
    // 500ml/h fluid → need 1500ml. Have 5 × 500ml = 2500ml. OK.
    const result = computeEffectiveRates({
      params: baseParams,
      durationMin: 180,
      foodItems: [gel, water],
      inventory: [
        { food_item_id: 'gel', quantity: 10 },
        { food_item_id: 'water', quantity: 5 },
      ],
      aidStations: [],
      refillInNature: false,
    });
    expect(result.effective.carbs_per_hour_g).toBe(60);
    expect(result.effective.fluid_per_hour_ml).toBe(500);
    expect(result.isRationing.carbs).toBe(false);
    expect(result.isRationing.fluid).toBe(false);
  });

  it('rations fluid when inventory is insufficient', () => {
    // 3h, 500ml/h → need 1500ml. Have 1 × 500ml = 500ml.
    // effective = (500 / 180) × 60 ≈ 166.67 ml/h
    const result = computeEffectiveRates({
      params: baseParams,
      durationMin: 180,
      foodItems: [gel, water],
      inventory: [
        { food_item_id: 'gel', quantity: 10 },
        { food_item_id: 'water', quantity: 1 },
      ],
      aidStations: [],
      refillInNature: false,
    });
    expect(result.effective.fluid_per_hour_ml).toBeCloseTo(166.67, 0);
    expect(result.isRationing.fluid).toBe(true);
    expect(result.target.fluid_per_hour_ml).toBe(500);
  });

  it('rations carbs when inventory is insufficient', () => {
    // 3h, 60g/h → need 180g. Have 2 gels × 25g = 50g.
    // effective = (50 / 180) × 60 ≈ 16.67 g/h
    const result = computeEffectiveRates({
      params: baseParams,
      durationMin: 180,
      foodItems: [gel, water],
      inventory: [
        { food_item_id: 'gel', quantity: 2 },
        { food_item_id: 'water', quantity: 5 },
      ],
      aidStations: [],
      refillInNature: false,
    });
    expect(result.effective.carbs_per_hour_g).toBeCloseTo(16.67, 0);
    expect(result.isRationing.carbs).toBe(true);
  });

  it('counts aid station contributions (no rationing when aids fill the gap)', () => {
    // 3h, 60g/h → need 180g carbs. Inventory: 4 gels = 100g.
    // 3 aid stations (each: solid 30g + isotonic 30g = 60g carbs, water 500ml + isotonic 500ml fluid)
    // Total carbs: 100 + 3×60 = 280g → no rationing
    // Total fluid: 0 + 3×1000 = 3000ml → no rationing
    const result = computeEffectiveRates({
      params: baseParams,
      durationMin: 180,
      foodItems: [gel, water],
      inventory: [{ food_item_id: 'gel', quantity: 4 }],
      aidStations: [aidFull, aidFull, aidFull],
      refillInNature: false,
    });
    expect(result.isRationing.carbs).toBe(false);
    expect(result.isRationing.fluid).toBe(false);
  });

  it('treats fluid as unlimited when refill_in_nature = true', () => {
    const result = computeEffectiveRates({
      params: baseParams,
      durationMin: 180,
      foodItems: [gel, water],
      inventory: [],
      aidStations: [],
      refillInNature: true,
    });
    expect(result.effective.fluid_per_hour_ml).toBe(500);
    expect(result.isRationing.fluid).toBe(false);
    // Carbs still rationed (no inventory, no aids)
    expect(result.isRationing.carbs).toBe(true);
  });
});
