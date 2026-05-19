# Trail Fuel — planification de l'évolution

> **Mode d'emploi.** Remplis directement sous chaque question. Bullet points / mots-clés OK, pas besoin de phrases complètes. Si tu n'as pas d'avis, écris `?` ou `à voir`. Si une question ne te parle pas, raye-la (~~strike~~). Plus tu es concret, plus on pourra trancher derrière. Compte 1-2h pour un remplissage sérieux.

---

## 1. North Star

**Trail Fuel dans 3 ans, si tout se passait comme tu le rêvais — c'est quoi ?**
> (1-3 phrases brèves, pas une stratégie, juste l'image mentale)
Trail fuel est de base une pensée d'usage perso, vu que mon main projet de dev est Loop App, l'objectif serait que TrailFuel soit un outil intégrable a une app de génération de tracé de trail
Le main objectif c'est vraiment d'avoir une aide pour mes ravito perso a la base

**Et l'inverse : qu'est-ce que tu **ne veux surtout pas** que ça devienne ?**
?


---

## 2. Pour qui ?

**Profil utilisateur type que tu visualises :**
- Niveau (débutant, expérimenté, élite) →  Tout le monde
- Type de courses (marathon, ultra court 50k, ultra long 100k+, multi-jours) →  n'importe quel format mais c'est surtout penser pour le long
- Pays / langues principales →  France
- Plateforme préférée (Android only / iOS / Watch / Web) →  Android car pour moi, a voir plus tard si le projet est utile a plus de gens

**Tu vois Trail Fuel comme un outil pour :**
- [X] Toi + tes potes coureurs
- [ ] Coachs amateurs qui suivent quelques athlètes
- [ ] Coachs pro / clubs -> pour des potes coachs a terme pourquoi pas, mais c'est pas la cible visé de base
- [X] Le grand public running
- [X] Niche ultra-trail technique

**Combien de personnes serviraient l'app dans 1 an pour que tu sois content ?**
- [X] 10 (cercle proche)
- [X] 100 (communauté autour de toi)
- [x] 1 000 (un produit qui tourne)
- [X] 10 000+ (truc qui compte vraiment)

---

## 3. Public ou perso ?

**Décision binaire : tu ouvres au public ou tu restes en perso (toi + cercle proche) ?**
- [ ] Public
- [ ] Perso pour toujours
- [ ] Perso pour l'instant, public plus tard si ça vient
ça faut qu'on en discute, parce que ça va changer les formats sur le développement
Si l'objectif c'est de fournir un outil pour moi, mes potes, mes potes coachs alors public
Si l'objectif c'est de l'integrer dans une app future alors privé
Mais globalement je pense public, mais pas grand public, public a qui je donne le lien plutot.
Parcfe que c'est le genre d'app qui marche si les gens teste et donne leurs avis

**Si public, sur quels canaux ?**
- [X] Play Store (Android)
- [X] App Store (iOS)
- [ ] PWA via le web (pas de store)
- [X] dApp Store Solana
- [X] Side-load APK direct (techies)

**Timing :**
- [ ] Dans le mois qui vient (urgence ressentie)
- [ ] 3 mois (après quelques itérations)
- [ ] 6+ mois (après stabilisation + features clés)
- [X] Pas de deadline, quand c'est prêt

**Branding :**
- Tu gardes le nom "Trail Fuel" ? Si ça passe public non, faudra trouver un nom un peu catchy
- Tu as une idée de logo / identité visuelle ? Non pas du tout
- Slogan / pitch en 1 ligne pour ton meilleur pote runner : Ton aide pour tes ravito mais dans ta poche



---

## 4. Modèle économique

**Si tu ouvres au public, c'est :**
- [ ] Gratuit pour toujours (ego / passion projet)
- [X] Freemium (gratuit + paywall sur features avancées)
- [ ] Payant dès le début (one-shot ou sub)
- [X] Sponsorisé (marques nutrition ?)
- [ ] On verra, mais pas un blocker

J'ai envie de dire Freemium. Je vais pas te mentir, myRavito par exemple, exactement le même concept que cette app c'est payant tous les mois. 
Ils utilisent a coup sur le même système. Et ils ont probalement raison mais a la limite fournir une app que les gens peuvent connecter a leur agent IA.
Si les gens payent un abonnement Claude, tu leur fourni pas une autre IA de coaching nutrition mais un environnement dans lequel leur IA s'impleemente et hop, t'as la meme app mais tu paye pas

**Si freemium, qu'est-ce qui serait payant ?** (coche / commente)
- [ ] Sync cloud / multi-device
- [X] Tier coach (créer des plans pour d'autres)
- [ ] Knowledge packs premium (overlays curés par experts)
- [ ] Analytics post-course détaillés
- [X] Sans pub vs. avec pub
- [ ] Intégration Strava / Garmin
- [ ] Autre →

**Budget mensuel que tu acceptes de mettre TOI (hosting, API Anthropic, store fees, domaine) :**
- [ ] 0€ (faut que ça s'autofinance dès J1)
- [X] ~50€/mois ok pour démarrer
- [X] ~200€/mois ok le temps que ça décolle
- [ ] Plus si nécessaire

---

## 5. Communauté

**Les utilisateurs peuvent-ils :** (coche ce qui te plaît)
- [ ] Partager leurs overlays publiquement (genre app store des overlays)
- [X] Suivre des coachs / créateurs (et auto-receive leurs overlays)
- [X] Voir des stats agrégées anonymisées (X% des coureurs prennent Y g/h sur ultra >100k)
- [X] Commenter / liker / forker des overlays d'autres
- [X] Publier les résultats post-course publiquement (leaderboards, comparaisons)
- [ ] Rien de tout ça, c'est perso à 100%

**Si oui à au moins un :**
- Qui valide qu'un overlay public n'est pas du grand n'importe quoi ?   
- Tu modères toi-même ? Communauté upvote ? Algorithme + signalements ? 

Je pense c'est community oriented, un peu comme sur les workshop Steam ou truc du genre. Upvote/Downvote, et en fonction de ça t'as des classements et ça s'auto gère



---

## 6. Coachs

**Tu veux un tier coach où un coach peut :**
- [X] Voir les courses + logs en course de ses athlètes
- [X] Créer des plans nutritionnels sur mesure pour eux (sans qu'ils touchent à rien)
- [X] Publier des templates publics (gratuit ou payant)
- [ ] Annoter / discuter post-course avec son athlète -> pas besoin, il le fera via son canal a lui 
- [ ] Aucun, pas de coach feature

**Tu connais des coachs intéressés ?**
- Toi-même coach ? →
- Coachs amateurs dans ton entourage ? →
- Coachs pro qui ont vu l'app et trouvé ça cool ? →

Yes, j'ai des potes coureurs qui veulent tester et j'ai un pote qui coach des gens en course a pied qui cherche une solution pour faire appliquer ses plans de nutrition

---

## 7. Knowledge pack

**Le knowledge pack v1 (les 14 base rules de l'engine) : à terme, comment il évolue ?**
- [ ] Updates manuelles via builds (statu quo)
- [ ] Update OTA fetched du serveur, signed by toi
- [ ] Communauté propose → modération → publication
- [ ] LLM aggregation : les ajustements populaires deviennent des rules optionnelles
- [X] Mix de tout ça

**Toi, tu veux contribuer aux base rules publiquement (signature "by Nathan Authier") ?**
- [ ] Oui, c'est mon nom dessus
- [X] Non, anonyme
- [ ] Je veux pouvoir choisir au cas par cas

**Le companion (extraction LLM depuis articles) reste perso ou devient public ?**
- [ ] Reste mon outil de curation perso (et les overlays publiés viennent de moi)
- [X] Devient public : les gens collent leurs propres articles, créent leurs overlays
- [X] Hybride : public pour la curation, mais publication d'un overlay = passage par modération

---

## 8. Plateformes

**iOS :**
- [X] Prio haute (la moitié de mes potes runners sont sur iPhone)
- [ ] Prio basse (Android suffit pour l'instant)
- [ ] Jamais (Android + Solana dApp Store assez)
- Effort estimé : ~2-3 semaines pour porter avec Expo (l'app est déjà cross-compat à 90%)

**Apple Watch / Wear OS :**
- [ ] Game-changer (chrono + dismiss notif sans sortir le tel)
- [X] Cosmétique
- [ ] Pas intéressé

**Web app pour le runtime de course** (pas que companion) :
- [ ] Utile (genre "j'oublie mon tel, je peux suivre depuis un autre device")
- [ ] Compromis trop sur le offline / notifs locales — non
- [X] On verra plus tard

**dApp Store Solana :**
- [ ] J'y crois encore comme canal de distribution
- [ ] C'était une lubie, on laisse tomber
- [X] On garde l'option mais c'est secondaire

---

## 9. Données / cloud

**Quand l'app devient publique, comment les gens créent un compte ?**
- [ ] Email/password
- [ ] Google sign-in
- [ ] Apple sign-in (obligatoire si on va sur l'App Store)
- [ ] Solana wallet (cohérent avec le dApp Store)
- [ ] Pas de compte du tout, juste local + export manuel

Il n'y a pas moyen de créer un compte sans balancer de données ? ça me tend ajd, n'importe quel site tu utilise tu es obligé de t'inscrire
Est-ce que c'est pour des raisons de sécu, ou juste 99% des sites/app utilise/revendent tes données ?

**Quelles données tu acceptes de stocker côté serveur ?** (coche)
- [ ] Profil (FTHR, taille, poids, FC repos)
- [ ] Liste des courses passées + GPX
- [ ] Logs en course (intakes effectifs, skip reasons, feedback)
- [ ] Overlays personnels
- [ ] Comportement (clicks, swipes — pour analytics produit)
- [ ] Rien : tout reste sur le device, sync = upload-on-demand pour backup

Je sais pas, à voir ce qui a sens et logique d'etre stocké

**Conformité GDPR / export / delete account :**
- [ ] Dès le jour 1 du public release
- [ ] On voit ça quand on a des users EU réels
- [W] J'en ai jamais entendu parler, faut qu'on en parle

---

## 10. Intégrations avec l'écosystème runner

**Tu veux des intégrations avec :** (coche ce qui te paraît important)
- [ ] **Strava** (auto-import des courses passées → calibration)
- [ ] **Garmin Connect** (export → planning à partir d'un parcours Garmin)
- [ ] **Komoot / All Trails** (import GPX direct depuis leur planif)
- [ ] **Apple Health / Google Fit** (poids, FC repos, sommeil)
- [X] Aucune — l'utilisateur charge son GPX et c'est tout

**Tu paierais 3-4 jours de dev pour une intégration Strava prime maintenant ?**
- [ ] Oui, c'est THE deal-breaker pour mes potes
- [ ] Cool mais pas urgent
- [ ] Non

Qu'est ce que tu entends par une intrégration Strava prime ?

---

## 11. Auto-calibration / ML

**Étape 5 du roadmap post-trail = "sync vers backend + analyse LLM après 5-10 courses".**

**Aujourd'hui, qu'est-ce qui te manque le plus dans le runtime ?**
> (genre : recalibration auto du pace, suggestion d'ajuster les targets, alerte si tu décroches sur un trend, …)
Ajd, les deux points les plus imporants pour moi c'est : 
- la précision des intakes et leur répartition (encore trop de soucis sur ça, ex: tu te retrouve a prendre 2 gels a 20 min d'intervalle)
- la recalibration en course, suivant ton allure, ta forme etc...


**Tu veux que l'intake (carbs/fluid) se calibre auto ?**
- Exemple : "Tu avais planifié 80 g/h, tu en a réellement mangé 65 → on baisse à 70 pour la prochaine course similaire."
- [X] Oui, totalement
- [ ] Oui mais avec confirmation manuelle à chaque fois
- [ ] Non, je préfère décider à la main

**Quand déclencher une recalibration / suggestion ?**
- [X] Après chaque course (auto-propose, l'user accepte/refuse)
- [X] Tous les X courses (genre 5) pour avoir un signal robuste
- [ ] À la demande de l'user uniquement
- [ ] Jamais auto

---

## 12. Companion repo (le Next.js qu'on vient de finir)

**À terme, le companion devient :**
- [ ] Outil perso local-only (statu quo, MVP shippé, on touche plus)
- [ ] Outil perso amélioré (auth, hosting, mais toi seul utilisateur)
- [X] Web public où n'importe qui peut s'inscrire et faire pareil (Phase C du horizon plan, ~3-4 semaines)
- [ ] Admin panel pour gérer le knowledge pack du service public (toi admin, users uniquement consomment)

---

## 13. Réalités opérationnelles

**Combien de temps par semaine tu peux mettre sur Trail Fuel les 3 prochains mois ?** (heures réalistes, pas optimistes)
- [ ] 0-2h (mode side-side-project)
- [ ] 3-5h (un soir par semaine)
- [ ] 6-10h (deux soirs + un peu le weekend)
- [X] 10h+

Je suis full time sur mon dev perso pour potentiellement la prochaine année. 
J'ai un projet en physique + Loop App, donc j'ai beaucoup de temps

**Tu acceptes de gérer ton premier user qui a un bug** dans :
- [ ] 1h (faut être réactif)
- [X] 24h
- [ ] "Quand j'ai le temps" (l'user devra être patient)
- [ ] Je ferai un Discord / form / email et on verra

**Tu veux collaborer ?**
- [ ] Solo strict (mon projet, mon contrôle)
- [X] Solo mais ouvert à des contributeurs occasionnels (1 PR par-ci par-là)
- [X] Co-maintainer (1-2 personnes régulières)
- [ ] Build une équipe (3+ personnes)

---

## 14. Priorités prochains 3 mois

**3 trucs concrets que tu veux shipper avant fin août 2026 :**
1. Une version stable et fonctionelle
2. Un système de nutrition vraiment pointu et addapté au coureur
3. Un plan de que peut réellement devenir l'app

**3 trucs que tu sais que tu veux mais qui peuvent attendre 2027 :**
1. Intrégration sur les montres (par exemple Suunto, je sais qu'il faut apply avec un projet pour esperer pouvoir le déposer sur leur store)
2. Intégration dans Loop App
3. Un plan futur de l'app si elle fonctionne et plait

**1 truc qui te bloque mentalement / dont t'as pas envie de t'occuper :**

?

---

## 15. Open questions & frictions

**Ce que tu te poses encore et où tu n'as pas de réponse claire** (j'aiderai à trancher) :
- Pour moi le système actuelle de rules et overlay n'est absolument pas adapté à ce que l'on veut faire.
J'ai commencé a rentrer certains articles dans le companion mais certaines regles sont complexes.
Exemple : 60g de glucides/heure, à partir de 5h passer a 90g. Règles très basique mais innaplicable dans l'état actuel car tout est régit en format chiffre/multiplicateur
Il faut vraiment qu'on trouve un système quasi humain/parlé, pour que n'importe règle soit testable et compréhensible par l'app.
ça va probabelement entrainer une refonte complète du système mais c'est le point le plus important a mes yeux

Si une règle dit : gel toute les 10 minutes pendant 1h puis que de l'eau pendant 1h puis solide toutes les 30 minutes pendant 4h, alors l'app doit etre capable de le faire.
(c'est un exemple foireux mais c'est pour expliquer mes propres)

**Ce qui t'embête dans l'app actuelle** (frictions perso ressenties à l'usage) :
- à part la précision des intakes sur laquelle on doit passer je trouve tout plutot bien fait
- 
- 

**Surprises / découvertes** depuis le baptême du feu du trail 2026-05-10 :
- praticité du slide et réponse 
- facilité de gestion de la bibliotheque de produit

---

**Une fois rempli, ping-moi. On lit ensemble, on classifie les questions en : (1) tranchable maintenant, (2) à valider à l'usage, (3) à reporter, et on monte une roadmap concrète.**
