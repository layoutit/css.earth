/** All catalogue gas as cloud points. Billboards split wherever the flat cell error is largest, so a large region's parts sit at their own 3D places. Owners with zero l36 amplitude carry no light. */
import { readFileSync } from 'node:fs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import sharp from 'sharp';
import { encodeCloudPoints, encodePreparedBank, readCloudPoints, parseDensityVolumeFrame, type DensityVolumeFrame } from '@cssearth/objects';
import { packPreparedBinary } from '@cssearth/objects/node';
import { writeLossyWebp } from '@cssearth/bake/raster';
import { rotateWorldPosition, transposeWorldRotation, worldRotationFromQuaternion } from '@cssearth/engine';
import { siteWorld } from '../delivery/site-views.mts';
import { dot as dot3, normalize, type V3 } from '../geometry.mts';
import { CELL, dotShape, boardOf, clusterDots, drawCell, randomStream, regionDots, regionLight, type Board, type Dot, type RegionLight } from './dots.mts';
import { L37_DIR, allGasSource, type GasRegion } from './regions.mts';

const ARM = process.env.GRADE_ARM as string | undefined, BANK_ID = ARM ? 'gas-dots-' + ARM : 'gas-dots', ATLAS = BANK_ID + '-atlas.webp';
export const GAINS_RECORD = 'src/objects/lmc-volume/source/preparation/l36/gas-dot-gains.json', GRADES_RECORD = 'src/objects/lmc-volume/source/preparation/l36/image-grades.json';
export function readArmGrade(arm: string) { return (JSON.parse(readFileSync(GRADES_RECORD, 'utf8')) as Record<string, { grade: never }>)[arm]!.grade as Awaited<ReturnType<typeof allGasSource>>['source']['grade']; }
export const ALL_DIR = L37_DIR + (ARM ? 'dots-' + ARM + '/' : 'dots-all/');
/** Billboards in all: the 61 other retained elements and these stay under 500. */
export const BOARDS = 439, GAS_BOARDS = 300, DUST_BOARDS = BOARDS - GAS_BOARDS, START_GAIN = .9;

const DOTS_PER_BOARD = 60;

const lightOf = (r: GasRegion) => r.emitters.reduce((n, e) => n + e.object.weight * e.amplitude, 0);
const dotLight = (d: Dot) => d.light[0] + d.light[1] + d.light[2];
interface Cluster { dots: (Dot & { owner: string })[]; board: Board; light: number; }
const clusterOf = (dots: Cluster['dots']): Cluster => ({ dots, board: boardOf(dots), light: dots.reduce((n, d) => n + dotLight(d), 0) });
/** The billboard to split next: a wide one's error is its width, and a faint one matters a little less. */
const score = (c: Cluster) => c.dots.length < 2 ? -1 : c.board.half * c.light ** .15;

export function splitClusters(dots: Cluster['dots'], total: number): Cluster[] {
  const clusters = [clusterOf(dots)];
  while (clusters.length < total) {
    let worst = 0; clusters.forEach((c, i) => { if (score(c) > score(clusters[worst]!)) worst = i; });
    const [a, b] = clusterDots(clusters[worst]!.dots, 2, randomStream(clusters.length * 31 + 5)) as [Cluster['dots'], Cluster['dots'] | undefined]; if (!b) break;
    clusters.splice(worst, 1, clusterOf(a), clusterOf(b));
  }
  return clusters;
}
/**
 * The model's discrete dust as flat dark patches in the disc plane. Each cell is the clouds' own optical depth, as the Homunculus
 * draws dust: an absorbing color and an opacity. Its alpha is the V-band absorption of that column; the color is what the model's
 * extinction curve lets through, so the dust reddens slightly. One gain (`adjust.dust`) accounts for the disc light in front of a
 * mid-plane cloud, measured against the accepted delivery's total darkening.
 */
