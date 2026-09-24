/**
 * A released longitude/latitude grid of one scalar quantity stored as NumPy .npy arrays: the values as a rows × columns
 * float64 array, and the node longitudes and latitudes as two separate one-dimensional arrays. Each value belongs to its
 * node, so a cell is drawn as the node's value over the half-step around it; nothing is interpolated.
 *
 * The grid may be defined in a different body frame from the mesh it is cast onto. A `frameTransfer` record then names
 * the grid's published spin state and the mesh's spin parameter file; both are placed in equatorial J2000 at one stated
 * epoch and every mesh direction is carried into the grid frame before its node is looked up.
 */
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { requireFiniteNumber, requireRecord, requireString } from '@cssearth/core';
import { parseSpinState, spinOrientation, type SpinState } from './observer-camera.mts';
import { readNpyHeader } from './npy-pickle.mts';

type Matrix = readonly (readonly [number, number, number])[];

export interface NpyArray { descr: '<f8' | '<i8'; shape: readonly number[]; values: Float64Array; }

/** Read a little-endian float64 or int64 C-order .npy array (format versions 1 to 3). */
export function readNpy(bytes: Buffer): NpyArray {
  const { header, descr, fortranOrder, shape, dataOffset } = readNpyHeader(bytes);
  if ((descr !== '<f8' && descr !== '<i8') || fortranOrder) {
    throw new TypeError(`Only little-endian float64 or int64 C-order .npy arrays are read; header was ${header.trim()}.`);
  }
  const count = shape.reduce((product, n) => product * n, 1);
  if (!shape.length || shape.some(n => !Number.isSafeInteger(n) || n <= 0) || dataOffset + count * 8 !== bytes.length) {
    throw new TypeError('The .npy shape does not match its data length.');
  }
  const values = new Float64Array(count);
  for (let i = 0; i < count; i++) {
    values[i] = descr === '<f8' ? bytes.readDoubleLE(dataOffset + i * 8) : Number(bytes.readBigInt64LE(dataOffset + i * 8));
  }
  return { descr, shape, values };
}

/** Evenly spaced, strictly increasing node coordinates; returns the step. */
function uniformNodes(nodes: Float64Array, label: string) {
  const step = nodes[1] - nodes[0];
  if (nodes.length < 2 || !(step > 0) || [...nodes].some((node, i) => Math.abs(node - (nodes[0] + i * step)) > 1e-9)) {
    throw new TypeError(`${label} nodes must be evenly spaced and increasing.`);
  }
  return step;
}

export interface SpinFrameTransfer {
  /** Rotation carrying a direction in the mesh body frame into the grid body frame. */
  meshToGrid: Matrix;
  report: Record<string, unknown>;
}

const multiply = (a: Matrix, b: Matrix): Matrix => [0, 1, 2].map(i => [0, 1, 2].map(j =>
  a[i][0] * b[0][j] + a[i][1] * b[1][j] + a[i][2] * b[2][j]) as [number, number, number]);
const transpose = (m: Matrix): Matrix => [0, 1, 2].map(i => [m[0][i], m[1][i], m[2][i]] as [number, number, number]);

/**
 * Both spin states give the rotation from equatorial J2000 into their body frame at a body epoch. At the same instant,
 * grid = R_grid · R_meshᵀ · mesh. Each state is evaluated in the time scale its publication uses.
 */
export function spinFrameTransfer(grid: SpinState, gridTimeOffsetDays: number, mesh: SpinState, meshTimeOffsetDays: number, epochJdUtc: number): SpinFrameTransfer {
  const gridRotation = spinOrientation(grid).rotation(epochJdUtc + gridTimeOffsetDays);
  const meshRotation = spinOrientation(mesh).rotation(epochJdUtc + meshTimeOffsetDays);
  const meshToGrid = multiply(gridRotation, transpose(meshRotation));
  // The grid-frame longitude of the mesh prime meridian, and how far the mesh pole leans in the grid frame.
  const x = meshToGrid.map(row => row[0]), z = meshToGrid.map(row => row[2]);
  return { meshToGrid, report: {
    epochJdUtc, meshPrimeMeridianGridLongitudeDegrees: Math.atan2(x[1], x[0]) * 180 / Math.PI,
    meshPoleGridColatitudeDegrees: Math.acos(Math.max(-1, Math.min(1, z[2]))) * 180 / Math.PI,
  } };
}

