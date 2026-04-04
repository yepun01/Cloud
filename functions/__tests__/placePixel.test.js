jest.mock("../src/shared/firestore", () => {
  const pixelWrites = [];
  const userWrites = [];
  let nextUserSnap = { exists: false, data: () => ({}) };

  const tx = {
    get: jest.fn(async () => nextUserSnap),
    set: jest.fn((ref, data, opts) => {
      if (ref.__kind === "pixel") pixelWrites.push({ ref, data, opts });
      else if (ref.__kind === "user") userWrites.push({ ref, data, opts });
    }),
  };

  return {
    db: {
      runTransaction: jest.fn(async (fn) => fn(tx)),
    },
    pixelDocRef: jest.fn((x, y) => ({ __kind: "pixel", id: `${x}_${y}` })),
    userDocRef: jest.fn((uid) => ({ __kind: "user", id: uid })),
    pixelsCollection: jest.fn(),
    __reset() {
      pixelWrites.length = 0;
      userWrites.length = 0;
      nextUserSnap = { exists: false, data: () => ({}) };
      tx.get.mockClear();
      tx.set.mockClear();
      this.db.runTransaction.mockClear();
    },
    __setUserSnap(snap) {
      nextUserSnap = snap;
    },
    __pixelWrites: pixelWrites,
    __userWrites: userWrites,
    __tx: tx,
  };
});

jest.mock("../src/shared/pubsub", () => ({
  publishPixelEvent: jest.fn(async () => undefined),
  TOPIC_NAME: "pixel-events",
}));

jest.mock("firebase-admin/firestore", () => ({
  FieldValue: {
    increment: (n) => ({ __increment: n }),
    serverTimestamp: () => ({ __sentinel: "serverTimestamp" }),
  },
}));

const firestoreMock = require("../src/shared/firestore");
const pubsubMock = require("../src/shared/pubsub");
const placePixelHandler = require("../src/pixel/placePixel");

function mockRes() {
  const res = {};
  res.status = jest.fn(() => res);
  res.json = jest.fn(() => res);
  return res;
}

function req(body, method = "POST") {
  return { method, body };
}

beforeEach(() => {
  firestoreMock.__reset();
  pubsubMock.publishPixelEvent.mockClear();
  pubsubMock.publishPixelEvent.mockResolvedValue(undefined);
});

describe("placePixel — happy path", () => {
  test("scenario 1: valid request writes pixel, updates user, publishes event, returns 200", async () => {
    const res = mockRes();
    await placePixelHandler(
      req({ userId: "discord:123", x: 50, y: 50, color: "#E50000" }),
      res
    );

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({
      success: true,
      pixel: { x: 50, y: 50, color: "#E50000" },
    });

    expect(firestoreMock.__pixelWrites).toHaveLength(1);
    const pw = firestoreMock.__pixelWrites[0];
    expect(pw.ref.id).toBe("50_50");
    expect(pw.data.x).toBe(50);
    expect(pw.data.y).toBe(50);
    expect(pw.data.color).toBe("#E50000");
    expect(pw.data.userId).toBe("discord:123");
    expect(pw.data.placedAt).toBeDefined();

    expect(firestoreMock.__userWrites).toHaveLength(1);
    const uw = firestoreMock.__userWrites[0];
    expect(uw.ref.id).toBe("discord:123");
    expect(uw.opts).toEqual({ merge: true });
    expect(uw.data.lastPlacedAt).toBeDefined();
    expect(uw.data.placedCount).toEqual({ __increment: 1 });

    expect(pubsubMock.publishPixelEvent).toHaveBeenCalledTimes(1);
    const event = pubsubMock.publishPixelEvent.mock.calls[0][0];
    expect(event.type).toBe("pixel-placed");
    expect(event.x).toBe(50);
    expect(event.y).toBe(50);
    expect(event.color).toBe("#E50000");
  });

  test("canonicalizes lowercase color to uppercase when stored", async () => {
    const res = mockRes();
    await placePixelHandler(
      req({ userId: "web:abc", x: 10, y: 20, color: "#e50000" }),
      res
    );
    expect(res.status).toHaveBeenCalledWith(200);
    expect(firestoreMock.__pixelWrites[0].data.color).toBe("#E50000");
  });

  test("bord (0, 0) accepted", async () => {
    const res = mockRes();
    await placePixelHandler(
      req({ userId: "u1", x: 0, y: 0, color: "#FFFFFF" }),
      res
    );
    expect(res.status).toHaveBeenCalledWith(200);
  });

  test("bord (99, 99) accepted", async () => {
    const res = mockRes();
    await placePixelHandler(
      req({ userId: "u1", x: 99, y: 99, color: "#FFFFFF" }),
      res
    );
    expect(res.status).toHaveBeenCalledWith(200);
  });
});

