import type { Condition, FieldCondition, ScalarConstant } from '../../models/rule';

import { evaluateExpression, parseExpression } from './expression';

/**
 * Loose context shape — concrete fields depend on the rule scope (RaceContext,
 * WindowContext, IntakePickContext). The condition evaluator just walks dotted
 * paths into this object; field-shape validation is the scope's responsibility.
 */
export type EvalContext = Record<string, unknown>;

/**
 * Evaluates a condition against a context. Missing fields are treated as
 * undefined and most comparisons against undefined return false — only `exists`
 * and `not` make this semantically observable.
 *
 * v1 limitation: ExpressionValue ({ expr: "..." }) in comparison values is NOT
 * yet supported here — that arrives in 4.A.3. Encountering one throws so we
 * fail loudly rather than silently mis-evaluating.
 */
export function evaluateCondition(cond: Condition, ctx: EvalContext): boolean {
  if ('always' in cond) return cond.always === true;
  if ('all' in cond) return cond.all.every((c) => evaluateCondition(c, ctx));
  if ('any' in cond) return cond.any.some((c) => evaluateCondition(c, ctx));
  if ('not' in cond) return !evaluateCondition(cond.not, ctx);
  return evaluateFieldCondition(cond, ctx);
}

function evaluateFieldCondition(cond: FieldCondition, ctx: EvalContext): boolean {
  const value = readPath(ctx, cond.field);

  switch (cond.op) {
    case 'exists':
      return value !== undefined;
    case 'is_empty':
      return isEmpty(value);
    case 'is_not_empty':
      return !isEmpty(value) && value !== undefined;
    case 'equals':
      return value !== undefined && deepEqual(value, cond.value);
    case 'not_equals':
      return value !== undefined && !deepEqual(value, cond.value);
    case 'gt':
    case 'gte':
    case 'lt':
    case 'lte':
      return compareNumeric(value, cond.value, cond.op, ctx);
    case 'in':
      if (!isScalar(value)) return false;
      return (cond.value as ScalarConstant[]).some((v) => v === value);
    case 'between': {
      if (typeof value !== 'number') return false;
      const [lo, hi] = cond.value;
      return value >= lo && value <= hi;
    }
    case 'is_subset_of':
      return isSubsetOf(value, readPath(ctx, cond.set));
    case 'is_strict_subset_of':
      return isStrictSubsetOf(value, readPath(ctx, cond.set));
    case 'is_superset_of':
      return isSubsetOf(readPath(ctx, cond.set), value);
    case 'is_strict_superset_of':
      return isStrictSubsetOf(readPath(ctx, cond.set), value);
  }
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

export function readPath(ctx: EvalContext, path: string): unknown {
  const parts = path.split('.');
  let cur: unknown = ctx;
  for (const p of parts) {
    if (cur === null || cur === undefined) return undefined;
    if (typeof cur !== 'object') return undefined;
    cur = (cur as Record<string, unknown>)[p];
  }
  return cur;
}

function isScalar(v: unknown): v is ScalarConstant {
  return typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean';
}

function deepEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) return false;
    for (let i = 0; i < a.length; i += 1) if (!deepEqual(a[i], b[i])) return false;
    return true;
  }
  return false;
}

function isEmpty(v: unknown): boolean {
  if (v === null || v === undefined) return true;
  if (Array.isArray(v)) return v.length === 0;
  if (typeof v === 'string') return v.length === 0;
  if (typeof v === 'object') return Object.keys(v as object).length === 0;
  return false;
}

function compareNumeric(
  left: unknown,
  right: number | { expr: string },
  op: 'gt' | 'gte' | 'lt' | 'lte',
  ctx: EvalContext,
): boolean {
  if (typeof left !== 'number') return false;
  const rhs =
    typeof right === 'number' ? right : evaluateExpression(parseExpression(right.expr), ctx);
  switch (op) {
    case 'gt':
      return left > rhs;
    case 'gte':
      return left >= rhs;
    case 'lt':
      return left < rhs;
    case 'lte':
      return left <= rhs;
  }
}

function isSubsetOf(maybeSubset: unknown, maybeSuperset: unknown): boolean {
  if (!Array.isArray(maybeSubset) || !Array.isArray(maybeSuperset)) return false;
  const supersetSet = new Set(maybeSuperset);
  return maybeSubset.every((x) => supersetSet.has(x));
}

function isStrictSubsetOf(maybeSubset: unknown, maybeSuperset: unknown): boolean {
  if (!Array.isArray(maybeSubset) || !Array.isArray(maybeSuperset)) return false;
  if (!isSubsetOf(maybeSubset, maybeSuperset)) return false;
  // Strict ⇔ subset AND superset has at least one element not in subset.
  const subSet = new Set(maybeSubset);
  return maybeSuperset.some((x) => !subSet.has(x));
}
