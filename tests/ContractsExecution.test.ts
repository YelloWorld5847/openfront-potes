import { PlayerType } from "@openfront/engine-api/game/GameTypes";
import { GameUpdateType } from "@openfront/engine-api/game/GameUpdates";
import { PseudoRandom } from "@openfront/engine-lib/PseudoRandom";
import { simpleHash } from "@openfront/engine-lib/Util";
import { ContractsExecution } from "@openfront/engine/execution/ContractsExecution";
import { Game } from "@openfront/engine/game/Game";
import { playerInfo, setup } from "./util/Setup";

const LAND_CONTRACT = 4;

function messages(game: Game, ticks: number): string[] {
  const out: string[] = [];
  for (let i = 0; i < ticks; i++) {
    const updates = game.executeNextTick();
    for (const e of updates[GameUpdateType.DisplayEvent] ?? []) {
      out.push(e.message);
    }
  }
  return out;
}

// an id whose first draw is the land contract, the one a test can fake
function landGameID(): string {
  for (let i = 0; i < 500; i++) {
    const id = `game_${i}`;
    if (new PseudoRandom(simpleHash(id) + 11).nextInt(0, 5) === LAND_CONTRACT) {
      return id;
    }
  }
  throw new Error("no id found");
}

describe("ContractsExecution", () => {
  let game: Game;

  beforeEach(async () => {
    game = await setup(
      "big_plains",
      { publicGameModifiers: { isContracts: true } },
      [playerInfo("human", PlayerType.Human)],
    );
    game.addPlayer(playerInfo("bot", PlayerType.Bot));
  });

  test("tells each human their contract once, bots get none", () => {
    // a player only counts once they hold land, like after the spawn phase
    let given = 0;
    game.forEachTile((t) => {
      if (given < 3 && game.isLand(t) && !game.hasOwner(t)) {
        game.player("human").conquer(t);
        given++;
      }
    });
    game.addExecution(new ContractsExecution("game_id"));
    const seen = messages(game, 50).filter((m) =>
      m.startsWith("events_display.contract_"),
    );
    expect(seen).toHaveLength(1);
    expect(seen[0]).not.toBe("events_display.contract_done");
  });

  test("pays the reward once when the objective is met", () => {
    game.addExecution(new ContractsExecution(landGameID()));
    const human = game.player("human");
    const before = human.gold();

    const needed = Math.ceil(game.numLandTiles() * 0.05) + 1;
    let owned = 0;
    game.forEachTile((t) => {
      if (owned < needed && game.isLand(t) && !game.hasOwner(t)) {
        human.conquer(t);
        owned++;
      }
    });

    const seen = messages(game, 60);
    expect(
      seen.filter((m) => m === "events_display.contract_done"),
    ).toHaveLength(1);
    expect(human.gold() - before).toBe(250_000n);
  });
});
