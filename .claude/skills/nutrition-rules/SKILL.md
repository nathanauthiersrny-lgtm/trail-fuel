---
name: nutrition-rules
description: Use this skill when implementing or modifying any nutritional calculation, intake planning logic, terrain-based adaptation, or when generating intake values for a trail race. Covers the reference targets for carbs/hour, fluid/hour, sodium/hour, their modifiers (intensity, temperature, humidity), and the terrain-based rules that determine what to ingest on steep climbs, technical descents, or rolling sections. Trigger this skill whenever code touches `carbs_per_hour_g`, `fluid_per_hour_ml`, `sodium_per_hour_mg`, or when deciding what food item type (gel/solid/liquid) to place in a given time window.
---

# Nutrition Rules — Trail Long

Règles de référence pour l'effort trail de 2h+. Valeurs issues de la littérature sportive standard (ISSN, pratique ultra). Toute déviation doit être justifiée par un override explicite de l'utilisateur dans `RaceOverrides`.

## Besoins horaires de référence

### Glucides

| Intensité     | Cible (g/h) | Notes                                                    |
|---------------|-------------|----------------------------------------------------------|
| easy          | 40-60       | Sortie plaisir, tolérance solide élevée                  |
| moderate      | 60-75       | Entraînement long, cible par défaut                      |
| hard          | 75-90       | Entraînement dur ou compétition < 6h                     |
| compétition ultra (>6h) | 80-100 | Nécessite un estomac entraîné, débloquer via overrides |

**Défaut profil** : 60 g/h. Plafond sans entraînement digestif spécifique : 90 g/h.

### Hydratation

Base : 500 ml/h, modulée par :

- Température > 20°C : +50 ml par degré au-dessus de 20, cap à 800 ml/h
- Température < 10°C : -50 ml par degré en dessous de 10, plancher à 300 ml/h
- Humidité haute (`humidity_high: true`) : +15% sur le total
- Exposition `sun` : +10%, `shade` : -5%, `variable` : 0

### Sodium

Base : 500 mg/h, modulée par :

- Durée > 3h : +100 mg/h
- Température > 25°C : +200 mg/h
- Humidité haute : +100 mg/h
- Plancher : 300 mg/h. Plafond : 1000 mg/h.

## Règles comportementales

### Première heure

Réduire tous les intakes de **30%** la première heure. L'estomac est sous adrénaline, absorption dégradée. Premier intake programmé à **T+30 min** par défaut, modifiable via `first_intake_after_min`.

### Rationnement (taux effectifs)

Les cibles physiologiques (carbs/h, fluid/h) sont des **objectifs**, pas des contraintes dures. Si l'inventaire + ravitos ne couvrent pas le besoin total, le moteur calcule des **taux effectifs** réduits via `computeEffectiveRates()`. Le plan est généré avec ces taux effectifs. Les cibles (target) sont conservées pour l'affichage et les warnings (`carbs_rationing`, `fluid_rationing`).

Cas spécial : `refill_in_nature === true` → le fluide n'est jamais rationné (sources d'eau naturelles).

### Flux solide / fluide découplés

Les **intakes** ne portent que des solides (gel, bar, real_food) et couvrent les besoins en glucides. Les **fluid_reminders** sont un flux parallèle (premier à T+15 min, puis toutes les 30 min) et couvrent l'hydratation. Ce découplage permet un rationnement indépendant de chaque flux.

### Fréquence d'ingestion

Viser **un intake solide toutes les 20-30 min**, un **rappel fluide toutes les 30 min**. Mieux vaut petit et souvent que massif d'un coup. Exception : pendant un ravito, un intake plus conséquent est acceptable (mode "pause").

### Fin de course

Dernière heure : maintenir les glucides (risque hypo), réduire l'eau si déjà bien hydraté pour éviter la surcharge digestive finale.

## Règles de terrain (GPX requis)

Quand un profil d'élévation est disponible, ajuster la nature de l'intake selon la pente médiane de la fenêtre de 20 min :

