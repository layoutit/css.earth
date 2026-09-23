/** A surface map deposited as a HEALPix array: an .npy vector of 12 NSIDE^2 values in RING or NESTED order, one per pixel.
 *
 * - `healpix-npy-map`: `path` names the vector, `ordering` its pixel order, `transform` what is drawn (`value` the numbers as
 *   deposited, `sqrt` their square root: a posterior variance drawn as its standard deviation) and `interpolation` how points
 *   between pixel centres are drawn:
 *   - `pixel`: every point shows the value of the pixel that contains it, as healpy's default plots draw a map;
 *   - `bilinear`: astropy-healpix's interpolate_bilinear_lonlat between the four nearest pixel centres. Every pixel centre keeps
 *     its deposited value and no point goes beyond its neighbours, so the pixel grid's edges go without inventing structure or
 *     lowering contrast, as a blur would.
 *
 * astropy-healpix, in the pinned astronomy toolchain, owns the pixel geometry and the interpolation; cssEarth passes it the
 * longitudes and latitudes of a fine sampling grid once and reads the grid back. HEALPix colatitude theta and azimuth phi are
 * latitude 90 - theta and longitude phi; the lens record says why phi is east longitude for its map. */
import { spawnSync } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { requireArray, requireFiniteNumber, requireRecord, requireString } from '../../sources/source-values.mts';
import { astroqueryToolchainSync } from '../astronomy-packages/toolchain.mts';
import { readNpy } from './npy-lonlat-grid.mts';

/** Grid step, in degrees, at which the map is looked up; a point takes its nearest grid node. */
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
# Longitudes wrapped into [0, 360): astropy-healpix 1.1.3 returns NaN weights at exactly -180.
lo, la = np.mod(lo.ravel(), 360.0) * u.deg, la.ravel() * u.deg
answer = {'astropyHealpix': astropy_healpix.__version__, 'npix': int(hp.npix)}
if r['interpolation'] == 'pixel': answer['index'] = hp.lonlat_to_healpix(lo, la).astype(int).tolist()
else: answer['values'] = hp.interpolate_bilinear_lonlat(lo, la, np.asarray(r['values'], dtype=float)).tolist()
json.dump(answer, sys.stdout)
`;

/** The map on a STEP-degree grid, rows from latitude -90 and columns from longitude -180, both inclusive: the value of the pixel
 * containing each node, or astropy-healpix's bilinear interpolation between pixel centres there. */
export function healpixGrid(values: readonly number[], nside: number, ordering: 'ring' | 'nested', interpolation: 'pixel' | 'bilinear') {
  const toolchain = astroqueryToolchainSync(), rows = Math.round(180 / STEP) + 1, columns = Math.round(360 / STEP) + 1;
  const result = spawnSync(toolchain.python, ['-c', PYTHON], { env: { ...process.env, ...toolchain.env }, encoding: 'utf8', maxBuffer: 1024 * 1024 * 1024,
    input: JSON.stringify({ nside, ordering, rows, columns, step: STEP, interpolation, values: interpolation === 'bilinear' ? values : [] }) });
  if (result.status !== 0) throw new Error(`astropy-healpix failed (status ${result.status}): ${(result.stderr ?? '').slice(-2000)}`);
  const answer = requireRecord(JSON.parse(result.stdout) as unknown, 'astropy-healpix answer');
  const npix = requireFiniteNumber(answer.npix, 'npix');
  if (npix !== values.length) throw new Error(`astropy-healpix has ${npix} pixels for NSIDE ${nside}, the map ${values.length}.`);
  const grid = interpolation === 'pixel'
    ? Float64Array.from(requireArray(answer.index, 'HEALPix index'), value => values[requireFiniteNumber(value, 'HEALPix pixel')]!)
    : Float64Array.from(requireArray(answer.values, 'HEALPix values'), value => requireFiniteNumber(value, 'HEALPix value'));
  if (grid.length !== rows * columns) throw new Error(`astropy-healpix returned ${grid.length} values for a ${rows} x ${columns} grid.`);
  return { grid, rows, columns, astropyHealpix: requireString(answer.astropyHealpix, 'astropy-healpix version') };
}

export async function loadHealpixNpyMap(root: string, value: unknown) {
  const lens = requireRecord(value, 'HEALPix map lens'), path = requireString(lens.path, 'path');
  if (path.startsWith('/') || path.includes('\\') || path.split('/').includes('..')) throw new TypeError(`${path}: a HEALPix map must be inside the source directory.`);
  const ordering = requireString(lens.ordering, 'ordering'), transform = requireString(lens.transform, 'transform'), interpolation = requireString(lens.interpolation, 'interpolation');
  if (interpolation !== 'pixel' && interpolation !== 'bilinear') throw new TypeError(`${path}: HEALPix interpolation is pixel or bilinear, not ${interpolation}.`);
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
  const grid = healpixGrid(Array.from(values), nside, ordering, interpolation);
  let minimum = Infinity, maximum = -Infinity;
  for (const v of values) { minimum = Math.min(minimum, v); maximum = Math.max(maximum, v); }
  return {
    sample(longitude: number, latitude: number) {
      if (!Number.isFinite(longitude) || !Number.isFinite(latitude) || latitude < -90 || latitude > 90) return null;
      const lon = ((longitude + 180) % 360 + 360) % 360;
      const row = Math.round((latitude + 90) / STEP), column = Math.round(lon / STEP) % (grid.columns - 1);
      return grid.grid[row * grid.columns + column]!;
    },
    report: { format: 'healpix-npy-map', nside, ordering, pixels: values.length, transform, interpolation, astropyHealpix: grid.astropyHealpix, minimum, maximum },
  };
}
