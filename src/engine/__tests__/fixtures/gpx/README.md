# GPX fixtures

Fichiers GPX synthétiques pour tester le pipeline d'engine. Petits, lisibles, vérifiables à la main.

Convention : 1 fixture = 1 cas géométrique pur. Pas de mélange de scénarios dans un même fichier.

## Inventaire

- `flat-1km.gpx` — 11 points alignés en latitude, élévation constante 1000m, ~1 km cumulé. Sert au calibrage du parser et du calcul Haversine.
- (à venir) `climb-1km-100m.gpx` — 1 km en montée régulière, +100m de D+ (pente moyenne ~10%).
- (à venir) `descent-1km-100m.gpx` — 1 km en descente régulière, -100m.
- (à venir) `rolling-5km.gpx` — 5 km vallonné (montées et descentes alternées).

## TODO futur

Ajouter `realistic-suunto.gpx` dérivée d'une vraie sortie Suunto pour servir de test d'intégration sur données réelles (notamment vérifier que `track.ts` sur un GPX bruité réel tombe à ±15% de la durée mesurée).
