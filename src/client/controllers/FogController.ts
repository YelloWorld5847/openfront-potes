import { Cell } from "@openfront/engine-api/game/GameTypes";
import { Controller } from "../Controller";
import { TransformHandler } from "../TransformHandler";
import { GameView } from "../view";

// one mask pixel covers this many tiles, which is also what softens the edge
const BLOCK = 4;
const TERRITORY_SIGHT_TILES = 28;
const UNIT_SIGHT_TILES = 20;

// Fog of war, drawn only: a dark sheet over the map with holes around what
// you and your allies own and every unit you have. The simulation still knows
// everything, so this hides the map from a player who plays fair, nothing more.
export class FogController implements Controller {
  private sheet = document.createElement("canvas");
  private mask = document.createElement("canvas");
  private raf = 0;
  private maskReady = false;

  constructor(
    private game: GameView,
    private transform: TransformHandler,
  ) {}

  getTickIntervalMs(): number {
    return 400;
  }

  init() {
    if (!this.game.config().gameConfig().publicGameModifiers?.isFog) return;

    this.mask.width = Math.ceil(this.game.width() / BLOCK);
    this.mask.height = Math.ceil(this.game.height() / BLOCK);
    Object.assign(this.sheet.style, {
      position: "fixed",
      inset: "0",
      width: "100%",
      height: "100%",
      pointerEvents: "none",
      zIndex: "5",
    });
    document.body.appendChild(this.sheet);

    const draw = () => {
      this.draw();
      this.raf = requestAnimationFrame(draw);
    };
    this.raf = requestAnimationFrame(draw);

    return () => {
      cancelAnimationFrame(this.raf);
      this.sheet.remove();
    };
  }

  tick() {
    if (!this.game.config().gameConfig().publicGameModifiers?.isFog) return;
    this.updateMask();
  }

  private updateMask() {
    const me = this.game.myPlayer();
    const ctx = this.mask.getContext("2d");
    if (ctx === null) return;
    const mw = this.mask.width;
    const mh = this.mask.height;
    ctx.clearRect(0, 0, mw, mh);

    // spectators and dead players see the whole map
    if (me === null || !me.isAlive()) {
      ctx.fillStyle = "#fff";
      ctx.fillRect(0, 0, mw, mh);
      this.maskReady = true;
      return;
    }

    const friends = new Set<number>([me.smallID()]);
    for (const p of this.game.players()) {
      if (p.isFriendly(me)) friends.add(p.smallID());
    }

    const owned = new Uint8Array(mw * mh);
    const w = this.game.width();
    const h = this.game.height();
    const image = ctx.createImageData(mw, mh);
    for (let by = 0; by < mh; by++) {
      for (let bx = 0; bx < mw; bx++) {
        const x = Math.min(bx * BLOCK + (BLOCK >> 1), w - 1);
        const y = Math.min(by * BLOCK + (BLOCK >> 1), h - 1);
        if (friends.has(this.game.ownerID(this.game.ref(x, y)))) {
          const i = by * mw + bx;
          owned[i] = 1;
          image.data[i * 4 + 3] = 255;
        }
      }
    }
    ctx.putImageData(image, 0, 0);

    // discs around the edge of what we hold, so the sight reaches past it
    ctx.fillStyle = "#fff";
    const reach = TERRITORY_SIGHT_TILES / BLOCK;
    for (let by = 0; by < mh; by++) {
      for (let bx = 0; bx < mw; bx++) {
        const i = by * mw + bx;
        if (owned[i] === 0) continue;
        const edge =
          bx === 0 ||
          by === 0 ||
          bx === mw - 1 ||
          by === mh - 1 ||
          owned[i - 1] === 0 ||
          owned[i + 1] === 0 ||
          owned[i - mw] === 0 ||
          owned[i + mw] === 0;
        if (!edge) continue;
        ctx.beginPath();
        ctx.arc(bx + 0.5, by + 0.5, reach, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    const unitReach = UNIT_SIGHT_TILES / BLOCK;
    for (const unit of me.units()) {
      const t = unit.tile();
      ctx.beginPath();
      ctx.arc(
        this.game.x(t) / BLOCK,
        this.game.y(t) / BLOCK,
        unitReach,
        0,
        Math.PI * 2,
      );
      ctx.fill();
    }
    this.maskReady = true;
  }

  private draw() {
    if (!this.maskReady) return;
    const ctx = this.sheet.getContext("2d");
    if (ctx === null) return;
    const dpr = window.devicePixelRatio || 1;
    const sw = Math.round(window.innerWidth * dpr);
    const sh = Math.round(window.innerHeight * dpr);
    if (this.sheet.width !== sw || this.sheet.height !== sh) {
      this.sheet.width = sw;
      this.sheet.height = sh;
    }

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalCompositeOperation = "source-over";
    ctx.clearRect(0, 0, sw, sh);
    ctx.fillStyle = "rgba(6, 10, 18, 0.86)";
    ctx.fillRect(0, 0, sw, sh);

    const topLeft = this.transform.worldToScreenCoordinates(new Cell(0, 0));
    const bottomRight = this.transform.worldToScreenCoordinates(
      new Cell(this.game.width(), this.game.height()),
    );
    ctx.globalCompositeOperation = "destination-out";
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(
      this.mask,
      topLeft.x * dpr,
      topLeft.y * dpr,
      (bottomRight.x - topLeft.x) * dpr,
      (bottomRight.y - topLeft.y) * dpr,
    );
  }
}
