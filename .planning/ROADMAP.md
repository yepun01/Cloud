# Roadmap — Collaborative Pixel Canvas

## Objectif
Livrer un clone r/place 100% serverless sur GCP avec bot Discord + interface web temps reel.

## Criteres de succes
- [ ] Placement de pixels via Discord slash commands
- [ ] Placement de pixels via interface web
- [ ] Canvas affiche en temps reel sur le web
- [ ] Rate limiting fonctionnel
- [ ] Architecture 100% serverless (aucune VM/container)
- [ ] IAM least privilege sur tous les composants
- [ ] Documentation + diagramme d'architecture

---

## Phase 1: Infrastructure & Setup

> **Objectif**: Avoir un projet GCP fonctionnel, un repo structure, et tous les services de base provisionnes.

| # | Tache | Type | Taille | depends_on | wave |
|---|-------|------|--------|------------|------|
| 1.1 | Initialiser la structure du repo (functions/, web/, docs/, scripts/) | 🧹 | XS | - | 1 |
| 1.2 | Creer le projet GCP + activer les APIs (Firestore, Cloud Functions, Pub/Sub, Secret Manager, Firebase) | 🏗️ | S | - | 1 |
| 1.3 | Creer l'application Discord + configurer le bot (token, permissions) | 🏗️ | XS | - | 1 |
| 1.4 | Stocker les secrets dans Secret Manager (Discord token, public key) | 🏗️ | XS | 1.2, 1.3 | 2 |
| 1.5 | Provisionner Firestore (mode Native) + definir les indexes | 🏗️ | S | 1.2 | 2 |
| 1.6 | Setup Firebase Hosting + domaine | 🏗️ | S | 1.2 | 2 |
| 1.7 | Setup Firebase Auth (Google provider + anonymous) | 🏗️ | S | 1.2 | 2 |

**Livrable**: Projet GCP operationnel, repo structure, services provisionnes.

---

## Phase 2: Data Model & Core API

> **Objectif**: Backend fonctionnel capable de placer et lire des pixels avec rate limiting.

| # | Tache | Type | Taille | depends_on | wave |
|---|-------|------|--------|------------|------|
| 2.1 | Designer le modele Firestore (collections: pixels, users, canvas metadata) | 🔬 | S | 1.5 | 3 |
| 2.2 | Cloud Function: `placePixel` — validation + ecriture Firestore | 🏗️ | M | 2.1 | 4 |
| 2.3 | Cloud Function: `getCanvas` — lecture du canvas complet | 🏗️ | S | 2.1 | 4 |
| 2.4 | Middleware rate limiting (cooldown par user dans Firestore) | 🏗️ | S | 2.1 | 4 |
| 2.5 | Integrer rate limiting dans `placePixel` | 🏗️ | S | 2.2, 2.4 | 5 |
| 2.6 | Tests manuels: placer un pixel via curl, verifier Firestore | 🐛 | XS | 2.2, 2.3 | 5 |

**Livrable**: API fonctionnelle — on peut placer et lire des pixels via HTTP.

---

## Phase 3: Bot Discord

> **Objectif**: Bot Discord fonctionnel avec slash commands pour interagir avec le canvas.

| # | Tache | Type | Taille | depends_on | wave |
|---|-------|------|--------|------------|------|
| 3.1 | Cloud Function: endpoint interactions Discord (signature verification ed25519) | 🏗️ | M | 1.4, 2.2 | 5 |
| 3.2 | Script d'enregistrement des slash commands (/place, /canvas, /info) | 🏗️ | S | 1.3 | 3 |
| 3.3 | Handler `/place <x> <y> <couleur>` — appel placePixel | 🏗️ | M | 3.1, 2.5 | 6 |
| 3.4 | Handler `/canvas` — generer image PNG du canvas + envoi Discord | 🏗️ | M | 3.1, 2.3 | 6 |
| 3.5 | Handler `/info` — infos canvas (taille, pixels places, cooldown user) | 🏗️ | S | 3.1, 2.3 | 6 |
| 3.6 | Configurer l'Interaction Endpoint URL dans Discord Developer Portal | 🏗️ | XS | 3.1 | 6 |
| 3.7 | Tests end-to-end Discord: placer un pixel, voir le canvas | 🐛 | S | 3.3, 3.4 | 7 |

