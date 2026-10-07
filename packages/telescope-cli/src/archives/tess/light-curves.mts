/** The TESS mission's own 2-minute light curves of a star, read through MAST.
 *
 * For the stars it was asked to watch, the mission's pipeline (SPOC) publishes a light curve of each sector at a 2-minute
 * cadence, with the flux it corrected for the spacecraft's systematics (`PDCSAP_FLUX`). That light curve is what the
 * published method for a TESS sector is made for (methods.mts), so it is read as it is: nothing is measured here from
 * the pixels of such a star.
 *
 * One call to MAST's archive, public and anonymous, through the pace mast.mts keeps for the host:
 * `Mast.Caom.Filtered.Position`, the TESS time series at a place. Each row names its sector and its file. A second
 * call, `Mast.Catalogs.Filtered.Tic`, reads what the mission's input catalog says of other stars' light in a target's
 * pixels. */
import { isRecord } from '@cssearth/core';
import { paced } from './mast.mts';

export const MAST_INVOKE = 'https://mast.stsci.edu/api/v0/invoke';
/** How far from a star's place the mission's own target may lie, degrees (21 arcseconds: one of its pixels). */
export const MATCH_DEGREES = 21 / 3600;
/** The cadence that is read, seconds, and the pipeline whose light curves these are. */
export const SHORT_CADENCE_SECONDS = 120, PIPELINE = 'SPOC';

export interface Place { readonly raDegrees: number; readonly decDegrees: number }
/** One sector's 2-minute light curve of a target, as the mission files it. */
export interface SectorLightCurve extends Place { readonly target: string; readonly sector: number; readonly filename: string; readonly uri: string }

/** MAST's answer for a place, as the mission's 2-minute light curves there, oldest sector first. A sector's file ends in
 * `-s_lc.fits`; the 20-second light curves and the transit search's files of the same targets are left out. */
export function parseSectorLightCurves(body: unknown): SectorLightCurve[] {
  if (!isRecord(body) || body.status !== 'COMPLETE' || !Array.isArray(body.data)) throw new TypeError('MAST did not answer with a list of observations.');
  return body.data.filter(isRecord).flatMap(row => { const uri = String(row.dataURL ?? ''), filename = /^mast:TESS\/product\/(tess\d+-s\d{4}-\d{16}-\d{4}-s_lc\.fits)$/u.exec(uri)?.[1], sector = Number(row.sequence_number);
    return row.obs_collection === 'TESS' && row.provenance_name === PIPELINE && Number(row.t_exptime) === SHORT_CADENCE_SECONDS && filename && Number.isInteger(sector) && typeof row.target_name === 'string' && typeof row.s_ra === 'number' && typeof row.s_dec === 'number'
      ? [{ target: row.target_name, sector, filename, uri, raDegrees: row.s_ra, decDegrees: row.s_dec }] : []; }).sort((a, b) => a.sector - b.sector);
}

/** The angle between two places, degrees. */
export const apart = (a: Place, b: Place) => Math.hypot((a.raDegrees - b.raDegrees) * Math.cos(a.decDegrees * Math.PI / 180), a.decDegrees - b.decDegrees);
/** Every sector's 2-minute light curve of the target at a star's place. A star that moves is given at more than one place;
 * the target nearest any of them, within a pixel, is the star's, and only its light curves are returned. */
export async function sectorLightCurvesAt(places: readonly Place[]): Promise<SectorLightCurve[]> {
  const first = places[0];
  if (!first || !places.every(place => Number.isFinite(place.raDegrees) && Number.isFinite(place.decDegrees) && Math.abs(place.decDegrees) <= 90)) throw new RangeError('A place needs a right ascension and a declination in degrees.');
  const reach = MATCH_DEGREES + Math.max(...places.map(place => apart(first, place)));
  const response = await paced(MAST_INVOKE, { method: 'POST', body: new URLSearchParams({ request: JSON.stringify({ service: 'Mast.Caom.Filtered.Position', format: 'json', params: { columns: 'obs_id,obs_collection,provenance_name,target_name,t_exptime,sequence_number,s_ra,s_dec,dataURL',
    filters: [{ paramName: 'obs_collection', values: ['TESS'] }, { paramName: 'dataproduct_type', values: ['timeseries'] }], position: `${first.raDegrees}, ${first.decDegrees}, ${reach}` } }) }) });
  if (!response.ok) throw new Error(`MAST answered ${response.status}.`);
  const near = (found: SectorLightCurve) => Math.min(...places.map(place => apart(place, found))), found = parseSectorLightCurves(await response.json()).filter(one => near(one) <= MATCH_DEGREES);
  const nearest = [...found].sort((a, b) => near(a) - near(b))[0]?.target;
  return found.filter(one => one.target === nearest);
}

/** A target's contamination ratio in MAST's answer for its TESS Input Catalog number: the flux of the other stars in the
 * target's pixels over the target's own ("the ratio of the total contaminant flux to the target star flux", Stassun et
 * al. 2019, AJ 158, 138, Sect. III.2.1). The catalog works one out for the stars of its Candidate Target List; a target
 * it gives none has none here. */
export function parseContaminationRatio(body: unknown, tic: number): number | undefined {
  if (!isRecord(body) || body.status !== 'COMPLETE' || !Array.isArray(body.data)) throw new TypeError('MAST did not answer with rows of the TESS Input Catalog.');
  const row = body.data.filter(isRecord).find(one => Number(one.ID) === tic); if (!row) throw new TypeError(`MAST's TESS Input Catalog holds no TIC ${tic}.`);
  if (row.contratio === null || row.contratio === undefined) return undefined;
  if (typeof row.contratio !== 'number' || !Number.isFinite(row.contratio) || row.contratio < 0) throw new TypeError(`TIC ${tic}: the catalog's contamination ratio is not a number.`);
  return row.contratio;
}
/** The TESS Input Catalog's contamination ratio of a target, asked of MAST: one small request a star. */
export async function contaminationRatio(tic: number): Promise<number | undefined> {
  if (!Number.isInteger(tic) || tic <= 0) throw new RangeError('A target needs its TESS Input Catalog number.');
  const response = await paced(MAST_INVOKE, { method: 'POST', body: new URLSearchParams({ request: JSON.stringify({ service: 'Mast.Catalogs.Filtered.Tic', format: 'json', params: { columns: 'ID,contratio', filters: [{ paramName: 'ID', values: [String(tic)] }] } }) }) });
  if (!response.ok) throw new Error(`MAST answered ${response.status}.`);
  return parseContaminationRatio(await response.json(), tic);
}
