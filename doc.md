# Trail Nutrition App — Doc de cadrage

## 1. Problème à résoudre

En trail long (3h+), la nutrition et l'hydratation sont des variables critiques mais mentalement coûteuses à gérer : quand boire, combien, quoi manger, quand prendre le prochain gel. Les solutions actuelles sont soit :

- **Trop rigides** (guide Suunto statique, chiant à configurer, aucune adaptation en course)
- **Trop génériques** (apps de running qui ne font pas le suivi nutritionnel granulaire)
- **Manuelles** (timer basique, au doigt mouillé)

**Ce qu'on veut** : une app perso qui connaît mon profil, mon inventaire réel embarqué, adapte le plan à la course du jour, me ping au bon moment, et apprend de comment je me sens pendant l'effort.

---

## 2. Concept produit

Une app mobile **offline-first** qui, pour chaque course, génère un **plan nutritionnel dynamique** sous forme de notifications locales, avec un système de check-in minimaliste pour valider / signaler un problème / ajuster.

Trois moments clés :

1. **Avant la course** : je rentre durée estimée, conditions (température, D+), et j'indique ce que j'ai réellement sur moi (nombre de gels, barres, volume liquide). L'app génère le planning.
2. **Pendant la course** : notifs timestampées ("dans 5min : 150ml d'eau + 1 gel"), je coche quand c'est fait, check-ins périodiques sur l'état ("ça va ? estomac OK ?").
3. **Après la course** : résumé (ce que j'ai réellement ingéré vs prévu, corrélé au ressenti), pour apprendre et affiner le profil.

---

## 3. Scope

### MVP (objectif v1)

- [ ] Profil utilisateur unique (poids, besoins horaires g glucides + ml eau, pace sur plat)
- [ ] Bibliothèque `FoodItem` avec seed de base (sport + non-sport : compote, gâteaux apéro, etc.)
- [ ] Création d'une course (durée, intensité, température, inventaire embarqué, **ravitos prévus**)
- [ ] **Import GPX** : parsing du fichier, extraction du profil d'élévation
- [ ] **Profil temps/effort** : estimation du temps de passage à chaque km via fonction de Tobler, calibrée sur la pace sur plat de l'utilisateur
- [ ] **Ravitos par km** : saisie en km, conversion auto en minute estimée
- [ ] Visualisation du profil d'élévation avec ravitos et intakes projetés
- [ ] Génération d'un planning **tenant compte du relief** (pas de gros solide en montée raide, etc.)
- [ ] Écran "course en cours" avec timeline des événements à venir
- [ ] **Logging par swipe** : droite = pris, gauche = sauté (log simple)
- [ ] **Alerte de dérive** si plusieurs skips consécutifs (déficit cumulé)
- [ ] Check-in ressenti toutes les 45–60 min (3 choix rapides)
- [ ] Résumé post-course (prévu vs réel, ressenti global) + **calibration du facteur de pace personnel**
- [ ] Persistance 100% locale

### Plateformes ciblées

- **Android uniquement** (téléphone perso)
- **Solana Seeker / dApp Store** comme piste de distribution secondaire (à explorer en v2, ne contraint pas l'archi puisque le dApp Store accepte des APK standards)
- iOS : pas prévu

### V2 et au-delà

- **GPS temps réel + map-matching** : recalage du planning pendant la course selon position réelle (avance/retard sur le pronostic), replanification des notifs à la volée
- Suggestions bonus dynamiques ("tu es en avance sur l'hydrat', pousse un peu plus")
- Historique multi-courses + tendances + apprentissage auto du facteur de pace
- Profils multiples (entraînement, course longue, ultra)
- Import de recettes / gels custom (avec leurs macros)
- Export des données (CSV, GPX tags)
- Apple Watch / Wear OS companion (la vraie killer feature)

### Explicitement hors scope

- Cloud sync / multi-device
- Social / partage
- Coaching plan d'entraînement (pas le sujet)
- Tracking de l'effort en lui-même (Suunto / Garmin font ça bien)

---

## 4. Stack technique

### Choix : **React Native + Expo (TypeScript)**

**Pourquoi :**

- Écosystème déjà connu (React/Next via Kadence)
- `expo-notifications` gère parfaitement les notifs locales programmées, même app fermée
- `expo-sqlite` ou `AsyncStorage` pour la persistance
- Expo Go permet de tester direct sur téléphone sans build natif
- **EAS Build** pour produire un APK signé → side-load sur ton Android perso
- Cet APK est aussi le format attendu par le **Solana dApp Store** (Seeker), donc zéro friction pour une éventuelle distribution là-bas en v2

**Pourquoi pas PWA** : les notifs background sur iOS sont bridées, inutilisable pour une course de 6h en poche.

**Pourquoi pas natif pur (Swift/Kotlin)** : coût d'apprentissage trop élevé pour le gain sur ce scope.

### Librairies pressenties

- `expo-notifications` — notifs locales programmées
- `expo-sqlite` — DB locale (plus robuste qu'AsyncStorage pour les logs)
- `expo-document-picker` — import du fichier GPX depuis le téléphone
- `gpx-parser-builder` ou `@we-gold/gpxjs` — parsing XML du GPX
- `react-native-svg` — rendu du profil d'élévation (Recharts est web-only, à éviter)
- `victory-native` *(optionnel)* — si on veut un graphe out-of-the-box plutôt qu'un rendu SVG custom
- `zustand` ou Context API — state management léger
- `date-fns` — manipulation des timestamps
- `react-native-reanimated` + `react-native-gesture-handler` — gestes de swipe pour le logging

---

## 5. Modèle de données

### `Profile` (un seul par utilisateur au MVP)

```
{
  weight_kg: number,
  carbs_per_hour_g: number,         // défaut 60, range 30-90
  fluid_per_hour_ml: number,         // défaut 500, range 300-800
  sodium_per_hour_mg: number,        // défaut 500
  flat_pace_min_per_km: number,      // pace sur plat en min/km, base pour Tobler
  pace_calibration_factor: number,   // ajusté course après course (défaut 1.0)
  preferences: {
    gel_tolerance: 'high' | 'medium' | 'low',
    solid_food_tolerance: 'high' | 'medium' | 'low'
  }
}
```

### `FoodItem` (bibliothèque perso de ce qu'on consomme)

```
{
  id: string,
  name: string,                     // "Gel SIS Orange", "Barre Maurten"
  type: 'gel' | 'bar' | 'drink_mix' | 'real_food' | 'water',
  carbs_g: number,
  sodium_mg: number,
  weight_g?: number,                // gels, barres, solides
  volume_ml?: number,               // liquides (flask, gourde, mix)
  notes?: string
}
```

**Invariant** : au moins un parmi `weight_g` et `volume_ml` doit être renseigné (validation TS au runtime). Un gel a `weight_g` uniquement, une flask iso a `volume_ml` uniquement, une compote en gourde peut avoir les deux. Cette distinction permet d'agréger correctement les totaux ingérés post-course (g de solide vs ml de liquide).

### `Race` (une course / sortie)

```
{
  id: string,
  created_at: timestamp,
  name?: string,
  session_type: 'plaisir' | 'long' | 'dur' | 'test' | 'competition',
  gpx_track?: GPXTrack,              // présent si import GPX
  estimated_duration_min: number,    // calculé depuis GPX si dispo, sinon manuel
  intensity: 'easy' | 'moderate' | 'hard',  // dérivé du session_type par défaut, overridable
  temperature_c: number,
  humidity_high: boolean,            // défaut false
  exposure: 'sun' | 'shade' | 'variable',
  terrain_type: 'road' | 'rolling' | 'mixed_trail' | 'technical' | 'alpine',
  inventory: [{ food_item_id, quantity }],
  refill_in_nature: boolean,         // fontaine/refuge/gîte hors ravitos officiels
  aid_stations: [AidStation],        // ravitos prévus sur le parcours
  overrides?: RaceOverrides,         // présent si section avancée utilisée
  scheduled_start_at: timestamp,     // heure prévue saisie à l'étape 1, sert seulement au pré-remplissage
  started_at: timestamp | null,      // tap "C'est parti" — t0 réel des notifs
  ended_at: timestamp | null,        // stop course (completed ou abandoned)
  paused_segments: [{ from: timestamp, to: timestamp | null }],  // pauses manuelles, to=null si pause en cours
  scheduled_notification_ids: string[],  // ids retournés par expo-notifications, pour annulation
  status: 'planned' | 'in_progress' | 'completed' | 'abandoned'
}
```

**Notes sur les états temporels** :

- `scheduled_start_at` est purement indicatif (pré-remplissage du formulaire). Les notifs ne sont **pas** programmées à cette heure.
- `started_at` est l'instant du tap "C'est parti" sur l'écran de course : c'est ce moment qui déclenche le batch de `scheduleNotificationAsync`. Tant que `started_at === null`, la course est en `status = 'planned'`.
- `paused_segments` : une pause manuelle (bouton dédié) crée un segment ouvert (`to: null`). À la reprise, on ferme le segment et on reprogramme les notifs futures avec un décalage égal à la durée de la pause. Pas de détection automatique d'inactivité au MVP.
- `scheduled_notification_ids` est rempli au démarrage et utilisé pour annuler proprement à `completed`/`abandoned` ou pendant une pause.

### `RaceOverrides` (paramètres avancés par course)

```
{
  carbs_per_hour_g?: number,         // override du profil pour cette course
  fluid_per_hour_ml?: number,
  first_intake_after_min?: number,   // défaut 30
  check_in_frequency_min?: number    // défaut 50
}
```

### `GPXTrack` (profil du parcours, dérivé du GPX)

```
{
  total_distance_km: number,
  total_elevation_gain_m: number,
  total_elevation_loss_m: number,
  // échantillonnage du tracé à intervalles réguliers (ex. tous les 100m)
  segments: [{
    km: number,                      // distance cumulée
    elevation_m: number,
    gradient: number,                // pente moyenne sur le segment (-1.0 à +1.0)
    estimated_time_min: number       // temps de passage estimé via Tobler × calibration
  }]
}
```

### `AidStation` (ravito prévu)

```
{
  id: string,
  at_km: number,                     // position en km sur le parcours
  estimated_at_minute: number,       // dérivé depuis GPXTrack (si présent) ou estimation linéaire
  name?: string,                     // "Ravito km 25"
  available: {
    water: boolean,
    isotonic: boolean,
    solid_food: boolean,             // présence de solide (fruit, gâteau...)
    refill_possible: boolean         // je peux remplir mes flasks
  }
}
```

### `PlannedEvent` (généré par le moteur de planning)

```
{
  id: string,
  race_id: string,
  scheduled_at_minute: number,      // offset depuis started_at
  type: 'intake' | 'check_in' | 'aid_station' | 'fluid_reminder',
  payload: {
    // intake "single" — output direct du placement, un seul item
    food_item_id?: string,
    quantity?: number,
    volume_ml?: number,
    // intake "merged" — produit par merge.ts quand 2+ intakes sont < 3 min apart
    items?: IntakeItem[],
    // aid_station
    aid_station_id?: string,
    aid_phase?: 'approaching' | 'arrived',
    // fluid_reminder
    target_volume_ml?: number
  }
}
```

### `IntakeItem`

```
{
  food_item_id: string,
  quantity: number,
  volume_ml?: number
}
```

**Invariant payload pour les events `type === 'intake'`** : un payload utilise **soit** les champs flat (`food_item_id` + `quantity`), **soit** le tableau `items[]`, **jamais les deux à la fois**. Les intakes ne portent que des **solides** (gel, bar, real_food) — les liquides (water, drink_mix) sont gérés par les `fluid_reminder`. Les events `check_in` ont un payload vide ; les events `aid_station` ne portent que `aid_station_id` + `aid_phase` ; les events `fluid_reminder` portent `target_volume_ml`.

`scheduled_at_minute` est un offset par rapport à `Race.started_at` (donc inconnu tant que la course n'est pas démarrée). Le moteur génère le plan avant le départ, mais la conversion en timestamps absolus pour `scheduleNotificationAsync` se fait au tap "C'est parti".

### `EventLog` (ce qui a été réellement fait)

```
{
  id: string,
  planned_event_id?: string,        // null si action spontanée
  logged_at: timestamp,
  status: 'done' | 'skipped' | 'modified',
  feeling?: 'good' | 'meh' | 'bad',  // pour les check-ins
  notes?: string
}
```

---

## 6. Moteur de planning

### Principes de base

Règles nutritionnelles standards pour du trail :

- **Glucides** : 60–90 g/h selon intensité et tolérance (commencer bas, monter avec l'entraînement)
- **Hydratation** : 400–800 ml/h selon température et effort
- **Sodium** : 300–700 mg/h, critique au-delà de 3h et par chaleur
- **Fréquence d'ingestion** : mieux vaut petit et souvent que gros d'un coup — viser un intake toutes les 20–30 min
- **Première heure** : intake réduit (l'estomac est encore sous adrénaline)

### Règles de terrain (quand un GPX est présent)

- **Montée raide** (pente > 10%) : pas de solide dense, privilégier gel ou liquide sucré ; anticiper les calories **30-45 min avant** l'ascension
- **Descente technique** (pente < -8%) : pas d'intake (estomac secoué), eau seule si vraiment besoin
- **Sections roulantes** (pente entre -3% et +3%) : fenêtre idéale pour solides et ravitaillement structuré
- **Exposition** (info non dispo dans GPX standard, ignorée au MVP) : à affiner plus tard

### Estimation du temps de passage — fonction de Tobler

Pour chaque segment du GPX, on calcule une vitesse de marche/course modulée par la pente via la fonction de Tobler :

```
W(s) = 6 × exp(-3.5 × |s + 0.05|)    // W en km/h, s = pente en ratio
```

Cette formule donne la vitesse en descente légère (pente ~-5%) comme vitesse max, et chute rapidement en fort dénivelé. Elle est pensée pour la randonnée ; pour un trail/coureur, on la **calibre** avec la pace sur plat de l'utilisateur :

```
vitesse_segment = W(pente) × (vitesse_plat_user / W(0)) × facteur_calibration_perso
```

Le `facteur_calibration_perso` part de 1.0 et est ajusté après chaque course selon l'écart entre temps prévu et temps réel.

### Mapping `session_type` → paramètres dérivés

Le type de sortie choisi à la création détermine des défauts cohérents sur toute la chaîne. L'utilisateur peut overrider via la section avancée.

| session_type   | intensity | alertes dérive | check-in freq | overrides débloqués |
|----------------|-----------|----------------|---------------|---------------------|
| `plaisir`      | easy      | souples        | 60 min        | non                 |
| `long`         | moderate  | normales       | 50 min        | non                 |
| `dur`          | hard      | normales       | 45 min        | non                 |
| `test`         | moderate  | normales       | 40 min        | oui                 |
| `competition`  | hard      | renforcées     | 45 min        | non                 |

"Alertes renforcées" en compétition = seuil déclenché dès **1 skip consécutif** et déficit > 20% au lieu de 30%.

### Premier check-in précoce

Puisqu'on ne demande plus "forme du jour" au départ (redondant et mal calibré, voir section 9), le **premier check-in est programmé plus tôt que les suivants** : **30 min après le départ**, vs 45-50 min pour les suivants.

Logique de réadaptation si ce premier check-in remonte `😐` (meh) ou `😖` (bad) :

- Réduction de **10-15%** des intakes de la prochaine heure (l'estomac n'est pas prêt)
- Bascule automatique des solides prévus sur l'heure suivante vers du liquide ou gel
- Check-in suivant reprogrammé à **30 min** au lieu de la fréquence normale
- Une fois deux check-ins consécutifs remontés `😀` (good), retour au plan nominal

Cette logique ne s'applique pas au `session_type = 'competition'` où on considère que l'utilisateur assume l'intensité et que seules les alertes de dérive classiques jouent.

### Algo de génération (pseudo)

```
1. Si GPX fourni :
   - Parser, rééchantillonner à 100m
   - Calculer pente de chaque segment
   - Appliquer Tobler × calibration → temps de passage cumulé par km
   - Convertir aid_stations.at_km en estimated_at_minute
   sinon :
   - Utiliser estimated_duration_min saisi manuellement
   - Pas de modulation terrain dans la suite

2. Calculer les taux effectifs (rationnement)
   → target rates = profil × modificateurs (intensité, température…)
   → effective rates = min(target, (inventaire + ravitos) / durée × 60)
   → le plan reflète l'inventaire réel, pas les cibles théoriques
   → en cas d'insuffisance, l'app rationne et signale l'écart (warnings 'carbs_rationing', 'fluid_rationing')

3. Prendre en compte les ravitos
   → le planning calcule ce qu'il faut emporter entre deux ravitos
   → au passage d'un ravito, "recharge" virtuelle de l'inventaire si refill possible
   → un event spécial est placé à chaque ravito ("flasks à remplir",
     "manger un truc solide sur place")

4. Générer les rappels fluides en parallèle des intakes solides
   → les intakes ne portent que des solides (gel, bar, real_food)
   → les fluid_reminders sont un flux parallèle (premier à T+15, puis toutes les 30 min)
   → quantité par rappel = effective_fluid_per_h × 0.5

5. Découper la course en fenêtres de 20 min
   → skip la première fenêtre (démarrage)

6. Pour chaque fenêtre, placer l'item optimal :
   - si GPX : consulter la pente médiane de la fenêtre
     → montée raide : forcer gel/liquide, décaler le solide en amont
     → descente technique : décaler l'intake hors fenêtre
   - alterner solide / gel / liquide pour éviter l'écœurement
   - prioriser les items les plus caloriques en début/milieu
   - garder un buffer pour la fin (coups de moins bien)

7. Insérer des check-ins toutes les 45-60 min, décalés des intakes

8. Merge des événements proches
   → si deux events sont à < 3 min d'écart, les fusionner en une seule notif
     ("150ml eau + 1 gel") pour éviter le spam

9. Retourner la liste triée par timestamp
```

### Calibration post-course

Après chaque course terminée, comparer le temps réel au temps prévu pour chaque segment (ou au total si pas de GPS live). Ajuster `pace_calibration_factor` via une moyenne mobile pondérée (poids plus fort aux courses récentes). Au MVP : mise à jour simple à la fin de chaque course avec confirmation de l'utilisateur.

### Adaptation en temps réel (V2)

Si un check-in remonte "bad" → réduire le prochain intake solide, basculer sur liquide.
Si plusieurs "skipped" consécutifs → alerter sur le déficit cumulé.

---

## 7. Flow utilisateur

### Setup initial (une fois)

1. Écran d'onboarding : poids, objectifs types
2. Création de la bibliothèque `FoodItem` (les 5–10 trucs qu'on utilise réellement)

### Avant une course — template de création

Flow en 6 étapes séquentielles, volontairement court pour le cas standard. L'étape 6 (overrides) n'apparaît que si le type de sortie le justifie ou si l'utilisateur ouvre les paramètres avancés.

**Principe directeur** : pouvoir créer une sortie en **30 secondes** quand on duplique une précédente, en **~1 min** pour une création neuve. Bouton "Dupliquer une sortie précédente" proposé en haut de l'écran dès qu'il existe au moins un historique.

#### Étape 1 — Identification

- **Nom de la sortie** *(optionnel, auto-généré sinon)*
- **Date et heure de départ prévue** — défaut : maintenant + 1h

#### Étape 2 — Parcours

- **As-tu un tracé GPX ?** *(switch de flow)*
  - **Si oui** : sélection du fichier, l'app calcule auto distance, D+, D-, profil temps
  - **Si non** :
    - Distance prévue (km)
    - Dénivelé positif estimé (m)
    - Durée estimée (auto-suggérée via pace du profil × coef D+, modifiable)
    - Type de terrain dominant (route / roulant / trail mixte / trail technique / haute montagne)

#### Étape 3 — Conditions

- Température moyenne prévue (°C) — défaut 15°C
- Humidité élevée ? (oui/non) — défaut non
- Exposition (soleil direct / ombre majoritaire / variable)

#### Étape 4 — Type de sortie

Une seule question, un seul tap. L'intensité, la fréquence des check-ins et les seuils d'alerte en découlent automatiquement (voir tableau section 6).

- Sortie plaisir
- Entraînement long
- Entraînement dur
- Test nutrition *(ouvre automatiquement le panneau "Paramètres avancés" rattaché à cette étape)*
- Course / Compétition *(alertes renforcées)*

##### Panneau "Paramètres avancés" (rattaché à l'étape 4)

Repliable. Ouvert automatiquement si `session_type = 'test'`, accessible sinon via un bouton "Paramètres avancés" sur l'écran de l'étape 4. Ne compte **pas** comme une étape distincte du flow.

- Glucides/heure spécifique (override du profil)
- Eau/heure spécifique (override du profil)
- Premier intake après X minutes (défaut 30)
- Fréquence des check-ins (override du défaut dérivé du type)

#### Étape 5 — Ravitaillements

- **Y a-t-il des ravitos sur le parcours ?** *(switch)*
- Si oui, pour chaque : km / nom optionnel / disponibilités (eau, iso, solide sucré, solide salé, refill flask)
- Possibilité de remplir en nature hors ravitos officiels (fontaine, refuge...) — défaut non

#### Étape 6 — Inventaire embarqué

Interface : bibliothèque `FoodItem` avec recherche rapide + champ quantité pour chaque item sélectionné.

- Volume liquide total auto-calculé depuis les liquides cochés, modifiable manuellement
- Warning immédiat si l'inventaire ne couvre pas les besoins calculés (hors apport ravito)

#### Questions délibérément NON posées

- Poids / âge / VMA → dans le profil global, rien à saisir ici
- Intensité explicite → dérivée du type de sortie
- Forme du jour → redondant avec le premier check-in précoce (voir section 6)
- Discipline (trail/ultra/marathon) → déduite de la durée et du D+
- Zones de "faim" à anticiper → c'est précisément le job de l'algo

### Démarrage de la course

L'écran de course présente un gros bouton **"C'est parti"**. Tant qu'il n'a pas été tapé, la course reste en `status = 'planned'` et **aucune notif n'est programmée**. Le tap fait trois choses dans l'ordre :

1. Pose `started_at = Date.now()`, passe `status` à `'in_progress'`
2. Convertit chaque `PlannedEvent.scheduled_at_minute` en timestamp absolu (`started_at + offset`) et fait le batch `scheduleNotificationAsync`
3. Stocke les `scheduled_notification_ids` retournés sur la `Race`

L'heure prévue saisie à l'étape 1 (`scheduled_start_at`) ne sert qu'à pré-remplir le formulaire et donner un point de repère ; il n'y a **pas** de démarrage automatique à cette heure.

### Pendant la course

- **Notif push** au moment prévu, avec action rapide dans la notif elle-même ("Fait" / "Passer")
- **Écran principal** si ouvert : grosse timeline verticale, événement en cours en gros au milieu, suivants dessous
- **Interaction par swipe** sur l'event actif :
  - **Swipe droite** → pris / validé (log positif, coche verte)
  - **Swipe gauche** → sauté (log négatif, pas d'alerte immédiate)
- **UI gros doigts** : zones de swipe larges (>80% de la largeur), haut contraste, une seule action primaire par écran
- **Alerte de dérive** : au bout de **2 skips consécutifs** OU d'un déficit cumulé sur la dernière heure > 30% de l'objectif, déclencher une notif haute priorité ("Attention : déficit nutritionnel, prochain intake important")
- **Check-in** : 3 gros boutons emoji (😀 😐 😖), swipe pour skip. Si "😖" → suggestion contextuelle (salé, eau, lever le pied)
- **Ravito** : notif distincte à l'approche, écran dédié listant quoi faire (remplir flask, prendre un solide, etc.)
- **Pause manuelle** : bouton dédié sur l'écran de course. `pauseRace()` annule les notifs futures (via `scheduled_notification_ids`) et ouvre un segment dans `paused_segments` (`to: null`). `resumeRace()` ferme le segment et reprogramme les notifs restantes avec un décalage temporel égal à la durée de la pause. Aucune détection automatique d'inactivité au MVP.

### Après

1. Stop course
2. Écran résumé : total ingéré réel, vs plan, graphe ressenti dans le temps
3. Notes libres ("crampe à 2h30", "gel orange pas passé")

---

## 8. Points d'attention techniques

- **Programmation des notifs en batch** : au démarrage, `scheduleNotificationAsync()` pour tous les événements d'un coup. Pas de timer JS qui tourne en background (il sera killed).
- **Action directe depuis la notif** : iOS et Android permettent des "notification categories" avec actions (Fait / Passer) sans ouvrir l'app. À implémenter early, c'est la feature qui change tout côté UX.
- **Battery** : l'app ne doit rien faire en background. Tout est précalculé. Le GPS est hors scope MVP justement pour ça.
- **Persistance robuste** : SQLite > AsyncStorage dès qu'on a du relationnel (Race → Events → Logs).
- **Time zones / changement d'heure** : stocker tous les timestamps en UTC, formater en local à l'affichage.
- **Annulation** : si la course est abandonnée, bien annuler toutes les notifs programmées restantes.

---

## 9. Décisions prises

- **Distribution** : app perso uniquement pour le moment. Side-load via APK signé (EAS Build). Pas de marketing, pas de store public. Piste secondaire : Solana dApp Store sur Seeker, à explorer en v2.
- **Plateforme** : Android uniquement. iOS hors scope.
- **GPX** : niveaux 1 à 3 intégrés au MVP (parsing, profil d'élévation, estimation temporelle via Tobler, placement intelligent des intakes selon le terrain). Le niveau 4 (GPS live + map-matching + replanification en course) est explicitement repoussé en V2+.
- **Type de sortie comme contexte principal** : l'étape 4 de la création demande le **type** de sortie (plaisir / long / dur / test / compétition), pas l'intensité. L'intensité, la fréquence des check-ins et les seuils d'alerte en sont dérivés (voir tableau section 6). Override possible dans les paramètres avancés.
- **Pas de question "forme du jour" à la création** : redondant et mal calibré (la saisie a souvent lieu la veille, l'état ressenti à J-1 n'est pas celui du départ). Remplacé par un **premier check-in précoce à 30 min**, qui capte l'état réel et déclenche une réadaptation automatique du plan si besoin.
- **Merge d'événements** : si deux events sont à < 3 min d'écart, ils sont fusionnés en une seule notif.
- **Logging** : swipe droite = pris, swipe gauche = sauté. Un skip isolé = simple log. **2 skips consécutifs** ou déficit cumulé > 30% sur la dernière heure = alerte haute priorité. En mode compétition, seuils resserrés (1 skip, 20% de déficit).
- **Ravitos** : saisis en km dans la prépa de course. Si GPX présent, le minute estimé est calculé automatiquement via le profil de temps. Events dédiés au passage (refill, solide sur place).
- **Device** : téléphone seulement, pas de compagnon montre au MVP.
- **Bibliothèque food** : seed d'items courants fourni par défaut, mais bibliothèque 100% éditable/extensible pour les items non-sport (compote, gâteaux apéro, etc.). Voir section 10.
- **Calibration de pace** : facteur multiplicatif unique par profil, ajusté à la fin de chaque course par comparaison entre temps prévu et temps réel. Formule officielle MVP : `nouveau_factor = ancien_factor × (0.7 + 0.3 × (temps_réel / temps_prévu))`. Appliquée **uniquement** aux courses `status === 'completed'` et avec confirmation utilisateur sur l'écran résumé. Les courses `abandoned` sont ignorées (données biaisées).
- **Démarrage de course manuel uniquement** : c'est le tap "C'est parti" qui déclenche le batch des notifs, pas l'heure prévue de l'étape 1. La `Race` porte `started_at`, `ended_at`, `paused_segments`, `scheduled_notification_ids` pour gérer ce cycle de vie.
- **Pause manuelle** : bouton dédié pendant la course. Annule les notifs futures et reprogramme avec décalage à la reprise. Pas de détection automatique d'inactivité.
- **`FoodItem` poids vs volume** : champs distincts `weight_g?` (gels, barres, solides) et `volume_ml?` (liquides). Au moins un des deux requis.
- **`PlannedEvent.type`** : union `'intake' | 'check_in' | 'aid_station' | 'fluid_reminder'`. Les intakes ne portent que des solides ; les `fluid_reminder` sont un flux parallèle pour l'hydratation (payload: `target_volume_ml`).
- **Fallback durée sans GPX** : `temps_estimé_min = distance_km × pace_plat_min_km + (D_plus_m / 10) + (D_moins_m / 25)`. Heuristique +1 min par 10m de D+ et +1 min par 25m de D-, simple et suffisante pour le MVP. Le mode privilégié reste l'import GPX.
- **Périmètre des "2 skips consécutifs"** : compté sur les events de type `'intake'` uniquement. Un check-in remontant `bad` ne compte pas comme un skip — il déclenche le mécanisme distinct de réadaptation (-10-15% sur l'heure suivante, bascule solides → liquides).
- **Seuil de déficit 30%** : surveillé sur **glucides** ET **fluide**, indépendamment. Si l'un des deux dérive de plus de 30% sur la dernière heure, alerte haute priorité. Sodium volontairement non surveillé en alerte (signal trop bruité).
- **Rationnement intelligent** : si l'inventaire est insuffisant, le moteur ajuste les taux effectifs à la baisse (effective rates) et génère le plan avec ce qui est faisable. Warnings `carbs_rationing` / `fluid_rationing` affichés en preview ; un dialog de confirmation est affiché avant la création si rationnement détecté.
- **Persistance des notifs après reboot Android** : non bloquant pour la phase 1. `expo-notifications` persiste normalement, et le watchdog au reload de l'app couvre les ratés. Validation empirique en phase 6 (dogfooding sur sortie réelle).

---

## 10. Bibliothèque `FoodItem` — seed initial

L'idée est de fournir une base fonctionnelle dès le premier lancement, mais que l'utilisateur puisse éditer, supprimer, ajouter sans friction. Tous les items seed sont marqués comme éditables.

### Sport — gels

- Gel SIS Go (22g glucides, 0mg sodium, 60ml)
- Gel Maurten 100 (25g glucides, 0mg sodium, 40g)
- Gel Overstim Antioxydant (20g glucides, 50mg sodium)
- Gel Decathlon Aptonia (22g glucides, 30mg sodium)

### Sport — barres & solides

- Barre Maurten Solid 160 (40g glucides)
- Barre Clif (40g glucides, 150mg sodium)
- Barre Decathlon Aptonia (30g glucides)

### Sport — boissons

- Eau plate (0g, 0mg, 500ml)
- Isotonique maison (30g glucides, 300mg sodium / 500ml)
- Overstim Hydrixir (35g glucides, 400mg sodium / 500ml)

### Non-sport (à compléter au fur et à mesure)

- Compote pomme gourde (15g glucides, 90g)
- Compote pomme-banane (18g glucides)
- Tuc (petit sachet ~25g) — salé, bon pour varier
- Biscuits apéro salés (à préciser par variété)
- Banane (~25g glucides)
- Coca-Cola (10g glucides / 100ml, sodium variable)

### À ajouter par l'utilisateur

Tout ce qui revient souvent dans la musette : le système prévoit un écran simple d'ajout avec les champs minimum (nom, type, glucides, sodium, volume si liquide).

**Question ouverte : stratégie pour les items "vagues"**. Un "biscuit apéro" générique suffit, ou on veut être précis (TUC vs Belin vs Cheez-it) ? Proposition : on reste générique au seed, l'utilisateur précise s'il veut.

---

## 11. Prochaines étapes suggérées

1. Setup projet Expo + TypeScript, écran d'accueil vide
2. Modèle de données en SQLite + seeds de test (avec la bibliothèque de la section 10)
3. Écran création/édition `FoodItem` + bibliothèque
4. **Module GPX** (fonction pure, testable) : parsing → rééchantillonnage → Tobler → profil temps
5. Écran création `Race` : import GPX, preview du profil, inventaire, ravitos par km
6. Moteur de planning (fonction pure, testable isolément), avec règles de terrain
7. Écran timeline + logging par swipe
8. Intégration notifs locales + actions Fait/Passer
9. Logique d'alerte de dérive (2 skips consécutifs, déficit cumulé)
10. Écran résumé post-course + calibration du facteur de pace
11. Polish + tests sur vraie sortie
