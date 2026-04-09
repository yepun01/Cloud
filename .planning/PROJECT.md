# Collaborative Pixel Canvas — Project Definition

## Nom du projet
**PixelBoard** — Clone serverless de Reddit r/place sur Google Cloud Platform

## Description
Plateforme de dessin collaboratif temps-reel ou les utilisateurs placent des pixels sur un canvas partage via :
1. **Bot Discord** — slash commands (`/place`, `/canvas`, `/info`)
2. **Interface web** — canvas interactif avec placement au clic

Architecture 100% serverless, event-driven, securisee (IAM + least privilege), scalable.

## Stack Technique GCP

### Services principaux

| Service GCP | Role | Justification |
|---|---|---|
| **Cloud Functions (2nd gen)** | Logique metier (place pixel, get canvas, Discord interactions) | Serverless compute, scale-to-zero, HTTP triggers natifs |
| **Firestore** | Base de donnees (pixels, users, rate-limits) | NoSQL serverless, real-time listeners natifs, scale automatique |
| **Firebase Hosting** | Hebergement frontend web (SPA) | CDN global, deploy simple, HTTPS automatique |
| **Firebase Auth** | Authentification utilisateurs web | Integration native Firestore, OAuth2 providers |
| **Cloud Storage** | Snapshots canvas (images generees pour Discord) | Stockage objets serverless, pas de gestion de volumes |
| **Pub/Sub** | Messaging event-driven (pixel events) | Decouplage composants, async processing |
| **Eventarc** | Routage evenements (Firestore triggers → Pub/Sub) | Glue event-driven native GCP |
| **Secret Manager** | Secrets (Discord token, cles API) | Gestion securisee, versionning, acces IAM |
| **API Gateway** | Exposition REST API, rate limiting HTTP | Point d'entree unique, OpenAPI spec |

### Services optionnels (bonus)

| Service GCP | Role | Justification |
|---|---|---|
| **Cloud Scheduler** | Taches periodiques (snapshot canvas, cleanup) | Cron serverless |
| **Cloud Monitoring** | Observabilite (metriques, alertes) | Monitoring natif GCP |
| **Cloud Logging** | Logs structures | Deja actif par defaut sur Cloud Functions |

## Stack Technique Application

| Composant | Technologie | Justification |
|---|---|---|
| **Backend** | Node.js 20 (Cloud Functions) | Runtime rapide, ecosystem npm, bon support GCP SDK |
| **Frontend** | Vanilla JS + HTML5 Canvas | Leger, pas de build complexe, performance rendu canvas |
| **Discord Bot** | Discord Interactions API (HTTP) | Pas de WebSocket gateway = 100% serverless |
| **IaC (bonus)** | Terraform | Standard industrie, bonne couverture GCP |

## Contraintes

- **100% serverless** — aucune VM, aucun container gere manuellement, aucun processus always-on
- **GCP uniquement** — tous les services doivent etre GCP/Firebase
- **Event-driven** — communication asynchrone entre composants via Pub/Sub/Eventarc
- **Securite** — IAM least privilege, validation des inputs, secrets en Secret Manager
- **Scalabilite** — gestion de la concurrence multi-utilisateurs sans conflits

## Hypotheses

- Canvas de taille fixe (ex: 100x100 pixels) — extensible plus tard si bonus "infinite canvas"
- Palette de couleurs predefinies (ex: 16 couleurs) pour simplifier la validation
- Cooldown par utilisateur (ex: 5 secondes entre chaque placement)
- Un seul canvas actif a la fois
- Les utilisateurs Discord sont identifies par leur Discord ID
- Les utilisateurs web s'authentifient via Firebase Auth (Google login ou anonymous)

## Structure du Repo

```
/
├── functions/           # Cloud Functions (backend)
│   ├── src/
│   │   ├── pixel/       # Place pixel, get canvas
│   │   ├── discord/     # Discord interaction handler
│   │   ├── auth/        # Auth helpers
│   │   └── shared/      # Modeles, validation, rate-limit
│   ├── package.json
│   └── index.js         # Entry points
├── web/                 # Frontend (Firebase Hosting)
│   ├── public/
│   │   ├── index.html
│   │   ├── app.js
│   │   ├── canvas.js
│   │   └── style.css
│   └── firebase.json
├── infra/               # IaC Terraform (bonus)
├── docs/                # Documentation, diagrammes
├── scripts/             # Scripts utilitaires (deploy, register commands)
├── .planning/           # Planning projet
└── README.md
```
