# TimelinePlan — Spec v1

> Le `TimelinePlan` est le contrat stable entre la couche d'authoring (engine déterministe + LLM enrichment côté companion) et le runtime mobile offline. Voir `/root/.claude/plans/pour-commencer-lit-et-streamed-newell.md` pour le contexte architectural.

## Principe

```
Authoring (slow, smart, cloud OK)  →  TimelinePlan JSON  →  Runtime (fast, offline)
```

- Le runtime mobile **ne lit que ce format**. Aucune logique nutritionnelle dans le runtime — il sait scheduler des notifs, traiter les triggers de branches, gérer les logs.
- Qui produit le plan peut évoluer (engine V1, LLM V3) sans toucher au runtime.

## Structure (TypeScript canonique : `src/models/timeline-plan.ts`)

```ts
TimelinePlan {
  version: 1
  race_id: string
  generated_at: ISO8601
  generator: GeneratorInfo

  race_targets: {
    carbs_per_hour_g:  TargetTimeline
    fluid_per_hour_ml: TargetTimeline
    sodium_per_hour_mg: TargetTimeline
  }

  events:   TimelineEvent[]
  branches: Branch[]

  validation: { passed: boolean, warnings: PlanValidationWarning[] }
}
```

### `TargetTimeline`

Permet d'exprimer **G1** (modulation temporelle d'un target). Un `default` + une liste d'intervalles `from_min/to_min/value` qui surchargent.

### `TimelineEvent`

Un event = un moment où le runtime doit interagir avec le coureur (notif, logging, check-in). Types :
- `intake` — apport solide/liquide
- `fluid_reminder` — rappel de boire (volume cumulé)
- `check_in` — auto-évaluation du coureur
- `aid_station` — passage ravito officiel

Chaque event a `why` (FR pour debug + UI) et `source` (engine | llm | user) pour traçabilité.

### `Branch`

Règle conditionnelle précalculée, évaluée par le runtime sur des triggers observables (skips, check-in, drift). Action limitée à un set fini que le runtime sait exécuter sans LLM. Couvre **G6** (re-trigger en course).

Triggers V1 : `skipped_count`, `checkin_feedback`, `pace_drift` (Phase B), `elapsed_min`.
Actions V1 : `boost_next_intake`, `shift_next_by`, `skip_next_intake`, `switch_preferred_kinds`, `replan_from_now` (no-op si offline).

## Couverture des gaps d'expressivité §15

| Gap | Couverture |
|---|---|
| G1 Modulation temporelle | `RaceTargets.timeline[]` |
| G2 Séquences d'intake | `events[]` avec `advice.preferred_kinds` (produit par LLM enrichment) |
| G3 Actions conditionnelles | Engine TS direct (if/else) + LLM lors de la génération |
| G4 Lookahead multi-fenêtres | LLM (placement des events dans `events[]`) |
| G5 Budget inventaire | Validator (feasibility check) + warning + LLM réajuste |
| G6 Re-trigger en course | `branches[]` |

## Exemples

Voir `docs/timeline-plan-examples/` :
- `carbs-progressive-5h.json` — exemple §15 #1 : 60g/h puis 90g/h après 5h
- `gel-water-solid-sequence.json` — exemple §15 #2 : gel × 10 min × 1h, eau 1h, solide × 30 min

## Évolution

- `version` est strict. Tout changement de schéma → bump + migrator.
- Les plans archivés en SQLite sont versionnés. À chaque ouverture, on migre vers la version courante si besoin.
- Avant V2, on valide à la fois en TS (types) côté mobile et en zod côté companion. L'unification dans un package partagé attendra qu'on en ait vraiment besoin (probablement A.4 ou C).
