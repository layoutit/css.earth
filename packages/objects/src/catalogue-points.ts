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
