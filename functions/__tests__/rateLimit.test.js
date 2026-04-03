const { checkCooldown } = require("../src/shared/rateLimit");

const fakeTimestamp = (ms) => ({
  toMillis: () => ms,
});

describe("checkCooldown", () => {
  const NOW = 1_700_000_000_000;

  test("null lastPlacedAt → allowed", () => {
    expect(checkCooldown(null, NOW)).toEqual({ allowed: true });
  });

  test("undefined lastPlacedAt → allowed", () => {
    expect(checkCooldown(undefined, NOW)).toEqual({ allowed: true });
  });

  test("lastPlacedAt 10s ago → allowed", () => {
    expect(checkCooldown(fakeTimestamp(NOW - 10_000), NOW)).toEqual({ allowed: true });
  });

  test("lastPlacedAt exactly 5s ago → allowed", () => {
    expect(checkCooldown(fakeTimestamp(NOW - 5_000), NOW)).toEqual({ allowed: true });
  });

  test("lastPlacedAt 2s ago → blocked with retryAfter 3", () => {
    expect(checkCooldown(fakeTimestamp(NOW - 2_000), NOW)).toEqual({
      allowed: false,
      retryAfter: 3,
    });
  });

  test("lastPlacedAt now → blocked with retryAfter 5", () => {
    expect(checkCooldown(fakeTimestamp(NOW), NOW)).toEqual({
      allowed: false,
      retryAfter: 5,
    });
  });

  test("accepts raw seconds/nanoseconds shape", () => {
    const ts = { seconds: Math.floor((NOW - 2_000) / 1000), nanoseconds: 0 };
    expect(checkCooldown(ts, NOW)).toEqual({ allowed: false, retryAfter: 3 });
  });
});
