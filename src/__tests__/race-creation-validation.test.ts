import { isStepValid } from '../services/race-creation-validation';
import type { RaceCreationDraft } from '../services/race-creation-store';

function makeFullDraft(overrides: Partial<RaceCreationDraft> = {}): RaceCreationDraft {
  return {
    name: '',
    scheduled_start_at: 1000000,
    gpx_track: null,
    distance_km: 42,
    elevation_gain_m: 1000,
    elevation_loss_m: null,
    estimated_duration_min: 240,
    terrain_type: 'mixed_trail',
    temperature_c: 15,
    humidity_high: false,
    exposure: 'variable',
    session_type: 'long',
    intensity: 'moderate',
    overrides: null,
    show_advanced: false,
    aid_stations: [],
    refill_in_nature: false,
    inventory: [],
    ...overrides,
  };
}

describe('isStepValid', () => {
  it('step 5 always returns true regardless of draft state', () => {
    expect(isStepValid(5, makeFullDraft())).toBe(true);
    expect(isStepValid(5, makeFullDraft({ aid_stations: [] }))).toBe(true);
  });

  it('step 6 always returns true regardless of draft state', () => {
    expect(isStepValid(6, makeFullDraft())).toBe(true);
    expect(isStepValid(6, makeFullDraft({ inventory: [], overrides: null }))).toBe(true);
  });

  it('step 4 requires session_type non-null', () => {
    expect(isStepValid(4, makeFullDraft({ session_type: 'long' }))).toBe(true);
    expect(isStepValid(4, makeFullDraft({ session_type: null }))).toBe(false);
  });

  it('step 2 passes in GPX mode without checking manual fields', () => {
    const track = {
      total_distance_km: 10,
      total_elevation_gain_m: 200,
      total_elevation_loss_m: 200,
      segments: [{ km: 10, elevation_m: 1000, gradient: 0, estimated_time_min: 60 }],
    };
    const gpxDraft = makeFullDraft({
      gpx_track: track,
      distance_km: null,
      estimated_duration_min: null,
      terrain_type: null,
    });
    expect(isStepValid(2, gpxDraft)).toBe(true);
  });

  it('step 2 manual mode requires distance, duration and terrain_type', () => {
    const base = makeFullDraft({ gpx_track: null });
    expect(isStepValid(2, base)).toBe(true);
    expect(isStepValid(2, { ...base, distance_km: null })).toBe(false);
    expect(isStepValid(2, { ...base, estimated_duration_min: null })).toBe(false);
    expect(isStepValid(2, { ...base, terrain_type: null })).toBe(false);
  });
});
