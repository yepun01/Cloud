# PixelBoard — API Reference

All endpoints are HTTP, region `europe-west1`, CORS enabled (`*`).

| Endpoint | URL |
|----------|-----|
| `placePixel` | `https://placepixel-i6ah2cnwha-ew.a.run.app` |
| `getCanvas` | `https://getcanvas-i6ah2cnwha-ew.a.run.app` |
| `discordInteraction` | `https://europe-west1-pixel-epitech.cloudfunctions.net/discordInteraction` |

---

## POST `/placePixel`

Place a single pixel on the canvas.

### Request

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `userId` | string | yes | Stable user identifier. Convention: `web:<firebaseUid>` or `discord:<snowflake>`. Max 100 chars. |
| `x` | integer | yes | Column, `0 <= x <= 99`. **Strict integer** — strings like `"10"` are rejected. |
| `y` | integer | yes | Row, `0 <= y <= 99`. Same strict integer rule. |
| `color` | string | yes | Hex color `#RRGGBB`. Must be a member of the 16-color palette (case-insensitive, canonicalized to uppercase). |

```bash
curl -X POST https://placepixel-i6ah2cnwha-ew.a.run.app \
  -H "Content-Type: application/json" \
  -d '{"userId":"web:abc123","x":50,"y":50,"color":"#E50000"}'
```

### Responses

**200 OK** — pixel placed
```json
{
  "success": true,
  "pixel": { "x": 50, "y": 50, "color": "#E50000" }
}
```

**400 Bad Request** — validation failure
```json
{ "success": false, "error": "Coordinates out of bounds (0-99, 0-99)" }
{ "success": false, "error": "Color not in palette" }
{ "success": false, "error": "Missing userId" }
```

**429 Too Many Requests** — cooldown active (5 seconds per `userId`)
```json
{
  "success": false,
  "error": "Cooldown active",
  "retryAfter": 3
}
```

**405 Method Not Allowed** — non-POST method
**500 Internal Server Error** — Firestore transaction failure

### Side effects

- Writes a document at `pixels/{x}_{y}` with `{x, y, color, userId, placedAt: serverTimestamp}` (last-write-wins on the same coordinates)
- Atomically updates `users/{userId}` with `{lastPlacedAt: serverTimestamp, placedCount: increment(1)}`
- Publishes a `pixel-placed` event to Pub/Sub topic `pixel-events` (fire-and-forget; failure logged but does not affect the response)

---

## GET `/getCanvas`

Read the entire canvas state.

### Request

No parameters.

```bash
curl https://getcanvas-i6ah2cnwha-ew.a.run.app
```

### Response

**200 OK**
```json
{
  "pixels": [
    { "x": 50, "y": 50, "color": "#E50000" },
    { "x": 10, "y": 10, "color": "#0083C7" }
  ],
  "width": 100,
  "height": 100,
  "palette": [
    "#FFFFFF", "#E4E4E4", "#888888", "#222222",
    "#FFA7D1", "#E50000", "#E59500", "#A06A42",
    "#E5D900", "#94E044", "#02BE01", "#00D3DD",
    "#0083C7", "#0000EA", "#CF6EE4", "#820080"
  ]
}
```

The `pixels` array contains every placed pixel (no ordering guarantees). Empty canvas returns `pixels: []`.

**405 Method Not Allowed** — non-GET method
**500 Internal Server Error** — Firestore read failure

---

## POST `/discordInteraction`

Discord interactions endpoint. **Not meant to be called directly** — Discord posts here when a user invokes a slash command.

### Request

Headers (required):
- `x-signature-ed25519`: hex-encoded signature
- `x-signature-timestamp`: timestamp in seconds
- `Content-Type: application/json`

Body: a Discord [Interaction](https://discord.com/developers/docs/interactions/receiving-and-responding#interaction-object) object.

### Responses

**200 OK** — for both PING (`type:1`) and APPLICATION_COMMAND (`type:2`).

For PING:
```json
{ "type": 1 }
```

For commands, returns a Discord Interaction Response (`type: 4` with `content` and optional `embeds`, `flags: 64` for ephemeral).

**401 Unauthorized** — invalid signature
**405 Method Not Allowed** — non-POST method
**500 Internal Server Error** — `DISCORD_PUBLIC_KEY` env not bound

### Slash commands handled

| Command | Options | Visibility | Description |
|---------|---------|------------|-------------|
| `/place` | `x` int, `y` int, `color` enum (16 choices) | ephemeral (only invoker sees) | Calls `placePixelCore` and acknowledges placement / reports cooldown. |
| `/canvas` | none | public message in channel | Embed with pixel count, fill %, and link to `https://pixel-epitech.web.app`. |
| `/info` | none | ephemeral | Embed with canvas size, palette size, cooldown, total pixels placed, and the invoker's personal stats (placedCount, cooldown remaining). |

### Discord user → backend userId

`userId` sent to `placePixelCore` is constructed as `discord:<snowflake>` from `interaction.member.user.id` (in a guild) or `interaction.user.id` (in a DM).

---

## Firestore (client read access)

Web clients can read directly from Firestore using the Firebase JS SDK. Public read on `pixels` and `canvas`, deny writes to all collections from clients.

```js
import { collection, onSnapshot } from "firebase/firestore";
const unsubscribe = onSnapshot(collection(db, "pixels"), (snap) => {
  snap.forEach(doc => console.log(doc.data()));
});
```

This is how the web SPA receives real-time updates without polling.

---

## Constants

Defined in `shared/constants.json`, synced to backend (`functions/constants.json`) and frontend (`web/public/constants.js`):

| Constant | Value |
|----------|-------|
| Canvas size | 100 × 100 |
| Cooldown | 5 seconds per `userId` |
| Palette | 16 fixed colors (see `getCanvas` response) |

To change a constant, edit `shared/constants.json` and run `./scripts/sync-config.sh` before redeploying.
