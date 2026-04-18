# PixelBoard — Schema d'infrastructure

## Vue d'ensemble (all services, deployed in `pixel-epitech` / `europe-west1`)

```mermaid
graph TB
    subgraph internet["INTERNET"]
        browser["Browser<br/>(any device)"]
        discord["Discord client<br/>(user's phone/desktop)"]
    end

    subgraph discord_platform["DISCORD PLATFORM"]
        discord_api["Discord API<br/>gateway.discord.gg<br/>(signs interactions with ed25519)"]
    end

    subgraph gcp["GCP — Project pixel-epitech"]
        subgraph edge["GLOBAL EDGE"]
            hosting["Firebase Hosting<br/>pixel-epitech.web.app<br/>(static assets CDN)"]
            auth["Firebase Authentication<br/>(Anonymous provider)"]
        end

        subgraph europe_west1["Region: europe-west1 (Belgium)"]
            subgraph cloud_run["Cloud Run / Cloud Functions 2nd gen"]
                fn_place["placePixel<br/>Node.js 20<br/>cors: true"]
                fn_get["getCanvas<br/>Node.js 20<br/>cors: true"]
                fn_discord["discordInteraction<br/>Node.js 20<br/>secrets bound"]
            end

            subgraph firestore_native["Firestore Native"]
                pixels_col[("pixels/&lt;x&gt;_&lt;y&gt;<br/>{x, y, color, userId, placedAt}")]
                users_col[("users/&lt;userId&gt;<br/>{lastPlacedAt, placedCount}")]
                canvas_col[("canvas/main<br/>{width, height, palette}")]
            end
        end

        subgraph global_gcp["Global services"]
            pubsub[["Pub/Sub topic<br/>pixel-events"]]
            sm["Secret Manager<br/>discord-bot-token<br/>discord-public-key<br/>discord-app-id"]
            artifact["Artifact Registry<br/>(function container images)"]
        end

        subgraph iam["IAM"]
            sa["Compute SA<br/>252801134584-compute<br/>@developer.gserviceaccount.com<br/><br/>roles:<br/>• run.invoker (public invocations)<br/>• secretmanager.secretAccessor<br/>  (on 3 discord secrets)"]
        end
    end

    browser -- "HTTPS" --> hosting
    browser -- "signInAnonymously" --> auth
    browser -- "POST fetch" --> fn_place
    browser -- "GET fetch" --> fn_get
    browser -- "onSnapshot WebSocket" --> pixels_col

    discord -. "slash command" .-> discord_api
    discord_api -- "POST signed body" --> fn_discord

    fn_discord -- "verify signature" --> sm
    fn_discord -- "internal call (in-process)" --> fn_place
    fn_discord -- "internal call (in-process)" --> fn_get

    fn_place -- "runTransaction" --> pixels_col
    fn_place -- "runTransaction" --> users_col
    fn_place -- "publish pixel-placed" --> pubsub

    fn_get -- "collection read" --> pixels_col
    fn_get -- "doc read" --> users_col

    cloud_run -. "runs as" .-> sa
    sa -. "reads" .-> sm

    classDef client fill:#2a4a7f,color:#fff,stroke:#9bd
    classDef gcp_service fill:#1e3a5f,color:#fff,stroke:#4a90e2
    classDef storage fill:#4a2a5f,color:#fff,stroke:#c96ee4
    classDef security fill:#7f1a1a,color:#fff,stroke:#ff5c5c
    classDef discord fill:#5865F2,color:#fff,stroke:#7289da

    class browser,discord client
    class hosting,auth,fn_place,fn_get,fn_discord,artifact gcp_service
    class pixels_col,users_col,canvas_col,pubsub storage
    class sm,sa security
    class discord_api discord
```

---

## Data flow — placement d'un pixel

```mermaid
graph LR
    U["Browser"] -.->|"1. click (x, y)"| APP["app.js<br/>(client)"]
    APP -->|"2. POST /placePixel"| PP["placePixel<br/>Cloud Function"]

    PP -->|"3. runTransaction"| FS[("Firestore")]
    FS -.->|"4. read users/uid<br/>(cooldown check)"| PP
    FS -.->|"5a. ecrit pixel + user<br/>(atomique)"| FS
    PP -->|"6. publish"| PS[["Pub/Sub<br/>pixel-events"]]
    PP -->|"7. 200 OK"| APP

    FS -.->|"8. onSnapshot delta"| APP
    APP -.->|"9. render"| U

    style U fill:#2a4a7f,color:#fff
    style APP fill:#2a4a7f,color:#fff
    style PP fill:#1e3a5f,color:#fff
    style FS fill:#4a2a5f,color:#fff
    style PS fill:#4a2a5f,color:#fff
```

---

## Surface d'attaque et controles

```mermaid
graph LR
    subgraph threats["Menaces"]
        T1["Script spam<br/>placePixel"]
        T2["Forge<br/>Discord request"]
        T3["Ecrire directement<br/>dans Firestore"]
        T4["Lire les secrets"]
    end

    subgraph defenses["Defenses en place"]
        D1["Cooldown 5s<br/>per userId<br/>(Firestore transaction)"]
        D2["ed25519 signature<br/>verification<br/>(tweetnacl)"]
        D3["Firestore rules<br/>allow write: if false<br/>(clients)"]
        D4["Secret Manager<br/>IAM binding least privilege<br/>(runtime SA only)"]
    end

    T1 -. "mitigated by" .-> D1
    T2 -. "mitigated by" .-> D2
    T3 -. "mitigated by" .-> D3
    T4 -. "mitigated by" .-> D4

    classDef threat fill:#7f1a1a,color:#fff,stroke:#ff5c5c
    classDef defense fill:#1e5c1e,color:#fff,stroke:#94e044

    class T1,T2,T3,T4 threat
    class D1,D2,D3,D4 defense
```

