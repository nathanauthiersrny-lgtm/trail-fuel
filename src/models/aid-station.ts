export type AidStationAvailability = {
  water: boolean;
  isotonic: boolean;
  solid_food: boolean;
  refill_possible: boolean;
};

export type AidStation = {
  id: string;
  at_km: number;
  estimated_at_minute: number;
  name?: string;
  available: AidStationAvailability;
};
