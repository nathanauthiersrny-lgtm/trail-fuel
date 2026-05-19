/**
 * Safety bounds — applique des garde-fous physiologiques sur un TimelinePlan
 * (qu'il soit produit par l'engine ou enrichi par le LLM).
 *
 * Le validator est partagé : appelé après generation côté mobile, et après
 * enrichissement côté companion. C'est la dernière ligne de défense contre
 * un plan dangereux.
 */

import type {
  PlanValidation,
  PlanValidationWarning,
  TimelineEvent,
  TimelinePlan,
} from '../../models/timeline-plan';
import { resolveTargetAt } from '../../models/timeline-plan';
import { SAFETY_BOUNDS } from './constants';

export type ValidationContext = {
  totalDurationMin: number;
};

export function validatePlan(plan: TimelinePlan, ctx: ValidationContext): PlanValidation {
  const warnings: PlanValidationWarning[] = [];

  warnings.push(...checkTargetBounds(plan, ctx));
  warnings.push(...checkIntakeIntervals(plan.events));
  warnings.push(...checkEventOrdering(plan.events, ctx));

  const passed = warnings.every((w) => w.severity !== 'high');
  return { passed, warnings };
}

// ─── Target bounds ──────────────────────────────────────────────────────────

function checkTargetBounds(plan: TimelinePlan, ctx: ValidationContext): PlanValidationWarning[] {
  const warnings: PlanValidationWarning[] = [];
  const probe = sampleMinutes(ctx.totalDurationMin);

  for (const t of probe) {
    const carbs = resolveTargetAt(plan.race_targets.carbs_per_hour_g, t);
    if (carbs > SAFETY_BOUNDS.carbs_per_hour_g.max) {
      warnings.push({
        severity: 'high',
        code: 'carbs_above_ceiling',
        message: `${carbs}g/h carbs à t=${t}min dépasse la borne ${SAFETY_BOUNDS.carbs_per_hour_g.max}g/h.`,
        data: { at_min: t, value: carbs, max: SAFETY_BOUNDS.carbs_per_hour_g.max },
      });
    }
    if (carbs > 0 && carbs < SAFETY_BOUNDS.carbs_per_hour_g.min) {
      warnings.push({
        severity: 'medium',
        code: 'carbs_below_floor',
        message: `${carbs}g/h carbs à t=${t}min sous la borne ${SAFETY_BOUNDS.carbs_per_hour_g.min}g/h (hors phase de pause volontaire).`,
        data: { at_min: t, value: carbs, min: SAFETY_BOUNDS.carbs_per_hour_g.min },
      });
    }

    const fluid = resolveTargetAt(plan.race_targets.fluid_per_hour_ml, t);
    if (fluid > SAFETY_BOUNDS.fluid_per_hour_ml.max) {
      warnings.push({
        severity: 'high',
        code: 'fluid_above_ceiling',
        message: `${fluid}ml/h fluide à t=${t}min dépasse ${SAFETY_BOUNDS.fluid_per_hour_ml.max}ml/h.`,
        data: { at_min: t, value: fluid, max: SAFETY_BOUNDS.fluid_per_hour_ml.max },
      });
    }

    const sodium = resolveTargetAt(plan.race_targets.sodium_per_hour_mg, t);
    if (sodium > SAFETY_BOUNDS.sodium_per_hour_mg.max) {
      warnings.push({
        severity: 'high',
        code: 'sodium_above_ceiling',
        message: `${sodium}mg/h sodium à t=${t}min dépasse ${SAFETY_BOUNDS.sodium_per_hour_mg.max}mg/h.`,
        data: { at_min: t, value: sodium, max: SAFETY_BOUNDS.sodium_per_hour_mg.max },
      });
    }
  }

  return warnings;
}

function sampleMinutes(totalDurationMin: number): number[] {
  // 0, 30, 60, ..., total. ~1 échantillon / 30 min suffit pour catcher les
  // dépassements (les TargetTimeline sont stepwise constants entre transitions).
  const samples: number[] = [];
  for (let t = 0; t < totalDurationMin; t += 30) samples.push(t);
  samples.push(totalDurationMin - 1);
  return samples;
}

// ─── Intake intervals ───────────────────────────────────────────────────────

function checkIntakeIntervals(events: TimelineEvent[]): PlanValidationWarning[] {
  const warnings: PlanValidationWarning[] = [];
  const intakes = events.filter((e) => e.type === 'intake').sort((a, b) => a.at_min - b.at_min);

  for (let i = 1; i < intakes.length; i += 1) {
    const gap = intakes[i].at_min - intakes[i - 1].at_min;
    if (gap < SAFETY_BOUNDS.intake_interval_min.min) {
      warnings.push({
        severity: 'medium',
        code: 'intake_too_close',
        message: `Intakes ${intakes[i - 1].id} et ${intakes[i].id} espacés de ${gap}min (<${SAFETY_BOUNDS.intake_interval_min.min}min minimum).`,
        data: { gap_min: gap, min: SAFETY_BOUNDS.intake_interval_min.min },
      });
    }
  }

  return warnings;
}

// ─── Event ordering ─────────────────────────────────────────────────────────

function checkEventOrdering(events: TimelineEvent[], ctx: ValidationContext): PlanValidationWarning[] {
  const warnings: PlanValidationWarning[] = [];
  for (let i = 0; i < events.length; i += 1) {
    const e = events[i];
    if (e.at_min < 0) {
      warnings.push({ severity: 'high', code: 'event_negative_time', message: `Event ${e.id} à t=${e.at_min}min < 0.` });
    }
    if (e.at_min > ctx.totalDurationMin) {
      warnings.push({
        severity: 'medium',
        code: 'event_after_end',
        message: `Event ${e.id} à t=${e.at_min}min après la fin de course (${ctx.totalDurationMin}min).`,
      });
    }
    if (i > 0 && e.at_min < events[i - 1].at_min) {
      warnings.push({
        severity: 'medium',
        code: 'events_unsorted',
        message: `Events non triés : ${events[i - 1].id}@${events[i - 1].at_min} suivi de ${e.id}@${e.at_min}.`,
      });
    }
  }
  return warnings;
}
