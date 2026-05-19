/**
 * timelinePlanToEvents — adapter TimelinePlan → PlannedEvent[].
 *
 * Le runtime mobile consomme historiquement des PlannedEvent[] (modèle pré-A.2).
 * Pour brancher le nouveau pipeline (engine builder + LLM enrichment) sans
 * refactorer le runtime, on convertit le TimelinePlan en PlannedEvent[].
 *
 * Choix :
 *   - intake events : résout food_item_id depuis preferred_kinds + inventaire
 *     (premier match dispo). Si rien ne matche, food_item_id=undefined et le
 *     runtime résoudra au moment du logging.
 *   - quantity calculée depuis advice.carbs_target_g / item.carbs_g (arrondi 1).
 *   - fluid_reminder : propage target_volume_ml en payload.
 *   - aid_station : un seul event 'arrived' (pas le 'approaching' que produisait
 *     l'ancien pipeline). À voir en A.5 si on a besoin du double-event.
 *   - branches : reportées dans `warnings.unprocessed_branches` pour info.
 *     Le runtime actuel ne sait pas les exécuter — A.5 ajoutera ce support.
 */

import type { FoodItem, FoodItemKind } from '../../models/food-item';
import type {
  PlannedEvent,
  PlannedEventPayload,
  PlannedEventType,
  PlanWarning,
} from '../../models/planned-event';
import type { InventoryItem } from '../../models/race';
import type {
  IntakeAdvice,
  TimelineEvent,
  TimelinePlan,
} from '../../models/timeline-plan';

export type AdapterInput = {
  plan: TimelinePlan;
  foodItems: FoodItem[];
  inventory: InventoryItem[];
};

export type AdapterResult = {
  events: PlannedEvent[];
  warnings: PlanWarning[];
};

export function timelinePlanToEvents(input: AdapterInput): AdapterResult {
  const { plan, foodItems, inventory } = input;

  // Inventaire mutable pour décrémenter au fur et à mesure du placement.
  const remaining = new Map<string, number>();
  for (const slot of inventory) {
    remaining.set(slot.food_item_id, (remaining.get(slot.food_item_id) ?? 0) + slot.quantity);
  }
  const itemsById = new Map(foodItems.map((it) => [it.id, it]));

  const events: PlannedEvent[] = [];
  for (let i = 0; i < plan.events.length; i += 1) {
    const e = plan.events[i];
    const payload = buildPayload(e, remaining, itemsById);
    const adaptedType = mapType(e.type);
    if (adaptedType === null) continue;
    events.push({
      id: `${plan.race_id}::${e.id}`,
      race_id: plan.race_id,
      scheduled_at_minute: e.at_min,
      type: adaptedType,
      payload,
    });
  }

  // Reporte la validation TimelinePlan en warnings legacy.
  const warnings: PlanWarning[] = plan.validation.warnings.map((w) => ({
    severity: w.severity,
    code: w.code,
    message: w.message,
    data: w.data ? coerceWarningData(w.data) : undefined,
  }));

  if (plan.branches.length > 0) {
    warnings.push({
      severity: 'low',
      code: 'branches_not_executed',
      message: `${plan.branches.length} branche(s) conditionnelle(s) dans le plan ne sont pas encore exécutées par le runtime (Phase B).`,
      data: { count: plan.branches.length },
    });
  }

  return { events, warnings };
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function mapType(type: TimelineEvent['type']): PlannedEventType | null {
  switch (type) {
    case 'intake':         return 'intake';
    case 'fluid_reminder': return 'fluid_reminder';
    case 'check_in':       return 'check_in';
    case 'aid_station':    return 'aid_station';
  }
}

function buildPayload(
  e: TimelineEvent,
  remaining: Map<string, number>,
  itemsById: Map<string, FoodItem>,
): PlannedEventPayload {
  switch (e.type) {
    case 'intake': {
      const advice = e.advice ?? {};
      const item = pickItem(advice, remaining, itemsById);
      if (!item) return {};
      const quantity = computeQuantity(advice, item);
      remaining.set(item.id, (remaining.get(item.id) ?? 0) - quantity);
      return {
        food_item_id: item.id,
        quantity,
        volume_ml: 'volume_ml' in item && item.volume_ml ? item.volume_ml * quantity : undefined,
      };
    }
    case 'fluid_reminder': {
      const target = e.advice?.fluid_target_ml;
      return target !== undefined ? { target_volume_ml: target } : {};
    }
    case 'check_in':
      return {};
    case 'aid_station':
      return e.aid_station_id ? { aid_station_id: e.aid_station_id, aid_phase: 'arrived' } : {};
  }
}

/**
 * Choisit un item dispo dans l'inventaire matchant les preferred_kinds.
 * Tombe en fallback sur n'importe quel item si rien ne matche — le runtime
 * a déjà sa logique de résolution complète en fallback.
 */
function pickItem(
  advice: IntakeAdvice,
  remaining: Map<string, number>,
  itemsById: Map<string, FoodItem>,
): FoodItem | null {
  const preferred = new Set(advice.preferred_kinds ?? []);
  const forbidden = new Set(advice.forbidden_kinds ?? []);

  let fallback: FoodItem | null = null;
  for (const [id, qty] of remaining) {
    if (qty <= 0) continue;
    const item = itemsById.get(id);
    if (!item) continue;
    if (forbidden.has(item.type)) continue;
    if (preferred.size === 0) {
      if (!fallback) fallback = item;
      continue;
    }
    if (preferred.has(item.type)) return item;
    if (!fallback) fallback = item;
  }
  return fallback;
}

function computeQuantity(advice: IntakeAdvice, item: FoodItem): number {
  const target = advice.carbs_target_g;
  if (!target || item.carbs_g <= 0) return 1;
  return Math.max(1, Math.round(target / item.carbs_g));
}

function coerceWarningData(
  data: Record<string, number | string>,
): Record<string, number> {
  const out: Record<string, number> = {};
  for (const [k, v] of Object.entries(data)) {
    if (typeof v === 'number') out[k] = v;
  }
  return out;
}

// ─── Export utility: kinds présents dans un plan, utile pour debug ─────────

export function kindsUsed(plan: TimelinePlan): Set<FoodItemKind> {
  const kinds = new Set<FoodItemKind>();
  for (const e of plan.events) {
    if (e.advice?.preferred_kinds) for (const k of e.advice.preferred_kinds) kinds.add(k);
  }
  return kinds;
}
