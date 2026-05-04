import type { GPXSegment, GPXTrack } from '../../../models/gpx-track';
import { downsampleForDisplay } from '../../gpx/display';

function makeTrack(count: number): GPXTrack {
  const segments: GPXSegment[] = Array.from({ length: count }, (_, i) => ({
    km: i * 0.1,
    elevation_m: 1000 + i,
    gradient: 0,
    estimated_time_min: i * 0.5,
  }));
  return {
    total_distance_km: count * 0.1,
    total_elevation_gain_m: count,
    total_elevation_loss_m: 0,
    segments,
  };
}

describe('downsampleForDisplay', () => {
  it('returns the original array when count ≤ targetPoints', () => {
    const track = makeTrack(100);
    const result = downsampleForDisplay(track, 200);
    expect(result).toBe(track.segments);
  });

  it('returns exactly targetPoints segments when count > targetPoints', () => {
    const track = makeTrack(1000);
    const result = downsampleForDisplay(track, 200);
    expect(result).toHaveLength(200);
  });

  it('always includes the first segment', () => {
    const track = makeTrack(500);
    const result = downsampleForDisplay(track, 100);
    expect(result[0]).toBe(track.segments[0]);
  });

  it('always includes the last segment', () => {
    const track = makeTrack(500);
    const result = downsampleForDisplay(track, 100);
    expect(result[result.length - 1]).toBe(track.segments[499]);
  });

  it('defaults to 200 target points', () => {
    const track = makeTrack(1000);
    const result = downsampleForDisplay(track);
    expect(result).toHaveLength(200);
  });

  it('handles a track with exactly targetPoints segments', () => {
    const track = makeTrack(200);
    const result = downsampleForDisplay(track, 200);
    expect(result).toBe(track.segments);
    expect(result).toHaveLength(200);
  });

  it('handles a track with 1 segment', () => {
    const track = makeTrack(1);
    const result = downsampleForDisplay(track, 200);
    expect(result).toHaveLength(1);
  });

  it('handles targetPoints = 2 (first + last only)', () => {
    const track = makeTrack(50);
    const result = downsampleForDisplay(track, 2);
    expect(result).toHaveLength(2);
    expect(result[0]).toBe(track.segments[0]);
    expect(result[1]).toBe(track.segments[49]);
  });

  it('output is evenly distributed (no duplicate indices)', () => {
    const track = makeTrack(1000);
    const result = downsampleForDisplay(track, 200);
    const kms = result.map((s) => s.km);
    // All km values should be unique (evenly spaced, no repeats)
    expect(new Set(kms).size).toBe(200);
  });
});
