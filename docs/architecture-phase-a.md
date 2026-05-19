# Phase A — Refonte du moteur de planification (Trail Fuel)

> Pivot après discussion "fresh eyes" du 2026-05-19.
> Le design DSL initial est conservé en annexe historique en fin de fichier mais n'est plus l'option retenue.

---

## Context

Le système actuel (modificateurs scalaires sur baseline, appliqués une fois au démarrage) bloque l'expressivité dès qu'on sort de la math linéaire. §15 d'`evolution-planning.md` : "60g/h puis 90g/h après 5h" ou "gel toutes les 10 min pendant 1h puis eau pendant 1h puis solide" → inexprimables.

**Pivot** : plutôt que de réécrire un DSL ambitieux pour exprimer toute la nutrition trail dans un langage déclaratif (effort énorme, debug pénible, LLM peu fiable sur DSL custom), on sépare les responsabilités :
- **Authoring / planification** = calcul lent, complexe, profite du LLM, OK internet à la création du plan
- **Runtime en course** = rapide, déterministe, 100% offline, batterie limitée

Le DSL forçait à mélanger les deux. La nouvelle archi les sépare physiquement.

**Décision user** : "Mix au début (règles déterministes simples + LLM pour patterns complexes), puis plus le LLM est fiable, plus il prend de décisions tout seul."

---

## Insight clé : 2 régimes de calcul, 1 format de sortie

```
Authoring (slow, smart, cloud OK)  →  TimelinePlan JSON  →  Runtime (fast, offline)
```

- Le **TimelinePlan** est le contrat stable. Format JSON simple : suite d'events ordonnés, branches conditionnelles, justifications FR.
- Qui produit le TimelinePlan peut évoluer dans le temps sans toucher au runtime :
  - V1 : engine déterministe ~80% + LLM enrichit ~20%
  - V2-3 : engine pose les safety rails, LLM produit le plan
  - À aucun moment le runtime ne change

---

## Architecture retenue (V1 — "Mix, leaning rules")

```
┌─ Deterministic Engine (local, TS, ~400 lignes) ──────────┐
│  ~15 règles natives en code, pas de DSL :                 │
│   - carbs/h, fluid/h, sodium/h baseline + modifs simples  │
│     (intensité, temp linéaire, humidité, durée)           │
│   - placement uniform (intake_interval_min)               │
│   - restrictions terrain (descente tech / montée raide)   │
│   - safety bounds (carbs ∈ [30, 120], min 15min entre)    │
│  Produit un TimelinePlan "brut".                          │
└────────────────────────────────────────────────────────────┘
                       │
                       │  (au moment "générer mon plan", J-1)
                       │
                       │  Plan brut + KB articles taggués + race ctx
                       ▼
┌─ LLM Enrichment (companion Next.js, online) ─────────────┐
│  Reçoit : TimelinePlan brut + race + GPX + KB pertinente  │
│  Sortie : Patch JSON sur le plan :                        │
│   - ajouts/remplacements de phases temporelles            │
│   - patterns d'intake (séquences)                         │
│   - explication FR par modification                       │
│   - confidence score par modif                            │
│  L'user voit le diff plan brut → enrichi, accepte/refuse  │
│  par modif (granularité fine). Plan final figé.           │
└────────────────────────────────────────────────────────────┘
                       │
                       │  Validation déterministe :
                       │   - safety bounds toujours respectées
                       │   - inventaire feasible
                       │   - pas de chevauchement absurde
                       │  Si KO → retry avec feedback ou fallback engine seul
                       ▼
┌─ Validator (local, déterministe) ────────────────────────┐
│  Garde-fous purement défensifs.                           │
│  Logge toute modif LLM rejetée → KB d'apprentissage.      │
└────────────────────────────────────────────────────────────┘
                       │
                       ▼
┌─ Runtime (mobile, offline, ~300 lignes) ─────────────────┐
│  Lit TimelinePlan + GPX + état live.                      │
│  Schedule expo-notifications. Gère logs, skips, check-ins.│
│  Branches conditionnelles précalculées exécutées localement.│
│  Pas de LLM en course. Re-genération possible aux ravitos │
│  si internet dispo (re-call companion).                   │
└────────────────────────────────────────────────────────────┘
                       │  Post-course
                       ▼
┌─ Calibration (companion, offline batch) ─────────────────┐
│  Planned vs actual → ajuste profil pour next race.        │
│  Modifs LLM acceptées par user → renforcent KB.           │
└────────────────────────────────────────────────────────────┘
```

