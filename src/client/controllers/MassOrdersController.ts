import {
  MAX_UPGRADE_AMOUNT,
  PlayerBuildableUnitType,
  UnitType,
} from "@openfront/engine-api/game/GameTypes";
import { EventBus } from "@openfront/shared/EventBus";
import { Controller } from "../Controller";
import { SendUpgradeStructureIntentEvent } from "../Transport";
import { UIState } from "../UIState";
import { translateText } from "../Utils";
import { GameView } from "../view";

const AMOUNTS = [1, 5, 10, 25, MAX_UPGRADE_AMOUNT];

const BUTTON = "rounded bg-white/10 px-2 py-1 hover:bg-white/20";
// a separate string, two background classes on one element fight each other
const ACTIVE = "rounded bg-orange-600 px-2 py-1 hover:bg-orange-500";

// A small panel for games with mass orders on: pick an amount, pick what to
// place, then click (or hold) on the map. Everything it does goes through the
// same build and upgrade intents as the normal controls, so costs, silo slots
// and gold checks stay exactly as they are.
export class MassOrdersController implements Controller {
  private panel = document.createElement("div");
  private amountButtons = new Map<number, HTMLButtonElement>();
  private placeButtons = new Map<PlayerBuildableUnitType, HTMLButtonElement>();
  private repeatBox = document.createElement("input");

  constructor(
    private game: GameView,
    private eventBus: EventBus,
    private uiState: UIState,
  ) {}

  getTickIntervalMs(): number {
    return 250;
  }

  init() {
    if (!this.uiState.massOrders) return;

    this.panel.className =
      "fixed left-2 top-1/3 z-20 flex w-56 flex-col gap-2 rounded-md border border-white/15 bg-black/75 p-2 text-xs text-white select-none";
    this.panel.append(
      this.title(translateText("mass_orders.title")),
      this.label(translateText("mass_orders.quantity")),
      this.amountRow(),
      this.label(translateText("mass_orders.place")),
      this.placeRow(),
      this.repeatRow(),
      this.upgradeRow(),
      this.hint(translateText("mass_orders.hint")),
    );
    document.body.appendChild(this.panel);
    this.refresh();
    return () => this.panel.remove();
  }

  tick() {
    if (!this.uiState.massOrders) return;
    this.refresh();
  }

  private refresh() {
    const me = this.game.myPlayer();
    this.panel.style.display = me !== null && me.isAlive() ? "flex" : "none";
    for (const [amount, button] of this.amountButtons) {
      button.className =
        this.uiState.upgradeMultiplier === amount ? ACTIVE : BUTTON;
    }
    for (const [type, button] of this.placeButtons) {
      button.className = this.uiState.ghostStructure === type ? ACTIVE : BUTTON;
    }
    this.repeatBox.checked = this.uiState.holdRepeat === true;
  }

  private amountRow(): HTMLElement {
    const row = document.createElement("div");
    row.className = "flex gap-1";
    for (const amount of AMOUNTS) {
      const button = document.createElement("button");
      button.textContent = `x${amount}`;
      button.className = BUTTON;
      button.addEventListener("click", () => {
        this.uiState.upgradeMultiplier = amount;
        this.refresh();
      });
      this.amountButtons.set(amount, button);
      row.appendChild(button);
    }
    return row;
  }

  private placeRow(): HTMLElement {
    const row = document.createElement("div");
    row.className = "grid grid-cols-2 gap-1";
    const choices: [PlayerBuildableUnitType, string][] = [
      [UnitType.MissileSilo, translateText("mass_orders.silo")],
      [UnitType.City, translateText("mass_orders.city")],
      [UnitType.AtomBomb, translateText("mass_orders.atom_bomb")],
      [UnitType.HydrogenBomb, translateText("mass_orders.hydrogen_bomb")],
    ];
    for (const [type, name] of choices) {
      const button = document.createElement("button");
      button.textContent = name;
      button.className = BUTTON;
      button.addEventListener("click", () => {
        // clicking the chosen one again puts it back
        this.uiState.ghostStructure =
          this.uiState.ghostStructure === type ? null : type;
        this.refresh();
      });
      this.placeButtons.set(type, button);
      row.appendChild(button);
    }
    return row;
  }

  private repeatRow(): HTMLElement {
    const row = document.createElement("label");
    row.className = "flex items-center gap-2";
    this.repeatBox.type = "checkbox";
    this.repeatBox.addEventListener("change", () => {
      this.uiState.holdRepeat = this.repeatBox.checked;
    });
    row.append(this.repeatBox, translateText("mass_orders.hold_repeat"));
    return row;
  }

  private upgradeRow(): HTMLElement {
    const row = document.createElement("div");
    row.className = "flex gap-1";
    const choices: [UnitType, string][] = [
      [UnitType.MissileSilo, translateText("mass_orders.upgrade_silos")],
      [UnitType.City, translateText("mass_orders.upgrade_cities")],
    ];
    for (const [type, name] of choices) {
      const button = document.createElement("button");
      button.textContent = name;
      button.className = `${BUTTON} flex-1`;
      button.addEventListener("click", () => this.upgradeAll(type));
      row.appendChild(button);
    }
    return row;
  }

  private upgradeAll(type: UnitType) {
    const me = this.game.myPlayer();
    if (me === null) return;
    const amount = this.uiState.upgradeMultiplier || 1;
    for (const unit of me.units(type)) {
      this.eventBus.emit(
        new SendUpgradeStructureIntentEvent(unit.id(), type, amount),
      );
    }
  }

  private title(text: string): HTMLElement {
    const el = document.createElement("div");
    el.className = "text-sm font-bold tracking-wide";
    el.textContent = text;
    return el;
  }

  private label(text: string): HTMLElement {
    const el = document.createElement("div");
    el.className = "text-white/60";
    el.textContent = text;
    return el;
  }

  private hint(text: string): HTMLElement {
    const el = document.createElement("div");
    el.className = "text-[10px] text-white/50";
    el.textContent = text;
    return el;
  }
}
