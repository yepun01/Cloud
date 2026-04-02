const { CANVAS_WIDTH, CANVAS_HEIGHT, PALETTE } = require("./config");

function validateCoordinates(x, y) {
  if (!Number.isInteger(x) || !Number.isInteger(y)) {
    return { valid: false, error: "Coordinates must be integers" };
  }
  if (x < 0 || x >= CANVAS_WIDTH || y < 0 || y >= CANVAS_HEIGHT) {
    return {
      valid: false,
      error: `Coordinates out of bounds (0-${CANVAS_WIDTH - 1}, 0-${CANVAS_HEIGHT - 1})`,
    };
  }
  return { valid: true, x, y };
}

function validateColor(color) {
  const upper = String(color).toUpperCase();
  if (!PALETTE.includes(upper)) {
    return { valid: false, error: `Invalid color. Allowed: ${PALETTE.join(", ")}` };
  }
  return { valid: true, color: upper };
}

module.exports = { validateCoordinates, validateColor };