### Pourquoi cette archi tient

- **Engine simple = code TS direct.** Pas de DSL à parser, pas de templates, pas de compositor. ~15 fonctions pures. Testable avec Jest sans mocks. Le 80% que tu connais à coup sûr.
- **LLM = couche additive.** Si le companion n'est pas dispo / pas branché, l'engine seul produit un plan utilisable. Pas de single point of failure.
- **TimelinePlan = contrat stable.** Le runtime ne sait pas (ne veut pas savoir) comment le plan a été produit. Refactor engine/LLM sans toucher mobile.
- **Trajectoire prévue** : à chaque release, tu déplaces une responsabilité (intake patterns, phases temporelles, etc.) de "rule en code" vers "compétence LLM". Le code engine *rétrécit* dans le temps.

### Évolution dans le temps

| Version | Engine produit | LLM enrichit | Validator |
|---|---|---|---|
| V1 (now) | Targets + placement uniform + terrain | Phases temporelles, patterns, exceptions | Bornes physiologiques + feasibility |
| V2 (Q4) | Targets + safety bounds | Tout le placement + tous les patterns | Idem |
| V3 (2027) | Safety bounds only | Tout | Idem |

Tu décides du shift quand tu as la donnée : "sur 50 plans, le LLM a placé correctement 95% du temps → on lui confie X". Pas avant.

---

## Format du `TimelinePlan` (contrat stable)

```jsonc
{
  "version": 1,
  "race_id": "uuid",
  "generated_at": "ISO8601",
  "generator": "engine@1.2.0 + llm@haiku-4-5", // traçabilité
  "race_targets": {
    "carbs_per_hour_g": { "default": 60, "timeline": [
      { "from_min": 0,   "value": 60 },
      { "from_min": 300, "value": 90 }
    ]},
    "fluid_per_hour_ml": { "default": 500 },
    "sodium_per_hour_mg": { "default": 700 }
  },
  "events": [
    {
      "id": "evt-001",
      "type": "intake",
      "at_min": 20,
      "kind": "gel",
      "amount": 1,
      "why": "Carbs target 60g/h, premier apport à 20min",
      "source": "engine",   // ou "llm"
      "confidence": 1.0
    },
    {
      "id": "evt-024",
      "type": "intake",
      "at_min": 320,
      "kind": "solid",
      "why": "Après 5h, switch carbs progressif à 90g/h ; section roulante préférable pour solide",
      "source": "llm",
      "confidence": 0.85
    }
  ],
  "branches": [
    {
      "id": "br-skip-3",
      "trigger": { "type": "skipped_count", "operator": ">=", "value": 3, "window_min": 60 },
      "action": "boost_next_intake",
      "params": { "factor": 1.5 }
    }
  ],
  "validation": {
    "passed": true,
    "warnings": ["Inventaire gel limite : 14 prévus / 12 dispo. Suggère ajout."]
  }
}
```

Le runtime mobile ne lit que ça. Il sait scheduler des notifs, traiter les triggers de branches, fin. Aucune logique nutritionnelle.

---

## Stack tech

