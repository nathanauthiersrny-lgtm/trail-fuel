import type { AidStation } from '../../../models/aid-station';

import { APPROACHING_LEAD_MIN, buildAidStationEvents } from '../../planning/aid-stations';

function makeAid(id: string, at_km: number): AidStation {
  return {
    id,
    at_km,
    estimated_at_minute: 0,
    available: { water: true, isotonic: false, solid_food: false, refill_possible: true },
  };
}

describe('buildAidStationEvents', () => {
  it('emits two events (approaching, arrived) per aid station', () => {
    const events = buildAidStationEvents({
      aidStations: [makeAid('a', 5)],
      aidStationMinutes: new Map([['a', 60]]),
      totalDurationMin: 180,
    });
    expect(events).toHaveLength(2);
    expect(events[0]).toEqual({
      scheduled_at_minute: 60 - APPROACHING_LEAD_MIN,
      type: 'aid_station',
      payload: { aid_station_id: 'a', aid_phase: 'approaching' },
    });
    expect(events[1]).toEqual({
      scheduled_at_minute: 60,
      type: 'aid_station',
      payload: { aid_station_id: 'a', aid_phase: 'arrived' },
    });
  });

  it('skips aid stations at minute 0 (start)', () => {
    const events = buildAidStationEvents({
      aidStations: [makeAid('start', 0)],
      aidStationMinutes: new Map([['start', 0]]),
      totalDurationMin: 180,
    });
    expect(events).toEqual([]);
  });

  it('skips aid stations at the race end', () => {
    const events = buildAidStationEvents({
      aidStations: [makeAid('end', 30)],
      aidStationMinutes: new Map([['end', 180]]),
      totalDurationMin: 180,
    });
    expect(events).toEqual([]);
  });

  it('drops the approaching event if it would land before minute 0', () => {
    const events = buildAidStationEvents({
      aidStations: [makeAid('early', 0.5)],
      aidStationMinutes: new Map([['early', 2]]), // approaching = -1
      totalDurationMin: 180,
    });
    expect(events).toHaveLength(1);
    expect(events[0].payload.aid_phase).toBe('arrived');
  });

  it('emits in input order across multiple aid stations', () => {
    const events = buildAidStationEvents({
      aidStations: [makeAid('a', 5), makeAid('b', 10)],
      aidStationMinutes: new Map([
        ['a', 60],
        ['b', 120],
      ]),
      totalDurationMin: 180,
    });
    expect(events).toHaveLength(4);
    expect(events.map((e) => e.payload.aid_station_id)).toEqual(['a', 'a', 'b', 'b']);
  });

  it('skips aid stations missing from the minutes map', () => {
    const events = buildAidStationEvents({
      aidStations: [makeAid('orphan', 5)],
      aidStationMinutes: new Map(),
      totalDurationMin: 180,
    });
    expect(events).toEqual([]);
  });
});
