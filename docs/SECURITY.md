# PixelBoard — Security audit

Date: 2026-04-17. Scope: Phase 6 hardening review of the deployed `pixel-epitech` GCP project.

## TL;DR

- **0 critical** issues found.
- **0 high** issues found.
- **3 medium** issues — accepted debt for the school project context, documented below.
- **2 low** observations — cleanup opportunities.

The deployment is consistent with the architecture's stated security posture: defence-in-depth at the IAM layer, ed25519 signature verification on Discord, strict input validation, atomic rate-limiting via Firestore transactions, and no secrets in source.

---

## 1. IAM audit

### Cloud Run services (Cloud Functions 2nd gen runtime)

| Service | Invoker binding | Intent |
|---------|-----------------|--------|
| `placepixel` | `allUsers` → `roles/run.invoker` | Public — protected at app layer by input validation + per-`userId` cooldown |
| `getcanvas` | `allUsers` → `roles/run.invoker` | Public — read-only canvas snapshot |
| `discordinteraction` | `allUsers` → `roles/run.invoker` | Public — protected at app layer by ed25519 signature check (rejects all unsigned/invalid requests with 401) |

✅ No service exposes more permissions than required.

### Secret Manager

| Secret | Accessor | Verified least privilege |
|--------|----------|--------------------------|
| `discord-bot-token` | `252801134584-compute@developer.gserviceaccount.com` → `roles/secretmanager.secretAccessor` | ✅ |
| `discord-public-key` | same | ✅ Bound at deploy via `defineSecret()` for `discordInteraction` |
| `discord-app-id` | same | ✅ |

✅ No secrets are bound to multiple service accounts. No `roles/secretmanager.admin` granted to non-human identities.

### Firestore rules (`firestore.rules`)

| Collection | Read | Write | Notes |
|------------|------|-------|-------|
| `pixels/{pixelId}` | public | denied (client) | Backend writes via Admin SDK bypass rules |
| `canvas/{canvasId}` | public | denied (client) | Read-only metadata |
| `users/{userId}` | authenticated, `request.auth.uid == userId` | denied (client) | Backend writes only |
| `{document=**}` | denied | denied | Default deny |

✅ Default-deny posture verified.
⚠ Note: the `users/` rule references `request.auth.uid`, but Phase 4 web userIds are prefixed (`web:<uid>`) and Phase 3 Discord userIds are `discord:<snowflake>`. Therefore the rule is currently a *dead branch* — no client read path exists. See L1 below.

---

## 2. Input validation audit

| Surface | Validation |
|---------|------------|
| `placePixel.x`, `placePixel.y` | Strict `Number.isInteger` + bounds `[0, 99]`. Rejects strings (`"50"`), floats (`50.5`), booleans, `null`, `undefined`. Reference: `functions/src/shared/validation.js:validateCoordinates`. |
| `placePixel.color` | Must be a member of the 16-color palette (case-insensitive, canonicalized to uppercase). Reference: `functions/src/shared/validation.js:validateColor`. |
| `placePixel.userId` | `string`, non-empty, ≤100 chars. Reference: `functions/src/shared/auth.js:getAuthenticatedUser` (also re-checked in `placePixelCore`). |
| Discord interaction body | ed25519 signature verified against `discord-public-key` BEFORE the body is dispatched. Body type is checked (`type:1` → PONG, `type:2` → command). Unknown `type` returns a generic ack to avoid Discord retries. |
| Slash command options (`x`, `y`, `color`) | Discord enforces `min_value:0, max_value:99` for integer options and a fixed enum (`choices`) for the color string at the API layer. Backend re-validates as defence in depth. |

✅ All inputs validated server-side. No client-trusted values.

---

## 3. Secrets in code scan

```
$ grep -rIE "(api[_-]?key|secret|token|password|bearer)" --include="*.js" --include="*.json" -- functions/ web/ scripts/ shared/
```

Findings:
- `functions/package.json` / `package-lock.json` — package names containing "token" / "secret" (e.g. `@google-cloud/secret-manager`). False positives.
- `web/public/firebase-config.js` — contains `apiKey: "AIzaSy..."`. **This is intentional and safe**: the Firebase Web SDK config is public per Firebase design; the API key restricts the SDK to a specific project but does not grant unrestricted access to data. Access is controlled by Firestore rules and (optional) App Check.
- `scripts/register-commands.js` — reads `DISCORD_APP_ID` and `DISCORD_BOT_TOKEN` from environment variables. ✅ No hardcoded values.
- No matches in `placePixel.js`, `getCanvas.js`, `discordInteraction.js`, or `handlers.js`.

