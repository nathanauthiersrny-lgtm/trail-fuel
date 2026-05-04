import { draftToRace } from '../services/draft-to-race';
import type { RaceCreationDraft } from '../services/race-creation-store';

function makeValidManualDraft(overrides: Partial<RaceCreationDraft> = {}): RaceCreationDraft {
  return {
    name: 'Test race',
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

describe('draftToRace', () => {
  describe('valid drafts — no throw', () => {
    it('converts a minimum valid manual draft', () => {
      const race = draftToRace(makeValidManualDraft());
      expect(race.session_type).toBe('long');
      expect(race.intensity).toBe('moderate');
      expect(race.estimated_duration_min).toBe(240);
      expect(race.terrain_type).toBe('mixed_trail');
      expect(race.status).toBe('planned');
      expect(race.started_at).toBeNull();
      expect(race.id).toBeTruthy();
    });

    it('accepts overrides: null (optional field)', () => {
      expect(() => draftToRace(makeValidManualDraft({ overrides: null }))).not.toThrow();
    });

    it('accepts aid_stations: [] (empty is valid)', () => {
      expect(() => draftToRace(makeValidManualDraft({ aid_stations: [] }))).not.toThrow();
    });

    it('converts a draft with gpx_track (GPX mode)', () => {
      const track = {
        total_distance_km: 42,
        total_elevation_gain_m: 1000,
        total_elevation_loss_m: 500,
        segments: [{ km: 42, elevation_m: 1200, gradient: 0, estimated_time_min: 240 }],
      };
      const race = draftToRace(makeValidManualDraft({ gpx_track: track, elevation_loss_m: 500 }));
      expect(race.gpx_track).toBe(track);
      expect(race.elevation_loss_m).toBe(500);
    });
  });

  describe('guards — throw with field name', () => {
    it('throws naming session_type when null', () => {
      expect(() => draftToRace(makeValidManualDraft({ session_type: null }))).toThrow(
        'draftToRace: session_type is required',
      );
    });

    it('throws naming intensity when null', () => {
      expect(() => draftToRace(makeValidManualDraft({ intensity: null }))).toThrow(
        'draftToRace: intensity is required',
      );
    });

    it('throws naming estimated_duration_min when null', () => {
      expect(() => draftToRace(makeValidManualDraft({ estimated_duration_min: null }))).toThrow(
        'draftToRace: estimated_duration_min is required',
      );
    });

    it('throws naming estimated_duration_min when 0', () => {
      expect(() => draftToRace(makeValidManualDraft({ estimated_duration_min: 0 }))).toThrow(
        'draftToRace: estimated_duration_min is required',
      );
    });

    it('throws naming terrain_type when null', () => {
      expect(() => draftToRace(makeValidManualDraft({ terrain_type: null }))).toThrow(
        'draftToRace: terrain_type is required',
      );
    });
  });

  describe('generated id', () => {
    it('produces unique ids across calls', () => {
      const a = draftToRace(makeValidManualDraft());
      const b = draftToRace(makeValidManualDraft());
      expect(a.id).not.toBe(b.id);
    });
  });
});