const spinFields = (value: unknown, label: string): SpinState => {
  const spin = requireRecord(value, label);
  return { longitudeDegrees: requireFiniteNumber(spin.longitudeDegrees, `${label}.longitudeDegrees`),
    latitudeDegrees: requireFiniteNumber(spin.latitudeDegrees, `${label}.latitudeDegrees`),
    periodHours: requireFiniteNumber(spin.periodHours, `${label}.periodHours`),
    epochJd: requireFiniteNumber(spin.epochJd, `${label}.epochJd`),
    phaseDegrees: requireFiniteNumber(spin.phaseDegrees, `${label}.phaseDegrees`) };
};
const timeOffsetDays = (scale: unknown, tdbMinusUtcSeconds: number) => {
  if (scale === 'UTC') return 0;
  if (scale === 'TDB') return tdbMinusUtcSeconds / 86400;
  throw new TypeError(`Unsupported spin time scale ${String(scale)}.`);
};

/** Read a cssearth-spin-frame-transfer@1 record and the mesh parameter file it names, which the recipe must also name. */
export async function loadSpinFrameTransfer(root: string, path: string, meshSpinPath: string) {
  const record = requireRecord(JSON.parse(await readFile(resolve(root, path), 'utf8')), path);
  if (record.schema !== 'cssearth-spin-frame-transfer@1') throw new TypeError(`${path} must use cssearth-spin-frame-transfer@1.`);
  const epoch = requireRecord(record.epoch, 'epoch'), grid = requireRecord(record.grid, 'grid'), mesh = requireRecord(record.mesh, 'mesh');
  const tdbMinusUtc = requireFiniteNumber(requireRecord(record.timeScales, 'timeScales').tdbMinusUtcSeconds, 'tdbMinusUtcSeconds');
  if (grid.convention !== 'durech-2010-equation-1' || mesh.convention !== 'durech-2010-equation-1') {
    throw new TypeError('Both spin states must state the light-curve inversion convention they follow.');
  }
  if (mesh.path !== meshSpinPath) throw new TypeError(`${path} names mesh spin ${String(mesh.path)}, not the recipe's ${meshSpinPath}.`);
  const order = requireString(mesh.order, 'mesh.order');
  if (order !== 'latitude-first' && order !== 'longitude-first') throw new TypeError('The mesh spin file order must be stated.');
  const meshSpin = parseSpinState(await readFile(resolve(root, requireString(mesh.path, 'mesh.path')), 'utf8'), order);
  return spinFrameTransfer(spinFields(grid.spin, 'grid.spin'), timeOffsetDays(grid.timeScale, tdbMinusUtc),
    meshSpin, timeOffsetDays(mesh.timeScale, tdbMinusUtc), requireFiniteNumber(epoch.jdUtc, 'epoch.jdUtc'));
}

const insideRoot = (path: string, label: string) => {
  if (!path || path.startsWith('/') || path.includes('\\') || path.split('/').includes('..')) throw new TypeError(`${label} must be inside the source directory.`);
  return path;
};

