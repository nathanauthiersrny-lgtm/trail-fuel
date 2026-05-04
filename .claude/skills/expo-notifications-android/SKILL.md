---
name: expo-notifications-android
description: Use this skill when working with local notifications on Android via Expo — scheduling batches of timed notifications, adding interactive actions (Done/Skip) to notifications, handling cancellation when a race is abandoned, or debugging why a notification didn't fire. Covers Android-specific pitfalls (battery optimization, Doze mode, notification channels, exact alarm permissions for Android 13+) and the batch scheduling strategy used at race start. Trigger this whenever code touches `expo-notifications`, `scheduleNotificationAsync`, `setNotificationCategoryAsync`, `notification channels`, or when a user reports notifications not firing.
---

# Notifications locales sur Android (Expo)

Module critique de l'app : toute la fiabilité du plan nutritionnel repose sur le fait que les notifs programmées **se déclenchent réellement** au bon moment, même app fermée, téléphone en poche, écran éteint, pendant 6h.

## Principe architectural

**Tout est programmé en batch au départ de la course**. Zéro timer JavaScript, zéro polling, zéro réveil. L'app calcule tous les events au lancement (via `planning-engine`) et appelle `scheduleNotificationAsync` pour chacun. Ensuite, l'OS gère.

Pourquoi c'est non-négociable : un timer JS est killed dès que l'app passe en background (ou presque immédiatement sur Android avec optimisations batterie agressives). Seules les notifs planifiées au niveau OS survivent.

## Setup initial

```typescript
import * as Notifications from 'expo-notifications';

// À l'init de l'app (App.tsx ou équivalent)
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});
```

## Permissions

Android 13+ requiert l'autorisation explicite `POST_NOTIFICATIONS` :

```typescript
const { status } = await Notifications.requestPermissionsAsync();
if (status !== 'granted') {
  // Montrer un écran explicatif : "Sans notifs, l'app ne peut pas t'alerter en course"
}
```

