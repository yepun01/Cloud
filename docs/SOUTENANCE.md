# PixelBoard — Prep Soutenance

Document de preparation pour la soutenance Epitech Cloud-Native & Serverless. Q&A couvrant tout ce qu'un jury peut demander.

---

## 0. Pitch d'ouverture (2 min, a apprendre)

> "J'ai construit **PixelBoard**, un clone serverless de Reddit r/place sur GCP. C'est une toile partagee de 100×100 pixels ou n'importe qui peut placer un pixel toutes les 5 secondes, avec un cooldown par utilisateur.
>
> Deux interfaces partagent le **meme backend** : une SPA web (Vanilla JS + HTML5 Canvas) et un bot Discord avec 3 slash commands. Les pixels apparaissent en **temps reel** sur tous les clients grace aux listeners Firestore onSnapshot.
>
> **100% serverless** : 3 Cloud Functions 2nd gen, Firestore Native, Firebase Hosting et Auth, Pub/Sub, Secret Manager. Aucune VM, aucun container que je gere, scale-to-zero partout.
>
> J'ai 64 tests Jest (91% coverage), signature ed25519 sur les interactions Discord, rate limiting atomique via transactions Firestore, et une documentation complete (architecture + diagrammes + API + security audit + demo script)."

**Demo URL** : https://pixel-epitech.web.app

---

## 1. Architecture & choix techniques

### Q: Pourquoi serverless ?
> Le sujet l'exige — "only serverless services". En pratique c'est adapte au cas d'usage : trafic imprevisible (virale ou 0), pas besoin de maintenir des VMs, scale-to-zero, payer a l'usage. Pour r/place ou tu peux passer de 0 a 10k users en 1h, le scaling automatique est essentiel.

### Q: Pourquoi GCP plutot qu'AWS ?
> 300€ de credits gratuits sur un nouveau compte GCP. Firestore a des listeners real-time natifs (SDK cote client), pas besoin d'architecture WebSocket custom. Firebase Hosting est inclus et trivial a deployer. L'ecosysteme Firebase (Auth + Hosting + Firestore) est plus integre que AWS (Cognito + S3 + DynamoDB + API Gateway).

### Q: Decris ton architecture haut niveau
> 3 Cloud Functions HTTP en `europe-west1` : `placePixel` (POST), `getCanvas` (GET), `discordInteraction` (POST endpoint pour Discord). Firestore Native stocke `pixels/{x}_{y}` et `users/{userId}`. Pub/Sub topic `pixel-events` pour le fan-out asynchrone. Secret Manager pour les credentials Discord. Firebase Hosting sert le SPA, Firebase Auth gere l'auth anonyme web.
>
> Le flux : client web clique → POST placePixel → transaction Firestore (check cooldown + write pixel + update user) → publish Pub/Sub → reponse. Le client ecoute `onSnapshot(collection(db, "pixels"))` donc le pixel apparait en <1s sur tous les onglets ouverts.

### Q: Pourquoi Cloud Functions 2nd gen vs 1st gen ?
> 2nd gen tourne sur Cloud Run en dessous → plus de configuration (concurrency par instance, timeout jusqu'a 60min, memoire jusqu'a 32 GiB). 1st gen est limitee a 1 request/instance et 9min. Pour de l'HTTP leger c'est equivalent mais 2nd gen est le standard futur (1st gen deprecated progressivement).

### Q: Pourquoi 1 endpoint = 1 fonction et pas un routeur Express dans une seule fonction ?
> **Isolation IAM** : chaque fonction peut avoir sa propre config de secrets, ses bindings separes. Seul `discordInteraction` a `secrets: [discord-public-key]`. **Observabilite** : metriques par endpoint natives dans Cloud Monitoring. **Deploy independant** : je peux redeployer juste placePixel sans toucher le reste. **Cold-start** : un gros routeur monolithique = un cold-start qui affecte tous les endpoints.

### Q: Pourquoi la region europe-west1 ?
> Belgique — latence minimale pour nous. Firestore a besoin d'une region fixe a la creation, et je l'ai aligne avec les Cloud Functions pour eviter les aller-retours transcontinentaux.

---

## 2. Data model

