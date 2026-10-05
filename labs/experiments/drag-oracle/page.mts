// The page of the drag oracle: the controls, the grids drawn over both globes, the named strokes, and the handle the
// command line drives (run.mts). The globes and the pointer stream are in oracle.mts; the random drags in stress.mts.
import { DEGREES, OPENING, createOracle, rotZ, turnBetween } from './oracle.mts';
import type { Point, Side, View } from './oracle.mts';
import { createStress } from './stress.mts';
import type { VirtualClock } from './stress.mts';
import type { Columns, Geometry, V3 } from './ours.mts';

const element = <T extends HTMLElement>(id: string, type: new () => T): T => {
  const found = document.getElementById(id);
  if (!(found instanceof type)) throw new Error(`The page has no ${id}.`);
  return found;
};
const oracle = createOracle(document);
const { left, right } = oracle;

// "polar" is where the 2026-10-03 change to main acted: the pole 17 degrees from the line of sight.
const VIEWS: Record<string, View> = { opening: { rollDeg: OPENING.rollDeg, towardEyeDeg: OPENING.towardEyeDeg, lonDeg: OPENING.lonDeg },
  polar: { rollDeg: OPENING.rollDeg, towardEyeDeg: 73, lonDeg: OPENING.lonDeg } };
let view = 'opening', peak = 0;
const reset = () => { oracle.place(VIEWS[view]!, oracle.distance); peak = 0; };
const setView = (name: string) => { if (!VIEWS[name]) throw new Error(`No view ${name}.`); view = name; element('view', HTMLSelectElement).value = name; reset(); };
const setDistance = (value: number) => {
  oracle.setDistance(value);
  element('distance', HTMLInputElement).value = String(oracle.distance); element('distanceText', HTMLElement).textContent = `${oracle.distance.toFixed(2)} radii`;
};

// ---- drawing: each side's own grid, the other side's over it, and where the grabbed ground is now -----------------------
const COLORS = { cesium: '#3dd6ff', ours: '#ffa02e' };
function project(columns: Columns, q: V3, g: Geometry) {
  const p = [0, 1, 2].map(i => columns[0][i]! * q[0] + columns[1][i]! * q[1] + columns[2][i]! * q[2]);
  const z = p[2]! - g.distance;
  // Facing: the surface normal points at the eye (the origin) from the surface point.
  return { x: g.width / 2 + g.focal * p[0]! / -z, y: g.height / 2 + g.focal * p[1]! / -z, facing: -(p[0]! * p[0]! + p[1]! * p[1]! + p[2]! * z) > 0 };
}
const surfacePoint = (latDeg: number, lonDeg: number): V3 => { const a = latDeg / DEGREES, b = lonDeg / DEGREES; return [Math.cos(a) * Math.cos(b), Math.cos(a) * Math.sin(b), Math.sin(a)]; };
function grid(ctx: CanvasRenderingContext2D, columns: Columns, g: Geometry, color: string, alpha: number) {
  const line = (points: V3[], width: number) => {
    ctx.beginPath(); let pen = false;
    for (const q of points) { const s = project(columns, q, g); if (!s.facing) { pen = false; continue; } if (pen) ctx.lineTo(s.x, s.y); else ctx.moveTo(s.x, s.y); pen = true; }
    ctx.lineWidth = width; ctx.stroke();
  };
  ctx.strokeStyle = color; ctx.globalAlpha = alpha;
  for (let lon = -180; lon < 180; lon += 15) line(Array.from({ length: 91 }, (_, i) => surfacePoint(-90 + i * 2, lon)), lon === 0 ? 2.2 : .8);
  for (let lat = -75; lat <= 75; lat += 15) line(Array.from({ length: 181 }, (_, i) => surfacePoint(lat, -180 + i * 2)), lat === 0 ? 2.2 : .8);
  for (const [lat, name] of [[90, 'N'], [-90, 'S']] as const) {
    const s = project(columns, surfacePoint(lat, 0), g); if (!s.facing) continue;
    ctx.fillStyle = color; ctx.beginPath(); ctx.arc(s.x, s.y, 4, 0, 7); ctx.fill();
    ctx.font = '600 12px system-ui'; ctx.fillText(name, s.x + 7, s.y + 4);
  }
  ctx.globalAlpha = 1;
}
let drawn: { cesium: Columns; ours: Columns } | null = null;
function paint() {
  const cesium = oracle.columnsOf(left.camera), mine = oracle.ours.columns, overlay = element('overlay', HTMLInputElement).checked;
  const { pressed, pointer, roll } = oracle;
  for (const side of [left, right]) {
    const g = oracle.geometry(side), ratio = devicePixelRatio, canvas = side.over, ctx = canvas.getContext('2d');
    if (!ctx) continue;
    if (canvas.width !== Math.round(g.width * ratio) || canvas.height !== Math.round(g.height * ratio)) { canvas.width = Math.round(g.width * ratio); canvas.height = Math.round(g.height * ratio); }
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0); ctx.clearRect(0, 0, g.width, g.height);
    const own = side === left ? cesium : mine, other = side === left ? rotZ(mine, -roll) : rotZ(cesium, roll);
    if (overlay) grid(ctx, other, g, side === left ? COLORS.ours : COLORS.cesium, .75);
    grid(ctx, own, g, side === left ? COLORS.cesium : COLORS.ours, overlay ? .75 : .45);
    side.miss.textContent = '';
    if (!pressed) continue;
    const grab = side === left ? pressed.grabCesium : pressed.grabOurs, at = pointer && side === left ? oracle.turned(pointer, -roll, g) : pointer;
    const ground = grab ? project(own, grab, g) : null;
    if (ground) {
      ctx.strokeStyle = side === left ? COLORS.cesium : COLORS.ours; ctx.lineWidth = 2.5; ctx.setLineDash(ground.facing ? [] : [3, 3]);
      ctx.beginPath(); ctx.arc(ground.x, ground.y, 9, 0, 7); ctx.stroke(); ctx.setLineDash([]);
    }
    if (!at || pressed.released) continue;
    ctx.strokeStyle = '#fff'; ctx.lineWidth = 1; ctx.beginPath();
    ctx.moveTo(at[0] - 14, at[1]); ctx.lineTo(at[0] + 14, at[1]); ctx.moveTo(at[0], at[1] - 14); ctx.lineTo(at[0], at[1] + 14); ctx.stroke();
    side.miss.textContent = ground ? `grabbed ground is ${Math.hypot(ground.x - at[0], ground.y - at[1]).toFixed(1)} px from the pointer` : 'pressed off the globe';
  }
  // The two controllers take a frame's input in separate callbacks, so one can be a frame ahead when this is drawn: the
  // readout takes the closest of now against now and against the other side's last frame.
  const state = oracle.state(), now = { cesium: rotZ(cesium, roll), ours: mine };
  const apart = Math.min(state.apartDeg, drawn ? turnBetween(drawn.cesium, now.ours) : Infinity, drawn ? turnBetween(now.cesium, drawn.ours) : Infinity);
  drawn = now; peak = Math.max(peak, apart);
  element('apart', HTMLElement).textContent = `${apart.toFixed(1)}°`; element('peak', HTMLElement).textContent = `${peak.toFixed(1)}°`;
  element('dlon', HTMLElement).textContent = `${state.longitudeApartDeg.toFixed(1)}°`; element('dpole', HTMLElement).textContent = `${state.poleApartDeg.toFixed(1)}°`;
}

