import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { readNpyObject, type NpyArray, type NpyValue } from './npy-pickle.mts';
import { readTarMember } from './tar-member.mts';
import { shape, text, array, optional } from './source-records.mts';

const profile = shape({ path: text, member: optional(text), sampling: text, units: text, values: array(text), latitudes: optional(array(text)), longitudes: optional(array(text)),
  gridLayout: optional(text), visibleLongitudes: optional(shape({ times: array(text), planet: text })) });

/** ThERESA's range of observed longitudes (utils.vislon at commit 74a8fec): the sub-observer longitude 180 - 360 (t - t0) / P at every
 * observation time, widened by 90 degrees each way, each limb wrapped into [-180, 180) and the least and greatest taken. The planet
 * rotates synchronously, so its rotation period is the orbital period. An eccentric orbit needs an explicit rotation law before
 * this phase-to-longitude conversion can be used. Cells outside the range are not shown in ThERESA's maps. */
export function theresaVisibleLongitudes(times: ArrayLike<number>, transitTime: number, periodDays: number, eccentricity = 0): [number, number] {
  if (eccentricity !== 0) throw new TypeError('ThERESA visible longitudes need an explicit rotation law for an eccentric hosted orbit.');
  let minimum = Infinity, maximum = -Infinity;
  const wrap = (degrees: number) => ((degrees + 180) % 360 + 360) % 360 - 180;
  for (let i = 0; i < times.length; i++) {
    const centre = 180 - (times[i]! - transitTime) / periodDays * 360;
    minimum = Math.min(minimum, wrap(centre - 90)); maximum = Math.max(maximum, wrap(centre + 90));
  }
  if (!times.length) throw new RangeError('No observation times to bound the visible longitudes.');
  return [minimum, maximum];
}

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
export function decodeNpyDictionaryMap(bytes: Uint8Array, value: unknown, visibleLongitudes?: readonly [number, number]) {
  const recipe = profile(value);
  if (!['nearest', 'bilinear'].includes(recipe.sampling)) throw new TypeError('An .npy map samples nearest or bilinear.');
  // A deposit either carries its grid as arrays beside the values, or states its layout: 'pixel-centres' is the grid eclipse-mapping codes
  // such as ThERESA build (south to north and west to east from -180 degrees, values at pixel centres) when only the values are saved.
  const statedGrid = recipe.latitudes === undefined && recipe.longitudes === undefined;
  if (statedGrid ? recipe.gridLayout !== 'pixel-centres' : recipe.latitudes === undefined || recipe.longitudes === undefined || recipe.gridLayout !== undefined) {
    throw new TypeError('An .npy map names both its latitude and longitude arrays, or states gridLayout pixel-centres.');
  }
  if ((recipe.visibleLongitudes === undefined) !== (visibleLongitudes === undefined)) throw new TypeError('Visible longitudes are computed from the recipe\'s observation times.');
  const root = readNpyObject(bytes);
  const values = npyArrayAt(root, recipe.values);
  const [height, width] = values.shape;
  if (values.shape.length !== 2 || !height || !width || values.fortranOrder) throw new TypeError('The .npy map values must be one C-ordered two-dimensional array.');
  const latStep = 180 / height, lonStep = 360 / width, tolerance = 1e-9;
  if (!statedGrid) {
    const latitudes = npyArrayAt(root, recipe.latitudes!), longitudes = npyArrayAt(root, recipe.longitudes!);
    if ([latitudes, longitudes].some(grid => grid.fortranOrder || grid.shape.join() !== values.shape.join())) throw new TypeError('The .npy map arrays must share one C-ordered two-dimensional shape.');
    const lat = latitudes.data as Float64Array, lon = longitudes.data as Float64Array;
    for (let row = 0; row < height; row++) for (let column = 0; column < width; column++) {
      const i = row * width + column;
      if (Math.abs(lat[i]! - (-90 + (row + 0.5) * latStep)) > tolerance || Math.abs(lon[i]! - (-180 + (column + 0.5) * lonStep)) > tolerance) {
        throw new TypeError(`The .npy map is not a regular south-to-north, west-to-east pixel-centre grid (row ${row}, column ${column}).`);
      }
    }
  }
  const data = values.data as Float64Array;
  // ThERESA keeps a column when any part of its cell lies inside the visible range (theresa.py, ivis).
  const shown = Array.from({ length: width }, (_, column) => { const centre = -180 + (column + 0.5) * lonStep;
    return !visibleLongitudes || (centre + lonStep / 2 > visibleLongitudes[0] && centre - lonStep / 2 < visibleLongitudes[1]); });
  const column = (x: number) => ((x % width) + width) % width;
  const cell = (x: number, y: number) => { const v = data[y * width + column(x)]!; return Number.isFinite(v) && shown[column(x)] ? v : null; };
  return {
    width, height,
    sample(longitude: number, latitude: number) {
      if (!Number.isFinite(longitude) || !Number.isFinite(latitude) || latitude < -90 || latitude > 90) return null;
      const px = (((longitude + 180) % 360 + 360) % 360) / lonStep - 0.5, py = (latitude + 90) / latStep - 0.5;
      const own = cell(Math.round(px), Math.max(0, Math.min(height - 1, Math.round(py))));
      if (recipe.sampling === 'nearest' || own === null) return own;
      // Bilinear between pixel centres, wrapping in longitude and clamping at the polar rows. Beside a column that is not shown,
      // the sample's own cell stands in for the missing corner, so a shown cell is drawn whole.
      const x0 = Math.floor(px), y = Math.max(0, Math.min(height - 1, py)), y0 = Math.min(height - 2, Math.floor(y)), dx = px - x0, dy = y - y0;
      const corners = [cell(x0, y0), cell(x0 + 1, y0), cell(x0, y0 + 1), cell(x0 + 1, y0 + 1)];
      if (corners.some(v => v === null) && [x0, x0 + 1].every(x => shown[column(x)])) return null;
      const [a, b, c, d] = corners.map(v => v ?? own);
      return a! * (1 - dx) * (1 - dy) + b! * dx * (1 - dy) + c! * (1 - dx) * dy + d! * dx * dy;
    },
    report: { format: 'npy-dictionary-map', units: recipe.units, values: recipe.values.join('.'), grid: { width, height, rowOrder: 'south-to-north', longitudeOrigin: -180 }, sampling: recipe.sampling,
      ...(visibleLongitudes ? { visibleLongitudes: [...visibleLongitudes], shownColumns: shown.filter(Boolean).length } : {}) },
  };
}