**Livrable**: Bot Discord fonctionnel — slash commands operationnelles.

---

## Phase 4: Interface Web

> **Objectif**: SPA web avec canvas interactif, auth, et placement de pixels.

| # | Tache | Type | Taille | depends_on | wave |
|---|-------|------|--------|------------|------|
| 4.1 | Scaffold de l'app web (index.html, app.js, style.css) | 🏗️ | S | 1.1 | 3 |
| 4.2 | Composant Canvas: rendu grille de pixels (HTML5 Canvas API) | 🏗️ | M | 4.1 | 4 |
| 4.3 | Charger et afficher l'etat du canvas depuis Firestore/API | 🏗️ | S | 4.2, 2.3 | 5 |
| 4.4 | Integration Firebase Auth (login Google + anonymous) | 🏗️ | M | 4.1, 1.7 | 4 |
| 4.5 | UI placement: clic sur pixel + selection couleur (palette) | 🏗️ | M | 4.2, 4.4, 2.2 | 5 |
| 4.6 | Affichage cooldown restant apres placement | 🏗️ | S | 4.5, 2.5 | 6 |
| 4.7 | Real-time: Firestore onSnapshot listeners pour mise a jour live | 🏗️ | M | 4.3 | 6 |
| 4.8 | Navigation canvas: zoom + pan (scroll/drag) | 🏗️ | M | 4.2 | 5 |
| 4.9 | Deploy sur Firebase Hosting | 🏗️ | XS | 4.5, 1.6 | 6 |
| 4.10 | Tests end-to-end web: auth, place pixel, voir update | 🐛 | S | 4.7, 4.9 | 7 |

**Livrable**: Interface web fonctionnelle avec canvas temps reel.

---

## Phase 5: Event-Driven Architecture & Integration

> **Objectif**: Architecture event-driven complete, Discord et Web partageant le meme flux.

| # | Tache | Type | Taille | depends_on | wave |
|---|-------|------|--------|------------|------|
| 5.1 | Creer topic Pub/Sub `pixel-placed` | 🏗️ | XS | 1.2 | 3 |
| 5.2 | Publisher: emettre evenement Pub/Sub apres chaque placePixel | 🏗️ | S | 5.1, 2.2 | 5 |
| 5.3 | Eventarc: configurer trigger Firestore → Cloud Function (optionnel: processing async) | 🏗️ | S | 5.1, 2.2 | 5 |
| 5.4 | Test integration cross-platform: Discord place pixel → Web le voit en temps reel | 🐛 | M | 3.7, 4.10 | 8 |

**Livrable**: Architecture event-driven validee, flux cross-platform fonctionnel.

---

## Phase 6: Securite & Hardening

> **Objectif**: IAM least privilege, validation robuste, securite Firestore.

| # | Tache | Type | Taille | depends_on | wave |
|---|-------|------|--------|------------|------|
| 6.1 | Creer des service accounts dedies par Cloud Function | 🏗️ | M | 2.2, 3.1 | 7 |
| 6.2 | Configurer IAM roles least privilege sur chaque service account | 🏗️ | M | 6.1 | 8 |
| 6.3 | Ecrire les Firestore Security Rules | 🏗️ | S | 2.1 | 5 |
| 6.4 | Audit validation inputs (coordonnees, couleurs, auth tokens) | 🐛 | S | 2.2, 3.1 | 7 |
| 6.5 | Configuration CORS stricte sur les endpoints HTTP | 🏗️ | XS | 2.2 | 5 |
| 6.6 | Verifier qu'aucun secret n'est expose (env vars, logs, code) | 🐛 | S | 1.4 | 7 |

**Livrable**: Securite validee — IAM, rules, validation, secrets.

---

## Phase 7: Documentation & Delivery

> **Objectif**: Documentation complete pour evaluation, pret pour demo.

