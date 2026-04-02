const shared = require("../../constants.json");

const CANVAS_WIDTH = shared.canvas.width;
const CANVAS_HEIGHT = shared.canvas.height;
const COOLDOWN_SECONDS = shared.cooldownSeconds;
const PALETTE = shared.palette;

const COLLECTIONS = {
  pixels: "pixels",
  users: "users",
  canvas: "canvas",
};

module.exports = {
  CANVAS_WIDTH,
  CANVAS_HEIGHT,
  COOLDOWN_SECONDS,
  PALETTE,
  COLLECTIONS,
};
