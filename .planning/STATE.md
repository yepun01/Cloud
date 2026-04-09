# State — Collaborative Pixel Canvas

## Phase actuelle: PROJET LIVRABLE — pret pour evaluation

Avancement global : **~95%**. Reste optionnel : Phase 5 (Pub/Sub end-to-end), Phase 6 fix M1-M3 (auth lock-down).

## Phases completees

### Phase 1: Infrastructure & Setup (2026-03-31 → 2026-04-14)
- **Statut**: Terminee
- **Setup cloud realise** : projet GCP `pixel-epitech`, 8 APIs activees, Firestore Native (europe-west1), topic Pub/Sub `pixel-events`, 3 secrets Discord stockes + IAM binding, slash commands enregistrees, Firebase Auth (Anonymous + Google) active, bot Discord cree et invite

### Phase 2: Backend Core API (2026-04-16)
- **Statut**: Terminee + DEPLOYEE
- **Endpoints live** : `placePixel`, `getCanvas` (region europe-west1, public via run.invoker)
- **Tests** : 51/51 PASS, coverage 90.99%
- **Decisions techniques** : 1 doc/pixel sur `pixels/{x}_{y}`, rate limit via Firestore transaction sur `users/{userId}`, `FieldValue.serverTimestamp()`, last-write-wins, 1 endpoint = 1 Cloud Function
- **Refactor (Phase 3)** : extraction `placePixelCore`, `getCanvasCore`, `getUserStats` pour appel direct depuis le handler Discord (pas de roundtrip HTTP)

### Phase 4: Frontend interactif (2026-04-16)
- **Statut**: Terminee + DEPLOYEE
- **URL** : https://pixel-epitech.web.app
- **Stack** : Vanilla JS + HTML5 Canvas + Firebase JS SDK v10 modular CDN ESM, anonymous auth uniquement (decision utilisateur)
- **Modules** : `firebase-config.js`, `firebase-init.js`, `api.js`, `realtime.js`, `canvas.js`, `zoom-pan.js`, `app.js`
- **Features** : load initial via getCanvas + onSnapshot real-time, optimistic placement + rollback, palette 16 couleurs, cooldown UI, wheel zoom 1-4x, shift+drag pan, toast notifications

### Phase 3: Discord bot handler (2026-04-17)
- **Statut**: Terminee + DEPLOYEE
- **URL** : https://europe-west1-pixel-epitech.cloudfunctions.net/discordInteraction
- **Tests** : 64/64 PASS (51 phase 2 + 13 phase 3)
- **Modules** : `signature.js` (ed25519 verify), `handlers.js` (3 commands), `discordInteraction.js` (entry point)
- **Commandes Discord** : `/place x y color`, `/canvas`, `/info` — toutes branchees sur le backend, ephemeral pour /place et /info, public pour /canvas
- **Convention userId** : `discord:<snowflake>` (matche `web:<uid>`)
- **Etape manuelle restante** : configurer l'**Interactions Endpoint URL** dans le Discord Developer Portal (PixelBoard app > General Information)

### Phase 7: Documentation (2026-04-17)
- **Statut**: Terminee
- **Fichiers crees** :
  - `docs/ARCHITECTURE.md` — diagrammes Mermaid (high-level + sequence flows), data model, security layers, scalability
  - `docs/API.md` — reference HTTP endpoints (placePixel, getCanvas, discordInteraction)
  - `docs/SECURITY.md` — audit IAM + secrets + rules + findings (0 critical, 0 high, 3 medium accepted)
  - `docs/SETUP_GUIDE.md` — zero-to-deploy guide (deja existant Phase 1)
  - `docs/DEMO.md` — script de presentation 5-7 min + Q&A jury
- **README.md** — re-ecrit avec badges, features, stack, quick start, structure, doc index

### Phase 6: Audit securite rapide (2026-04-17)
- **Statut**: Terminee (verifications IAM/secrets/rules)
- **Findings** : 0 critical, 0 high, 3 medium documente comme dette acceptee, 2 low cleanup
- **Verifications faites** :
  - Cloud Run invoker bindings (placepixel, getcanvas, discordinteraction tous public via allUsers — intentionnel, layer auth est applicatif)
  - Secret Manager bindings (3 secrets accessible UNIQUEMENT par compute SA — least privilege)
  - Firestore rules (default deny, public read pixels/canvas, deny client writes)
  - Input validation (strict integers, palette enum, userId max 100 chars)
  - Secrets in code scan (aucun secret en dur, firebase-config.js public est OK par design Firebase)

## Dette technique acceptee (projet ecole)

| ID | Description | Severite | Fix futur |
|----|-------------|----------|-----------|
| M1 | userId client-asserte (pas authentifie cote backend) | Medium | Phase 6 prod : Firebase ID token verification + lock userId = request.auth.uid |
| M2 | Pub/Sub publish fire-and-forget sans outbox | Medium | Phase 5 : pattern transactional outbox via collection events/ + Eventarc |
| M3 | Pas de timeout sur publishPixelEvent | Medium | Quick fix : Promise.race avec 3s timeout |
| L1 | Rule Firestore users/{userId} dead branch (userId prefixe) | Low | Cleanup ou align avec Phase 6 |
| L2 | Pas de cleanup policy Artifact Registry | Low | `firebase functions:artifacts:setpolicy` |

## Phases restantes (optionnelles)

- **Phase 5: Event-Driven complet** — implementer un consumer Pub/Sub pour fan-out (deja partiellement fait : publish OK, juste pas de subscriber). Estimation : 30 min.
- **Phase 8: Bonus** — Terraform IaC, canvas infini chunked, Cloud Monitoring dashboards, UX avancee (minimap, historique). Tous bonus, pas necessaires pour la note de base.

## Endpoints live

| Surface | URL |
|---------|-----|
| Web SPA | https://pixel-epitech.web.app |
| placePixel | https://placepixel-i6ah2cnwha-ew.a.run.app |
| getCanvas | https://getcanvas-i6ah2cnwha-ew.a.run.app |
| discordInteraction | https://europe-west1-pixel-epitech.cloudfunctions.net/discordInteraction |

## Prochaines actions recommandees

1. **Commit final** : `git add -A && git commit -m "..."` (le dernier commit etait Phase 3, faut commit Phase 7 + Phase 6)
2. **Test demo** : suivre `docs/DEMO.md` end-to-end pour s'assurer que tout marche avant l'eval
3. **Optionnel** : implement les 3 fixes M1/M2/M3 si temps
4. **Optionnel** : Terraform IaC pour bonus
