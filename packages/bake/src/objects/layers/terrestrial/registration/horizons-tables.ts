/** JPL Horizons tables for exact exposure starts: the observer table at each start and the heliocentric table at each start
 * less the light time over the observer range, asked in batches of 25 epochs (Horizons refuses longer time lists) and joined
 * into one table; and the refresh steps that ask for exactly those queries again. `packages/bake/cli/sphere-horizons.mts` writes
 * them beside a lens's frames and pins them in its manifest. */
import { horizonsRows, observerRowValues, rowJd } from './observer-cameras.ts';

export const HORIZONS_API = 'https://ssd.jpl.nasa.gov/api/horizons.api';
/** Seconds light takes to cross one astronomical unit. */
export const LIGHT_SECONDS_PER_AU = 499.0047838;
export const BATCH = 25;
/** The derivation matches a row to a frame when their times agree this closely. */
const MATCH_DAYS = 2 / 86_400;

/** The Horizons target a body's astronomy record already queries, such as `7;` for (7) Iris. */
export function horizonsCommand(record: unknown): string {
  const queries: string[] = [];
  (function walk(value: unknown) {
    if (typeof value === 'string' && value.startsWith(HORIZONS_API)) queries.push(value);
    else if (Array.isArray(value)) value.forEach(walk);
    else if (value && typeof value === 'object') Object.values(value).forEach(walk);
  })(record);
  const commands = [...new Set(queries.map(query => new URL(query).searchParams.get('COMMAND')?.replace(/^'|'$/g, '')).filter((command): command is string => !!command))];
  if (commands.length !== 1) throw new TypeError(`The astronomy record names ${commands.length ? commands.join(', ') : 'no'} Horizons target; one is needed.`);
  return commands[0];
}

const timeList = (epochs: readonly number[]) => `'${epochs.map(epoch => epoch.toFixed(9)).join(' ')}'`;
/** Paranal, where the ground-based lenses were exposed. A space telescope is a Horizons centre too: JWST is 500@-170. */
export const PARANAL = '309';
/** ALMA's array centre, which Horizons has no site code for: a centre written `coord@<body>:<east longitude°>,<latitude°>,<altitude km>`
 * is asked as geodetic coordinates. The values are the ones CASA's observatory table gives for ALMA. */
export const ALMA = 'coord@399:-67.7549,-23.0229,5.06';
export function observerQuery(command: string, epochs: readonly number[], center: string = PARANAL) {
  const [site, coordinates] = center.split(':');
  return new URLSearchParams({ format: 'text', COMMAND: `'${command}'`, EPHEM_TYPE: "'OBSERVER'", CENTER: `'${site}'`, ...(coordinates ? { COORD_TYPE: "'GEODETIC'", SITE_COORD: `'${coordinates}'` } : {}), TLIST: timeList(epochs),
    TLIST_TYPE: "'JD'", TIME_TYPE: "'UT'", QUANTITIES: "'1,13,20,24,43'", ANG_FORMAT: "'DEG'", CSV_FORMAT: "'NO'" });
}
export function heliocentricQuery(command: string, epochs: readonly number[]) {
  return new URLSearchParams({ format: 'text', COMMAND: `'${command}'`, EPHEM_TYPE: "'VECTORS'", CENTER: "'500@10'", TLIST: timeList(epochs),
    TLIST_TYPE: "'JD'", REF_PLANE: "'FRAME'", REF_SYSTEM: "'ICRF'", VEC_TABLE: "'1'", OUT_UNITS: "'AU-D'", CSV_FORMAT: "'NO'" });
}

/** One table from batched responses: the first response's header and footer around every batch's rows, in order. */
export function joinResponses(responses: readonly string[]): string {
  const blocks = responses.map(text => {
    const start = text.indexOf('$$SOE'), end = text.indexOf('$$EOE');
    if (start < 0 || end < 0) throw new Error(`A Horizons response has no data block: ${text.slice(0, 300)}`);
    return text.slice(start + 5, end).replace(/^\r?\n/, '').replace(/\r?\n$/, '');
  });
  const first = responses[0], start = first.indexOf('$$SOE'), end = first.indexOf('$$EOE');
  return `${first.slice(0, start + 5)}\n${blocks.join('\n')}\n${first.slice(end)}`;
}

