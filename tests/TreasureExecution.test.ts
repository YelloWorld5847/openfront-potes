import {
  PlayerType,
  TREASURE_NAME,
} from "@openfront/engine-api/game/GameTypes";
import { GameUpdateType } from "@openfront/engine-api/game/GameUpdates";
import { TreasureExecution } from "@openfront/engine/execution/TreasureExecution";
import { Game, Player } from "@openfront/engine/game/Game";
import { playerInfo, setup } from "./util/Setup";

function chests(game: Game): Player[] {
  return game.allPlayers().filter((p) => p.name() === TREASURE_NAME);
}

type Found = { message: string; gold?: bigint };

function run(game: Game, ticks: number): Found[] {
  const out: Found[] = [];
  for (let i = 0; i < ticks; i++) {
    const updates = game.executeNextTick();
    for (const e of updates[GameUpdateType.DisplayEvent] ?? []) {
      out.push({ message: e.message, gold: e.goldAmount });
    }
  }
  return out;
}

describe("TreasureExecution", () => {
  let game: Game;

  beforeEach(async () => {
    game = await setup(
      "big_plains",
      { publicGameModifiers: { isTreasures: true } },
      [playerInfo("human", PlayerType.Human)],
    );
    // a human has to hold land to count as alive
    const home = game.ref(5, 5);
    game.player("human").conquer(home);
    game.addExecution(new TreasureExecution("game_id"));
  });

  test("hides at least a few guarded plots and tells everyone", () => {
    const seen = run(game, 30);
    expect(chests(game).length).toBeGreaterThanOrEqual(4);
    for (const c of chests(game)) {
      expect(c.numTilesOwned()).toBeGreaterThan(0);
      expect(c.troops()).toBeGreaterThan(0);
    }
    expect(seen.map((m) => m.message)).toContain(
      "events_display.treasures_hidden",
    );
  });

  test("pays whoever takes a plot, once", () => {
    run(game, 30);
    const human = game.player("human");
    const target = chests(game)[0];
    const before = human.gold();

    human.conquer(target.spawnTile()!);
    const seen = run(game, 30);
    const found = seen.filter(
      (m) => m.message === "events_display.treasure_found",
    );

    expect(found).toHaveLength(1);
    expect(human.gold() - before).toBe(found[0].gold);
    expect(found[0].gold! > 0n).toBe(true);
  });

  test("is deterministic for the same game id", async () => {
    const other = await setup(
      "big_plains",
      { publicGameModifiers: { isTreasures: true } },
      [playerInfo("human", PlayerType.Human)],
    );
    other.player("human").conquer(other.ref(5, 5));
    other.addExecution(new TreasureExecution("game_id"));
    run(game, 30);
    run(other, 30);
    expect(chests(other).map((c) => c.spawnTile())).toEqual(
      chests(game).map((c) => c.spawnTile()),
    );
  });
});
