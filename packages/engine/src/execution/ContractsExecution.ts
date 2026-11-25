import {
  MessageType,
  PlayerType,
  UnitType,
} from "@openfront/engine-api/game/GameTypes";
import { PseudoRandom } from "@openfront/engine-lib/PseudoRandom";
import { zNum, zRandom } from "@openfront/engine-lib/snapshot/SnapshotType";
import { simpleHash } from "@openfront/engine-lib/Util";
import { z } from "zod";
import { Execution, Game, Player } from "../game/Game";
import { execSnapshotType } from "../snapshot/ExecutionSnapshot";
import type {
  ExecRecord,
  SnapshotReader,
  SnapshotWriter,
} from "../snapshot/SnapshotContext";

const REWARD = 250_000n;
const REMIND_EVERY_TICKS = 3000;

type Contract = {
  message: string;
  done: (mg: Game, p: Player) => boolean;
};

// order matters, the snapshot stores an index into this list
const CONTRACTS: Contract[] = [
  {
    message: "events_display.contract_ports",
    done: (_mg, p) => p.unitsOwned(UnitType.Port) >= 3,
  },
  {
    message: "events_display.contract_cities",
    done: (_mg, p) => p.unitsOwned(UnitType.City) >= 4,
  },
  {
    message: "events_display.contract_silo",
    done: (_mg, p) => p.unitsOwned(UnitType.MissileSilo) >= 1,
  },
  {
    message: "events_display.contract_warships",
    done: (_mg, p) => p.unitsOwned(UnitType.Warship) >= 3,
  },
  {
    message: "events_display.contract_land",
    done: (mg, p) => p.numTilesOwned() * 100 >= mg.numLandTiles() * 5,
  },
];

type Assigned = { player: string; contract: number; done: boolean };

// Every human gets one secret objective and a gold prize for finishing it. The
// text goes out through the normal events panel, so only its owner sees it.
export class ContractsExecution implements Execution {
  private active = true;
  private mg: Game | null = null;
  private random: PseudoRandom;
  private assigned: Assigned[] = [];
  private started = false;

  constructor(gameID: string) {
    this.random = new PseudoRandom(simpleHash(gameID) + 11);
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

    if (!this.started) {
      this.started = true;
      this.assign(mg);
      return;
    }
    // a player who spawned late still gets one
    this.assign(mg);

    for (const a of this.assigned) {
      if (a.done || !mg.hasPlayer(a.player)) continue;
      const p = mg.player(a.player);
      if (!p.isAlive()) continue;
      if (CONTRACTS[a.contract].done(mg, p)) {
        a.done = true;
        p.addGold(REWARD);
        mg.displayMessage(
          "events_display.contract_done",
          MessageType.DONATION_RECEIVED,
          p.id(),
          REWARD,
          { gold: REWARD.toString() },
        );
      } else if (ticks % REMIND_EVERY_TICKS === 0) {
        this.announce(mg, p, a.contract);
      }
    }
  }

  private assign(mg: Game): void {
    const humans = mg.players().filter((p) => p.type() === PlayerType.Human);
    for (const p of humans) {
      if (this.assigned.some((a) => a.player === p.id())) continue;
      const contract = this.random.nextInt(0, CONTRACTS.length);
      this.assigned.push({ player: p.id(), contract, done: false });
      this.announce(mg, p, contract);
    }
  }

  private announce(mg: Game, p: Player, contract: number): void {
    mg.displayMessage(
      CONTRACTS[contract].message,
      MessageType.DONATION_RECEIVED,
      p.id(),
      undefined,
      { gold: REWARD.toString() },
    );
  }

  snapshot(w: SnapshotWriter): ExecRecord {
    return ContractsExecutionSnapshot.write({
      active: this.active,
      initialized: this.mg !== null,
      random: w.random(this.random),
      started: this.started,
      assigned: this.assigned,
    });
  }

  restoreSnapshot(s: ContractsState, r: SnapshotReader): void {
    this.active = s.active;
    this.mg = s.initialized ? r.game : null;
    this.random = r.random(s.random);
    this.started = s.started;
    this.assigned = s.assigned.map((a) => ({ ...a }));
  }
}

const ContractsStateSchema = z.object({
  active: z.boolean(),
  initialized: z.boolean(),
  random: zRandom(),
  started: z.boolean(),
  assigned: z.array(
    z.object({ player: z.string(), contract: zNum(), done: z.boolean() }),
  ),
});
type ContractsState = z.infer<typeof ContractsStateSchema>;

export const ContractsExecutionSnapshot = execSnapshotType({
  name: "Contracts",
  version: 1,
  schema: ContractsStateSchema,
  cls: () => ContractsExecution,
});
