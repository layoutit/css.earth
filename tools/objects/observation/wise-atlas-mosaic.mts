/** AllWISE Atlas Images -> one background-matched TAN mosaic in DN, on a hips2fits-convention grid.
 * The atlas tiles are only background-matched within themselves (Explanatory Supplement IV.4.f),
 * so each tile keeps an unknown additive level. As Montage's mBgModel does (Berriman et al.), every
 * pair of overlapping tiles contributes the median of their difference, and one constant per tile
 * is solved by least squares with a zero-mean gauge. No pixel is interpolated: each tile pixel
 * centre lands in exactly one output pixel, whose value is the mean of what lands in it. */
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { gunzipSync } from 'node:zlib';
import { readFitsImage } from '@cssearth/fits';
import { hasErrorCode, median, requireArray, requireFiniteNumber, requireRecord, requireString } from '@cssearth/core';
import { offsetComponents, solveConstantOffsets } from './background-offsets.mts';

export const WISE_ATLAS_BANDS = { W1: { band: 1, magzp: 20.5 }, W2: { band: 2, magzp: 19.5 }, W3: { band: 3, magzp: 18 }, W4: { band: 4, magzp: 13 } } as const;
export type WiseBand = keyof typeof WISE_ATLAS_BANDS;
export const WISE_ATLAS_REFERENCE = 'https://wise2.ipac.caltech.edu/docs/release/allsky/expsup/sec4_4f.html';
export { MONTAGE_BACKGROUND_REFERENCE } from './background-offsets.mts';

export interface TilePins { readonly schema: 'cssearth-wise-atlas-tiles@1'; readonly band: WiseBand; readonly tiles: readonly { readonly coaddId: string; readonly bytes: number }[] }
export interface SkyGrid { readonly width: number; readonly height: number; readonly fovDeg: number; readonly centerIcrsDegrees: readonly [number, number] }

/** A TAN output grid as a recipe states it. CDS hips2fits refuses requests above 50 million pixels; every route keeps that limit. */
export function parseSkyGrid(value: unknown): SkyGrid {
  const grid = requireRecord(value, 'Sky band grid');
  const size = (n: unknown) => { const v = requireFiniteNumber(n, 'Grid size'); if (!Number.isSafeInteger(v) || v < 16) throw new TypeError('Invalid grid size.'); return v; };
  const width = size(grid.width), height = size(grid.height), fovDeg = requireFiniteNumber(grid.fovDeg, 'Grid field');
  const center = requireArray(grid.centerIcrsDegrees).map(n => requireFiniteNumber(n, 'Grid centre'));
  if (width * height > 50_000_000 || !(fovDeg > 0 && fovDeg < 90) || center.length !== 2 || !(center[0]! >= 0 && center[0]! < 360) || Math.abs(center[1]!) > 90)
    throw new TypeError('Invalid sky grid.');
  return { width, height, fovDeg, centerIcrsDegrees: [center[0]!, center[1]!] };
}

export function parseTilePins(value: unknown): TilePins {
  const row = requireRecord(value, 'WISE atlas tiles');
  if (row.schema !== 'cssearth-wise-atlas-tiles@1' || typeof row.band !== 'string' || !Object.hasOwn(WISE_ATLAS_BANDS, row.band)) throw new TypeError('Unsupported WISE atlas tile list.');
  const tiles = requireArray(row.tiles).map(raw => {
    const tile = requireRecord(raw, 'WISE atlas tile'), coaddId = requireString(tile.coaddId, 'coadd_id');
    const bytes = requireFiniteNumber(tile.bytes, 'Tile bytes');
    if (!/^\d{4}[pm]\d{3}_ac51$/u.test(coaddId) || !Number.isSafeInteger(bytes) || bytes < 1) throw new TypeError(`Invalid WISE atlas tile pin: ${coaddId}`);
    return { coaddId, bytes };
  });
  if (!tiles.length || new Set(tiles.map(tile => tile.coaddId)).size !== tiles.length) throw new TypeError('WISE atlas tiles must be unique and non-empty.');
  return { schema: row.schema, band: row.band as WiseBand, tiles };
}

