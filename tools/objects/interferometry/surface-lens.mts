#!/usr/bin/env node
/** Cast a sphere reconstruction onto a lens map: ROTIR's surface grid becomes an equirectangular map in the body longitudes the
 * planet route draws, written as the float32 FITS image map the `terrestrial-scientific` science kind reads (as Pluto's LEISA
 * maps are).
 *
 *   node tools/objects/interferometry/surface-lens.mts <surface-grid.fits> <out-map.fits> [--width 720] [--height 360] [--maximum-emission 70]
 *
 * Body coordinates are the display-orientation frame of a star without a measured axis, the frame a computed camera casts a
 * sky-plane reconstruction into: +z the display axis (celestial north in the plane of the sky), +x toward the observer at the
 * epoch, +y toward the image's west, and east longitude atan2(y, x). ROTIR, with inclination 90 and position angle 0, puts the
 * pole North, longitude 0 on the West limb and 270 at the disc centre, right-handed. So ROTIR longitude = body longitude − 90
 * and colatitude = 90 − latitude. surface-lens.test.mts measures that through the production camera against ROTIR's own sky
 * projection; the mirrored mapping fits worse.
 *
 * Cells the observer never saw, and cells beyond the maximum emission angle, are NaN: the image map reads them as no data. The
 * lens recipe states `outputLongitudeOrigin: 0`: east longitude grows from 0 at the left edge, as the mesh places every atlas, so
 * this lens and a camera-cast lens put body longitude 0 in the same raster column. */
import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { readFitsImage } from '@cssearth/fits';
import { headerBlock, padBlock, primaryHdu } from './fits-table.mts';

const DEGREE = Math.PI / 180;

export interface SurfaceGrid { readonly columns: number; readonly rows: number; readonly values: ArrayLike<number> }

/** surface.jl's grid: row r (from 0) is colatitude (r + 1/2) * 180 / rows from the pole, column c ROTIR longitude (c + 1/2) * 360 / columns. */
export function readSurfaceGrid(bytes: Buffer): SurfaceGrid {
  const image = readFitsImage(bytes);
  if (image.header.CTYPE1 !== 'ROTIR-LONGITUDE' || image.header.CTYPE2 !== 'ROTIR-COLATITUDE' || image.header.ROWORDER !== 'pole-first') throw new TypeError('Not a ROTIR surface grid written by surface.jl.');
  return { columns: image.width, rows: image.height, values: image.values };
}

/** The grid value nearest ROTIR colatitude and longitude, in degrees. */
export function sampleSurfaceGrid(grid: SurfaceGrid, colatitudeDegrees: number, longitudeDegrees: number) {
  const row = Math.min(grid.rows - 1, Math.max(0, Math.floor(colatitudeDegrees / 180 * grid.rows)));
  const column = Math.floor(((longitudeDegrees % 360) + 360) % 360 / 360 * grid.columns) % grid.columns;
  return Number(grid.values[row * grid.columns + column]);
}

export interface LensMapOptions { readonly width: number; readonly height: number; readonly maximumEmissionDegrees?: number; readonly mirror?: boolean }

/** The lens map: rows north to south, column x at body east longitude (x + 1/2) * 360 / width. `mirror` flips the longitude
 * sense; it exists only so the test can show that the mirrored cast fits the sky worse. */
export function surfaceLensMap(grid: SurfaceGrid, { width, height, maximumEmissionDegrees = 70, mirror = false }: LensMapOptions) {
  const map = new Float32Array(width * height), minimumCosine = Math.cos(maximumEmissionDegrees * DEGREE);
  for (let y = 0; y < height; y++) {
    const latitude = 90 - (y + 0.5) * 180 / height;
    for (let x = 0; x < width; x++) {
      const longitude = (x + 0.5) * 360 / width;
      const cosine = Math.cos(latitude * DEGREE) * Math.cos(longitude * DEGREE);
      map[y * width + x] = cosine < minimumCosine ? Number.NaN : sampleSurfaceGrid(grid, 90 - latitude, (mirror ? -longitude : longitude) - 90);
    }
  }
  return map;
}

/** A float32 image map in the layout fits-image-map.mts reads: an empty primary with identity keywords and one IMAGE extension. */
export function writeFitsImageMap(map: Float32Array, width: number, height: number, { name, units, identity }: { name: string; units: string; identity: Readonly<Record<string, string>> }) {
  if (map.length !== width * height) throw new RangeError('The map does not match its size.');
  const data = Buffer.alloc(map.length * 4);
  for (let i = 0; i < map.length; i++) data.writeFloatBE(map[i]!, i * 4);
  const extension = headerBlock([['XTENSION', 'IMAGE', 'image extension'], ['BITPIX', -32], ['NAXIS', 2], ['NAXIS1', width], ['NAXIS2', height], ['PCOUNT', 0], ['GCOUNT', 1],
    ['EXTNAME', name], ['UNITS', units]]);
  return Buffer.concat([primaryHdu(Object.entries(identity).map(([key, value]) => [key, value] as const)), extension, padBlock(data)]);
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const [input, output, ...rest] = process.argv.slice(2);
  const option = (name: string, fallback: number) => { const index = rest.indexOf(name); return index < 0 ? fallback : Number(rest[index + 1]); };
  if (!input || !output) throw new TypeError('Usage: surface-lens <surface-grid.fits> <out-map.fits> [--width 720] [--height 360] [--maximum-emission 70]');
  const width = option('--width', 720), height = option('--height', 360);
  const map = surfaceLensMap(readSurfaceGrid(await readFile(input)), { width, height, maximumEmissionDegrees: option('--maximum-emission', 70) });
  await writeFile(output, writeFitsImageMap(map, width, height, { name: 'SURFACE BRIGHTNESS', units: 'relative', identity: { ORIGIN: 'cssEarth surface-lens.mts', CONTENT: 'ROTIR surface map' } }));
  console.log(`${output}: ${width} x ${height} lens map, ${map.filter(Number.isFinite).length} observed cells.`);
}
