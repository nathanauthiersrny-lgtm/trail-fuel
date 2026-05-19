/**
 * TimelinePlan — Contrat stable entre l'authoring (engine local + LLM enrichment)
 * et le runtime mobile (offline).
 *
 * Voir docs/timeline-plan.md pour la spec complète et les exemples.
 *
 * Le runtime mobile ne lit QUE ce format. Il ne sait pas (et ne veut pas savoir)
 * comment le plan a été produit. Cela permet de faire évoluer l'engine et le LLM
 * sans toucher au runtime.
 */

import type { FoodItemKind } from './food-item';

export const TIMELINE_PLAN_VERSION = 1 as const;

// ─── Generator metadata ─────────────────────────────────────────────────────

export type GeneratorSource = 'engine' | 'llm' | 'user';

/**
 * Métadonnées de génération. Permet de tracer qui a produit le plan et avec quels outils.
 * Format libre, utilisé pour le debug et l'évolution dans le temps (V1→V2→V3).
 */
export type GeneratorInfo = {
  engine_version?: string;        // ex: "1.2.0"
  llm_model?: string;             // ex: "claude-haiku-4-5"
  llm_enrichment_applied: boolean;
  kb_articles_used?: string[];    // slugs des articles markdown qui ont influencé le LLM
};

// ─── Race targets ───────────────────────────────────────────────────────────

/**
 * Un target peut être constant (default) ou varier dans le temps (timeline).
 * Si timeline est défini, il prend le pas sur default sur les intervalles couverts.
 * Hors intervalles, default s'applique.
 *
 * Exemple : 60g/h jusqu'à 5h puis 90g/h :
 *   { default: 60, timeline: [{ from_min: 300, to_min: null, value: 90 }] }
 */
export type TargetTimeline = {
  default: number;
  timeline?: Array<{
    from_min: number;
    to_min: number | null;   // null = jusqu'à la fin
    value: number;
    why?: string;
    source?: GeneratorSource;
  }>;
};

export type RaceTargets = {
  carbs_per_hour_g: TargetTimeline;
  fluid_per_hour_ml: TargetTimeline;
  sodium_per_hour_mg: TargetTimeline;
};

// ─── Events ─────────────────────────────────────────────────────────────────

export type TimelineEventType = 'intake' | 'fluid_reminder' | 'check_in' | 'aid_station';

export type IntakeAdvice = {
  /** Préférence de kind. Le runtime essaie de respecter avant de tomber sur l'inventaire. */
  preferred_kinds?: FoodItemKind[];
  /** Kinds interdits à ce moment (ex: pas de solide en descente technique). */
  forbidden_kinds?: FoodItemKind[];
  /** Quantité de glucides ciblée pour cet apport (en g). Sert au runtime à dimensionner. */
  carbs_target_g?: number;
  /** Quantité de fluide ciblée (en ml). Pour les fluid_reminders. */
  fluid_target_ml?: number;
};

export type TimelineEvent = {
  id: string;
  type: TimelineEventType;
  /** Temps écoulé depuis le départ de la course, en minutes. */
  at_min: number;
  /** Justification courte en FR. Affichée dans l'UI, utile pour debug. */
  why: string;
  /** Qui a placé cet event (traçabilité). */
  source: GeneratorSource;
  /** Confiance [0, 1]. 1.0 = certain (engine). LLM peut mettre 0.5-1.0. */
  confidence: number;
  /** Données spécifiques au type. Le runtime résout l'item exact au moment du log. */
  advice?: IntakeAdvice;
  /** Pour aid_station : id de la station. */
  aid_station_id?: string;
};

// ─── Branches (conditionnelles précalculées) ────────────────────────────────

/**
 * Une branche est une règle conditionnelle évaluée par le runtime sur des
 * triggers observables (skips, check-ins, pace drift). Les actions sont
 * limitées à un set fini que le runtime sait exécuter sans LLM.
 */

export type BranchTrigger =
  | { type: 'skipped_count'; window_min: number; operator: '>='; value: number }
  | { type: 'checkin_feedback'; feedback: 'bad' | 'good' }
  | { type: 'pace_drift'; operator: '>=' | '<='; value_pct: number }
  | { type: 'elapsed_min'; operator: '>='; value: number };

export type BranchAction =
  | { type: 'boost_next_intake'; factor: number }
  | { type: 'shift_next_by'; minutes: number }
  | { type: 'skip_next_intake' }
  | { type: 'switch_preferred_kinds'; kinds: FoodItemKind[]; for_min: number }
  | { type: 'replan_from_now' }; // nécessite internet ; runtime fallback = no-op + warn

export type Branch = {
  id: string;
  trigger: BranchTrigger;
  action: BranchAction;
  why: string;
  source: GeneratorSource;
  /** Combien de fois la branche peut se déclencher en course. undefined = illimité. */
  max_fires?: number;
};

// ─── Validation result ──────────────────────────────────────────────────────

export type PlanValidationWarning = {
  severity: 'low' | 'medium' | 'high';
  code: string;
  message: string;
  data?: Record<string, number | string>;
};

export type PlanValidation = {
  passed: boolean;
  warnings: PlanValidationWarning[];
};

// ─── Root ───────────────────────────────────────────────────────────────────

export type TimelinePlan = {
  version: typeof TIMELINE_PLAN_VERSION;
  race_id: string;
  generated_at: string; // ISO8601
  generator: GeneratorInfo;
  race_targets: RaceTargets;
  events: TimelineEvent[];
  branches: Branch[];
  validation: PlanValidation;
};

// ─── Helpers ────────────────────────────────────────────────────────────────

/**
 * Lit la valeur d'un target à un instant donné (timeline-aware).
 */
export function resolveTargetAt(target: TargetTimeline, at_min: number): number {
  if (!target.timeline || target.timeline.length === 0) return target.default;
  for (const interval of target.timeline) {
    const from = interval.from_min;
    const to = interval.to_min ?? Infinity;
    if (at_min >= from && at_min < to) return interval.value;
  }
  return target.default;
}