| Pente médiane   | Règle                                                          |
|-----------------|----------------------------------------------------------------|
| > +10%          | Pas de solide dense. Privilégier gel ou liquide sucré.         |
|                 | Anticiper les calories 30-45 min AVANT l'ascension.            |
| +3% à +10%      | Gel ou solide léger (compote). Éviter les barres denses.       |
| -3% à +3%       | Fenêtre idéale pour barres, solides, ravitaillement structuré. |
| -3% à -8%       | Intake normal, attention aux rebonds sur pierrier.             |
| < -8%           | Pas d'intake (estomac secoué). Eau seule si vraiment besoin.   |

En pratique, l'algo doit :

1. Calculer la pente médiane de chaque fenêtre de 20 min
2. Si la fenêtre est "interdite" (montée raide ou descente technique), décaler l'intake planifié vers la fenêtre précédente ou suivante la plus proche
3. Si un intake est décalé AVANT une grosse montée, augmenter sa densité calorique (les "réserves" anticipées)

## Réadaptation via check-ins

Quand un check-in remonte `meh` ou `bad` :

- Réduire de **10-15%** les intakes de la prochaine heure
- Basculer les solides prévus sur liquide ou gel
- Resserrer le check-in suivant à 30 min
- Retour au plan nominal après 2 check-ins consécutifs `good`

Exception : `session_type = 'competition'` désactive cette réadaptation automatique (l'utilisateur assume).

## Règles de skip et alertes

| Condition                                                       | Action                                    |
|-----------------------------------------------------------------|-------------------------------------------|
| 1 skip d'intake isolé                                           | Log seul                                  |
| 2 skips d'intakes consécutifs (mode normal)                     | Notif alerte haute priorité               |
| 1 skip d'intake (mode competition)                              | Notif alerte haute priorité               |
| Déficit cumulé > 30% sur la dernière heure (glucides OU fluide) | Notif alerte haute priorité               |
| Déficit cumulé > 20% (mode competition, glucides OU fluide)     | Notif alerte haute priorité               |

### Précisions importantes

- **"Skip consécutif"** : compte uniquement sur les events de `type === 'intake'`. Les check-ins (`type === 'check_in'`) et les ravitos (`type === 'aid_station'`) n'entrent pas dans le décompte. Un check-in `bad` ne compte **pas** comme un skip — il déclenche le mécanisme de réadaptation décrit plus haut, qui est un canal indépendant.
- **Seuil de déficit 30%** : surveillé séparément sur **glucides** (g) et **fluide** (ml). Si l'un des deux compteurs dérive de plus de 30%, alerte. Pas besoin que les deux dérivent en même temps.
- **Sodium non surveillé en alerte** : le retour utilisateur sur la consommation de sodium (gels, iso) est trop bruité pour servir de signal d'alerte. Le sodium reste calculé et affiché dans le résumé post-course, mais ne génère pas de notif de dérive.

## Fallback durée sans GPX

Quand l'utilisateur n'importe pas de GPX (étape 2 du flow), la durée totale prévue est estimée à partir de la distance, du dénivelé positif et du dénivelé négatif saisis manuellement, calibrée sur la pace plat du profil :

```
temps_estimé_min = distance_km × pace_plat_min_km
                 + (D_plus_m / 10)
                 + (D_moins_m / 25)
```

Soit **+1 min par tranche de 10m de D+** et **+1 min par tranche de 25m de D-**. Heuristique standard qui évite la sous-évaluation sur les profils en descente nette, suffisante pour le MVP, à raffiner si la calibration empirique montre un écart systématique. À noter : sans GPX, les règles de terrain (section précédente) sont désactivées et la pente médiane est considérée comme nulle partout dans le moteur de planning.

Le mode privilégié reste l'import GPX, qui passe par Tobler + calibration personnelle (voir skill `gpx-tobler`).

## Valeurs à ne jamais hardcoder

Les cibles horaires et modificateurs doivent **toujours** être lus depuis le `Profile` ou les `RaceOverrides`. Ne jamais écrire `60` en dur dans le moteur. Les seules constantes acceptables dans le code sont les **bornes de sécurité** (plafonds/planchers) et les **coefficients de modification** (+50 ml/°C, -30% première heure, etc.) qui sont des paramètres du modèle nutritionnel, pas des préférences utilisateur.
