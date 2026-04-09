# PixelBoard — Demo Script

End-to-end walkthrough for a 5-7 minute presentation. Verifies every requirement of the project: web SPA, Discord bot, real-time sync, rate limiting, IAM, scalability.

## Pre-flight checklist (5 min before)

- [ ] Open `https://pixel-epitech.web.app` in two browser tabs (preferably side-by-side or split-screen). Hard refresh (Cmd+Shift+R) both.
- [ ] Discord client open on a server where the PixelBoard bot is invited and slash commands are visible (`/place`, `/canvas`, `/info`).
- [ ] Firebase Console open at `https://console.firebase.google.com/project/pixel-epitech/firestore/data/~2Fpixels` (so you can show writes landing live).
- [ ] Cloud Console open at `https://console.cloud.google.com/run?project=pixel-epitech` (3 services visible: `placepixel`, `getcanvas`, `discordinteraction`).
- [ ] Terminal ready in the repo with the test curls below copy-pasteable.

---

## Demo flow

### 1. The problem (30 s)

> "Reddit r/place is a viral social experiment: a giant shared canvas where anyone can place one pixel every few seconds. The technical challenge is making it scalable, secure, and event-driven without managing servers."
>
> "PixelBoard is my serverless implementation on GCP. Two interfaces: a web SPA and a Discord bot. Same backend, real-time sync."

### 2. Architecture overview (1 min)

Open `docs/ARCHITECTURE.md`, show the high-level Mermaid diagram.

> "Three Cloud Functions 2nd gen in `europe-west1`: `placePixel`, `getCanvas`, `discordInteraction`. Storage in Firestore Native. Secrets in Secret Manager. Everything is serverless — scale-to-zero, no VMs."

Point to:
- 1 doc/pixel design (`pixels/{x}_{y}`) → no contention, last-write-wins for free
- Rate limit via Firestore transaction on `users/{userId}` → atomic, can't be bypassed by double-click
- Discord signature verification ed25519 → no shared secret, only the public key sits in our backend

### 3. Web demo (1.5 min)

In **Tab A**:
- Show the canvas. Mention the live `userId` displayed in the header (`web:abc…`) — anonymous Firebase Auth fired on load.
- Click a few pixels in different colors. Show the cooldown UI (5 s) appear after each placement.
- Try clicking again during cooldown → red toast "Cooldown: Xs". No request sent.
- Show wheel zoom + Shift+drag pan.

In **Tab B** (different browser tab):
- Without refreshing, watch the new pixels appear in real time as they're placed in Tab A.
- Place a pixel from Tab B → it shows up in Tab A in <1 s.

> "Real-time sync uses Firestore `onSnapshot` listeners on the `pixels` collection. No polling, no SSE — the SDK pushes deltas straight from Firestore over a single websocket per client."

### 4. Discord demo (1.5 min)

In Discord:
- `/info` → ephemeral embed shows canvas size, total pixels placed, your personal cooldown.
- `/place x:50 y:50 color:Red` → ephemeral confirmation "Pixel placed at (50, 50) in #E50000…".
- Switch back to the browser → that pixel just appeared in both web tabs in real time.
- `/place x:51 y:50 color:Blue` immediately → "Cooldown active. Wait 4s before placing another pixel." (Same backend, same `users/discord:<id>.lastPlacedAt`, same 5 s cooldown.)
- `/canvas` → public embed in the channel with pixel count + link to the web app.

> "The Discord bot has the same `userId` namespace as the web (`discord:<snowflake>` vs `web:<uid>`). The cooldown applies independently per user, but the placement logic is shared — both call the same `placePixelCore` function in `placePixel.js`."

### 5. Behind the scenes (1 min)

Switch to **Firestore Console**:
- Show the `pixels/` collection. Click on `pixels/50_50` → see the doc with `x`, `y`, `color`, `userId="discord:..."`, `placedAt: <timestamp>`.
- Show `users/discord:<your-id>` → `lastPlacedAt`, `placedCount` incrementing.

Switch to **Cloud Run console**:
- 3 services. Click on `discordinteraction` → metrics show invocations spiking when you used the slash commands.

Switch to **terminal**:
```bash
# Direct API test, bypassing the UI
curl -s https://getcanvas-i6ah2cnwha-ew.a.run.app | jq '.pixels | length'
# → number of pixels currently on the canvas
```

### 6. Validation tests (30 s)

