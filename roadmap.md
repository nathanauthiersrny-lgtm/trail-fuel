# Trail Fuel — Roadmap 2026-05-19 → 2026-08-10

> Issue de la discussion 2026-05-19 sur `evolution-planning.md`. 12 semaines, ~10h+/sem dispo.

---

## Décisions actées

| Sujet | Décision |
|---|---|
| Public / perso | **Closed beta sur invitation** (~10-100 users). Pas d'inscription publique avant Q4 2026. |
| Architecture data | **Local-first**. Sync = backup on-demand, pas dans cette fenêtre. |
| Cible plateformes | **Android only** sur cette fenêtre. iOS / Watch / dApp Store / App Store → Q4+. |
| Intégrations | **Aucune** (Strava / Garmin / Komoot / Health → reportées). GPX upload reste l'unique entrée. |
| Tier coach | **Reporté Q4**. Pote coach prévenu, attend. Schéma data gardé compatible. |
| Sync cloud / multi-device | Reporté Q4+. |
| Companion public | Reporté — dépend de la refonte rules. |
| Collaboration | Solo + contributeurs occasionnels. |
| Budget mensuel | 50-200€/mois OK. |

---

## Phase A — Refonte du système de rules (S1-7, ~70h)

**Pourquoi maintenant** : le système actuel (multiplicateurs sur baseline) ne sait pas exprimer des règles type *"60g/h puis 90g/h après 5h"* ou *"gel toutes les 10 min pendant 1h puis eau pendant 1h"*. C'est le blocker n°1 identifié dans `evolution-planning.md` §15.

### A.1 Discovery (S1, ~10h)
- [ ] Collecter 10-20 exemples concrets de règles à exprimer (sortir les articles déjà rentrés dans le companion)
- [ ] Définir le **langage cible** (DSL textuel, YAML, ou autre — à trancher)
- [ ] Lister les **primitives** : fenêtres temporelles, séquences, conditions sur durée écoulée, switches sur seuils, modificateurs terrain, etc.
- [ ] Document de design validé avant de toucher du code

### A.2 Engine (S2-4, ~30h)
- [ ] Parser du nouveau langage
- [ ] Moteur d'exécution (consomme une race + GPX + rules → planning)
- [ ] Validation (rule mal formée → erreur claire, pas un crash en course)
- [ ] Tests unitaires pour chaque primitive

### A.3 Réécriture native des 14 base rules (S5, ~10h)
- [ ] Porter les règles essentielles dans le nouveau langage
- [ ] Smoke test sur device : planning généré cohérent avec l'ancien (au moins pour les cas simples)
- [ ] **Décision à prendre fin A.3** : overlays existants — abandonner / refs / réécrire au cas par cas

### A.4 Pipeline companion → primitives (S6-7, ~20h)
- [ ] LLM (companion) traduit langage naturel d'un article → règles dans le nouveau format
- [ ] Modération manuelle dans le companion
- [ ] Export vers le natif via le flow existant (4.C)

**Sortie de Phase A** : moteur tournant + base rules natives + pipeline d'enrichissement opérationnel.

---

## Phase B — Recalibration en course (S8-10, ~30h)

**Pourquoi** : pain point n°2 — l'app ne sait pas s'adapter à l'allure/forme/conditions réelles pendant la course.

- [ ] Détection drift temps réel (allure réelle vs prévue, ressenti, conditions)
- [ ] Suggestion d'ajustement intake **live** (réduire/augmenter dose, espacer/resserrer fréquence)
- [ ] Suggestion post-course pour la prochaine course similaire (auto-propose, user accepte/refuse — cf. §11)
- [ ] UI runtime minimale (notif + écran de confirmation rapide)

---

## Phase C — Stabilisation + dogfood (S11-12, ~20h)

- [ ] 2-3 courses perso pour valider la refonte sur le terrain
- [ ] Onboarding 2-3 potes runners (closed beta manuelle, APK side-load)
- [ ] Polish + fix bugs remontés
- [ ] Update `doc.md` avec le nouveau modèle de rules

---

## Questions ouvertes (à trancher en cours de route)

- **Branding** : si on s'approche d'une vraie ouverture, brainstorm nom alternatif à "Trail Fuel"
- **Modèle économique** ("BYO IA" — l'user connecte son agent au lieu de payer un coaching intégré) : à valider à l'usage
- **§14 "1 truc qui te bloque mentalement"** : laissé `?` dans evolution-planning, à creuser
- **Overlays existants** : décision en fin de Phase A.3 selon ce que le nouveau langage peut exprimer

---

## Hors scope explicite

Ces sujets sont mentionnés dans `evolution-planning.md` mais **ne seront pas traités** dans cette fenêtre :

- iOS, Watch (Apple / Wear OS), App Store, dApp Store
- Tier coach (UI dédiée, plans partagés)
- Sync cloud, multi-device, auth utilisateur
- Intégrations Strava / Garmin / Komoot / Apple Health / Google Fit
- Intégration Loop App
- Companion public ouvert (au-delà du flow perso actuel)
- Système communautaire (upvote/downvote overlays, leaderboards)
- GDPR formel, export / delete account