| Couche | Choix | Raison |
|---|---|---|
| Mobile | React Native + Expo (existant) | Bon trade-off Android-first solo |
| DB locale | expo-sqlite (existant) | Marche, pas de raison de bouger |
| Engine | TypeScript pur dans `src/engine/` | ~400 lignes, testable Jest |
| Validator | TypeScript pur dans `src/engine/validator/` | Partagé mobile + companion |
| Companion backend | Next.js API routes (existant) | Déjà déployé, déjà Claude API branché |
| LLM | Anthropic SDK, `claude-haiku-4-5` pour plan, `claude-sonnet-4-6` pour calibration | Haiku ultra-rapide ~0.001€/plan, Sonnet sur calibration rare |
| KB | Markdown + frontmatter (tags) dans `companion/lib/knowledge/` | Versionné Git, indexable |
| Prompt caching | Anthropic `cache_control` sur prompt système + KB | Cache hit ~90%, divise coût par 10 |

---

## Le rôle nouveau du companion

Le companion devient le **studio d'authoring + le backend LLM**, pas un éditeur de rules.

- **KB editor** : écrire des articles markdown avec frontmatter (tags : terrain, durée, météo, profil…). Versionné.
- **Plan previewer** : tape une race sample, vois le TimelinePlan brut + enrichi côte à côte, accepte/refuse chaque modif LLM.
- **Endpoint `/api/generate-plan`** : reçoit race+GPX+plan brut, sélectionne KB pertinente, appelle Claude, valide, renvoie patch.
- **Calibration analyzer** : post-course, compare planned vs actual, génère propositions d'ajustement profil.

L'ancienne UX "extraire des rules d'un article" disparaît. À la place : "écris l'article en markdown, ajoute des tags, le LLM s'en sert directement au plan time."

---

## Décomposition implémentation (révisée)

### A.1 Discovery (~5h)
- [x] Décision pivot architecture (Mix engine + LLM)
- [x] Schéma `TimelinePlan` v1 en TypeScript → `trail-fuel/src/models/timeline-plan.ts`
- [x] Spec + exemples concrets §15 → `trail-fuel/docs/timeline-plan.md` + `docs/timeline-plan-examples/*.json`
- [x] Format markdown+frontmatter de la KB → `companion/lib/knowledge/README.md`
- [x] 4 articles KB d'amorçage (carbs progression, heat protocol, sodium baseline, terrain technical) — bootstrap, à étendre avec les sources réelles
- [x] Prompt système Claude → `companion/lib/plan-builder/system-prompt.md` + README plan-builder

**Note** : zod schema reporté à A.2 (mobile n'a pas zod en deps, on l'ajoute quand on en a besoin pour le runtime parsing). Les types TS suffisent en A.1.

### A.2 Engine déterministe + Runtime refactor (~20h, vs 30h DSL)
- [x] `src/engine/builder/constants.ts` — modificateurs + safety bounds (extraits v1.json en code TS)
- [x] `src/engine/builder/targets.ts` — computeRaceTargets pure (intensité, chaleur, humidité, sodium long)
- [x] `src/engine/builder/placement.ts` — placeEvents : intakes périodiques + terrain (skip descente tech, climb_steep→gel) + check-ins + fluid_reminders + aid_stations
- [x] `src/engine/builder/safety.ts` — validatePlan partagé mobile+companion (bornes carbs 30-120, fluid 300-1000, sodium 300-1500, intervalles, ordering)
- [x] `src/engine/builder/build-plan.ts` — orchestrateur retournant TimelinePlan v1 (réutilise buildTimeline+buildWindows existants pour GPX)
- [x] Tests Jest sur targets, build-plan, safety
- [ ] **Deferred A.4** : adapter `TimelinePlan → PlannedEvent[]` ou refactor runtime pour consommer TimelinePlan directement
- [ ] **Deferred A.4** : suppression de `src/engine/planning/` une fois la transition complète

