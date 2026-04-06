// Canvas rendering and coordinate helpers.
// Reads window.CANVAS_WIDTH / window.CANVAS_HEIGHT exposed by constants.js.

const CANVAS_WIDTH = window.CANVAS_WIDTH;
const CANVAS_HEIGHT = window.CANVAS_HEIGHT;
const DISPLAY_SIZE = 500;
const PIXEL_SIZE = DISPLAY_SIZE / CANVAS_WIDTH;
const BG_COLOR = "#0d0d18";

export function initCanvas(canvasElement) {
  const ctx = canvasElement.getContext("2d");
  ctx.imageSmoothingEnabled = false;
  clearCanvas(ctx);
  return ctx;
}

export function clearCanvas(ctx) {
  ctx.fillStyle = BG_COLOR;
  ctx.fillRect(0, 0, DISPLAY_SIZE, DISPLAY_SIZE);
}

export function drawPixel(ctx, x, y, color) {
  ctx.fillStyle = color;
  ctx.fillRect(x * PIXEL_SIZE, y * PIXEL_SIZE, PIXEL_SIZE, PIXEL_SIZE);
}

export function drawAll(ctx, pixels) {
  clearCanvas(ctx);
  for (const p of pixels) {
    drawPixel(ctx, p.x, p.y, p.color);
  }
}

// Convert a mouse event (using getBoundingClientRect) to canvas grid coords.
// Accounts for CSS scale/transform applied to the canvas element.
export function canvasCoordsFromEvent(canvasElement, event) {
  const rect = canvasElement.getBoundingClientRect();
  const scaleX = DISPLAY_SIZE / rect.width;
  const scaleY = DISPLAY_SIZE / rect.height;
  const x = Math.floor((event.clientX - rect.left) * scaleX / PIXEL_SIZE);
  const y = Math.floor((event.clientY - rect.top) * scaleY / PIXEL_SIZE);
  return { x, y };
}

export function isInBounds(x, y) {
  return Number.isInteger(x) && Number.isInteger(y) && x >= 0 && x < CANVAS_WIDTH && y >= 0 && y < CANVAS_HEIGHT;
}

export const CANVAS_DISPLAY_SIZE = DISPLAY_SIZE;
