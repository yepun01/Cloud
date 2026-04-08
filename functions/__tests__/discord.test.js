const nacl = require("tweetnacl");
const { verifySignature } = require("../src/discord/signature");

jest.mock("firebase-admin/firestore", () => ({
  Firestore: class Firestore {},
  FieldValue: {
    serverTimestamp: () => ({ __sentinel: "serverTimestamp" }),
    increment: (n) => ({ __op: "increment", n }),
  },
}));

jest.mock("firebase-admin", () => ({
  initializeApp: jest.fn(),
  apps: [],
}));

jest.mock("../src/shared/firestore", () => {
  const pixelWrites = [];
  const userWrites = [];
  let pixelsSnapshot = { docs: [] };
  let userSnapshot = { exists: false, data: () => null };

  const refFor = (id) => ({ id, _path: id });

  const api = {
    db: {
      runTransaction: async (fn) => {
        const tx = {
          get: async () => userSnapshot,
          set: (ref, data, opts) => {
            if (ref._path && ref._path.startsWith("users/")) userWrites.push({ ref, data, opts });
            else pixelWrites.push({ ref, data, opts });
          },
        };
        return fn(tx);
      },
    },
    pixelDocRef: (x, y) => refFor(`pixels/${x}_${y}`),
    userDocRef: (uid) => ({
      ...refFor(`users/${uid}`),
      get: async () => userSnapshot,
    }),
    pixelsCollection: () => ({ get: async () => pixelsSnapshot }),

    __test__pixelWrites: pixelWrites,
    __test__userWrites: userWrites,
    __test__setPixelsSnapshot: (s) => { pixelsSnapshot = s; },
    __test__setUserSnapshot: (s) => { userSnapshot = s; },
    __test__reset: () => {
      pixelWrites.length = 0;
      userWrites.length = 0;
      pixelsSnapshot = { docs: [] };
      userSnapshot = { exists: false, data: () => null };
    },
  };
  return api;
});

jest.mock("../src/shared/pubsub", () => ({
  publishPixelEvent: jest.fn().mockResolvedValue(undefined),
}));

const firestoreMock = require("../src/shared/firestore");
const { dispatchCommand } = require("../src/discord/handlers");
const discordInteractionHandler = require("../src/discord/discordInteraction");

function buildRes() {
  const res = {
    statusCode: null,
    body: null,
    sentText: null,
  };
  res.status = (code) => { res.statusCode = code; return res; };
  res.json = (b) => { res.body = b; return res; };
  res.send = (t) => { res.sentText = t; return res; };
  return res;
}

function buildReq({ method = "POST", headers = {}, body = {}, rawBody = null } = {}) {
  const lowerHeaders = {};
  for (const k of Object.keys(headers)) lowerHeaders[k.toLowerCase()] = headers[k];
  return {
    method,
    headers: lowerHeaders,
    body,
    rawBody: rawBody !== null ? rawBody : Buffer.from(JSON.stringify(body), "utf8"),
    get: (name) => lowerHeaders[name.toLowerCase()],
  };
}

beforeEach(() => {
  firestoreMock.__test__reset();
  jest.clearAllMocks();
});

describe("verifySignature", () => {
  test("returns true for a valid ed25519 signature", () => {
    const keyPair = nacl.sign.keyPair();
    const publicKey = Buffer.from(keyPair.publicKey).toString("hex");
    const timestamp = "1234567890";
    const body = JSON.stringify({ type: 1 });
    const message = Buffer.from(timestamp + body, "utf8");
    const signature = Buffer.from(nacl.sign.detached(message, keyPair.secretKey)).toString("hex");

    expect(verifySignature(body, signature, timestamp, publicKey)).toBe(true);
  });

  test("returns false for a tampered body", () => {
    const keyPair = nacl.sign.keyPair();
    const publicKey = Buffer.from(keyPair.publicKey).toString("hex");
    const timestamp = "1234567890";
    const body = JSON.stringify({ type: 1 });
    const message = Buffer.from(timestamp + body, "utf8");
    const signature = Buffer.from(nacl.sign.detached(message, keyPair.secretKey)).toString("hex");

    const tampered = JSON.stringify({ type: 2 });
    expect(verifySignature(tampered, signature, timestamp, publicKey)).toBe(false);
  });

  test("returns false for missing inputs", () => {
    expect(verifySignature(null, "sig", "ts", "key")).toBe(false);
    expect(verifySignature("body", null, "ts", "key")).toBe(false);
    expect(verifySignature("body", "sig", null, "key")).toBe(false);
    expect(verifySignature("body", "sig", "ts", null)).toBe(false);
  });

  test("returns false for malformed hex", () => {
    expect(verifySignature("body", "not-hex-zzz", "ts", "key")).toBe(false);
  });
});

