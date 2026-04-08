const { placePixelCore } = require("../pixel/placePixel");
const { getCanvasCore, getUserStats } = require("../pixel/getCanvas");
const { CANVAS_WIDTH, CANVAS_HEIGHT, COOLDOWN_SECONDS, PALETTE } = require("../shared/config");

const WEB_URL = "https://pixel-epitech.web.app";

// Discord interaction response types.
const RESPONSE_TYPE = {
  PONG: 1,
  CHANNEL_MESSAGE: 4,
};

// Helpers ---------------------------------------------------------------

function ephemeralMessage(content, embeds) {
  return {
    type: RESPONSE_TYPE.CHANNEL_MESSAGE,
    data: {
      content,
      embeds: embeds || [],
      flags: 64, // EPHEMERAL — only visible to the invoking user
    },
  };
}

function publicMessage(content, embeds) {
  return {
    type: RESPONSE_TYPE.CHANNEL_MESSAGE,
    data: { content, embeds: embeds || [] },
  };
}

function getOption(interaction, name) {
  const opts = (interaction.data && interaction.data.options) || [];
  const found = opts.find((o) => o.name === name);
  return found ? found.value : undefined;
}

function getDiscordUserId(interaction) {
  const user = (interaction.member && interaction.member.user) || interaction.user;
  return user ? user.id : null;
}

// /place ----------------------------------------------------------------

async function handlePlace(interaction) {
  const discordId = getDiscordUserId(interaction);
  if (!discordId) {
    return ephemeralMessage("Could not identify your Discord user.");
  }

  const x = getOption(interaction, "x");
  const y = getOption(interaction, "y");
  const color = getOption(interaction, "color");
  const userId = `discord:${discordId}`;

  const result = await placePixelCore({ userId, x, y, color });

  if (result.success) {
    return ephemeralMessage(
      `Pixel placed at (${result.pixel.x}, ${result.pixel.y}) in ${result.pixel.color}. ` +
      `Cooldown ${COOLDOWN_SECONDS}s. View canvas: ${WEB_URL}`
    );
  }

  if (result.status === 429) {
    return ephemeralMessage(`Cooldown active. Wait ${result.retryAfter}s before placing another pixel.`);
  }
  return ephemeralMessage(`Could not place pixel: ${result.error}`);
}

// /canvas ---------------------------------------------------------------

async function handleCanvas() {
  let canvas;
  try {
    canvas = await getCanvasCore();
  } catch (err) {
    console.error("getCanvas core failed", err);
    return ephemeralMessage("Could not fetch the canvas right now.");
  }

  const filled = canvas.pixels.length;
  const total = canvas.width * canvas.height;
  const fillPct = ((filled / total) * 100).toFixed(2);

  return publicMessage("", [
    {
      title: "PixelBoard — Current Canvas",
      description: `**${filled.toLocaleString()}** / ${total.toLocaleString()} pixels placed (${fillPct}%)\n\nView the live canvas in your browser:\n${WEB_URL}`,
      color: 0x0083c7,
      fields: [
        { name: "Size", value: `${canvas.width} x ${canvas.height}`, inline: true },
        { name: "Palette", value: `${canvas.palette.length} colors`, inline: true },
      ],
      footer: { text: "Use /place x y color to draw a pixel." },
    },
  ]);
}

// /info -----------------------------------------------------------------

async function handleInfo(interaction) {
  const discordId = getDiscordUserId(interaction);
  const userId = discordId ? `discord:${discordId}` : null;

  let pixelCount = 0;
  try {
    const canvas = await getCanvasCore();
    pixelCount = canvas.pixels.length;
  } catch (err) {
    console.warn("getCanvas in /info failed", err && err.message);
  }

  let userStats = null;
  if (userId) {
    try {
      userStats = await getUserStats(userId);
    } catch (err) {
      console.warn("getUserStats in /info failed", err && err.message);
    }
  }

  let yourLine = "You haven't placed any pixels yet.";
  let cooldownLine = "No cooldown active.";
  if (userStats) {
    const placed = userStats.placedCount || 0;
    yourLine = `You've placed **${placed}** pixel${placed === 1 ? "" : "s"}.`;
    const lastMs = toMillis(userStats.lastPlacedAt);
    if (lastMs) {
      const remaining = Math.max(0, COOLDOWN_SECONDS - Math.floor((Date.now() - lastMs) / 1000));
      cooldownLine = remaining > 0 ? `Cooldown: ${remaining}s remaining.` : "No cooldown active.";
    }
  }

  return ephemeralMessage("", [
    {
      title: "PixelBoard — Info",
      color: 0x94e044,
      fields: [
        { name: "Canvas size", value: `${CANVAS_WIDTH} x ${CANVAS_HEIGHT}`, inline: true },
        { name: "Palette", value: `${PALETTE.length} colors`, inline: true },
        { name: "Cooldown", value: `${COOLDOWN_SECONDS}s per placement`, inline: true },
        { name: "Pixels placed", value: pixelCount.toLocaleString(), inline: true },
        { name: "You", value: yourLine, inline: false },
        { name: "Cooldown status", value: cooldownLine, inline: false },
      ],
      footer: { text: `Web canvas: ${WEB_URL}` },
    },
  ]);
}

function toMillis(ts) {
  if (!ts) return null;
  if (typeof ts.toMillis === "function") return ts.toMillis();
  if (typeof ts._seconds === "number") return ts._seconds * 1000;
  if (typeof ts.seconds === "number") return ts.seconds * 1000;
  if (ts instanceof Date) return ts.getTime();
  if (typeof ts === "number") return ts;
  return null;
}

// Dispatcher ------------------------------------------------------------

async function dispatchCommand(interaction) {
  const name = interaction.data && interaction.data.name;
  switch (name) {
    case "place":
      return handlePlace(interaction);
    case "canvas":
      return handleCanvas();
    case "info":
      return handleInfo(interaction);
    default:
      return ephemeralMessage(`Unknown command: ${name}`);
  }
}

module.exports = {
  dispatchCommand,
  handlePlace,
  handleCanvas,
  handleInfo,
  RESPONSE_TYPE,
};
