# Trail Fuel — Guide projet

App mobile Android de nutrition pour trail long : plan nutritionnel dynamique via notifs locales, offline-first, usage perso.

**Doc produit complet** : voir `doc.md` à la racine. **Ne pas dupliquer** son contenu ici.

## Stack

- **React Native + Expo** (TypeScript strict)
- **SQLite** via `expo-sqlite` pour la persistance
- **expo-notifications** pour les notifs locales programmées
- **react-native-svg** pour le rendu du profil d'élévation (pas Recharts, web-only)
- **react-native-gesture-handler + reanimated** pour le swipe de logging
- **zustand** pour le state global léger
- **date-fns** pour les timestamps
- **@we-gold/gpxjs** pour le parsing GPX
- **expo-document-picker** pour l'import du fichier GPX
- Build : **EAS Build** → APK signé (side-load + dApp Store Solana)

## Structure cible

```
src/
  ├── db/              # SQLite schémas, migrations, seeds
  ├── models/          # Types TypeScript du domaine (Profile, Race, FoodItem...)
  ├── engine/          # Fonctions pures testables (planning, GPX, Tobler, calibration)
  ├── services/        # Notifications, stockage, état
  ├── screens/         # Écrans (RaceCreation, TimelineDuringRace, Summary...)
  ├── components/      # UI réutilisables (SwipeCard, ElevationChart, FoodPicker...)
  └── hooks/           # Hooks React métier
assets/
  └── seed/            # JSON des FoodItem par défaut
```

## Conventions

- **TypeScript strict** activé partout, pas de `any` implicite
- **Fonctions pures** pour tout ce qui est calcul (`engine/`) — elles doivent être testables sans mocks
- **Offline-first** : aucun appel réseau dans le flow principal d'une course
- **Timestamps en UTC** en base, formatage local uniquement au rendu
- **Noms de fichiers** : `kebab-case.ts` pour modules, `PascalCase.tsx` pour composants React
- **Tests** : Jest pour les fonctions pures de `engine/`. UI testée manuellement (projet perso, pas besoin de RTL pour l'instant)

## Skills disponibles

Consulter le skill adapté **avant** de toucher au domaine concerné :

- `nutrition-rules` — règles métier nutrition et règles de terrain
- `gpx-tobler` — parsing GPX, formule Tobler, rééchantillonnage
- `expo-notifications-android` — notifs locales, batch, actions, pièges Android
- `planning-engine` — algo de génération du planning

## Workflow

- Dev : `npx expo start`, scan QR avec Expo Go sur l'Android perso
- Build APK : `eas build --platform android --profile preview`
- Test fonctions pures : `npm test` (Jest)
- Avant un commit : `tsc --noEmit` + `npm test` doivent passer

## Règles importantes

- **Ne jamais** utiliser `Date.now()` directement dans `engine/` : passer l'heure courante en paramètre pour tester
- **Ne jamais** supposer qu'une notif programmée existe toujours : Android peut les drop sous pression mémoire. Reprogrammer si l'app est relancée en cours de course.
- **Ne jamais** faire tourner un `setInterval` en background pour le chrono : précalculer tous les events au départ et s'appuyer sur les notifs programmées.
- **Toujours** prévoir le cas "pas de GPX fourni" : l'app doit marcher en mode durée manuelle + fenêtres temporelles.
- **Toujours** annuler les notifs restantes quand une course passe à `abandoned` ou `completed`.

## Contexte perso

Projet perso, pas de CI, pas de review externe. Optimiser pour la **vitesse d'itération** et la **lisibilité**, pas pour la scalabilité ou la robustesse entreprise. Un `TODO` explicite vaut mieux qu'une abstraction prématurée.
