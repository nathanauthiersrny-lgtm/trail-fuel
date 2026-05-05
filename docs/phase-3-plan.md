# Phase 3 — Runtime course Trail Fuel

## Context

Phase 0–2 sont terminées (220 tests, écrans création course OK, plan généré OK). Le canary notifs a validé le 5 mai que le batch scheduling marche sur device, écran verrouillé inclus. La course cible est dimanche 10 mai 10h (23km / 1100D+, ~3-4h). Deadline interne : **vendredi 8 mai au soir** pour APK installable, en vue d'une sortie test samedi 9.

Cette phase implémente le runtime de course : démarrer, recevoir des notifs aux bons moments, logger les intakes via swipe ou via actions dans la notif elle-même, terminer ou abandonner, voir un résumé minimal. **Le plan reste figé** une fois la course démarrée — pas de réadaptation runtime, pas de calibration auto, pas d'alerte de dérive (reportés V2/phase 4-5).

Décisions tranchées pendant le planning :
- Check-ins : 3 boutons emoji 😀 😐 😖 (sans suggestions contextuelles V2)
- Fin de course : 1 bouton + Alert avec choix Terminée/Abandonnée/Annuler
- Watchdog cold reboot : ajouté dans le buffer J3
- Actions Done/Skip directement dans la notif : oui (canon produit doc.md)
- Swipe gesture-handler+reanimated sur l'écran runtime : oui (canon produit)

## Architecture clé

**Persister les PlannedEvents en DB au tap "C'est parti"** (table `planned_events`). Le plan est figé à ce moment, c'est la source de vérité pour le runtime, le résumé, et le watchdog cold reboot. Coût : 1 table + 1 repo + une transaction au démarrage.

**Persister les logs d'événements** dans une table `event_logs` séparée, avec un UNIQUE index sur `planned_event_id` qui rend `INSERT OR IGNORE` idempotent (couvre le cas "user tape Done dans la notif puis re-swipe Done dans l'app").

**Listener notif global** monté dans `app/_layout.tsx` au boot, avec `getLastNotificationResponseAsync()` pour couvrir le cas cold start (notif tap quand app fermée).

