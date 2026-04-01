#!/usr/bin/env node

// Register Discord slash commands for PixelBoard
// Usage: DISCORD_APP_ID=xxx DISCORD_BOT_TOKEN=xxx node scripts/register-commands.js

const https = require("https");

const APP_ID = process.env.DISCORD_APP_ID;
const BOT_TOKEN = process.env.DISCORD_BOT_TOKEN;

if (!APP_ID || !BOT_TOKEN) {
  console.error("Error: DISCORD_APP_ID and DISCORD_BOT_TOKEN environment variables are required.");
  console.error("Usage: DISCORD_APP_ID=xxx DISCORD_BOT_TOKEN=xxx node scripts/register-commands.js");
  process.exit(1);
}

const commands = [
  {
    name: "place",
    description: "Place a pixel on the canvas",
    options: [
      {
        name: "x",
        description: "X coordinate (0-99)",
        type: 4, // INTEGER
        required: true,
        min_value: 0,
        max_value: 99,
      },
      {
        name: "y",
        description: "Y coordinate (0-99)",
        type: 4, // INTEGER
        required: true,
        min_value: 0,
        max_value: 99,
      },
      {
        name: "color",
        description: "Color hex code (e.g. #E50000)",
        type: 3, // STRING
        required: true,
        choices: [
          { name: "White", value: "#FFFFFF" },
          { name: "Light Grey", value: "#E4E4E4" },
          { name: "Grey", value: "#888888" },
          { name: "Dark Grey", value: "#222222" },
          { name: "Pink", value: "#FFA7D1" },
          { name: "Red", value: "#E50000" },
          { name: "Orange", value: "#E59500" },
          { name: "Brown", value: "#A06A42" },
          { name: "Yellow", value: "#E5D900" },
          { name: "Lime", value: "#94E044" },
          { name: "Green", value: "#02BE01" },
          { name: "Cyan", value: "#00D3DD" },
          { name: "Blue", value: "#0083C7" },
          { name: "Dark Blue", value: "#0000EA" },
          { name: "Purple", value: "#CF6EE4" },
          { name: "Dark Purple", value: "#820080" },
        ],
      },
    ],
  },
  {
    name: "canvas",
    description: "View the current canvas state",
  },
  {
    name: "info",
    description: "Show PixelBoard info (canvas size, cooldown, your stats)",
  },
];

const body = JSON.stringify(commands);

const options = {
  hostname: "discord.com",
  port: 443,
  path: `/api/v10/applications/${APP_ID}/commands`,
  method: "PUT",
  headers: {
    "Authorization": `Bot ${BOT_TOKEN}`,
    "Content-Type": "application/json",
    "Content-Length": Buffer.byteLength(body),
  },
};

const req = https.request(options, (res) => {
  let data = "";
  res.on("data", (chunk) => { data += chunk; });
  res.on("end", () => {
    if (res.statusCode === 200) {
      const registered = JSON.parse(data);
      console.log(`Registered ${registered.length} commands:`);
      registered.forEach((cmd) => console.log(`  /${cmd.name} — ${cmd.description}`));
    } else {
      console.error(`Error ${res.statusCode}: ${data}`);
      process.exit(1);
    }
  });
});

req.on("error", (err) => {
  console.error("Request failed:", err.message);
  process.exit(1);
});

req.write(body);
req.end();
