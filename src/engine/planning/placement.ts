import type { FoodItem, FoodItemKind } from '../../models/food-item';
import type { KnowledgePack } from '../../models/knowledge-pack';
import type { InventoryItem } from '../../models/race';
import type { WindowRule } from '../../models/rule';
import { applyWindowRules } from '../rules/action';
import type { EvalContext } from '../rules/condition';

import type { DraftEvent } from './check-ins';
import type { ResolvedParams } from './resolve-params';
import { categorizeSlope } from './slope-categories';
import type { PlanningWindow } from './windows';

// Default fallback only — generate.ts passe désormais params.intake_interval_min.
// TODO(post-trail 2026-05-10): retirer ce fallback une fois resolve-params stabilisé.
const DEFAULT_INTAKE_INTERVAL_MIN = 20;

// Baseline of kinds allowed in any window before window-scope rules apply.
// Window rules may override or restrict this list (or set it to null = no intake).
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

  const events: DraftEvent[] = [];
  let lastType: FoodItemKind | null = null;

  for (
    let target = params.first_intake_after_min;
    target < totalDurationMin;
    target += intakeIntervalMin
  ) {
    const window = windows.find((w) => target >= w.startMin && target < w.endMin);
    if (!window) continue;

    const allowed = allowedKindsForWindow(window, raceContext, windowRules);
    if (allowed === null) continue; // descente technique (par défaut) : pas d'intake

    const nextTarget = target + intakeIntervalMin;
    const nextWindow =
      nextTarget < totalDurationMin
        ? windows.find((w) => nextTarget >= w.startMin && w.endMin > nextTarget)
        : undefined;
    const nextAllowed = nextWindow
      ? allowedKindsForWindow(nextWindow, raceContext, windowRules)
      : null;

    const pick = pickItem(allowed, nextAllowed, remaining, itemsById, lastType);
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

function pickItem(
  allowed: FoodItemKind[],
  nextAllowed: FoodItemKind[] | null,
  remaining: Map<string, number>,
  itemsById: Map<string, FoodItem>,
  lastType: FoodItemKind | null,
): FoodItem | null {
  const candidates: FoodItem[] = [];
  for (const [id, qty] of remaining) {
    if (qty <= 0) continue;
    const item = itemsById.get(id);
    if (!item || !allowed.includes(item.type)) continue;
    candidates.push(item);
  }
  if (candidates.length === 0) return null;

  // 2.D : look-ahead. Si la prochaine fenêtre placeable est plus restrictive (sous-ensemble
  // strict du allowed actuel), on préserve les kinds restreints pour elle en piochant
  // d'abord dans les kinds non couverts par nextAllowed.
  const nextIsStricterSubset =
    nextAllowed !== null &&
    nextAllowed.length < allowed.length &&
    nextAllowed.every((k) => allowed.includes(k));

  candidates.sort((a, b) => {
    if (nextIsStricterSubset) {
      const aReserved = nextAllowed!.includes(a.type) ? 1 : 0;
      const bReserved = nextAllowed!.includes(b.type) ? 1 : 0;
      if (aReserved !== bReserved) return aReserved - bReserved;
    }
    const aSame = a.type === lastType ? 1 : 0;
    const bSame = b.type === lastType ? 1 : 0;
    if (aSame !== bSame) return aSame - bSame;
    return b.carbs_g - a.carbs_g;
  });
  return candidates[0];
}

function buildIntakeDraft(scheduledAtMinute: number, item: FoodItem): DraftEvent {
  const payload: DraftEvent['payload'] = { food_item_id: item.id, quantity: 1 };
  if (item.volume_ml !== undefined) payload.volume_ml = item.volume_ml;
  return { scheduled_at_minute: scheduledAtMinute, type: 'intake', payload };
}
