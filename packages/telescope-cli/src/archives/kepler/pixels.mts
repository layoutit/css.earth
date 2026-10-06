/** Kepler and K2 target pixel files at a star's place, read through MAST.
 *
 * Kepler watched one field for four years and K2 a field along the ecliptic for some eighty days at a time, both with
 * pixels 4 arcseconds wide and an image every 30 minutes. For a star they observed, the mission keeps the pixels around it
 * as one file a quarter (Kepler) or a campaign (K2). Against TESS's 27 days and 21-arcsecond pixels, a slow rotator turns
 * several times in one file and a neighbour seldom shares the pixels.
 *
 * Two calls to MAST's archive, public and anonymous, sent through the pace archives/tess keeps for the same host:
 *   - `Mast.Caom.Filtered.Position`: the Kepler and K2 time series at a place;
 *   - `Mast.Caom.Products`: an observation's files, of which the long-cadence target pixel files are kept.
 * A file is fetched by its `dataURI`. */
import { mkdir, rename, stat, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { isRecord } from '@cssearth/core';
import { paced } from '../tess/pixels.mts';

export const MAST_INVOKE = 'https://mast.stsci.edu/api/v0/invoke', MAST_FILE = 'https://mast.stsci.edu/api/v0.1/Download/file';
/** How far from a star's place the mission's own target may lie, degrees (4 arcseconds: one pixel). */
export const MATCH_DEGREES = 4 / 3600;
/** The cadence that is read: one image every 30 minutes, the one every target has. */
export const LONG_CADENCE_SECONDS = 1800;

export type KeplerMission = 'Kepler' | 'K2';
export interface Place { readonly raDegrees: number; readonly decDegrees: number }
export interface Observation extends Place { readonly obsid: number; readonly mission: KeplerMission; readonly target: string }
/** One quarter's or campaign's pixels of a target: `window` is the quarter or campaign number. */
export interface PixelFile { readonly mission: KeplerMission; readonly target: string; readonly window: number; readonly filename: string; readonly uri: string; readonly bytes: number }

const rows = (body: unknown, what: string) => { if (!isRecord(body) || body.status !== 'COMPLETE' || !Array.isArray(body.data)) throw new TypeError(`MAST did not answer with ${what}.`); return body.data.filter(isRecord); };
/** MAST's answer for a place, as the long-cadence observations of Kepler and K2 there. */
export function parseObservations(body: unknown): Observation[] {
  return rows(body, 'a list of observations').flatMap(row => { const mission = row.obs_collection, obsid = Number(row.obsid);
    return (mission === 'Kepler' || mission === 'K2') && Number(row.t_exptime) === LONG_CADENCE_SECONDS && Number.isInteger(obsid) && typeof row.target_name === 'string' && typeof row.s_ra === 'number' && typeof row.s_dec === 'number'
      ? [{ obsid, mission, target: row.target_name, raDegrees: row.s_ra, decDegrees: row.s_dec }] : []; });
}
/** An observation's files, as its long-cadence target pixel files, oldest first. The quarter or campaign is in each file's description. */
export function parseProducts(body: unknown, observation: Observation): PixelFile[] {
  return rows(body, 'a list of files').flatMap(row => { const window = /- [CQ](\d+)\s*$/u.exec(String(row.description ?? ''))?.[1];
    return row.productSubGroupDescription === 'LPD-TARG' && typeof row.dataURI === 'string' && typeof row.productFilename === 'string' && window !== undefined && Number(row.size) > 0
      ? [{ mission: observation.mission, target: observation.target, window: Number(window), filename: row.productFilename, uri: row.dataURI, bytes: Number(row.size) }] : []; }).sort((a, b) => a.window - b.window);
}
/** The file read for a star: the largest, which holds the most images of it. One file is enough to see a star turn. */
export const pickFile = (files: readonly PixelFile[]): PixelFile | undefined => [...files].sort((a, b) => b.bytes - a.bytes || b.window - a.window)[0];

async function invoke(request: unknown): Promise<unknown> {
  const response = await paced(MAST_INVOKE, { method: 'POST', body: new URLSearchParams({ request: JSON.stringify(request) }) });
  if (!response.ok) throw new Error(`MAST answered ${response.status}.`);
  return response.json();
}

const apart = (a: Place, b: Place) => Math.hypot((a.raDegrees - b.raDegrees) * Math.cos(a.decDegrees * Math.PI / 180), a.decDegrees - b.decDegrees);
/** Every long-cadence target pixel file of Kepler and K2 of the target at a star's place. A star that moves is given at
 * more than one place (where its record has it, and where it was when the mission looked): the missions' own target
 * lists hold each star at one epoch or another, and the target within a pixel of any of them is the star's. */
export async function pixelFilesAt(places: readonly Place[]): Promise<PixelFile[]> {
  const first = places[0];
  if (!first || !places.every(place => Number.isFinite(place.raDegrees) && Number.isFinite(place.decDegrees) && Math.abs(place.decDegrees) <= 90)) throw new RangeError('A place needs a right ascension and a declination in degrees.');
  const reach = MATCH_DEGREES + Math.max(...places.map(place => apart(first, place)));
  const observations = parseObservations(await invoke({ service: 'Mast.Caom.Filtered.Position', format: 'json', params: { columns: 'obsid,obs_collection,target_name,t_exptime,s_ra,s_dec',
    filters: [{ paramName: 'obs_collection', values: ['Kepler', 'K2'] }, { paramName: 'dataproduct_type', values: ['timeseries'] }], position: `${first.raDegrees}, ${first.decDegrees}, ${reach}` } }))
    .filter(observation => places.some(place => apart(place, observation) <= MATCH_DEGREES));
  const files: PixelFile[] = [];
  for (const observation of observations) files.push(...parseProducts(await invoke({ service: 'Mast.Caom.Products', format: 'json', params: { obsid: observation.obsid } }), observation));
  return files;
}

/** One file, written under `directory` as the archive serves it; one already there is kept. The size MAST lists for a file
 * is not always the size it serves (two of the first nineteen read differed, 2026-10-06), so a download is checked against
 * the length the answer itself declares. */
export async function fetchPixelFile(file: PixelFile, directory: string): Promise<{ readonly file: string; readonly url: string; readonly bytes: number }> {
  const url = `${MAST_FILE}?uri=${encodeURIComponent(file.uri)}`, path = resolve(directory, file.filename), held = await stat(path).then(info => info.size, () => 0);
  if (held > 0) return { file: path, url, bytes: held };
  const response = await paced(url);
  if (!response.ok) throw new Error(`MAST answered ${response.status} for ${file.filename}.`);
  const bytes = Buffer.from(await response.arrayBuffer()), declared = Number(response.headers.get('content-length') ?? bytes.length);
  if (bytes.length === 0 || bytes.length !== declared) throw new Error(`${file.filename} arrived as ${bytes.length} bytes of the ${declared} MAST declared.`);
  // Written beside its place and moved there whole: a file cut short by a stopped run is never taken for the file.
  await mkdir(directory, { recursive: true }); await writeFile(`${path}.part`, bytes); await rename(`${path}.part`, path);
  return { file: path, url, bytes: bytes.length };
}