function dustPatches(clouds: readonly { center: V3; axes: V3; weight: number }[], strength: number, total: number) {
  const dots: (Dot & { tau: number })[] = clouds.map(c => { const tau = c.weight * strength; return { at: c.center, radius: Math.max(.006, Math.cbrt(c.axes[0] * c.axes[1] * c.axes[2])), light: [tau, 0, 0] as V3, tau }; });
  const split = (list: typeof dots): typeof dots[] => clusterDots(list, 2, randomStream(list.length + 3)) as typeof dots[];
  let patches: { list: typeof dots; half: number }[] = [{ list: dots, half: Infinity }];
  const extent = (list: typeof dots) => { let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity; for (const d of list) { x0 = Math.min(x0, d.at[0] - d.radius); x1 = Math.max(x1, d.at[0] + d.radius); y0 = Math.min(y0, d.at[1] - d.radius); y1 = Math.max(y1, d.at[1] + d.radius); } return { cx: (x0 + x1) / 2, cy: (y0 + y1) / 2, half: Math.max(x1 - x0, y1 - y0) / 2 * 1.02 }; };
  patches[0]!.half = extent(dots).half;
  while (patches.length < total) { let worst = 0; patches.forEach((p, i) => { if (p.half > patches[worst]!.half && p.list.length > 1) worst = i; }); const parts = split(patches[worst]!.list); if (parts.length < 2) break; patches = [...patches.slice(0, worst), ...parts.map(list => ({ list, half: extent(list).half })), ...patches.slice(worst + 1)]; }
  return patches.map(p => { const e = extent(p.list), z = p.list.reduce((n, d) => n + d.at[2] * d.tau, 0) / p.list.reduce((n, d) => n + d.tau, 0); return { center: [e.cx, e.cy, z] as V3, half: e.half, list: p.list }; });
}
function drawDustCell(patch: { center: V3; half: number; list: readonly (Dot & { tau: number })[] }, extinction: readonly number[], gain: number) {
  const tau = new Float64Array(CELL * CELL), texel = 2 * patch.half / CELL;
  for (const d of patch.list) {
    const u = (d.at[0] - patch.center[0] + patch.half) / texel, v = (patch.half - (d.at[1] - patch.center[1])) / texel, r = Math.max(d.radius / texel, .75), weights: [number, number][] = []; let sum = 0;
    for (let y = Math.max(0, Math.floor(v - r)); y < Math.min(CELL, Math.ceil(v + r)); y++) for (let x = Math.max(0, Math.floor(u - r)); x < Math.min(CELL, Math.ceil(u + r)); x++) { const w = dotShape(Math.hypot(x + .5 - u, y + .5 - v) / r); if (w > 0) { weights.push([y * CELL + x, w]); sum += w; } }
    if (sum > 0) for (const [p, w] of weights) tau[p]! += d.tau * w / sum / (texel * texel);
  }
  const rgba = new Float64Array(CELL * CELL * 4), through = extinction.map(e => .1 * Math.exp(-e));
  for (let p = 0; p < tau.length; p++) { rgba[p * 4] = through[0]!; rgba[p * 4 + 1] = through[1]!; rgba[p * 4 + 2] = through[2]!; rgba[p * 4 + 3] = 1 - Math.exp(-tau[p]! * gain); }
  return rgba;
}
/** The cell axes: the real Earth view, in the frame. */
export function earthAxes(frame: DensityVolumeFrame) {
  const world = siteWorld('earth'), toFrame = transposeWorldRotation(worldRotationFromQuaternion(frame.localToReferenceXyzw)), view = worldRotationFromQuaternion(world.pose.orientationXyzw);
  const axis = (v: V3) => normalize(rotateWorldPosition(toFrame, rotateWorldPosition(view, v) as V3) as V3) as V3;
  return { right: axis([1, 0, 0]), up: axis([0, 1, 0]) };
}