export function wiseAtlasUrl(coaddId: string, band: WiseBand) {
  return `https://irsa.ipac.caltech.edu/ibe/data/wise/allwise/p3am_cdd/${coaddId.slice(0, 2)}/${coaddId.slice(0, 4)}/${coaddId}/${coaddId}-w${WISE_ATLAS_BANDS[band].band}-int-3.fits.gz`;
}

/** Pinned gzip bytes from `directory`, downloading only missing files. */
export async function readWiseAtlasTile(pins: TilePins, tile: TilePins['tiles'][number], directory: string): Promise<Buffer> {
  const name = `${tile.coaddId}-w${WISE_ATLAS_BANDS[pins.band].band}-int-3.fits.gz`, path = resolve(directory, name);
  let bytes = await readFile(path).catch((error: unknown) => { if (hasErrorCode(error, 'ENOENT')) return null; throw error; });
  if (bytes === null) {
    const url = wiseAtlasUrl(tile.coaddId, pins.band), response = await fetch(url, { signal: AbortSignal.timeout(900_000) });
    if (!response.ok) throw new Error(`WISE atlas download failed: ${response.status} ${url}`);
    bytes = Buffer.from(await response.arrayBuffer());
    if (bytes.length !== tile.bytes) throw new Error(`Changed WISE atlas tile: ${url}`);
    await mkdir(dirname(path), { recursive: true }); await writeFile(`${path}.part`, bytes); await rename(`${path}.part`, path);
  }
  if (bytes.length !== tile.bytes) throw new Error(`Changed WISE atlas tile: ${path}`);
  return bytes;
}

type Vec = [number, number, number];
const radians = Math.PI / 180;
const basis = (raDeg: number, decDeg: number) => {
  const a = raDeg * radians, d = decDeg * radians;
  return { centre: [Math.cos(d) * Math.cos(a), Math.cos(d) * Math.sin(a), Math.sin(d)] as Vec, east: [-Math.sin(a), Math.cos(a), 0] as Vec,
    north: [-Math.sin(d) * Math.cos(a), -Math.sin(d) * Math.sin(a), Math.cos(d)] as Vec };
};

/** The hips2fits TAN grid: CDELT is the true field angle's tangent span over the width; CRPIX is width/2, height/2 (measured). */
export function gridWcs(grid: SkyGrid) {
  const scale = 2 * Math.tan(grid.fovDeg / 2 * radians) / radians / grid.width;
  return { projection: 'TAN' as const, coordinateFrame: 'ICRS' as const, referenceDimension: [grid.width, grid.height] as [number, number],
    referencePixel: [grid.width / 2, grid.height / 2] as [number, number], referenceValueDeg: [grid.centerIcrsDegrees[0], grid.centerIcrsDegrees[1]] as [number, number],
    scaleDeg: [-scale, scale] as [number, number], rotationDeg: 0 as const };
}

/** Atlas SIN pixel (one-based FITS) -> output TAN pixel (one-based FITS), or undefined behind the tangent plane. */
export function atlasToGridPixel(tile: { crpix: [number, number]; cdelt: [number, number]; crval: [number, number] }, grid: ReturnType<typeof gridWcs>) {
  const t = basis(...tile.crval), g = basis(...grid.referenceValueDeg);
  const sx = tile.cdelt[0] * radians, sy = tile.cdelt[1] * radians, gx = grid.scaleDeg[0] * radians, gy = grid.scaleDeg[1] * radians;
  return (p: number, q: number): [number, number] | undefined => {
    const x = (p - tile.crpix[0]) * sx, y = (q - tile.crpix[1]) * sy, z = 1 - x * x - y * y;
    if (z < 0) return undefined;
    const forward = Math.sqrt(z);
    const v0 = forward * t.centre[0] + x * t.east[0] + y * t.north[0], v1 = forward * t.centre[1] + x * t.east[1] + y * t.north[1],
      v2 = forward * t.centre[2] + x * t.east[2] + y * t.north[2];
    const c = v0 * g.centre[0] + v1 * g.centre[1] + v2 * g.centre[2];
    if (c <= 0) return undefined;
    return [(v0 * g.east[0] + v1 * g.east[1] + v2 * g.east[2]) / c / gx + grid.referencePixel[0],
      (v0 * g.north[0] + v1 * g.north[1] + v2 * g.north[2]) / c / gy + grid.referencePixel[1]];
  };
}

