/** The K2 mission's own light curves of a star, read through MAST.
 *
 * K2 watched a field along the ecliptic for some eighty days at a time, with an image every 30 minutes. For each star it
 * was asked to watch, the mission's pipeline publishes one long-cadence light curve a campaign, with the flux it corrected
 * for the spacecraft's systematics (PDC-MAP, the `PDCSAP_FLUX` column). That light curve is what the published methods
 * for K2 stars are made for (archives/tess/methods.mts), so it is read as it is: this repository measures nothing from
 * the pixels of a K2 star.
 *
 * One call to MAST's archive, public and anonymous, sent through the pace archives/tess keeps for the same host:
 * `Mast.Caom.Filtered.Position`, the K2 time series at a place. An observation's id names its target and its campaign
 * (`ktwo247589423-c13_lc`), and the mission files every target's light curve at a fixed address. */
import { mkdir, rename, stat, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { isRecord } from '@cssearth/core';
import { paced } from '../tess/pixels.mts';

export const MAST_INVOKE = 'https://mast.stsci.edu/api/v0/invoke', MAST_FILE = 'https://mast.stsci.edu/api/v0.1/Download/file';
/** How far from a star's place the mission's own target may lie, degrees (4 arcseconds: one of its pixels). */
export const MATCH_DEGREES = 4 / 3600;
/** The cadence that is read: one image every 30 minutes, the one every target has. */
export const LONG_CADENCE_SECONDS = 1800;
/** Campaigns the mission filed in two parts, each with its own files (`c101`, `c102`). The second part is read: its 48
 * days are the "50 to 70 days" Reinhold & Hekker (2020, Sect. 2) give for campaigns 10 and 11, where the first parts hold 6 and 23. */
export const SPLIT_CAMPAIGNS: readonly number[] = [10, 11];

export interface Place { readonly raDegrees: number; readonly decDegrees: number }
/** One campaign's light curve of a target, as the mission files it. */
export interface CampaignLightCurve extends Place { readonly target: string; readonly campaign: number; readonly filename: string; readonly uri: string }

const rows = (body: unknown, what: string) => { if (!isRecord(body) || body.status !== 'COMPLETE' || !Array.isArray(body.data)) throw new TypeError(`MAST did not answer with ${what}.`); return body.data.filter(isRecord); };
/** MAST's answer for a place, as the long-cadence K2 light curves there, oldest campaign first. The folder of a campaign
 * has no leading zero and the file name has one; the target's number gives the two folders under it. */
export function parseLightCurves(body: unknown): CampaignLightCurve[] {
  return rows(body, 'a list of observations').flatMap(row => { const named = /^ktwo(\d{9})-c(\d+)_lc$/u.exec(String(row.obs_id ?? ''));
    if (row.obs_collection !== 'K2' || Number(row.t_exptime) !== LONG_CADENCE_SECONDS || !named || typeof row.target_name !== 'string' || typeof row.s_ra !== 'number' || typeof row.s_dec !== 'number') return [];
    const [, target, campaign] = named as unknown as [string, string, string], part = SPLIT_CAMPAIGNS.includes(Number(campaign)) ? `${Number(campaign)}2` : campaign, filename = `ktwo${target}-c${part}_llc.fits`;
    return [{ target: row.target_name, campaign: Number(campaign), filename, raDegrees: row.s_ra, decDegrees: row.s_dec, uri: `mast:K2/url/missions/k2/lightcurves/c${Number(part)}/${target.slice(0, 4)}00000/${target.slice(4, 6)}000/${filename}` }]; })
    .sort((a, b) => a.campaign - b.campaign);
}

async function invoke(request: unknown): Promise<unknown> {
  const response = await paced(MAST_INVOKE, { method: 'POST', body: new URLSearchParams({ request: JSON.stringify(request) }) });
  if (!response.ok) throw new Error(`MAST answered ${response.status}.`);
  return response.json();
}

const apart = (a: Place, b: Place) => Math.hypot((a.raDegrees - b.raDegrees) * Math.cos(a.decDegrees * Math.PI / 180), a.decDegrees - b.decDegrees);
/** Every K2 campaign's light curve of the target at a star's place. A star that moves is given at more than one place
 * (where its record has it, and where it was when the mission looked): the mission's target list holds each star at one
 * epoch or another, and the target within a pixel of any of them is the star's. */
export async function lightCurvesAt(places: readonly Place[]): Promise<CampaignLightCurve[]> {
  const first = places[0];
  if (!first || !places.every(place => Number.isFinite(place.raDegrees) && Number.isFinite(place.decDegrees) && Math.abs(place.decDegrees) <= 90)) throw new RangeError('A place needs a right ascension and a declination in degrees.');
  const reach = MATCH_DEGREES + Math.max(...places.map(place => apart(first, place)));
  return parseLightCurves(await invoke({ service: 'Mast.Caom.Filtered.Position', format: 'json', params: { columns: 'obs_id,obs_collection,target_name,t_exptime,s_ra,s_dec',
    filters: [{ paramName: 'obs_collection', values: ['K2'] }, { paramName: 'dataproduct_type', values: ['timeseries'] }], position: `${first.raDegrees}, ${first.decDegrees}, ${reach}` } }))
    .filter(found => places.some(place => apart(place, found) <= MATCH_DEGREES));
}

/** One file, written under `directory` as the archive serves it; one already there is kept. A download is checked
 * against the length the answer itself declares. */
export async function fetchLightCurve(file: Pick<CampaignLightCurve, 'filename' | 'uri'>, directory: string): Promise<{ readonly file: string; readonly url: string; readonly bytes: number }> {
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
