const { pixelsCollection, userDocRef } = require("../shared/firestore");
const { CANVAS_WIDTH, CANVAS_HEIGHT, PALETTE } = require("../shared/config");

// Core: returns { pixels, width, height, palette }.
async function getCanvasCore() {
  const snapshot = await pixelsCollection().get();
  const pixels = snapshot.docs.map((doc) => {
    const d = doc.data();
    return { x: d.x, y: d.y, color: d.color };
  });
  return {
    pixels,
    width: CANVAS_WIDTH,
    height: CANVAS_HEIGHT,
    palette: PALETTE,
  };
}

// Returns the user document data ({ lastPlacedAt, placedCount }) or null if absent.
async function getUserStats(userId) {
  if (typeof userId !== "string" || userId.length === 0) return null;
  const snap = await userDocRef(userId).get();
  return snap.exists ? snap.data() : null;
}

async function getCanvasHandler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ success: false, error: "Method not allowed" });
  }

  try {
    const data = await getCanvasCore();
    return res.status(200).json(data);
  } catch (err) {
    console.error("getCanvas firestore read failed", err);
    return res.status(500).json({ success: false, error: "Internal error" });
  }
}

module.exports = getCanvasHandler;
module.exports.getCanvasHandler = getCanvasHandler;
module.exports.getCanvasCore = getCanvasCore;
module.exports.getUserStats = getUserStats;