### Q: Comment sont stockes les pixels ?
> Un document par pixel dans Firestore : `pixels/{x}_{y}` avec `{x, y, color, userId, placedAt}`. Doc id deterministe = `${x}_${y}` — deux writes sur la meme position ciblent le meme doc, Firestore serialise, `set()` sans merge donne du last-write-wins gratuitement.

### Q: Pourquoi pas un seul document pour tout le canvas ?
> **Limite Firestore 1 MiB/doc** : 10k pixels × 80B ≈ 800 KiB, zero marge pour grandir. **Contention** : chaque placement reecrit le doc entier → serialisation forcee de toutes les ecritures. **Real-time listener** : recevrait le canvas complet a chaque changement au lieu d'un delta.
>
> Avec 1 doc/pixel : writes sur positions differentes sont sans conflit, `onSnapshot` envoie juste les deltas.

### Q: Que se passe-t-il si 2 users placent au meme (x,y) en meme temps ?
> Firestore serialise les writes sur le meme document. Le dernier gagne (`set()` sans `{merge:true}` ecrase tout). C'est le comportement voulu pour r/place. Aucune perte de donnees — le premier write est juste invisible.

### Q: Comment modelise-tu le cooldown ?
> Collection `users/{userId}` avec `{lastPlacedAt: Timestamp, placedCount: number}`. A chaque placePixel, je lis ce doc dans une transaction, je compare `now - lastPlacedAt` a 5s, si OK j'ecris le pixel ET update `lastPlacedAt` atomiquement.

### Q: Pourquoi pas Redis/Memorystore pour le rate limit (plus rapide) ?
> Memorystore = Compute Engine = **pas serverless**. Interdit par le sujet. Et Firestore transactions sont deja rapides (~150-300ms) — suffisant pour un clic utilisateur. Cache en memoire de Cloud Functions rejete car perdu au cold start ET non partage entre instances concurrentes (scale horizontal).

---

## 3. Concurrence & atomicite

### Q: Comment garantis-tu que le cooldown ne peut pas etre contourne par double-clic ?
> **Firestore transaction**. Je lis `users/{userId}.lastPlacedAt`, verifie le cooldown, ecris pixel + update user — tout dans la meme transaction. Firestore verrouille le doc user pendant read-modify-write et rejoue la transaction si un conflit est detecte. Donc 2 requetes simultanees du meme user sont serialisees : la premiere passe, la seconde voit le nouveau `lastPlacedAt` et rejette.

### Q: Et si la transaction echoue 5 fois (max retries Firestore) ?
> Je retourne 500. En pratique ca n'arrive jamais avec un cooldown de 5s par user — les retries protegent contre des collisions sub-second, pas contre des tempetes d'ecritures.

### Q: Comment gere-tu l'ordre des pixels ?
> Je n'en gere pas d'ordre global. Chaque doc a `placedAt: FieldValue.serverTimestamp()` qui est resolu cote serveur Firestore. Pour afficher le canvas je lis tous les docs (ordre indifferent) et je render. Pour de l'ordre chronologique (bonus historique) je ferais `orderBy("placedAt")`.

### Q: Pourquoi `FieldValue.serverTimestamp()` et pas `new Date()` ?
> Anti-triche client-side. Si je fais `new Date()` dans une Cloud Function, le user pourrait manipuler la date via un client modifie (enfin, pas direct — le serveur cree Date, mais si je faisais `Timestamp.fromMillis(clientTs)` ca serait trichable). `serverTimestamp()` force la resolution cote serveur Firestore, horloge coherente entre tous les writes.

---

## 4. Securite

### Q: Comment authentifies-tu les requetes Discord ?
> ed25519 via `tweetnacl`. Discord signe chaque interaction avec sa cle privee, je verifie avec la cle publique stockee dans Secret Manager. Headers `x-signature-ed25519` + `x-signature-timestamp`, body concatene au timestamp → verify. Signature invalide = 401.

### Q: Pourquoi ed25519 et pas HMAC-SHA256 ou JWT ?
> C'est Discord qui impose ed25519. Avantage : je n'ai pas de secret partage, juste une cle publique — donc meme si mon backend fuite, l'attaquant ne peut pas forger des requetes Discord. Un HMAC necessiterait que Discord et moi ayons le meme secret.

