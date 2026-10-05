// Seeded random drags on both globes, stepped on the page's virtual clock without drawing (index.html ?virtual). Every
// gesture is drawn from its seed and index alone, so a drag that differs can be run again and traced.
import { DEGREES, OPENING, turnBetween } from './oracle.mts';
import type { Oracle, Point, View } from './oracle.mts';
import type { Columns } from './ours.mts';

/** The clock index.html installs under ?virtual: animation frames and the time run only when it is stepped. */
export interface VirtualClock { step(milliseconds: number): void; }
export interface Gesture { view: View; distance: number; points: Point[]; legs: { frames: number; profile: number }[];
  samplesPerFrame: number; holdFrames: number; jitter: number; noiseSeed: number; }
export interface FrameNote { phase: string; x: number | null; y: number | null; apartDeg: number; cesium: { lonDeg: number; latDeg: number }; ours: { lonDeg: number; latDeg: number }; cesiumRotating: boolean; }
/** One frame of a press as Cesium's controller receives it: the pointer's movement in the frame, whether Cesium turned
 * by viewport share (off the globe) rather than panned, and its pole and meridian after it, on cssEarth's screen. */
export interface RecordedFrame { movement: [number, number, number, number] | null; rotating: boolean; pole: number[]; meridian: number[]; }

// Whole milliseconds a frame: Cesium times its inertia with Date, which keeps none of the fraction.
const FRAME_MILLISECONDS = 16;
// A hard flick of the hand crosses about 5000 px a second; a frame's step stays under that.
const MAX_STEP_PIXELS = 90;
const PROFILES = [(t: number) => t, (t: number) => t * t, (t: number) => 1 - (1 - t) ** 2];

