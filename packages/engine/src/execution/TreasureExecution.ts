import { TileRef } from "@openfront/engine-api/game/GameMap";
import {
  MessageType,
  PlayerInfo,
  PlayerType,
  TREASURE_NAME,
} from "@openfront/engine-api/game/GameTypes";
import { PseudoRandom } from "@openfront/engine-lib/PseudoRandom";
import {
  zNum,
  zPlayerRef,
  zRandom,
  zTile,
} from "@openfront/engine-lib/snapshot/SnapshotType";
import { simpleHash } from "@openfront/engine-lib/Util";
import { z } from "zod";
import { Execution, Game, Player } from "../game/Game";
import { execSnapshotType } from "../snapshot/ExecutionSnapshot";
import type {
  ExecRecord,
  SnapshotReader,
  SnapshotWriter,
} from "../snapshot/SnapshotContext";
import { PlayerExecution } from "./PlayerExecution";

// troops guarding the chest, and what taking it pays. the richer the chest,
// the harder to crack
const TIERS = [
  { weight: 6, troops: 1_000, gold: 150_000n },
  { weight: 3, troops: 4_000, gold: 400_000n },
  { weight: 1, troops: 10_000, gold: 1_000_000n },
];

type Chest = { player: Player; site: TileRef; tier: number };

// Little gold-colored bots are hidden around the map, each one a tiny plot of
// land. Whoever takes the plot, by land or by boat, gets the gold. Same rules
// as any other attack, which is why nothing new needs drawing.
export class TreasureExecution implements Execution {
  private active = true;
  private mg: Game | null = null;
  private random: PseudoRandom;
  private chests: Chest[] = [];
  private placed = false;

  constructor(gameID: string) {
    this.random = new PseudoRandom(simpleHash(gameID) + 17);
  }

  activeDuringSpawnPhase(): boolean {
    return false;
  }

  init(mg: Game): void {
    this.mg = mg;
  }

  isActive(): boolean {
    return this.active;
  }

  tick(ticks: number): void {
    if (ticks % 10 !== 0) return;
    if (this.mg === null) throw new Error("Not initialized");
    const mg = this.mg;

    if (!this.placed) {
      this.placed = true;
      this.place(mg);
      return;
    }

    this.chests = this.chests.filter((c) => !this.collect(mg, c));
    if (this.chests.length === 0) this.active = false;
  }

  // true once someone owns the plot and has been paid
  private collect(mg: Game, chest: Chest): boolean {
    const owner = mg.owner(chest.site);
    if (!owner.isPlayer() || owner.id() === chest.player.id()) return false;
    const gold = TIERS[chest.tier].gold;
    owner.addGold(gold);
    mg.displayMessage(
      "events_display.treasure_found",
      MessageType.DONATION_RECEIVED,
      owner.id(),
      gold,
      { gold: gold.toString() },
    );
    return true;
  }

  private place(mg: Game): void {
    const count = Math.min(
      12,
      Math.max(4, Math.floor(mg.numLandTiles() / 60_000)),
    );
    for (let i = 0; i < count; i++) {
      const site = this.pickSite(mg);
      if (site === null) break;
      const tier = this.pickTier();
      const player = mg.addPlayer(
        new PlayerInfo(TREASURE_NAME, PlayerType.Bot, null, `treasure${i + 1}`),
      );
      for (const t of this.plot(mg, site)) player.conquer(t);
      player.setSpawnTile(site);
      player.setTroops(TIERS[tier].troops);
      mg.addExecution(new PlayerExecution(player));
      this.chests.push({ player, site, tier });
    }
    mg.displayMessage(
      "events_display.treasures_hidden",
      MessageType.DONATION_RECEIVED,
      null,
    );
  }

  // the site and its free land neighbours, a 3x3 patch
  private plot(mg: Game, site: TileRef): TileRef[] {
    const x = mg.x(site);
    const y = mg.y(site);
    const tiles: TileRef[] = [];
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        if (!mg.isValidCoord(x + dx, y + dy)) continue;
        const t = mg.ref(x + dx, y + dy);
        if (mg.isLand(t) && !mg.isImpassable(t) && !mg.hasOwner(t)) {
          tiles.push(t);
        }
      }
    }
    return tiles;
  }

  private pickTier(): number {
    const total = TIERS.reduce((sum, t) => sum + t.weight, 0);
    let roll = this.random.nextInt(0, total);
    for (let i = 0; i < TIERS.length; i++) {
      if (roll < TIERS[i].weight) return i;
      roll -= TIERS[i].weight;
    }
    return 0;
  }

  // far from players and from other chests, relaxing when the map is crowded
  private pickSite(mg: Game): TileRef | null {
    for (const radius of [12, 8, 4]) {
      for (let i = 0; i < 300; i++) {
        const x = this.random.nextInt(3, mg.width() - 3);
        const y = this.random.nextInt(3, mg.height() - 3);
        const tile = mg.ref(x, y);
        if (!mg.isLand(tile) || mg.isImpassable(tile) || mg.hasOwner(tile)) {
          continue;
        }
        if (!this.crowded(mg, x, y, radius)) return tile;
      }
    }
    return null;
  }

  private crowded(mg: Game, x: number, y: number, radius: number): boolean {
    for (let dy = -radius; dy <= radius; dy++) {
      for (let dx = -radius; dx <= radius; dx++) {
        if (!mg.isValidCoord(x + dx, y + dy)) continue;
        if (mg.hasOwner(mg.ref(x + dx, y + dy))) return true;
      }
    }
    return false;
  }

  snapshot(w: SnapshotWriter): ExecRecord {
    return TreasureExecutionSnapshot.write({
      active: this.active,
      initialized: this.mg !== null,
      random: w.random(this.random),
      placed: this.placed,
      chests: this.chests.map((c) => ({
        player: w.player(c.player),
        site: c.site,
        tier: c.tier,
      })),
    });
  }

  restoreSnapshot(s: TreasureState, r: SnapshotReader): void {
    this.active = s.active;
    this.mg = s.initialized ? r.game : null;
    this.random = r.random(s.random);
    this.placed = s.placed;
    this.chests = s.chests.map((c) => ({
      player: r.player(c.player),
      site: c.site,
      tier: c.tier,
    }));
  }
}

const TreasureStateSchema = z.object({
  active: z.boolean(),
  initialized: z.boolean(),
  random: zRandom(),
  placed: z.boolean(),
  chests: z.array(
    z.object({ player: zPlayerRef(), site: zTile(), tier: zNum() }),
  ),
});
type TreasureState = z.infer<typeof TreasureStateSchema>;

export const TreasureExecutionSnapshot = execSnapshotType({
  name: "Treasure",
  version: 1,
  schema: TreasureStateSchema,
  cls: () => TreasureExecution,
});