### Q: Et l'auth web ?
> Firebase Auth Anonymous — chaque visiteur a un UID unique genere au premier load. Je construis `userId = "web:" + uid`. Pas de Google login (decision de scope pour ce projet).

### Q: Mais alors le `userId` vient du body de la requete ? Un attaquant peut le changer !
> Oui, c'est **de la dette acceptee**, documentee dans `docs/SECURITY.md` M1. Un attaquant qui fait `curl` avec 10k userIds differents peut bypasser le cooldown. Mitigation possible : verifier un Firebase ID token cote Cloud Function et forcer `userId = request.auth.uid`. Pas implemente car projet ecole avec demo controlee, et c'etait prevu Phase 6 originellement.

### Q: Pourquoi pas App Check / reCAPTCHA ?
> Considere. Gratuit, 2 lignes avec `enforceAppCheck: true`. Ecarte car : pour une demo avec 5-10 utilisateurs connus, c'etait du scope supplementaire sans valeur pour la note. Je l'ajouterais en prod.

### Q: Ou sont stockes tes secrets ?
> Secret Manager. 3 secrets : `discord-bot-token`, `discord-public-key`, `discord-app-id`. Binding IAM : seul le compute SA `252801134584-compute@developer.gserviceaccount.com` a `roles/secretmanager.secretAccessor`. Dans le code, je ne referende que `defineSecret("discord-public-key")` — la valeur est injectee a runtime via variable d'environnement par Cloud Functions.

### Q: Les credentials Firebase web sont hardcodes dans `firebase-config.js`. Pas un probleme ?
> Non, c'est public par design Firebase. L'`apiKey` identifie le projet (pas une cle secrete), l'acces est controle par les Firestore rules et optionnellement App Check. Firebase le documente : https://firebase.google.com/docs/projects/api-keys#general-info.

### Q: Firestore rules ?
> Default deny. `pixels` et `canvas` sont `read: if true` (publics, lecture seule client), `write: if false` (ecritures uniquement via backend Admin SDK qui bypass les rules). `users` : lecture conditionnelle `request.auth.uid == userId` (dead branch actuellement, documente L1 dans security audit).

---

## 5. Scalabilite & couts

### Q: Ca supporte combien d'utilisateurs simultanes ?
> **Cloud Functions** scale a 1000 instances concurrentes par defaut. **Firestore** : 10k writes/s sustained sur free tier, 500/s sustained sur un doc (pixel ou user particulier). Avec un cooldown 5s/user, chaque user genere 0.2 write/s max → **1000 users actifs = 200 writes/s**, largement dans les limites.

### Q: Le bottleneck ?
> Firestore ecritures. Pour 5000 users actifs place en continu = 1000 writes/s, on approcherait la limite soft. Fix : scale la region Firestore, ou passer sur un doc "canvas row" (1 doc par ligne) pour batcher les writes.

### Q: Reads pour getCanvas ?
> `getCanvas` lit tous les docs → N reads ou N = nombre de pixels places. Canvas complet = 10k reads = $0.006. Cote web, on n'appelle getCanvas qu'au load initial puis onSnapshot (delta). Mais le onSnapshot listener coute aussi des reads : chaque doc charge = 1 read, chaque update = 1 read pour le client qui l'observe.

### Q: Quel est le cout actuel ?
> Zero. Free tier couvre : 2M invocations Cloud Functions/mois, 50k Firestore reads/jour, 20k writes/jour, 10 GB transfert Hosting/mois. Mon trafic actuel : dizaines de requetes par demo. Marge enorme.

### Q: Si ca devient viral, au pire ?
> 100k users en 1h, chacun faisant 5 placements sur l'heure = 500k writes/h = 140 writes/s. On est dans les limites Firestore. Cout : 500k writes × $0.18/100k + 50k users × 1 listener onSnapshot × quelques reads/s = peut-etre $50 la journee sur une virale. Budget alert GCP a $10/jour coupe les APIs en securite.

---

## 6. Event-driven architecture

