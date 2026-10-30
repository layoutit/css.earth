/** Numbers only: red gas left in the slab textures, and where each billboard's dots land against the model. */
import { readdir, readFile, writeFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import sharp from 'sharp';
import { cssCameraAxesFromOrientation, presentPhysicalPoseInVolume } from '@cssearth/engine';
import { pilotCamera } from '../piece-pilot/cameras.mts';
import { add, dot as dot3, mul, type V3 } from '../geometry.mts';
import { density } from '../catalogue-volume.mts';
import { samplePoint, randomStream } from './dots.mts';
import { ALL_BACKGROUND_DIR, SMOOTH_BACKGROUND_DIR } from './background-all.mts';
import { FULL_DIR } from '../delivery/near-pilot.mts';
import { fullDescriptors } from '../delivery/full-native.mts';
import { ALL_DIR, buildAll } from './dots-all.mts';
import { allGasSource } from './regions.mts';

const view0 = (c: { rects: unknown[] }[]) => c[0]?.rects.length ?? 1;
async function redInSlabs(root: string) {
  let count = 0, excess = 0, pixels = 0;
  for (const axis of ['x', 'y', 'z']) for (const file of await readdir(root + axis)) { const { data, info } = await sharp(root + axis + '/' + file).ensureAlpha().raw().toBuffer({ resolveWithObject: true }); for (let i = 0; i < data.length; i += 4) { const r = data[i]!, g = data[i + 1]!, b = data[i + 2]!, a = data[i + 3]! / 255; pixels++; if (a > .02 && r > 2 * Math.max(g, b) && r > 60 && Math.abs(g - b) <= .2 * Math.max(g, b, 1)) { count++; excess += (r - Math.max(g, b)) * a; } } void info; }
  return { redPixels: count, redExcess: excess, pixels };
}
/** Dark pixels that repeat: places where a slab's dust stands above its surroundings (τ over a 33-texel mean) in two or more slabs of an axis. */
async function repeatingDust(directory: string) {
  const out: Record<string, number> = {}, DOWN = 4, RADIUS = 8, THRESHOLD = .08;
  for (const axis of [0, 1, 2]) {
    const list = fullDescriptors().filter(l => l.axis === axis), w = Math.floor(list[0]!.width / DOWN), h = Math.floor(list[0]!.height / DOWN), counts = new Uint8Array(w * h);
    for (const l of list) { const raw = await readFile(directory + `local-${l.axis}-${l.index}-tau.f64le`), tau = new Float64Array(Uint8Array.from(raw).buffer), small = new Float64Array(w * h);
      for (let y = 0; y < h * DOWN; y++) for (let x = 0; x < w * DOWN; x++) small[Math.floor(y / DOWN) * w + Math.floor(x / DOWN)]! += tau[y * l.width + x]! / (DOWN * DOWN);
      const integral = new Float64Array((w + 1) * (h + 1)); for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) integral[(y + 1) * (w + 1) + x + 1] = small[y * w + x]! + integral[y * (w + 1) + x + 1]! + integral[(y + 1) * (w + 1) + x]! - integral[y * (w + 1) + x]!;
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const x0 = Math.max(0, x - RADIUS), x1 = Math.min(w, x + RADIUS + 1), y0 = Math.max(0, y - RADIUS), y1 = Math.min(h, y + RADIUS + 1), mean = (integral[y1 * (w + 1) + x1]! - integral[y0 * (w + 1) + x1]! - integral[y1 * (w + 1) + x0]! + integral[y0 * (w + 1) + x0]!) / ((x1 - x0) * (y1 - y0)); if (small[y * w + x]! - mean > THRESHOLD) counts[y * w + x]!++; }
    }
    out['xyz'[axis]!] = counts.reduce((n, v) => n + (v >= 2 ? 1 : 0), 0) * DOWN * DOWN;
  }
  return out;
}
export async function report() {
  const before = await redInSlabs('src/objects/lmc-volume/.local/versions/l36/delivery/full-2048/bank/').catch(() => null), accepted = before?.pixels ? before : await redInSlabs('src/objects/lmc-volume/prepared/l36-near/'), after = await redInSlabs(ALL_BACKGROUND_DIR + 'bank/');
  const { all, axes, frame } = await buildAll(), old = pilotCamera('old', 128, [0, 0, 0], 10, 0, 0), views = [['earth', axes.right, axes.up], ...[[0, 0], [45, 15], [90, 15]].map(([t, a]) => { const c = pilotCamera('v', 128, [0, 0, 0], 10, t!, a!); return ['t' + t, c.right, c.up] as const; })] as const;
  const offsets: Record<string, Record<string, number>> = {};
  for (const [name, right, up] of views) {
    let oldMax = 0, newMax = 0; const errors: number[] = []; const earthR = axes.right, earthU = axes.up;
    // Where a dot is drawn: its offset in the cell's axes laid onto the screen, with the cell's roll kept (now) or not (the first build, drawn face-on).
    const roll = Math.atan2(dot3(earthR, up), dot3(earthR, right)), c = Math.cos(roll), s = Math.sin(roll);
    for (const { board } of all) for (const d of board.dots) {
      const off = add(d.at, mul(board.center, -1)), tx = dot3(off, right), ty = dot3(off, up);
      const error = Math.hypot(c * dot3(off, earthR) - s * dot3(off, earthU) - tx, s * dot3(off, earthR) + c * dot3(off, earthU) - ty); errors.push(error); newMax = Math.max(newMax, error);
      oldMax = Math.max(oldMax, Math.hypot(dot3(off, old.right) - tx, dot3(off, old.up) - ty));
    }
    errors.sort((p, q) => p - q); offsets[name] = { firstBuildKpc: oldMax, nowKpc: newMax, p99Kpc: errors[Math.floor(errors.length * .99)]! };
  }
  // The first build's half-shell sampling: its peak could be zero, and then every point of the ellipsoid passed.
  const { regions } = await allGasSource(), random = randomStream(11); let outsideOld = 0, tested = 0, outsideNow = 0, worstOldKpc = 0;
  for (const r of regions) for (const { object: o } of r.emitters) if (o.kind !== 'ball') for (let i = 0; i < 40; i++) {
    tested++; const peak = density(o, o.center) || density(o, add(o.center, mul(o.basis[0], o.axes[0] * (o.inner + (1 - o.inner) / 2)))); if (density(o, samplePoint(o, random)) <= 0) outsideNow++;
    if (peak === 0) { let p: V3 = o.center; const u = [random() * 2 - 1, random() * 2 - 1, random() * 2 - 1]; for (let k = 0; k < 3; k++) p = add(p, mul(o.basis[k]!, u[k]! * o.axes[k]!)); if (density(o, p) <= 0) { outsideOld++; worstOldKpc = Math.max(worstOldKpc, Math.hypot(...add(p, mul(o.center, -1)))); } }
  }
  // Billboard centres in the real page against the frame's own projection of the same centres.
  const cameras = JSON.parse(await readFile(ALL_DIR + 'site-cameras.json', 'utf8').catch(() => '[]')) as { id: string; camera: { world: { pose: Parameters<typeof presentPhysicalPoseInVolume>[0] }; viewport: { focalPixels: number; widthPixels: number; heightPixels: number; principalOffsetPixels: [number, number] } } | null; rects: { cell: number[]; box: number[] }[] }[], centres: Record<string, number> = {}, across = Math.ceil(Math.sqrt(view0(cameras)));
  for (const view of cameras) { if (!view.camera) continue; const { world, viewport: vp } = view.camera, l = presentPhysicalPoseInVolume(world.pose, frame), r = cssCameraAxesFromOrientation(l.orientationXyzw); let worst = 0;
    for (const rect of view.rects) { const j = rect.cell[1]! / 128 * across + rect.cell[0]! / 128, p = all[j]?.board.center; if (!p) continue; const x = p[0] - l.positionUnits[0], y = p[1] - l.positionUnits[1], z = p[2] - l.positionUnits[2], depth = -(r[2] * x + r[5] * y + r[8] * z); if (depth <= 0) continue; const sx = vp.focalPixels * (r[0] * x + r[3] * y + r[6] * z) / depth + vp.principalOffsetPixels[0] + vp.widthPixels / 2, sy = vp.focalPixels * (r[1] * x + r[4] * y + r[7] * z) / depth + vp.principalOffsetPixels[1] + vp.heightPixels / 2; if (sx < 0 || sy < 0 || sx > vp.widthPixels || sy > vp.heightPixels) continue; worst = Math.max(worst, Math.hypot((rect.box[0]! + rect.box[2]!) / 2 - sx, (rect.box[1]! + rect.box[3]!) / 2 - sy)); }
    centres[view.id] = worst; }
  const light = JSON.parse(await readFile(ALL_DIR + 'light.json', 'utf8').catch(() => '[]')) as { id: string; ratio: number; groups: Record<string, [number, number]> }[];
  const repeating = { accepted: await repeatingDust(FULL_DIR), gasFree: await repeatingDust(ALL_BACKGROUND_DIR), smooth: await repeatingDust(SMOOTH_BACKGROUND_DIR), viewsUse: { earth: 'z', pz: 'z', tilt45: 'z', 'dor30-close': 'z', py: 'y' } }, smoothRed = await redInSlabs(SMOOTH_BACKGROUND_DIR + 'bank/');
  const out = { repeating, smoothRed, accepted, after, offsets, halfShellSampling: { tested, outsideOld, worstOldKpc, outsideNow }, centresPx: centres, wholeFrame: Object.fromEntries(light.map(l => [l.id, l.ratio])) };
  await writeFile(ALL_DIR + 'state.json', JSON.stringify(out, null, 1) + '\n'); console.log(JSON.stringify(out)); return out;
}
if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) await report();
