jest.mock("../src/shared/firestore", () => {
  let nextSnapshot = { docs: [] };
  return {
    pixelsCollection: jest.fn(() => ({
      get: jest.fn(async () => nextSnapshot),
    })),
    __setSnapshot(docs) {
      nextSnapshot = {
        docs: docs.map((d) => ({ id: `${d.x}_${d.y}`, data: () => d })),
      };
    },
    __reset() {
      nextSnapshot = { docs: [] };
    },
  };
});

const firestoreMock = require("../src/shared/firestore");
const getCanvasHandler = require("../src/pixel/getCanvas");
const { PALETTE } = require("../src/shared/config");

function mockRes() {
  const res = {};
  res.status = jest.fn(() => res);
  res.json = jest.fn(() => res);
  return res;
}

beforeEach(() => {
  firestoreMock.__reset();
  firestoreMock.pixelsCollection.mockClear();
});

describe("getCanvas", () => {
  test("scenario 6: empty firestore → 200 with empty pixels + metadata", async () => {
    firestoreMock.__setSnapshot([]);

    const res = mockRes();
    await getCanvasHandler({ method: "GET" }, res);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({
      pixels: [],
      width: 100,
      height: 100,
      palette: PALETTE,
    });
  });

  test("scenario 7: 3 pixels → returns all with {x, y, color}", async () => {
    firestoreMock.__setSnapshot([
      { x: 0, y: 0, color: "#FFFFFF", userId: "u1" },
      { x: 50, y: 50, color: "#E50000", userId: "u2" },
      { x: 99, y: 99, color: "#94E044", userId: "u3" },
    ]);

    const res = mockRes();
    await getCanvasHandler({ method: "GET" }, res);

    expect(res.status).toHaveBeenCalledWith(200);
    const body = res.json.mock.calls[0][0];
    expect(body.pixels).toHaveLength(3);
    expect(body.pixels[0]).toEqual({ x: 0, y: 0, color: "#FFFFFF" });
    expect(body.width).toBe(100);
    expect(body.height).toBe(100);
    expect(body.palette).toEqual(PALETTE);
  });

  test("response does not include userId (only x, y, color)", async () => {
    firestoreMock.__setSnapshot([
      { x: 0, y: 0, color: "#FFFFFF", userId: "secret-user" },
    ]);

    const res = mockRes();
    await getCanvasHandler({ method: "GET" }, res);

    const body = res.json.mock.calls[0][0];
    expect(body.pixels[0]).toEqual({ x: 0, y: 0, color: "#FFFFFF" });
    expect(body.pixels[0].userId).toBeUndefined();
  });

  test("scenario 8: one doc per (x,y) — last-write-wins deduplicated by doc id", async () => {
    firestoreMock.__setSnapshot([
      { x: 10, y: 10, color: "#E50000", userId: "u1" },
    ]);

    const res = mockRes();
    await getCanvasHandler({ method: "GET" }, res);

    const body = res.json.mock.calls[0][0];
    expect(body.pixels).toHaveLength(1);
    expect(body.pixels[0].color).toBe("#E50000");
  });

  test("POST → 405", async () => {
    const res = mockRes();
    await getCanvasHandler({ method: "POST" }, res);
    expect(res.status).toHaveBeenCalledWith(405);
  });
});
