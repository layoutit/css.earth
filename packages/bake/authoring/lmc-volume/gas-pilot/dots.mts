/**
 * Pilot gas regions as cloud points (the Homunculus lane). Dots are drawn from each emitter's own finite density, clusters
 * are k-means in 3D, and a cell is the l36 emission of its dots: graded and toned as the model tones it, then split into the
 * straight color and alpha of its share of the region's toned picture. A region's one gain keeps its composite at or below
 * its reference render. Clipping the toned red gives the pink core; no color is authored.
 */
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import sharp from 'sharp';
import { encodeCloudPoints, encodePreparedBank, readCloudPoints, type DensityVolumeFrame } from '@cssearth/objects';
import { packPreparedBinary } from '@cssearth/objects/node';
import { writeLossyWebp } from '@cssearth/bake/raster';
import { density, type VolumeObject } from '../catalogue-volume.mts';
import { tone, type Grade } from '../grade.mts';
import { pilotCamera, type PilotCamera } from '../piece-pilot/cameras.mts';
import { finiteEmission } from '../shape-pilot/project.mts';
import { add, dot as dot3, mul, type V3 } from '../geometry.mts';
import { need } from '../inputs.mts';
import { L37_DIR, pilotSource, type GasRegion } from './regions.mts';

export const DOTS_DIR = L37_DIR + 'dots/', CELL = 128;
/** Billboards a region: 284 in all, so the scene stays under 500 retained elements with its 33 layers. */
const BOARDS: Record<string, number> = { dor30: 70, n44: 40, n11: 30, n206: 16, n119: 16, n160: 16, n61: 16, n79: 16, n154: 16, n200: 16, n9: 16, dem195: 16 };
/** Dots a billboard holds on average, and how much wider a sampled dot is than its share of the emitter. */
const DOTS_PER_BOARD = 40, DOT_SPREAD = 1.5, ITERATIONS = 30;
/** The smallest dot radius, a share of its region's width: a clump smaller than this reads as a spark, not as gas. */
const SOFTEST = 1 / 45;
/** The Homunculus dot profile. */
const dotShape = (r: number) => r >= 1 ? 0 : Math.exp(-r * r / (2 * .397 * .397)) * Math.min(1, (1 - r) / .15);
const srgb = (x: number) => { const v = Math.min(1, Math.max(0, x)); return v <= .0031308 ? 12.92 * v : 1.055 * v ** (1 / 2.4) - .055; };
const linear = (v: number) => v <= .04045 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4;
const luma = (r: number, g: number, b: number) => .2126 * r + .7152 * g + .0722 * b;