### Q: Comment c'est event-driven ?
> Chaque placement de pixel emet un event sur Pub/Sub topic `pixel-events` apres le commit Firestore. Le code est decouple : placePixel ne sait pas qui consomme. On peut brancher un subscriber (worker Cloud Function, BigQuery pour analytics, webhook, etc.) sans toucher placePixel.
>
> Aussi : le frontend utilise les Firestore `onSnapshot` listeners — un pattern event-driven pur (Firestore push les changements, le client reagit).

### Q: Mais le consumer Pub/Sub n'existe pas encore ?
> Pas en Phase 2. Le topic est pret, les messages sont publies, mais aucun subscriber n'est branche. C'est la **Phase 5** du roadmap (optionnelle). Un cas d'usage : regenerer un snapshot PNG du canvas toutes les N secondes pour `/canvas` Discord, ou alimenter un dashboard Cloud Monitoring custom.

### Q: Pub/Sub fire-and-forget — que se passe-t-il si le publish echoue ?
> Le pixel est ecrit (transaction Firestore committee), mais l'event est perdu. Je log un warning, je retourne quand meme 200. C'est **de la dette acceptee** (M2 dans `docs/SECURITY.md`) : pas d'outbox pattern. Fix propre = ecrire l'event dans une collection `events/` _dans_ la transaction Firestore, puis Eventarc trigger qui publie avec retry. Non implemente car pas de consumer critique en Phase 2.

### Q: Eventarc vs Pub/Sub direct, c'est quoi la difference ?
> Pub/Sub est la couche message. Eventarc est un router qui consomme des events GCP (Audit Log, Firestore triggers, Storage events…) et les publie sur Pub/Sub. Je peux l'utiliser pour reagir a un write Firestore (trigger auto). Pour l'instant je publie directement depuis placePixel — plus simple, mais Eventarc serait plus idiomatique si je voulais decoupler la source de l'event de la fonction.

---

## 7. Real-time

### Q: Comment fonctionne le temps reel ?
> Firestore JS SDK cote client ouvre une connexion websocket persistante vers Firestore. Avec `onSnapshot(collection(db, "pixels"))`, je m'abonne a tous les changements. Quand un doc est cree/modifie, Firestore envoie le delta via la websocket, le callback JS est appele avec la nouvelle liste, je re-render. Latence <1s.

### Q: Pourquoi pas WebSocket custom ? SSE ? Pub/Sub → client ?
> **WebSocket custom** = besoin d'un serveur always-on → pas serverless (interdit). **SSE** = meme probleme. **Pub/Sub cote client** = pas supporte nativement dans les browsers (Pub/Sub est server-to-server). Firestore onSnapshot resout tout ca : Firebase SDK fait le boulot de connexion persistante avec authentification.

### Q: Et si le client est offline ?
> Le SDK Firebase gere. Il queue les reads, se reconnecte automatiquement, replay les updates manques au retour en ligne.

### Q: Scalabilite des listeners ?
> Firestore supporte des centaines de milliers de listeners concurrents. Chaque listener coute des reads (1 read par doc initialement + 1 read par update recu). Pour 1000 clients ecoutant le canvas complet : 1000 × 10k docs = 10M reads initiaux. Au free tier on est dans les limites.

---

## 8. Tests

### Q: Comment tu testes ?
> Jest, 64 tests, 91% coverage. Test matrix :
> - `validation.test.js` — coordonnees strictes, palette, userId length
> - `rateLimit.test.js` — checkCooldown avec differents formats de Timestamp
> - `placePixel.test.js` — happy path, coords invalides, color invalide, cooldown, body manquant, ecrasement same (x,y), userId >100 chars
> - `getCanvas.test.js` — canvas vide, avec pixels
> - `discord.test.js` — signature valide/invalide/tampered/malformed, PING/PONG, dispatcher, 3 commands, DM context, cooldown 429

### Q: Tu mocks Firestore ?
> Oui, `jest.mock("../src/shared/firestore", ...)` avec un faux `runTransaction` qui capture les writes. Pour chaque test je reset les mocks. Pas de Firebase Emulator car overkill pour unit tests, les mocks couvrent tous les scenarios.

