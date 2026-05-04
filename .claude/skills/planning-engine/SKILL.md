---
name: planning-engine
description: Use this skill when implementing or modifying the planning generation logic — the core algorithm that turns a Race configuration (profile, GPX, inventory, aid stations, session type) into a sorted list of PlannedEvents (intakes and check-ins). Covers the generation pipeline, event merging (<3 min apart), aid station handling, terrain-aware placement, inventory feasibility check, and the fallback for missing GPX. Trigger this whenever code touches `generatePlan`, `PlannedEvent`, the planning pipeline, or when the output of the planner doesn't match expectations.
---

# Planning Engine

Cœur de l'app : la fonction qui prend une `Race` et produit la liste de `PlannedEvent` à déclencher pendant la course.

**Principe** : c'est une **fonction pure**. Mêmes entrées → mêmes sorties. Pas de `Date.now()`, pas de I/O, pas de state global. Ça rend le moteur testable isolément avec des fixtures.

## Signature cible

```typescript
function generatePlan(input: {
  profile: Profile;
  race: Race;
  foodItems: FoodItem[];
  now: number; // timestamp de référence, injecté
}): {
  events: PlannedEvent[];
  warnings: PlanWarning[];
}
```

`warnings` accompagne les events pour signaler les problèmes détectés (inventaire insuffisant, apport < cible, etc.) sans empêcher la génération.

## Pipeline

```
1. Résolution des paramètres effectifs (profile × overrides × session_type)
2. Construction de la timeline temporelle (via GPX ou durée manuelle)
3. Calcul des besoins cumulés (glucides, eau, sodium)
4. Placement des check-ins
5. Découpage en fenêtres de 20 min
6. Placement des intakes dans chaque fenêtre (avec règles de terrain)
7. Insertion des events de ravito
8. Vérification inventaire vs besoins
9. Merge des events proches (< 3 min)
10. Tri final par timestamp
```

## Étape 1 — Paramètres effectifs

```typescript
function resolveParams(profile: Profile, race: Race) {
  const sessionDefaults = SESSION_TYPE_DEFAULTS[race.session_type];
  const overrides = race.overrides ?? {};

  return {
    carbs_per_hour_g:
      overrides.carbs_per_hour_g ??
      profile.carbs_per_hour_g * sessionDefaults.intensity_modifier,
    fluid_per_hour_ml:
      overrides.fluid_per_hour_ml ??
      applyFluidModifiers(profile.fluid_per_hour_ml, race),
    sodium_per_hour_mg:
      applySodiumModifiers(profile.sodium_per_hour_mg, race),
    first_intake_after_min: overrides.first_intake_after_min ?? 30,
    check_in_frequency_min:
      overrides.check_in_frequency_min ?? sessionDefaults.check_in_freq,
    skip_alert_threshold: sessionDefaults.skip_alert_threshold,
    deficit_alert_pct: sessionDefaults.deficit_alert_pct,
  };
}
```

Les règles exactes sont dans le skill **`nutrition-rules`**, l'implémentation doit les refléter fidèlement.

## Étape 2 — Timeline

Si `race.gpx_track` présent → utiliser `gpx_track.segments[i].estimated_time_min` pour la durée totale et pour convertir `at_km` des ravitos en `estimated_at_minute`.

Sinon → `race.estimated_duration_min` sert de durée totale, les ravitos sont positionnés linéairement (`at_km / total_km * duration`).

Voir skill **`gpx-tobler`** pour les détails du calcul.

## Étape 3 — Taux effectifs (rationnement)

Le plan reflète l'inventaire réel, pas les cibles théoriques. `computeEffectiveRates()` compare les cibles physiologiques (target) à ce que l'inventaire + ravitos peuvent fournir, et prend le min.

```typescript
function computeEffectiveRates(input: {
  params: ResolvedParams;
  durationMin: number;
  foodItems: FoodItem[];
  inventory: InventoryItem[];
  aidStations: AidStation[];
  refillInNature: boolean;
}): {
  effective: { carbs_per_hour_g: number; fluid_per_hour_ml: number };
  target: { carbs_per_hour_g: number; fluid_per_hour_ml: number };
  isRationing: { carbs: boolean; fluid: boolean };
}
```

- Si `refillInNature === true`, le fluide n'est jamais rationné.
- Les warnings `carbs_rationing` / `fluid_rationing` portent `data: { target, effective }` pour l'UI.
- L'ancien `checkFeasibility()` est remplacé par ce mécanisme.

Réduction de 30% sur la première heure toujours appliquée via `computeNeeds()` pour les besoins cumulés.

## Étape 4 — Check-ins

