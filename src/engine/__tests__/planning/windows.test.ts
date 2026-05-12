import type { GPXTrack } from '../../../models/gpx-track';

import { buildWindows, DEFAULT_WINDOW_SIZE_MIN } from '../../planning/windows';

function makeFakeTrackWithGradients(
  totalDurationMin: number,
  gradientsByMinute: { fromMin: number; toMin: number; gradient: number }[],
): GPXTrack {
  const segments = [];
  const stepMin = 1;
  for (let m = stepMin; m <= totalDurationMin; m += stepMin) {
    const range = gradientsByMinute.find((r) => m > r.fromMin && m <= r.toMin);
    segments.push({
      km: m * 0.1,
      elevation_m: 1000,
      gradient: range ? range.gradient : 0,
      estimated_time_min: m,
    });
  }
  return {
    total_distance_km: totalDurationMin * 0.1,
    total_elevation_gain_m: 0,
    total_elevation_loss_m: 0,
    segments,
  };
}

describe('buildWindows', () => {
  it('returns empty array when duration is shorter than one window', () => {
    expect(buildWindows({ totalDurationMin: 15 })).toEqual([]);
    expect(buildWindows({ totalDurationMin: 20 })).toEqual([]);
  });

  it('skips the first 20-min window (démarrage)', () => {
    const windows = buildWindows({ totalDurationMin: 80 });
    expect(windows[0].startMin).toBe(20);
    expect(windows[0].index).toBe(1);
  });

  it('produces 3 windows for a 80-min race (skipping the first)', () => {
    const windows = buildWindows({ totalDurationMin: 80 });
    expect(windows).toHaveLength(3);
    expect(windows.map((w) => [w.startMin, w.endMin])).toEqual([
      [20, 40],
      [40, 60],
      [60, 80],
    ]);
  });

  it('clips the last window to the remaining duration', () => {
    const windows = buildWindows({ totalDurationMin: 75 });
    const last = windows[windows.length - 1];
    expect(last.startMin).toBe(60);
    expect(last.endMin).toBe(75);
  });

  it('returns medianSlope = 0 when no GPX is provided', () => {
    const windows = buildWindows({ totalDurationMin: 80 });
    expect(windows.every((w) => w.medianSlope === 0)).toBe(true);
  });

  it('computes median slope per window from GPX segments', () => {
    const track = makeFakeTrackWithGradients(80, [
      { fromMin: 20, toMin: 40, gradient: 0.10 },
      { fromMin: 40, toMin: 60, gradient: -0.05 },
    ]);
    const windows = buildWindows({ totalDurationMin: 80, gpxTrack: track });
    const w20to40 = windows.find((w) => w.startMin === 20)!;
    const w40to60 = windows.find((w) => w.startMin === 40)!;
    const w60to80 = windows.find((w) => w.startMin === 60)!;
    expect(w20to40.medianSlope).toBeCloseTo(0.10, 6);
    expect(w40to60.medianSlope).toBeCloseTo(-0.05, 6);
    expect(w60to80.medianSlope).toBeCloseTo(0, 6);
  });

  it('respects custom windowSizeMin', () => {
    const windows = buildWindows({ totalDurationMin: 60, windowSizeMin: 10 });
    expect(windows[0].startMin).toBe(10);
    expect(windows[0].endMin).toBe(20);
    expect(windows).toHaveLength(5); // 10..20, 20..30, 30..40, 40..50, 50..60
  });

  it('uses DEFAULT_WINDOW_SIZE_MIN = 20', () => {
    expect(DEFAULT_WINDOW_SIZE_MIN).toBe(20);
  });

  describe('terrain-aware (with GPX)', () => {
    it('groups consecutive segments of the same category into a single window', () => {
      // 25 min flat span (≤ MAX_TERRAIN_WINDOW_MIN=30 → no split)
      const track = makeFakeTrackWithGradients(45, [
        { fromMin: 0, toMin: 45, gradient: 0.0 },
      ]);
      const windows = buildWindows({
        totalDurationMin: 45,
        gpxTrack: track,
        firstWindowStartMin: 20,
      });
      expect(windows).toHaveLength(1);
      expect(windows[0].startMin).toBe(20);
      expect(windows[0].endMin).toBe(45);
      expect(windows[0].medianSlope).toBeCloseTo(0, 6);
    });

    it('splits at slope-category transitions', () => {
      // 20-30: climb_steep, 30-45: flat, 45-60: descent_technical
      const track = makeFakeTrackWithGradients(60, [
        { fromMin: 20, toMin: 30, gradient: 0.15 },
        { fromMin: 30, toMin: 45, gradient: 0.0 },
        { fromMin: 45, toMin: 60, gradient: -0.12 },
      ]);
      const windows = buildWindows({
        totalDurationMin: 60,
        gpxTrack: track,
        firstWindowStartMin: 20,
      });
      expect(windows).toHaveLength(3);
      expect(windows.map((w) => [w.startMin, w.endMin])).toEqual([
        [20, 30],
        [30, 45],
        [45, 60],
      ]);
    });

    it('does NOT split when gradients differ but stay in the same category', () => {
      // 0.04 and 0.08 are both in `climb` (0.03 < x ≤ 0.10). 25-min span < MAX so no chunking.
      const track = makeFakeTrackWithGradients(45, [
        { fromMin: 20, toMin: 32, gradient: 0.04 },
        { fromMin: 32, toMin: 45, gradient: 0.08 },
      ]);
      const windows = buildWindows({
        totalDurationMin: 45,
        gpxTrack: track,
        firstWindowStartMin: 20,
      });
      expect(windows).toHaveLength(1);
      expect(windows[0].startMin).toBe(20);
      expect(windows[0].endMin).toBe(45);
    });

    it('splits a mega-window when its duration exceeds MAX_TERRAIN_WINDOW_MIN', () => {
      // 45-min flat run → split into 2 chunks of ~22.5 min
      const track = makeFakeTrackWithGradients(60, [
        { fromMin: 15, toMin: 60, gradient: 0.0 },
      ]);
      const windows = buildWindows({
        totalDurationMin: 60,
        gpxTrack: track,
        firstWindowStartMin: 15,
      });
      expect(windows).toHaveLength(2);
      expect(windows[0].startMin).toBe(15);
      expect(windows[1].endMin).toBe(60);
      // All chunks share the same medianSlope (same category)
      expect(windows[0].medianSlope).toBeCloseTo(windows[1].medianSlope, 6);
    });

    it('falls back to fixed-size windows when gpxTrack has no segments', () => {
      const emptyTrack = {
        total_distance_km: 0,
        total_elevation_gain_m: 0,
        total_elevation_loss_m: 0,
        segments: [],
      };
      const windows = buildWindows({ totalDurationMin: 60, gpxTrack: emptyTrack });
      // Fixed 20-min path → 2 windows (20-40, 40-60)
      expect(windows).toHaveLength(2);
      expect(windows.every((w) => w.medianSlope === 0)).toBe(true);
    });

    it('assigns sequential index starting at 1', () => {
      const track = makeFakeTrackWithGradients(60, [
        { fromMin: 20, toMin: 30, gradient: 0.15 },
        { fromMin: 30, toMin: 60, gradient: 0.0 },
      ]);
      const windows = buildWindows({
        totalDurationMin: 60,
        gpxTrack: track,
        firstWindowStartMin: 20,
      });
      expect(windows.map((w) => w.index)).toEqual([1, 2]);
    });
  });
});