**Note** : l'ancien pipeline `src/engine/planning/generate.ts` reste actif. Le runtime mobile continue de l'utiliser. Le nouveau `buildPlan` est dispo en parallèle et sera consommé par le companion en A.3. La fusion finale (runtime sur TimelinePlan, suppression de l'ancien) se fait en A.4.

### A.3 Companion : KB + Plan previewer (~25h, vs 10h)
- [x] 4 articles markdown d'amorçage (à étendre à ~15 avec les sources réelles)
- [x] `companion/lib/knowledge/` — loader gray-matter + filter par tags + schema zod
- [x] `companion/lib/timeline-plan/` — types + zod (miroir mobile)
- [x] `companion/lib/plan-builder/` — patch-schema, apply-patch, prompt, generate (orchestrateur)
- [x] `companion/app/api/generate-plan/` — endpoint POST avec validation, fallback 502
- [x] UI previewer `/preview` : sample race + brut plan, diff résumé, ops appliquées/rejetées, articles matched, tokens + coût USD estimé
- [ ] **Reporté A.4** : accept/refuse granulaire par modification dans le previewer (pour l'instant on régénère et on lit le diff visuellement)
- [ ] **Reporté A.4** : bouton mobile "enrichir avec LLM" — couplé au refactor runtime (A.4)

**Note** : le bouton mobile dépend du fait que le runtime sache consommer un TimelinePlan. C'est le scope A.4, on le fait en même temps.

### A.4 Re-calibration (~15h) — Phase B fusionnée
- [x] **Step 1** — Adapter `TimelinePlan → PlannedEvent[]` (pure function avec tests)
- [x] **Step 1** — API client mobile `src/services/plan-enrichment/client.ts` avec timeout + erreurs typées
- [x] **Step 1** — Orchestrator `generateEnrichedPlan()` combine engine + LLM optionnel + adapter
- [x] **Step 2** — Bouton "Enrichir avec Claude" dans PreviewScreen (preview-only, ne persiste pas)
- [ ] **Step 3** — Persistence du plan enrichi dans la DB (schema change race table)
- [ ] **Step 3** — RaceRuntimeScreen consomme le plan persisté (au lieu de re-generatePlan)
- [ ] Mobile : tracking planned vs actual en course (event-log existant, ajouter source_event_id)
- [ ] Post-course : sync vers companion, génération propositions ajustement
- [ ] Renforcement KB : modifs LLM acceptées loggées en "exemples positifs"
- [ ] Re-génération à un ravito si internet dispo (re-call endpoint)

**État actuel** : chaîne end-to-end testable (engine builder → companion enrichment → adapter → events runtime). Le runtime exécute encore l'ancien pipeline par défaut. Le bouton "Enrichir" dans PreviewScreen permet de valider le nouveau flow.

### A.5 Stabilisation (~10h)
- [ ] 2-3 courses perso sur nouveau moteur
- [ ] Polish + bug fixes
- [ ] Doc utilisateur (note FR pour le companion)

**Total estimé** : ~75h vs 70h DSL — équivalent, mais on déplace l'effort vers le LLM/companion (qui est plus itératif) et on simplifie radicalement le code engine + runtime.

---

## Fichiers critiques

**À refactor / remplacer**
- `src/models/rule.ts` — devient `timeline-plan.ts` (types JSON output)
- `src/models/knowledge-pack.ts` — supprimé (plus de pack/overlay côté natif)
- `assets/knowledge/v1.json` — supprimé, migré en markdown côté companion
- `src/engine/planning/generate.ts` — réécrit, produit TimelinePlan
- `src/engine/planning/resolve-params.ts` → `src/engine/builder/targets.ts`
- `src/engine/planning/placement.ts` → `src/engine/builder/placement.ts`
- `src/engine/planning/windows.ts`, `slope-categories.ts` — conservés, utilisés par placement
- `src/services/notifications/*` — consomment TimelinePlan au lieu de PlannedEvent[]
- `companion/lib/overlay/extract-rules.ts` — supprimé
- `companion/lib/overlay/build-overlay-file.ts` — supprimé
- `companion/db/schema.ts` — simplifié (articles markdown au lieu de rules extraites)

**Nouveau**
- `src/engine/timeline-plan.ts` — schéma + zod
- `src/engine/builder/` — engine déterministe modulaire
- `src/engine/validator/` — bornes physiologiques + feasibility
- `companion/lib/knowledge/` — KB markdown loader
- `companion/lib/plan-builder/` — Claude call + prompt + cache
- `companion/app/api/generate-plan/route.ts` — endpoint
- `companion/app/preview/page.tsx` — UI plan previewer

---

## Open follow-ups

- **Versioning du TimelinePlan** : changement de schéma → plans archivés cassent. Garder un `version: 1` strict + migrators.
- **Auth endpoint** : token simple (env var partagée par toi + potes) ou rien (rate limit IP) ? Pas critique en closed beta.
- **Cache Claude** : prompt système + KB stable → `cache_control` agressif. Cible 90% cache hit, coût ~0.0001€/plan.
- **Fallback si companion down** : engine seul produit un plan brut utilisable. Logger l'incident, ne pas bloquer le user.
- **Trajectoire vers V2/V3** : critère mesurable de shift de responsabilité ("LLM placement accepté à 95% sur 50 plans → on retire le placement uniform de l'engine"). À définir en post-A.5.
- **Open source la KB ?** Si oui, contrib externe possible. Sinon, reste asset privé. À trancher en C.

---

## Verification

### A.1 (validation design avant code)
- [ ] Schéma `TimelinePlan` couvre les 2 exemples §15 (carbs progressifs + intake pattern) → écrire les 2 plans JSON à la main, vérifier qu'ils ont du sens.
- [ ] Prompt système Claude → tester sur ChatGPT/Claude.ai avec 3 races sample. Plan généré doit être plausible.

### A.2 (engine + runtime)
- [ ] Tests Jest sur chaque module du builder (targets, placement, safety).
- [ ] Test integ : plan généré pour 5 races types (3h plaisir, 6h dur, 12h ultra, 8h chaleur, 4h froid) ≈ plan ancien moteur.
- [ ] `tsc --noEmit` + `npm test` passent.

### A.3 (companion + LLM)
- [ ] Endpoint `/api/generate-plan` → 5 races sample. Sortie valide zod. Latence < 10sec p95.
- [ ] Plan previewer affiche diff brut/enrichi avec explanations. 10 modifs sur sample → acceptance utile.
- [ ] Coût mesuré : < 0.005€ par plan en moyenne avec cache.

### A.4 (recalibration)
- [ ] Course 3h synthétique avec skips simulés → branches déclenchées correctement.
- [ ] Post-course sync → propositions cohérentes.

### Validation finale Phase A
- [ ] 2 courses perso terrain (cf. Phase C roadmap). Pas de crash. Plan subjectivement utile. Si non, itérer prompt + KB, pas code.

---

## Annexe historique — Design DSL initial (abandonné)

Une première itération (cf. historique de ce fichier dans `git log`) proposait :
- DSL JSON structuré + templates TypeScript paramétriques
- 2 familles de rules (param-rules + pattern-rules)
- Timeline continue + merge strategies + hooks Phase B
- Companion LLM → instanciation de templates

**Pourquoi abandonné** : sur "fresh eyes" pivot, on a réalisé qu'on construisait un mini-langage pour exprimer ce qu'un coach humain dit en deux phrases. Le coût d'authoring (écrire des templates) + le coût de parsing/composition/conflit ne valent pas l'expressivité gagnée par rapport à "LLM lit la KB + produit le plan directement". Le DSL reste une option si on devait passer 100% offline pour le plan-time, mais la décision Q3-bis (LLM cloud OK pour plan-time) ferme cette branche.

Les **6 gaps d'expressivité (G1-G6)** identifiés restent valides et servent de checklist pour valider que le nouveau moteur (engine + LLM) les couvre :
- G1 modulation temporelle → engine via `timeline[]` sur targets + LLM via patch
- G2 séquences d'intake → 100% LLM (patterns dans TimelinePlan.events)
- G3 actions conditionnelles → engine via if/else direct en TS + LLM
- G4 lookahead multi-fenêtres → LLM
- G5 budget inventaire → validator (feasibility check) + LLM (réajuste)
- G6 re-trigger en course → TimelinePlan.branches[]