- Premier check-in à **T+30 min** (plus tôt que la cadence normale, voir `nutrition-rules`)
- Suivants selon `check_in_frequency_min` (45-60 min typiquement)
- Décaler de ±2 min si collision avec un intake prévu

## Étape 5 — Fenêtres de 20 min

Découper la durée totale en fenêtres, skipper la première (démarrage). Pour chaque fenêtre, calculer :

- Cible de glucides pour la fenêtre : `totalCarbs × (windowDuration / totalDuration)`, modulé première heure
- Cible d'eau idem
- Pente médiane de la fenêtre (si GPX) pour les règles de terrain

## Étape 6 — Placement des intakes

Pour chaque fenêtre :

1. **Déterminer la nature autorisée** d'intake selon la pente médiane (voir `nutrition-rules`)
   - Montée raide (>10%) → gel ou liquide uniquement
   - Descente technique (<-8%) → pas d'intake, décaler
   - Roulant → tout autorisé

2. **Sélectionner l'item** dans l'inventaire disponible qui match le mieux :
   - Alterner type/goût par rapport aux 2 fenêtres précédentes (anti-écœurement)
   - Prioriser les items à forte densité calorique en milieu de course
   - Garder 20% de l'inventaire pour la dernière heure (buffer)

3. **Si aucun item ne matche** la contrainte de terrain :
   - Décaler l'intake vers la fenêtre précédente (anticipation pré-ascension)
   - Ou générer un warning si le décalage n'est pas faisable

### Anticipation pré-ascension

Si une fenêtre contient une montée >10%, injecter l'intake calorique dans la fenêtre **précédente** (30-45 min avant). L'apport est "pré-stocké" pour l'effort.

```typescript
function shouldAnticipate(
  currentWindow: Window,
  nextWindow: Window
): boolean {
  return nextWindow.medianSlope > 0.10 && currentWindow.medianSlope < 0.05;
}
```

## Étape 7 — Events de ravito

Pour chaque `AidStation`, insérer **deux** `PlannedEvent` de `type === 'aid_station'`, distingués par leur `payload.aid_phase` :

- Un event `{ type: 'aid_station', payload: { aid_station_id, aid_phase: 'approaching' } }` à T-3 min (préparation mentale, remettre les flasks en position)
- Un event `{ type: 'aid_station', payload: { aid_station_id, aid_phase: 'arrived' } }` à T exact (checklist : remplir, manger solide sur place si disponible, prendre en musette)

Le refill virtuel des flasks au passage d'un ravito avec `available.refill_possible === true` modifie l'inventaire disponible pour la suite du calcul.

**Note sur le typage** : `PlannedEvent.type` est l'union `'intake' | 'check_in' | 'aid_station' | 'fluid_reminder'`. Le type `fluid_reminder` porte `target_volume_ml` dans son payload.

## Étape 7b — Rappels fluides (flux parallèle)

Les intakes ne portent que des **solides** (gel, bar, real_food). L'hydratation est un flux parallèle via `placeFluidReminders()` :

```typescript
function placeFluidReminders(input: {
  effectiveFluidPerH: number;
  totalDurationMin: number;
}): DraftEvent[]
```

- Premier rappel à **T+15 min**, puis toutes les **30 min**
- Volume par rappel : `effectiveFluidPerH × 0.5`
- Pas de filtrage par pente
- Payload : `{ target_volume_ml: number }`
- Type d'event : `'fluid_reminder'`

Ordre de priorité pour les collisions : `aid_station > intake > check_in > fluid_reminder`. Un fluid_reminder en collision se décale de +2 min.

Les fluid_reminders ne sont **jamais mergés** entre eux ni avec d'autres types.

## Étape 8 — Vérification inventaire

```typescript
function checkInventoryFeasibility(
  inventory: InventoryItem[],
  foodItems: FoodItem[],
  totalCarbs: number,
  totalFluid: number,
  aidStations: AidStation[]
): PlanWarning[] {
  const warnings: PlanWarning[] = [];
  const carbsAvailable = sumCarbs(inventory, foodItems);
  const carbsFromAidStations = estimateAidStationContribution(aidStations);

  if (carbsAvailable + carbsFromAidStations < totalCarbs * 0.85) {
    warnings.push({
      severity: 'high',
      message: `Inventaire insuffisant : ${totalCarbs - carbsAvailable}g de glucides manquants.`,
    });
  }
  // Idem pour fluid, sodium
  return warnings;
}
```

Warnings non bloquants : on génère le plan quand même, avec ce qu'on a.

## Étape 8.5 — Résolution des collisions inter-types

