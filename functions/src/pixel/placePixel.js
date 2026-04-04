const { FieldValue } = require("firebase-admin/firestore");
const { db, pixelDocRef, userDocRef } = require("../shared/firestore");
const { getAuthenticatedUser } = require("../shared/auth");
const { validateCoordinates, validateColor } = require("../shared/validation");
const { checkCooldown } = require("../shared/rateLimit");
const { publishPixelEvent } = require("../shared/pubsub");

const COOLDOWN_ERROR = "COOLDOWN_ACTIVE";

function sendJson(res, status, body) {
  res.status(status).json(body);
}

// Core placement logic, shared between HTTP handler and Discord handler.
// Returns { success: true, pixel } or { success: false, error, retryAfter?, status }.
async function placePixelCore({ userId, x, y, color }) {
  if (typeof userId !== "string" || userId.length === 0) {
    return { success: false, status: 400, error: "Missing userId" };
  }
  if (userId.length > 100) {
    return { success: false, status: 400, error: "userId too long (max 100 chars)" };
  }

  const coords = validateCoordinates(x, y);
  if (!coords.valid) {
    return { success: false, status: 400, error: coords.error };
  }

  const colorCheck = validateColor(color);
  if (!colorCheck.valid) {
    return { success: false, status: 400, error: "Color not in palette" };
  }

  const canonicalColor = colorCheck.color;
  const nowMs = Date.now();

  try {
    await db.runTransaction(async (tx) => {
      const userRef = userDocRef(userId);
      const userSnap = await tx.get(userRef);
      const lastPlacedAt = userSnap.exists ? userSnap.data().lastPlacedAt : null;

      const cooldown = checkCooldown(lastPlacedAt, nowMs);
      if (!cooldown.allowed) {
        const err = new Error("Cooldown active");
        err.code = COOLDOWN_ERROR;
        err.retryAfter = cooldown.retryAfter;
        throw err;
      }

      const placedAt = FieldValue.serverTimestamp();
      tx.set(pixelDocRef(coords.x, coords.y), {
        x: coords.x,
        y: coords.y,
        color: canonicalColor,
        userId,
        placedAt,
      });
      tx.set(
        userRef,
        {
          lastPlacedAt: placedAt,
          placedCount: FieldValue.increment(1),
        },
        { merge: true }
      );
    });
  } catch (err) {
    if (err && err.code === COOLDOWN_ERROR) {
      return {
        success: false,
        status: 429,
        error: "Cooldown active",
        retryAfter: err.retryAfter,
      };
    }
    console.error("placePixel transaction failed", err);
    return { success: false, status: 500, error: "Internal error" };
  }

  try {
    await publishPixelEvent({
      type: "pixel-placed",
      x: coords.x,
      y: coords.y,
      color: canonicalColor,
      userId,
      placedAt: new Date(nowMs).toISOString(),
    });
  } catch (err) {
    console.warn("publishPixelEvent failed", err && err.message);
  }

  return {
    success: true,
    status: 200,
    pixel: { x: coords.x, y: coords.y, color: canonicalColor },
  };
}

async function placePixelHandler(req, res) {
  if (req.method !== "POST") {
    return sendJson(res, 405, { success: false, error: "Method not allowed" });
  }

  if (!req.body || typeof req.body !== "object") {
    return sendJson(res, 400, { success: false, error: "Missing request body" });
  }

  const auth = await getAuthenticatedUser(req);
  if (!auth.authenticated) {
    return sendJson(res, 400, { success: false, error: auth.error });
  }

  const result = await placePixelCore({
    userId: auth.userId,
    x: req.body.x,
    y: req.body.y,
    color: req.body.color,
  });

  const { status, ...body } = result;
  return sendJson(res, status, body);
}

module.exports = placePixelHandler;
module.exports.placePixelHandler = placePixelHandler;
module.exports.placePixelCore = placePixelCore;
