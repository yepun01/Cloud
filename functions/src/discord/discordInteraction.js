const { verifySignature } = require("./signature");
const { dispatchCommand } = require("./handlers");

const INTERACTION_TYPE = {
  PING: 1,
  APPLICATION_COMMAND: 2,
};

async function discordInteractionHandler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).send("Method not allowed");
  }

  const signature = req.get("x-signature-ed25519") || req.headers["x-signature-ed25519"];
  const timestamp = req.get("x-signature-timestamp") || req.headers["x-signature-timestamp"];
  const publicKey = process.env.DISCORD_PUBLIC_KEY;

  if (!publicKey) {
    console.error("DISCORD_PUBLIC_KEY env var missing — secret not bound?");
    return res.status(500).send("Server misconfigured");
  }

  // Cloud Functions exposes the raw body on req.rawBody as a Buffer.
  const rawBody = req.rawBody;
  if (!verifySignature(rawBody, signature, timestamp, publicKey)) {
    return res.status(401).send("Invalid request signature");
  }

  const interaction = req.body;
  if (!interaction || typeof interaction.type !== "number") {
    return res.status(400).send("Invalid interaction payload");
  }

  if (interaction.type === INTERACTION_TYPE.PING) {
    return res.status(200).json({ type: 1 });
  }

  if (interaction.type === INTERACTION_TYPE.APPLICATION_COMMAND) {
    try {
      const response = await dispatchCommand(interaction);
      return res.status(200).json(response);
    } catch (err) {
      console.error("Command dispatch failed:", err);
      return res.status(200).json({
        type: 4,
        data: { content: "Internal error handling your command.", flags: 64 },
      });
    }
  }

  // Unknown interaction type — acknowledge to avoid Discord retries.
  return res.status(200).json({ type: 4, data: { content: "Unsupported interaction.", flags: 64 } });
}

module.exports = discordInteractionHandler;
module.exports.discordInteractionHandler = discordInteractionHandler;