export async function buildAll() {
  const { source, regions: every } = await allGasSource(), regions = every.filter(r => lightOf(r) > 0), grade = ARM ? readArmGrade(ARM) : source.grade; await mkdir(ALL_DIR, { recursive: true });
  const installed = JSON.parse(await readFile('src/objects/lmc-volume/prepared/horalek-widefield/volume.json', 'utf8')) as { frame?: unknown; data?: { frame?: unknown } }, frame = parseDensityVolumeFrame(installed.data?.frame ?? installed.frame);
  const adjust = (JSON.parse(await readFile(GAINS_RECORD, 'utf8')) as { gains: Record<string, number> }).gains;
  const axes = earthAxes(frame), total = regions.reduce((n, r) => n + lightOf(r), 0);
  const dots: Cluster['dots'] = regions.flatMap(r => regionDots(r, grade, Math.max(1, Math.round(BOARDS * DOTS_PER_BOARD * lightOf(r) / total))).map(d => ({ ...d, owner: r.id })));
  const clusters = splitClusters(dots, GAS_BOARDS), reach = 2 * dots.reduce((most, d) => Math.max(most, Math.abs(dot3(d.at, axes.right)), Math.abs(dot3(d.at, axes.up))), 0) + 1, whole = regionLight(dots, [0, 0, 0], reach, axes, 3072);
  const owned = new Set<string>(), all: { group: string; board: Board; gain: number; whole: RegionLight }[] = clusters.map(c => {
    const share = new Map<string, number>(); for (const d of c.dots) share.set(d.owner, (share.get(d.owner) ?? 0) + dotLight(d));
    const group = [...share].sort((x, y) => y[1] - x[1])[0]![0]; owned.add(group);
    return { group, board: c.board, gain: START_GAIN * (adjust['*'] ?? 1) * (adjust[group] ?? 1), whole };
  });
  const groups = regions.map(r => ({ id: r.id })), report = clusters.map((c, i) => ({ id: all[i]!.group, boards: 1, dots: c.dots.length, gain: all[i]!.gain, halfKpc: c.board.half }));
  const halves = clusters.map(c => c.board.half).sort((x, y) => y - x);
  const layer = source.scene.dustLayer!, patches = dustPatches((layer.clouds ?? []) as unknown as { center: V3; axes: V3; weight: number }[], layer.strength, DUST_BOARDS), dustGain = adjust.dust ?? 1;
  const count = all.length + patches.length, across = Math.ceil(Math.sqrt(count)), atlas = new Uint8Array((across * CELL) ** 2 * 4), positions = new Float64Array(count * 3), diameters = new Float32Array(count), cells = new Uint16Array(count * 2);
  all.forEach(({ board, gain, whole }, j) => {
    const rgba = drawCell(board, axes, grade, gain, whole), cx = (j % across) * CELL, cy = Math.floor(j / across) * CELL;
    for (let y = 0; y < CELL; y++) for (let x = 0; x < CELL; x++) { const k = (y * CELL + x) * 4, o = ((cy + y) * across * CELL + cx + x) * 4; for (let c = 0; c < 4; c++) atlas[o + c] = Math.round(rgba[k + c]! * 255); }
    positions.set(board.center, j * 3); diameters[j] = 2 * board.half; cells.set([cx, cy], j * 2);
  });
  patches.forEach((patch, i) => {
    const j = all.length + i, rgba = drawDustCell(patch, layer.extinctionRgb ?? [1, 1, 1], dustGain), cx = (j % across) * CELL, cy = Math.floor(j / across) * CELL;
    for (let y = 0; y < CELL; y++) for (let x = 0; x < CELL; x++) { const k = (y * CELL + x) * 4, o = ((cy + y) * across * CELL + cx + x) * 4; for (let c = 0; c < 4; c++) atlas[o + c] = Math.round(rgba[k + c]! * 255); }
    positions.set(patch.center, j * 3); diameters[j] = 2 * patch.half; cells.set([cx, cy], j * 2);
  });
  const atlasBytes = await writeLossyWebp(sharp(atlas, { raw: { width: across * CELL, height: across * CELL, channels: 4 } }), ALL_DIR + ATLAS, { alphaQuality: 100 });
  const encoded = encodeCloudPoints({ id: BANK_ID, frame, count, positions, diameters, cells, atlas: ATLAS, cellTexels: CELL, occluder: [], planarCells: { from: all.length, right: [1, 0, 0], up: [0, 1, 0] } });
  readCloudPoints(encoded, 'gas dots'); const bank = encodePreparedBank(encoded, 'gas dots');
  await writeFile(ALL_DIR + BANK_ID + '.bin', packPreparedBinary(bank.bytes, bank.regions, 'gas dots'));
  await writeFile(ALL_DIR + 'result.json', JSON.stringify({ complete: true, owners: every.length, lit: regions.length, ownersWithOwnBillboard: owned.size, boards: all.length, dustPatches: patches.length, dustClouds: (layer.clouds ?? []).length, dustHalfKpc: [patches.reduce((n, p) => Math.max(n, p.half), 0), patches.map(p => p.half).sort((a, b) => a - b)[patches.length >> 1]], atlasBytes: atlasBytes.length, largestHalfKpc: halves[0], medianHalfKpc: halves[Math.floor(halves.length / 2)], groupIds: all.map(b => b.group), centres: all.map(b => b.board.center), report }, null, 1) + '\n');
  console.log('GAS_ALL_DOTS ' + JSON.stringify({ lit: regions.length, ownersWithOwnBillboard: owned.size, boards: all.length, dust: patches.length, atlasBytes: atlasBytes.length, largestHalfKpc: halves[0], medianHalfKpc: halves[Math.floor(halves.length / 2)], dots: dots.length }));
  return { groups, all, axes, frame, grade };
}
if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) await buildAll();
