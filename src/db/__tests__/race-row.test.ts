import type { Race } from '../../models/race';
import { fromRow, toRow } from '../repos/race-repo';

function baseRace(): Race {
  return {
    id: 'race-001',
    created_at: 1700000000000,
    session_type: 'long',
    estimated_duration_min: 240,
    intensity: 'moderate',
    temperature_c: 18,
    humidity_high: false,
    exposure: 'variable',
    terrain_type: 'mixed_trail',
    inventory: [{ food_item_id: 'gel-001', quantity: 6 }],
    refill_in_nature: false,
    aid_stations: [],
    scheduled_start_at: 1700010000000,
    started_at: null,
    ended_at: null,
    paused_segments: [],
    scheduled_notification_ids: [],
    status: 'planned',
  };
}

function roundTrip(race: Race): Race {
  return fromRow(toRow(race));
}

describe('race-repo round-trip', () => {
  it('preserves a minimal race (no GPX, no name, no overrides)', () => {
    const race = baseRace();
    expect(roundTrip(race)).toEqual(race);
  });

  it('preserves optional name', () => {
    const race = { ...baseRace(), name: 'UTMB 2025' };
    expect(roundTrip(race)).toEqual(race);
  });

  it('preserves gpx_track with segments', () => {
    const race: Race = {
      ...baseRace(),
      gpx_track: {
        total_distance_km: 10,
        total_elevation_gain_m: 500,
        total_elevation_loss_m: 500,
        segments: [
          { km: 0, elevation_m: 1000, gradient: 0, estimated_time_min: 0 },
          { km: 1, elevation_m: 1100, gradient: 10, estimated_time_min: 12 },
        ],
      },
    };
    expect(roundTrip(race)).toEqual(race);
  });

  it('preserves manual distance fields when no GPX', () => {
    const race: Race = {
      ...baseRace(),
      distance_km: 42,
      elevation_gain_m: 2000,
      elevation_loss_m: 1800,
    };
    expect(roundTrip(race)).toEqual(race);
  });

  it('preserves overrides', () => {
    const race: Race = {
      ...baseRace(),
      overrides: {
        carbs_per_hour_g: 70,
        fluid_per_hour_ml: 600,
        first_intake_after_min: 20,
        check_in_frequency_min: 45,
      },
    };
    expect(roundTrip(race)).toEqual(race);
  });

  it('preserves partial overrides', () => {
    const race: Race = {
      ...baseRace(),
      overrides: { carbs_per_hour_g: 80 },
    };
    expect(roundTrip(race)).toEqual(race);
  });

  it('preserves inventory with multiple items', () => {
    const race: Race = {
      ...baseRace(),
      inventory: [
        { food_item_id: 'gel-001', quantity: 6 },
        { food_item_id: 'bar-001', quantity: 2 },
        { food_item_id: 'water-001', quantity: 1 },
      ],
    };
    expect(roundTrip(race)).toEqual(race);
  });

  it('preserves aid stations with full availability', () => {
    const race: Race = {
      ...baseRace(),
      aid_stations: [
        {
          id: 'as-001',
          at_km: 15,
          estimated_at_minute: 90,
          name: 'Col du Galibier',
          available: {
            water: true,
            isotonic: true,
            solid_food: true,
            refill_possible: true,
          },
        },
      ],
    };
    expect(roundTrip(race)).toEqual(race);
  });

  it('preserves paused_segments', () => {
    const race: Race = {
      ...baseRace(),
      status: 'in_progress',
      started_at: 1700010000000,
      paused_segments: [
        { from: 1700020000000, to: 1700025000000 },
        { from: 1700030000000, to: null },
      ],
    };
    expect(roundTrip(race)).toEqual(race);
  });

  it('preserves scheduled_notification_ids', () => {
    const race: Race = {
      ...baseRace(),
      scheduled_notification_ids: ['notif-001', 'notif-002', 'notif-003'],
    };
    expect(roundTrip(race)).toEqual(race);
  });

  it('preserves humidity_high boolean', () => {
    const withHumidity = { ...baseRace(), humidity_high: true };
    expect(roundTrip(withHumidity).humidity_high).toBe(true);
    const withoutHumidity = { ...baseRace(), humidity_high: false };
    expect(roundTrip(withoutHumidity).humidity_high).toBe(false);
  });

  it('preserves refill_in_nature boolean', () => {
    const with_ = { ...baseRace(), refill_in_nature: true };
    expect(roundTrip(with_).refill_in_nature).toBe(true);
    const without_ = { ...baseRace(), refill_in_nature: false };
    expect(roundTrip(without_).refill_in_nature).toBe(false);
  });

  it('preserves all status variants', () => {
    const statuses = ['planned', 'in_progress', 'completed', 'abandoned'] as const;
    for (const status of statuses) {
      expect(roundTrip({ ...baseRace(), status }).status).toBe(status);
    }
  });

  it('optional fields absent from Race stay absent after round-trip', () => {
    const race = baseRace();
    const result = roundTrip(race);
    expect('name' in result).toBe(false);
    expect('gpx_track' in result).toBe(false);
    expect('overrides' in result).toBe(false);
    expect('distance_km' in result).toBe(false);
    expect('elevation_gain_m' in result).toBe(false);
    expect('elevation_loss_m' in result).toBe(false);
  });
});