export type HorizonsRequest = (url: string) => Promise<string>;
const request: HorizonsRequest = async url => {
  const response = await fetch(url, { signal: AbortSignal.timeout(90_000) });
  const text = await response.text();
  if (!response.ok) throw new Error(`Horizons answered ${response.status}: ${text.slice(0, 300)}`);
  return text;
};
async function batched(make: (epochs: readonly number[]) => URLSearchParams, epochs: readonly number[], ask: HorizonsRequest) {
  const responses: string[] = [];
  for (let index = 0; index < epochs.length; index += BATCH) responses.push(await ask(`${HORIZONS_API}?${make(epochs.slice(index, index + BATCH))}`));
  return joinResponses(responses);
}

/** The heliocentric epochs: each exposure start less the light time over its observer row's range. */
function heliocentricEpochs(epochs: readonly number[], observer: string) {
  const rows = horizonsRows(observer);
  if (rows.length !== epochs.length) throw new Error(`Horizons returned ${rows.length} observer rows for ${epochs.length} exposure starts.`);
  rows.forEach((row, index) => { if (Math.abs(rowJd(row) - epochs[index]) >= MATCH_DAYS) throw new Error(`Observer row ${index + 1} is not at its exposure start: ${row.trim()}`); });
  const ranges = rows.map(row => observerRowValues(row).rangeAu);
  if (!ranges.every(range => range > 0)) throw new Error('An observer row states no range.');
  return epochs.map((epoch, index) => epoch - ranges[index] * LIGHT_SECONDS_PER_AU / 86_400);
}

/** Both tables for exposure starts, one observer row per distinct start in time order and one heliocentric row for each. */
export async function horizonsTables(command: string, starts: readonly number[], ask: HorizonsRequest = request, center: string = PARANAL) {
  const epochs = [...new Set(starts)].sort((a, b) => a - b);
  const observer = await batched(list => observerQuery(command, list, center), epochs, ask);
  const heliocentric = await batched(list => heliocentricQuery(command, list), heliocentricEpochs(epochs, observer), ask);
  const vectors = horizonsRows(heliocentric).filter(line => line.trimStart().startsWith('X ='));
  if (vectors.length !== epochs.length) throw new Error(`Horizons returned ${vectors.length} heliocentric vectors for ${epochs.length} epochs.`);
  return { observer, heliocentric, epochs };
}

/** The acquisition step that asks Horizons for a pinned time-list table again. */
export const HORIZONS_TIME_LIST = 'horizons-time-list';

/**
 * The refresh steps that ask Horizons again for exactly the queries a lens's two tables answer: the parameters without
 * the time list, and the epochs the time list held. Horizons prints the date it was asked in each response's header,
 * so a refresh compares the rows, not the bytes.
 */
export function horizonsRefreshOperations(command: string, starts: readonly number[], observer: string, paths: { observer: string; heliocentric: string }, center: string = PARANAL) {
  const epochs = [...new Set(starts)].sort((a, b) => a - b);
  const parameters = (query: URLSearchParams) => { query.delete('TLIST'); return Object.fromEntries(query); };
  return [
    { kind: HORIZONS_TIME_LIST, groups: ['refresh'], path: paths.observer, url: HORIZONS_API, parameters: parameters(observerQuery(command, [], center)), epochs },
    { kind: HORIZONS_TIME_LIST, groups: ['refresh'], path: paths.heliocentric, url: HORIZONS_API, parameters: parameters(heliocentricQuery(command, [])), epochs: heliocentricEpochs(epochs, observer) },
  ];
}

/** The rows a time-list query answers, asked in batches as Horizons requires, in order. */
export async function timeListRows(url: string, parameters: Readonly<Record<string, string>>, epochs: readonly number[], ask: HorizonsRequest = request) {
  const responses: string[] = [];
  for (let index = 0; index < epochs.length; index += BATCH) responses.push(await ask(`${url}?${new URLSearchParams({ ...parameters, TLIST: timeList(epochs.slice(index, index + BATCH)) })}`));
  return horizonsRows(joinResponses(responses));
}