describe("placePixel — coordinate validation", () => {
  test("scenario 2: x = -1 → 400, no write", async () => {
    const res = mockRes();
    await placePixelHandler(
      req({ userId: "u1", x: -1, y: 0, color: "#E50000" }),
      res
    );
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json.mock.calls[0][0].error).toMatch(/out of bounds/);
    expect(firestoreMock.__pixelWrites).toHaveLength(0);
    expect(firestoreMock.db.runTransaction).not.toHaveBeenCalled();
  });

  test("x = 100 → 400, no write", async () => {
    const res = mockRes();
    await placePixelHandler(
      req({ userId: "u1", x: 100, y: 0, color: "#E50000" }),
      res
    );
    expect(res.status).toHaveBeenCalledWith(400);
    expect(firestoreMock.__pixelWrites).toHaveLength(0);
  });

  test("y = 100 → 400, no write", async () => {
    const res = mockRes();
    await placePixelHandler(
      req({ userId: "u1", x: 0, y: 100, color: "#E50000" }),
      res
    );
    expect(res.status).toHaveBeenCalledWith(400);
    expect(firestoreMock.__pixelWrites).toHaveLength(0);
  });

  test("string coordinates rejected (strict integer)", async () => {
    const res = mockRes();
    await placePixelHandler(
      req({ userId: "u1", x: "50", y: "50", color: "#E50000" }),
      res
    );
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json.mock.calls[0][0].error).toMatch(/integers/);
  });

  test("float coordinates rejected", async () => {
    const res = mockRes();
    await placePixelHandler(
      req({ userId: "u1", x: 50.5, y: 50, color: "#E50000" }),
      res
    );
    expect(res.status).toHaveBeenCalledWith(400);
  });
});

describe("placePixel — color validation", () => {
  test("scenario 3: color not in palette → 400, no write", async () => {
    const res = mockRes();
    await placePixelHandler(
      req({ userId: "u1", x: 0, y: 0, color: "#123456" }),
      res
    );
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json.mock.calls[0][0].error).toBe("Color not in palette");
    expect(firestoreMock.__pixelWrites).toHaveLength(0);
    expect(firestoreMock.db.runTransaction).not.toHaveBeenCalled();
  });
});

describe("placePixel — cooldown", () => {
  test("scenario 4: cooldown active → 429 with retryAfter, no pixel write", async () => {
    const twoSecondsAgo = Date.now() - 2000;
    firestoreMock.__setUserSnap({
      exists: true,
      data: () => ({ lastPlacedAt: { toMillis: () => twoSecondsAgo } }),
    });

    const res = mockRes();
    await placePixelHandler(
      req({ userId: "u1", x: 0, y: 0, color: "#E50000" }),
      res
    );

    expect(res.status).toHaveBeenCalledWith(429);
    const body = res.json.mock.calls[0][0];
    expect(body.success).toBe(false);
    expect(body.error).toBe("Cooldown active");
    expect(body.retryAfter).toBeGreaterThan(0);
    expect(body.retryAfter).toBeLessThanOrEqual(5);
    expect(firestoreMock.__pixelWrites).toHaveLength(0);
  });

  test("cooldown expired (10s ago) → 200", async () => {
    firestoreMock.__setUserSnap({
      exists: true,
      data: () => ({ lastPlacedAt: { toMillis: () => Date.now() - 10_000 } }),
    });

    const res = mockRes();
    await placePixelHandler(
      req({ userId: "u1", x: 0, y: 0, color: "#E50000" }),
      res
    );

    expect(res.status).toHaveBeenCalledWith(200);
    expect(firestoreMock.__pixelWrites).toHaveLength(1);
  });
});