function randomStream(start: number) { let seed = start; return () => { seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t ^= t + Math.imul(t ^ (t >>> 7), 61 | t); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
interface Dot { at: V3; radius: number; light: V3; }

/** A point of an emitter's unit-integral density, by rejection in its own ellipsoid. */
function samplePoint(o: VolumeObject, random: () => number): V3 {
  const peak = density(o, o.center) || density(o, add(o.center, mul(o.basis[0], o.axes[0] * (o.inner + (1 - o.inner) / 2))));
  for (let tries = 0; tries < 400; tries++) {
    const u = [random() * 2 - 1, random() * 2 - 1, random() * 2 - 1]; if (u[0]! ** 2 + u[1]! ** 2 + u[2]! ** 2 > 1) continue;
    let p: V3 = o.center; for (let k = 0; k < 3; k++) p = add(p, mul(o.basis[k]!, u[k]! * o.axes[k]!));
    if (random() * peak <= density(o, p)) return p;
  }
  return o.center;
}

export function regionDots(region: GasRegion, grade: Grade, count: number): Dot[] {
  const random = randomStream(region.id.length * 7919 + 13), floor = SOFTEST * Math.hypot(...region.box.max.map((v, a) => v - region.box.min[a]!)), total = region.emitters.reduce((n, e) => n + e.object.weight * e.amplitude, 0), dots: Dot[] = [];
  for (const { object: o, amplitude } of region.emitters) {
    const L = o.weight * amplitude, share = L / total, n = Math.max(1, Math.round(share * count)), size = Math.cbrt(o.axes[0] * o.axes[1] * o.axes[2]);
    const light: V3 = [0, 1, 2].map(c => L / n * o.color[c]! * grade.coefficients[3]![c]!) as V3;
    for (let i = 0; i < n; i++) dots.push({ at: n === 1 && o.kind === 'ball' ? o.center : samplePoint(o, random), radius: Math.max(floor, n === 1 ? size : DOT_SPREAD * size / Math.cbrt(n)), light });
  }
  return dots;
}

export function clusterDots(dots: readonly Dot[], wanted: number, random: () => number): Dot[][] {
  const d2 = (a: V3, b: V3) => (a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2 + (a[2] - b[2]) ** 2, k = Math.min(wanted, dots.length);
  const centres: V3[] = [dots[Math.floor(random() * dots.length)]!.at], nearest = dots.map(d => d2(d.at, centres[0]!));
  while (centres.length < k) { let pick = random() * nearest.reduce((a, b) => a + b, 0), i = 0; while (i < dots.length - 1 && (pick -= nearest[i]!) > 0) i++; const at = dots[i]!.at; centres.push(at); dots.forEach((d, j) => { nearest[j] = Math.min(nearest[j]!, d2(d.at, at)); }); }
  const label = new Int32Array(dots.length);
  for (let step = 0; step < ITERATIONS; step++) {
    dots.forEach((d, j) => { let best = 0, bestD = Infinity; centres.forEach((c, m) => { const v = d2(d.at, c); if (v < bestD) { bestD = v; best = m; } }); label[j] = best; });
    const sum = centres.map(() => [0, 0, 0, 0]); dots.forEach((d, j) => { const s = sum[label[j]!]!; s[0]! += d.at[0]; s[1]! += d.at[1]; s[2]! += d.at[2]; s[3]!++; });
    sum.forEach((s, m) => { if (s[3]) centres[m] = [s[0]! / s[3]!, s[1]! / s[3]!, s[2]! / s[3]!]; });
  }
  return centres.map((_, m) => dots.filter((__, j) => label[j] === m)).filter(list => list.length);
}

interface Board { center: V3; half: number; dots: Dot[]; }
const boardOf = (list: Dot[]): Board => { const center = [0, 1, 2].map(k => list.reduce((a, d) => a + d.at[k]!, 0) / list.length) as V3; return { center, dots: list, half: 1.02 * Math.max(...list.map(d => Math.hypot(d.at[0] - center[0], d.at[1] - center[1], d.at[2] - center[2]) + d.radius)) }; };

/** A dot's surface brightness over the texels it reaches. */
function deposit(light: Float64Array, side: number, d: Dot, u: number, v: number, r: number, area: number) {
  const x0 = Math.max(0, Math.floor(u - r)), x1 = Math.min(side, Math.ceil(u + r)), y0 = Math.max(0, Math.floor(v - r)), y1 = Math.min(side, Math.ceil(v + r)), weights: [number, number][] = []; let sum = 0;
  for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) { const w = dotShape(Math.hypot(x + .5 - u, y + .5 - v) / r); if (w > 0) { weights.push([(y * side + x) * 3, w]); sum += w; } }
  if (sum > 0) for (const [o, w] of weights) for (let k = 0; k < 3; k++) light[o + k]! += d.light[k]! * w / sum / area;
}
/** The whole region's light as the camera's axes see it. A cell takes its share of this one toned picture, so billboards add up to the model's brightness instead of each reaching its own plateau. */
interface RegionLight { light: Float64Array; side: number; texel: number; center: V3; }
function regionLight(dots: readonly Dot[], center: V3, width: number, c: Pick<PilotCamera, 'right' | 'up'>): RegionLight {
  const side = 512, texel = width / side, light = new Float64Array(side * side * 3);
  for (const d of dots) { const off = add(d.at, mul(center, -1)); deposit(light, side, d, (dot3(off, c.right) + width / 2) / texel, (width / 2 - dot3(off, c.up)) / texel, Math.max(d.radius / texel, .75), texel * texel); }
  return { light, side, texel, center };
}
/** A billboard's cell: its share of the region's toned emission, as straight RGBA. */
function drawCell(board: Board, c: Pick<PilotCamera, 'right' | 'up'>, grade: Grade, gain: number, whole: RegionLight): Float64Array {
  const light = new Float64Array(CELL * CELL * 3), texel = 2 * board.half / CELL, area = texel * texel, origin = add(board.center, mul(whole.center, -1)), ox = dot3(origin, c.right), oy = dot3(origin, c.up);
  for (const d of board.dots) { const off = add(d.at, mul(board.center, -1)); deposit(light, CELL, d, (dot3(off, c.right) + board.half) / texel, (board.half - dot3(off, c.up)) / texel, Math.max(d.radius / texel, .75), area); }
  const rgba = new Float64Array(CELL * CELL * 4), width = whole.side * whole.texel;
  for (let y = 0; y < CELL; y++) for (let x = 0; x < CELL; x++) {
    const p = y * CELL + x, own = luma(light[p * 3]!, light[p * 3 + 1]!, light[p * 3 + 2]!); if (!(own > 0)) continue;
    const X = Math.floor((ox + (x + .5) * texel - board.half + width / 2) / whole.texel), Y = Math.floor((width / 2 - oy + (y + .5) * texel - board.half) / whole.texel);
    const q = X >= 0 && Y >= 0 && X < whole.side && Y < whole.side ? (Y * whole.side + X) * 3 : -1, R = q < 0 ? light[p * 3]! : whole.light[q]!, G = q < 0 ? light[p * 3 + 1]! : whole.light[q + 1]!, B = q < 0 ? light[p * 3 + 2]! : whole.light[q + 2]!;
    const share = Math.min(1, own / Math.max(own, luma(R, G, B))), e = tone(R * gain, G * gain, B * gain, grade.stretch, grade.saturation), s = [srgb(e[0]), srgb(e[1]), srgb(e[2])], peak = Math.max(s[0]!, s[1]!, s[2]!), A = Math.min(.995, Math.max(e[0], e[1], e[2]));
    // Coverage follows linear light, so a faint edge stays faint and only the core turns opaque and pink.
    // Each share as the alpha whose source-over product over all billboards is the region's own alpha.
    if (A > 0) { rgba[p * 4] = s[0]! / peak; rgba[p * 4 + 1] = s[1]! / peak; rgba[p * 4 + 2] = s[2]! / peak; rgba[p * 4 + 3] = 1 - (1 - A) ** share; }
  }
  return rgba;
}

/** Source-over of a region's billboards onto black at a camera, in sRGB as a page composites them. */
function composite(boards: readonly Board[], camera: PilotCamera, grade: Grade, gain: number, earth: Pick<PilotCamera, 'right' | 'up'>, whole: RegionLight): Float64Array {
  const out = new Float64Array(camera.width * camera.height * 3);
  const order = [...boards].sort((a, b) => dot3(a.center, camera.back) - dot3(b.center, camera.back));
  for (const b of order) {
    const rgba = drawCell(b, earth, grade, gain, whole), p = camera.pixelOf(b.center); if (!p) continue;
    const scale = 2 * b.half * camera.focal / camera.distance;
    const x0 = Math.max(0, Math.floor(p[0] - scale / 2)), x1 = Math.min(camera.width, Math.ceil(p[0] + scale / 2)), y0 = Math.max(0, Math.floor(p[1] - scale / 2)), y1 = Math.min(camera.height, Math.ceil(p[1] + scale / 2));
    for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) {
      const u = Math.floor((x + .5 - p[0] + scale / 2) / scale * CELL), v = Math.floor((y + .5 - p[1] + scale / 2) / scale * CELL); if (u < 0 || v < 0 || u >= CELL || v >= CELL) continue;
      const i = (v * CELL + u) * 4, a = rgba[i + 3]!; if (!a) continue;
      for (let k = 0; k < 3; k++) out[(y * camera.width + x) * 3 + k] = out[(y * camera.width + x) * 3 + k]! * (1 - a) + rgba[i + k]! * a;
    }
  }
  return out;
}

const lightOf = (encoded: Float64Array) => { let s = 0; for (let p = 0; p < encoded.length; p += 3) s += luma(linear(encoded[p]!), linear(encoded[p + 1]!), linear(encoded[p + 2]!)); return s; };

export async function buildDots(frame: DensityVolumeFrame, adjust: Record<string, number> = {}) {
  const { source, regions } = await pilotSource(), grade = source.grade; await mkdir(DOTS_DIR, { recursive: true });
  const earth = pilotCamera('earth', 128, [0, 0, 0], 10, 0, 0), allBoards: { region: string; board: Board; gain: number; whole: RegionLight }[] = [], report = [];
  for (const region of regions) {
    const wanted = BOARDS[region.id]; need(wanted, 'Unallocated region');
    const dots = regionDots(region, grade, wanted * DOTS_PER_BOARD), boards = clusterDots(dots, wanted, randomStream(wanted * 101 + 7)).map(boardOf);
    const center = [0, 1, 2].map(a => (region.box.min[a]! + region.box.max[a]!) / 2) as V3, width = 1.4 * Math.hypot(...region.box.max.map((v, a) => v - region.box.min[a]!));
    const cameras = [[0, 0], [45, 0], [90, 0]].map(([tilt, az]) => pilotCamera(region.id + '-' + tilt, 256, center, width, tilt!, az!));
    const whole = regionLight(dots, center, width, earth);
    const reference = cameras.map(c => lightOf(finiteEmission(region, c, grade).rgb.map(v => srgb(v))));
    let gain = 1, ratios: number[] = [];
    // A gain at most the reference in every calibration view; three steps settle the tone's curve.
    for (let step = 0; step < 4; step++) { ratios = cameras.map((c, i) => lightOf(composite(boards, c, grade, gain, earth, whole)) / reference[i]!); gain *= Math.min(4, .98 / Math.max(...ratios)); }
    ratios = cameras.map((c, i) => lightOf(composite(boards, c, grade, gain, earth, whole)) / reference[i]!);
    gain *= adjust[region.id] ?? 1;
    for (const board of boards) allBoards.push({ region: region.id, board, gain, whole });
    report.push({ id: region.id, label: region.label, emitters: region.emitters.length, dots: dots.length, boards: boards.length, gain, ratiosToReference: ratios });
    console.log('GAS_DOTS_REGION ' + JSON.stringify(report.at(-1)));
  }
  const across = Math.ceil(Math.sqrt(allBoards.length)), atlas = new Uint8Array((across * CELL) ** 2 * 4), positions = new Float64Array(allBoards.length * 3), diameters = new Float32Array(allBoards.length), cells = new Uint16Array(allBoards.length * 2);
  allBoards.forEach(({ board, gain, whole }, j) => {
    const rgba = drawCell(board, earth, grade, gain, whole), cx = (j % across) * CELL, cy = Math.floor(j / across) * CELL;
    for (let y = 0; y < CELL; y++) for (let x = 0; x < CELL; x++) { const i = (y * CELL + x) * 4, o = ((cy + y) * across * CELL + cx + x) * 4; for (let k = 0; k < 4; k++) atlas[o + k] = Math.round(rgba[i + k]! * 255); }
    positions.set(board.center, j * 3); diameters[j] = 2 * board.half; cells.set([cx, cy], j * 2);
  });
  const atlasBytes = await writeLossyWebp(sharp(atlas, { raw: { width: across * CELL, height: across * CELL, channels: 4 } }), DOTS_DIR + 'gas-dots-atlas.webp', { alphaQuality: 100 });
  const encoded = encodeCloudPoints({ id: 'gas-dots', frame, count: allBoards.length, positions, diameters, cells, atlas: 'gas-dots-atlas.webp', cellTexels: CELL, occluder: [], behindPlane: { pointUnits: [0, 0, 0], normalUnits: [0, 0, 1] } });
  readCloudPoints(encoded, 'gas dots'); const bank = encodePreparedBank(encoded, 'gas dots');
  await writeFile(DOTS_DIR + 'gas-dots.bin', packPreparedBinary(bank.bytes, bank.regions, 'gas dots'));
  await writeFile(DOTS_DIR + 'result.json', JSON.stringify({ complete: true, boards: allBoards.length, atlasBytes: atlasBytes.length, regions: report, regionIds: allBoards.map(b => b.region), physicalParametersChanged: 0 }, null, 2) + '\n');
  console.log('GAS_DOTS_COMPLETE ' + allBoards.length + ' ' + atlasBytes.length);
}
if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  const adjust = await readFile(DOTS_DIR + 'adjust.json', 'utf8').then(t => JSON.parse(t) as Record<string, number>, () => ({}));
  const installed = JSON.parse(await readFile('src/objects/lmc-volume/prepared/horalek-widefield/volume.json', 'utf8')) as { data?: { frame?: DensityVolumeFrame }; frame?: DensityVolumeFrame }, frame = installed.data?.frame ?? installed.frame; need(frame, 'Missing installed frame');
  await buildDots(frame, adjust);
}
