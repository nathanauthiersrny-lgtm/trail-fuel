import type { FoodItemKind } from '../../models/food-item';
import type {
  IntakePickAction,
  IntakePickRule,
  KindsListOrRef,
  RaceAction,
  RaceRule,
  WindowAction,
  WindowRule,
} from '../../models/rule';

import { evaluateCondition, readPath, type EvalContext } from './condition';
import { evaluateExpression, parseExpression } from './expression';

// ─── Race scope ──────────────────────────────────────────────────────────────

export type RaceTargets = {
  carbs_per_hour_g: number;
  fluid_per_hour_ml: number;
  sodium_per_hour_mg: number;
  intensity_modifier: number;
  first_intake_after_min: number;
  intake_interval_min: number;
  first_fluid_reminder_min: number;
  fluid_reminder_interval_min: number;
  check_in_frequency_min: number;
};

export function applyRaceAction(
  state: RaceTargets,
  action: RaceAction,
  ctx: EvalContext,
): RaceTargets {
  const value =
    typeof action.value === 'number'
      ? action.value
      : evaluateExpression(parseExpression(action.value.expr), ctx);
  const current = state[action.target];
  let next: number;
  switch (action.op) {
    case 'add':
      next = current + value;
      break;
    case 'subtract':
      next = current - value;
      break;
    case 'multiply':
      next = current * value;
      break;
    case 'set':
      next = value;
      break;
  }
  return { ...state, [action.target]: next };
}

export function applyRaceRules(
  rules: RaceRule[],
  ctx: EvalContext,
  initial: RaceTargets,
): RaceTargets {
  let state = initial;
  for (const rule of rules) {
    if (evaluateCondition(rule.condition, ctx)) {
      state = applyRaceAction(state, rule.action, ctx);
    }
  }
  return state;
}

// ─── Window scope ────────────────────────────────────────────────────────────

export type WindowState = {
  allowed_kinds: FoodItemKind[] | null; // null = no intake allowed (e.g. technical descent)
};

export function applyWindowAction(state: WindowState, action: WindowAction): WindowState {
  switch (action.op) {
    case 'set_allowed_kinds':
      return { allowed_kinds: action.kinds };
    case 'forbid_kind': {
      if (state.allowed_kinds === null) return state;
      return {
        allowed_kinds: state.allowed_kinds.filter((k) => k !== action.kind),
      };
    }
  }
}

export function applyWindowRules(
  rules: WindowRule[],
  ctx: EvalContext,
  initial: WindowState,
): WindowState {
  let state = initial;
  for (const rule of rules) {
    if (evaluateCondition(rule.condition, ctx)) {
      state = applyWindowAction(state, rule.action);
    }
  }
  return state;
}

// ─── IntakePick scope ────────────────────────────────────────────────────────

export type PickPreferences = {
  prefer: FoodItemKind[];
  avoid: FoodItemKind[];
  forbid: FoodItemKind[];
};

export const EMPTY_PREFERENCES: PickPreferences = { prefer: [], avoid: [], forbid: [] };

export function applyIntakePickAction(
  state: PickPreferences,
  action: IntakePickAction,
  ctx: EvalContext,
): PickPreferences {
  const kinds = resolveKindsList(action.kinds, ctx);
  switch (action.op) {
    case 'prefer_kinds':
      return { ...state, prefer: dedupedConcat(state.prefer, kinds) };
    case 'avoid_kinds':
      return { ...state, avoid: dedupedConcat(state.avoid, kinds) };
    case 'forbid_kinds':
      return { ...state, forbid: dedupedConcat(state.forbid, kinds) };
  }
}

export function applyIntakePickRules(
  rules: IntakePickRule[],
  ctx: EvalContext,
  initial: PickPreferences = EMPTY_PREFERENCES,
): PickPreferences {
  let state = initial;
  for (const rule of rules) {
    if (evaluateCondition(rule.condition, ctx)) {
      state = applyIntakePickAction(state, rule.action, ctx);
    }
  }
  return state;
}

function resolveKindsList(kindsOrRef: KindsListOrRef, ctx: EvalContext): FoodItemKind[] {
  if (Array.isArray(kindsOrRef)) return kindsOrRef;
  const path = kindsOrRef.kinds_from;
  const resolved = readPath(ctx, path);
  if (resolved === null) return [];
  if (!Array.isArray(resolved)) {
    throw new Error(
      `kinds_from path "${path}" did not resolve to an array (got ${typeof resolved})`,
    );
  }
  return resolved as FoodItemKind[];
}

function dedupedConcat<T>(a: T[], b: T[]): T[] {
  const seen = new Set(a);
  const out = [...a];
  for (const x of b) {
    if (!seen.has(x)) {
      seen.add(x);
      out.push(x);
    }
  }
  return out;
}
