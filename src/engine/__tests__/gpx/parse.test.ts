import * as fs from 'node:fs';
import * as path from 'node:path';

import { GpxParseError, parseGpx } from '../../gpx/parse';

const fixturesDir = path.join(__dirname, '..', 'fixtures', 'gpx');

function loadFixture(name: string): string {
  return fs.readFileSync(path.join(fixturesDir, name), 'utf8');
}

describe('parseGpx', () => {
  it('parses flat-1km.gpx into 11 RawPoints with constant elevation', () => {
    const points = parseGpx(loadFixture('flat-1km.gpx'));

    expect(points).toHaveLength(11);
    expect(points[0]).toEqual({ lat: 45.0, lon: 6.0, ele: 1000 });
    expect(points[10]).toEqual({ lat: 45.009, lon: 6.0, ele: 1000 });
    for (const p of points) {
      expect(p.ele).toBe(1000);
      expect(p.lon).toBe(6.0);
    }
  });

  it('throws GpxParseError on malformed XML', () => {
    expect(() => parseGpx('<not valid gpx>')).toThrow(GpxParseError);
  });

  it('throws GpxParseError when there is no <trk>', () => {
    const empty = `<?xml version="1.0"?><gpx version="1.1" xmlns="http://www.topografix.com/GPX/1/1"></gpx>`;
    expect(() => parseGpx(empty)).toThrow(GpxParseError);
  });

  it('defaults missing elevation to 0', () => {
    const noEle = `<?xml version="1.0"?>
<gpx version="1.1" xmlns="http://www.topografix.com/GPX/1/1">
  <trk><trkseg>
    <trkpt lat="45.0" lon="6.0"></trkpt>
    <trkpt lat="45.0009" lon="6.0"></trkpt>
  </trkseg></trk>
</gpx>`;
    const points = parseGpx(noEle);
    expect(points).toHaveLength(2);
    expect(points.every((p) => p.ele === 0)).toBe(true);
  });
});
