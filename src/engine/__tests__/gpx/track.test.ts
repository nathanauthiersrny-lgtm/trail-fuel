import * as fs from 'node:fs';
import * as path from 'node:path';

import { buildGpxTrack } from '../../gpx/track';

const fixturesDir = path.join(__dirname, '..', 'fixtures', 'gpx');

function loadFixture(name: string): string {
  return fs.readFileSync(path.join(fixturesDir, name), 'utf8');
}

describe('buildGpxTrack', () => {
  it('produces a flat track with predictable timing on flat-1km.gpx', () => {
    const track = buildGpxTrack({
      gpxString: loadFixture('flat-1km.gpx'),
      flatPaceMinPerKm: 6,
      calibrationFactor: 1.0,
    });

    expect(track.total_distance_km).toBeCloseTo(1.0, 1);
    expect(track.total_elevation_gain_m).toBeCloseTo(0, 6);
    expect(track.total_elevation_loss_m).toBeCloseTo(0, 6);
    // 1 km at 6 min/km flat → ~6 min total
    const lastSegment = track.segments[track.segments.length - 1];
    expect(lastSegment.estimated_time_min).toBeGreaterThan(5.5);
    expect(lastSegment.estimated_time_min).toBeLessThan(6.5);
  });

  it('produces 10 segments on a 1 km flat track (resampled to 11 points)', () => {
    const track = buildGpxTrack({
      gpxString: loadFixture('flat-1km.gpx'),
      flatPaceMinPerKm: 6,
      calibrationFactor: 1.0,
    });
    expect(track.segments).toHaveLength(10);
  });

  it('throws for a single-point GPX (cannot form segments)', () => {
    const single = `<?xml version="1.0"?>
<gpx version="1.1" xmlns="http://www.topografix.com/GPX/1/1">
  <trk><trkseg>
    <trkpt lat="45.0" lon="6.0"><ele>1000</ele></trkpt>
  </trkseg></trk>
</gpx>`;
    expect(() =>
      buildGpxTrack({ gpxString: single, flatPaceMinPerKm: 6, calibrationFactor: 1 }),
    ).toThrow('buildGpxTrack: GPX has fewer than 2 trackpoints after resampling');
  });

  it('throws for an empty GPX (no trackpoints)', () => {
    const empty = `<?xml version="1.0"?>
<gpx version="1.1" xmlns="http://www.topografix.com/GPX/1/1">
  <trk><trkseg></trkseg></trk>
</gpx>`;
    expect(() =>
      buildGpxTrack({ gpxString: empty, flatPaceMinPerKm: 6, calibrationFactor: 1 }),
    ).toThrow('buildGpxTrack: GPX has fewer than 2 trackpoints after resampling');
  });

  it('scales total time inversely with calibrationFactor', () => {
    const fast = buildGpxTrack({
      gpxString: loadFixture('flat-1km.gpx'),
      flatPaceMinPerKm: 6,
      calibrationFactor: 1.5,
    });
    const slow = buildGpxTrack({
      gpxString: loadFixture('flat-1km.gpx'),
      flatPaceMinPerKm: 6,
      calibrationFactor: 0.5,
    });
    const fastTime = fast.segments[fast.segments.length - 1].estimated_time_min;
    const slowTime = slow.segments[slow.segments.length - 1].estimated_time_min;
    expect(slowTime).toBeCloseTo(3 * fastTime, 1);
  });

  it('reports D+ from a synthetic climb-only GPX', () => {
    // 1 km of climb, +500m elevation
    const climb = `<?xml version="1.0"?>
<gpx version="1.1" xmlns="http://www.topografix.com/GPX/1/1">
  <trk><trkseg>
    ${Array.from({ length: 11 }, (_, i) =>
      `<trkpt lat="${45 + i * 0.0009}" lon="6.0"><ele>${i * 50}</ele></trkpt>`,
    ).join('\n    ')}
  </trkseg></trk>
</gpx>`;
    const track = buildGpxTrack({ gpxString: climb, flatPaceMinPerKm: 6, calibrationFactor: 1 });
    // Smoothing dilutes the edges: a true 500m climb shows ~400m on smoothed data.
    expect(track.total_elevation_gain_m).toBeGreaterThan(350);
    expect(track.total_elevation_gain_m).toBeLessThanOrEqual(500);
    expect(track.total_elevation_loss_m).toBeCloseTo(0, 6);
  });
});
