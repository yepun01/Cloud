const { onRequest } = require("firebase-functions/v2/https");

const placePixelHandler = require("./src/pixel/placePixel");
const getCanvasHandler = require("./src/pixel/getCanvas");

const RUNTIME = { region: "europe-west1", cors: true };

exports.placePixel = onRequest(RUNTIME, placePixelHandler);
exports.getCanvas = onRequest(RUNTIME, getCanvasHandler);