export function decodeNpyLonLatGrid({ values, longitudes, latitudes }: { values: NpyArray; longitudes: NpyArray; latitudes: NpyArray }, meshToGrid: Matrix | null) {
  const lon = longitudes.values, lat = latitudes.values;
  if (longitudes.shape.length !== 1 || latitudes.shape.length !== 1 || values.shape.length !== 2 ||
      values.shape[0] !== lat.length || values.shape[1] !== lon.length) throw new TypeError('Grid values must be latitude rows × longitude columns.');
  const lonStep = uniformNodes(lon, 'Longitude'), latStep = uniformNodes(lat, 'Latitude');
  if (lon[lon.length - 1] - lon[0] > 360 + 1e-9 || lon[lon.length - 1] - lon[0] < 360 - lonStep - 1e-9 ||
      lat[0] < -90 || lat[lat.length - 1] > 90) throw new TypeError('The grid must cover every longitude within latitudes -90 to 90.');
  const columns = lon.length, closed = lon[columns - 1] - lon[0] > 360 - lonStep / 2;
  const node = (longitude: number, latitude: number) => {
    // The nearest node owns a longitude. A grid that repeats its first meridian 360 degrees on keeps both half-cells;
    // one that stops a step short wraps its last half-cell back to the first node.
    let column = Math.round((((longitude - lon[0]) % 360 + 360) % 360) / lonStep);
    if (column > columns - 1) column = closed ? columns - 1 : 0;
    const row = Math.min(lat.length - 1, Math.max(0, Math.round((latitude - lat[0]) / latStep)));
    if (Math.abs(latitude - lat[row]) > latStep / 2 + 1e-9) return null;
    const value = values.values[row * columns + column];
    return Number.isFinite(value) ? value : null;
  };
  return {
    width: columns, height: lat.length,
    sample(longitude: number, latitude: number) {
      if (!Number.isFinite(longitude) || !Number.isFinite(latitude) || latitude < -90 || latitude > 90) return null;
      if (!meshToGrid) return node(longitude, latitude);
      const radians = Math.PI / 180, c = Math.cos(latitude * radians);
      const d = [c * Math.cos(longitude * radians), c * Math.sin(longitude * radians), Math.sin(latitude * radians)];
      const g = meshToGrid.map(row => row[0] * d[0] + row[1] * d[1] + row[2] * d[2]);
      return node(Math.atan2(g[1], g[0]) / radians, Math.asin(Math.max(-1, Math.min(1, g[2]))) / radians);
    },
  };
}

/** Load the recipe's value, node and frame files. Paths are relative to the object's source directory. */
export async function loadNpyLonLatGrid(root: string, value: unknown) {
  const lens = requireRecord(value, 'npy grid lens'), grid = requireRecord(lens.grid, 'grid');
  if (lens.sampling !== 'nearest' || grid.longitudeDirection !== 'east') {
    throw new TypeError('An .npy longitude/latitude grid is sampled at its nearest node with east-positive longitudes.');
  }
  const read = async (path: unknown, label: string) => readNpy(await readFile(resolve(root, insideRoot(requireString(path, label), label))));
  const values = await read(lens.path, 'path');
  const longitudes = await read(grid.longitudePath, 'grid.longitudePath'), latitudes = await read(grid.latitudePath, 'grid.latitudePath');
  if (values.shape[1] !== requireFiniteNumber(grid.width, 'grid.width') || values.shape[0] !== requireFiniteNumber(grid.height, 'grid.height')) {
    throw new TypeError('The .npy grid shape differs from the recipe width and height.');
  }
  const frame = lens.frameTransfer === undefined ? null : requireRecord(lens.frameTransfer, 'frameTransfer');
  const transfer = frame && await loadSpinFrameTransfer(root, insideRoot(requireString(frame.path, 'frameTransfer.path'), 'frameTransfer.path'),
    insideRoot(requireString(frame.meshSpinPath, 'frameTransfer.meshSpinPath'), 'frameTransfer.meshSpinPath'));
  const decoded = decodeNpyLonLatGrid({ values, longitudes, latitudes }, transfer?.meshToGrid ?? null);
  const finite = [...values.values].filter(Number.isFinite);
  return { ...decoded, report: { format: 'npy-lonlat-grid', grid: { width: decoded.width, height: decoded.height,
    longitudeNodes: [longitudes.values[0], longitudes.values[longitudes.values.length - 1]],
    latitudeNodes: [latitudes.values[0], latitudes.values[latitudes.values.length - 1]] },
    mappedNodes: finite.length, valueRange: [Math.min(...finite), Math.max(...finite)], sampling: 'nearest-node',
    ...(transfer ? { frameTransfer: transfer.report } : {}) } };
}

/** Paths the lens reads besides its value array, so preparation can require each to be pinned. */
export function npyLonLatGridDependencies(value: unknown) {
  const lens = requireRecord(value), grid = requireRecord(lens.grid);
  const frame = lens.frameTransfer === undefined ? null : requireRecord(lens.frameTransfer);
  return [grid.longitudePath, grid.latitudePath, ...(frame ? [frame.path, frame.meshSpinPath] : [])]
    .map(path => requireString(path));
}
