import type { GPXTrack } from '../../models/gpx-track';

export const DEFAULT_WINDOW_SIZE_MIN = 20;

export type PlanningWindow = {
  index: number;
  startMin: number;
  endMin: number;
  medianSlope: number;
};

export function buildWindows(input: {
  totalDurationMin: number;
  gpxTrack?: GPXTrack;
  windowSizeMin?: number;
}): PlanningWindow[] {
  const { totalDurationMin, gpxTrack } = input;
  const windowSize = input.windowSizeMin ?? DEFAULT_WINDOW_SIZE_MIN;

  if (totalDurationMin <= windowSize) return [];

  const segments = gpxTrack?.segments ?? [];
  const windows: PlanningWindow[] = [];

  // Skip the first window (démarrage). Start emitting from window index 1.
  let index = 1;
  let startMin = windowSize;

  while (startMin < totalDurationMin) {
    const endMin = Math.min(startMin + windowSize, totalDurationMin);
    const medianSlope = segments.length > 0 ? medianSlopeInRange(segments, startMin, endMin) : 0;
    windows.push({ index, startMin, endMin, medianSlope });
    index += 1;
    startMin += windowSize;
  }

  return windows;
}

function medianSlopeInRange(
  segments: GPXTrack['segments'],
  startMin: number,
  endMin: number,
): number {
  const slopes: number[] = [];
  for (const seg of segments) {
    if (seg.estimated_time_min > startMin && seg.estimated_time_min <= endMin) {
      slopes.push(seg.gradient);
    }
  }
  if (slopes.length === 0) return 0;
  slopes.sort((a, b) => a - b);
  const mid = Math.floor(slopes.length / 2);
  return slopes.length % 2 === 0 ? (slopes[mid - 1] + slopes[mid]) / 2 : slopes[mid];
}
