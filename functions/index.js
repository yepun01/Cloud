const { onRequest } = require("firebase-functions/v2/https");
const { defineSecret } = require("firebase-functions/params");

const placePixelHandler = require("./src/pixel/placePixel");
const getCanvasHandler = require("./src/pixel/getCanvas");
const discordInteractionHandler = require("./src/discord/discordInteraction");

const RUNTIME = { region: "europe-west1", cors: true };

const discordPublicKey = defineSecret("discord-public-key");

exports.placePixel = onRequest(RUNTIME, placePixelHandler);
exports.getCanvas = onRequest(RUNTIME, getCanvasHandler);

exports.discordInteraction = onRequest(
  { ...RUNTIME, secrets: [discordPublicKey] },
  (req, res) => {
    process.env.DISCORD_PUBLIC_KEY = discordPublicKey.value();
    return discordInteractionHandler(req, res);
  }
);
