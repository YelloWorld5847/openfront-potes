import { PlayerType, UnitType } from "@openfront/engine-api/game/GameTypes";
import { NukeExecution } from "@openfront/engine/execution/NukeExecution";
import { Game, Unit } from "@openfront/engine/game/Game";
import { playerInfo, setup } from "./util/Setup";

async function world(turbo: boolean): Promise<[Game, Unit]> {
  const game = await setup(
    "big_plains",
    {
      infiniteGold: true,
      ...(turbo ? { publicGameModifiers: { isTurboSilos: true } } : {}),
    },
    [
      playerInfo("human", PlayerType.Human),
      playerInfo("enemy", PlayerType.Human),
    ],
  );
  const me = game.player("human");
  const foe = game.player("enemy");
  for (let x = 20; x < 60; x++) {
    for (let y = 20; y < 60; y++) me.conquer(game.ref(x, y));
  }
  for (let x = 130; x < 190; x++) {
    for (let y = 130; y < 190; y++) foe.conquer(game.ref(x, y));
  }
  const silo = me.buildUnit(UnitType.MissileSilo, game.ref(40, 40), {});
  silo.setUnderConstruction(false);
  return [game, silo];
}

function salvo(game: Game, count: number) {
  const me = game.player("human");
  for (let i = 0; i < count; i++) {
    game.addExecution(
      new NukeExecution(
        UnitType.AtomBomb,
        me,
        game.ref(160, 160),
        null,
        -1,
        0,
        true,
      ),
    );
  }
}

describe("turbo silos", () => {
  test("a silo never queues or waits, however much it fires", async () => {
    const [, silo] = await world(true);
    for (let i = 0; i < 200; i++) silo.launch();
    silo.increaseLevel();
    expect(silo.missileTimerQueue()).toHaveLength(0);
    expect(silo.isInCooldown()).toBe(false);
  });

  test("a normal silo still has a slot per level", async () => {
    const [, silo] = await world(false);
    silo.launch();
    expect(silo.missileTimerQueue()).toHaveLength(1);
    expect(silo.isInCooldown()).toBe(true);
  });

  test("a salvo leaves all at once, from a single silo", async () => {
    const [game] = await world(true);
    salvo(game, 50);
    for (let i = 0; i < 3; i++) game.executeNextTick();
    expect(game.units(UnitType.AtomBomb)).toHaveLength(50);
  });

  test("without turbo a level 1 silo only sends one", async () => {
    const [game] = await world(false);
    salvo(game, 50);
    for (let i = 0; i < 3; i++) game.executeNextTick();
    expect(game.units(UnitType.AtomBomb).length).toBeLessThan(5);
  });
});

describe("mass orders", () => {
  test("structures may sit closer together", async () => {
    const [plain] = await world(false);
    const mass = await setup(
      "big_plains",
      { publicGameModifiers: { isMassOrders: true } },
      [playerInfo("human", PlayerType.Human)],
    );
    expect(plain.config().structureMinDist()).toBe(15);
    expect(mass.config().structureMinDist()).toBe(4);
  });
});
