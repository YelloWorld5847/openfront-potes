import {
  PlayerInfo,
  PlayerType,
  VOLCANO_NAME,
} from "@openfront/engine-api/game/GameTypes";
import { PseudoRandom } from "@openfront/engine-lib/PseudoRandom";
import {
  zNum,
  zPlayerRef,
  zRandom,
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
import { AttackExecution } from "./AttackExecution";
import { PlayerExecution } from "./PlayerExecution";
import { getSpawnTiles } from "./Util";

const FIRST_ERUPTION_TICKS = 1800;
const WAVE_TICKS = 450;
const RESPAWN_TICKS = 600;
const MIN_WAVE_TROOPS = 1000;

// A bot called "Volcan" that wakes up on a quiet spot and keeps pushing lava
// out as ordinary attacks. Players fight it like any other player, so there is
// no new rule to learn, only a neighbour that never makes peace.
export class VolcanoExecution implements Execution {
  private active = true;
  private mg: Game | null = null;
  private random: PseudoRandom;
  private volcano: Player | null = null;
  private eruptions = 0;
  private nextAt = FIRST_ERUPTION_TICKS;

  constructor(gameID: string) {
    this.random = new PseudoRandom(simpleHash(gameID) + 7);
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
    if (ticks < this.nextAt) return;

    if (this.volcano === null || !this.volcano.isAlive()) {
      this.wakeUp(this.mg);
      this.nextAt =
        ticks + (this.volcano === null ? RESPAWN_TICKS : WAVE_TICKS);
      return;
    }
    this.erupt(this.mg, this.volcano);
    this.nextAt = ticks + WAVE_TICKS;
  }

  private wakeUp(mg: Game): void {
    const site = this.pickSite(mg);
    if (site === null) return;
    const tiles = getSpawnTiles(mg, site, false);
    if (tiles.length === 0) return;

    this.eruptions++;
    const player = mg.addPlayer(
      new PlayerInfo(
        VOLCANO_NAME,
        PlayerType.Bot,
        null,
        `volcano${this.eruptions}`,
      ),
    );
    for (const t of tiles) player.conquer(t);
    player.setSpawnTile(site);
    mg.addExecution(new PlayerExecution(player));
    this.volcano = player;
  }

  // a spot with nobody around it, so the first wave doesn't land on a player
  private pickSite(mg: Game) {
    for (const radius of [12, 6]) {
      for (let i = 0; i < 250; i++) {
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

  // sized from what real players hold, so it hurts on any map and any speed
  private waveTroops(mg: Game): number {
    const troops = mg
      .players()
      .filter((p) => p.type() !== PlayerType.Bot)
      .map((p) => p.troops())
      .sort((a, b) => a - b);
    if (troops.length === 0) return MIN_WAVE_TROOPS;
    const median = troops[Math.floor(troops.length / 2)];
    return Math.max(MIN_WAVE_TROOPS, Math.floor(median / 2));
  }

  private erupt(mg: Game, volcano: Player): void {
    const targets = volcano.nearby();
    if (targets.length === 0) return;
    const each = Math.floor(this.waveTroops(mg) / targets.length);
    if (each < 1) return;
    for (const target of targets) {
      volcano.addTroops(each);
      mg.addExecution(
        new AttackExecution(
          each,
          volcano,
          target.isPlayer() ? target.id() : null,
        ),
      );
    }
  }

  snapshot(w: SnapshotWriter): ExecRecord {
    return VolcanoExecutionSnapshot.write({
      active: this.active,
      initialized: this.mg !== null,
      random: w.random(this.random),
      volcano: this.volcano === null ? null : w.player(this.volcano),
      eruptions: this.eruptions,
      nextAt: this.nextAt,
    });
  }

  restoreSnapshot(s: VolcanoState, r: SnapshotReader): void {
    this.active = s.active;
    this.mg = s.initialized ? r.game : null;
    this.random = r.random(s.random);
    this.volcano = s.volcano === null ? null : r.player(s.volcano);
    this.eruptions = s.eruptions;
    this.nextAt = s.nextAt;
  }
}

const VolcanoStateSchema = z.object({
  active: z.boolean(),
  initialized: z.boolean(),
  random: zRandom(),
  volcano: zPlayerRef().nullable(),
  eruptions: zNum(),
  nextAt: zNum(),
});
type VolcanoState = z.infer<typeof VolcanoStateSchema>;

export const VolcanoExecutionSnapshot = execSnapshotType({
  name: "Volcano",
  version: 1,
  schema: VolcanoStateSchema,
  cls: () => VolcanoExecution,
});
