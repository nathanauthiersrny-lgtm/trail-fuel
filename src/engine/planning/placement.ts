import type { FoodItem, FoodItemKind } from '../../models/food-item';
import type { KnowledgePack } from '../../models/knowledge-pack';
import type { InventoryItem } from '../../models/race';
import type { IntakePickRule, WindowRule } from '../../models/rule';
import {
  applyIntakePickRules,
  applyWindowRules,
  type PickPreferences,
} from '../rules/action';
import type { EvalContext } from '../rules/condition';

import type { DraftEvent } from './check-ins';
import type { ResolvedParams } from './resolve-params';
import { categorizeSlope } from './slope-categories';
import type { PlanningWindow } from './windows';

// Default fallback only — generate.ts passe désormais params.intake_interval_min.
const DEFAULT_INTAKE_INTERVAL_MIN = 20;

// Baseline of kinds allowed in any window before window-scope rules apply.
const DEFAULT_ALLOWED_KINDS: FoodItemKind[] = ['gel', 'bar', 'real_food'];

export function placeIntakes(input: {
  windows: PlanningWindow[];
  params: ResolvedParams;
  totalDurationMin: number;
  foodItems: FoodItem[];
  inventory: InventoryItem[];
  raceContext: EvalContext;
  pack: KnowledgePack;
  intakeIntervalMin?: number;
}): DraftEvent[] {
  const {
    windows,
    params,
    totalDurationMin,
    foodItems,
    inventory,
    raceContext,
    pack,
    intakeIntervalMin = DEFAULT_INTAKE_INTERVAL_MIN,
  } = input;

  if (windows.length === 0) return [];

  const remaining = new Map<string, number>();
  for (const slot of inventory) {
    remaining.set(slot.food_item_id, (remaining.get(slot.food_item_id) ?? 0) + slot.quantity);
  }
  const itemsById = new Map(foodItems.map((item) => [item.id, item]));

  const windowRules = pack.rules.filter((r): r is WindowRule => r.scope === 'window');
  const intakePickRules = pack.rules.filter(
    (r): r is IntakePickRule => r.scope === 'intake_pick',
  );

  // Pre-compute allowed_kinds per window — used in both placement decisions
  // and look-ahead context building.
  const allowedByWindowIdx = new Map<number, FoodItemKind[] | null>();
  for (const w of windows) {
    allowedByWindowIdx.set(w.index, allowedKindsForWindow(w, raceContext, windowRules));
  }

  const events: DraftEvent[] = [];
  let lastType: FoodItemKind | null = null;

  for (
    let target = params.first_intake_after_min;
    target < totalDurationMin;
    target += intakeIntervalMin
  ) {
    const window = windows.find((w) => target >= w.startMin && target < w.endMin);
    if (!window) continue;

    const allowed = allowedByWindowIdx.get(window.index) ?? null;
    if (allowed === null) continue; // descente technique : pas d'intake

    const nextTarget = target + intakeIntervalMin;
    const nextWindow =
      nextTarget < totalDurationMin
        ? windows.find((w) => nextTarget >= w.startMin && w.endMin > nextTarget)
        : undefined;
    const nextAllowed = nextWindow ? allowedByWindowIdx.get(nextWindow.index) ?? null : null;

    const pickCtx = buildIntakePickContext(
      raceContext,
      window,
      allowed,
      nextWindow,
      nextAllowed,
    );
    const preferences = applyIntakePickRules(intakePickRules, pickCtx);

    const pick = pickItem(allowed, preferences, remaining, itemsById, lastType);
    if (!pick) continue;

    remaining.set(pick.id, (remaining.get(pick.id) ?? 0) - 1);
    lastType = pick.type;
    events.push(buildIntakeDraft(target, pick));
  }

  return events;
}

function allowedKindsForWindow(
  window: PlanningWindow,
  raceContext: EvalContext,
  windowRules: WindowRule[],
): FoodItemKind[] | null {
  const slopeCategory = categorizeSlope(window.medianSlope);
  const ctx: EvalContext = {
    ...raceContext,
    window: {
      slope_category: slopeCategory,
      medianSlope: window.medianSlope,
      startMin: window.startMin,
      endMin: window.endMin,
    },
  };
  const result = applyWindowRules(windowRules, ctx, {
    allowed_kinds: [...DEFAULT_ALLOWED_KINDS],
  });
  return result.allowed_kinds;
}

function buildIntakePickContext(
  raceContext: EvalContext,
  window: PlanningWindow,
  allowed: FoodItemKind[],
  nextWindow: PlanningWindow | undefined,
  nextAllowed: FoodItemKind[] | null,
): EvalContext {
  const ctx: EvalContext = {
    ...raceContext,
    window: {
      slope_category: categorizeSlope(window.medianSlope),
      medianSlope: window.medianSlope,
      startMin: window.startMin,
      endMin: window.endMin,
      allowed_kinds: allowed,
    },
  };
  if (nextWindow) {
    ctx.next_window = {
      slope_category: categorizeSlope(nextWindow.medianSlope),
      medianSlope: nextWindow.medianSlope,
      startMin: nextWindow.startMin,
      endMin: nextWindow.endMin,
      allowed_kinds: nextAllowed,
    };
  }
  return ctx;
}

function pickItem(
  allowed: FoodItemKind[],
  preferences: PickPreferences,
  remaining: Map<string, number>,
  itemsById: Map<string, FoodItem>,
  lastType: FoodItemKind | null,
): FoodItem | null {
  const forbidden = new Set(preferences.forbid);
  const preferred = new Set(preferences.prefer);
  const avoided = new Set(preferences.avoid);

  const candidates: FoodItem[] = [];
  for (const [id, qty] of remaining) {
    if (qty <= 0) continue;
    const item = itemsById.get(id);
    if (!item || !allowed.includes(item.type)) continue;
    if (forbidden.has(item.type)) continue;
    candidates.push(item);
  }
  if (candidates.length === 0) return null;

  candidates.sort((a, b) => {
    // 1. Preferred kinds first
    const aPref = preferred.has(a.type) ? 0 : 1;
    const bPref = preferred.has(b.type) ? 0 : 1;
    if (aPref !== bPref) return aPref - bPref;

    // 2. Avoided kinds last (rule-driven look-ahead lands here)
    const aAvoid = avoided.has(a.type) ? 1 : 0;
    const bAvoid = avoided.has(b.type) ? 1 : 0;
    if (aAvoid !== bAvoid) return aAvoid - bAvoid;

    // 3. Variety : different from last picked kind first
    const aSame = a.type === lastType ? 1 : 0;
    const bSame = b.type === lastType ? 1 : 0;
    if (aSame !== bSame) return aSame - bSame;

    // 4. Higher carbs first (denser nutrition)
    return b.carbs_g - a.carbs_g;
  });
  return candidates[0];
}

function buildIntakeDraft(scheduledAtMinute: number, item: FoodItem): DraftEvent {
  const payload: DraftEvent['payload'] = { food_item_id: item.id, quantity: 1 };
  if (item.volume_ml !== undefined) payload.volume_ml = item.volume_ml;
  return { scheduled_at_minute: scheduledAtMinute, type: 'intake', payload };
}
