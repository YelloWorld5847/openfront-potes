import { MessageType } from "@openfront/engine-api/game/GameTypes";
import { PseudoRandom } from "@openfront/engine-lib/PseudoRandom";
import { zNum, zRandom } from "@openfront/engine-lib/snapshot/SnapshotType";
import { simpleHash } from "@openfront/engine-lib/Util";
import { z } from "zod";
import { Execution, Game } from "../game/Game";
import { execSnapshotType } from "../snapshot/ExecutionSnapshot";
import type {
  ExecRecord,
  SnapshotReader,
  SnapshotWriter,
} from "../snapshot/SnapshotContext";

const FIRST_DEAL_TICKS = 1800;
const DEAL_EVERY_TICKS = 2400;

type Deal = { message: string; multiplier: number; ticks: number };

// order matters, the snapshot stores an index into this list
const DEALS: Deal[] = [
  { message: "events_display.market_boom", multiplier: 2, ticks: 600 },
  { message: "events_display.market_jackpot", multiplier: 3, ticks: 400 },
  { message: "events_display.market_crash", multiplier: 0.5, ticks: 600 },
];

// Now and then the black market moves every gold income at once (taxes, trade
// ships, trains) for a minute or so. Everybody gets the same announcement, so
// it is a shared moment to rush ports or to sit tight.
export class BlackMarketExecution implements Execution {
  private active = true;
  private mg: Game | null = null;
  private random: PseudoRandom;
  private nextAt = FIRST_DEAL_TICKS;
  // -1 while no deal is running
  private deal = -1;
  private endsAt = 0;

  constructor(gameID: string) {
    this.random = new PseudoRandom(simpleHash(gameID) + 13);
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

    if (this.deal >= 0) {
      if (ticks < this.endsAt) return;
      this.deal = -1;
      mg.config().setMarketMultiplier(1);
      mg.displayMessage(
        "events_display.market_end",
        MessageType.DONATION_RECEIVED,
        null,
      );
      return;
    }

    if (ticks < this.nextAt) return;
    this.deal = this.random.nextInt(0, DEALS.length);
    const deal = DEALS[this.deal];
    this.endsAt = ticks + deal.ticks;
    this.nextAt = ticks + DEAL_EVERY_TICKS;
    mg.config().setMarketMultiplier(deal.multiplier);
    mg.displayMessage(deal.message, MessageType.DONATION_RECEIVED, null);
  }

  snapshot(w: SnapshotWriter): ExecRecord {
    return BlackMarketExecutionSnapshot.write({
      active: this.active,
      initialized: this.mg !== null,
      random: w.random(this.random),
      nextAt: this.nextAt,
      deal: this.deal,
      endsAt: this.endsAt,
    });
  }

  restoreSnapshot(s: BlackMarketState, r: SnapshotReader): void {
    this.active = s.active;
    this.mg = s.initialized ? r.game : null;
    this.random = r.random(s.random);
    this.nextAt = s.nextAt;
    this.deal = s.deal;
    this.endsAt = s.endsAt;
    // the config is not part of the snapshot, so put the running deal back
    r.game
      .config()
      .setMarketMultiplier(s.deal >= 0 ? DEALS[s.deal].multiplier : 1);
  }
}

const BlackMarketStateSchema = z.object({
  active: z.boolean(),
  initialized: z.boolean(),
  random: zRandom(),
  nextAt: zNum(),
  deal: zNum(),
  endsAt: zNum(),
});
type BlackMarketState = z.infer<typeof BlackMarketStateSchema>;

export const BlackMarketExecutionSnapshot = execSnapshotType({
  name: "BlackMarket",
  version: 1,
  schema: BlackMarketStateSchema,
  cls: () => BlackMarketExecution,
});
