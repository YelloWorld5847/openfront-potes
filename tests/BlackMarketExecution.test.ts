import { PlayerType } from "@openfront/engine-api/game/GameTypes";
import { GameUpdateType } from "@openfront/engine-api/game/GameUpdates";
import { BlackMarketExecution } from "@openfront/engine/execution/BlackMarketExecution";
import { Game } from "@openfront/engine/game/Game";
import { playerInfo, setup } from "./util/Setup";

function run(game: Game, ticks: number): string[] {
  const out: string[] = [];
  for (let i = 0; i < ticks; i++) {
    const updates = game.executeNextTick();
    for (const e of updates[GameUpdateType.DisplayEvent] ?? []) {
      out.push(e.message);
    }
  }
  return out;
}

describe("BlackMarketExecution", () => {
  let game: Game;

  beforeEach(async () => {
    game = await setup(
      "big_plains",
      { publicGameModifiers: { isBlackMarket: true } },
      [playerInfo("human", PlayerType.Human)],
    );
    game.addExecution(new BlackMarketExecution("game_id"));
  });

  test("changes nothing before the first deal", () => {
    const seen = run(game, 1000);
    expect(seen).toHaveLength(0);
    expect(game.config().getMarketMultiplier()).toBe(1);
  });

  test("announces a deal to everyone and moves income", () => {
    const seen = run(game, 1900);
    expect(seen).toHaveLength(1);
    expect(seen[0]).toMatch(/^events_display\.market_(boom|jackpot|crash)$/);
    expect(game.config().getMarketMultiplier()).not.toBe(1);

    const human = game.player("human");
    const rate = game.config().goldAdditionRate(human);
    game.config().setMarketMultiplier(1);
    expect(rate).not.toBe(game.config().goldAdditionRate(human));
  });

  test("puts income back when the deal ends", () => {
    run(game, 1900);
    const seen = run(game, 700);
    expect(seen).toContain("events_display.market_end");
    expect(game.config().getMarketMultiplier()).toBe(1);
  });

  test("a second deal follows later", () => {
    const seen = run(game, 5000);
    const deals = seen.filter((m) => /market_(boom|jackpot|crash)$/.test(m));
    expect(deals.length).toBeGreaterThanOrEqual(2);
  });
});
