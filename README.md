# PixelBoard

[![Live Demo](https://img.shields.io/badge/demo-pixel--epitech.web.app-blue)](https://pixel-epitech.web.app)
[![Tests](https://img.shields.io/badge/tests-64%20passed-success)]()
[![Coverage](https://img.shields.io/badge/coverage-91%25-success)]()
[![Serverless](https://img.shields.io/badge/100%25-serverless-orange)]()

100% serverless collaborative pixel canvas inspired by Reddit's [r/place](https://en.wikipedia.org/wiki/R/place). Users draw on a shared 100×100 canvas through **two interfaces sharing one backend**: a web SPA and a Discord bot. Real-time sync, rate-limiting, ed25519-verified Discord interactions, fully event-driven.

> **Live demo**: https://pixel-epitech.web.app
> **Discord bot**: invite the bot, then `/place x:50 y:50 color:Red`

---

## Features

- **Web SPA** (`web/public/`) — Vanilla JS + HTML5 Canvas + Firebase JS SDK v10. Anonymous Firebase Auth, Firestore real-time listeners (no polling), wheel zoom + Shift+drag pan, optimistic pixel placement with rollback on error.
- **Discord bot** — `/place x y color`, `/canvas`, `/info` slash commands. ed25519 signature verification on every interaction. Same backend cooldown as the web (per-`userId` 5 s).
- **Backend** — 3 Cloud Functions 2nd gen in `europe-west1`: `placePixel`, `getCanvas`, `discordInteraction`. Firestore transactions guarantee atomic rate-limiting. Pub/Sub topic `pixel-events` for downstream fan-out.
- **Tests** — 64 Jest tests (validation, rate limit, transactions, Discord signature, dispatcher, all 8 must-pass scenarios from `criteria.md`). 91% coverage.
- **Documentation** — Architecture diagram (Mermaid), API reference, end-to-end demo script, zero-to-deploy setup guide.

## Stack

| Concern | Tech |
|---------|------|
| Compute | Cloud Functions 2nd gen (Node.js 20) |
| Database | Firestore Native (`europe-west1`) |
| Hosting | Firebase Hosting |
| Auth (web) | Firebase Auth (Anonymous) |
| Auth (Discord) | ed25519 signature verification (`tweetnacl`) |
| Messaging | Pub/Sub |
| Secrets | Secret Manager |
| Frontend | Vanilla JS + HTML5 Canvas + Firebase JS SDK v10 (modular CDN ESM) |
| Tests | Jest |

**No VMs, no containers I manage, no always-on processes.**

---

## Quick start

Three options depending on how much you already have set up.

### A — Try it without installing anything

Open https://pixel-epitech.web.app in two tabs, click pixels, watch them sync in real time.

### B — Run against the existing project (`pixel-epitech`)

```bash
git clone <repo-url> && cd pixelboard
cd functions && npm install && cd ..
firebase login
firebase use pixel-epitech
./scripts/deploy.sh
```

### C — Deploy a fresh instance from scratch

Follow [`docs/SETUP_GUIDE.md`](docs/SETUP_GUIDE.md) — step-by-step from `gcloud auth login` to a working Discord bot. Total ~30 min.

---

## Documentation

| File | Purpose |
|------|---------|
| [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) | Component diagram, data model, key flows (Mermaid sequence diagrams), security layers, scalability characteristics |
| [`docs/API.md`](docs/API.md) | HTTP endpoint reference (request, response, errors) for `placePixel`, `getCanvas`, `discordInteraction` |
| [`docs/SETUP_GUIDE.md`](docs/SETUP_GUIDE.md) | Zero-to-deploy guide (GCP project, Firebase, Discord app, secrets, deploy, verify) |
| [`docs/DEMO.md`](docs/DEMO.md) | 5-7 min demo script with Q&A preparation |
| [`.planning/PROJECT.md`](.planning/PROJECT.md), [`.planning/REQUIREMENTS.md`](.planning/REQUIREMENTS.md), [`.planning/ROADMAP.md`](.planning/ROADMAP.md) | Original specs and roadmap |
| [`.planning/STATE.md`](.planning/STATE.md) | What's done, what's pending |

## Repository structure

```
functions/                   # Cloud Functions backend
├── index.js                 # Exports placePixel, getCanvas, discordInteraction
├── src/
│   ├── pixel/               # placePixel.js (HTTP + core), getCanvas.js (HTTP + core)
│   ├── discord/             # discordInteraction.js, handlers.js, signature.js
│   └── shared/              # config, firestore, auth, rateLimit, validation, pubsub
└── __tests__/               # 64 Jest tests, 91% coverage

web/public/                  # Firebase Hosting SPA (Vanilla JS + Firebase v10 modular)
├── index.html
├── style.css
├── firebase-config.js       # public Firebase Web App config
├── firebase-init.js         # Firebase SDK init + anonymous auth
├── api.js                   # placePixel / getCanvas fetch wrappers
├── realtime.js              # onSnapshot listener for the pixels collection
├── canvas.js                # rendering helpers
├── zoom-pan.js              # wheel zoom + shift+drag pan
└── app.js                   # entry point + state + click/cooldown

scripts/                     # Automation
├── setup-gcp.sh             # enable APIs, create Firestore + Pub/Sub topic
├── setup-discord.sh         # guide for Discord app + secrets
├── register-commands.js     # registers /place /canvas /info via Discord REST
├── deploy.sh                # npm ci + sync-config + firebase deploy
└── sync-config-gen.js       # generates frontend/backend constants from shared/constants.json

shared/
└── constants.json           # SSOT: canvas size, palette, cooldown
```

## Run tests

```bash
cd functions
npm test                      # 64/64 PASS
npx jest --coverage           # ~91% global
```

## Configuration

A single source of truth: `shared/constants.json`. Change values there, then run `./scripts/sync-config.sh` (or `./scripts/deploy.sh`, which calls it) to propagate to backend and frontend.

| Constant | Default |
|----------|---------|
| Canvas | 100 × 100 |
| Cooldown | 5 s per `userId` |
| Palette | 16 fixed colors |

## License

Educational project — Epitech remediation, Cloud-Native & Serverless module.
