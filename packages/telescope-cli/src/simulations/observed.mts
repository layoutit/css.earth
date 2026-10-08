/** What JWST has already watched of a planet's star, for the leads: each time series set on the planet's orbit.
 *
 * MAST lists JWST's time series (one star watched for hours) as observations of type `timeseries`: about four thousand rows,
 * one request. A row is one detector's segment; rows of one program and instrument that follow each other within two hours are
 * one visit. A visit is a planet's when it points within MATCH_ARCSEC of the planet's star, at the star's place in the visit's
 * year. It is then set on the orbit the package records: how many orbits it spans, and whether it holds the transit and the
 * place half an orbit later, where a circular orbit has its eclipse.
 *
 * - a visit of a whole orbit or more is a phase curve: what `new-object --phase-curve` draws once a paper prints its fit;
 * - one that holds the half-orbit place and no transit is an eclipse: a dayside temperature;
 * - one that holds only the transit gives a transmission spectrum, which no page draws.
 *
 * The archive says when each visit becomes public. This is geometry and dates, nothing more: it does not say a visit
 * succeeded, that a paper exists, or what was found; a visit of one planet's star is listed for every planet of that star;
 * and an eccentric planet's eclipse is not half an orbit after its transit. */
import { requireFiniteNumber, requireRecord } from '@cssearth/core';
import { HOSTED_PLANET_IDS, hostedOrbit, hostedOrbitCentreId, hostedOrbitPhaseBmjdTdb, STAR_IDS, starAstrometry, type HostedPlanetId, type StarAstrometry, type StarId } from '@cssearth/astronomy';
import { mastRequest } from '@cssearth/telescope/node';

/** How far from its star's place a time series may point and still be the star's. JWST points a time series at its target, and
 * the place is moved to the visit's year; this allows for a catalogue place and motion a little off. */
export const MATCH_ARCSEC = 15;
/** Rows of one program and instrument no further apart than this are one visit: its detectors and segments. */
const SAME_VISIT_DAYS = 2 / 24;
const MJD_J2000 = 51_544.5, MJD_UNIX_EPOCH = 40_587, DAYS_PER_YEAR = 365.25;
const COLUMNS = 'obs_id,target_name,s_ra,s_dec,instrument_name,proposal_id,proposal_pi,obs_title,t_min,t_max,t_obs_release';

export type VisitPart = 'whole-orbit' | 'eclipse' | 'transit' | 'transit-and-eclipse' | 'neither';
export interface TimeSeriesRow {
  readonly programme: string; readonly instrument: string; readonly investigator: string; readonly title: string;
  readonly raDegrees: number; readonly decDegrees: number; readonly startMjd: number; readonly endMjd: number;
  /** When the archive releases the row to everyone, or null when it states no date. */ readonly releaseMjd: number | null;
}
export interface Visit {
  readonly programme: string; readonly instrument: string; readonly investigator: string; readonly title: string;
  readonly start: string; readonly hours: number;
  /** The visit's length in orbits of this planet. */ readonly orbits: number; readonly part: VisitPart;
  /** The day the whole visit is public, or null when the archive states none. */ readonly publicOn: string | null;
}

const text = (value: unknown) => typeof value === 'number' ? String(value) : typeof value === 'string' ? value : '';
const day = (mjd: number) => new Date((mjd - MJD_UNIX_EPOCH) * 86_400_000).toISOString().slice(0, 10);

/** MAST's rows as time series. A row with no place or no times cannot be set on an orbit and is left out. */
export function parseTimeSeries(rows: readonly unknown[]): TimeSeriesRow[] {
  return rows.flatMap((value, index) => {
    const row = requireRecord(value, `MAST time series row ${index + 1}`);
    if (row.s_ra === null || row.s_dec === null || row.t_min === null || row.t_max === null || row.s_ra === undefined || row.t_min === undefined) return [];
    const number = (key: string) => requireFiniteNumber(row[key], `MAST time series row ${index + 1}.${key}`);
    return [{ programme: text(row.proposal_id), instrument: text(row.instrument_name).split('/')[0]!, investigator: text(row.proposal_pi).split(',')[0]!.trim(), title: text(row.obs_title),
      raDegrees: number('s_ra'), decDegrees: number('s_dec'), startMjd: number('t_min'), endMjd: number('t_max'), releaseMjd: typeof row.t_obs_release === 'number' ? row.t_obs_release : null }];
  });
}

/** Every JWST time series in the archive, in one request. */
export async function jwstTimeSeries(request: typeof mastRequest = mastRequest): Promise<TimeSeriesRow[]> {
  return parseTimeSeries(await request({ service: 'Mast.Caom.Filtered', format: 'json', pagesize: 50_000, page: 1,
    params: { columns: COLUMNS, filters: [{ paramName: 'obs_collection', values: ['JWST'] }, { paramName: 'dataproduct_type', values: ['timeseries'] }] } }));
}

