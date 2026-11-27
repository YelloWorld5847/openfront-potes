import { PlayerType, UnitType } from "@openfront/engine-api/game/GameTypes";
import { MissileSiloExecution } from "@openfront/engine/execution/MissileSiloExecution";
import { Game, Unit } from "@openfront/engine/game/Game";
import { playerInfo, setup } from "./util/Setup";

async function silo(turbo: boolean, level: number): Promise<[Game, Unit]> {
  const game = await setup(
    "big_plains",
    turbo ? { publicGameModifiers: { isTurboSilos: true } } : {},
    [playerInfo("human", PlayerType.Human)],
  );
  const player = game.player("human");
  player.conquer(game.ref(5, 5));
  const unit = player.buildUnit(UnitType.MissileSilo, game.ref(5, 5), {});
  unit.setUnderConstruction(false);
  for (let i = 1; i < level; i++) unit.increaseLevel();
  game.addExecution(new MissileSiloExecution(unit));
  return [game, unit];
}

describe("turbo silos", () => {
  test("the wait shrinks with the level, never below one second", async () => {
    const [game] = await silo(true, 1);
    const cooldown = (level: number) => game.config().SiloCooldown(level);
    expect(cooldown(1)).toBe(90);
    expect(cooldown(3)).toBeLessThan(cooldown(1));
    expect(cooldown(11)).toBeLessThan(cooldown(3));
    expect(cooldown(500)).toBe(10);
  });

  test("without the modifier the wait is always the usual 9 seconds", async () => {
    const [game] = await silo(false, 1);
    expect(game.config().SiloCooldown(1)).toBe(90);
    expect(game.config().SiloCooldown(40)).toBe(90);
  });

  test("an upgraded turbo silo reloads in a fraction of the time", async () => {
    const [turbo, fast] = await silo(true, 21);
    const [plain, slow] = await silo(false, 21);
    fast.launch();
    slow.launch();
    // every new level starts out reloading, one slot comes back per tick
    for (let i = 0; i < 60; i++) {
      turbo.executeNextTick();
      plain.executeNextTick();
    }
    expect(fast.missileTimerQueue()).toHaveLength(0);
    expect(slow.missileTimerQueue().length).toBeGreaterThan(0);
  });
});

describe("mass orders", () => {
  test("structures may sit closer together", async () => {
    const [plain] = await silo(false, 1);
    const mass = await setup(
      "big_plains",
      { publicGameModifiers: { isMassOrders: true } },
      [playerInfo("human", PlayerType.Human)],
    );
    expect(plain.config().structureMinDist()).toBe(15);
    expect(mass.config().structureMinDist()).toBe(4);
  });
});
