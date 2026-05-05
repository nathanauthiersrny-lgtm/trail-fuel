import type { AidStation } from '../models/aid-station';
import type { FoodItem } from '../models/food-item';
import type { PlannedEvent } from '../models/planned-event';
import { INTAKE_ACTION_CATEGORY } from '../services/notifications/category';
import {
  buildAidStationNotificationContent,
  buildCheckInNotificationContent,
  buildFluidReminderNotificationContent,
  buildIntakeNotificationContent,
  buildNotificationContent,
  eventChannelId,
} from '../services/notifications/format-content';

const RACE_ID = 'race-001';

const GEL: FoodItem = {
  id: 'gel-001',
  name: 'SIS Gel Orange',
  type: 'gel',
  carbs_g: 22,
  sodium_mg: 30,
  weight_g: 60,
  is_seed: true,
};

const WATER: FoodItem = {
  id: 'water-001',
  name: 'Eau',
  type: 'water',
  carbs_g: 0,
  sodium_mg: 0,
  volume_ml: 500,
  is_seed: true,
};

const FOODS: Record<string, FoodItem> = {
  [GEL.id]: GEL,
  [WATER.id]: WATER,
};

const AID_STATION: AidStation = {
  id: 'as-001',
  at_km: 12,
  estimated_at_minute: 90,
  name: 'Col du Galibier',
  available: { water: true, isotonic: true, solid_food: true, refill_possible: true },
};

const AID_STATIONS: Record<string, AidStation> = { [AID_STATION.id]: AID_STATION };

function intakeEvent(payload: PlannedEvent['payload']): PlannedEvent {
  return {
    id: `${RACE_ID}::event-0`,
    race_id: RACE_ID,
    scheduled_at_minute: 30,
    type: 'intake',
    payload,
  };
}

describe('buildIntakeNotificationContent', () => {
  it('formats a single gel with quantity 1', () => {
    const event = intakeEvent({ food_item_id: GEL.id, quantity: 1 });
    const content = buildIntakeNotificationContent(event, FOODS);
    expect(content.title).toBe('Maintenant : SIS Gel Orange');
    expect(content.categoryIdentifier).toBe(INTAKE_ACTION_CATEGORY);
    expect(content.data).toEqual({
      event_id: event.id,
      race_id: RACE_ID,
      type: 'intake',
    });
  });

  it('shows quantity prefix when quantity > 1', () => {
    const event = intakeEvent({ food_item_id: GEL.id, quantity: 2 });
    const content = buildIntakeNotificationContent(event, FOODS);
    expect(content.title).toBe('Maintenant : 2× SIS Gel Orange');
  });

  it('formats water with volume_ml from payload', () => {
    const event = intakeEvent({
      food_item_id: WATER.id,
      quantity: 1,
      volume_ml: 150,
    });
    const content = buildIntakeNotificationContent(event, FOODS);
    expect(content.title).toBe('Maintenant : 150ml Eau');
  });

  it('formats merged items joined by + ', () => {
    const event = intakeEvent({
      items: [
        { food_item_id: GEL.id, quantity: 1 },
        { food_item_id: WATER.id, quantity: 1, volume_ml: 200 },
      ],
    });
    const content = buildIntakeNotificationContent(event, FOODS);
    expect(content.title).toBe('Maintenant : SIS Gel Orange + 200ml Eau');
  });

  it('falls back to "item inconnu" if foodItem missing from map', () => {
    const event = intakeEvent({ food_item_id: 'gel-unknown', quantity: 1 });
    const content = buildIntakeNotificationContent(event, FOODS);
    expect(content.title).toContain('item inconnu');
  });
});

describe('buildCheckInNotificationContent', () => {
  it('formats a generic check-in with no body action', () => {
    const event: PlannedEvent = {
      id: `${RACE_ID}::event-1`,
      race_id: RACE_ID,
      scheduled_at_minute: 60,
      type: 'check_in',
      payload: {},
    };
    const content = buildCheckInNotificationContent(event);
    expect(content.title).toMatch(/check-in/i);
    expect(content.categoryIdentifier).toBeUndefined();
    expect(content.data).toEqual({
      event_id: event.id,
      race_id: RACE_ID,
      type: 'check_in',
    });
  });
});