type Place = Pick<StarAstrometry, 'rightAscensionDegrees' | 'declinationDegrees' | 'positionEpochJulianYear' | 'properMotionRaMasPerYear' | 'properMotionDecMasPerYear'>;
/** The angle in arcseconds between a row and the star's place in the row's year. */
function apartArcsec(row: TimeSeriesRow, star: Place): number {
  const rad = Math.PI / 180, years = 2000 + (row.startMjd - MJD_J2000) / DAYS_PER_YEAR - star.positionEpochJulianYear;
  const dec = star.declinationDegrees + star.properMotionDecMasPerYear / 3.6e6 * years, ra = star.rightAscensionDegrees + star.properMotionRaMasPerYear / 3.6e6 * years / Math.cos(dec * rad);
  const cosine = Math.sin(dec * rad) * Math.sin(row.decDegrees * rad) + Math.cos(dec * rad) * Math.cos(row.decDegrees * rad) * Math.cos((ra - row.raDegrees) * rad);
  return Math.acos(Math.min(1, cosine)) / rad * 3600;
}

/** The visits of one star, each set on one of its planets' orbits. `orbit.transitTimeBmjdTdb` is a transit time. */
export function visitsOf(rows: readonly TimeSeriesRow[], star: Place, orbit: { readonly periodDays: number; readonly transitTimeBmjdTdb: number }): Visit[] {
  const near = rows.filter(row => apartArcsec(row, star) <= MATCH_ARCSEC).sort((a, b) => a.programme.localeCompare(b.programme) || a.instrument.localeCompare(b.instrument) || a.startMjd - b.startMjd);
  const spans: { rows: TimeSeriesRow[]; start: number; end: number }[] = [];
  for (const row of near) {
    const last = spans.at(-1);
    if (last && last.rows[0]!.programme === row.programme && last.rows[0]!.instrument === row.instrument && row.startMjd <= last.end + SAME_VISIT_DAYS) { last.rows.push(row); last.end = Math.max(last.end, row.endMjd); }
    else spans.push({ rows: [row], start: row.startMjd, end: row.endMjd });
  }
  return spans.map(({ rows: [first, ...rest], start, end }) => {
    // MAST's times are UTC and the orbit's BJD_TDB: the minutes between them do not move a visit of hours across a transit.
    const orbits = (end - start) / orbit.periodDays, turn = hostedOrbitPhaseBmjdTdb(orbit, start) / (2 * Math.PI), from = turn - Math.floor(turn);
    const holds = (phase: number) => [0, 1, 2].some(lap => from <= phase + lap && phase + lap <= from + orbits);
    const transit = holds(0), eclipse = holds(0.5), released = [first!, ...rest].map(row => row.releaseMjd);
    return { programme: first!.programme, instrument: first!.instrument, investigator: first!.investigator, title: first!.title, start: day(start), hours: Number(((end - start) * 24).toFixed(1)), orbits: Number(orbits.toFixed(2)),
      part: orbits >= 1 ? 'whole-orbit' : transit && eclipse ? 'transit-and-eclipse' : eclipse ? 'eclipse' : transit ? 'transit' : 'neither',
      publicOn: released.some(mjd => mjd === null) ? null : day(Math.max(...released as number[])) } satisfies Visit;
  }).sort((a, b) => a.start.localeCompare(b.start));
}

/** The planets with a recorded transit time whose star JWST has watched, each with its visits. A planet whose recorded epoch is
 * not a transit (an imaged planet's periastron) has no transit to set a visit by and is left out. */
export function planetsWatched(rows: readonly TimeSeriesRow[], planets: readonly HostedPlanetId[] = HOSTED_PLANET_IDS): Map<string, Visit[]> {
  const stars = new Set<string>(STAR_IDS), watched = new Map<string, Visit[]>();
  for (const id of planets) {
    const orbit = hostedOrbit(id), centre = hostedOrbitCentreId(id);
    if (!stars.has(centre) || typeof orbit.transitTimeBmjdTdb !== 'number' || (orbit.epochDefinition !== undefined && orbit.epochDefinition !== 'inferior-conjunction')) continue;
    const visits = visitsOf(rows, starAstrometry(centre as StarId), { periodDays: orbit.periodDays, transitTimeBmjdTdb: orbit.transitTimeBmjdTdb });
    if (visits.length) watched.set(id, visits);
  }
  return watched;
}

/** Whether a visit is public on a given day. A visit with no stated date is taken as not public. */
export const isPublic = (visit: Visit, today: string) => visit.publicOn !== null && visit.publicOn <= today;
const PARTS: Readonly<Record<VisitPart, string>> = { 'whole-orbit': 'a whole orbit', 'transit-and-eclipse': 'transit and eclipse', eclipse: 'eclipse', transit: 'transit', neither: 'neither transit nor eclipse' };
/** One visit as a line of a report. */
export const visitLine = (visit: Visit, today: string) => `${visit.start} · ${visit.instrument} · program ${visit.programme}${visit.investigator ? ` (${visit.investigator})` : ''} · ${visit.hours} h, ${visit.orbits} orbits · ${PARTS[visit.part]} · ${isPublic(visit, today) ? 'public' : visit.publicOn ? `private until ${visit.publicOn}` : 'no public date stated'}`;
