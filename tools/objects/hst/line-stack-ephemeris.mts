/** Where a moving target was, and how it was turned, at each exposure's middle — from JPL Horizons.
 *
 * A stack of a body that moves needs two things no exposure header holds: how big the body was on the sky, which fixes the
 * scale of the output grid, and the position angle of its north pole, which fixes the rotation. It also needs the planet the
 * body orbits, because a frame with the planet's disc behind the target, or its limb beside it in the slit, is not stacked.
 *
 * **Rows are matched back by their own timestamp.** Horizons returns a `TLIST` sorted by time, not in the order asked for.
 * Pairing returned rows with requested epochs by position silently mis-assigns the ephemeris whenever a batch is not already
 * in time order, and the pictures then come out of register — an off-centre, smeared disc. Every row here is keyed by the
 * date it carries.
 *
 * The raw responses are pinned beside the stack definition, so a re-run reads the same text rather than asking again; a
 * request the pinned file does not hold is only made when the run is told it may. */
import { readFile, writeFile } from 'node:fs/promises';
import { requireRecord, requireString } from '@cssearth/core';
import type { StackHorizons } from './line-stack-reduction.mts';
import { astroqueryText } from '../astronomy-packages/client.mts';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const DEGREE = Math.PI / 180;
/** Julian date of the Unix epoch, for turning a calendar date into the same scale the requests are made in. */
const UNIX_EPOCH_JD = 2440587.5;
/** Half a second, the tolerance a returned row's own timestamp is matched to. Horizons prints milliseconds. */
const MATCH_DAYS = 1 / 86400;

/** The Julian date a Horizons row carries, from the `YYYY-Mon-DD HH:MM:SS.sss` stamp it prints in its first field. */
export function horizonsRowJulianDate(stamp: string): number {
  const match = /^(\d{4})-([A-Z][a-z]{2})-(\d{2}) (\d{2}):(\d{2}):(\d{2})\.(\d{3})$/u.exec(stamp.trim());
  if (!match) throw new Error(`Unparsable Horizons date "${stamp}".`);
  const month = MONTHS.indexOf(match[2]!);
  if (month < 0) throw new Error(`Unknown Horizons month ${match[2]}.`);
  return Date.UTC(Number(match[1]), month, Number(match[3]), Number(match[4]), Number(match[5]), Number(match[6]), Number(match[7])) / 86400000 + UNIX_EPOCH_JD;
}

export interface HorizonsTable { readonly columns: readonly string[]; readonly rows: readonly (readonly string[])[] }
/** One response's column names and its rows, read from the table Horizons draws between `$$SOE` and `$$EOE`. */
export function parseHorizonsTable(text: string): HorizonsTable {
  const start = text.indexOf('$$SOE'), end = text.indexOf('$$EOE');
  if (start < 0 || end < start) throw new Error(`Horizons returned no ephemeris: ${text.slice(0, 400)}`);
  const heading = text.slice(0, start).split('\n').filter(line => line.trimStart().startsWith('Date__(UT)')).at(-1);
  if (!heading) throw new Error('Horizons returned a table with no column heading.');
  const columns = heading.split(',').map(name => name.trim());
  const rows = text.slice(start + '$$SOE'.length, end).trim().split('\n').map(line => line.split(',').map(cell => cell.trim()));
  for (const row of rows) if (row.length < columns.length) throw new Error('A Horizons row holds fewer fields than the table declares.');
  return { columns, rows };
}

/** The index of the column whose name begins with `prefix`, which is how Horizons writes a quantity's heading. */
export function horizonsColumn(table: HorizonsTable, prefix: string): number {
  const index = table.columns.findIndex(name => name.startsWith(prefix));
  if (index < 0) throw new Error(`Horizons returned no ${prefix} column.`);
  return index;
}

/** The returned rows in the order the epochs were asked for, each matched to its epoch by the timestamp it carries.
 * One row answers one epoch: a missing, repeated or ambiguous match is an error, never a guess. */
export function matchHorizonsEpochs(table: HorizonsTable, julianDates: readonly number[]): (readonly string[])[] {
  if (table.rows.length !== julianDates.length) throw new Error(`Horizons returned ${table.rows.length} rows for ${julianDates.length} epochs.`);
  const used = new Set<number>();
  return julianDates.map(julianDate => {
    const hits = table.rows.map((row, index) => ({ row, index })).filter(({ row }) => Math.abs(horizonsRowJulianDate(row[0]!) - julianDate) < MATCH_DAYS);
    if (hits.length !== 1) throw new Error(`${hits.length} Horizons rows match JD ${julianDate}.`);
    if (used.has(hits[0]!.index)) throw new Error(`One Horizons row answers two epochs near JD ${julianDate}.`);
    used.add(hits[0]!.index);
    return hits[0]!.row;
  });
}

/** How a request is named in the pinned responses: the observer, the body, the quantities and the epochs it asked for. */
export const horizonsRequestKey = (observer: string, command: string, quantities: string, julianDates: readonly number[]) =>
  `${observer}|${command}|${quantities}|${julianDates.map(julianDate => julianDate.toFixed(6)).join(' ')}`;