### Q: Tests d'integration ?
> Curl tests manuels documentes dans `docs/DEMO.md`. Pas de tests e2e automatises (pas de Playwright/Cypress — dette accepte pour projet ecole).

### Q: TDD ?
> Oui, tests ecrits avant l'implementation. Le criteria.md (must-pass scenarios Given/When/Then) a servi de reference pour chaque test.

---

## 9. Frontend

### Q: Pourquoi Vanilla JS ?
> Le sujet n'impose pas de framework, j'ai voulu garder le frontend simple et rapide a charger. Pas de build step, pas de bundler, pas de node_modules cote client. Firebase SDK charge via CDN ESM. Le frontend fait ~400 lignes de JS reparties en 7 modules.

### Q: Pas de React/Vue/Svelte ?
> Overkill pour 7 modules et une interaction canvas + clic. Ajouter un framework = ajouter un build step = ajouter des deps = complexifier sans valeur. En prod, pour scaler le frontend, j'utiliserais probablement Svelte (petit bundle) ou Solid.

### Q: Comment gere-tu le state ?
> Pattern minimaliste : un objet `state` dans `app.js` qui contient `{userId, selectedColor, cooldownUntil, pixels (Map), ctx}`. Les modules exportent des fonctions pures, `app.js` orchestre.

### Q: Optimistic updates ?
> Oui. Au clic, je dessine le pixel immediatement dans la map + sur le canvas. Si la requete fail (429 cooldown ou erreur reseau), je rollback en restaurant le pixel precedent (ou en vidant la case) et j'affiche un toast.

### Q: Gestion du cooldown UI ?
> Timer `setTimeout` + `requestAnimationFrame`. Apres chaque 200 de placePixel je start un countdown 5s, affiche "Wait Xs", bloque les clics suivants client-side. Si 429 je sync le compteur avec `retryAfter` du serveur.

### Q: Comment fonctionne le zoom/pan ?
> CSS transform sur l'element `<canvas>`. Molette = `transform: scale(X)` autour du curseur (inverse le pan pour garder le point sous le curseur fixe). Shift+drag = `transform: translate(X, Y)`. Pas de manipulation du canvas context — tout est CSS, plus simple.

---

## 10. Discord

### Q: Comment fonctionne ton bot ?
> Discord envoie un POST a mon endpoint a chaque slash command. Je verifie la signature ed25519, parse le body, dispatch sur le `name` de la commande vers `handlePlace` / `handleCanvas` / `handleInfo`. Le handler appelle directement `placePixelCore` ou `getCanvasCore` (fonctions internes partages avec le handler HTTP — pas de HTTP roundtrip).

### Q: Pourquoi pas un bot gateway WebSocket (discord.js) ?
> Bot gateway = process always-on qui maintient une connexion websocket avec Discord. **Pas serverless**. Interdit par le sujet. L'Interactions API HTTP est la maniere moderne de faire des bots slash-command-only — scale-to-zero, pas d'infra a gerer.

### Q: Comment tu enregistres les slash commands ?
> Script `scripts/register-commands.js` — PUT sur `https://discord.com/api/v10/applications/{APP_ID}/commands` avec le body des 3 commandes + leurs options. Autorise par le BOT_TOKEN. Une fois enregistrees, Discord les propage sur tous les servers ou le bot est invite.

### Q: Le userId Discord vs web ?
> Convention prefixee : `discord:<snowflake>` vs `web:<firebaseUid>`. Meme namespace, memes cooldown et donnees users, mais identifiable. Si tu places via Discord puis Web, tu as 2 userIds differents = 2 cooldowns independants (demo point).

### Q: Les handlers Discord appellent-ils les endpoints HTTP en interne ?
> Non. Ils appellent `placePixelCore` et `getCanvasCore` directement — ce sont des fonctions exposees par les modules pixel. Pas de HTTP roundtrip, pas de parsing JSON intermediate. Plus rapide et plus simple.

### Q: Ephemeral vs public responses ?
> `/place` et `/info` sont **ephemeres** (flag 64) — seul l'utilisateur qui a tape la commande voit la reponse. Pas besoin de polluer le channel. `/canvas` est **public** avec un embed — on partage les stats avec tout le monde.

---

## 11. IAM & least privilege

