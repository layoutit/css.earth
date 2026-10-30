/** Every lit catalogue gas owner as cloud points, each with at least one billboard. Owners with zero l36 amplitude carry no light and need none. */
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import sharp from 'sharp';
import { encodeCloudPoints, encodePreparedBank, readCloudPoints, parseDensityVolumeFrame, type DensityVolumeFrame } from '@cssearth/objects';
import { packPreparedBinary } from '@cssearth/objects/node';
import { writeLossyWebp } from '@cssearth/bake/raster';
import { rotateWorldPosition, transposeWorldRotation, worldRotationFromQuaternion } from '@cssearth/engine';
import { siteWorld } from '../delivery/site-views.mts';
import { normalize, type V3 } from '../geometry.mts';
import { CELL, boardOf, clusterDots, drawCell, randomStream, regionDots, regionLight, type Board, type Dot, type RegionLight } from './dots.mts';
import { L37_DIR, allGasSource, type GasRegion } from './regions.mts';

export const ALL_DIR = L37_DIR + 'dots-all/';
/** Billboards in all: the 61 other retained elements and these stay under 500. */
export const BOARDS = 430, START_GAIN = 1.2;
const DOTS_PER_BOARD = 40;

interface Group { id: string; owners: GasRegion[]; light: number; box: { min: V3; max: V3 }; }
const lightOf = (r: GasRegion) => r.emitters.reduce((n, e) => n + e.object.weight * e.amplitude, 0);
const centerOf = (g: Group) => g.box.min.map((v, k) => (v + g.box.max[k]!) / 2) as V3;
const extentOf = (g: Group) => Math.hypot(...g.box.max.map((v, k) => v - g.box.min[k]!));

export const groupRegions = (regions: readonly GasRegion[]): Group[] => regions.map(r => ({ id: r.id, owners: [r], light: lightOf(r), box: { min: [...r.box.min] as V3, max: [...r.box.max] as V3 } }));
export function allocate(groups: readonly Group[], total: number): number[] {
  const weights = groups.map(g => g.light ** .75 * Math.max(extentOf(g), .05) ** .25), sum = weights.reduce((a, b) => a + b, 0), spare = total - groups.length;
  const shares = weights.map(w => w / sum * spare), counts = shares.map(s => 1 + Math.floor(s)); let left = total - counts.reduce((a, b) => a + b, 0);
  for (const i of shares.map((s, i) => [s - Math.floor(s), i] as const).sort((a, b) => b[0] - a[0]).map(v => v[1])) { if (left-- <= 0) break; counts[i]!++; }
  return counts;
}
/** The cell axes: the real Earth view, in the frame. */
export function earthAxes(frame: DensityVolumeFrame) {
  const world = siteWorld('earth'), toFrame = transposeWorldRotation(worldRotationFromQuaternion(frame.localToReferenceXyzw)), view = worldRotationFromQuaternion(world.pose.orientationXyzw);
  const axis = (v: V3) => normalize(rotateWorldPosition(toFrame, rotateWorldPosition(view, v) as V3) as V3) as V3;
  return { right: axis([1, 0, 0]), up: axis([0, 1, 0]) };
}

export async function buildAll() {
  const { source, regions: every } = await allGasSource(), regions = every.filter(r => lightOf(r) > 0), grade = source.grade;
  console.log('GAS_OWNERS_WITHOUT_LIGHT ' + (every.length - regions.length)); await mkdir(ALL_DIR, { recursive: true });
  const installed = JSON.parse(await readFile('src/objects/lmc-volume/prepared/horalek-widefield/volume.json', 'utf8')) as { frame?: unknown; data?: { frame?: unknown } }, frame = parseDensityVolumeFrame(installed.data?.frame ?? installed.frame);
  const adjust = await readFile(ALL_DIR + 'adjust.json', 'utf8').then(t => JSON.parse(t) as Record<string, number>, () => ({} as Record<string, number>));
  const groups = groupRegions(regions), counts = allocate(groups, BOARDS), axes = earthAxes(frame), all: { group: string; board: Board; gain: number; whole: RegionLight }[] = [], report = [];
  for (const [i, group] of groups.entries()) {
    const n = counts[i]!, dots: Dot[] = group.owners.flatMap(r => regionDots(r, grade, Math.max(1, Math.round(n * DOTS_PER_BOARD * lightOf(r) / group.light))));
    const boards = clusterDots(dots, n, randomStream(i * 101 + 7)).map(boardOf), width = 1.4 * extentOf(group), whole = regionLight(dots, centerOf(group), width, axes), gain = START_GAIN * (adjust[group.id] ?? 1);
    for (const board of boards) all.push({ group: group.id, board, gain, whole });
    report.push({ id: group.id, owners: group.owners.map(o => o.label), light: group.light, boards: boards.length, dots: dots.length, gain, extentKpc: extentOf(group) });
  }
  const across = Math.ceil(Math.sqrt(all.length)), atlas = new Uint8Array((across * CELL) ** 2 * 4), positions = new Float64Array(all.length * 3), diameters = new Float32Array(all.length), cells = new Uint16Array(all.length * 2);
  all.forEach(({ board, gain, whole }, j) => {
    const rgba = drawCell(board, axes, grade, gain, whole), cx = (j % across) * CELL, cy = Math.floor(j / across) * CELL;
    for (let y = 0; y < CELL; y++) for (let x = 0; x < CELL; x++) { const k = (y * CELL + x) * 4, o = ((cy + y) * across * CELL + cx + x) * 4; for (let c = 0; c < 4; c++) atlas[o + c] = Math.round(rgba[k + c]! * 255); }
    positions.set(board.center, j * 3); diameters[j] = 2 * board.half; cells.set([cx, cy], j * 2);
  });
  const atlasBytes = await writeLossyWebp(sharp(atlas, { raw: { width: across * CELL, height: across * CELL, channels: 4 } }), ALL_DIR + 'gas-dots-atlas.webp', { alphaQuality: 100 });
  const encoded = encodeCloudPoints({ id: 'gas-dots', frame, count: all.length, positions, diameters, cells, atlas: 'gas-dots-atlas.webp', cellTexels: CELL, occluder: [], cellAxesUnits: axes });
  readCloudPoints(encoded, 'gas dots'); const bank = encodePreparedBank(encoded, 'gas dots');
  await writeFile(ALL_DIR + 'gas-dots.bin', packPreparedBinary(bank.bytes, bank.regions, 'gas dots'));
  const shared = groups.filter(g => g.owners.length > 1).reduce((n, g) => n + g.owners.length, 0);
  await writeFile(ALL_DIR + 'result.json', JSON.stringify({ complete: true, owners: every.length, lit: regions.length, groups: groups.length, ownersInSharedGroups: shared, boards: all.length, atlasBytes: atlasBytes.length, groupIds: all.map(b => b.group), report }, null, 1) + '\n');
  console.log('GAS_ALL_DOTS ' + JSON.stringify({ owners: regions.length, groups: groups.length, shared, boards: all.length, atlasBytes: atlasBytes.length, maxBoards: Math.max(...counts), dor30: report.find(r => r.owners.includes('DEM263'))?.boards }));
  return { groups, all, axes, frame, grade };
}
if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) await buildAll();
