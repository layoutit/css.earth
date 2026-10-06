/** Kepler and K2 target pixel files at a star's place, read through MAST.
 *
 * Kepler watched one field for four years and K2 a field along the ecliptic for some eighty days at a time, both with
 * pixels 4 arcseconds wide and an image every 30 minutes. For a star they observed, the mission keeps the pixels around it
 * as one file a quarter (Kepler) or a campaign (K2). Against TESS's 27 days and 21-arcsecond pixels, a slow rotator turns
 * several times in one file and a neighbour seldom shares the pixels.
 *
 * One call to MAST's archive, public and anonymous, sent through the pace archives/tess keeps for the same host:
 * `Mast.Caom.Filtered.Position`, the Kepler and K2 time series at a place. Each observation's id names its target and
 * its campaign (`ktwo247589423-c13_lc`) or its quarters (`kplr005772710_lc_Q111100111011101110`), and the missions file
 * every target's pixels at a fixed address, so no second call is made for a K2 star: the archive's list of an
 * observation's files (`Mast.Caom.Products`) took 8 seconds when it answered and did not answer at all on 2026-10-06.
 * A Kepler star's folder is read for its quarters' file names. */
import { mkdir, rename, stat, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { isRecord } from '@cssearth/core';
import { paced } from '../tess/pixels.mts';

export const MAST_INVOKE = 'https://mast.stsci.edu/api/v0/invoke', MAST_FILE = 'https://mast.stsci.edu/api/v0.1/Download/file', MAST_FOLDERS = 'https://archive.stsci.edu/missions';
/** How far from a star's place the mission's own target may lie, degrees (4 arcseconds: one pixel). */
export const MATCH_DEGREES = 4 / 3600;
/** The cadence that is read: one image every 30 minutes, the one every target has. */
export const LONG_CADENCE_SECONDS = 1800;
/** Kepler's quarters of full length (some 90 days): the first two and the last are a month or less. */
export const FULL_QUARTERS = { first: 2, last: 16, middle: 9 } as const;

export type KeplerMission = 'Kepler' | 'K2';
export interface Place { readonly raDegrees: number; readonly decDegrees: number }
/** One time series of a target: a K2 campaign, or every quarter of a Kepler target. `days` is how long it lasts. */
export interface Observation extends Place { readonly mission: KeplerMission; readonly target: string; readonly id: string; readonly days: number }
/** One quarter's or campaign's pixels of a target. `window` is the quarter or campaign as the archive names it, and
 * `days` how long a K2 campaign lasted; the file's own header says the window again when it is read. */
export interface PixelFile { readonly mission: KeplerMission; readonly target: string; readonly window: number; readonly filename: string; readonly uri: string; readonly days?: number }

const rows = (body: unknown, what: string) => { if (!isRecord(body) || body.status !== 'COMPLETE' || !Array.isArray(body.data)) throw new TypeError(`MAST did not answer with ${what}.`); return body.data.filter(isRecord); };
/** MAST's answer for a place, as the long-cadence observations of Kepler and K2 there. */
export function parseObservations(body: unknown): Observation[] {
  return rows(body, 'a list of observations').flatMap(row => { const mission = row.obs_collection, days = Number(row.t_max) - Number(row.t_min);
    return (mission === 'Kepler' || mission === 'K2') && Number(row.t_exptime) === LONG_CADENCE_SECONDS && typeof row.obs_id === 'string' && typeof row.target_name === 'string' && typeof row.s_ra === 'number' && typeof row.s_dec === 'number'
      ? [{ mission, target: row.target_name, id: row.obs_id, raDegrees: row.s_ra, decDegrees: row.s_dec, days: Number.isFinite(days) ? Number(days.toFixed(1)) : 0 }] : []; });
}
/** A K2 observation's one file, at the address the mission files it under: its campaign, then its target's number in two steps. */
export function campaignFile(observation: Observation): PixelFile | undefined {
  const named = /^ktwo(\d{9})-c(\d+)_lc$/u.exec(observation.id); if (!named || observation.mission !== 'K2') return undefined;
  const [, target, campaign] = named as unknown as [string, string, string], filename = `ktwo${target}-c${campaign}_lpd-targ.fits.gz`;
  return { mission: 'K2', target: observation.target, window: Number(campaign), filename, days: observation.days, uri: `mast:K2/url/missions/k2/target_pixel_files/c${campaign}/${target.slice(0, 4)}00000/${target.slice(4, 6)}000/${filename}` };
}
/** Where a Kepler target's quarters are filed, and its files from that folder's listing: the observation's id flags the
 * quarters it has, 0 to 17, and the folder lists one file for each in the order of time. */
export const quarterFolder = (target: string) => `${MAST_FOLDERS}/kepler/target_pixel_files/${target.slice(0, 4)}/${target}/`;
export function quarterFiles(observation: Observation, listing: string): PixelFile[] {
  const named = /^kplr(\d{9})_lc_Q([01]{18})$/u.exec(observation.id); if (!named || observation.mission !== 'Kepler') return [];
  const [, target, flags] = named as unknown as [string, string, string], quarters = [...flags].flatMap((flag, quarter) => flag === '1' ? [quarter] : []);
  const names = [...new Set([...listing.matchAll(new RegExp(`kplr${target}-\\d{13}_lpd-targ\\.fits\\.gz`, 'gu'))].map(match => match[0]))].sort();
  // A folder that does not hold one file for each flagged quarter cannot be matched to quarters by its order.
  if (names.length !== quarters.length) return [];
  return names.map((filename, index) => ({ mission: 'Kepler' as const, target: observation.target, window: quarters[index]!, filename, uri: `mast:Kepler/url/missions/kepler/target_pixel_files/${target.slice(0, 4)}/${target}/${filename}` }));
}
/** The file read for a star. One file is enough to see a star turn: the longest K2 campaign (the newest of equals), or
 * the full-length Kepler quarter nearest the middle of the mission. */
export function pickFile(files: readonly PixelFile[]): PixelFile | undefined {
  const full = files.filter(file => file.mission === 'Kepler' && file.window >= FULL_QUARTERS.first && file.window <= FULL_QUARTERS.last);
  if (full.length) return [...full].sort((a, b) => Math.abs(a.window - FULL_QUARTERS.middle) - Math.abs(b.window - FULL_QUARTERS.middle) || a.window - b.window)[0];
  return [...files].sort((a, b) => (b.days ?? 0) - (a.days ?? 0) || b.window - a.window)[0];
}

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
  const observations = parseObservations(await invoke({ service: 'Mast.Caom.Filtered.Position', format: 'json', params: { columns: 'obs_id,obs_collection,target_name,t_exptime,t_min,t_max,s_ra,s_dec',
    filters: [{ paramName: 'obs_collection', values: ['Kepler', 'K2'] }, { paramName: 'dataproduct_type', values: ['timeseries'] }], position: `${first.raDegrees}, ${first.decDegrees}, ${reach}` } }))
    .filter(observation => places.some(place => apart(place, observation) <= MATCH_DEGREES));
  const files: PixelFile[] = [];
  for (const observation of observations) { const campaign = campaignFile(observation); if (campaign) { files.push(campaign); continue; }
    if (observation.mission !== 'Kepler') continue;
    const target = /^kplr(\d{9})_/u.exec(observation.id)?.[1]; if (!target) continue;
    const response = await paced(quarterFolder(target)); if (!response.ok) throw new Error(`MAST answered ${response.status} for the folder of ${observation.target}.`);
    files.push(...quarterFiles(observation, await response.text())); }
  return files;
}

/** One file, written under `directory` as the archive serves it; one already there is kept. A download is checked
 * against the length the answer itself declares. */
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
