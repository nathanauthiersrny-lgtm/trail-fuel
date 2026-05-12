import type { FoodItemKind } from '../../models/food-item';
import type {
  CmpOp,
  Condition,
  ExpressionValue,
  FieldCondition,
  IntakePickAction,
  KindsListOrRef,
  NumberOrExpr,
  RaceAction,
  Rule,
  RuleCategory,
  RuleProvenance,
  RuleScope,
  RuleSource,
  WindowAction,
} from '../../models/rule';

import { ExpressionError, parseExpression } from './expression';

export type ValidationOk<T> = { ok: true; value: T };
export type ValidationErr = { ok: false; error: string };
export type ValidationResult<T> = ValidationOk<T> | ValidationErr;

const ok = <T>(value: T): ValidationOk<T> => ({ ok: true, value });
const err = (error: string): ValidationErr => ({ ok: false, error });

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * Validates a parsed value as a Rule. Returns either the typed Rule, or an
 * error string describing why validation failed. Designed for use by the pack
 * loader — invalid rules are skipped with a warning rather than crashing the app.
 */
export function validateRule(raw: unknown): ValidationResult<Rule> {
  if (!isObject(raw)) return err('rule must be an object');

  const idR = requireString(raw, 'id');
  if (!idR.ok) return idR;

  const sourceR = requireEnum<RuleSource>(raw, 'source', ['base', 'overlay']);
  if (!sourceR.ok) return prefix(`[${idR.value}]`, sourceR);

  const categoryR = requireEnum<RuleCategory>(raw, 'category', [
    'nutrition',
    'timing',
    'placement',
  ]);
  if (!categoryR.ok) return prefix(`[${idR.value}]`, categoryR);

  const descriptionR = requireString(raw, 'description');
  if (!descriptionR.ok) return prefix(`[${idR.value}]`, descriptionR);

  const scopeR = requireEnum<RuleScope>(raw, 'scope', [
    'race',
    'window',
    'intake_pick',
  ]);
  if (!scopeR.ok) return prefix(`[${idR.value}]`, scopeR);

  const provenanceR = validateProvenance((raw as Record<string, unknown>).provenance);
  if (!provenanceR.ok) return prefix(`[${idR.value}]`, provenanceR);

  const conditionR = validateCondition((raw as Record<string, unknown>).condition);
  if (!conditionR.ok) return prefix(`[${idR.value}] condition:`, conditionR);

  const rawAction = (raw as Record<string, unknown>).action;
  let validated: Rule;
  switch (scopeR.value) {
    case 'race': {
      const r = validateRaceAction(rawAction);
      if (!r.ok) return prefix(`[${idR.value}] action:`, r);
      validated = {
        id: idR.value,
        source: sourceR.value,
        category: categoryR.value,
        description: descriptionR.value,
        scope: 'race',
        condition: conditionR.value,
        action: r.value,
        ...(provenanceR.value ? { provenance: provenanceR.value } : {}),
      };
      break;
    }
    case 'window': {
      const r = validateWindowAction(rawAction);
      if (!r.ok) return prefix(`[${idR.value}] action:`, r);
      validated = {
        id: idR.value,
        source: sourceR.value,
        category: categoryR.value,
        description: descriptionR.value,
        scope: 'window',
        condition: conditionR.value,
        action: r.value,
        ...(provenanceR.value ? { provenance: provenanceR.value } : {}),
      };
      break;
    }
    case 'intake_pick': {
      const r = validateIntakePickAction(rawAction);
      if (!r.ok) return prefix(`[${idR.value}] action:`, r);
      validated = {
        id: idR.value,
        source: sourceR.value,
        category: categoryR.value,
        description: descriptionR.value,
        scope: 'intake_pick',
        condition: conditionR.value,
        action: r.value,
        ...(provenanceR.value ? { provenance: provenanceR.value } : {}),
      };
      break;
    }
  }
  return ok(validated);
}

/**
 * Validates a list of rule objects. Each invalid rule is reported in `errors`;
 * valid rules are returned in `rules`. Loader strategy: warn about errors, use
 * the valid subset.
 */
export function validateRuleList(raw: unknown[]): {
  rules: Rule[];
  errors: string[];
} {
  const rules: Rule[] = [];
  const errors: string[] = [];
  for (let i = 0; i < raw.length; i += 1) {
    const r = validateRule(raw[i]);
    if (r.ok) rules.push(r.value);
    else errors.push(`rule[${i}]: ${r.error}`);
  }
  return { rules, errors };
}

// ─── Condition validation ────────────────────────────────────────────────────