export async function loadNpyDictionaryMap(root: string, value: unknown) {
  const recipe = profile(value);
  if (!recipe.path || recipe.path.startsWith('/') || recipe.path.includes('\\') || recipe.path.split('/').includes('..')) throw new TypeError('An .npy map must be inside the source directory.');
  const read = await readFile(resolve(root, recipe.path));
  // A deposit pinned as its published tar is read member by member; a bare .npy file is read directly.
  const bytes = recipe.member === undefined ? read : readTarMember(read, recipe.member);
  if (!recipe.visibleLongitudes) return decodeNpyDictionaryMap(bytes, recipe);
  // The observation times saved in the same deposit, against the planet's hosted orbit: its transit time and period.
  const { HOSTED_PLANET_IDS, hostedOrbit } = await import('@cssearth/astronomy');
  if (!(HOSTED_PLANET_IDS as readonly string[]).includes(recipe.visibleLongitudes.planet)) throw new TypeError(`Visible longitudes need a hosted planet: ${recipe.visibleLongitudes.planet}.`);
  const orbit = hostedOrbit(recipe.visibleLongitudes.planet as Parameters<typeof hostedOrbit>[0]);
  const times = npyArrayAt(readNpyObject(bytes), recipe.visibleLongitudes.times);
  if (times.shape.length !== 1) throw new TypeError('Observation times must be one-dimensional.');
  return decodeNpyDictionaryMap(bytes, recipe, theresaVisibleLongitudes(times.data as Float64Array, orbit.transitTimeBmjdTdb, orbit.periodDays, orbit.eccentricity));
}
