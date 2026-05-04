import type { GPXSegment, GPXTrack } from '../../models/gpx-track';

import { parseGpx } from './parse';
import { resampleAt100m, RESAMPLE_INTERVAL_M } from './resample';
import { smoothElevations } from './smooth';
import { calibratedSpeedKmh, clampSlope, paceMinPerKmToSpeedKmh } from './tobler';

export type BuildGpxTrackInput = {
  gpxString: string;
  flatPaceMinPerKm: number;
  calibrationFactor: number;
};

export function buildGpxTrack(input: BuildGpxTrackInput): GPXTrack {
  const { gpxString, flatPaceMinPerKm, calibrationFactor } = input;

  const rawPoints = parseGpx(gpxString);
  const resampled = resampleAt100m(rawPoints);

  if (resampled.length < 2) {
    throw new Error('buildGpxTrack: GPX has fewer than 2 trackpoints after resampling — file is empty or too short');
  }

  const smoothedEle = smoothElevations(resampled.map((p) => p.ele));
  const userFlatSpeedKmh = paceMinPerKmToSpeedKmh(flatPaceMinPerKm);

  const segments: GPXSegment[] = [];
  let cumulativeKm = 0;
  let cumulativeTimeMin = 0;
  let totalGain = 0;
  let totalLoss = 0;

  for (let i = 1; i < resampled.length; i += 1) {
    const eleDelta = smoothedEle[i] - smoothedEle[i - 1];
    const rawGradient = eleDelta / RESAMPLE_INTERVAL_M;
    const gradient = clampSlope(rawGradient);

    const speedKmh = calibratedSpeedKmh(gradient, userFlatSpeedKmh, calibrationFactor);
    const segmentDistanceKm = RESAMPLE_INTERVAL_M / 1000;
    const segmentTimeMin = (segmentDistanceKm / speedKmh) * 60;

    cumulativeKm += segmentDistanceKm;
    cumulativeTimeMin += segmentTimeMin;

    if (eleDelta > 0) totalGain += eleDelta;
    else totalLoss += -eleDelta;

    segments.push({
      km: cumulativeKm,
      elevation_m: smoothedEle[i],
      gradient,
      estimated_time_min: cumulativeTimeMin,
    });
  }

  return {
    total_distance_km: cumulativeKm,
    total_elevation_gain_m: totalGain,
    total_elevation_loss_m: totalLoss,
    segments,
  };
}
