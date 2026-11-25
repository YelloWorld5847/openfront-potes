import { Cell, VOLCANO_NAME } from "@openfront/engine-api/game/GameTypes";
import { Controller } from "../Controller";
import { TransformHandler } from "../TransformHandler";
import { GameView, PlayerView } from "../view";

const SIZE = 20;
const FRAMES = 4;
const FRAME_MS = 220;
// how wide the sprite is on the map, in tiles
const WIDTH_TILES = 16;
const ERUPTION_MS = 1800;

const OUTLINE = "#1a0f0c";
const ROCK_DARK = "#3b2a24";
const ROCK_MID = "#5a4036";
const ROCK_LIGHT = "#7a5a4a";
const LAVA = "#ff6a00";
const LAVA_HOT = "#ffd21f";
const SMOKE = "rgba(150, 150, 150, 0.8)";

// Draws a little pixel volcano on top of the lava bot's patch of land, so the
// thing on the map reads as a mountain and not as another player. Smoke rises
// all the time, and sparks fly while the lava is spreading.
export class VolcanoMarkerController implements Controller {
  private sheet = document.createElement("canvas");
  private frames: HTMLCanvasElement[] = [];
  private erupting: HTMLCanvasElement[] = [];
  private raf = 0;
  private volcanoes: PlayerView[] = [];
  private lastTiles = new Map<string, { tiles: number; changedAt: number }>();

  constructor(
    private game: GameView,
    private transform: TransformHandler,
  ) {}

  getTickIntervalMs(): number {
    return 300;
  }

  init() {
    if (!this.game.config().gameConfig().publicGameModifiers?.isVolcano) return;

    for (let i = 0; i < FRAMES; i++) {
      this.frames.push(this.paint(i, false));
      this.erupting.push(this.paint(i, true));
    }
    Object.assign(this.sheet.style, {
      position: "fixed",
      inset: "0",
      width: "100%",
      height: "100%",
      pointerEvents: "none",
      // under the fog sheet, over the map
      zIndex: "4",
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
    if (!this.game.config().gameConfig().publicGameModifiers?.isVolcano) return;
    const now = Date.now();
    this.volcanoes = this.game
      .players()
      .filter((p) => p.name() === VOLCANO_NAME && p.isAlive());
    // spreading lava means tiles changing hands
    for (const v of this.volcanoes) {
      const tiles = v.numTilesOwned();
      const seen = this.lastTiles.get(v.id());
      if (seen === undefined || seen.tiles !== tiles) {
        this.lastTiles.set(v.id(), { tiles, changedAt: now });
      }
    }
  }

  private draw() {
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
    ctx.clearRect(0, 0, sw, sh);
    if (this.volcanoes.length === 0) return;

    const origin = this.transform.worldToScreenCoordinates(new Cell(0, 0));
    const far = this.transform.worldToScreenCoordinates(
      new Cell(this.game.width(), this.game.height()),
    );
    const perTile = ((far.x - origin.x) / this.game.width()) * dpr;
    const px = WIDTH_TILES * perTile;
    if (px < 8) return; // too small to read, the lava color is enough

    ctx.imageSmoothingEnabled = false;
    const now = Date.now();
    const frame = Math.floor(now / FRAME_MS) % FRAMES;
    for (const v of this.volcanoes) {
      const at = v.nameLocation();
      if (at === undefined) continue;
      const screen = this.transform.worldToScreenCoordinates(
        new Cell(at.x, at.y),
      );
      const changedAt = this.lastTiles.get(v.id())?.changedAt ?? 0;
      const sprite =
        now - changedAt < ERUPTION_MS
          ? this.erupting[frame]
          : this.frames[frame];
      // the foot of the cone sits on the centre of the patch
      ctx.drawImage(
        sprite,
        screen.x * dpr - px / 2,
        screen.y * dpr - px * 0.8,
        px,
        px,
      );
    }
  }

  // one frame of the sprite, on a 20x20 grid
  private paint(frame: number, erupting: boolean): HTMLCanvasElement {
    const canvas = document.createElement("canvas");
    canvas.width = SIZE;
    canvas.height = SIZE;
    const g = canvas.getContext("2d");
    if (g === null) return canvas;
    const dot = (x: number, y: number, color: string) => {
      g.fillStyle = color;
      g.fillRect(x, y, 1, 1);
    };

    // the cone, row by row: narrow at the crater, wide at the foot
    for (let y = 8; y <= 18; y++) {
      const half = Math.round(2.5 + (y - 8) * 0.85);
      for (let x = 10 - half; x < 10 + half; x++) {
        const edge = x === 10 - half || x === 10 + half - 1 || y === 18;
        let color = ROCK_MID;
        if (edge) color = OUTLINE;
        else if (x < 10 - half / 3) color = ROCK_LIGHT;
        else if (x > 10 + half / 2) color = ROCK_DARK;
        dot(x, y, color);
      }
    }

    // crater rim and glowing mouth
    for (let x = 7; x <= 12; x++) dot(x, 7, OUTLINE);
    for (let x = 8; x <= 11; x++) dot(x, 8, frame % 2 === 0 ? LAVA_HOT : LAVA);
    dot(7, 8, OUTLINE);
    dot(12, 8, OUTLINE);

    // a lava stream creeping down the slope, a pixel further each frame
    const stream = 9 + (frame % FRAMES);
    for (let y = 9; y <= Math.min(stream + 3, 17); y++) dot(10, y, LAVA);
    dot(10, Math.min(stream + 3, 17), LAVA_HOT);
    dot(8, 12 + (frame % 2), LAVA);

    // smoke drifting up
    const sway = frame % 2 === 0 ? 0 : 1;
    g.fillStyle = SMOKE;
    g.fillRect(9 + sway, 5 - (frame % 3), 2, 1);
    g.fillRect(10 - sway, 3 - (frame % 2), 1, 1);
    g.fillRect(9 + sway, 1, 2, 1);

    if (erupting) {
      g.fillStyle = LAVA_HOT;
      g.fillRect(9, 5, 2, 2);
      g.fillStyle = LAVA;
      g.fillRect(8 - (frame % 2), 4, 1, 1);
      g.fillRect(11 + (frame % 2), 4, 1, 1);
      g.fillRect(7, 6, 1, 1);
      g.fillRect(12, 6, 1, 1);
      g.fillRect(10, 2 + (frame % 3), 1, 1);
    }
    return canvas;
  }
}
