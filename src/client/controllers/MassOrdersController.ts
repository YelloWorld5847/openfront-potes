import {
  PlayerBuildableUnitType,
  UnitType,
} from "@openfront/engine-api/game/GameTypes";
import { EventBus } from "@openfront/shared/EventBus";
import { Controller } from "../Controller";
import { BuildUnitIntentEvent } from "../Transport";
import { UIState } from "../UIState";
import { translateText } from "../Utils";
import { GameView } from "../view";

const AMOUNTS = [1, 20, 50, 100, 500];

// what "fill my territory" can place
const FILLABLE: UnitType[] = [
  UnitType.City,
  UnitType.Port,
  UnitType.MissileSilo,
  UnitType.SAMLauncher,
  UnitType.DefensePost,
  UnitType.Factory,
];
// tiles kept between two things placed by one fill, a bit over the game's
// minimum so nothing is refused for being too close
const FILL_SPACING = 6;

const BUTTON = "rounded bg-white/10 px-2 py-1 hover:bg-white/20";
// a separate string, two background classes on one element fight each other
const ACTIVE = "rounded bg-orange-600 px-2 py-1 hover:bg-orange-500";

// A small panel for games with mass orders on: pick an amount, pick what to
// place, then click (or hold) on the map. Everything it does goes through the
// same build and upgrade intents as the normal controls, so costs and gold
// checks stay exactly as they are. On a narrow screen it starts folded to a
// single button so it does not cover the map.
export class MassOrdersController implements Controller {
  private root = document.createElement("div");
  private body = document.createElement("div");
  private toggle = document.createElement("button");
  private amountButtons = new Map<number, HTMLButtonElement>();
  private modeButtons = new Map<string, HTMLButtonElement>();
  private placeButtons = new Map<PlayerBuildableUnitType, HTMLButtonElement>();
  private repeatBox = document.createElement("input");
  private open = true;

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

    this.open = !this.compact();
    this.root.className =
      "fixed left-2 top-24 z-20 flex w-56 max-w-[calc(100vw-1rem)] flex-col rounded-md border border-white/15 bg-black/80 text-xs text-white select-none";
    this.toggle.className =
      "flex w-full items-center justify-between px-2 py-2 text-sm font-bold tracking-wide";
    this.toggle.addEventListener("click", () => {
      this.open = !this.open;
      this.refresh();
    });
    this.body.className =
      "flex max-h-[65vh] flex-col gap-2 overflow-y-auto px-2 pb-2";
    this.body.append(
      this.label(translateText("mass_orders.quantity")),
      this.amountRow(),
      this.label(translateText("mass_orders.mode")),
      this.modeRow(),
      this.label(translateText("mass_orders.place")),
      this.placeRow(),
      this.fillButton(),
      this.repeatRow(),
      this.hint(translateText("mass_orders.hint")),
    );
    this.root.append(this.toggle, this.body);
    document.body.appendChild(this.root);
    this.refresh();
    return () => this.root.remove();
  }

  tick() {
    if (!this.uiState.massOrders) return;
    this.refresh();
  }

  private compact(): boolean {
    return window.matchMedia("(max-width: 768px)").matches;
  }

  private refresh() {
    const me = this.game.myPlayer();
    this.root.style.display = me !== null && me.isAlive() ? "flex" : "none";
    this.toggle.textContent = `${translateText("mass_orders.title")}  ${this.open ? "-" : "+"}`;
    this.body.style.display = this.open ? "flex" : "none";
    const pad = this.compact() ? "py-2" : "py-1";
    const style = (active: boolean) =>
      (active ? ACTIVE : BUTTON).replace("py-1", pad);
    for (const [amount, button] of this.amountButtons) {
      button.className = style(this.uiState.upgradeMultiplier === amount);
    }
    for (const [mode, button] of this.modeButtons) {
      button.className = `${style((this.uiState.massMode ?? "place") === mode)} flex-1`;
    }
    for (const [type, button] of this.placeButtons) {
      button.className = style(this.uiState.ghostStructure === type);
    }
    this.repeatBox.checked = this.uiState.holdRepeat === true;
  }

  private amountRow(): HTMLElement {
    const row = document.createElement("div");
    row.className = "flex flex-wrap gap-1";
    for (const amount of AMOUNTS) {
      const button = document.createElement("button");
      button.textContent = `x${amount}`;
      button.addEventListener("click", () => {
        this.uiState.upgradeMultiplier = amount;
        this.refresh();
      });
      this.amountButtons.set(amount, button);
      row.appendChild(button);
    }
    return row;
  }

  private modeRow(): HTMLElement {
    const row = document.createElement("div");
    row.className = "flex gap-1";
    const modes: [string, string][] = [
      ["place", translateText("mass_orders.mode_place")],
      ["upgrade", translateText("mass_orders.mode_upgrade")],
    ];
    for (const [mode, name] of modes) {
      const button = document.createElement("button");
      button.textContent = name;
      button.addEventListener("click", () => {
        this.uiState.massMode = mode === "upgrade" ? "upgrade" : "place";
        this.refresh();
      });
      this.modeButtons.set(mode, button);
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
      [UnitType.Port, translateText("mass_orders.port")],
      [UnitType.SAMLauncher, translateText("mass_orders.sam")],
      [UnitType.DefensePost, translateText("mass_orders.defense_post")],
      [UnitType.Factory, translateText("mass_orders.factory")],
      [UnitType.AtomBomb, translateText("mass_orders.atom_bomb")],
      [UnitType.HydrogenBomb, translateText("mass_orders.hydrogen_bomb")],
    ];
    for (const [type, name] of choices) {
      const button = document.createElement("button");
      button.textContent = name;
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

  private fillButton(): HTMLElement {
    const button = document.createElement("button");
    button.textContent = translateText("mass_orders.fill");
    button.className = BUTTON;
    button.addEventListener("click", () => this.fill());
    return button;
  }

  // Places as many of the chosen structure as the amount says, spread over
  // the territory. Each one is an ordinary build order: the game refuses the
  // ones that do not fit or that cost too much, nothing else is bypassed.
  private fill() {
    const me = this.game.myPlayer();
    if (me === null) return;
    const chosen = this.uiState.ghostStructure;
    const type = FILLABLE.find((t) => t === chosen) ?? UnitType.City;
    const wanted = this.uiState.upgradeMultiplier || 1;

    const tiles: number[] = [];
    for (let y = 0; y < this.game.height(); y += 3) {
      for (let x = 0; x < this.game.width(); x += 3) {
        const tile = this.game.ref(x, y);
        if (this.game.ownerID(tile) !== me.smallID()) continue;
        if (!this.game.isLand(tile)) continue;
        if (type === UnitType.Port && !this.game.isOceanShore(tile)) continue;
        tiles.push(tile);
      }
    }
    for (let i = tiles.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [tiles[i], tiles[j]] = [tiles[j], tiles[i]];
    }

    const placed: number[] = [];
    for (const tile of tiles) {
      if (placed.length >= wanted) break;
      const far = placed.every((p) => {
        const dx = this.game.x(p) - this.game.x(tile);
        const dy = this.game.y(p) - this.game.y(tile);
        return dx * dx + dy * dy >= FILL_SPACING * FILL_SPACING;
      });
      if (!far) continue;
      placed.push(tile);
      this.eventBus.emit(new BuildUnitIntentEvent(type, tile));
    }
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
