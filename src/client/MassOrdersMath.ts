import { MAX_UPGRADE_AMOUNT } from "@openfront/engine-api/game/GameTypes";

// One order may carry at most MAX_UPGRADE_AMOUNT, so a bigger amount goes out
// as several orders, e.g. 120 -> 50, 50, 20
export function splitAmount(total: number): number[] {
  const parts: number[] = [];
  let left = Math.max(1, Math.floor(total));
  while (left > 0) {
    const part = Math.min(left, MAX_UPGRADE_AMOUNT);
    parts.push(part);
    left -= part;
  }
  return parts;
}

// Grid offsets spiralling out from (0, 0), nearest ring first, `step` apart.
// A caller keeps the ones that land on valid ground until it has enough.
export function spiralOffsets(
  count: number,
  step: number,
  maxRings = 40,
): [number, number][] {
  const out: [number, number][] = [[0, 0]];
  for (let ring = 1; ring <= maxRings && out.length < count; ring++) {
    for (let dx = -ring; dx <= ring; dx++) {
      for (let dy = -ring; dy <= ring; dy++) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) !== ring) continue;
        out.push([dx * step, dy * step]);
      }
    }
  }
  return out;
}

// The closest point to (x, y) within `radius`, or null. Screen pixels in, one
// of the given points out.
export function nearestWithin<T extends { x: number; y: number }>(
  points: readonly T[],
  x: number,
  y: number,
  radius: number,
): T | null {
  let best: T | null = null;
  let bestSquared = radius * radius;
  for (const p of points) {
    const dx = p.x - x;
    const dy = p.y - y;
    const d = dx * dx + dy * dy;
    if (d <= bestSquared) {
      best = p;
      bestSquared = d;
    }
  }
  return best;
}

// A bomb is a lot heavier to simulate and to draw than a building, so the
// amount chosen in the panel counts a tenth for bombs: x20 is 2, x50 is 5,
// x500 is 50. Never less than one.
export function bombsFor(amount: number): number {
  return Math.max(1, Math.round(amount / 10));
}
