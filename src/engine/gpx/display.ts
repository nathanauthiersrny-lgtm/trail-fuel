import type { GPXSegment, GPXTrack } from '../../models/gpx-track';

/**
 * Reduces a GPXTrack to at most `targetPoints` evenly spaced segments for
 * chart rendering. Always includes the first and last segment.
 *
 * The GPXTrack may have thousands of 100m segments; SVG charts need ~200 max
 * to stay performant without visual loss.
 */
export function downsampleForDisplay(
  track: GPXTrack,
  targetPoints = 200,
): GPXSegment[] {
  const { segments } = track;
  if (segments.length <= targetPoints) return segments;

  const result: GPXSegment[] = [];
  // Always include first and last. For the middle points, pick evenly spaced indices.
  const step = (segments.length - 1) / (targetPoints - 1);

  for (let i = 0; i < targetPoints; i++) {
    const idx = Math.round(i * step);
    result.push(segments[Math.min(idx, segments.length - 1)]);
  }

  return result;
}