Pour les **alarmes exactes** sur Android 13+ (notifs qui doivent partir pile à l'heure, pas dans une fenêtre approximative), l'OS peut exiger la permission `SCHEDULE_EXACT_ALARM`. Elle est généralement accordée par défaut pour les apps "alarm clock" mais peut être révoquée. Pour le trail, **une tolérance de ±1 min est acceptable**, donc on n'a PAS besoin d'alarmes exactes (ce qui simplifie beaucoup).

## Notification channels (Android obligatoire)

Android groupe les notifs par "channel", chacun avec ses propres paramètres (son, importance, vibration). Créer les channels au démarrage :

```typescript
import { Platform } from 'react-native';

if (Platform.OS === 'android') {
  await Notifications.setNotificationChannelAsync('intake', {
    name: 'Intake nutrition',
    importance: Notifications.AndroidImportance.HIGH,
    vibrationPattern: [0, 250, 250, 250],
    sound: 'default',
  });

  await Notifications.setNotificationChannelAsync('checkin', {
    name: 'Check-in ressenti',
    importance: Notifications.AndroidImportance.DEFAULT,
    vibrationPattern: [0, 500],
  });

  await Notifications.setNotificationChannelAsync('alert', {
    name: 'Alerte dérive',
    importance: Notifications.AndroidImportance.MAX,
    vibrationPattern: [0, 500, 250, 500, 250, 500],
    sound: 'default',
  });
}
```

Importance MAX = notif en heads-up (bandeau qui s'affiche par-dessus tout). À réserver aux alertes de dérive.

## Actions dans les notifs (Fait / Passer)

Définir une catégorie d'action au démarrage, puis l'associer à chaque notif d'intake :

```typescript
await Notifications.setNotificationCategoryAsync('intake_action', [
  {
    identifier: 'done',
    buttonTitle: '✓ Fait',
    options: { opensAppToForeground: false },
  },
  {
    identifier: 'skip',
    buttonTitle: '✗ Passer',
    options: { opensAppToForeground: false },
  },
]);
```

Dans la notif planifiée :

```typescript
await Notifications.scheduleNotificationAsync({
  identifier: `intake_${plannedEventId}`,
  content: {
    title: 'Hydrate + Gel',
    body: '150ml eau + 1 gel SIS',
    categoryIdentifier: 'intake_action',
    data: { plannedEventId, type: 'intake' },
  },
  trigger: {
    type: Notifications.SchedulableTriggerInputTypes.DATE,
    date: triggerDate,
    channelId: 'intake',
  },
});
```

## Listener pour les réponses aux actions

```typescript
Notifications.addNotificationResponseReceivedListener((response) => {
  const { actionIdentifier, notification } = response;
  const { plannedEventId, type } = notification.request.content.data;

  if (actionIdentifier === 'done') {
    logEvent(plannedEventId, 'done');
  } else if (actionIdentifier === 'skip') {
    logEvent(plannedEventId, 'skipped');
    checkForConsecutiveSkips(plannedEventId);
  }
});
```

Ce listener doit être actif **dès le démarrage de l'app** (pas seulement quand l'écran course est ouvert), car les actions peuvent arriver app en background.

## Batch scheduling au départ de course

```typescript
async function scheduleRaceNotifications(
  race: Race,
  plan: PlannedEvent[]
): Promise<string[]> {
  const now = Date.now();
  const scheduledIds: string[] = [];

  for (const event of plan) {
    const triggerDate = new Date(now + event.scheduled_at_minute * 60_000);
    const channelId = eventChannelId(event.type);
    const categoryId = event.type === 'intake' ? 'intake_action' : undefined;

    const id = await Notifications.scheduleNotificationAsync({
      identifier: `race_${race.id}_event_${event.id}`,
      content: buildNotificationContent(event),
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date: triggerDate,
        channelId,
      },
    });
    scheduledIds.push(id);
  }

  return scheduledIds;
}
```

Stocker `scheduledIds` en DB pour pouvoir tout annuler si la course est abandonnée.

## Annulation

```typescript
async function cancelRaceNotifications(scheduledIds: string[]) {
  await Promise.all(
    scheduledIds.map(id => Notifications.cancelScheduledNotificationAsync(id))
  );
}
```

Appeler systématiquement quand `race.status` passe à `abandoned` ou `completed`.

**Edge case** : si l'app est désinstallée pendant une course, les notifs planifiées sont auto-nettoyées par l'OS. Pas de souci.

## Pièges Android spécifiques

### Battery optimization

Android a une "optimisation batterie" agressive qui peut retarder les notifs de plusieurs minutes. Pour une app perso side-loadée, il faut que Nathan **désactive manuellement** l'optimisation batterie pour cette app dans les paramètres système Android (Paramètres → Apps → Trail Fuel → Batterie → Non restreinte). À mentionner dans un écran d'onboarding.

### Doze mode

Si le téléphone reste immobile écran éteint (cas peu probable en course mais possible en pause), Doze peut différer les notifs. Pour le contourner, utiliser la permission `USE_EXACT_ALARM` (Android 13+) OU accepter une tolérance.

### Constructeurs exotiques (Xiaomi, Huawei, OnePlus)

Certains constructeurs ajoutent des couches d'économie d'énergie PAR-DESSUS Android qui killent les notifs. Nathan devra vérifier selon sa marque de téléphone. À documenter dans le README.

### Notifications groupées

Android peut regrouper des notifs similaires d'une même app sous un seul bandeau ("3 notifications de Trail Fuel"). Pour une course, c'est contre-productif. Utiliser des `groupSummary: false` et des identifiants distincts pour éviter ce groupement.

## Reprogrammation après pause manuelle

L'utilisateur peut mettre la course en pause via un bouton dédié (voir `doc.md` section 7). Le cycle est :

```
pauseRace(race):
  1. Annuler toutes les notifs futures via race.scheduled_notification_ids
  2. Pousser un segment ouvert dans race.paused_segments : { from: Date.now(), to: null }
  3. Persister en DB

resumeRace(race):
  1. Fermer le segment ouvert (to: Date.now())
  2. Calculer cumulPauseMs = somme des durées de paused_segments
  3. Pour chaque PlannedEvent dont (race.started_at + scheduled_at_minute*60_000) > now :
       triggerDate = race.started_at + scheduled_at_minute*60_000 + cumulPauseMs
       scheduleNotificationAsync({ trigger: { date: triggerDate, ... } })
  4. Stocker les nouveaux scheduled_notification_ids
```

Points d'attention :

- **Ne pas re-générer le plan** : on reprogramme juste les events existants. Le plan ne change pas pendant une pause.
- **Idempotence** : si l'utilisateur tape "Reprendre" deux fois, ne pas reprogrammer deux fois. Vérifier que le dernier segment est bien fermé avant d'agir.
- **Pause en fin de course** : si la pause se termine après ce qui aurait été la fin théorique, certains events sont déjà dans le passé après décalage — les ignorer plutôt que de les firer en retard massif.

## Reprogrammation défensive

Au démarrage de l'app, si une course est en cours (`status === 'in_progress'`), vérifier que les notifs programmées existent toujours :

```typescript
const scheduled = await Notifications.getAllScheduledNotificationsAsync();
const expected = new Set(race.scheduled_notification_ids);
const actual = new Set(scheduled.map(n => n.identifier));

const missing = [...expected].filter(id => !actual.has(id));
if (missing.length > 0) {
  // Reprogrammer les events futurs manquants
  await rescheduleMissingEvents(race, missing);
}
```

## Tests manuels recommandés

- Lancer une course de test avec 3 events à +1min, +2min, +3min, téléphone en poche, écran éteint, app en background. Vérifier que les 3 partent.
- Même test mais téléphone sans réseau (avion) : doit marcher (tout est local).
- Même test mais app killée manuellement dans la barre de tâches : Android peut laisser partir les notifs ou non selon le constructeur. À tester tôt.
- Lancer une course puis l'abandonner : vérifier qu'aucune notif ne part plus tard.
