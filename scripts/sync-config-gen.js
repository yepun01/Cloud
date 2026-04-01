#!/usr/bin/env node

const fs = require("fs");
const path = require("path");

const repoRoot = process.argv[2] || path.resolve(__dirname, "..");
const cfg = JSON.parse(fs.readFileSync(path.join(repoRoot, "shared/constants.json"), "utf8"));

const output = [
  "// Auto-generated from shared/constants.json — do not edit manually",
  "// Uses window.* so values are accessible from both classic scripts and ES modules.",
  `window.CANVAS_WIDTH = ${cfg.canvas.width};`,
  `window.CANVAS_HEIGHT = ${cfg.canvas.height};`,
  `window.COOLDOWN_SECONDS = ${cfg.cooldownSeconds};`,
  `window.PALETTE = ${JSON.stringify(cfg.palette)};`,
  `var CANVAS_WIDTH = window.CANVAS_WIDTH;`,
  `var CANVAS_HEIGHT = window.CANVAS_HEIGHT;`,
  `var COOLDOWN_SECONDS = window.COOLDOWN_SECONDS;`,
  `var PALETTE = window.PALETTE;`,
  "",
].join("\n");

fs.writeFileSync(path.join(repoRoot, "web/public/constants.js"), output);

// Also copy shared/constants.json into functions/ so it's bundled at deploy
fs.copyFileSync(
  path.join(repoRoot, "shared/constants.json"),
  path.join(repoRoot, "functions/constants.json")
);
