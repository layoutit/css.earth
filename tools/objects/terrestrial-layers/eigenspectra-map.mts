/** Eigenspectra products (Mansfield et al. 2020 method; github.com/meganmansfield/eigenspectra) as deposited with a paper:
 *
 * - `eigenspectra-temperature`: one wavelength's brightness-temperature maps, an .npz whose arr_0 is the wavelength (µm),
 *   arr_1 and arr_2 the latitude and longitude of every grid node (radians) and arr_3 the lower, best and upper maps.
 * The k-means group map (an .npz whose arr_2 is the group of every node over the observed longitudes, arr_3 and arr_4 the node
 * latitudes and longitudes) bounds the observed longitudes and, with `boundaries`, draws the borders between the groups over the
 * map as thin black lines, as the paper's Figure 1 draws them.
 *
 * The grids are the ones eigenmaps.generate_maps builds: nodes from -90 to +90 degrees and from -180 to +180 degrees inclusive,
 * rows south to north, longitude 0 at the substellar point and increasing eastward (the map was proved east-positive against the
 * deposited light curves; see the WASP-18b README). The node grid is checked exactly, never assumed. Nodes outside the
 * longitudes the observation saw, which are the group map's columns, carry no data. */
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { requireRecord, requireString } from '@cssearth/core';
import { npzArray, readNpz } from './npz.mts';

const RADIAN = 180 / Math.PI;

interface NodeGrid { readonly rows: number; readonly columns: number; readonly latitudes: readonly number[]; readonly longitudes: readonly number[] }

/** The node latitudes (one per row) and longitudes (one per column) of a regular grid given as two full 2D arrays in radians. */
export function nodeGrid(latitudes: { shape: readonly number[]; values: Float64Array }, longitudes: { shape: readonly number[]; values: Float64Array }, context: string): NodeGrid {
  const [rows, columns] = latitudes.shape;
  if (latitudes.shape.length !== 2 || longitudes.shape.join() !== latitudes.shape.join() || !rows || !columns) throw new TypeError(`${context}: latitude and longitude grids differ in shape.`);
  const lat = Array.from({ length: rows }, (_, row) => latitudes.values[row * columns]! * RADIAN);
  const lon = Array.from({ length: columns }, (_, column) => longitudes.values[column]! * RADIAN);
  for (let row = 0; row < rows; row++) for (let column = 0; column < columns; column++) {
    if (Math.abs(latitudes.values[row * columns + column]! * RADIAN - lat[row]!) > 1e-9 || Math.abs(longitudes.values[row * columns + column]! * RADIAN - lon[column]!) > 1e-9) {
      throw new TypeError(`${context}: the grid is not regular (row ${row}, column ${column}).`);
    }
  }
  for (const [values, name] of [[lat, 'latitude'], [lon, 'longitude']] as const) {
    const step = (values.at(-1)! - values[0]!) / (values.length - 1);
    if (!(step > 0) || values.some((value, i) => Math.abs(value - (values[0]! + i * step)) > 1e-9)) throw new TypeError(`${context}: ${name} nodes are not evenly spaced and increasing.`);
  }
  return { rows, columns, latitudes: lat, longitudes: lon };
}

async function readArchive(root: string, path: string) {
  if (!path || path.startsWith('/') || path.includes('\\') || path.split('/').includes('..')) throw new TypeError('An Eigenspectra product must be inside the source directory.');
  return readNpz(await readFile(resolve(root, path)));
}

/** The observed longitude range: the group map's first and last columns. */
async function observedLongitudes(root: string, groupsPath: string) {
  const archive = await readArchive(root, groupsPath);
  const grid = nodeGrid(npzArray(archive, 'arr_3', groupsPath), npzArray(archive, 'arr_4', groupsPath), groupsPath);
  return [grid.longitudes[0]!, grid.longitudes.at(-1)!] as const;
}