function validateCondition(raw: unknown): ValidationResult<Condition> {
  if (!isObject(raw)) return err('condition must be an object');
  const obj = raw as Record<string, unknown>;

  if (obj.always === true) return ok({ always: true });

  if (Array.isArray(obj.all)) {
    const inner: Condition[] = [];
    for (const c of obj.all) {
      const r = validateCondition(c);
      if (!r.ok) return prefix('all[]:', r);
      inner.push(r.value);
    }
    return ok({ all: inner });
  }

  if (Array.isArray(obj.any)) {
    const inner: Condition[] = [];
    for (const c of obj.any) {
      const r = validateCondition(c);
      if (!r.ok) return prefix('any[]:', r);
      inner.push(r.value);
    }
    return ok({ any: inner });
  }

  if ('not' in obj) {
    const r = validateCondition(obj.not);
    if (!r.ok) return prefix('not:', r);
    return ok({ not: r.value });
  }

  return validateFieldCondition(obj);
}

function validateFieldCondition(obj: Record<string, unknown>): ValidationResult<FieldCondition> {
  if (typeof obj.field !== 'string') return err('field must be a string');
  if (typeof obj.op !== 'string') return err('op must be a string');
  const field = obj.field;
  const op = obj.op as CmpOp;

  switch (op) {
    case 'equals':
    case 'not_equals': {
      const v = obj.value;
      if (!isScalarOrScalarArray(v)) {
        return err(`op="${op}" requires value of type string|number|boolean|array`);
      }
      return ok({ field, op, value: v });
    }
    case 'gt':
    case 'gte':
    case 'lt':
    case 'lte': {
      const v = obj.value;
      if (typeof v === 'number') return ok({ field, op, value: v });
      const expr = validateExpressionValue(v);
      if (!expr.ok) return prefix(`op="${op}" value:`, expr);
      return ok({ field, op, value: expr.value });
    }
    case 'in': {
      if (!Array.isArray(obj.value) || !obj.value.every(isScalar)) {
        return err(`op="in" requires value of type scalar[]`);
      }
      return ok({ field, op, value: obj.value });
    }
    case 'between': {
      const v = obj.value;
      if (
        !Array.isArray(v) ||
        v.length !== 2 ||
        typeof v[0] !== 'number' ||
        typeof v[1] !== 'number'
      ) {
        return err(`op="between" requires value of type [number, number]`);
      }
      return ok({ field, op, value: [v[0], v[1]] });
    }
    case 'is_subset_of':
    case 'is_strict_subset_of':
    case 'is_superset_of':
    case 'is_strict_superset_of': {
      if (typeof obj.set !== 'string') {
        return err(`op="${op}" requires set field of type string`);
      }
      return ok({ field, op, set: obj.set });
    }
    case 'is_empty':
    case 'is_not_empty':
    case 'exists':
      return ok({ field, op });
    default:
      return err(`unknown condition op: "${String(op)}"`);
  }
}

// ─── Action validation ───────────────────────────────────────────────────────

const NUTRITION_TARGETS = [
  'carbs_per_hour_g',
  'fluid_per_hour_ml',
  'sodium_per_hour_mg',
  'intensity_modifier',
];
const TIMING_TARGETS = [
  'first_intake_after_min',
  'intake_interval_min',
  'first_fluid_reminder_min',
  'fluid_reminder_interval_min',
  'check_in_frequency_min',
];
const NUMERIC_OPS = ['add', 'subtract', 'multiply', 'set'];
const FOOD_KINDS: FoodItemKind[] = ['gel', 'bar', 'drink_mix', 'real_food', 'water'];

function validateRaceAction(raw: unknown): ValidationResult<RaceAction> {
  if (!isObject(raw)) return err('action must be an object');
  const obj = raw as Record<string, unknown>;
  if (typeof obj.target !== 'string') return err('action.target must be a string');
  if (
    !NUTRITION_TARGETS.includes(obj.target) &&
    !TIMING_TARGETS.includes(obj.target)
  ) {
    return err(`action.target "${obj.target}" not allowed in race scope`);
  }
  if (typeof obj.op !== 'string' || !NUMERIC_OPS.includes(obj.op)) {
    return err(`action.op must be one of ${NUMERIC_OPS.join('|')}`);
  }
  const valueR = validateNumberOrExpr(obj.value);
  if (!valueR.ok) return prefix('action.value:', valueR);
  return ok({
    target: obj.target as RaceAction['target'],
    op: obj.op as RaceAction['op'],
    value: valueR.value,
  });
}