### Q: Decris ton setup IAM
> Trois niveaux :
> 1. **Cloud Run invoker** : `allUsers` sur les 3 services (`placepixel`, `getcanvas`, `discordinteraction`). Public car c'est l'API publique. Protection applicative : signature ed25519 pour Discord, cooldown + validation pour les autres.
> 2. **Compute SA** (le runtime des Cloud Functions 2nd gen) : `roles/secretmanager.secretAccessor` uniquement sur les 3 secrets Discord. Pas `admin`, pas `viewer` global.
> 3. **Firestore rules** : default deny, `read: if true` sur `pixels/canvas`, ecritures uniquement via Admin SDK backend.

### Q: Tu aurais pu faire plus restrictif ?
> Idealement, **un service account dedie par fonction**. Actuellement les 3 fonctions partagent le compute default SA. Ca veut dire que si une fonction est compromise, elle peut acceder aux secrets de toutes. Fix futur : creer 3 SA dedies et ne donner les secrets qu'aux fonctions qui en ont besoin (seul discordInteraction lit `discord-public-key`).

### Q: Principe de least privilege applique ?
> Partiellement. Les secrets sont least-privilege (1 role, 1 scope). Firestore rules sont default-deny. Mais les SA Cloud Functions pourraient etre splits. Documente dans `docs/SECURITY.md` comme ameliration future.

---

## 12. Difficultes rencontrees

### Q: Quel a ete le plus dur ?
> **La verification de signature Discord**. L'API demande ed25519, il faut gerer le raw body (pas le JSON parse) pour la signature, les headers x-signature-ed25519 + x-signature-timestamp, et tester sans un vrai client Discord. J'ai ecrit 4 tests dediees (valid, tampered, missing, malformed hex) avec tweetnacl.sign pour generer des signatures de test.

### Q: Un bug que tu as du debug ?
> Au premier deploy, Cloud Functions a fail au healthcheck avec "container failed to start". Le log montrait une erreur require sur `shared/constants.json`. Cause : Firebase deploy ne bundle que le dossier `functions/`, mon `config.js` faisait `require("../../../shared/constants.json")` qui sortait du bundle. Fix : script de sync copie `shared/constants.json` → `functions/constants.json` avant le deploy, et config.js lit depuis `../../constants.json`.

### Q: Une decision que tu referais differemment ?
> **Je partirais tout de suite avec `placePixelCore` extrait** plutot que dans le handler HTTP. Je l'ai ajoute apres coup quand j'ai fait le handler Discord, j'ai du refactor. Si j'avais anticipe "plusieurs surfaces partagent la meme logique", j'aurais ecrit la fonction core des le depart.

---

## 13. Ameliorations possibles

### Q: Si tu avais 2 semaines de plus, tu ferais quoi ?
> 1. **Firebase ID token auth** sur placePixel → lock userId sur request.auth.uid → resout M1 securite
> 2. **Terraform** pour tout le provisioning GCP → bonus IaC du sujet
> 3. **Outbox pattern** pour Pub/Sub → resout M2 (garantie de delivery)
> 4. **Generation PNG** pour `/canvas` Discord (avec `pngjs` + Cloud Storage)
> 5. **Feature presence** : afficher "N users online" via un heartbeat collection
> 6. **Playwright e2e tests** : verifier le flow complet dans un navigateur
> 7. **Monitoring dashboard** custom Cloud Monitoring + alertes budget
> 8. **Canvas "infini"** avec chunks 10x10 charges par region

---

## 14. Questions pieges / adversariales

### Q: Ton rate limit peut etre bypasse par un bot
> Vrai. Le userId vient du body de la requete. Un script qui rotate 1000 userIds place 1000 pixels sans cooldown. **Mitigation documentee** (M1) : activer Firebase ID token verification cote backend et forcer `userId = request.auth.uid`. App Check bloquerait les bots non-browsers. Pas implemente car projet ecole. Pour prod, indispensable.

### Q: getCanvas peut coûter cher si quelqu'un spam la requete
> Canvas plein = 10k reads par appel. 1 req/s pendant 1h = 36M reads = ~$22. Fix : cacher le canvas dans Cloud Storage comme PNG regenere toutes les 2s par un Pub/Sub trigger, getCanvas renvoie juste l'URL signee. O(1) read au lieu de O(N).

