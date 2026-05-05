import type { EventLog } from '../../models/event-log';
import { fromRow, toRow } from '../repos/event-log-repo';

function baseLog(overrides: Partial<EventLog> = {}): EventLog {
  return {
    id: 'log-001',
    race_id: 'race-001',
    planned_event_id: 'race-001::event-0',
    logged_at: 1_700_000_000_000,
    status: 'done',
    ...overrides,
  };
}

describe('event-log-repo round-trip', () => {
  it('preserves a done log without feeling', () => {
    const log = baseLog();
    expect(fromRow(toRow(log))).toEqual(log);
  });

  it('preserves a skipped log', () => {
    const log = baseLog({ status: 'skipped' });
    expect(fromRow(toRow(log))).toEqual(log);
  });

  it('preserves a log with feeling (check-in scenario)', () => {
    const log = baseLog({ feeling: 'good' });
    expect(fromRow(toRow(log))).toEqual(log);
  });

  it('preserves all feeling variants', () => {
    for (const feeling of ['good', 'meh', 'bad'] as const) {
      const log = baseLog({ feeling });
      expect(fromRow(toRow(log)).feeling).toBe(feeling);
    }
  });

  it('omits planned_event_id when not present (spontaneous log)', () => {
    const { planned_event_id: _omit, ...spontaneous } = baseLog();
    const log = spontaneous as EventLog;
    const back = fromRow(toRow(log));
    expect('planned_event_id' in back).toBe(false);
    expect(back.id).toBe(log.id);
  });

  it('omits feeling when not present', () => {
    const log = baseLog();
    const back = fromRow(toRow(log));
    expect('feeling' in back).toBe(false);
  });
});