function validateWindowAction(raw: unknown): ValidationResult<WindowAction> {
  if (!isObject(raw)) return err('action must be an object');
  const obj = raw as Record<string, unknown>;
  if (typeof obj.op !== 'string') return err('action.op must be a string');
  switch (obj.op) {
    case 'set_allowed_kinds': {
      if (obj.kinds === null) return ok({ op: 'set_allowed_kinds', kinds: null });
      if (!Array.isArray(obj.kinds) || !obj.kinds.every(isFoodKind)) {
        return err('set_allowed_kinds.kinds must be FoodItemKind[] or null');
      }
      return ok({ op: 'set_allowed_kinds', kinds: obj.kinds as FoodItemKind[] });
    }
    case 'forbid_kind': {
      if (!isFoodKind(obj.kind)) {
        return err('forbid_kind.kind must be a FoodItemKind');
      }
      return ok({ op: 'forbid_kind', kind: obj.kind });
    }
    default:
      return err(`unknown window action op: "${String(obj.op)}"`);
  }
}

function validateIntakePickAction(raw: unknown): ValidationResult<IntakePickAction> {
  if (!isObject(raw)) return err('action must be an object');
  const obj = raw as Record<string, unknown>;
  if (typeof obj.op !== 'string') return err('action.op must be a string');
  if (!['prefer_kinds', 'avoid_kinds', 'forbid_kinds'].includes(obj.op)) {
    return err(`unknown intake_pick action op: "${String(obj.op)}"`);
  }
  const kindsR = validateKindsListOrRef(obj.kinds);
  if (!kindsR.ok) return prefix('action.kinds:', kindsR);
  return ok({
    op: obj.op as IntakePickAction['op'],
    kinds: kindsR.value,
  });
}

function validateKindsListOrRef(raw: unknown): ValidationResult<KindsListOrRef> {
  if (Array.isArray(raw)) {
    if (!raw.every(isFoodKind)) {
      return err('kinds list must contain only FoodItemKind values');
    }
    return ok(raw as FoodItemKind[]);
  }
  if (isObject(raw) && typeof (raw as Record<string, unknown>).kinds_from === 'string') {
    return ok({ kinds_from: (raw as { kinds_from: string }).kinds_from });
  }
  return err('kinds must be FoodItemKind[] or { kinds_from: string }');
}

// ─── Value / expression validation ───────────────────────────────────────────

function validateNumberOrExpr(raw: unknown): ValidationResult<NumberOrExpr> {
  if (typeof raw === 'number') return ok(raw);
  return validateExpressionValue(raw);
}

function validateExpressionValue(raw: unknown): ValidationResult<ExpressionValue> {
  if (
    !isObject(raw) ||
    typeof (raw as Record<string, unknown>).expr !== 'string' ||
    ((raw as { expr: string }).expr as string).length === 0
  ) {
    return err('must be a number or { expr: <non-empty string> }');
  }
  const expr = (raw as { expr: string }).expr;
  try {
    parseExpression(expr);
  } catch (e) {
    if (e instanceof ExpressionError) {
      return err(`expression "${expr}" is invalid: ${e.message}`);
    }
    throw e;
  }
  return ok({ expr });
}

// ─── Provenance ──────────────────────────────────────────────────────────────

function validateProvenance(raw: unknown): ValidationResult<RuleProvenance | undefined> {
  if (raw === undefined) return ok(undefined);
  if (!isObject(raw)) return err('provenance must be an object');
  const obj = raw as Record<string, unknown>;
  const out: RuleProvenance = {};
  for (const key of ['extracted_from', 'extracted_at', 'notes'] as const) {
    if (obj[key] !== undefined) {
      if (typeof obj[key] !== 'string') {
        return err(`provenance.${key} must be a string`);
      }
      out[key] = obj[key] as string;
    }
  }
  return ok(out);
}

// ─── Tiny helpers ────────────────────────────────────────────────────────────

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function isScalar(v: unknown): v is string | number | boolean {
  return typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean';
}

function isScalarOrScalarArray(v: unknown): v is string | number | boolean | (string | number | boolean)[] {
  if (isScalar(v)) return true;
  return Array.isArray(v) && v.every(isScalar);
}

function isFoodKind(v: unknown): v is FoodItemKind {
  return typeof v === 'string' && FOOD_KINDS.includes(v as FoodItemKind);
}

function requireString(
  obj: Record<string, unknown>,
  key: string,
): ValidationResult<string> {
  const v = obj[key];
  if (typeof v !== 'string') return err(`${key} must be a string`);
  return ok(v);
}

function requireEnum<T extends string>(
  obj: Record<string, unknown>,
  key: string,
  allowed: readonly T[],
): ValidationResult<T> {
  const v = obj[key];
  if (typeof v !== 'string' || !allowed.includes(v as T)) {
    return err(`${key} must be one of ${allowed.join('|')}`);
  }
  return ok(v as T);
}

function prefix<T>(p: string, r: ValidationErr): ValidationResult<T> {
  return { ok: false, error: `${p} ${r.error}` };
}