describe('buildAidStationNotificationContent', () => {
  it('formats an arrived aid station with name and km', () => {
    const event: PlannedEvent = {
      id: `${RACE_ID}::event-2`,
      race_id: RACE_ID,
      scheduled_at_minute: 90,
      type: 'aid_station',
      payload: { aid_station_id: AID_STATION.id, aid_phase: 'arrived' },
    };
    const content = buildAidStationNotificationContent(event, AID_STATIONS);
    expect(content.title).toContain('Ravito');
    expect(content.title).toContain('km 12');
    expect(content.title).toContain('Col du Galibier');
  });

  it('formats an approaching aid station differently', () => {
    const event: PlannedEvent = {
      id: `${RACE_ID}::event-3`,
      race_id: RACE_ID,
      scheduled_at_minute: 87,
      type: 'aid_station',
      payload: { aid_station_id: AID_STATION.id, aid_phase: 'approaching' },
    };
    const content = buildAidStationNotificationContent(event, AID_STATIONS);
    expect(content.title).toMatch(/dans/);
  });

  it('falls back to generic "ravito" if aid station missing', () => {
    const event: PlannedEvent = {
      id: `${RACE_ID}::event-4`,
      race_id: RACE_ID,
      scheduled_at_minute: 90,
      type: 'aid_station',
      payload: { aid_station_id: 'as-unknown', aid_phase: 'arrived' },
    };
    const content = buildAidStationNotificationContent(event, AID_STATIONS);
    expect(content.title).toContain('ravito');
  });
});

describe('buildFluidReminderNotificationContent', () => {
  it('formats with target volume', () => {
    const event: PlannedEvent = {
      id: `${RACE_ID}::event-5`,
      race_id: RACE_ID,
      scheduled_at_minute: 15,
      type: 'fluid_reminder',
      payload: { target_volume_ml: 250 },
    };
    const content = buildFluidReminderNotificationContent(event);
    expect(content.title).toBe('Bois');
    expect(content.body).toContain('250ml');
    expect(content.categoryIdentifier).toBe(INTAKE_ACTION_CATEGORY);
    expect(content.data).toEqual({
      event_id: event.id,
      race_id: RACE_ID,
      type: 'fluid_reminder',
    });
  });

  it('falls back to "une gorgée" if no target', () => {
    const event: PlannedEvent = {
      id: `${RACE_ID}::event-6`,
      race_id: RACE_ID,
      scheduled_at_minute: 15,
      type: 'fluid_reminder',
      payload: {},
    };
    const content = buildFluidReminderNotificationContent(event);
    expect(content.body).toContain('gorgée');
  });
});

describe('buildNotificationContent dispatcher', () => {
  it('routes intake events to the intake formatter', () => {
    const event = intakeEvent({ food_item_id: GEL.id, quantity: 1 });
    const content = buildNotificationContent(event, FOODS, AID_STATIONS);
    expect(content.title).toContain('SIS Gel Orange');
  });

  it('routes check_in events to the check-in formatter', () => {
    const event: PlannedEvent = {
      id: `${RACE_ID}::event-x`,
      race_id: RACE_ID,
      scheduled_at_minute: 30,
      type: 'check_in',
      payload: {},
    };
    const content = buildNotificationContent(event, FOODS, AID_STATIONS);
    expect(content.title).toMatch(/check-in/i);
  });
});

describe('eventChannelId', () => {
  it('maps check_in to checkin channel', () => {
    expect(eventChannelId('check_in')).toBe('checkin');
  });

  it('maps intake/aid_station/fluid_reminder to intake channel', () => {
    expect(eventChannelId('intake')).toBe('intake');
    expect(eventChannelId('aid_station')).toBe('intake');
    expect(eventChannelId('fluid_reminder')).toBe('intake');
  });
});