describe("placePixel — missing fields", () => {
  test("scenario 5: empty body → 400", async () => {
    const res = mockRes();
    await placePixelHandler({ method: "POST", body: undefined }, res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json.mock.calls[0][0].error).toMatch(/body/i);
  });

  test("missing userId → 400", async () => {
    const res = mockRes();
    await placePixelHandler(
      req({ x: 0, y: 0, color: "#E50000" }),
      res
    );
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json.mock.calls[0][0].error).toMatch(/userId/);
  });

  test("missing x → 400", async () => {
    const res = mockRes();
    await placePixelHandler(
      req({ userId: "u1", y: 0, color: "#E50000" }),
      res
    );
    expect(res.status).toHaveBeenCalledWith(400);
  });

  test("missing color → 400", async () => {
    const res = mockRes();
    await placePixelHandler(
      req({ userId: "u1", x: 0, y: 0 }),
      res
    );
    expect(res.status).toHaveBeenCalledWith(400);
  });

  test("userId > 100 chars → 400", async () => {
    const res = mockRes();
    await placePixelHandler(
      req({ userId: "x".repeat(101), x: 0, y: 0, color: "#E50000" }),
      res
    );
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json.mock.calls[0][0].error).toMatch(/too long/);
  });
});

describe("placePixel — last-write-wins on same (x,y)", () => {
  test("scenario 8: pixel write uses set() without {merge: true} so last write overwrites", async () => {
    const res = mockRes();
    await placePixelHandler(
      req({ userId: "u1", x: 42, y: 42, color: "#E50000" }),
      res
    );

    expect(res.status).toHaveBeenCalledWith(200);
    expect(firestoreMock.__pixelWrites).toHaveLength(1);
    expect(firestoreMock.__pixelWrites[0].opts).toBeUndefined();
  });

  test("two successive writes on same (x,y) by different users: second overwrites first (same doc id, no merge)", async () => {
    const res1 = mockRes();
    await placePixelHandler(
      req({ userId: "userA", x: 10, y: 10, color: "#E50000" }),
      res1
    );
    expect(res1.status).toHaveBeenCalledWith(200);

    firestoreMock.__setUserSnap({ exists: false, data: () => ({}) });

    const res2 = mockRes();
    await placePixelHandler(
      req({ userId: "userB", x: 10, y: 10, color: "#94E044" }),
      res2
    );
    expect(res2.status).toHaveBeenCalledWith(200);

    expect(firestoreMock.__pixelWrites).toHaveLength(2);
    expect(firestoreMock.__pixelWrites[0].ref.id).toBe("10_10");
    expect(firestoreMock.__pixelWrites[1].ref.id).toBe("10_10");
    expect(firestoreMock.__pixelWrites[0].data.color).toBe("#E50000");
    expect(firestoreMock.__pixelWrites[1].data.color).toBe("#94E044");
    expect(firestoreMock.__pixelWrites[0].opts).toBeUndefined();
    expect(firestoreMock.__pixelWrites[1].opts).toBeUndefined();
  });
});

describe("placePixel — method / Pub/Sub resilience", () => {
  test("GET → 405", async () => {
    const res = mockRes();
    await placePixelHandler(
      { method: "GET", body: { userId: "u1", x: 0, y: 0, color: "#E50000" } },
      res
    );
    expect(res.status).toHaveBeenCalledWith(405);
  });

  test("Pub/Sub publish failure still returns 200 (pixel written)", async () => {
    pubsubMock.publishPixelEvent.mockRejectedValueOnce(new Error("pubsub down"));
    const res = mockRes();
    await placePixelHandler(
      req({ userId: "u1", x: 0, y: 0, color: "#E50000" }),
      res
    );
    expect(res.status).toHaveBeenCalledWith(200);
    expect(firestoreMock.__pixelWrites).toHaveLength(1);
  });
});
