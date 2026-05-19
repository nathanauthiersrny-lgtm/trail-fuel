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
  ├── db/              # SQLite schémas, migrations (007 timeline_plan, 008 post_race_analysis), seeds
  ├── models/          # Types TypeScript du domaine (Profile, Race, FoodItem, TimelinePlan, PostRaceAnalysis...)
  ├── engine/
  │   ├── builder/     # NEW (Phase A) : engine déterministe → TimelinePlan
  │   │                 (constants, targets, placement, safety, build-plan, timeline-plan-to-events adapter)
  │   ├── planning/    # DEPRECATED : ancien pipeline (rules engine + DSL). Conservé pour les races
  │   │                 pré-migration 007 (fallback dans RaceRuntimeScreen). À supprimer en A.5+.
  │   ├── gpx/         # GPX parsing + Tobler (réutilisé par builder)
  │   ├── runtime/     # Logique runtime (summary-stats, reschedule-diff)
  │   └── rules/       # DEPRECATED : helper du legacy planning. Idem.
  ├── services/
  │   ├── plan-enrichment/  # NEW : client HTTP /api/generate-plan + orchestrator
  │   ├── post-race/        # NEW : client HTTP /api/analyze-race + apply-proposal + build-payload
  │   ├── race-runtime/     # Notif scheduling, log-event, watchdog
  │   ├── notifications/    # Notif primitives
  │   └── knowledge-pack/   # DEPRECATED : loader du pack v1.json + overlays (legacy)
  ├── screens/         # Écrans (RaceCreation, Preview, RaceRuntime, RaceSummary…)
  ├── components/      # UI réutilisables
  └── hooks/           # Hooks React métier
assets/
  └── seed/            # JSON des FoodItem par défaut
  └── knowledge/       # DEPRECATED : v1.json + overlays. La KB vit côté companion en markdown.
```

## Architecture Phase A (TimelinePlan)

Depuis le pivot Phase A (cf. `docs/architecture-phase-a.md`), le pipeline est :

```
buildPlan() (TS pur)
  → TimelinePlan brut
  → [optionnel] enrichissement LLM via companion /api/generate-plan
  → TimelinePlan final persisté dans race.timeline_plan (migration 007)
  → timelinePlanToEvents() adapter → PlannedEvent[] consommé par le runtime
```

Post-course : `RaceSummaryScreen` peut appeler `/api/analyze-race` (companion) pour
analyser planned-vs-actual et proposer des ajustements profil. Persisté dans
`race.post_race_analysis` (migration 008) pour éviter de re-payer l'analyse.

Le companion (`trail-fuel-companion`) tient la KB markdown + les prompts Claude.

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

## Configuration runtime

- **EXPO_PUBLIC_COMPANION_URL** dans `.env.local` : URL du companion (ex: `http://192.168.X.X:3000`). Si absente, les boutons "Enrichir avec Claude" et "Analyser avec Claude" retournent une erreur gérée (l'app reste fonctionnelle offline avec le plan brut). Voir `src/services/plan-enrichment/README.md`.

## Règles importantes

- **Ne jamais** utiliser `Date.now()` directement dans `engine/` : passer l'heure courante en paramètre pour tester
- **Ne jamais** supposer qu'une notif programmée existe toujours : Android peut les drop sous pression mémoire. Reprogrammer si l'app est relancée en cours de course.
- **Ne jamais** faire tourner un `setInterval` en background pour le chrono : précalculer tous les events au départ et s'appuyer sur les notifs programmées.
- **Toujours** prévoir le cas "pas de GPX fourni" : l'app doit marcher en mode durée manuelle + fenêtres temporelles.
- **Toujours** annuler les notifs restantes quand une course passe à `abandoned` ou `completed`.
- **Préférer** `src/engine/builder/` pour toute nouvelle logique de planification. Le legacy `src/engine/planning/` reste comme fallback runtime pour les races pré-migration 007.

## Contexte perso

Projet perso, pas de CI, pas de review externe. Optimiser pour la **vitesse d'itération** et la **lisibilité**, pas pour la scalabilité ou la robustesse entreprise. Un `TODO` explicite vaut mieux qu'une abstraction prématurée.
