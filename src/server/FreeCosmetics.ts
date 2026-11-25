import { Cosmetics } from "@openfront/shared/CosmeticSchemas";

type Cell = (x: number, y: number) => boolean;

// same layout PatternDecoder reads: version byte, then scale/width/height
// packed in two bytes, then one bit per cell (set = secondary color)
function encode(size: number, scale: number, cell: Cell): string {
  const bytes = new Uint8Array(3 + ((size * size + 7) >> 3));
  bytes[1] = (scale & 7) | (((size - 2) & 0x1f) << 3);
  bytes[2] = ((size - 2) >> 5) | ((size - 2) << 2);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      if (!cell(x, y)) continue;
      const i = y * size + x;
      bytes[3 + (i >> 3)] |= 1 << (i & 7);
    }
  }
  return Buffer.from(bytes).toString("base64url");
}

const waveShift = [0, 1, 2, 1, 0, 1, 2, 1];

const PATTERNS: Record<string, { size: number; scale: number; cell: Cell }> = {
  stripes: { size: 8, scale: 1, cell: (_x, y) => y < 4 },
  pillars: { size: 8, scale: 1, cell: (x) => x < 4 },
  diagonal: { size: 8, scale: 1, cell: (x, y) => (x + y) % 8 < 4 },
  checker: {
    size: 8,
    scale: 1,
    cell: (x, y) => ((x >> 2) + (y >> 2)) % 2 === 0,
  },
  dots: { size: 8, scale: 1, cell: (x, y) => x % 4 < 2 && y % 4 < 2 },
  grid: { size: 8, scale: 1, cell: (x, y) => x === 0 || y === 0 },
  zigzag: {
    size: 8,
    scale: 1,
    cell: (x, y) => (y + (x < 4 ? x : 7 - x)) % 8 < 2,
  },
  bricks: {
    size: 8,
    scale: 1,
    cell: (x, y) => y % 4 === 0 || (y < 4 ? x === 0 : x === 4),
  },
  diamond: {
    size: 8,
    scale: 1,
    cell: (x, y) => Math.abs(2 * x - 7) + Math.abs(2 * y - 7) <= 6,
  },
  crosshatch: {
    size: 8,
    scale: 1,
    cell: (x, y) => (x + y) % 4 === 0 || (x - y + 8) % 4 === 0,
  },
  waves: { size: 8, scale: 1, cell: (x, y) => (y + waveShift[x]) % 4 === 0 },
  rings: {
    size: 16,
    scale: 1,
    cell: (x, y) => {
      const d = (x - 7.5) ** 2 + (y - 7.5) ** 2;
      return d > 14 && d < 40;
    },
  },
};

const PALETTES: Record<string, { primary: string; secondary: string }> = {
  ocean: { primary: "#1d4e89", secondary: "#9fd3f2" },
  flame: { primary: "#b5171f", secondary: "#f6a04d" },
  forest: { primary: "#2d5a27", secondary: "#c4d68a" },
  sand: { primary: "#c9a24b", secondary: "#fff2cf" },
  night: { primary: "#1c1b33", secondary: "#8c7ae6" },
  rose: { primary: "#a4235d", secondary: "#f7c6dc" },
  mono: { primary: "#222222", secondary: "#eeeeee" },
};

export function freeCosmetics(): Cosmetics {
  const palettes = Object.keys(PALETTES);

  const colorPalettes = Object.fromEntries(
    palettes.map((name) => [
      name,
      {
        name,
        primaryColor: PALETTES[name].primary,
        secondaryColor: PALETTES[name].secondary,
      },
    ]),
  );

  const patterns = Object.fromEntries(
    Object.entries(PATTERNS).map(([name, p]) => [
      name,
      {
        name,
        product: null,
        rarity: "common",
        pattern: encode(p.size, p.scale, p.cell),
        colorPalettes: palettes.map((n) => ({ name: n, isArchived: false })),
      },
    ]),
  );

  return { colorPalettes, patterns, flags: {} } as Cosmetics;
}
