import type { FoodItemKind } from './food-item';

// ─── Common ──────────────────────────────────────────────────────────────────

export type RuleScope = 'race' | 'window' | 'intake_pick';
export type RuleCategory = 'nutrition' | 'timing' | 'placement';
export type RuleSource = 'base' | 'overlay';

export type RuleProvenance = {
  extracted_from?: string; // URL forum / "manual" / "doc.md §6"
  extracted_at?: string;   // ISO date
  notes?: string;
};

type CommonRuleFields = {
  id: string;
  source: RuleSource;
  category: RuleCategory;
  description: string;
  provenance?: RuleProvenance;
};

// ─── Conditions ──────────────────────────────────────────────────────────────

export type CmpOp =
  | 'equals'
  | 'not_equals'
  | 'gt'
  | 'gte'
  | 'lt'
  | 'lte'
  | 'in'
  | 'between'
  | 'is_subset_of'
  | 'is_strict_subset_of'
  | 'is_superset_of'
  | 'is_strict_superset_of'
  | 'is_empty'
  | 'is_not_empty'
  | 'exists';

export type ExpressionValue = { expr: string };

export type ScalarConstant = string | number | boolean;

export type FieldCondition =
  | { field: string; op: 'equals' | 'not_equals'; value: ScalarConstant | ScalarConstant[] }
  | { field: string; op: 'gt' | 'gte' | 'lt' | 'lte'; value: number | ExpressionValue }
  | { field: string; op: 'in'; value: ScalarConstant[] }
  | { field: string; op: 'between'; value: [number, number] }
  | {
      field: string;
      op: 'is_subset_of' | 'is_strict_subset_of' | 'is_superset_of' | 'is_strict_superset_of';
      set: string;
    }
  | { field: string; op: 'is_empty' | 'is_not_empty' | 'exists' };

export type Condition =
  | { always: true }
  | { all: Condition[] }
  | { any: Condition[] }
  | { not: Condition }
  | FieldCondition;

// ─── Actions per scope ───────────────────────────────────────────────────────

export type NutritionTarget =
  | 'carbs_per_hour_g'
  | 'fluid_per_hour_ml'
  | 'sodium_per_hour_mg'
  | 'intensity_modifier';

export type TimingTarget =
  | 'first_intake_after_min'
  | 'intake_interval_min'
  | 'first_fluid_reminder_min'
  | 'fluid_reminder_interval_min'
  | 'check_in_frequency_min';

export type NumberOrExpr = number | ExpressionValue;

export type RaceAction = {
  target: NutritionTarget | TimingTarget;
  op: 'add' | 'subtract' | 'multiply' | 'set';
  value: NumberOrExpr;
};

export type WindowAction =
  | { op: 'set_allowed_kinds'; kinds: FoodItemKind[] | null }
  | { op: 'forbid_kind'; kind: FoodItemKind };

export type KindsListOrRef =
  | FoodItemKind[]
  | { kinds_from: string }; // path expression that resolves to a FoodItemKind[] in context

export type IntakePickAction =
  | { op: 'prefer_kinds'; kinds: KindsListOrRef }
  | { op: 'avoid_kinds'; kinds: KindsListOrRef }
  | { op: 'forbid_kinds'; kinds: KindsListOrRef };

// ─── Rule (discriminated by scope) ───────────────────────────────────────────

export type RaceRule = CommonRuleFields & {
  scope: 'race';
  condition: Condition;
  action: RaceAction;
};

export type WindowRule = CommonRuleFields & {
  scope: 'window';
  condition: Condition;
  action: WindowAction;
};

export type IntakePickRule = CommonRuleFields & {
  scope: 'intake_pick';
  condition: Condition;
  action: IntakePickAction;
};

export type Rule = RaceRule | WindowRule | IntakePickRule;
