import { buildCheckIns } from '../../planning/check-ins';

describe('buildCheckIns', () => {
  it('places one check-in at 30 min for a 60-min race (freq 50)', () => {
    const events = buildCheckIns({
      totalDurationMin: 60,
      firstCheckInMin: 30,
      frequencyMin: 50,
    });
    expect(events).toHaveLength(1);
    expect(events[0]).toEqual({
      scheduled_at_minute: 30,
      type: 'check_in',
      payload: {},
    });
  });

  it('places check-ins at 30, 80, 130 for a 180-min race (freq 50)', () => {
    const events = buildCheckIns({
      totalDurationMin: 180,
      firstCheckInMin: 30,
      frequencyMin: 50,
    });
    expect(events.map((e) => e.scheduled_at_minute)).toEqual([30, 80, 130]);
  });

  it('does not place a check-in at exactly the race end', () => {
    const events = buildCheckIns({
      totalDurationMin: 80,
      firstCheckInMin: 30,
      frequencyMin: 50,
    });
    // Would place at 30, then 80 (= duration) → excluded
    expect(events.map((e) => e.scheduled_at_minute)).toEqual([30]);
  });

  it('returns no check-ins when first time is past the race end', () => {
    expect(
      buildCheckIns({ totalDurationMin: 25, firstCheckInMin: 30, frequencyMin: 50 }),
    ).toEqual([]);
  });

  it('handles competition-mode frequency (45 min)', () => {
    const events = buildCheckIns({
      totalDurationMin: 200,
      firstCheckInMin: 30,
      frequencyMin: 45,
    });
    expect(events.map((e) => e.scheduled_at_minute)).toEqual([30, 75, 120, 165]);
  });
});