/** ICRS direction -> one-based FITS pixel on the grid, or undefined behind its tangent plane. */
export function skyToGridPixel(grid: ReturnType<typeof gridWcs>) {
  const g = basis(...grid.referenceValueDeg), gx = grid.scaleDeg[0] * radians, gy = grid.scaleDeg[1] * radians;
  return (raDeg: number, decDeg: number): [number, number] | undefined => {
    const v = basis(raDeg, decDeg).centre, c = v[0] * g.centre[0] + v[1] * g.centre[1] + v[2] * g.centre[2];
    if (c <= 0) return undefined;
    return [(v[0] * g.east[0] + v[1] * g.east[1] + v[2] * g.east[2]) / c / gx + grid.referencePixel[0],
      (v[0] * g.north[0] + v[1] * g.north[1] + v[2] * g.north[2]) / c / gy + grid.referencePixel[1]];
  };
}

interface Binned { coaddId: string; x0: number; y0: number; width: number; height: number; sum: Float64Array; count: Uint32Array }

/** One tile's pixel centres binned into the output grid (DOM rows, top first). */
export function binWiseAtlasTile(gzipBytes: Buffer, pins: TilePins, coaddId: string, grid: SkyGrid): Binned | undefined {
  const image = readFitsImage(gunzipSync(gzipBytes), { maxDecodedBytes: 256 * 1024 ** 2 }), h = image.header;
  if (h.BUNIT !== 'DN' || h.CTYPE1 !== 'RA---SIN' || h.CTYPE2 !== 'DEC--SIN' || h.COADDID !== coaddId || h.MAGZP !== WISE_ATLAS_BANDS[pins.band].magzp ||
      (h.CROTA2 !== undefined && h.CROTA2 !== 0) || h.EQUINOX !== 2000 || Object.keys(h).some(key => /^(?:CD\d_\d|PC\d_\d|PV\d_\d+)$/u.test(key)))
    throw new Error(`${coaddId}: unexpected WISE atlas header.`);
  const wcs = gridWcs(grid), map = atlasToGridPixel({ crpix: [Number(h.CRPIX1), Number(h.CRPIX2)], cdelt: [Number(h.CDELT1), Number(h.CDELT2)],
    crval: [Number(h.CRVAL1), Number(h.CRVAL2)] }, wcs);
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  const columns = new Int32Array(image.width * image.height), rows = new Int32Array(image.width * image.height).fill(-1);
  for (let q = 0; q < image.height; q++) for (let p = 0; p < image.width; p++) {
    const index = q * image.width + p, value = image.values[index]!;
    if (!Number.isFinite(value)) continue;
    const pixel = map(p + 1, q + 1);
    if (!pixel) continue;
    const column = Math.round(pixel[0]) - 1, fitsRow = Math.round(pixel[1]) - 1;
    if (column < 0 || column >= grid.width || fitsRow < 0 || fitsRow >= grid.height) continue;
    const row = grid.height - 1 - fitsRow;
    columns[index] = column; rows[index] = row;
    if (column < minX) minX = column; if (column > maxX) maxX = column; if (row < minY) minY = row; if (row > maxY) maxY = row;
  }
  if (minX === Infinity) return undefined;
  const width = maxX - minX + 1, height = maxY - minY + 1, sum = new Float64Array(width * height), count = new Uint32Array(width * height);
  for (let index = 0; index < rows.length; index++) {
    if (rows[index]! < 0) continue;
    const cell = (rows[index]! - minY) * width + columns[index]! - minX;
    sum[cell] += image.values[index]!; count[cell]++;
  }
  return { coaddId, x0: minX, y0: minY, width, height, sum, count };
}

