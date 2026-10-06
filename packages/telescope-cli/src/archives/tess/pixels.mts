/** TESS full-frame image pixels at a star's place, read through MAST's TESScut service.
 *
 * TESS images its whole field every 30 minutes (sectors 1 to 26), 10 minutes (27 to 55) or 200 seconds (from 56). The mission
 * publishes light curves for the stars it was asked to watch; the full-frame images hold every other star too. TESScut cuts
 * the same pixels out of every image of a sector at one place on the sky, so a star's light is measured from the pixels and
 * not taken from a light curve somebody else made.
 *
 * Two calls, both public and anonymous:
 *   - `sector?ra=&dec=&radius=0m`: the sectors, cameras and detectors that imaged a place;
 *   - `astrocut?ra=&dec=&y=&x=&sector=`: a zip of one FITS cube, the cutout's pixels in every image of the sector.
 *
 * The service answers 429 to requests sent side by side: they go one at a time, PACE_MS apart, and a 429 is waited out.
 * These are the mission's calibrated frames. The frames before detector calibration are public too, with a published
 * calibrator (TICA, Fausnaugh et al. 2020), but that route works on whole detectors, not on a cutout. */
import { mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { inflateRawSync } from 'node:zlib';
import { isRecord } from '@cssearth/core';

export const TESSCUT = 'https://mast.stsci.edu/tesscut/api/v0.1';
export const USER_AGENT = 'cssEarth-telescope/1.0 (https://css.earth)';
/** The pause between two requests, and the wait after the service asks for one. */
export const PACE_MS = 400, BACK_OFF_MS = 30_000;
/** The side of a cutout, pixels (21 arcseconds each): the star's light and enough sky around it to measure the sky. */
export const CUTOUT_PIXELS = 11;

export interface ImagedSector { readonly sector: number; readonly camera: number; readonly ccd: number }
/** One sector's pixels at one place, as a program pins them: the request that made the file and its size. */
export interface PixelCutout { readonly sector: number; readonly raDegrees: number; readonly decDegrees: number; readonly pixels: number; readonly url: string; readonly file: string; readonly bytes: number }

/** The service's sector list, as the sectors that imaged the place, oldest first. */
export function parseSectors(body: unknown): ImagedSector[] {
  if (!isRecord(body) || !Array.isArray(body.results)) throw new TypeError('TESScut did not answer with a sector list.');
  return body.results.map(row => { if (!isRecord(row)) throw new TypeError('TESScut listed a sector that is not a record.'); const sector = Number(row.sector), camera = Number(row.camera), ccd = Number(row.ccd);
    if (![sector, camera, ccd].every(value => Number.isInteger(value) && value > 0)) throw new TypeError(`TESScut listed sector ${String(row.sector)}, camera ${String(row.camera)}, detector ${String(row.ccd)}.`);
    return { sector, camera, ccd }; }).sort((a, b) => a.sector - b.sector);
}

/** The time between two images of a sector, minutes. */
export const cadenceMinutes = (sector: number) => sector <= 26 ? 30 : sector <= 55 ? 10 : 200 / 60;
export const cutoutUrl = (raDegrees: number, decDegrees: number, sector: number, pixels = CUTOUT_PIXELS) => `${TESSCUT}/astrocut?ra=${raDegrees}&dec=${decDegrees}&y=${pixels}&x=${pixels}&sector=${sector}`;

/** The one file of a zip archive, without a zip library: the first local header, stored or deflated. */
export function onlyZipMember(zip: Buffer): { readonly name: string; readonly bytes: Buffer } {
  if (zip.length < 30 || zip.readUInt32LE(0) !== 0x04034b50) throw new TypeError('TESScut did not answer with a zip archive.');
  const method = zip.readUInt16LE(8), flags = zip.readUInt16LE(6), nameLength = zip.readUInt16LE(26), extraLength = zip.readUInt16LE(28), start = 30 + nameLength + extraLength, name = zip.toString('utf8', 30, 30 + nameLength);
  // The sizes are in the header unless bit 3 says they follow the data; the central directory, at the end, always has them.
  let size = zip.readUInt32LE(18);
  if (flags & 8 || size === 0) { const central = zip.lastIndexOf(Buffer.from([0x50, 0x4b, 0x01, 0x02])); if (central < 0) throw new TypeError('The zip archive has no central directory.'); size = zip.readUInt32LE(central + 20); }
  const data = zip.subarray(start, start + size);
  if (method === 0) return { name, bytes: Buffer.from(data) };
  if (method === 8) return { name, bytes: inflateRawSync(data) };
  throw new TypeError(`The zip archive packs ${name} with method ${method}.`);
}

let last = 0;
/** One request to MAST, after the pace and through every 429: TESScut, and the Kepler and K2 files of archives/kepler. */
export async function paced(url: string, init: RequestInit = {}): Promise<Response> {
  for (;;) { const wait = last + PACE_MS - Date.now(); if (wait > 0) await new Promise(done => setTimeout(done, wait));
    const response = await fetch(url, { ...init, headers: { 'User-Agent': USER_AGENT, ...init.headers as Record<string, string> | undefined }, redirect: 'follow', signal: AbortSignal.timeout(600_000) }); last = Date.now();
    if (response.status !== 429) return response;
    await new Promise(done => setTimeout(done, BACK_OFF_MS)); }
}

/** The sectors that imaged a place. */
export async function sectorsAt(raDegrees: number, decDegrees: number): Promise<ImagedSector[]> {
  if (![raDegrees, decDegrees].every(Number.isFinite) || Math.abs(decDegrees) > 90) throw new RangeError('A place needs a right ascension and a declination in degrees.');
  const response = await paced(`${TESSCUT}/sector?ra=${raDegrees}&dec=${decDegrees}&radius=0m`);
  if (!response.ok) throw new Error(`TESScut answered ${response.status} for the sectors at ${raDegrees}, ${decDegrees}.`);
  return parseSectors(await response.json());
}

/** One sector's pixels at a place, written under `directory` as the FITS cube the service cut; a file already there at a
 * pinned size is kept. */
export async function fetchCutout(raDegrees: number, decDegrees: number, sector: number, directory: string, pinnedBytes?: number, pixels = CUTOUT_PIXELS): Promise<PixelCutout> {
  const url = cutoutUrl(raDegrees, decDegrees, sector, pixels), file = resolve(directory, `tess-s${String(sector).padStart(4, '0')}-${raDegrees.toFixed(5)}_${decDegrees.toFixed(5)}_${pixels}x${pixels}.fits`);
  const held = await stat(file).then(info => info.size, () => -1);
  if (held > 0 && (pinnedBytes === undefined || held === pinnedBytes)) return { sector, raDegrees, decDegrees, pixels, url, file, bytes: held };
  const response = await paced(url);
  if (!response.ok) throw new Error(`TESScut answered ${response.status} for sector ${sector} at ${raDegrees}, ${decDegrees}.`);
  const { bytes } = onlyZipMember(Buffer.from(await response.arrayBuffer()));
  if (pinnedBytes !== undefined && bytes.length !== pinnedBytes) throw new Error(`Sector ${sector} at ${raDegrees}, ${decDegrees} is ${bytes.length} bytes, not its pinned ${pinnedBytes}: the archive cut it anew.`);
  await mkdir(directory, { recursive: true }); await writeFile(file, bytes);
  return { sector, raDegrees, decDegrees, pixels, url, file, bytes: bytes.length };
}

/** A cutout already on disk, as bytes. */
export const readCutout = (cutout: Pick<PixelCutout, 'file'>) => readFile(cutout.file);