Après le merge mais avant l'attribution des ids, résoudre les collisions à la **même minute** entre events de **types différents**. Le merge ne traite que les events de **même type** (intake+intake, check_in+check_in) ; ces collisions cross-type passent à travers et créeraient deux notifs simultanées si on ne les ajustait pas.

Règle (voir `planning/adjust-collisions.ts`) :

- L'**intake** garde sa position (contrainte physiologique forte : l'estomac est synchronisé avec l'effort)
- L'**aid_station** garde sa position (contrainte géographique : on passe au km X, point)
- Le **check_in** se décale de **+2 min**

Le décalage peut créer une nouvelle collision avec un event posé un peu plus loin → on itère jusqu'à `MAX_COLLISION_PASSES` (3) pour éviter les cascades infinies. Si après 3 passes la collision persiste, on l'accepte (cas extrême, rare en pratique).

**Limites connues** :

- Pas de gestion des collisions same-type post-décalage (deux check-ins co-déplacés au même minute). En pratique non rencontré car deux check-ins ne sont jamais à la même minute en sortie de mergeEvents.
- Le décalage est unidirectionnel (+2 min seulement, jamais -2 min). Si un check-in colle au tout dernier event d'une course très courte, il pourrait passer après la fin théorique. Cas de bord toléré pour le MVP.

## Étape 9 — Merge d'events proches

Si deux events sont à moins de **3 minutes** d'écart après placement, les fusionner en une seule notif :

```typescript
function mergeCloseEvents(events: PlannedEvent[]): PlannedEvent[] {
  const merged: PlannedEvent[] = [];
  let i = 0;
  while (i < events.length) {
    const current = events[i];
    const next = events[i + 1];
    if (next && next.scheduled_at_minute - current.scheduled_at_minute < 3) {
      merged.push(combineEvents(current, next));
      i += 2;
    } else {
      merged.push(current);
      i += 1;
    }
  }
  return merged;
}
```

Cas spéciaux :

- Ne jamais merger un check-in avec un intake (nature différente, interaction différente en notif)
- Ne jamais merger un event de ravito avec un autre (le ravito doit être distinct)
- Si plus de 2 events dans une fenêtre de 3 min, faire plusieurs passes de merge

## Étape 10 — Tri final

Trier par `scheduled_at_minute` croissant. Assigner un ID unique (`uuid v4`) à chaque event final.

## Re-planning à la pause / au redémarrage

Le moteur lui-même reste pur (mêmes entrées → mêmes sorties), mais le code appelant doit gérer deux cas où les notifs déjà programmées doivent être réémises avec un décalage temporel :

- **Pause manuelle** : `pauseRace()` annule les notifs futures (via `Race.scheduled_notification_ids`) et ouvre un segment dans `paused_segments`. À la reprise (`resumeRace()`), filtrer les `PlannedEvent` dont `scheduled_at_minute` correspond à un timestamp futur (postérieur à la fin de la pause), puis les reprogrammer avec `triggerDate = startedAt + offset_min × 60_000 + cumulPauseMs`. La durée totale des pauses cumulées (`cumulPauseMs`) est dérivée de `paused_segments`.
- **Reload de l'app pendant une course `in_progress`** : au boot, comparer les notifs déjà programmées (`Notifications.getAllScheduledNotificationsAsync()`) à celles attendues (depuis le plan en DB), et reprogrammer les manquantes. Détails dans le skill `expo-notifications-android`.

Dans les deux cas, **on ne régénère PAS le plan** : on reprogramme juste les notifs des events existants. Le plan ne change qu'à une nouvelle création de course ou à une réadaptation explicite (check-in `bad`, V2+).

## Cas limites

| Cas                              | Comportement attendu                                   |
|----------------------------------|--------------------------------------------------------|
| Durée < 90 min                   | Pas d'intake, juste 1 check-in à 30 min                |
| Pas de GPX                       | Pente médiane = 0 partout, règles de terrain désactivées |
| Inventaire vide                  | Warning critique, plan vide avec juste check-ins       |
| Aucun ravito                     | Normal, calcul d'autonomie sur toute la durée          |
| Ravito au km 0 ou au km final    | Ignorer (pas utile)                                    |
| GPX avec 0 segments              | Fallback sur mode "durée manuelle"                     |

## Tests à écrire

- Profil standard + course 3h plate sans ravito → X events à intervalles réguliers
- Même course mais avec 1 ravito au milieu → events de ravito insérés correctement
- Course avec grosse montée à mi-parcours → intakes anticipés avant
- Inventaire vide → warning + plan avec juste check-ins
- Session type `competition` → check-in toutes les 45 min, seuils d'alerte resserrés
- `first_intake_after_min` override à 20 → premier intake bien à T+20
- Deux events à 2 min d'écart → un seul event mergé en sortie