✅ No secrets in source code.

---

## 4. CORS configuration

All three Cloud Functions are deployed with `cors: true` (Firebase Functions default — sets `Access-Control-Allow-Origin: *`).

**Trade-off**: open CORS allows the canvas to be embedded by any origin (desirable for sharing), but means any website could call `placePixel` from a user's browser without their explicit permission. Mitigated by:
- Per-`userId` rate limiting (5s cooldown)
- No personal data exposed in responses
- No write access to user data (only `placePixel` can write, and it's already public)

✅ Acceptable for a public, write-only-with-rate-limit endpoint.

---

## 5. Findings

### 🔴 Critical

None.

### 🟠 High

None.

### 🟡 Medium (accepted debt for the school project context)

**M1 — `userId` is client-asserted, not authenticated.**
The web client sends `userId: "web:" + firebaseUid` and the backend trusts it. An attacker can submit any `userId` to bypass per-user cooldowns by rotating IDs. Documented in `.planning/STATE.md` as Phase 6 deferred work. Fix: bind `placePixel` to require Firebase ID token verification on the request, derive `userId` server-side from `request.auth.uid`.

**M2 — Pub/Sub publish is fire-and-forget without an outbox.**
If `publishPixelEvent` fails after the Firestore write commits (network blip, throttle), the event is lost silently. Currently no consumer subscribes to `pixel-events`, so impact is zero. Fix when Phase 5 introduces a real consumer: write the event into an `events/` collection inside the same Firestore transaction, then have an Eventarc trigger publish to Pub/Sub with retry semantics (transactional outbox pattern).

**M3 — No timeout on `publishPixelEvent`.**
If Pub/Sub hangs, `placePixel` waits up to the Cloud Functions request timeout (60s) even though the pixel is already written. Fix: wrap the publish in `Promise.race` with a 3s timeout.

### 🟢 Low

**L1 — Dead Firestore rule for `users/{userId}`.**
The rule `request.auth.uid == userId` can never be true given the userId prefix convention (`web:`, `discord:`). The rule is harmless (still denies non-matching reads), but should either be removed or updated to reflect the Phase 6 plan once Firebase Auth verification is wired.

**L2 — Cloud Functions cleanup policy not configured.**
`firebase deploy` warns that no cleanup policy is set for the Artifact Registry repository in `europe-west1`. Container images from past deploys accumulate over time. Fix: `firebase functions:artifacts:setpolicy` (one-time setup).

---

## 6. Out of scope (Phase 7 / production)

- App Check / reCAPTCHA v3 — not required for school demo.
- Per-IP rate limiting at the Cloud Run layer — not required given the per-`userId` cooldown is sufficient for a controlled demo.
- HTTPS — automatically enforced by both Cloud Functions and Firebase Hosting.
- DDoS — handled by Cloud Run / Firebase edge.
- Backups — Firestore has automatic point-in-time recovery (default 7 days on Native mode).
- Penetration testing — out of scope for an Epitech remediation project.

---

## Verification commands

To re-audit after changes:

```bash
# Cloud Run invoker bindings
for SVC in placepixel getcanvas discordinteraction; do
  echo "--- $SVC"
  gcloud run services get-iam-policy "$SVC" \
    --region=europe-west1 --project=pixel-epitech \
    --format="value(bindings.members,bindings.role)"
done

# Secret Manager bindings
for S in discord-bot-token discord-public-key discord-app-id; do
  echo "--- $S"
  gcloud secrets get-iam-policy "$S" \
    --project=pixel-epitech \
    --format="value(bindings.members,bindings.role)"
done

# Firestore rules (last deployed)
firebase firestore:indexes --project=pixel-epitech    # show indexes
cat firestore.rules                                    # local rules

# Secrets-in-code scan
grep -rIE "(api[_-]?key|secret|token|password|bearer)" \
  --include="*.js" --include="*.json" \
  -- functions/ web/ scripts/ shared/
```
