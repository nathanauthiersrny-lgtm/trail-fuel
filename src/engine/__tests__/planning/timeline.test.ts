import type { GPXTrack } from '../../../models/gpx-track';

import {
  buildTimeline,
  estimateDurationFromDistanceAndElevation,
  TimelineInputError,
} from '../../planning/timeline';
import { makeBaseRace } from '../fixtures/races/base-race';

function makeFakeTrack(totalDistanceKm: number, totalDurationMin: number): GPXTrack {
  // 10 evenly spaced segments
  const segments = Array.from({ length: 10 }, (_, i) => ({
    km: ((i + 1) / 10) * totalDistanceKm,
    elevation_m: 1000,
    gradient: 0,
    estimated_time_min: ((i + 1) / 10) * totalDurationMin,
  }));
  return {
    total_distance_km: totalDistanceKm,
    total_elevation_gain_m: 0,
    total_elevation_loss_m: 0,
    segments,
  };
}

describe('estimateDurationFromDistanceAndElevation', () => {
  it('flat 10 km @ 6 min/km → 60 min', () => {
    expect(
      estimateDurationFromDistanceAndElevation({
        distanceKm: 10,
        flatPaceMinPerKm: 6,
        elevationGainM: 0,
        elevationLossM: 0,
      }),
    ).toBe(60);
  });

  it('+500m of D+ adds 50 min on top of flat baseline', () => {
    const baseline = estimateDurationFromDistanceAndElevation({
      distanceKm: 10,
      flatPaceMinPerKm: 6,
      elevationGainM: 0,
      elevationLossM: 0,
    });
    const withClimb = estimateDurationFromDistanceAndElevation({
      distanceKm: 10,
      flatPaceMinPerKm: 6,
      elevationGainM: 500,
      elevationLossM: 0,
    });
    expect(withClimb - baseline).toBeCloseTo(50, 6);
  });

  it('+500m of D- adds 20 min on top of flat baseline', () => {
    const baseline = estimateDurationFromDistanceAndElevation({
      distanceKm: 10,
      flatPaceMinPerKm: 6,
      elevationGainM: 0,
      elevationLossM: 0,
    });
    const withDescent = estimateDurationFromDistanceAndElevation({
      distanceKm: 10,
      flatPaceMinPerKm: 6,
      elevationGainM: 0,
      elevationLossM: 500,
    });
    expect(withDescent - baseline).toBeCloseTo(20, 6);
  });
});

describe('buildTimeline (GPX mode)', () => {
  it('returns totalDurationMin from the last segment', () => {
    const track = makeFakeTrack(10, 90);
    const timeline = buildTimeline(makeBaseRace({ gpx_track: track }));
    expect(timeline.totalDurationMin).toBe(90);
    expect(timeline.totalDistanceKm).toBe(10);
    expect(timeline.hasGpx).toBe(true);
  });

  it('interpolates at_minute for an aid station between segments', () => {
    const track = makeFakeTrack(10, 100);
    const timeline = buildTimeline(
      makeBaseRace({
        gpx_track: track,
        aid_stations: [
          {
            id: 'aid-1',
            at_km: 5,
            estimated_at_minute: 0, // ignored, recomputed
            available: { water: true, isotonic: false, solid_food: false, refill_possible: true },
          },
        ],
      }),
    );
    expect(timeline.aidStationMinutes.get('aid-1')).toBeCloseTo(50, 6);
  });

  it('clamps aid station at km 0 to minute 0', () => {
    const track = makeFakeTrack(10, 100);
    const timeline = buildTimeline(
      makeBaseRace({
        gpx_track: track,
        aid_stations: [
          {
            id: 'aid-start',
            at_km: 0,
            estimated_at_minute: 0,
            available: { water: false, isotonic: false, solid_food: false, refill_possible: false },
          },
        ],
      }),
    );
    expect(timeline.aidStationMinutes.get('aid-start')).toBe(0);
  });
});

describe('buildTimeline (fallback mode)', () => {
  it('uses estimated_duration_min directly', () => {
    const timeline = buildTimeline(
      makeBaseRace({ estimated_duration_min: 240, distance_km: 30 }),
    );
    expect(timeline.totalDurationMin).toBe(240);
    expect(timeline.totalDistanceKm).toBe(30);
    expect(timeline.hasGpx).toBe(false);
  });

  it('linearly distributes aid stations over total duration', () => {
    const timeline = buildTimeline(
      makeBaseRace({
        estimated_duration_min: 200,
        distance_km: 20,
        aid_stations: [
          {
            id: 'aid-mid',
            at_km: 10,
            estimated_at_minute: 0,
            available: { water: true, isotonic: false, solid_food: false, refill_possible: true },
          },
        ],
      }),
    );
    expect(timeline.aidStationMinutes.get('aid-mid')).toBeCloseTo(100, 6);
  });

  it('throws if aid stations are present without distance_km', () => {
    expect(() =>
      buildTimeline(
        makeBaseRace({
          estimated_duration_min: 200,
          aid_stations: [
            {
              id: 'aid',
              at_km: 5,
              estimated_at_minute: 0,
              available: { water: true, isotonic: false, solid_food: false, refill_possible: false },
            },
          ],
        }),
      ),
    ).toThrow(TimelineInputError);
  });

  it('throws if estimated_duration_min is non-positive in fallback mode', () => {
    expect(() =>
      buildTimeline(makeBaseRace({ estimated_duration_min: 0 })),
    ).toThrow(TimelineInputError);
  });
});
