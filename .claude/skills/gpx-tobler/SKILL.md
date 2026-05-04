---
name: gpx-tobler
description: Use this skill when parsing GPX files, building the elevation profile, computing estimated time of passage along a track, or calibrating the pace factor. Covers the GPX XML parsing strategy, the Haversine distance formula, the resampling to fixed intervals (100m), the Tobler hiking function adapted for trail running, and the personal calibration factor logic. Trigger this whenever code touches `GPXTrack`, `segments`, `estimated_at_minute`, `flat_pace_min_per_km`, or `pace_calibration_factor`.
---

# GPX Processing & Tobler

Module de traitement d'un tracé GPX pour en dériver un profil temporel d'effort. Tout le code de ce module doit être une **fonction pure testable**, sans effet de bord ni dépendance à l'environnement React Native (pour pouvoir le faire tourner en Node pour les tests).

## Pipeline de traitement

```
GPX file → parser XML → points bruts (lat, lon, ele)
         → Haversine → distance cumulée
         → rééchantillonnage 100m → points réguliers
         → lissage d'élévation → pentes propres
         → Tobler + calibration → temps par segment
         → cumul → temps de passage estimé par km
```

## 1. Parsing

Utiliser `@we-gold/gpxjs` (léger, TypeScript natif, retour structuré). Ne pas réinventer un parser XML.

**Piège connu** : `parseGPX` s'appuie sur le `DOMParser` du browser. Ni Node (jest) ni React Native ne l'exposent natif. Toujours passer par `parseGPXWithCustomParser` avec `xmldom-qsa` comme parser — ça marche dans les deux environnements et garde l'engine pur Node-testable.

```typescript
import { parseGPXWithCustomParser } from '@we-gold/gpxjs';
import { DOMParser } from 'xmldom-qsa';

const customParse = (txt: string): Document | null =>
  new DOMParser().parseFromString(txt, 'text/xml') as unknown as Document;

const [parsed, error] = parseGPXWithCustomParser(gpxString, customParse);
if (error) throw error;
const rawPoints = parsed.tracks[0].points.map(p => ({
  lat: p.latitude,
  lon: p.longitude,
  ele: p.elevation ?? 0,
}));
```

Les champs sont `latitude`, `longitude`, `elevation` (pas `lat`/`lon`/`ele`) sur `Point`. `elevation` peut être `null` (GPX sans altitude) — le mapping ci-dessus le force à 0, ce qui est cohérent avec le fallback "Tobler(pente=0) × calibration" du cas `GPX sans élévation`.

## 2. Distance (Haversine)

Pour deux points GPS, la distance en mètres via la formule de Haversine. Nathan a déjà implémenté ça pour Kadence, réutiliser la même fonction si possible.

```typescript
const R = 6_371_000; // rayon Terre en mètres

function haversineMeters(
  a: { lat: number; lon: number },
  b: { lat: number; lon: number }
): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLon = toRad(b.lon - a.lon);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}
```

## 3. Rééchantillonnage à 100m

