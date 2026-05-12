/**
 * Reasons offered in the in-race dialog when the user skips an intake
 * outside competition mode. Subset of FeedbackTag — "too_late" and "ok"
 * don't apply at skip time (you only know in retrospect).
 */
export type SkipReason =
  | 'stomach'
  | 'taste'
  | 'too_early'
  | 'too_close'
  | 'terrain'
  | 'other';

export const SKIP_REASONS: readonly SkipReason[] = [
  'stomach',
  'taste',
  'too_early',
  'too_close',
  'terrain',
  'other',
];

/**
 * Tags applied post-race in the debrief view of RaceSummary.
 * Multi-select per event. Shares semantic with SkipReason where it overlaps.
 */
export type FeedbackTag =
  | 'stomach'
  | 'taste'
  | 'too_early'
  | 'too_late'
  | 'too_close'
  | 'terrain'
  | 'ok';

export const FEEDBACK_TAGS: readonly FeedbackTag[] = [
  'stomach',
  'taste',
  'too_early',
  'too_late',
  'too_close',
  'terrain',
  'ok',
];

/**
 * Coarse portion actually consumed, set post-race only for events with
 * status="done". Absent means unspecified, interpreted as "full" by analyses.
 */
export type QuantityActual = 'full' | 'half' | 'quarter';

export const QUANTITY_ACTUALS: readonly QuantityActual[] = [
  'full',
  'half',
  'quarter',
];

export type EventFeedback = {
  id: string;
  race_id: string;
  planned_event_id: string;
  skip_reason?: SkipReason;
  tags?: FeedbackTag[];
  actual_quantity?: QuantityActual;
  created_at: number;
  updated_at: number;
};

export function feedbackIdFor(plannedEventId: string): string {
  return `feedback-${plannedEventId}`;
}