In terminal:
```bash
# Reject invalid coords
curl -s -X POST https://placepixel-i6ah2cnwha-ew.a.run.app \
  -H "Content-Type: application/json" \
  -d '{"userId":"demo","x":-1,"y":50,"color":"#E50000"}'
# → {"success":false,"error":"Coordinates out of bounds (0-99, 0-99)"}

# Reject color not in palette
curl -s -X POST https://placepixel-i6ah2cnwha-ew.a.run.app \
  -H "Content-Type: application/json" \
  -d '{"userId":"demo","x":50,"y":50,"color":"#123456"}'
# → {"success":false,"error":"Color not in palette"}
```

Then mention:
> "64 Jest tests cover all 8 must-pass scenarios from `criteria.md` plus edge cases — strict integer validation, last-write-wins, cooldown atomicity. Coverage 90%+."

### 7. Wrap-up (30 s)

> "100% serverless: 3 Cloud Functions, Firestore, Pub/Sub, Secret Manager, Firebase Hosting + Auth. No VMs, no containers I manage, scale-to-zero. Two interfaces share one backend. Real-time fan-out via Firestore listeners. Atomic rate limiting via transactions. ed25519 signature verification on Discord. Total cost so far: zero (free tier)."

---

## Q&A — likely jury questions and answers

**Q: Why one document per pixel instead of a single canvas document?**
> Single doc is limited to 1 MiB (we'd hit that around 13k pixels) and forces every write to rewrite the entire payload — contention. With one doc per pixel, writes on different coordinates never conflict, and Firestore `set()` without `merge` gives us free last-write-wins on the same coordinate.

**Q: How is the cooldown enforced atomically?**
> Inside a Firestore transaction: read `users/{userId}.lastPlacedAt`, check if `now - lastPlacedAt < 5s`, throw on cooldown active, otherwise atomically `set` the pixel doc and `set` the user doc with `serverTimestamp`. Firestore retries the transaction on conflict, so two simultaneous requests from the same user can't both succeed.

**Q: Could someone bypass the rate limit?**
> Yes — `userId` comes from the request body and isn't authenticated. This is documented as accepted technical debt for this iteration; the original roadmap's Phase 6 was to wire Firebase Auth on `placePixel` and lock `userId` to `request.auth.uid`. Since this is a school project demo, App Check / per-IP rate limiting were deemed overkill.

**Q: How does the Discord bot authenticate to your backend?**
> It doesn't — Discord *itself* signs every interaction with ed25519. My function verifies the signature using the public key from Secret Manager. If the signature is invalid, return 401 without doing anything. The Discord interaction model is "you trust the signature, not the network."

**Q: What happens if `placePixel` is invoked at 1000 req/s?**
> Cloud Functions 2nd gen scales horizontally up to 1000 concurrent instances by default. Firestore handles ~500 sustained writes/s on free tier. Hot spots are per-document; since each pixel is a different doc, the limit kicks in at ~500 *unique-pixel* writes/s. The cooldown rate-limit (5 s/user) means realistic load is ~0.2 writes/s/user — 1000 users active = 200 writes/s, well within the free tier.

**Q: Why no PNG generation for `/canvas` in Discord?**
> The original spec mentioned `/canvas → image PNG`. To keep the deploy bundle small (no `node-canvas` native deps) and the function within Cloud Functions cold-start budget, the embed shows pixel-count stats and a direct link to the web app where the canvas is rendered live with full interactivity. PNG generation would require either bundling `pngjs`/`sharp` or uploading to Cloud Storage and returning a signed URL — both viable, deferred as bonus.

**Q: What's the cost?**
> Free tier so far. 100×100 canvas = 10k docs max, getCanvas reads dominate. With Firestore real-time listeners on `pixels`, each *change* costs 1 read per connected client; current expected load is well under 50k reads/day free quota.

**Q: Why no observability?**
> Cloud Functions and Firestore expose default metrics in Cloud Monitoring (invocation count, latency p50/p95/p99, error rate). Observability is optional in the school remediation context — we focused on functionality and verifying the system scales as expected.

---

## Reset between demos

If you need to wipe pixels for a clean run:

```bash
# Delete all pixels (requires gcloud auth)
gcloud firestore delete-all --collection=pixels --project=pixel-epitech --quiet
gcloud firestore delete-all --collection=users --project=pixel-epitech --quiet
```

Or just keep going — the demo works fine with existing pixels.
