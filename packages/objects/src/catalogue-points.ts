import type { VolumeVector } from './density-volume.js';

/** A prepared bank of catalogue points the app fetches and draws as dots (`packages/renderer/src/universe/catalogue-points.ts`). */
export const CATALOGUE_POINTS_SCHEMA = 'cssearth-catalogue-points@1';
/** The most points a published bank may hold: enough for the Milky Way's stacked levels (32,829 dots). The renderer
 * projects the drawn prefix of a bank every frame and refuses a larger one; the bake never publishes a larger one. A
 * fuller catalogue is a bake input that a merge or stack thins first (packages/bake/src/volume/node/catalogue-banks.ts). */
export const MAX_CATALOGUE_POINTS = 40000;

/** A bank's shape as its points trace it around its origin: the axis they spread least along (a disc's normal) and the
 * 90th-percentile reach across that axis and along it, in bank units. The bake that publishes a catalogue point bank
 * (packages/bake/src/volume/node/catalogue-banks.ts) writes it as the bank's `spread`; the app reads it instead of deriving it
 * on every mount (the Milky Way's 32,829 dots took 40 ms). */
export interface CataloguePointSpread { readonly normal: VolumeVector; readonly across: number; readonly along: number }

/** The spread of a bank's point rows (`[x, y, z]` or `[x, y, z, paletteIndex]`, in bank units). */
export function cataloguePointSpread(points: readonly (readonly number[])[]): CataloguePointSpread {
  const c = [0, 0, 0, 0, 0, 0]; // xx, yy, zz, xy, xz, yz
  for (const [x = 0, y = 0, z = 0] of points) { c[0] += x * x; c[1] += y * y; c[2] += z * z; c[3] += x * y; c[4] += x * z; c[5] += y * z; }
  const trace = c[0]! + c[1]! + c[2]!;
  // The least-spread axis is the largest eigenvector of (trace I - C), found by power iteration.
  let v = [1 / Math.sqrt(3), 1 / Math.sqrt(3.1), 1 / Math.sqrt(2.9)];
  for (let i = 0; i < 64; i++) {
    const w = [(trace - c[0]!) * v[0]! - c[3]! * v[1]! - c[4]! * v[2]!, -c[3]! * v[0]! + (trace - c[1]!) * v[1]! - c[5]! * v[2]!, -c[4]! * v[0]! - c[5]! * v[1]! + (trace - c[2]!) * v[2]!];
    const length = Math.hypot(...w); if (!(length > 0)) break; v = w.map(value => value / length);
  }
  const alongs: number[] = [], acrosses: number[] = [];
  for (const [x = 0, y = 0, z = 0] of points) { const h = x * v[0]! + y * v[1]! + z * v[2]!; alongs.push(Math.abs(h)); acrosses.push(Math.sqrt(Math.max(0, x * x + y * y + z * z - h * h))); }
  const percentile = (values: number[]) => values.sort((a, b) => a - b)[Math.floor(0.9 * (values.length - 1))]!;
  return Object.freeze({ normal: Object.freeze([v[0]!, v[1]!, v[2]!]) as VolumeVector, across: percentile(acrosses), along: percentile(alongs) });
}

/** A bank's prepared `spread`: a unit normal and two finite, non-negative reaches. */
export function parseCataloguePointSpread(value: unknown, id: string): CataloguePointSpread {
  const spread = value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : null;
  const normal = spread?.normal, across = spread?.across, along = spread?.along;
  const reach = (number: unknown): number is number => typeof number === 'number' && Number.isFinite(number) && number >= 0;
  if (!Array.isArray(normal) || normal.length !== 3 || !normal.every(axis => typeof axis === 'number' && Number.isFinite(axis)) ||
      Math.abs(Math.hypot(normal[0], normal[1], normal[2]) - 1) > 1e-6 || !reach(across) || !reach(along)) {
    throw new TypeError(`${id}: catalogue point bank field spread must be { normal: a unit [x, y, z], across: reach >= 0, along: reach >= 0 }, got ${JSON.stringify(value)}.`);
  }
  return Object.freeze({ normal: Object.freeze([normal[0], normal[1], normal[2]]) as VolumeVector, across, along });
}

/** The most points in one cell of a bank's `cells`. The renderer tests a cell's box against the view before any of its
 * points, so the smaller the cells, the fewer points a view outside them costs; each cell adds one box to the bank. */
export const CATALOGUE_CELL_POINTS = 128;

/** A bank's points grouped into cells, each a box that holds them: the renderer skips a cell whose box lies behind the
 * camera or outside the view without visiting its points (2026-09-30: on the zoom out of the nearby universe, 74% of the
 * points a repaint visited were behind the camera or off screen). `of[i]` is point i's cell; `boxes` holds each cell's
 * `[minX, minY, minZ, maxX, maxY, maxZ]` in bank units. A cell never spans two levels of a stacked bank, so each level
 * draws from its own cells. */