| # | Tache | Type | Taille | depends_on | wave |
|---|-------|------|--------|------------|------|
| 7.1 | Diagramme d'architecture (Mermaid dans docs/) | 📝 | M | 5.4 | 9 |
| 7.2 | README: instructions setup de zero a deploy | 📝 | M | 5.4 | 9 |
| 7.3 | Documentation API (endpoints, parametres, reponses) | 📝 | S | 2.2, 3.1 | 9 |
| 7.4 | Script de demo: scenario de presentation | 📝 | S | 5.4 | 9 |

**Livrable**: Projet pret pour evaluation et demonstration.

---

## Bonus (Phase 8 — si core termine)

> **Objectif**: Points bonus pour differencier le projet.

| # | Tache | Type | Taille | depends_on | wave |
|---|-------|------|--------|------------|------|
| 8.1 | Infrastructure as Code: Terraform pour tous les services GCP | 🏗️ | L | 5.4 | 9 |
| 8.2 | Canvas "infini": chunked loading + viewport dynamique | 🏗️ | L | 4.7 | 9 |
| 8.3 | Advanced monitoring: dashboard Cloud Monitoring + alertes | 🏗️ | M | 5.4 | 9 |
| 8.4 | UX avancee: minimap, historique pixels, animations | 🏗️ | M | 4.7 | 9 |
| 8.5 | API Gateway: configuration OpenAPI + rate limiting HTTP | 🏗️ | M | 2.2 | 9 |

---

## Chemin Critique

Le chemin critique (sequence la plus longue de dependances) est:

```
1.2 → 1.5 → 2.1 → 2.2 → 2.5 → 3.1 → 3.3 → 3.7 → 5.4 → 7.1
 S      S     S     M     S     M     M     S     M     M
```

**Estimation chemin critique**: ~8 taches de taille S-M = coeur du projet.

Tout retard sur le backend (Phase 2) impacte directement Discord ET Web.

## Taches parallelisables

| Wave | Taches en parallele |
|------|---------------------|
| 1 | 1.1, 1.2, 1.3 (totalement independantes) |
| 2 | 1.4, 1.5, 1.6, 1.7 (tous dependent de 1.2 mais independants entre eux) |
| 3 | 2.1, 3.2, 4.1, 5.1 (setup data, Discord commands, web scaffold, Pub/Sub) |
| 4 | 2.2, 2.3, 2.4, 4.2, 4.4 (backend core + frontend core en parallele) |
| 5 | 2.5, 3.1, 4.3, 4.5, 4.8, 5.2, 5.3, 6.3, 6.5 (integration les deux) |
| 6 | 3.3, 3.4, 3.5, 4.6, 4.7, 4.9 (handlers Discord + real-time web) |
| 7 | 3.7, 4.10, 6.1, 6.4, 6.6 (tests + securite) |
| 8 | 5.4, 6.2 (integration finale + IAM) |
| 9 | 7.1, 7.2, 7.3, 7.4 + bonus (doc + bonus en parallele) |

**Conclusion**: Les Phases 3 (Discord) et 4 (Web) sont largement parallelisables une fois la Phase 2 terminee. C'est le levier principal pour accelerer le projet.

## Risques identifies

| Risque | Impact | Mitigation |
|--------|--------|------------|
| Discord Interactions API complexe (signature ed25519) | Bloque tout le bot Discord | Spike early (3.1), utiliser lib `discord-interactions` |
| Performance Firestore avec canvas large | Latence lecture canvas, couts | Chunking par region, pagination, canvas 100x100 max |
| Real-time Firestore listeners sur tout le canvas | Trop de reads, couts eleves | Listeners par chunk/region, pas le canvas entier |
| Rate limiting contournable | Spam de pixels | Validation server-side obligatoire, ne pas faire confiance au client |
| Depassement quota GCP free tier | Facturation inattendue | Configurer budget alerts, tester localement d'abord |
| Generation image canvas pour Discord lente | Timeout Cloud Function | Canvas bitmap en memoire, lib `canvas` (node-canvas) |

## Premiere action

**Tache 1.1**: Creer la structure du repo (`functions/`, `web/`, `docs/`, `scripts/`) + initialiser `package.json` dans `functions/` avec les dependances de base (`@google-cloud/firestore`, `@google-cloud/pubsub`, `firebase-functions`).

En parallele: **Tache 1.2** (setup GCP) et **Tache 1.3** (setup Discord app) — ces 3 taches sont completement independantes.
