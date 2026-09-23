/** A surface map deposited as a HEALPix array: an .npy vector of 12 NSIDE^2 values in RING or NESTED order, one per pixel.
 *
 * - `healpix-npy-map`: `path` names the vector, `ordering` its pixel order, and `transform` what is drawn: `value` the numbers as
 *   deposited, `sqrt` their square root (a posterior variance drawn as its standard deviation).
 *
 * The map is drawn pixel by pixel, as the HEALPix plots of the papers draw it: every point shows the value of the pixel that
 * contains it. astropy-healpix, in the pinned astronomy toolchain, owns the pixel geometry (lonlat_to_healpix); cssEarth passes it
 * the longitudes and latitudes of a fine sampling grid and keeps the pixel index of each. HEALPix colatitude theta and azimuth phi
 * are latitude 90 - theta and longitude phi; the lens record says why phi is east longitude for its map. */
import { spawnSync } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { requireArray, requireFiniteNumber, requireRecord, requireString } from '../../sources/source-values.mts';
import { astroqueryToolchainSync } from '../astronomy-packages/toolchain.mts';
import { readNpy } from './npy-lonlat-grid.mts';

/** Grid step, in degrees, at which the pixel index is looked up; a point takes the index of its nearest grid node. */
const STEP = 0.125;

const PYTHON = String.raw`
import json, sys
import numpy as np
import astropy.units as u
import astropy_healpix
r = json.load(sys.stdin)
hp = astropy_healpix.HEALPix(nside=int(r['nside']), order=r['ordering'])
lon = np.arange(int(r['columns'])) * float(r['step']) - 180.0
lat = np.arange(int(r['rows'])) * float(r['step']) - 90.0
la, lo = np.meshgrid(lat, lon, indexing='ij')
index = hp.lonlat_to_healpix(lo.ravel() * u.deg, la.ravel() * u.deg)
json.dump({'astropyHealpix': astropy_healpix.__version__, 'npix': int(hp.npix), 'index': index.astype(int).tolist()}, sys.stdout)
`;

/** The HEALPix pixel of every node of a STEP-degree grid, rows from latitude -90 and columns from longitude -180, both inclusive. */
export function healpixIndexGrid(nside: number, ordering: 'ring' | 'nested') {
  const toolchain = astroqueryToolchainSync(), rows = Math.round(180 / STEP) + 1, columns = Math.round(360 / STEP) + 1;
  const result = spawnSync(toolchain.python, ['-c', PYTHON], { env: { ...process.env, ...toolchain.env }, encoding: 'utf8', maxBuffer: 512 * 1024 * 1024,
    input: JSON.stringify({ nside, ordering, rows, columns, step: STEP }) });
  if (result.status !== 0) throw new Error(`astropy-healpix pixel lookup failed (status ${result.status}): ${(result.stderr ?? '').slice(-2000)}`);
  const answer = requireRecord(JSON.parse(result.stdout) as unknown, 'astropy-healpix answer');
  const index = Int32Array.from(requireArray(answer.index, 'HEALPix index'), value => requireFiniteNumber(value, 'HEALPix pixel'));
  if (index.length !== rows * columns) throw new Error(`astropy-healpix returned ${index.length} pixels for a ${rows} x ${columns} grid.`);
  return { index, rows, columns, npix: requireFiniteNumber(answer.npix, 'npix'), astropyHealpix: requireString(answer.astropyHealpix, 'astropy-healpix version') };
}

export async function loadHealpixNpyMap(root: string, value: unknown) {
  const lens = requireRecord(value, 'HEALPix map lens'), path = requireString(lens.path, 'path');
  if (path.startsWith('/') || path.includes('\\') || path.split('/').includes('..')) throw new TypeError(`${path}: a HEALPix map must be inside the source directory.`);
  const ordering = requireString(lens.ordering, 'ordering'), transform = requireString(lens.transform, 'transform');
  if (ordering !== 'ring' && ordering !== 'nested') throw new TypeError(`${path}: HEALPix ordering is ring or nested, not ${ordering}.`);
  if (transform !== 'value' && transform !== 'sqrt') throw new TypeError(`${path}: a HEALPix map is drawn as its value or its sqrt, not ${transform}.`);
  const array = readNpy(await readFile(resolve(root, path)));
  if (array.shape.length !== 1) throw new TypeError(`${path}: a HEALPix map is one vector, not shape ${array.shape.join(' x ')}.`);
  const nside = Math.round(Math.sqrt(array.values.length / 12));
  if (nside < 1 || 12 * nside * nside !== array.values.length || (nside & (nside - 1)) !== 0) throw new TypeError(`${path}: ${array.values.length} values are not 12 NSIDE^2 for a power-of-two NSIDE.`);
  const values = array.values.map(v => {
    if (!Number.isFinite(v)) throw new TypeError(`${path}: a HEALPix value is not finite.`);
    if (transform === 'sqrt' && v < 0) throw new TypeError(`${path}: a variance of ${v} has no square root.`);
    return transform === 'sqrt' ? Math.sqrt(v) : v;
  });
  const grid = healpixIndexGrid(nside, ordering);
  if (grid.npix !== values.length) throw new Error(`${path}: astropy-healpix has ${grid.npix} pixels for NSIDE ${nside}, the map ${values.length}.`);
  let minimum = Infinity, maximum = -Infinity;
  for (const v of values) { minimum = Math.min(minimum, v); maximum = Math.max(maximum, v); }
  return {
    sample(longitude: number, latitude: number) {
      if (!Number.isFinite(longitude) || !Number.isFinite(latitude) || latitude < -90 || latitude > 90) return null;
      const lon = ((longitude + 180) % 360 + 360) % 360;
      const row = Math.round((latitude + 90) / STEP), column = Math.round(lon / STEP) % (grid.columns - 1);
      return values[grid.index[row * grid.columns + column]!]!;
    },
    report: { format: 'healpix-npy-map', nside, ordering, pixels: values.length, transform, astropyHealpix: grid.astropyHealpix, minimum, maximum },
  };
}
