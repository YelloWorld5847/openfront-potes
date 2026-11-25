import { GameConfigSchema } from "@openfront/engine-api/Schemas";
import { describe, expect, it, vi } from "vitest";
import { MapPlaylist } from "../../src/server/MapPlaylist";

vi.mock("../../src/server/MapLandTiles", () => ({
  getMapLandTiles: async () => 1_000_000,
}));

const CHAOS = [
  "isVolcano",
  "isContracts",
  "isBlackMarket",
  "isTreasures",
  "isFog",
] as const;

describe("MapPlaylist chaos modifiers", () => {
  it("puts at least one of ours in every special game", async () => {
    const playlist = new MapPlaylist();
    for (let i = 0; i < 60; i++) {
      const config = await playlist.gameConfig("special");
      const mods = config.publicGameModifiers ?? {};
      expect(CHAOS.some((key) => mods[key] === true)).toBe(true);
      expect(GameConfigSchema.safeParse(config).success).toBe(true);
    }
  });

  it("can pin modifiers with FORCE_MODIFIERS", async () => {
    vi.stubEnv("FORCE_MODIFIERS", "isFog,isTreasures");
    const config = await new MapPlaylist().gameConfig("special");
    expect(config.publicGameModifiers?.isFog).toBe(true);
    expect(config.publicGameModifiers?.isTreasures).toBe(true);
    vi.unstubAllEnvs();
  });
});