export type HorizonsResponses = Record<string, string>;
/** The pinned raw responses, as text keyed by request. */
export async function readHorizonsResponses(path: string): Promise<HorizonsResponses> {
  const value = requireRecord(JSON.parse(await readFile(path, 'utf8')), 'Horizons responses'), responses: HorizonsResponses = {};
  for (const [key, text] of Object.entries(value)) responses[key] = requireString(text, 'Horizons response');
  return responses;
}
export const writeHorizonsResponses = (path: string, responses: HorizonsResponses) => writeFile(path, `${JSON.stringify(responses, null, 1)}\n`);

/** One request's text, from the pinned responses when they hold it and from Horizons when the run may ask. */
export async function horizonsResponse(responses: HorizonsResponses, observer: string, command: string, quantities: string, julianDates: readonly number[],
  mayAsk: boolean): Promise<string> {
  const key = horizonsRequestKey(observer, command, quantities, julianDates);
  const pinned = responses[key];
  if (pinned !== undefined) return pinned;
  if (!mayAsk) throw new Error(`The pinned Horizons responses do not answer ${key}. Re-run with --fetch to ask for it.`);
  const text = await astroqueryText({ operation: 'horizons-ephemerides', id: command, location: observer,
    epochs: julianDates, quantities, raw: true });
  parseHorizonsTable(text);
  responses[key] = text;
  return text;
}

/** What one exposure's geometry comes to: the body's apparent size and pole angle, and where its planet is. */
export interface FrameEphemeris {
  readonly julianDate: number;
  /** Apparent diameter of the target, arcseconds. */
  readonly angularDiameterArcsec: number;
  /** Position angle of the target's north pole, degrees east of north (Horizons quantity 17). */
  readonly northPoleAngleDegrees: number;
  /** Sky distance from the target to the primary's limb, arcseconds. Negative when the primary's disc is behind the target. */
  readonly primaryLimbClearanceArcsec: number;
  readonly primarySeparationArcsec: number;
  /** Whether the target stands east of its primary on the sky, which is the leading elongation for a prograde moon. */
  readonly eastOfPrimary: boolean;
}

const number = (row: readonly string[], index: number, label: string) => {
  const value = Number(row[index]);
  if (!Number.isFinite(value)) throw new Error(`Horizons gave no ${label}: "${row[index]}".`);
  return value;
};

/** One exposure's geometry, from the target's row and its primary's row at the same epoch. */
export function frameEphemeris(julianDate: number, target: { table: HorizonsTable; row: readonly string[] }, primary: { table: HorizonsTable; row: readonly string[] }): FrameEphemeris {
  const rightAscension = number(target.row, horizonsColumn(target.table, 'R.A.'), 'right ascension');
  const declination = number(target.row, horizonsColumn(target.table, 'DEC'), 'declination');
  const angularDiameterArcsec = number(target.row, horizonsColumn(target.table, 'Ang-diam'), 'angular diameter');
  const northPoleAngleDegrees = number(target.row, horizonsColumn(target.table, 'NP.ang'), 'north pole angle');
  const primaryRightAscension = number(primary.row, horizonsColumn(primary.table, 'R.A.'), 'right ascension');
  const primaryDeclination = number(primary.row, horizonsColumn(primary.table, 'DEC'), 'declination');
  const primaryDiameterArcsec = number(primary.row, horizonsColumn(primary.table, 'Ang-diam'), 'angular diameter');
  // The target-to-primary offset on the sky, in arcseconds east and north. Right ascension grows eastward, so a primary at
  // smaller right ascension stands west of the target and the target is the eastern, leading one.
  const east = (primaryRightAscension - rightAscension) * Math.cos(declination * DEGREE) * 3600, north = (primaryDeclination - declination) * 3600;
  const separation = Math.hypot(east, north);
  return { julianDate, angularDiameterArcsec, northPoleAngleDegrees, primarySeparationArcsec: separation,
    primaryLimbClearanceArcsec: separation - primaryDiameterArcsec / 2, eastOfPrimary: east < 0 };
}

/** Every exposure's geometry, asked for in batches of the pinned size so that one pinned response answers one batch. */
export async function stackEphemerides(horizons: StackHorizons, responses: HorizonsResponses, julianDates: readonly number[], mayAsk: boolean): Promise<FrameEphemeris[]> {
  const ephemerides: FrameEphemeris[] = [];
  for (let start = 0; start < julianDates.length; start += horizons.epochsPerRequest) {
    const batch = julianDates.slice(start, start + horizons.epochsPerRequest);
    const target = parseHorizonsTable(await horizonsResponse(responses, horizons.observer, horizons.target, horizons.targetQuantities, batch, mayAsk));
    const primary = parseHorizonsTable(await horizonsResponse(responses, horizons.observer, horizons.primary, horizons.primaryQuantities, batch, mayAsk));
    const targetRows = matchHorizonsEpochs(target, batch), primaryRows = matchHorizonsEpochs(primary, batch);
    batch.forEach((julianDate, index) => ephemerides.push(frameEphemeris(julianDate, { table: target, row: targetRows[index]! }, { table: primary, row: primaryRows[index]! })));
  }
  return ephemerides;
}
