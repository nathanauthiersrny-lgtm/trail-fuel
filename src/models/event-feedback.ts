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
  | 'other'
  | 'ok';

export const FEEDBACK_TAGS: readonly FeedbackTag[] = [
  'stomach',
  'taste',
  'too_early',
  'too_late',
  'too_close',
  'terrain',
  'other',
  'ok',
];

/**
 * Every SkipReason has a 1-to-1 equivalent FeedbackTag. Used by the summary view
 * to pre-populate the user's in-race skip reason as a tag, so the data they
 * already gave is visible (and editable) in the debrief.
 */
export function skipReasonToTag(skipReason: SkipReason): FeedbackTag {
  return skipReason;
}

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
