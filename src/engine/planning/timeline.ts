import type { GPXTrack } from '../../models/gpx-track';
import type { Race } from '../../models/race';

export type Timeline = {
  totalDurationMin: number;
  totalDistanceKm: number;
  hasGpx: boolean;
  /** Maps aid_station_id → minute since start. */
  aidStationMinutes: Map<string, number>;
};

export class TimelineInputError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'TimelineInputError';
  }
}

export function buildTimeline(race: Race): Timeline {
  if (race.gpx_track && race.gpx_track.segments.length > 0) {
    return buildFromGpx(race, race.gpx_track);
  }
  return buildFromFallback(race);
}

/**
 * Estimates total duration from distance, D+ and D- when no GPX is provided.
 * Heuristic from doc.md §9: +1 min per 10m of D+, +1 min per 25m of D-.
 *
 * Exposed so the race-creation UI can auto-suggest a duration in step 2.
 */
export function estimateDurationFromDistanceAndElevation(input: {
  distanceKm: number;
  flatPaceMinPerKm: number;
  elevationGainM: number;
  elevationLossM: number;
}): number {
  const { distanceKm, flatPaceMinPerKm, elevationGainM, elevationLossM } = input;
  return distanceKm * flatPaceMinPerKm + elevationGainM / 10 + elevationLossM / 25;
}

function buildFromGpx(race: Race, track: GPXTrack): Timeline {
  const segments = track.segments;
  const lastSegment = segments[segments.length - 1];
  const totalDurationMin = lastSegment.estimated_time_min;
  const totalDistanceKm = track.total_distance_km;

  const aidStationMinutes = new Map<string, number>();
  for (const aid of race.aid_stations) {
    aidStationMinutes.set(aid.id, minuteAtKm(segments, aid.at_km));
  }

  return { totalDurationMin, totalDistanceKm, hasGpx: true, aidStationMinutes };
}

function buildFromFallback(race: Race): Timeline {
  if (race.estimated_duration_min <= 0) {
    throw new TimelineInputError(
      'Race has no GPX and estimated_duration_min is not set (or non-positive).',
    );
  }
  if (race.aid_stations.length > 0 && (!race.distance_km || race.distance_km <= 0)) {
    throw new TimelineInputError(
      'Race has aid stations but no GPX and no distance_km — cannot map at_km to at_minute.',
    );
  }

  const totalDurationMin = race.estimated_duration_min;
  const totalDistanceKm = race.distance_km ?? 0;

  const aidStationMinutes = new Map<string, number>();
  for (const aid of race.aid_stations) {
    const at_minute = (aid.at_km / totalDistanceKm) * totalDurationMin;
    aidStationMinutes.set(aid.id, at_minute);
  }

  return { totalDurationMin, totalDistanceKm, hasGpx: false, aidStationMinutes };
}

function minuteAtKm(segments: GPXTrack['segments'], targetKm: number): number {
  if (targetKm <= 0) return 0;
  if (targetKm >= segments[segments.length - 1].km) {
    return segments[segments.length - 1].estimated_time_min;
  }

  for (let i = 0; i < segments.length; i += 1) {
    const seg = segments[i];
    if (seg.km >= targetKm) {
      const prevKm = i === 0 ? 0 : segments[i - 1].km;
      const prevTime = i === 0 ? 0 : segments[i - 1].estimated_time_min;
      const segLength = seg.km - prevKm;
      const t = segLength === 0 ? 0 : (targetKm - prevKm) / segLength;
      return prevTime + t * (seg.estimated_time_min - prevTime);
    }
  }
  return segments[segments.length - 1].estimated_time_min;
}
