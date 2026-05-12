import type { GPXTrack } from '../../models/gpx-track';

import { categorizeSlope, type SlopeCategory } from './slope-categories';

export const DEFAULT_WINDOW_SIZE_MIN = 20;
export const MAX_TERRAIN_WINDOW_MIN = 30;

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
  firstWindowStartMin?: number;
}): PlanningWindow[] {
  const { totalDurationMin, gpxTrack } = input;
  const windowSize = input.windowSizeMin ?? DEFAULT_WINDOW_SIZE_MIN;
  const firstStart = Math.max(0, input.firstWindowStartMin ?? windowSize);

  if (totalDurationMin <= firstStart) return [];

  const segments = gpxTrack?.segments ?? [];

  if (segments.length === 0) {
    return buildFixedWindows(firstStart, totalDurationMin, windowSize);
  }

  return buildTerrainWindows(segments, firstStart, totalDurationMin);
}

function buildFixedWindows(
  firstStart: number,
  totalDurationMin: number,
  windowSize: number,
): PlanningWindow[] {
  const windows: PlanningWindow[] = [];
  let index = 1;
  let startMin = firstStart;
  while (startMin < totalDurationMin) {
    const endMin = Math.min(startMin + windowSize, totalDurationMin);
    windows.push({ index, startMin, endMin, medianSlope: 0 });
    index += 1;
    startMin += windowSize;
  }
  return windows;
}

function buildTerrainWindows(
  segments: GPXTrack['segments'],
  firstStart: number,
  totalDurationMin: number,
): PlanningWindow[] {
  type Run = { startMin: number; endMin: number; slopes: number[]; category: SlopeCategory };
  const runs: Run[] = [];

  let currentRun: Run | null = null;
  let prevTime = 0;

  for (const seg of segments) {
    const intervalStart = Math.max(prevTime, firstStart);
    const intervalEnd = Math.min(seg.estimated_time_min, totalDurationMin);
    prevTime = seg.estimated_time_min;
    if (intervalEnd <= firstStart) continue;
    if (intervalStart >= totalDurationMin) break;
    if (intervalEnd <= intervalStart) continue;

    const cat = categorizeSlope(seg.gradient);
    if (currentRun && currentRun.category === cat) {
      currentRun.endMin = intervalEnd;
      currentRun.slopes.push(seg.gradient);
    } else {
      if (currentRun) runs.push(currentRun);
      currentRun = {
        startMin: intervalStart,
        endMin: intervalEnd,
        slopes: [seg.gradient],
        category: cat,
      };
    }
  }
  if (currentRun) runs.push(currentRun);

  const windows: PlanningWindow[] = [];
  let index = 1;
  for (const run of runs) {
    const median = computeMedian(run.slopes);
    for (const chunk of splitByMax(run.startMin, run.endMin, MAX_TERRAIN_WINDOW_MIN)) {
      windows.push({ index, startMin: chunk.startMin, endMin: chunk.endMin, medianSlope: median });
      index += 1;
    }
  }
  return windows;
}

function splitByMax(
  startMin: number,
  endMin: number,
  maxMin: number,
): { startMin: number; endMin: number }[] {
  const duration = endMin - startMin;
  if (duration <= maxMin) return [{ startMin, endMin }];
  const chunks: { startMin: number; endMin: number }[] = [];
  const n = Math.ceil(duration / maxMin);
  const chunkSize = duration / n;
  for (let i = 0; i < n; i += 1) {
    chunks.push({
      startMin: startMin + i * chunkSize,
      endMin: i === n - 1 ? endMin : startMin + (i + 1) * chunkSize,
    });
  }
  return chunks;
}

function computeMedian(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}
