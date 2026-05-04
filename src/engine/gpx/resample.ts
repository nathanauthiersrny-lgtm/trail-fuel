import { cumulativeDistances } from './haversine';
import type { RawPoint } from './parse';

export const RESAMPLE_INTERVAL_M = 100;

export function resampleAt100m(points: RawPoint[]): RawPoint[] {
  if (points.length === 0) return [];
  if (points.length === 1) return [points[0]];

  const cum = cumulativeDistances(points);
  const total = cum[cum.length - 1];
  const numTargets = Math.floor(total / RESAMPLE_INTERVAL_M) + 1;

  const result: RawPoint[] = [];
  let segStart = 0;

  for (let n = 0; n < numTargets; n += 1) {
    const d = n * RESAMPLE_INTERVAL_M;

    while (segStart + 1 < cum.length && cum[segStart + 1] < d) {
      segStart += 1;
    }
    if (segStart + 1 >= points.length) {
      result.push(points[points.length - 1]);
      continue;
    }

    const a = points[segStart];
    const b = points[segStart + 1];
    const segLen = cum[segStart + 1] - cum[segStart];
    const t = segLen === 0 ? 0 : (d - cum[segStart]) / segLen;

    result.push({
      lat: a.lat + (b.lat - a.lat) * t,
      lon: a.lon + (b.lon - a.lon) * t,
      ele: a.ele + (b.ele - a.ele) * t,
    });
  }

  return result;
}
