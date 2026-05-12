import {
  feedbackIdFor,
  type EventFeedback,
} from '../../models/event-feedback';
import {
  fromRow,
  mergeFeedback,
  toRow,
} from '../repos/event-feedback-repo';

function baseFeedback(overrides: Partial<EventFeedback> = {}): EventFeedback {
  return {
    id: 'feedback-race-001::event-0',
    race_id: 'race-001',
    planned_event_id: 'race-001::event-0',
    created_at: 1_700_000_000_000,
    updated_at: 1_700_000_000_000,
    ...overrides,
  };
}

describe('event-feedback-repo round-trip', () => {
  it('preserves an empty feedback (no fields set)', () => {
    const fb = baseFeedback();
    expect(fromRow(toRow(fb))).toEqual(fb);
  });

  it('preserves a skip_reason', () => {
    const fb = baseFeedback({ skip_reason: 'stomach' });
    expect(fromRow(toRow(fb))).toEqual(fb);
  });

  it('preserves tags array', () => {
    const fb = baseFeedback({ tags: ['too_early', 'terrain'] });
    expect(fromRow(toRow(fb))).toEqual(fb);
  });

  it('preserves single tag', () => {
    const fb = baseFeedback({ tags: ['ok'] });
    expect(fromRow(toRow(fb))).toEqual(fb);
  });

  it('preserves actual_quantity', () => {
    const fb = baseFeedback({ actual_quantity: 'half' });
    expect(fromRow(toRow(fb))).toEqual(fb);
  });

  it('preserves all fields set together', () => {
    const fb = baseFeedback({
      skip_reason: 'too_close',
      tags: ['too_close', 'taste'],
      actual_quantity: 'quarter',
    });
    expect(fromRow(toRow(fb))).toEqual(fb);
  });

  it('omits skip_reason when not present', () => {
    const back = fromRow(toRow(baseFeedback()));
    expect('skip_reason' in back).toBe(false);
  });

  it('omits tags when not present', () => {
    const back = fromRow(toRow(baseFeedback()));
    expect('tags' in back).toBe(false);
  });

  it('omits actual_quantity when not present', () => {
    const back = fromRow(toRow(baseFeedback()));
    expect('actual_quantity' in back).toBe(false);
  });
});

describe('feedbackIdFor', () => {
  it('produces a deterministic id from planned_event_id', () => {
    expect(feedbackIdFor('race-001::event-3')).toBe('feedback-race-001::event-3');
  });
});

describe('mergeFeedback', () => {
  const args = {
    raceId: 'race-001',
    plannedEventId: 'race-001::event-0',
    now: 1_700_000_000_000,
  };

  it('creates a new feedback when none exists, using deterministic id', () => {
    const result = mergeFeedback(null, {
      ...args,
      patch: { skip_reason: 'stomach' },
    });
    expect(result.id).toBe('feedback-race-001::event-0');
    expect(result.skip_reason).toBe('stomach');
    expect(result.created_at).toBe(args.now);
    expect(result.updated_at).toBe(args.now);
  });

  it('merges patch into existing, preserving untouched fields', () => {
    const existing = baseFeedback({
      skip_reason: 'stomach',
      tags: ['too_early'],
    });
    const result = mergeFeedback(existing, {
      ...args,
      now: 1_700_000_500_000,
      patch: { actual_quantity: 'half' },
    });
    expect(result.skip_reason).toBe('stomach');
    expect(result.tags).toEqual(['too_early']);
    expect(result.actual_quantity).toBe('half');
    expect(result.updated_at).toBe(1_700_000_500_000);
    expect(result.created_at).toBe(existing.created_at);
  });

  it('clears skip_reason when patch sets it to null', () => {
    const existing = baseFeedback({ skip_reason: 'stomach', tags: ['ok'] });
    const result = mergeFeedback(existing, {
      ...args,
      patch: { skip_reason: null },
    });
    expect('skip_reason' in result).toBe(false);
    expect(result.tags).toEqual(['ok']);
  });

  it('clears tags when patch sets them to empty array', () => {
    const existing = baseFeedback({ tags: ['terrain', 'taste'] });
    const result = mergeFeedback(existing, {
      ...args,
      patch: { tags: [] },
    });
    expect('tags' in result).toBe(false);
  });

  it('clears actual_quantity when patch sets it to null', () => {
    const existing = baseFeedback({ actual_quantity: 'full' });
    const result = mergeFeedback(existing, {
      ...args,
      patch: { actual_quantity: null },
    });
    expect('actual_quantity' in result).toBe(false);
  });

  it('replaces tags entirely (no incremental append)', () => {
    const existing = baseFeedback({ tags: ['stomach', 'terrain'] });
    const result = mergeFeedback(existing, {
      ...args,
      patch: { tags: ['ok'] },
    });
    expect(result.tags).toEqual(['ok']);
  });

  it('is idempotent on identical patches', () => {
    const r1 = mergeFeedback(null, {
      ...args,
      patch: { skip_reason: 'taste' },
    });
    const r2 = mergeFeedback(r1, { ...args, patch: { skip_reason: 'taste' } });
    expect(r2.skip_reason).toBe('taste');
    expect(r2.id).toBe(r1.id);
  });
});
