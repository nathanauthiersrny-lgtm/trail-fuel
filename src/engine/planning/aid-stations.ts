import type { AidStation } from '../../models/aid-station';

import type { DraftEvent } from './check-ins';

export const APPROACHING_LEAD_MIN = 3;

export function buildAidStationEvents(input: {
  aidStations: AidStation[];
  aidStationMinutes: Map<string, number>;
  totalDurationMin: number;
}): DraftEvent[] {
  const { aidStations, aidStationMinutes, totalDurationMin } = input;
  const events: DraftEvent[] = [];

  for (const aid of aidStations) {
    const minute = aidStationMinutes.get(aid.id);
    if (minute === undefined) continue;
    if (minute <= 0 || minute >= totalDurationMin) continue;

    const approachingAt = minute - APPROACHING_LEAD_MIN;
    if (approachingAt > 0) {
      events.push({
        scheduled_at_minute: approachingAt,
        type: 'aid_station',
        payload: { aid_station_id: aid.id, aid_phase: 'approaching' },
      });
    }
    events.push({
      scheduled_at_minute: minute,
      type: 'aid_station',
      payload: { aid_station_id: aid.id, aid_phase: 'arrived' },
    });
  }

  return events;
}