**Composant swipe spécifique aux intakes/fluid_reminders** (pas d'abstraction `SwipeableContainer` générique). Réutilise gesture-handler v2 + reanimated v4 déjà en deps. Variante grisée/désactivée si déjà loggé. Fallback simple "boutons gros" préparé mentalement si reanimated v4 + RN 0.81 fait des siennes.

**Pas d'état zustand "current race"** : le hook `useActiveRace(raceId)` lit la DB directement (DB = source de vérité, simple). Re-fetch après log via `useFocusEffect` + invalidation locale.

## Fichiers à créer

### DB / engine

- `src/db/migrations/004-runtime.ts` — tables `planned_events` (id, race_id, scheduled_at_minute, scheduled_at_ms, type, payload_json, notification_id, order_index) et `event_logs` (id, race_id, planned_event_id, logged_at, status `done|skipped|ack` pour check-ins, feeling `good|meh|bad?`)
- `src/db/migrations/index.ts` — modifier pour intégrer `migration004Runtime`
- `src/db/repos/planned-event-repo.ts` — `createBatch`, `listByRace`, `getByNotificationId`, `getByEventId`, `attachNotificationIds`, `clearNotificationIds`
- `src/db/repos/event-log-repo.ts` — `insertLog` (INSERT OR IGNORE), `listByRace`, `hasLogForEvent`, `countByStatus`
- `src/models/event-log.ts` — type `EventLog` + `EventLogStatus`

### Services notifications

- `src/services/notifications/setup.ts` — `ensurePermissionsAndChannels()` : channels `intake` HIGH, `checkin` DEFAULT, `alert` MAX. Idempotent.
- `src/services/notifications/category.ts` — `registerNotificationCategories()` : déclare `intake_action` (boutons "✓ Fait" / "✗ Passer") et `checkin_action` (3 boutons emoji `good`/`meh`/`bad`).
- `src/services/notifications/format-content.ts` — formatters purs (testables Jest) : `buildIntakeNotificationContent(event, foodItemsById)`, `buildCheckInContent(event)`, `buildAidStationContent(event, aidStationsById)`, `buildFluidReminderContent(event)`. Tous ajoutent `data: { event_id, race_id, type }` pour le routing.
- `src/services/notifications/schedule-batch.ts` — `scheduleEventBatch({ events, race, foodItemsById, aidStationsById, startedAt })` : filtre les events déjà passés (>now+5s), schedule chaque event avec `categoryIdentifier` adapté, retourne `[{ event_id, notification_id }]`. Robust à l'échec unitaire (try/catch par event).
- `src/services/notifications/cancel-remaining.ts` — `cancelRemainingNotifications(db, raceId)` : query events futurs et leurs `notification_id` → cancel par id (plus précis que cancelAll).

### Services race-runtime

- `src/services/race-runtime/start-race.ts` — orchestration "tap C'est parti" : 2 transactions DB encadrant le batch scheduling (1: status=in_progress + insert events, 2: attach notification_ids + update Race.scheduled_notification_ids). Guard `race.status !== 'planned'` pour bloquer le double-tap.
- `src/services/race-runtime/end-race.ts` — `endRace({ db, raceId, status: 'completed'|'abandoned', now })` : update status + ended_at + cancel des notifs restantes.
- `src/services/race-runtime/log-event.ts` — `logEvent({ db, raceId, plannedEventId, status, feeling?, now })`. Idempotent via UNIQUE.
- `src/services/race-runtime/watchdog.ts` — `verifyAndRescheduleIfNeeded({ db, race, plan, foodItemsById, aidStationsById, now })` : appelé au mount de RaceRuntimeScreen si `status='in_progress'`. Compare `getAllScheduledNotificationsAsync()` aux events futurs en DB ; reschedule les manquants.

### UI / hooks / composants

- `src/services/notification-handler.ts` — listener global. Monté dans `_layout.tsx`. Gère `addNotificationResponseReceivedListener` (action Done/Skip → log direct, tap simple → router.navigate vers `/race/[id]?focus=...`). Aussi `getLastNotificationResponseAsync()` au boot pour cold start.
- `src/hooks/use-active-race.ts` — charge race + planned_events + event_logs depuis DB. Calcule `currentEvent` (premier event futur ou actif within 30s). Refresh sur focus + tick 1s pour avancer le curseur.
- `src/components/runtime/event-description.ts` — extrait `describeEvent` depuis `TimelinePreview` vers fonction pure réutilisable (TimelinePreview, EventCard, SummaryScreen).
- `src/components/runtime/IntakeSwipeCard.tsx` — gesture pan + reanimated translateX, threshold 30% width, spring back, haptics medium sur trigger. Variante grisée si `alreadyLogged`. Used pour `intake` et `fluid_reminder`.
- `src/components/runtime/CheckInCard.tsx` — 3 boutons emoji 😀 😐 😖 grands (≥80dp height). Tap → `logEvent({ status: 'ack', feeling })`.
- `src/components/runtime/AidStationCard.tsx` — read-only info (nom ravito, km, dispo eau/iso/solide). Pas d'action.
- `src/components/runtime/EventCard.tsx` — wrapper qui dispatch sur le type vers le bon composant.
- `src/screens/RaceRuntimeScreen.tsx` — état `planned` : gros bouton "C'est parti". État `in_progress` : header chrono, currentEvent en grand, liste des suivants compacts (réutilise structure de `TimelinePreview`), liste des passés grisés avec leur statut log, bouton "Fin de course" en bas qui ouvre Alert (Terminée/Abandonnée/Annuler).
- `src/screens/RaceSummaryScreen.tsx` — header (durée réelle, status), stats (intakes pris/sautés/non répondus, fluid, check-ins), liste verticale event-par-event (heure prévue, type icon, description, statut log), bouton "Retour".
- `app/race/[id].tsx` — route runtime, re-export RaceRuntimeScreen
- `app/race/[id]/summary.tsx` — route summary, re-export RaceSummaryScreen

### Tests

- `src/__tests__/notifications-format-content.test.ts` — formatters purs (4 types × cas merged/non-merged)
- `src/__tests__/event-log-repo.test.ts` — idempotence INSERT OR IGNORE
- `src/__tests__/start-race.test.ts` — orchestration avec mock léger expo-notifications

## Fichiers à modifier

- `src/db/migrations/index.ts` — ajouter migration004Runtime à l'array
- `app/_layout.tsx` — wrap dans `<GestureHandlerRootView>`, monter le notification-handler au mount, ajouter Stack.Screen pour `race/[id]` et `race/[id]/summary`
- `index.js` — vérifier que `import 'react-native-gesture-handler'` est en première ligne (requis par RNGH)
- `app.json` — ajouter `"SCHEDULE_EXACT_ALARM"` dans `android.permissions`
- `app/index.tsx` (HomeScreen) — section "Course" qui affiche selon le statut de la dernière race : `planned` → "Démarrer cette course" → `/race/[id]` ; `in_progress` → "Reprendre la course" → `/race/[id]` ; `completed`/`abandoned` récente → "Voir le résumé" → `/race/[id]/summary`
- `src/screens/PreviewScreen.tsx` — après `createRace`, `router.push('/race/' + race.id)` au lieu de retour Home
- `src/components/TimelinePreview.tsx` — extraire `describeEvent` vers `src/components/runtime/event-description.ts`, importer depuis là

## Découpage par jour

### Jour 1 (mer 6/05) — DB + scheduling sans UI

1. Migration 004 + repos (`planned-event-repo`, `event-log-repo`) + tests Jest minimaux (~2h)
2. Services notifications purs (`format-content`, `category`, `setup`) + tests formatters (~2h)
3. `schedule-batch` + `cancel-remaining` (~2h)
4. Orchestration (`start-race`, `end-race`, `log-event`) + test e2e via extension du canary `dev/notification-test.tsx` (~2h)

**Critère J1** : depuis le canary dev, je peux lancer une "fausse course" et voir des notifs partir + des logs en DB.

### Jour 2 (jeu 7/05) — UI runtime

1. Bootstrap (`_layout.tsx` GestureHandlerRootView + routes + listener global, `notification-handler.ts`, app.json SCHEDULE_EXACT_ALARM, vérif `index.js`) (~1h)
2. Hook `use-active-race.ts` (~1.5h)
3. `IntakeSwipeCard` (gesture + reanimated + haptics + variante grisée) (~3h)
4. `CheckInCard` (3 emoji boutons) + `AidStationCard` + `FluidReminderCard` (réutilise IntakeSwipeCard) + `EventCard` dispatch (~1h)
5. `RaceRuntimeScreen` (états planned/in_progress, header chrono, Alert fin) (~2.5h)

**Critère J2** : flow complet jouable bout en bout sur device — créer course → C'est parti → recevoir notif → swipe Done/Skip → bouton Fin → Alert.

### Jour 3 (ven 8/05) — résumé + APK + dogfooding

1. `RaceSummaryScreen` (~2h)
2. Polish HomeScreen (sections selon statut race) + routing depuis Preview (~1h)
3. **Watchdog cold reboot** (`watchdog.ts` + intégration au mount RaceRuntimeScreen) (~1h)
4. Build APK preview (`eas build --platform android --profile preview`) + install + test sur device 5 min avec 3-4 notifs (~1.5h)
5. Buffer fix critiques + test long de 30 min en condition réelle si tout passe (~3h)

**Critère J3 vendredi soir** : APK preview installé sur le Samsung, validé sur sortie courte, prêt pour samedi.

## Réutilisations clés (déjà en place)

- `generatePlan({profile, race, foodItems, now})` à `src/engine/planning/generate.ts:30` — appelé une fois au tap "C'est parti" pour figer le plan en DB.
- `updateRaceStatus(db, id, status, extraFields?)` à `src/db/repos/race-repo.ts:222` — accepte déjà `{started_at}` et `{ended_at}` en extraFields.
- Pattern notif établi dans `app/dev/notification-test.tsx` (DateTriggerInput, channelId, request/list/cancel).
- `react-native-gesture-handler@~2.28.0` + `react-native-reanimated@~4.1.1` + `expo-haptics@~15.0.8` déjà en deps.
- Skill `.claude/skills/expo-notifications-android/SKILL.md` pour les patterns batch + actions + cancel + pièges Android.

## Risques principaux

| Risque | Mitigation |
|---|---|
| Reanimated v4 + RN 0.81 + Expo 54 — bug obscur sur le swipe | Test bare swipe simple en début de bloc 2.3. Si KO, fallback boutons gros "Pris" / "Sauté" — UX moins sexy mais ship. |
| Exact alarm Android 13+ refusé | Battery optim déjà désactivée sur device. `SCHEDULE_EXACT_ALARM` déclaré. Accepter ±15min imprécision worst case. |
| Notif tap quand app fermée | `getLastNotificationResponseAsync()` au boot du `_layout`. À tester explicitement bloc 2.1. |
| Double tap "C'est parti" | Guard `race.status !== 'planned'` + bouton désactivé après premier tap (loader). |
| GestureHandler mal configuré | `import 'react-native-gesture-handler'` en première ligne de `index.js` + `<GestureHandlerRootView>` au root. À vérifier J2 matin. |
| Cold reboot drop notifs | Watchdog J3 (re-schedule au mount si events futurs sans notification_id ou disparus du système). |

## Hors scope strict (reportés V2 / phase 4-5)

- Pause manuelle (toggle paused_segments)
- Réadaptation runtime (decalage notifs futures après skip)
- Alerte de dérive (2 skips consécutifs ou déficit cumulé)
- Suggestions contextuelles sur check-in 😖
- Calibration de pace post-course
- Action `modified` sur intake (changer la qty)
- Notes libres post-course

## Vérification

Bout-en-bout sur device :
1. Wipe DB depuis le bouton dev de HomeScreen
2. Créer une course de test (5 min, plan minimal)
3. Tap "C'est parti" → vérifier `Notifications.getAllScheduledNotificationsAsync()` non vide
4. Recevoir première notif → tap action "Fait" depuis notif → vérifier event_log inséré sans ouvrir l'app
5. Recevoir deuxième notif → tap simple → app ouvre l'écran runtime focus event → swipe gauche → vérifier event_log skip
6. Bouton "Fin de course" → choisir "Terminée" → écran summary affiche stats correctes
7. Wipe + nouvelle course longue (30 min) → cold reboot l'app au milieu → re-ouvrir → vérifier que les notifs futures fire toujours

Tests Jest :
- `npm test` doit passer (220 tests existants + nouveaux ajoutés)
- `tsc --noEmit` doit passer