// ---- a hand drag on either panel goes to both ---------------------------------------------------------------------------
let playing = false;
const bindInput = (side: Side) => {
  // Positions are kept as cssEarth's screen has them; a pointer on Cesium's panel is turned onto it.
  const local = (event: PointerEvent): Point => {
    const box = side.input.getBoundingClientRect(), p: Point = [event.clientX - box.left, event.clientY - box.top];
    return side === left ? oracle.turned(p, oracle.roll, oracle.geometry(left)) : p;
  };
  side.input.addEventListener('pointerdown', event => {
    if (event.button !== 0 || playing) return;
    side.input.setPointerCapture(event.pointerId); side.input.classList.add('pressed'); peak = 0;
    oracle.press(local(event), event);
  });
  side.input.addEventListener('pointermove', event => { if (side.input.hasPointerCapture(event.pointerId) && !playing) oracle.move(local(event), event); });
  const end = (event: PointerEvent) => {
    if (!side.input.hasPointerCapture(event.pointerId)) return;
    side.input.releasePointerCapture(event.pointerId); side.input.classList.remove('pressed');
    if (!playing) oracle.release(local(event), event);
  };
  side.input.addEventListener('pointerup', end); side.input.addEventListener('pointercancel', end);
  side.input.addEventListener('wheel', event => { event.preventDefault(); setDistance(oracle.distance * Math.exp(event.deltaY * .002)); }, { passive: false });
};
bindInput(left); bindInput(right);