---

## ASCII fallback (pour pdf / slide simple)

```
┌─────────────────────────────────────────────────────────────────────┐
│                               INTERNET                              │
│   ┌─────────────┐                              ┌──────────────┐     │
│   │   Browser   │                              │ Discord user │     │
│   └──────┬──────┘                              └───────┬──────┘     │
└──────────│─────────────────────────────────────────────│────────────┘
           │                                             │
           │                                   ┌─────────▼─────────┐
           │                                   │   Discord API     │
           │                                   │ (signs ed25519)   │
           │                                   └─────────┬─────────┘
           │                                             │
┌──────────│─────────────────────────────────────────────│────────────┐
│          │                GCP — pixel-epitech          │            │
│          │                                             │            │
│  ┌───────▼────────┐  ┌─────────────┐           ┌───────▼─────────┐  │
│  │ Firebase       │  │  Firebase   │           │ discordInterac- │  │
│  │ Hosting        │  │  Auth       │           │ tion (CF2)      │  │
│  │ (static SPA)   │  │  Anonymous  │           └───┬─────────────┘  │
│  └────────────────┘  └─────────────┘               │                │
│          │                  │                      │                │
│          │ POST fetch       │                      │ in-process     │
│          │                  │                      │ call           │
│          ▼                  │                      ▼                │
│  ┌────────────────┐         │          ┌──────────────────────┐     │
│  │ placePixel CF  │◄────────────────── │ placePixelCore       │     │
│  │ (europe-west1) │         │          │ getCanvasCore        │     │
│  └────┬───────────┘         │          └──────────────────────┘     │
│       │                     │                                       │
│       │ GET fetch           │                                       │
│       │                     │                                       │
│  ┌────▼───────────┐         │                                       │
│  │ getCanvas CF   │         │                                       │
│  └────┬───────────┘         │                                       │
│       │                     │                                       │
│       ▼                     ▼                                       │
│  ┌────────────────────────────────┐      ┌────────────────────────┐ │
│  │     Firestore Native           │      │  Secret Manager        │ │
│  │  ─ pixels/<x>_<y>              │      │  ─ discord-bot-token   │ │
│  │  ─ users/<userId>              │      │  ─ discord-public-key  │ │
│  │  ─ canvas/main                 │      │  ─ discord-app-id      │ │
│  │  (europe-west1, Native mode)   │      └────────────────────────┘ │
│  └─────────┬──────────────────────┘                                 │
│            │                                                        │
│            │ onSnapshot (WebSocket to browser)                      │
│            │                                                        │
│            └──────────► back to Browser for real-time UI update     │
│                                                                     │
│  ┌────────────────────────────┐                                     │
│  │  Pub/Sub topic             │ ◄── publish pixel-placed after      │
│  │  pixel-events              │     Firestore commit (fire-and-     │
│  │  (global)                  │     forget, reserved for Phase 5)   │
│  └────────────────────────────┘                                     │
│                                                                     │
│  IAM: compute SA has run.invoker (public) +                         │
│       secretmanager.secretAccessor on 3 Discord secrets only        │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Legende

| Couleur Mermaid | Signification |
|-----------------|---------------|
| 🔵 Bleu clair | Clients / clients externes (browser, Discord user) |
| 🔵 Bleu fonce | Cloud Functions + services compute GCP |
| 🟣 Violet | Stockage (Firestore, Pub/Sub) |
| 🔴 Rouge | Surface menaces / Secret Manager / IAM |
| 🟢 Vert | Defenses / controles de securite |

## Services actives (inventaire GCP)

```
APIs enabled (gcloud services list --enabled) :
  cloudfunctions.googleapis.com    Cloud Functions
  run.googleapis.com               Cloud Run (backs 2nd gen functions)
  cloudbuild.googleapis.com        Build container images
  artifactregistry.googleapis.com  Store container images
  firestore.googleapis.com         Firestore Native
  pubsub.googleapis.com            Pub/Sub messaging
  secretmanager.googleapis.com     Secret storage
  eventarc.googleapis.com          Event routing (Phase 5 ready)
  firebaserules.googleapis.com     Firestore security rules
  iam.googleapis.com               Identity & access
  cloudresourcemanager.googleapis.com   Project metadata
  iamcredentials.googleapis.com    SA token generation
  logging.googleapis.com           Cloud Logging (default)
  monitoring.googleapis.com        Cloud Monitoring (default)

Resources created :
  Firestore database (default)     mode NATIVE, location europe-west1
  Pub/Sub topic                    pixel-events
  Secret Manager                   discord-bot-token, discord-public-key, discord-app-id
  Cloud Functions 2nd gen          placePixel, getCanvas, discordInteraction (europe-west1)
  Firebase Hosting site            pixel-epitech.web.app
  Firebase Auth                    Anonymous provider enabled
  Firebase Web App                 1:252801134584:web:c072e3401cf0e85358300d
```

---

## Rendu visuel

Pour voir les diagrammes Mermaid rendus :

1. **GitHub** — ouvre ce fichier directement sur github.com, Mermaid est rendu nativement dans l'apercu Markdown
2. **VS Code** — extension "Markdown Preview Mermaid Support" (bierner.markdown-mermaid)
3. **En ligne** — https://mermaid.live/ — colle n'importe lequel des blocs mermaid ci-dessus
4. **Export PNG/SVG** — https://mermaid.live → Actions → Download PNG ou SVG pour un slide