### Q: Pourquoi l'observabilite n'est-elle pas implementee ?
> Le sujet dit "optionnel dans le contexte rattrapage". J'ai priorise les autres criteres. Les metriques par defaut de Cloud Functions et Firestore sont dispos dans Cloud Monitoring (invocations, latence p50/p95/p99, error rate) sans config. Si l'eval demande plus, je montrerai ces dashboards natifs.

### Q: Pub/Sub fire-and-forget c'est de la mauvaise architecture
> Vrai en prod. Fix = pattern transactional outbox : ecrire l'event dans une collection Firestore _dans_ la transaction, puis Eventarc trigger publie avec retry garanti. Je l'ai documente comme dette (M2). Non implemente car **aucun consumer ne consomme ces events en Phase 2** — impact actuel = zero.

### Q: Tu utilises `set()` sans merge, donc un user peut ecraser toute la donnee du doc pixel (userId du precedent, etc.)
> C'est le comportement voulu. Un nouveau pixel remplace completement le precedent — seul le dernier `userId` qui a colorise la case est memorise. C'est le modele r/place historique.

### Q: Pourquoi pas Cloud Spanner pour le data layer (transactions plus robustes) ?
> Spanner n'est pas serverless au sens scale-to-zero. C'est une base relationelle distribuee qui a un cout minimum d'allocation (~$900/mois). Over-engineered pour 10k pixels.

---

## 15. Cheat sheet (chiffres a retenir)

| Question | Reponse |
|----------|---------|
| Taille canvas | 100 × 100 = 10 000 pixels |
| Palette | 16 couleurs (compatible format r/place) |
| Cooldown | 5 secondes par user |
| Nombre de tests | 64 tests, 5 suites, 91% coverage |
| Nombre de Cloud Functions | 3 (placePixel, getCanvas, discordInteraction) |
| Slash commands | 3 (/place, /canvas, /info) |
| Region | europe-west1 (Belgique) |
| Cout sur free tier | 0€ — marge enorme |
| Runtime | Node.js 20 (Cloud Functions 2nd gen) |
| Latence P50 placePixel | ~200-300ms (dominee par transaction Firestore) |
| Nombre d'APIs activees | 8 (cloudfunctions, firestore, pubsub, secretmanager, cloudbuild, eventarc, artifactregistry, run) |
| Commits git | 34 (dont 33 avec messages detailles par module/feature) |

## 16. Urls a avoir sous la main

| Ressource | URL |
|-----------|-----|
| App web | https://pixel-epitech.web.app |
| placePixel | https://placepixel-i6ah2cnwha-ew.a.run.app |
| getCanvas | https://getcanvas-i6ah2cnwha-ew.a.run.app |
| discordInteraction | https://europe-west1-pixel-epitech.cloudfunctions.net/discordInteraction |
| Repo GitHub | https://github.com/yepun01/Cloud |
| Firebase Console | https://console.firebase.google.com/project/pixel-epitech |
| Firestore data viewer | https://console.firebase.google.com/project/pixel-epitech/firestore/data |
| Cloud Run services | https://console.cloud.google.com/run?project=pixel-epitech |
| Secret Manager | https://console.cloud.google.com/security/secret-manager?project=pixel-epitech |

---

## 17. Si tu es bloque sur une question

Reponses neutres a sortir quand tu hesites :

- **"C'est une decision de scope accepte, documentee dans `docs/SECURITY.md`"** — pour tout ce qui est dette technique (auth, outbox, PNG generation, App Check)
- **"Le sujet indique que l'observabilite est optionnelle en rattrapage"** — si on te pousse sur monitoring
- **"Je montre ca en live, c'est plus rapide"** — ouvre Firestore Console ou la demo
- **"Bonne question, dans un contexte prod je ferais X, ici j'ai simplifie parce que Y"** — reponse toute faite pour les trade-offs

Si vraiment tu ne sais pas : **"Je ne suis pas sur de la reponse exacte, mais ma comprehension c'est [X]. Si c'est critique je peux verifier dans la doc."** Ne pas bluffer.