// ---- named strokes, in disc radii from the disc centre, +y down ---------------------------------------------------------
interface Stroke { points: Point[]; view?: string; frames?: number; flick?: 'speeding' | 'steady'; }
const STROKES: Record<string, Stroke> = {
  'Sideways, middle': { points: [[-.6, 0], [.6, 0]] },
  'Sideways, north': { points: [[-.5, -.7], [.5, -.7]] },
  'Down the middle': { points: [[0, -.6], [0, .6]] },
  'Down the side': { points: [[.6, -.5], [.6, .5]] },
  'Up past the pole': { points: [[0, .6], [0, -.9]] },
  'Down over the pole': { points: [[.05, -.95], [.05, .5]] },
  'Along the right limb': { points: [[.93, -.3], [.93, .3]] },
  'Off the globe and back': { points: [[.5, 0], [1.4, 0], [.5, .3]] },
  'Polar view: down across the pole': { view: 'polar', points: [[0, -.6], [0, .6]] },
  'Polar view: round the pole': { view: 'polar', frames: 6, points: Array.from({ length: 25 }, (_, i): Point => [.05 + .35 * Math.cos(i * Math.PI / 12 + Math.PI / 2), -.28 + .35 * Math.sin(i * Math.PI / 12 + Math.PI / 2)]) },
  'Loop x3': { points: Array.from({ length: 13 }, (_, i): Point => [[-.4, -.4], [.4, -.4], [.4, .4], [-.4, .4]][i % 4] as Point) },
  // Quick strokes released while moving, so both sides coast. Cesium coasts only when press to release takes under 0.4 s.
  'Flick sideways': { flick: 'speeding', points: [[-.25, .1], [.25, .1]] },
  'Flick sideways, steady speed': { flick: 'steady', points: [[-.25, .1], [.25, .1]] },
  'Flick down': { flick: 'speeding', points: [[0, -.25], [0, .25]] },
  'Flick sideways near the pole': { flick: 'speeding', points: [[-.2, -.8], [.2, -.8]] },
};
const nextFrame = () => new Promise(done => requestAnimationFrame(done));
const wait = (milliseconds: number) => new Promise(done => setTimeout(done, milliseconds));
async function play(name: string) {
  const stroke = STROKES[name];
  if (!stroke || playing) return null;
  playing = true;
  try {
    if (stroke.view) setView(stroke.view);
    reset(); await nextFrame(); await nextFrame();
    const g = oracle.geometry(), frames = stroke.frames ?? (stroke.flick ? 10 : 40);
    const points = stroke.points.map(([u, v]): Point => [g.width / 2 + u * g.disc, g.height / 2 + v * g.disc]);
    let [x, y] = points[0]!;
    oracle.press([x, y]); await nextFrame();
    for (const [tx, ty] of points.slice(1)) {
      const [sx, sy] = [x, y];
      for (let i = 1; i <= frames; i++) {
        const t = stroke.flick === 'speeding' ? (i / frames) ** 2 : i / frames;
        x = sx + (tx - sx) * t; y = sy + (ty - sy) * t;
        oracle.move([x, y]); await nextFrame();
      }
    }
    // A held stroke rests before release, so neither side coasts and the stroke alone is compared.
    if (!stroke.flick) await wait(300);
    const held = oracle.state();
    oracle.release([x, y]); await nextFrame();
    if (!stroke.flick) return { held, settled: null };
    await wait(3500);
    return { held, settled: oracle.state() };
  } finally { playing = false; }
}

// ---- wiring ---------------------------------------------------------------------------------------------------------------
element('overlay', HTMLInputElement).addEventListener('change', () => { drawn = null; });
element('inertia', HTMLInputElement).addEventListener('change', event => { oracle.inertia = event.target instanceof HTMLInputElement && event.target.checked; });
element('together', HTMLInputElement).addEventListener('change', event => { oracle.startTogether = event.target instanceof HTMLInputElement && event.target.checked; });
element('distance', HTMLInputElement).addEventListener('input', event => { if (event.target instanceof HTMLInputElement) setDistance(Number(event.target.value)); });
element('view', HTMLSelectElement).addEventListener('change', event => { if (event.target instanceof HTMLSelectElement) setView(event.target.value); });
element('reset', HTMLButtonElement).addEventListener('click', reset);
for (const name of Object.keys(STROKES)) {
  const button = document.createElement('button');
  button.textContent = name; button.addEventListener('click', () => { void play(name); });
  element('strokes', HTMLElement).append(button);
}
oracle.frame(left); oracle.frame(right);
setDistance(OPENING.distance); reset();
left.widget.scene.preRender.addEventListener(() => oracle.frame(left));
right.widget.scene.preRender.addEventListener(() => { oracle.frame(right); oracle.setCamera(right.camera, oracle.ours.columns); });
left.widget.scene.postRender.addEventListener(paint);

const clock: unknown = Reflect.get(window, 'dragOracleClock');
const virtual = clock && typeof clock === 'object' && typeof Reflect.get(clock, 'step') === 'function' ? clock as VirtualClock : null;
/** The handle run.mts drives. `stress` exists only on the page opened with ?virtual. */
Reflect.set(window, 'dragOracle', { play, strokes: Object.keys(STROKES), state: () => oracle.state(), stress: virtual ? createStress(oracle, virtual) : null,
  tilesLoaded: () => left.widget.scene.globe.tilesLoaded && right.widget.scene.globe.tilesLoaded });
