import { preparedBankColumn, type PreparedBank } from '../../prepared-bank.js';
import { parseDensityVolumeFrame, type DensityVolumeFrame } from '../../density-volume.js';

/**
 * Cloud points (`cssearth-cloud-points@1`): a diffuse medium (an object's gas and dust) as billboards. The bake groups
 * the medium's dots into compact clusters and draws each cluster once, as seen from Earth, into a cell of one atlas
 * beside the bank; a billboard faces the camera at its cluster's centre, as wide as its cluster, and is dimmed where
 * the object's body (its occluder: ellipsoids fitted at bake time) stands between it and the eye. A bank at
 * `prepared/<id>.bin` beside an image-layer bank (`properties.cloudPoints`).
 */
export const PREPARED_CLOUD_POINTS_SCHEMA = 'cssearth-cloud-points@1';
/** An ellipsoid in the bank's units: its centre and its three semi-axes as vectors (each axis's direction and length). */
export interface CloudPointEllipsoid { readonly centreUnits: readonly [number, number, number]; readonly axesUnits: readonly (readonly [number, number, number])[] }
export interface PreparedCloudPoints {
  readonly id: string;
  readonly frame: DensityVolumeFrame;
  readonly count: number;
  /** Each billboard's centre x, y and z, in the bank's units. */
  readonly positions: Float64Array;
  /** Each billboard's width, in the bank's units. */
  readonly diameters: Float32Array;
  /** Each billboard's atlas cell: its left and top texel. */
  readonly cells: Uint16Array;
  /** The atlas (a prepared file beside the bank) and the side of its square cells, in texels. */
  readonly atlas: string;
  readonly cellTexels: number;
  /** The body that hides what is behind it: none, or its ellipsoids. */
  readonly occluder: readonly CloudPointEllipsoid[];
}

export function encodeCloudPoints(cloud: PreparedCloudPoints): PreparedBank {
  return { schema: PREPARED_CLOUD_POINTS_SCHEMA, fields: { id: cloud.id, frame: cloud.frame, count: cloud.count, atlas: cloud.atlas, cellTexels: cloud.cellTexels, occluder: cloud.occluder },
    columns: { position: cloud.positions, diameter: cloud.diameters, cell: cloud.cells } };
}

const vector = (value: unknown): value is [number, number, number] => Array.isArray(value) && value.length === 3 && value.every(Number.isFinite);

/** A fetched bank, checked: its frame, a finite place and a positive size for every billboard, and well-formed ellipsoids. */
export function readCloudPoints(bank: PreparedBank, at = 'cloud points'): PreparedCloudPoints {
  if (bank.schema !== PREPARED_CLOUD_POINTS_SCHEMA) throw new TypeError(`${at}: expected ${PREPARED_CLOUD_POINTS_SCHEMA}, got ${bank.schema}.`);
  const { id, frame, count, atlas, cellTexels, occluder } = bank.fields as { id?: unknown; frame?: unknown; count?: unknown; atlas?: unknown; cellTexels?: unknown; occluder?: unknown };
  if (typeof id !== 'string' || !/^[a-z][a-z0-9-]*$/u.test(id)) throw new TypeError(`${at}: its id is a bank id, got ${JSON.stringify(id ?? null)}.`);
  if (!Number.isSafeInteger(count) || (count as number) < 0) throw new TypeError(`${at}: count is a count, got ${JSON.stringify(count ?? null)}.`);
  if (typeof atlas !== 'string' || !/^[a-z0-9][a-z0-9.-]*$/u.test(atlas)) throw new TypeError(`${at}: atlas is a prepared file name, got ${JSON.stringify(atlas ?? null)}.`);
  if (!Number.isSafeInteger(cellTexels) || (cellTexels as number) < 1) throw new TypeError(`${at}: cellTexels is a texel count, got ${JSON.stringify(cellTexels ?? null)}.`);
  const n = count as number, positions = preparedBankColumn(bank, 'position', 'f64', n * 3, at) as Float64Array;
  const diameters = preparedBankColumn(bank, 'diameter', 'f32', n, at) as Float32Array, cells = preparedBankColumn(bank, 'cell', 'u16', n * 2, at) as Uint16Array;
  if (positions.some(value => !Number.isFinite(value))) throw new TypeError(`${at}: every billboard has a finite place.`);
  if (diameters.some(value => !(value > 0) || !Number.isFinite(value))) throw new TypeError(`${at}: every billboard has a positive width.`);
  if (!Array.isArray(occluder) || !occluder.every(e => e && typeof e === 'object' && vector((e as CloudPointEllipsoid).centreUnits) &&
    Array.isArray((e as CloudPointEllipsoid).axesUnits) && (e as CloudPointEllipsoid).axesUnits.length === 3 && (e as CloudPointEllipsoid).axesUnits.every(vector)))
    throw new TypeError(`${at}: occluder is a list of ellipsoids, each a centre and three axes.`);
  return { id, frame: parseDensityVolumeFrame(frame), count: n, positions, diameters, cells, atlas, cellTexels: cellTexels as number, occluder: occluder as CloudPointEllipsoid[] };
}