Les tracés GPX bruts ont une densité irrégulière (1 point/seconde d'enregistrement, donc dépendant de la vitesse). Pour avoir des pentes comparables, rééchantillonner à **intervalle fixe de 100m**.

Algo : interpoler linéairement entre deux points bruts pour placer un point tous les 100m en distance cumulée. Inclure l'élévation dans l'interpolation.

Pourquoi 100m et pas 50m ou 200m : c'est le bon compromis entre précision (un 100m raide est détectable) et bruit (sous 50m, les petits bosses et le bruit GPS deviennent dominants). Si bruit excessif, c'est le lissage qui doit le gérer, pas le rééchantillonnage.

## 4. Lissage d'élévation

Les données d'élévation GPX sont bruitées (précision GPS altimétrique mauvaise, ±5m). Appliquer un **moyenne mobile sur 5 segments** (donc 500m glissants) avant de calculer les pentes. Sans ce lissage, on obtient des pentes aberrantes (type +40% sur 100m suivis de -35%).

## 5. Calcul de pente

Pour chaque segment rééchantillonné :

```
pente = (élévation_lissée[n+1] - élévation_lissée[n]) / 100
```

Résultat en ratio (0.05 = 5%). Borner entre -0.40 et +0.40 pour éviter les valeurs aberrantes qui passeraient le lissage.

## 6. Fonction de Tobler

La fonction de Tobler donne la vitesse de marche naturelle en fonction de la pente :

```typescript
function toblerSpeedKmh(slope: number): number {
  return 6 * Math.exp(-3.5 * Math.abs(slope + 0.05));
}
```

Propriétés notables (valeurs **réelles** de la formule, vérifiables par calcul) :

- Maximum à pente = -0.05 (descente légère), soit 6 km/h exactement
- Pente 0 (plat) : ~5.04 km/h
- Pente +10% (montée) : ~3.55 km/h
- Pente -15% (descente forte) : ~4.23 km/h (plus lent que plat, logique : descente technique)

**Attention** : Tobler est pensée pour de la RANDO à pied. Pour un trail/coureur, on doit la **calibrer** avec la vitesse réelle sur plat de l'utilisateur.

## 7. Calibration personnelle

```typescript
function calibratedSpeedKmh(
  slope: number,
  userFlatSpeedKmh: number,
  calibrationFactor: number // commence à 1.0, affiné course après course
): number {
  const toblerRatio = toblerSpeedKmh(slope) / toblerSpeedKmh(0);
  return userFlatSpeedKmh * toblerRatio * calibrationFactor;
}
```

`userFlatSpeedKmh` est dérivé de `Profile.flat_pace_min_per_km` : `60 / flat_pace_min_per_km`.

### Ajustement de `calibrationFactor` post-course — formule MVP officielle

C'est la **formule de référence** pour le MVP, validée comme décision projet (voir `doc.md` section 9). Toute évolution doit passer par une mise à jour explicite de la doc.

```
ratio = temps_réel / temps_prévu
raw = ancien_factor × (0.7 + 0.3 × ratio)            // pondération : 70% ancien, 30% nouveau
nouveau_factor = clamp(raw, 0.5, 2.0)                // garde-fou contre dérive géométrique
```

Le 0.7 / 0.3 évite qu'une course exceptionnelle (mauvaise forme, conditions extrêmes) ne ruine la calibration. Proposer à l'utilisateur de valider ou de rejeter l'ajustement sur l'écran résumé post-course.

**Pourquoi le clamp [0.5, 2.0]** : la formule est **multiplicative**, donc un ratio constant > 1 sur plusieurs courses consécutives ferait croître géométriquement le facteur sans amortissement (ex. 4 courses à ratio 1.5 → factor passe de 1.0 à ~2.6). Le clamp limite le facteur à un facteur 2× dans chaque sens, ce qui couvre les cas réalistes (un coureur 2× plus lent ou plus rapide que ce que Tobler prédit, c'est déjà extrême). Si un utilisateur atteint la borne, c'est un signal qu'il faut vérifier sa pace plat saisie dans le profil — la formule corrige des écarts modérés, pas des erreurs de saisie.

**Conditions d'application** :

- Uniquement pour les courses dont `status === 'completed'`. Les courses `abandoned` sont ignorées (données biaisées par météo, casse, blessure...).
- Confirmation utilisateur obligatoire avant écriture du nouveau `pace_calibration_factor` dans le profil.

### Limites Tobler pour trail technique

Tobler sous-estime souvent le coût des descentes techniques (pierriers, racines) et surestime celui des montées pour un coureur entraîné. Pour un MVP, un seul `calibrationFactor` global suffit. En v2, envisager deux facteurs distincts (`uphill_factor`, `downhill_factor`) pour finesse.

## 8. Temps de passage par km

Une fois qu'on a la vitesse estimée par segment de 100m, on cumule les temps (temps = distance / vitesse) pour obtenir un tableau `estimated_time_min` par segment. Puis agréger par km pour l'affichage user.

## Cas particuliers

- **GPX sans élévation** : si les points n'ont pas d'altitude, fallback sur Tobler(pente=0) × calibration → équivalent à une estimation plate.
- **GPX en boucle** : le départ et l'arrivée sont au même endroit, pas de problème particulier, traiter comme un track normal.
- **GPX aller-retour** : pas de détection spéciale nécessaire, le profil montée puis descente ressortira naturellement.
- **Fichier trop gros (> 10 000 points)** : sous-échantillonner à l'entrée avant rééchantillonnage (garder 1 point sur N). Au MVP, on considère que les tracés de trail restent < 10 000 points.

## Tests à écrire

- `haversineMeters` : quelques paires de points connus (ex. Paris-Lyon ≈ 392 km, à ±1 km près)
- `resample100m` : tracé synthétique de 1 km rectiligne → 10 segments
- `toblerSpeedKmh` : valeurs attendues aux pentes de référence (0%, 5%, 10%, -5%, -15%)
- `calibratedSpeedKmh` : avec `userFlatSpeedKmh = 10` et `factor = 1.0`, pente 0 doit donner 10 km/h pile
- **Tracé réel** : parser un GPX de trail fait avec la montre Suunto et vérifier que la durée totale prédite tombe à ±15% de la durée réelle
