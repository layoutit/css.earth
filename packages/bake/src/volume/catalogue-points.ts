import { CATALOGUE_CELL_POINTS, type CataloguePointSpread, type VolumeVector } from '@cssearth/objects';

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
