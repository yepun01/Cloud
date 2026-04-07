// PixelBoard frontend — entry point.
// Wires Firebase auth + getCanvas + onSnapshot + click handler + palette + cooldown UI.

import { signInAndWatch } from "./firebase-init.js";
import { placePixel, getCanvas } from "./api.js";
import { watchPixels } from "./realtime.js";
import { initCanvas, drawAll, drawPixel, canvasCoordsFromEvent, isInBounds } from "./canvas.js";
import { attachZoomPan } from "./zoom-pan.js";

const PALETTE = window.PALETTE;
const COOLDOWN_SECONDS = window.COOLDOWN_SECONDS;

const state = {
  userId: null,
  selectedColor: PALETTE[5], // red
  cooldownUntil: 0,
  pixels: new Map(), // "x_y" → {x,y,color}
  ctx: null,
};

function pixelKey(x, y) {
  return `${x}_${y}`;
}

function setPixels(arr) {
  state.pixels.clear();
  for (const p of arr) state.pixels.set(pixelKey(p.x, p.y), p);
  if (state.ctx) drawAll(state.ctx, [...state.pixels.values()]);
}

function setSelectedColor(color, swatchEl) {
  state.selectedColor = color;
  document.querySelectorAll(".color-swatch").forEach((s) => s.classList.remove("selected"));
  if (swatchEl) swatchEl.classList.add("selected");
}

function buildPalette(container) {
  container.innerHTML = "";
  PALETTE.forEach((color) => {
    const swatch = document.createElement("div");
    swatch.className = "color-swatch";
    swatch.style.backgroundColor = color;
    swatch.title = color;
    if (color === state.selectedColor) swatch.classList.add("selected");
    swatch.addEventListener("click", () => setSelectedColor(color, swatch));
    container.appendChild(swatch);
  });
}

function showToast(msg, kind = "info") {
  const t = document.createElement("div");
  t.className = `toast toast-${kind}`;
  t.textContent = msg;
  document.body.appendChild(t);
  setTimeout(() => t.remove(), 3000);
}

function startCooldown(seconds, displayEl) {
  state.cooldownUntil = Date.now() + seconds * 1000;
  const tick = () => {
    const remaining = Math.max(0, state.cooldownUntil - Date.now());
    if (remaining <= 0) {
      displayEl.textContent = "";
      displayEl.classList.remove("active");
      return;
    }
    displayEl.classList.add("active");
    displayEl.textContent = `Wait ${Math.ceil(remaining / 1000)}s`;
    requestAnimationFrame(() => setTimeout(tick, 100));
  };
  tick();
}

function isCooldownActive() {
  return Date.now() < state.cooldownUntil;
}

async function handleClick(e, canvasEl, zoomPan, cooldownDisplay) {
  if (zoomPan.movedSignificantly()) return; // was a drag, ignore
  if (!state.userId) {
    showToast("Initialisation...", "warn");
    return;
  }
  if (isCooldownActive()) {
    const remaining = Math.ceil((state.cooldownUntil - Date.now()) / 1000);
    showToast(`Cooldown: ${remaining}s`, "warn");
    return;
  }

  const { x, y } = canvasCoordsFromEvent(canvasEl, e);
  if (!isInBounds(x, y)) return;

  // Optimistic update: draw the pixel immediately.
  const key = pixelKey(x, y);
  const previous = state.pixels.get(key);
  state.pixels.set(key, { x, y, color: state.selectedColor });
  drawPixel(state.ctx, x, y, state.selectedColor);

  try {
    const { ok, status, data } = await placePixel({
      userId: state.userId,
      x,
      y,
      color: state.selectedColor,
    });

    if (ok && data.success) {
      startCooldown(COOLDOWN_SECONDS, cooldownDisplay);
      return;
    }

    // Rollback optimistic update.
    if (previous) {
      state.pixels.set(key, previous);
      drawPixel(state.ctx, x, y, previous.color);
    } else {
      state.pixels.delete(key);
      // Re-draw entire canvas to clear the cell (cheap on 100x100).
      drawAll(state.ctx, [...state.pixels.values()]);
    }

    if (status === 429) {
      const retryAfter = Number(data.retryAfter) || COOLDOWN_SECONDS;
      startCooldown(retryAfter, cooldownDisplay);
      showToast(`Cooldown actif: ${retryAfter}s`, "warn");
    } else {
      showToast(data.error || `Erreur ${status}`, "error");
    }
  } catch (err) {
    // Network failure: rollback.
    if (previous) {
      state.pixels.set(key, previous);
      drawPixel(state.ctx, x, y, previous.color);
    } else {
      state.pixels.delete(key);
      drawAll(state.ctx, [...state.pixels.values()]);
    }
    showToast("Erreur reseau, reessaie", "error");
    console.error("placePixel failed:", err);
  }
}

async function bootstrap() {
  const canvasEl = document.getElementById("pixel-canvas");
  const container = document.getElementById("canvas-container");
  const paletteEl = document.getElementById("palette");
  const coordEl = document.getElementById("coord-display");
  const cooldownEl = document.getElementById("cooldown-display");
  const userInfoEl = document.getElementById("user-info");

  state.ctx = initCanvas(canvasEl);
  buildPalette(paletteEl);
  const zoomPan = attachZoomPan(canvasEl, container);

  // Initial load via getCanvas (faster first paint than waiting for onSnapshot).
  try {
    const data = await getCanvas();
    if (Array.isArray(data.pixels)) setPixels(data.pixels);
  } catch (err) {
    console.error("Initial getCanvas failed:", err);
    showToast("Impossible de charger le canvas", "error");
  }

  // Subscribe to real-time updates.
  watchPixels((pixels) => setPixels(pixels));

  // Mouse tracking for coords display.
  canvasEl.addEventListener("mousemove", (e) => {
    const { x, y } = canvasCoordsFromEvent(canvasEl, e);
    if (isInBounds(x, y)) coordEl.textContent = `x: ${x} y: ${y}`;
    else coordEl.textContent = "x: — y: —";
  });

  canvasEl.addEventListener("click", (e) => handleClick(e, canvasEl, zoomPan, cooldownEl));

  // Auth: anonymous sign-in.
  userInfoEl.textContent = "Connecting...";
  signInAndWatch((userId) => {
    state.userId = userId;
    userInfoEl.textContent = userId.slice(0, 14) + "…";
    userInfoEl.title = userId;
  });
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", bootstrap);
} else {
  bootstrap();
}
