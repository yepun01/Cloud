const { COOLDOWN_SECONDS } = require("./config");

function toMillis(lastPlacedAt) {
  if (!lastPlacedAt) return null;
  if (typeof lastPlacedAt.toMillis === "function") return lastPlacedAt.toMillis();
  if (typeof lastPlacedAt._seconds === "number") {
    return lastPlacedAt._seconds * 1000 + Math.floor((lastPlacedAt._nanoseconds || 0) / 1e6);
  }
  if (typeof lastPlacedAt.seconds === "number") {
    return lastPlacedAt.seconds * 1000 + Math.floor((lastPlacedAt.nanoseconds || 0) / 1e6);
  }
  if (lastPlacedAt instanceof Date) return lastPlacedAt.getTime();
  if (typeof lastPlacedAt === "number") return lastPlacedAt;
  return null;
}

function checkCooldown(lastPlacedAt, nowMs) {
  const lastMs = toMillis(lastPlacedAt);
  if (lastMs === null) return { allowed: true };
  const elapsedMs = nowMs - lastMs;
  if (elapsedMs >= COOLDOWN_SECONDS * 1000) return { allowed: true };
  const retryAfter = Math.ceil((COOLDOWN_SECONDS * 1000 - elapsedMs) / 1000);
  return { allowed: false, retryAfter };
}

module.exports = { checkCooldown };