export interface CatalogueCells { readonly boxes: Float64Array; readonly of: Int32Array }

/** Cells for a bank's point rows: each level (`levelPoints`, the counts in order; the whole bank when absent) split at
 * the median of its longest axis until no cell holds more than `cellPoints`. The same rows give the same cells. */
export function catalogueCells(points: readonly (readonly number[])[], levelPoints: readonly number[] = [points.length],
  cellPoints = CATALOGUE_CELL_POINTS): { readonly boxes: number[][]; readonly of: number[] } {
  if (levelPoints.reduce((sum, count) => sum + count, 0) !== points.length) throw new RangeError(`Levels of ${levelPoints.join(' + ')} points do not add up to the bank's ${points.length}.`);
  const boxes: number[][] = [], of = new Array<number>(points.length).fill(-1);
  const box = (indices: readonly number[]) => {
    const bounds = [Infinity, Infinity, Infinity, -Infinity, -Infinity, -Infinity];
    for (const index of indices) for (let axis = 0; axis < 3; axis++) {
      const value = points[index]![axis]!;
      if (value < bounds[axis]!) bounds[axis] = value;
      if (value > bounds[axis + 3]!) bounds[axis + 3] = value;
    }
    return bounds;
  };
  const split = (indices: number[]) => {
    const bounds = box(indices);
    if (indices.length <= cellPoints) { for (const index of indices) of[index] = boxes.length; boxes.push(bounds); return; }
    const extent = [0, 1, 2].map(axis => bounds[axis + 3]! - bounds[axis]!), axis = extent.indexOf(Math.max(...extent));
    indices.sort((a, b) => points[a]![axis]! - points[b]![axis]! || a - b);
    const half = indices.length >> 1;
    split(indices.slice(0, half)); split(indices.slice(half));
  };
  let start = 0;
  for (const count of levelPoints) { split(Array.from({ length: count }, (_, index) => start + index)); start += count; }
  return { boxes, of };
}

/** A bank's prepared `cells`: every point in exactly one cell whose box holds it, every box used, and no cell spanning
 * two levels (`levelPoints`, the level counts in order). */
export function parseCatalogueCells(value: unknown, points: readonly (readonly number[])[], levelPoints: readonly number[], id: string): CatalogueCells {
  const cells = value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : null;
  const fail = (why: string): never => { throw new TypeError(`${id}: catalogue point bank field cells ${why}.`); };
  if (!cells || !Array.isArray(cells.boxes) || !cells.boxes.length || !Array.isArray(cells.of)) fail('must be { boxes: [[minX, minY, minZ, maxX, maxY, maxZ], ...], of: a cell per point }');
  const rows = cells!.boxes as unknown[], cellOf = cells!.of as unknown[];
  if (cellOf.length !== points.length) fail(`names ${cellOf.length} cells for ${points.length} points`);
  const boxes = new Float64Array(rows.length * 6);
  rows.forEach((row, cell) => {
    if (!Array.isArray(row) || row.length !== 6 || !row.every(bound => typeof bound === 'number' && Number.isFinite(bound)) ||
        !(row[0] <= row[3] && row[1] <= row[4] && row[2] <= row[5])) fail(`box ${cell} must be six finite bounds, each minimum at most its maximum, got ${JSON.stringify(row)}`);
    boxes.set(row as number[], cell * 6);
  });
  const of = new Int32Array(points.length), used = new Uint8Array(rows.length), levelOf = new Int32Array(rows.length).fill(-1);
  let level = 0, levelEnd = levelPoints[0] ?? points.length;
  cellOf.forEach((raw, index) => {
    while (index >= levelEnd && level < levelPoints.length - 1) levelEnd += levelPoints[++level]!;
    if (!Number.isInteger(raw) || (raw as number) < 0 || (raw as number) >= rows.length) fail(`names cell ${JSON.stringify(raw)} for point ${index}, outside its ${rows.length} boxes`);
    const cell = raw as number, point = points[index]!;
    for (let axis = 0; axis < 3; axis++) if (!(point[axis]! >= boxes[cell * 6 + axis]! && point[axis]! <= boxes[cell * 6 + axis + 3]!)) {
      fail(`box ${cell} does not hold point ${index} (${point.slice(0, 3).join(', ')})`);
    }
    if (levelOf[cell] !== -1 && levelOf[cell] !== level) fail(`cell ${cell} spans levels ${levelOf[cell]} and ${level}`);
    levelOf[cell] = level; used[cell] = 1; of[index] = cell;
  });
  const unused = used.indexOf(0);
  if (unused >= 0) fail(`box ${unused} holds no point`);
  return Object.freeze({ boxes, of });
}
