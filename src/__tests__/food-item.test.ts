import { assertValidFoodItem, FoodItemInvariantError } from '../models/food-item';

describe('FoodItem invariant', () => {
  it('accepts an item with weight_g only', () => {
    expect(() =>
      assertValidFoodItem({
        id: 'x',
        name: 'Gel',
        type: 'gel',
        carbs_g: 22,
        sodium_mg: 0,
        is_seed: false,
        weight_g: 60,
      }),
    ).not.toThrow();
  });

  it('accepts an item with volume_ml only', () => {
    expect(() =>
      assertValidFoodItem({
        id: 'x',
        name: 'Eau',
        type: 'water',
        carbs_g: 0,
        sodium_mg: 0,
        is_seed: false,
        volume_ml: 500,
      }),
    ).not.toThrow();
  });

  it('accepts an item with both weight_g and volume_ml', () => {
    expect(() =>
      assertValidFoodItem({
        id: 'x',
        name: 'Compote',
        type: 'real_food',
        carbs_g: 15,
        sodium_mg: 0,
        is_seed: false,
        weight_g: 90,
        volume_ml: 90,
      }),
    ).not.toThrow();
  });

  it('rejects an item with neither weight_g nor volume_ml', () => {
    expect(() =>
      assertValidFoodItem({
        id: 'x',
        name: 'Vide',
        type: 'gel',
        carbs_g: 22,
        sodium_mg: 0,
        is_seed: false,
      }),
    ).toThrow(FoodItemInvariantError);
  });
});
