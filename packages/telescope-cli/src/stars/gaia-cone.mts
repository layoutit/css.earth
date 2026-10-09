/** Gaia DR3 cone search for the telescope API: every star Gaia measured inside a circle on the sky, brighter than a G
 * limit, with its position, proper motion, parallax and BP−RP color, and the Bailer-Jones et al. (2021) geometric
 * distance where that catalogue holds one. One ADQL query to GAVO's TAP service, asked and decoded by PyVO (the
 * telescope's `tap-query`, as `prepare-nebula-field-catalogues` asks it). Nothing is placed or drawn here: a caller
 * selects from the rows. */
import { mkdir, rename, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { tapRows } from '@cssearth/telescope/node';

export const GAIA_CONE_SCHEMA = 'cssearth-telescope-gaia-cone@1';
export const GAIA_CONE_SERVICE = 'https://dc.g-vo.org/tap';
/** The archive's row bound for one synchronous answer; a larger request runs as a job. */
const MOST_ROWS = 50000;
const GAIA_COLUMNS = ['source_id', 'ra', 'dec', 'pmra', 'pmdec', 'parallax', 'parallax_error', 'phot_g_mean_mag', 'phot_bp_mean_mag', 'phot_rp_mean_mag', 'ruwe'] as const;
const DISTANCE_COLUMNS = ['r_med_geo', 'r_lo_geo', 'r_hi_geo'] as const;
export const GAIA_CONE_COLUMNS = [...GAIA_COLUMNS, ...DISTANCE_COLUMNS] as const;

export interface GaiaConeRequest { readonly raDeg: number; readonly decDeg: number; readonly radiusDeg: number; readonly magnitudeLimit: number; readonly limit: number }
export interface GaiaConeStar {
  readonly sourceId: string; readonly raDeg: number; readonly decDeg: number;
  readonly pmRaMasYr: number | null; readonly pmDecMasYr: number | null;
  readonly parallaxMas: number | null; readonly parallaxErrorMas: number | null;
  readonly photGMeanMag: number; readonly bpRp: number | null; readonly ruwe: number | null;
  /** Bailer-Jones et al. (2021) geometric distance: median and 16th/84th percentiles; null where the catalogue has none. */
  readonly distancePc: number | null; readonly distanceLowerPc: number | null; readonly distanceUpperPc: number | null;
}
export interface GaiaCone {
  readonly schema: typeof GAIA_CONE_SCHEMA; readonly request: GaiaConeRequest;
  readonly service: string; readonly query: string; readonly retrievedAt: string;
  /** The answer held `limit` rows: fainter stars inside the cone may be missing. */
  readonly truncated: boolean;
  readonly catalogue: { readonly gaia: string; readonly distances: string; readonly credit: string; readonly license: string };
  readonly stars: readonly GaiaConeStar[];
}

/** A request whose numbers the archive can answer: a cone on the sphere, a G limit Gaia measures to, a row bound. */
export function readGaiaConeRequest(value: { raDeg: number; decDeg: number; radiusDeg: number; magnitudeLimit?: number; limit?: number }): GaiaConeRequest {
  const { raDeg, decDeg, radiusDeg } = value, magnitudeLimit = value.magnitudeLimit ?? 16, limit = value.limit ?? 5000;
  if (!Number.isFinite(raDeg) || raDeg < 0 || raDeg >= 360) throw new RangeError(`Right ascension ${raDeg} is not in [0, 360) degrees.`);
  if (!Number.isFinite(decDeg) || Math.abs(decDeg) > 90) throw new RangeError(`Declination ${decDeg} is not in [-90, 90] degrees.`);
  if (!Number.isFinite(radiusDeg) || radiusDeg <= 0 || radiusDeg > 10) throw new RangeError(`Cone radius ${radiusDeg} is not in (0, 10] degrees.`);
  if (!Number.isFinite(magnitudeLimit) || magnitudeLimit < 3 || magnitudeLimit > 21) throw new RangeError(`G limit ${magnitudeLimit} is not in [3, 21].`);
  if (!Number.isInteger(limit) || limit < 1 || limit > MOST_ROWS) throw new RangeError(`Row limit ${limit} is not a whole number in [1, ${MOST_ROWS}].`);
  return { raDeg, decDeg, radiusDeg, magnitudeLimit, limit };
}

/** The ADQL: the cone and the G limit inside a planner fence (GAVO's documented `SELECT ALL` CTE), then the brightest
 * `limit` of those, each joined to its Bailer-Jones distance where one exists. */
export function gaiaConeQuery(request: GaiaConeRequest): string {
  const { raDeg, decDeg, radiusDeg, magnitudeLimit, limit } = request;
  return `WITH c AS (SELECT ALL ${GAIA_COLUMNS.join(',')} FROM gaia.dr3lite WHERE `
    + `1=CONTAINS(POINT('ICRS',ra,dec),CIRCLE('ICRS',${raDeg},${decDeg},${radiusDeg})) AND phot_g_mean_mag<${magnitudeLimit}) `
    + `SELECT TOP ${limit} ${GAIA_COLUMNS.map(name => `c.${name}`).join(',')},${DISTANCE_COLUMNS.map(name => `d.${name}`).join(',')} `
    + 'FROM c LEFT OUTER JOIN gedr3dist.main AS d ON c.source_id=d.source_id ORDER BY c.phot_g_mean_mag,c.source_id';
}

const number = (cell: string | undefined, name: string, row: number): number => {
  const value = Number(cell);
  if (cell === undefined || !cell.trim() || !Number.isFinite(value)) throw new TypeError(`Gaia cone row ${row}: ${name} is not a number (${JSON.stringify(cell)}).`);
  return value;
};
const nullable = (cell: string | undefined, name: string, row: number): number | null => cell === undefined || !cell.trim() ? null : number(cell, name, row);

/** The TAP rows as stars. A row needs an identity, a position and a G magnitude; every other value may be absent. */
export function parseGaiaConeRows(rows: readonly Record<string, string>[]): GaiaConeStar[] {
  const seen = new Set<string>();
  return rows.map((row, index) => {
    const sourceId = row.source_id?.trim() ?? '';
    if (!/^\d{10,20}$/.test(sourceId)) throw new TypeError(`Gaia cone row ${index}: source_id ${JSON.stringify(row.source_id)} is not a Gaia DR3 identity.`);
    if (seen.has(sourceId)) throw new TypeError(`Gaia cone row ${index}: source ${sourceId} is repeated.`);
    seen.add(sourceId);
    const bp = nullable(row.phot_bp_mean_mag, 'phot_bp_mean_mag', index), rp = nullable(row.phot_rp_mean_mag, 'phot_rp_mean_mag', index);
    const distancePc = nullable(row.r_med_geo, 'r_med_geo', index), distanceLowerPc = nullable(row.r_lo_geo, 'r_lo_geo', index), distanceUpperPc = nullable(row.r_hi_geo, 'r_hi_geo', index);
    if (distancePc !== null && (distanceLowerPc === null || distanceUpperPc === null || distanceLowerPc > distancePc || distancePc > distanceUpperPc))
      throw new TypeError(`Gaia cone row ${index}: the Bailer-Jones percentiles of ${sourceId} do not bracket its median.`);
    return { sourceId, raDeg: number(row.ra, 'ra', index), decDeg: number(row.dec, 'dec', index),
      pmRaMasYr: nullable(row.pmra, 'pmra', index), pmDecMasYr: nullable(row.pmdec, 'pmdec', index),
      parallaxMas: nullable(row.parallax, 'parallax', index), parallaxErrorMas: nullable(row.parallax_error, 'parallax_error', index),
      photGMeanMag: number(row.phot_g_mean_mag, 'phot_g_mean_mag', index), bpRp: bp !== null && rp !== null ? bp - rp : null,
      ruwe: nullable(row.ruwe, 'ruwe', index), distancePc, distanceLowerPc, distanceUpperPc };
  });
}

export type TapRows = (service: string, query: string, maxrec?: number, mode?: 'async') => Promise<Record<string, string>[]>;
/** Asks the archive for one cone and, given `out`, keeps the answer there (written whole, then renamed). */
export async function gaiaCone(request: GaiaConeRequest, options: { out?: string; rows?: TapRows; progress?: (line: string) => void } = {}): Promise<GaiaCone> {
  const query = gaiaConeQuery(request);
  options.progress?.(`Asking GAVO TAP for Gaia DR3 within ${request.radiusDeg}° of ${request.raDeg}, ${request.decDeg}, G < ${request.magnitudeLimit}`);
  const rows = await (options.rows ?? tapRows)(GAIA_CONE_SERVICE, query, request.limit + 1, 'async');
  const stars = parseGaiaConeRows(rows.slice(0, request.limit));
  const cone: GaiaCone = { schema: GAIA_CONE_SCHEMA, request, service: GAIA_CONE_SERVICE, query, retrievedAt: new Date().toISOString(),
    truncated: rows.length > request.limit,
    catalogue: { gaia: 'Gaia DR3 (gaia.dr3lite)', distances: 'Bailer-Jones et al. (2021), EDR3 geometric distances (gedr3dist.main), https://doi.org/10.3847/1538-3881/abd806',
      credit: 'ESA/Gaia/DPAC; Bailer-Jones, Rybizki, Fouesneau, Demleitner and Andrae (2021); GAVO', license: 'CC-BY-4.0' }, stars };
  if (options.out) {
    await mkdir(dirname(options.out), { recursive: true });
    await writeFile(`${options.out}.pending`, JSON.stringify(cone) + '\n'); await rename(`${options.out}.pending`, options.out);
  }
  options.progress?.(`${stars.length} stars${cone.truncated ? ` (cut at ${request.limit})` : ''}`);
  return cone;
}

export function formatGaiaCone(cone: GaiaCone, out?: string): string {
  const withDistance = cone.stars.filter(star => star.distancePc !== null).length;
  return [`Gaia DR3 cone: ${cone.request.radiusDeg}° around ${cone.request.raDeg}, ${cone.request.decDeg}, G < ${cone.request.magnitudeLimit}`,
    `Stars: ${cone.stars.length}${cone.truncated ? ` (cut at ${cone.request.limit}; fainter stars missing)` : ''} · ${withDistance} with a Bailer-Jones distance`,
    ...(cone.stars.length ? [`Brightest G ${cone.stars[0]!.photGMeanMag.toFixed(2)} · faintest G ${cone.stars.at(-1)!.photGMeanMag.toFixed(2)}`] : []),
    ...(out ? [`Saved: ${out}`] : [])].join('\n') + '\n';
}
