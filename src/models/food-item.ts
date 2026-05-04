export type FoodItemKind = 'gel' | 'bar' | 'drink_mix' | 'real_food' | 'water';

type FoodItemBase = {
  id: string;
  name: string;
  type: FoodItemKind;
  carbs_g: number;
  sodium_mg: number;
  notes?: string;
  is_seed: boolean;
};

export type FoodItem =
  | (FoodItemBase & { weight_g: number; volume_ml?: number })
  | (FoodItemBase & { weight_g?: number; volume_ml: number });

export class FoodItemInvariantError extends Error {
  constructor(item: { id: string; name: string }) {
    super(
      `FoodItem "${item.name}" (${item.id}): at least one of weight_g or volume_ml is required.`,
    );
    this.name = 'FoodItemInvariantError';
  }
}

export class SeedItemDeleteError extends Error {
  constructor() {
    super(
      "Cet item fait partie de la bibliothèque par défaut et ne peut pas être supprimé. Tu peux modifier ses valeurs si besoin.",
    );
    this.name = 'SeedItemDeleteError';
  }
}

export function assertValidFoodItem(
  item: FoodItemBase & { weight_g?: number; volume_ml?: number },
): asserts item is FoodItem {
  if (item.weight_g === undefined && item.volume_ml === undefined) {
    throw new FoodItemInvariantError(item);
  }
}