/** Montage-style constant offsets: minimize sum over overlaps of n_ij (o_i - o_j - d_ij)^2 with sum o = 0. */
export function matchTileBackgrounds(tiles: readonly Binned[], minimumOverlap = 200): { tiles: readonly Binned[]; offsets: Float64Array; pairs: number; sweeps: number; medianPairStepBefore: number; medianPairStepAfter: number; excluded: { coaddId: string; pixels: number; reason: string }[] } {
  const pairs: { i: number; j: number; difference: number; pixels: number }[] = [];
  for (let i = 0; i < tiles.length; i++) for (let j = i + 1; j < tiles.length; j++) {
    const a = tiles[i]!, b = tiles[j]!, left = Math.max(a.x0, b.x0), right = Math.min(a.x0 + a.width, b.x0 + b.width);
    const top = Math.max(a.y0, b.y0), bottom = Math.min(a.y0 + a.height, b.y0 + b.height);
    if (left >= right || top >= bottom) continue;
    const differences: number[] = [];
    for (let y = top; y < bottom; y++) for (let x = left; x < right; x++) {
      const ca = (y - a.y0) * a.width + x - a.x0, cb = (y - b.y0) * b.width + x - b.x0;
      if (a.count[ca]! && b.count[cb]!) differences.push(a.sum[ca]! / a.count[ca]! - b.sum[cb]! / b.count[cb]!);
    }
    if (differences.length >= minimumOverlap) pairs.push({ i, j, pixels: differences.length, difference: median(differences) });
  }
  const n = tiles.length;
  const component = offsetComponents(n, pairs), sizes: number[] = [];
  for (const label of component) sizes[label!] = (sizes[label!] ?? 0) + 1;
  if (sizes.length > 1) {
    // A grid-edge sliver can overlap its neighbours by too few pixels to fix its level. Such a tile is left out
    // only when every output pixel it covers is also covered by the joined group, so it adds no sky, only an
    // unconstrained level. Any tile with sky of its own keeps the refusal.
    const kept = sizes.indexOf(Math.max(...sizes)), covered = new Set<number>();
    tiles.forEach((tile, t) => { if (component[t] === kept) forEachPixel(tile, pixel => covered.add(pixel)); });
    const outside = tiles.filter((_, t) => component[t] !== kept);
    if (outside.some(tile => { let own = false; forEachPixel(tile, pixel => { if (!covered.has(pixel)) own = true; }); return own; }))
      throw new Error(`WISE atlas tiles form disconnected overlap groups: ${outside.map(tile => tile.coaddId).join(', ')} share no chain of overlaps with ${tiles.find((_, t) => component[t] === kept)!.coaddId}.`);
    const solved = matchTileBackgrounds(tiles.filter((_, t) => component[t] === kept), minimumOverlap);
    return { ...solved, excluded: outside.map(tile => { let pixels = 0; forEachPixel(tile, () => pixels++); return { coaddId: tile.coaddId, pixels, reason: 'no qualifying overlap; every covered pixel is also covered by the joined tiles' }; }) };
  }
  return { tiles, ...solveConstantOffsets(n, pairs), excluded: [] as { coaddId: string; pixels: number; reason: string }[] };
}
/** A unique key (row * 1e6 + column) for every output cell a tile observed; grids stay below 1e6 columns. */
function forEachPixel(tile: Binned, visit: (pixel: number) => void) {
  for (let y = 0; y < tile.height; y++) for (let x = 0; x < tile.width; x++) if (tile.count[y * tile.width + x]) visit((tile.y0 + y) * 1_000_000 + tile.x0 + x);
}

/** Mean of every tile after subtracting its fitted level; DOM rows; NaN where no tile lands. */
export function mosaicTiles(tiles: readonly Binned[], offsets: Float64Array, grid: SkyGrid): Float32Array {
  const sum = new Float64Array(grid.width * grid.height), count = new Uint32Array(grid.width * grid.height);
  tiles.forEach((tile, t) => {
    for (let y = 0; y < tile.height; y++) for (let x = 0; x < tile.width; x++) {
      const cell = y * tile.width + x, n = tile.count[cell]!;
      if (!n) continue;
      const pixel = (tile.y0 + y) * grid.width + tile.x0 + x;
      sum[pixel] += tile.sum[cell]! - n * offsets[t]!; count[pixel] += n;
    }
  });
  return Float32Array.from(sum, (value, pixel) => count[pixel] ? value / count[pixel]! : NaN);
}
