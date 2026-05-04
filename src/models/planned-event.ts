export type PlannedEventType = 'intake' | 'check_in' | 'aid_station' | 'fluid_reminder';

export type AidPhase = 'approaching' | 'arrived';

export type IntakeItem = {
  food_item_id: string;
  quantity: number;
  volume_ml?: number;
};

export type PlannedEventPayload = {
  // Single intake (placement output): one item via the flat fields.
  food_item_id?: string;
  quantity?: number;
  volume_ml?: number;
  // Merged intake (post-merge): multiple items, set when 2+ intakes are < 3 min apart.
  items?: IntakeItem[];
  // Aid station phase + id.
  aid_station_id?: string;
  aid_phase?: AidPhase;
  // Fluid reminder: cumulative target to reach by next reminder.
  target_volume_ml?: number;
};

export type PlannedEvent = {
  id: string;
  race_id: string;
  scheduled_at_minute: number;
  type: PlannedEventType;
  payload: PlannedEventPayload;
};

export type PlanWarningSeverity = 'low' | 'medium' | 'high';

export type PlanWarning = {
  severity: PlanWarningSeverity;
  code: string;
  message: string;
  data?: Record<string, number>;
};
