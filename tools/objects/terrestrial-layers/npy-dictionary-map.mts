import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { readNpyObject, type NpyArray, type NpyValue } from './npy-pickle.mts';
import { readTarMember } from './tar-member.mts';
import { shape, text, array, optional } from './source-records.mts';

const profile = shape({ path: text, member: optional(text), sampling: text, units: text, values: array(text), latitudes: array(text), longitudes: array(text) });

/** The float64 array at a key path of a pickled dictionary, checked at every step. */
export const npyArrayAt = (root: NpyValue, keys: readonly string[]): NpyArray => {
  let value = root;
  for (const key of keys) {
    if (typeof value !== 'object' || value === null || Array.isArray(value) || value instanceof Uint8Array || (value as NpyArray).kind === 'ndarray' || !Object.hasOwn(value, key)) {
      throw new TypeError(`The .npy dictionary has no ${keys.join('.')}.`);
    }
    value = (value as Record<string, NpyValue>)[key]!;
  }
  if ((value as NpyArray)?.kind !== 'ndarray' || (value as NpyArray).dtype !== 'float64') throw new TypeError(`${keys.join('.')} is not a float64 array.`);
  return value as NpyArray;
};

/** A global longitude-latitude grid stored as three same-shaped arrays in a pickled `.npy` dictionary (values, pixel-centre
 * latitudes, pixel-centre longitudes), as eclipse-mapping codes publish their maps. The grid must be regular, whole-sphere
 * and row-major with latitude along the first axis and longitude along the second; any other layout is refused rather than
 * guessed. */
export function decodeNpyDictionaryMap(bytes: Uint8Array, value: unknown) {
  const recipe = profile(value);
  if (!['nearest', 'bilinear'].includes(recipe.sampling)) throw new TypeError('An .npy map samples nearest or bilinear.');
  const root = readNpyObject(bytes);
  const values = npyArrayAt(root, recipe.values), latitudes = npyArrayAt(root, recipe.latitudes), longitudes = npyArrayAt(root, recipe.longitudes);
  const [height, width] = values.shape;
  if (values.shape.length !== 2 || !height || !width || values.fortranOrder || [latitudes, longitudes].some(grid => grid.fortranOrder || grid.shape.join() !== values.shape.join())) {
    throw new TypeError('The .npy map arrays must share one C-ordered two-dimensional shape.');
  }
  const lat = latitudes.data as Float64Array, lon = longitudes.data as Float64Array, data = values.data as Float64Array;
  const latStep = 180 / height, lonStep = 360 / width, tolerance = 1e-9;
  for (let row = 0; row < height; row++) for (let column = 0; column < width; column++) {
    const i = row * width + column;
    if (Math.abs(lat[i]! - (-90 + (row + 0.5) * latStep)) > tolerance || Math.abs(lon[i]! - (-180 + (column + 0.5) * lonStep)) > tolerance) {
      throw new TypeError(`The .npy map is not a regular south-to-north, west-to-east pixel-centre grid (row ${row}, column ${column}).`);
    }
  }
  const cell = (x: number, y: number) => { const v = data[y * width + ((x % width) + width) % width]!; return Number.isFinite(v) ? v : null; };
  return {
    width, height,
    sample(longitude: number, latitude: number) {
      if (!Number.isFinite(longitude) || !Number.isFinite(latitude) || latitude < -90 || latitude > 90) return null;
      const px = (((longitude + 180) % 360 + 360) % 360) / lonStep - 0.5, py = (latitude + 90) / latStep - 0.5;
      if (recipe.sampling === 'nearest') return cell(Math.round(px), Math.max(0, Math.min(height - 1, Math.round(py))));
      // Bilinear between pixel centres, wrapping in longitude and clamping at the polar rows.
      const x0 = Math.floor(px), y = Math.max(0, Math.min(height - 1, py)), y0 = Math.min(height - 2, Math.floor(y)), dx = px - x0, dy = y - y0;
      const corners = [cell(x0, y0), cell(x0 + 1, y0), cell(x0, y0 + 1), cell(x0 + 1, y0 + 1)];
      if (corners.some(v => v === null)) return null;
      const [a, b, c, d] = corners as number[];
      return a! * (1 - dx) * (1 - dy) + b! * dx * (1 - dy) + c! * (1 - dx) * dy + d! * dx * dy;
    },
    report: { format: 'npy-dictionary-map', units: recipe.units, values: recipe.values.join('.'), grid: { width, height, rowOrder: 'south-to-north', longitudeOrigin: -180 }, sampling: recipe.sampling },
  };
}

export async function loadNpyDictionaryMap(root: string, value: unknown) {
  const recipe = profile(value);
  if (!recipe.path || recipe.path.startsWith('/') || recipe.path.includes('\\') || recipe.path.split('/').includes('..')) throw new TypeError('An .npy map must be inside the source directory.');
  const bytes = await readFile(resolve(root, recipe.path));
  // A deposit pinned as its published tar is read member by member; a bare .npy file is read directly.
  return decodeNpyDictionaryMap(recipe.member === undefined ? bytes : readTarMember(bytes, recipe.member), recipe);
}
