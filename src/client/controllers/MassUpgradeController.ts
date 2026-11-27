import { Cell, UnitType } from "@openfront/engine-api/game/GameTypes";
import { EventBus } from "@openfront/shared/EventBus";
import { Controller } from "../Controller";
import { MouseDownEvent, MouseMoveEvent } from "../InputHandler";
import { nearestWithin, splitAmount } from "../MassOrdersMath";
import { TransformHandler } from "../TransformHandler";
import { SendUpgradeStructureIntentEvent } from "../Transport";
import { UIState } from "../UIState";
import { GameView } from "../view";

const UPGRADABLE: UnitType[] = [
  UnitType.City,
  UnitType.Port,
  UnitType.MissileSilo,
  UnitType.SAMLauncher,
  UnitType.DefensePost,
  UnitType.Factory,
];
// how close to a structure, in pixels, a press has to land
const REACH_PX = 32;
const REPEAT_MS = 120;

// Upgrade mode of the mass orders panel: press on one of your structures and
// it keeps gaining levels, whatever kind it is, until you let go. Nothing to
// pick first and no ghost on the cursor.
export class MassUpgradeController implements Controller {
  private timer: ReturnType<typeof setInterval> | null = null;
  private mouse = { x: 0, y: 0 };

  constructor(
    private game: GameView,
    private eventBus: EventBus,
    private uiState: UIState,
    private transform: TransformHandler,
  ) {}

  init() {
    if (!this.uiState.massOrders) return;
    this.eventBus.on(MouseMoveEvent, (e) => {
      this.mouse = { x: e.x, y: e.y };
    });
    this.eventBus.on(MouseDownEvent, (e) => this.start(e.x, e.y));
    // the game's own mouse-up is skipped after a drag, the window never is
    const stop = () => this.stop();
    window.addEventListener("pointerup", stop);
    window.addEventListener("pointercancel", stop);
    window.addEventListener("blur", stop);
    return () => {
      this.stop();
      window.removeEventListener("pointerup", stop);
      window.removeEventListener("pointercancel", stop);
      window.removeEventListener("blur", stop);
    };
  }

  private start(x: number, y: number) {
    this.stop();
    if (this.uiState.massMode !== "upgrade") return;
    this.mouse = { x, y };
    this.upgradeUnderCursor();
    this.timer = setInterval(() => this.upgradeUnderCursor(), REPEAT_MS);
  }

  private stop() {
    if (this.timer === null) return;
    clearInterval(this.timer);
    this.timer = null;
  }

  private upgradeUnderCursor() {
    const me = this.game.myPlayer();
    if (me === null) return;
    const spots = me.units(...UPGRADABLE).map((unit) => {
      const at = this.transform.worldToScreenCoordinates(
        new Cell(this.game.x(unit.tile()), this.game.y(unit.tile())),
      );
      return { unit, x: at.x, y: at.y };
    });
    const hit = nearestWithin(spots, this.mouse.x, this.mouse.y, REACH_PX);
    if (hit === null) return;
    for (const part of splitAmount(this.uiState.upgradeMultiplier || 1)) {
      this.eventBus.emit(
        new SendUpgradeStructureIntentEvent(
          hit.unit.id(),
          hit.unit.type(),
          part,
        ),
      );
    }
  }
}
