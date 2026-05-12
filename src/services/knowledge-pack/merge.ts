import type {
  KnowledgePack,
  KnowledgePackOverlay,
} from '../../models/knowledge-pack';
import type { Rule } from '../../models/rule';

/**
 * Deep-merges an overlay into a base pack and returns the resulting pack.
 *
 * Static config fields use shallow-by-section merge : if `overlay.X` is
 * present, the corresponding section of `base.X` gets `{ ...base.X,
 * ...overlay.X }`. For 2-level sections (session_defaults, fluid_modifiers.
 * temperature) we recurse one extra level.
 *
 * Rules merge by id : an overlay rule with the same id as a base rule replaces
 * the base rule in place (preserving JSON order). New overlay rule ids are
 * appended at the end of the rules list.
 */
export function mergeKnowledgePack(
  base: KnowledgePack,
  overlay: KnowledgePackOverlay,
): KnowledgePack {
  return {
    version: base.version,
    session_defaults: mergeSessionDefaults(base.session_defaults, overlay.session_defaults),
    param_defaults: { ...base.param_defaults, ...overlay.param_defaults },
    param_clamps: { ...base.param_clamps, ...overlay.param_clamps },
    rate_bounds: { ...base.rate_bounds, ...overlay.rate_bounds },
    fluid_modifiers: {
      temperature: {
        ...base.fluid_modifiers.temperature,
        ...(overlay.fluid_modifiers?.temperature ?? {}),
      },
      humidity_high_factor:
        overlay.fluid_modifiers?.humidity_high_factor ??
        base.fluid_modifiers.humidity_high_factor,
    },
    sodium_modifiers: { ...base.sodium_modifiers, ...overlay.sodium_modifiers },
    exposure_modifiers: { ...base.exposure_modifiers, ...overlay.exposure_modifiers },
    first_hour: { ...base.first_hour, ...overlay.first_hour },
    aid_station_estimates: {
      ...base.aid_station_estimates,
      ...overlay.aid_station_estimates,
    },
    feasibility_threshold: overlay.feasibility_threshold ?? base.feasibility_threshold,
    rules: mergeRules(base.rules, overlay.rules ?? []),
  };
}

function mergeSessionDefaults(
  base: KnowledgePack['session_defaults'],
  overlay: KnowledgePackOverlay['session_defaults'],
): KnowledgePack['session_defaults'] {
  if (!overlay) return base;
  const out = { ...base };
  for (const sessionType of Object.keys(overlay) as (keyof typeof overlay)[]) {
    const overlaySession = overlay[sessionType];
    if (!overlaySession) continue;
    out[sessionType] = { ...base[sessionType], ...overlaySession };
  }
  return out;
}

function mergeRules(baseRules: Rule[], overlayRules: Rule[]): Rule[] {
  if (overlayRules.length === 0) return baseRules;
  const baseIds = new Set(baseRules.map((r) => r.id));
  const overlayMap = new Map(overlayRules.map((r) => [r.id, r]));
  const out: Rule[] = [];
  // Walk base in order. Replace if overlay has same id.
  for (const baseRule of baseRules) {
    out.push(overlayMap.get(baseRule.id) ?? baseRule);
  }
  // Append overlay rules with new ids (not present in base) in their JSON order.
  for (const overlayRule of overlayRules) {
    if (!baseIds.has(overlayRule.id)) {
      out.push(overlayRule);
    }
  }
  return out;
}