export function seeded(seed: number) {
  let a = seed >>> 0;
  return () => { a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
}

export function randomGesture(oracle: Oracle, random: () => number): Gesture {
  const pick = (a: number, b: number) => a + (b - a) * random();
  const towardEyeDeg = (random() < .3 ? pick(70, 89.5) : pick(0, 70)) * (random() < .5 ? -1 : 1);
  const rollDeg = random() < .5 ? OPENING.rollDeg : random() < .5 ? 0 : pick(-40, 40);
  const view = { towardEyeDeg, lonDeg: pick(-180, 180), rollDeg }, distance = Math.exp(pick(Math.log(1.3), Math.log(14)));
  // Points on cssEarth's screen in pixels: over the globe, or anywhere on the panel and a little past its edges.
  const geo = oracle.geometry(), disc = geo.focal / Math.sqrt(distance * distance - 1), cx = geo.width / 2, cy = geo.height / 2;
  const onScreen = ([x, y]: Point) => x > -.1 * geo.width && x < 1.1 * geo.width && y > -.1 * geo.height && y < 1.1 * geo.height;
  const onGlobe = (): Point => { for (;;) { const r = Math.sqrt(random()) * .98 * disc, a = pick(0, 2 * Math.PI), q: Point = [cx + r * Math.cos(a), cy + r * Math.sin(a)]; if (onScreen(q)) return q; } };
  const anywhere = (): Point => [pick(-.1, 1.1) * geo.width, pick(-.1, 1.1) * geo.height];
  // Below 2.3 radii Cesium answers a press off the globe by looking around, which has no counterpart here.
  const points: Point[] = [distance < 2.3 || random() < .75 ? onGlobe() : anywhere()];
  const legs = Array.from({ length: 1 + Math.floor(random() * 3) }, () => {
    const from = points.at(-1)!, to = random() < .6 ? onGlobe() : anywhere();
    points.push(to);
    return { frames: Math.max(Math.ceil(Math.hypot(to[0] - from[0], to[1] - from[1]) / MAX_STEP_PIXELS), 2 + Math.floor(random() ** 2 * 40)), profile: 0 };
  });
  // Speeding up or slowing down doubles the fastest step, so only legs with room for it are eased.
  for (const [n, leg] of legs.entries()) {
    const length = Math.hypot(points[n + 1]![0] - points[n]![0], points[n + 1]![1] - points[n]![1]);
    if (2 * length / leg.frames <= MAX_STEP_PIXELS) leg.profile = Math.floor(random() * 3);
  }
  return { view, distance, points, legs, samplesPerFrame: random() < .6 ? 1 : 2 + Math.floor(random() * 3), holdFrames: random() < .5 ? 0 : Math.floor(random() * 30),
    jitter: random() < .5 ? 0 : .5, noiseSeed: Math.floor(random() * 2 ** 31) };
}

export function createStress(oracle: Oracle, clock: VirtualClock) {
  const { left, right, controller, ours } = oracle;
  // Nothing is drawn: each frame runs only the part of Cesium's that moves its camera. No frame has sized its canvas yet.
  const begin = () => {
    for (const side of [left, right]) { side.widget.useDefaultRenderLoop = false; side.widget.resize(); oracle.frame(side); }
    oracle.inertia = true;
  };
  const gestureOf = (seed: number, index: number, link = 0) => {
    const random = seeded(seed * 1000003 + index);
    let gesture = randomGesture(oracle, random);
    for (let i = 0; i < link; i++) gesture = randomGesture(oracle, random);
    return gesture;
  };

  function run(g: Gesture, { place = true, nudge = [0, 0] as Point, notes = null as FrameNote[] | null, frames = null as RecordedFrame[] | null } = {}) {
    // How close either side's eye comes to standing over a pole, in degrees.
    let poleDeg = 90, previous: Point | null = null, recording = true;
    const note = (phase: string, at: Point | null) => notes?.push({ phase, x: at?.[0] ?? null, y: at?.[1] ?? null, ...oracle.state(), cesiumRotating: controller._rotating });
    const tick = (to: Point | null) => {
      clock.step(FRAME_MILLISECONDS); left.widget.scene.initializeFrame();
      const cesium = oracle.cesiumColumns();
      poleDeg = Math.min(poleDeg, 90 - Math.abs(Math.asin(cesium[2][2]) * DEGREES), 90 - Math.abs(Math.asin(ours.columns[2][2]) * DEGREES));
      const moved = to !== null && previous !== null && (to[0] !== previous[0] || to[1] !== previous[1]);
      if (recording) frames?.push({ movement: moved ? [previous![0], previous![1], to![0], to![1]] : null, rotating: controller._rotating, pole: [...cesium[2]], meridian: [...cesium[0]] });
      if (to !== null) previous = to;
    };
    if (place) oracle.place(g.view, g.distance);
    const noise = seeded(g.noiseSeed), at = ([x, y]: Point): Point => [x + nudge[0], y + nudge[1]];
    let [x, y] = g.points[0]!, peakDeg = 0, pressFrames = 0;
    const pressedAt = performance.now();
    oracle.press(at([x, y])); previous = at([x, y]); tick(null);
    for (const [n, leg] of g.legs.entries()) {
      const [sx, sy] = [x, y], [tx, ty] = g.points[n + 1]!, ease = PROFILES[leg.profile]!;
      for (let i = 0; i < leg.frames; i++) {
        for (let k = 1; k <= g.samplesPerFrame; k++) {
          const t = ease((i + k / g.samplesPerFrame) / leg.frames);
          x = sx + (tx - sx) * t + (noise() - .5) * 2 * g.jitter; y = sy + (ty - sy) * t + (noise() - .5) * 2 * g.jitter;
          oracle.move(at([x, y]));
        }
        tick(at([x, y])); pressFrames++; peakDeg = Math.max(peakDeg, oracle.state().apartDeg); note(`leg ${n}`, [x, y]);
      }
    }
    for (let i = 0; i < g.holdFrames; i++) { tick(null); pressFrames++; }
    const releaseDeg = oracle.state().apartDeg, before = { cesium: oracle.cesiumColumns(), ours: ours.columns };
    const releasedAt = performance.now();
    oracle.release(at([x, y])); recording = false;
    // Until both have stood still for five frames, ten seconds at most.
    let still = 0, settleFrames = 0, last = '';
    while (still < 5 && settleFrames < 600) {
      tick(null); settleFrames++;
      if (settleFrames <= 12 || settleFrames % 10 === 0) note('coast', null);
      const now = JSON.stringify([oracle.columnsOf(left.camera), ours.columns]);
      still = now === last ? still + 1 : 0; last = now;
    }
    const end = oracle.state(), cesiumEnd = oracle.cesiumColumns();
    return { cesiumEnd, pressedAt, releasedAt, poleDeg, peakDeg, releaseDeg, endDeg: end.apartDeg, endLonDeg: end.longitudeApartDeg, endPoleDeg: end.poleApartDeg, pressFrames, settleFrames,
      cesiumCoastDeg: turnBetween(before.cesium, cesiumEnd), oursCoastDeg: turnBetween(before.ours, ours.columns) };
  }

  return {
    /** Gestures `first` to `first + count - 1` of a seed. A chain is several drags in a row on the same globes: the later
     * ones start wherever the earlier ones left both. */
    run({ seed = 1, first = 0, count = 100, chain = 1 } = {}) {
      begin();
      const links = (index: number, nudge?: Point) => Array.from({ length: chain }, (_, link) => {
        const gesture = gestureOf(seed, index, link);
        return { gesture, link, ...run(gesture, { place: link === 0, nudge }) };
      });
      return Array.from({ length: count }, (_, i) => first + i).flatMap(index => {
        const results = links(index);
        // Where the two differ, the same drags again a thousandth of a pixel to each side: if Cesium then ends somewhere
        // else itself, the drag amplifies rounding (a press on the limb, a coast spinning at a pole) and is no difference of rule.
        const nudged = results.some(result => Math.max(result.peakDeg, result.endDeg) > .01) ? ([[1e-3, 0], [-1e-3, 0], [0, 1e-3], [0, -1e-3]] as Point[]).map(nudge => links(index, nudge)) : null;
        return results.map(({ cesiumEnd, gesture, link, ...result }) => ({ index, link, ...result,
          cesiumSelfDeg: nudged ? Math.max(...nudged.map(again => turnBetween(cesiumEnd, again[link]!.cesiumEnd))) : null,
          distance: gesture.distance, view: gesture.view, samplesPerFrame: gesture.samplesPerFrame, holdFrames: gesture.holdFrames }));
      });
    },
    /** One gesture again, with every frame noted. */
    trace(seed: number, index: number) {
      begin();
      const gesture = gestureOf(seed, index), notes: FrameNote[] = [];
      const { cesiumEnd: _, ...result } = run(gesture, { notes });
      return { gesture, result, notes };
    },
    /** What Cesium does with the first `count` short gestures of a seed, for the engine's and the renderer's tests: the
     * screen, the start, each frame of the press and where the globe rests after its coast. Positions are in pixels from
     * the panel's corner, as cssEarth's screen has them. Gestures that amplify rounding are left out. */
    record(seed: number, count: number, maximumFrames = 30) {
      begin();
      const digits = (values: readonly number[]) => values.map(value => Number(value.toPrecision(13)));
      const gestures = [];
      for (let index = 0; gestures.length < count && index < 400 * count; index++) {
        const gesture = gestureOf(seed, index), frames: RecordedFrame[] = [];
        oracle.place(gesture.view, gesture.distance);
        const start = oracle.cesiumColumns(), geo = oracle.geometry();
        const { cesiumEnd, pressedAt, releasedAt, pressFrames, peakDeg, endDeg } = run(gesture, { frames });
        if (pressFrames > maximumFrames || Math.max(peakDeg, endDeg) > 1e-4) continue;
        gestures.push({ distance: gesture.distance, focalLength: geo.focal, viewport: { width: geo.width, height: geo.height },
          start: { pole: digits(start[2]), meridian: digits(start[0]) }, pressMilliseconds: releasedAt - pressedAt,
          frames: frames.map(frame => ({ movement: frame.movement && digits(frame.movement), rotating: frame.rotating, pole: digits(frame.pole), meridian: digits(frame.meridian) })),
          rest: { pole: digits(cesiumEnd[2]), meridian: digits(cesiumEnd[0]) } });
      }
      return { frameMilliseconds: FRAME_MILLISECONDS, gestures };
    },
  };
}