export async function loadEigenspectraTemperature(root: string, value: unknown) {
  const lens = requireRecord(value, 'Eigenspectra temperature lens'), path = requireString(lens.path, 'path'), groups = requireString(lens.observedFrom, 'observedFrom');
  const archive = await readArchive(root, path);
  const wavelength = npzArray(archive, 'arr_0', path), maps = npzArray(archive, 'arr_3', path);
  const grid = nodeGrid(npzArray(archive, 'arr_1', path), npzArray(archive, 'arr_2', path), path);
  if (wavelength.shape.length !== 0) throw new TypeError(`${path}: arr_0 is the map's wavelength.`);
  if (maps.shape.join() !== [3, grid.rows, grid.columns].join()) throw new TypeError(`${path}: arr_3 holds the lower, best and upper maps on the grid.`);
  if (grid.latitudes[0] !== -90 || grid.latitudes.at(-1) !== 90 || grid.longitudes[0] !== -180 || grid.longitudes.at(-1) !== 180) throw new TypeError(`${path}: the grid does not span the whole sphere node to node.`);
  const [west, east] = await observedLongitudes(root, groups);
  const regions = lens.boundaries === true ? await loadEigenspectraGroups(root, { path: groups }) : null;
  const best = maps.values.subarray(grid.rows * grid.columns, 2 * grid.rows * grid.columns);
  const latStep = 180 / (grid.rows - 1), lonStep = 360 / (grid.columns - 1);
  const node = (row: number, column: number) => best[row * grid.columns + column]!;
  let hottest = { value: -Infinity, latitude: 0, longitude: 0 };
  for (let row = 0; row < grid.rows; row++) for (let column = 0; column < grid.columns; column++) {
    const longitude = grid.longitudes[column]!;
    if (longitude >= west && longitude <= east && node(row, column) > hottest.value) hottest = { value: node(row, column), latitude: grid.latitudes[row]!, longitude };
  }
  return {
    sample(longitude: number, latitude: number) {
      if (!Number.isFinite(longitude) || !Number.isFinite(latitude) || latitude < -90 || latitude > 90) return null;
      const lon = ((longitude + 180) % 360 + 360) % 360 - 180;
      if (lon < west || lon > east) return null;
      const x = (lon + 180) / lonStep, y = (latitude + 90) / latStep;
      const x0 = Math.min(grid.columns - 2, Math.floor(x)), y0 = Math.min(grid.rows - 2, Math.floor(y)), dx = x - x0, dy = y - y0;
      return node(y0, x0) * (1 - dx) * (1 - dy) + node(y0, x0 + 1) * dx * (1 - dy) + node(y0 + 1, x0) * (1 - dx) * dy + node(y0 + 1, x0 + 1) * dx * dy;
    },
    ...(regions ? { outline(longitude: number, latitude: number, pixelDegrees: number) {
      // A pixel is on a border when the group changes within half a pixel of it, which draws a line about one pixel wide.
      const here = regions.sample(longitude, latitude), step = pixelDegrees / 2;
      return here !== null && [[step, 0], [-step, 0], [0, step], [0, -step]].some(([dx, dy]) => {
        const there = regions.sample(longitude + dx!, Math.max(-90, Math.min(90, latitude + dy!)));
        return there !== null && there !== here;
      });
    } } : {}),
    report: { format: 'eigenspectra-temperature', units: 'K', wavelengthMicrons: wavelength.values[0], grid: { rows: grid.rows, columns: grid.columns, nodes: 'inclusive, south to north, west to east' },
      observedLongitudes: [west, east], hottestObserved: hottest },
  };
}

export async function loadEigenspectraGroups(root: string, value: unknown) {
  const lens = requireRecord(value, 'Eigenspectra group map'), path = requireString(lens.path, 'path');
  const archive = await readArchive(root, path), groups = npzArray(archive, 'arr_2', path);
  const grid = nodeGrid(npzArray(archive, 'arr_3', path), npzArray(archive, 'arr_4', path), path);
  if (groups.shape.join() !== [grid.rows, grid.columns].join()) throw new TypeError(`${path}: arr_2 is the group of every node.`);
  const counts: Record<string, number> = {};
  for (const group of groups.values) {
    if (!Number.isInteger(group) || group < 0) throw new TypeError(`${path}: group ${group} is not a group number.`);
    counts[String(group)] = (counts[String(group)] ?? 0) + 1;
  }
  const latStep = (grid.latitudes.at(-1)! - grid.latitudes[0]!) / (grid.rows - 1), lonStep = (grid.longitudes.at(-1)! - grid.longitudes[0]!) / (grid.columns - 1);
  const [west, east] = [grid.longitudes[0]! - lonStep / 2, grid.longitudes.at(-1)! + lonStep / 2];
  return {
    sample(longitude: number, latitude: number) {
      if (!Number.isFinite(longitude) || !Number.isFinite(latitude) || latitude < -90 || latitude > 90) return null;
      const lon = ((longitude + 180) % 360 + 360) % 360 - 180;
      if (lon < west || lon > east) return null;
      const column = Math.max(0, Math.min(grid.columns - 1, Math.round((lon - grid.longitudes[0]!) / lonStep)));
      const row = Math.max(0, Math.min(grid.rows - 1, Math.round((latitude - grid.latitudes[0]!) / latStep)));
      return groups.values[row * grid.columns + column]!;
    },
    report: { format: 'eigenspectra-groups', kind: 'categories', grid: { rows: grid.rows, columns: grid.columns }, observedLongitudes: [grid.longitudes[0], grid.longitudes.at(-1)], counts },
  };
}
