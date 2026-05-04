import { parseGPXWithCustomParser } from '@we-gold/gpxjs';
import { DOMParser } from 'xmldom-qsa';

export type RawPoint = {
  lat: number;
  lon: number;
  ele: number;
};

export class GpxParseError extends Error {
  constructor(message: string, readonly cause?: unknown) {
    super(message);
    this.name = 'GpxParseError';
  }
}

const customParse = (txt: string): Document | null =>
  new DOMParser().parseFromString(txt, 'text/xml') as unknown as Document;

export function parseGpx(gpxString: string): RawPoint[] {
  const [parsed, error] = parseGPXWithCustomParser(gpxString, customParse);

  if (error) throw new GpxParseError(error.message, error);
  if (!parsed) throw new GpxParseError('parseGPXWithCustomParser returned null without error');

  const track = parsed.tracks[0];
  if (!track) throw new GpxParseError('GPX has no <trk> track');

  return track.points.map((p) => ({
    lat: p.latitude,
    lon: p.longitude,
    ele: p.elevation ?? 0,
  }));
}
