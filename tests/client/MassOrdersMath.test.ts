import { describe, expect, it } from "vitest";
import {
  bombsFor,
  nearestWithin,
  spiralOffsets,
  splitAmount,
} from "../../src/client/MassOrdersMath";

describe("splitAmount", () => {
  it("keeps small amounts whole", () => {
    expect(splitAmount(1)).toEqual([1]);
    expect(splitAmount(50)).toEqual([50]);
  });

  it("cuts big amounts into orders the game accepts", () => {
    expect(splitAmount(120)).toEqual([50, 50, 20]);
    expect(splitAmount(500)).toEqual(Array(10).fill(50));
  });

  it("always adds up to what was asked", () => {
    for (const n of [1, 7, 49, 51, 99, 100, 333, 500]) {
      expect(splitAmount(n).reduce((a, b) => a + b, 0)).toBe(n);
    }
  });
});

describe("spiralOffsets", () => {
  it("starts on the spot and spreads outward", () => {
    const spots = spiralOffsets(9, 5);
    expect(spots[0]).toEqual([0, 0]);
    expect(spots).toHaveLength(9);
    expect(new Set(spots.map((s) => s.join(","))).size).toBe(9);
    for (const [x, y] of spots.slice(1)) {
      expect(Math.max(Math.abs(x), Math.abs(y))).toBe(5);
    }
  });

  it("gives at least the number asked for", () => {
    expect(spiralOffsets(500, 5).length).toBeGreaterThanOrEqual(500);
  });
});

describe("nearestWithin", () => {
  const points = [
    { id: 1, x: 100, y: 100 },
    { id: 2, x: 110, y: 100 },
    { id: 3, x: 300, y: 300 },
  ];

  it("picks the closest point in reach", () => {
    expect(nearestWithin(points, 108, 100, 30)?.id).toBe(2);
    expect(nearestWithin(points, 101, 100, 30)?.id).toBe(1);
  });

  it("gives nothing when everything is too far", () => {
    expect(nearestWithin(points, 200, 200, 30)).toBeNull();
    expect(nearestWithin([], 0, 0, 30)).toBeNull();
  });
});

describe("bombsFor", () => {
  it("counts a tenth of the amount, at least one", () => {
    expect(bombsFor(1)).toBe(1);
    expect(bombsFor(20)).toBe(2);
    expect(bombsFor(50)).toBe(5);
    expect(bombsFor(100)).toBe(10);
    expect(bombsFor(500)).toBe(50);
  });

  it("never goes past what one order can carry", () => {
    expect(splitAmount(bombsFor(500))).toEqual([50]);
  });
});
