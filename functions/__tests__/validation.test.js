const { validateCoordinates, validateColor } = require("../src/shared/validation");

describe("validateCoordinates", () => {
  test("accepts (50, 50)", () => {
    const r = validateCoordinates(50, 50);
    expect(r.valid).toBe(true);
    expect(r.x).toBe(50);
    expect(r.y).toBe(50);
  });

  test("accepts bord (0, 0)", () => {
    expect(validateCoordinates(0, 0).valid).toBe(true);
  });

  test("accepts bord (99, 99)", () => {
    expect(validateCoordinates(99, 99).valid).toBe(true);
  });

  test("accepts bord (0, 99)", () => {
    expect(validateCoordinates(0, 99).valid).toBe(true);
  });

  test("accepts bord (99, 0)", () => {
    expect(validateCoordinates(99, 0).valid).toBe(true);
  });

  test("rejects x = -1", () => {
    const r = validateCoordinates(-1, 0);
    expect(r.valid).toBe(false);
    expect(r.error).toMatch(/out of bounds/);
  });

  test("rejects x = 100", () => {
    expect(validateCoordinates(100, 0).valid).toBe(false);
  });

  test("rejects y = 100", () => {
    expect(validateCoordinates(0, 100).valid).toBe(false);
  });

  test("rejects float coordinates", () => {
    const r = validateCoordinates(50.5, 50);
    expect(r.valid).toBe(false);
    expect(r.error).toMatch(/integers/);
  });

  test("rejects string numeric '50' (strict integer)", () => {
    const r = validateCoordinates("50", "50");
    expect(r.valid).toBe(false);
    expect(r.error).toMatch(/integers/);
  });

  test("rejects 'abc'", () => {
    expect(validateCoordinates("abc", 0).valid).toBe(false);
  });

  test("rejects undefined / missing coordinates", () => {
    expect(validateCoordinates(undefined, 0).valid).toBe(false);
    expect(validateCoordinates(0, undefined).valid).toBe(false);
  });

  test("rejects null coordinates", () => {
    expect(validateCoordinates(null, 0).valid).toBe(false);
  });
});

describe("validateColor", () => {
  test("accepts palette color uppercase", () => {
    const r = validateColor("#E50000");
    expect(r.valid).toBe(true);
    expect(r.color).toBe("#E50000");
  });

  test("accepts palette color lowercase, canonicalizes uppercase", () => {
    const r = validateColor("#e50000");
    expect(r.valid).toBe(true);
    expect(r.color).toBe("#E50000");
  });

  test("accepts palette color mixed case", () => {
    const r = validateColor("#94e044");
    expect(r.valid).toBe(true);
    expect(r.color).toBe("#94E044");
  });

  test("rejects color not in palette (#FF4500)", () => {
    const r = validateColor("#FF4500");
    expect(r.valid).toBe(false);
    expect(r.error).toMatch(/Invalid color/);
  });

  test("rejects color not in palette (#123456)", () => {
    expect(validateColor("#123456").valid).toBe(false);
  });
});