describe("discordInteractionHandler", () => {
  let keyPair;
  let publicKeyHex;

  beforeAll(() => {
    keyPair = nacl.sign.keyPair();
    publicKeyHex = Buffer.from(keyPair.publicKey).toString("hex");
    process.env.DISCORD_PUBLIC_KEY = publicKeyHex;
  });

  function signedReq(body) {
    const timestamp = String(Math.floor(Date.now() / 1000));
    const rawBody = Buffer.from(JSON.stringify(body), "utf8");
    const signature = Buffer.from(
      nacl.sign.detached(Buffer.from(timestamp + rawBody.toString("utf8"), "utf8"), keyPair.secretKey)
    ).toString("hex");
    return buildReq({
      headers: {
        "x-signature-ed25519": signature,
        "x-signature-timestamp": timestamp,
      },
      body,
      rawBody,
    });
  }

  test("rejects GET with 405", async () => {
    const res = buildRes();
    await discordInteractionHandler(buildReq({ method: "GET" }), res);
    expect(res.statusCode).toBe(405);
  });

  test("rejects request with invalid signature", async () => {
    const req = buildReq({
      headers: { "x-signature-ed25519": "00".repeat(64), "x-signature-timestamp": "0" },
      body: { type: 1 },
    });
    const res = buildRes();
    await discordInteractionHandler(req, res);
    expect(res.statusCode).toBe(401);
  });

  test("responds to PING with PONG", async () => {
    const req = signedReq({ type: 1 });
    const res = buildRes();
    await discordInteractionHandler(req, res);
    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({ type: 1 });
  });

  test("dispatches /place command and writes pixel", async () => {
    const req = signedReq({
      type: 2,
      data: {
        name: "place",
        options: [
          { name: "x", value: 10 },
          { name: "y", value: 20 },
          { name: "color", value: "#E50000" },
        ],
      },
      member: { user: { id: "12345" } },
    });
    const res = buildRes();
    await discordInteractionHandler(req, res);
    expect(res.statusCode).toBe(200);
    expect(res.body.type).toBe(4);
    expect(res.body.data.content).toMatch(/Pixel placed at \(10, 20\)/);
    expect(res.body.data.flags).toBe(64);
    expect(firestoreMock.__test__pixelWrites.length).toBe(1);
    expect(firestoreMock.__test__pixelWrites[0].ref.id).toBe("pixels/10_20");
    expect(firestoreMock.__test__pixelWrites[0].data.userId).toBe("discord:12345");
  });

  test("dispatches /canvas command with embed", async () => {
    firestoreMock.__test__setPixelsSnapshot({
      docs: [
        { data: () => ({ x: 1, y: 2, color: "#E50000" }) },
        { data: () => ({ x: 3, y: 4, color: "#0000EA" }) },
      ],
    });
    const req = signedReq({
      type: 2,
      data: { name: "canvas" },
      member: { user: { id: "12345" } },
    });
    const res = buildRes();
    await discordInteractionHandler(req, res);
    expect(res.statusCode).toBe(200);
    expect(res.body.type).toBe(4);
    expect(res.body.data.embeds[0].title).toMatch(/Current Canvas/);
    expect(res.body.data.embeds[0].description).toMatch(/2.*pixels placed/);
  });

  test("dispatches /info command with user stats", async () => {
    firestoreMock.__test__setUserSnapshot({
      exists: true,
      data: () => ({
        placedCount: 7,
        lastPlacedAt: { toMillis: () => Date.now() - 2000 },
      }),
    });
    const req = signedReq({
      type: 2,
      data: { name: "info" },
      member: { user: { id: "12345" } },
    });
    const res = buildRes();
    await discordInteractionHandler(req, res);
    expect(res.statusCode).toBe(200);
    const fields = res.body.data.embeds[0].fields;
    const youField = fields.find((f) => f.name === "You");
    expect(youField.value).toMatch(/\*\*7\*\*.*pixels/);
    const cdField = fields.find((f) => f.name === "Cooldown status");
    expect(cdField.value).toMatch(/Cooldown:/);
  });

  test("unknown command returns ephemeral error", async () => {
    const req = signedReq({
      type: 2,
      data: { name: "unknown" },
      member: { user: { id: "12345" } },
    });
    const res = buildRes();
    await discordInteractionHandler(req, res);
    expect(res.statusCode).toBe(200);
    expect(res.body.data.content).toMatch(/Unknown command: unknown/);
    expect(res.body.data.flags).toBe(64);
  });

  test("/place returns cooldown ephemeral message on 429", async () => {
    firestoreMock.__test__setUserSnapshot({
      exists: true,
      data: () => ({
        placedCount: 1,
        lastPlacedAt: { toMillis: () => Date.now() - 1000 },
      }),
    });
    const req = signedReq({
      type: 2,
      data: {
        name: "place",
        options: [
          { name: "x", value: 10 },
          { name: "y", value: 20 },
          { name: "color", value: "#E50000" },
        ],
      },
      member: { user: { id: "12345" } },
    });
    const res = buildRes();
    await discordInteractionHandler(req, res);
    expect(res.body.data.content).toMatch(/Cooldown active. Wait \d+s/);
    expect(firestoreMock.__test__pixelWrites.length).toBe(0);
  });

  test("dispatchCommand handles DM context (no member, only user)", async () => {
    const interaction = {
      type: 2,
      data: {
        name: "place",
        options: [
          { name: "x", value: 5 },
          { name: "y", value: 5 },
          { name: "color", value: "#02BE01" },
        ],
      },
      user: { id: "67890" },
    };
    const result = await dispatchCommand(interaction);
    expect(result.type).toBe(4);
    expect(firestoreMock.__test__pixelWrites[0].data.userId).toBe("discord:67890");
  });
});
