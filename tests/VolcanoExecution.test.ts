import { PlayerType, VOLCANO_NAME } from "@openfront/engine-api/game/GameTypes";
import { VolcanoExecution } from "@openfront/engine/execution/VolcanoExecution";
import { Game, Player } from "@openfront/engine/game/Game";
import { playerInfo, setup } from "./util/Setup";

function volcano(game: Game): Player | undefined {
  return game.allPlayers().find((p) => p.name() === VOLCANO_NAME);
}

function run(game: Game, ticks: number) {
  for (let i = 0; i < ticks; i++) game.executeNextTick();
}

describe("VolcanoExecution", () => {
  let game: Game;

  beforeEach(async () => {
    game = await setup(
      "big_plains",
      { publicGameModifiers: { isVolcano: true } },
      [playerInfo("human", PlayerType.Human)],
    );
    game.addExecution(new VolcanoExecution("game_id"));
  });

  test("is there from the first moments of the game", () => {
    run(game, 30);
    expect(volcano(game)).toBeDefined();
  });

  test("wakes up as a lava bot with some land", () => {
    run(game, 30);
    const lava = volcano(game);
    expect(lava).toBeDefined();
    expect(lava!.type()).toBe(PlayerType.Bot);
    expect(lava!.numTilesOwned()).toBeGreaterThan(0);
  });

  test("keeps spreading as waves come", () => {
    run(game, 30);
    const start = volcano(game)!.numTilesOwned();
    run(game, 3000);
    expect(volcano(game)!.numTilesOwned()).toBeGreaterThan(start);
  });

  test("is deterministic for the same game id", async () => {
    const other = await setup(
      "big_plains",
      { publicGameModifiers: { isVolcano: true } },
      [playerInfo("human", PlayerType.Human)],
    );
    other.addExecution(new VolcanoExecution("game_id"));
    run(game, 3000);
    run(other, 3000);
    expect(volcano(other)!.numTilesOwned()).toBe(
      volcano(game)!.numTilesOwned(),
    );
    expect(volcano(other)!.spawnTile()).toBe(volcano(game)!.spawnTile());
  });
});
