#!/usr/bin/env node
/** The Hubble ledger: what the public archive holds in each instrument configuration, which of it this repository can already
 * re-calibrate, and which of the objects it ships Hubble has observed.
 *
 *   node tools/objects/hst/archive-ledger.mts [--write] [--local]
 *
 * Read only against MAST. Hubble's archive is a hundred times the size of a single programme's listing — about 1.5 million
 * observations — so nothing is listed that can be counted. Each configuration's total is a server-side COUNT_BIG, and the
 * counts are checked against the collection's own total: whatever they do not account for is reported as other
 * configurations, so a configuration this file does not name cannot go unnoticed.
 *
 * Rows are pulled in only two cases. Every public moving-target observation is listed, because that is the Solar System and it
 * is 3% of the archive; a target is matched to a shipped object by name. For a body that does not move, the archive is asked
 * what lies within a small radius of where the object's own package puts it, which is one query per positioned object.
 *
 * Each configuration's state is read from this repository, not declared: the programs pinned in tools/objects/hst/programs and
 * the ones that carry a reproduction receipt. --write replaces data/hst/ledger.json and docs/hubble-ledger.md. --local rewrites
 * only that state, from the ledger already on disk: when a program is pinned or a receipt written, nothing the archive said has
 * changed, and a pass that takes half an hour should not be repeated to record it.
 *
 * Every request is given its own deadline and tried three times. A pass asks MAST about forty times and takes tens of minutes,
 * and the cone searches are where it slows: one around M42 returned 7,526 rows in about a minute, and others stopped answering
 * altogether partway through a pass. A count or a listing that will not answer stops the pass, because the ledger would be
 * wrong without it; a cone search that will not answer is recorded as unanswered and the pass goes on, because which objects
 * were asked and which were not is itself the honest result. */
import { readdir, readFile, writeFile, mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { hasErrorCode, isRecord, requireArray, requireFiniteNumber, requireRecord, requireString } from '../../source-values.mts';
import { mastRequest } from '../jwst/mast.mts';
import { parseHstProgram, PROGRAMS } from './archive.mts';
import { PIPELINES } from './calibrate.mts';

const REPOSITORY = resolve(import.meta.dirname, '../../..');
export const LEDGER = resolve(REPOSITORY, 'data/hst/ledger.json');
export const GUIDE = resolve(REPOSITORY, 'docs/hubble-ledger.md');

/** MAST's HST configurations (CAOM's instrument_name), what each records, and the tool that re-calibrates it here. */
export const HST_CONFIGURATIONS: readonly { readonly configuration: string; readonly records: string; readonly draws: string; readonly tool: string | null; readonly note?: string }[] = [
  { configuration: 'ACS/WFC', records: 'wide-field pictures, 0.35–1.1 µm', draws: 'pictures of galaxies, nebulae and Solar System bodies', tool: 'tools/objects/hst/calibrate.mts' },
  { configuration: 'ACS/HRC', records: 'high-resolution pictures and slitless spectra', draws: 'pictures of small bodies', tool: 'tools/objects/hst/calibrate.mts', note: 'Not run here; the detector stopped working in 2007.' },
  { configuration: 'ACS/SBC', records: 'far-ultraviolet pictures and prism spectra', draws: 'aurorae and gas around a body', tool: 'tools/objects/hst/calibrate.mts' },
  { configuration: 'WFC3/UVIS', records: 'pictures, 0.2–1 µm', draws: 'pictures of planets, moons and nebulae', tool: 'tools/objects/hst/calibrate.mts' },
  { configuration: 'WFC3/IR', records: 'pictures and slitless spectra, 0.8–1.7 µm', draws: 'pictures; exoplanet transit spectra', tool: null, note: 'calwf3 handles it; no IR exposure has been re-calibrated here.' },
  { configuration: 'STIS/CCD', records: 'spectra and pictures, 0.2–1 µm', draws: 'surface and atmosphere spectra', tool: 'tools/objects/hst/calibrate.mts' },
  { configuration: 'STIS/NUV-MAMA', records: 'near-ultraviolet spectra and pictures', draws: 'ultraviolet spectra of a body', tool: 'tools/objects/hst/calibrate.mts', note: 'calstis handles it; no NUV exposure has been re-calibrated here.' },
  { configuration: 'STIS/FUV-MAMA', records: 'far-ultraviolet spectra and pictures', draws: 'aurorae and escaping gas', tool: 'tools/objects/hst/calibrate.mts' },
  { configuration: 'STIS', records: 'co-added spectra the archive builds from several visits (HASP)', draws: 'nothing on its own', tool: null, note: 'A product of products; there is no raw exposure to re-calibrate.' },
  { configuration: 'COS/FUV', records: 'far-ultraviolet point-source spectra', draws: 'nothing yet', tool: null, note: 'calcos is not installed.' },
  { configuration: 'COS/NUV', records: 'near-ultraviolet point-source spectra', draws: 'nothing yet', tool: null, note: 'calcos is not installed.' },
  { configuration: 'WFPC2/PC', records: 'pictures on the planetary camera, 1994–2009', draws: 'pictures of Solar System bodies', tool: null, note: 'calwp2 is retired and not in hstcal.' },
  { configuration: 'WFPC2/WFC', records: 'pictures on the three wide-field chips', draws: 'pictures of extended objects', tool: null, note: 'calwp2 is retired and not in hstcal.' },
  { configuration: 'WFPC2', records: 'WFPC2 products the catalogue does not assign to a chip', draws: 'nothing on its own', tool: null },
  { configuration: 'NICMOS/NIC1', records: 'near-infrared pictures at the finest sampling', draws: 'nothing yet', tool: null, note: 'calnica is retired and not in hstcal.' },
  { configuration: 'NICMOS/NIC2', records: 'near-infrared pictures and coronagraphy', draws: 'nothing yet', tool: null, note: 'calnica is retired and not in hstcal.' },
  { configuration: 'NICMOS/NIC3', records: 'near-infrared pictures and grism spectra', draws: 'nothing yet', tool: null, note: 'calnica is retired and not in hstcal.' },
  { configuration: 'FOC/96', records: 'faint-object camera pictures, 1990–2002', draws: 'nothing yet', tool: null, note: 'Its pipeline is retired.' },
  { configuration: 'FOC/48', records: 'faint-object camera pictures in its other format', draws: 'nothing yet', tool: null, note: 'Its pipeline is retired.' },
  { configuration: 'FOS/BL', records: 'faint-object spectrograph, blue detector, 1990–1997', draws: 'nothing yet', tool: null, note: 'Its pipeline is retired.' },
  { configuration: 'FOS/RD', records: 'faint-object spectrograph, red detector, 1990–1997', draws: 'nothing yet', tool: null, note: 'Its pipeline is retired.' },
  { configuration: 'WFPC/PC', records: 'the first wide-field camera, 1990–1993', draws: 'nothing yet', tool: null, note: 'Its pipeline is retired.' },
  { configuration: 'ACS', records: 'ACS products the catalogue does not assign to a detector', draws: 'nothing on its own', tool: null },
  { configuration: 'COS-STIS', records: 'co-added spectra the archive builds from COS and STIS visits together (HASP)', draws: 'nothing on its own', tool: null, note: 'A product of products.' },
  { configuration: 'COS', records: 'COS products the catalogue does not assign to a detector', draws: 'nothing on its own', tool: null },
  { configuration: 'HRS', records: 'the Goddard high resolution spectrograph, 1990–1997', draws: 'nothing yet', tool: null, note: 'Its pipeline is retired.' },
  { configuration: 'HRS/1', records: 'the same spectrograph on its first detector', draws: 'nothing yet', tool: null, note: 'Its pipeline is retired.' },
  { configuration: 'HRS/2', records: 'the same spectrograph on its second detector', draws: 'nothing yet', tool: null, note: 'Its pipeline is retired.' },
  { configuration: 'HSP/UNK/POL', records: 'the high speed photometer, polarimetry, 1990–1993', draws: 'nothing: brightness in time, not pictures', tool: null },
  { configuration: 'HSP/UNK/UV1', records: 'the high speed photometer, first ultraviolet channel', draws: 'nothing: brightness in time', tool: null },
  { configuration: 'HSP/UNK/UV2', records: 'the high speed photometer, second ultraviolet channel', draws: 'nothing: brightness in time', tool: null },
  { configuration: 'HSP/UNK/VIS', records: 'the high speed photometer, visible channel', draws: 'nothing: brightness in time', tool: null },
  { configuration: 'WFPC/WFC', records: 'the first wide-field camera, wide-field chips', draws: 'nothing yet', tool: null, note: 'Its pipeline is retired.' },
  { configuration: 'FGS', records: 'fine guidance sensor astrometry and interferometry', draws: 'nothing: positions, not pictures', tool: null },
];

export interface ShippedObject { readonly id: string; readonly names: readonly string[]; readonly position?: { readonly raDeg: number; readonly decDeg: number; readonly radiusDeg: number } }
export interface ArchiveRow { readonly observation: string; readonly target: string; readonly programme: string; readonly configuration: string }

const normalise = (name: string) => name.toUpperCase().replace(/[^A-Z0-9]/gu, '');
/** 2060 CHIRON and (2060) Chiron name Chiron. */
const withoutNumber = (name: string) => name.replace(/^\(?\d+\)?[\s_-]+(?=[A-Za-z])/u, '');
/** A pointing beside the target, or at nothing: sky subtraction, a guide-star acquisition, a calibration exposure. */
export const isNotAnObject = (name: string) => /(^|[^A-Z])(BG|BKG|BKGD|BACKGROUND|OFFSET|SKY|BLANK|ACQ|ACQUISITION|ACQFAIL|WAVE|WAVECAL|DARK|BIAS|FLAT|CCDFLAT|INTFLAT|NONE|ANY|DUMMY)([^A-Z]|$)/iu.test(name);

const indexes = new WeakMap<readonly ShippedObject[], Map<string, string>>();
/** Every name a Hubble proposer might have written, to the object it names. */
function nameIndex(objects: readonly ShippedObject[]) {
  let index = indexes.get(objects);
  if (index) return index;
  index = new Map<string, string>();
  // Dione is Saturn's moon and asteroid 106: a plain name goes to the object whose id is the plain name, and a numbered body
  // is also found with its number (106 DIONE, DIONE-106). An id outranks a display name.
  const numbered = (id: string) => /-\d+$/u.test(id);
  const ordered = [...objects].sort((a, b) => Number(numbered(a.id)) - Number(numbered(b.id)));
  for (const [rank, object] of [...ordered.map(object => [0, object] as const), ...ordered.map(object => [1, object] as const)]) {
    for (const name of rank === 0 ? [object.id] : object.names) {
      const key = normalise(name);
      if (key && !index.has(key)) index.set(key, object.id);
      const number = /-(\d+)$/u.exec(object.id)?.[1];
      if (number && key) index.set(`${number}${key}`, object.id);
    }
  }
  indexes.set(objects, index);
  return index;
}

/** The shipped object a moving target names, or none. A proposer writes the body and then what the visit is for
 * (EUROPA-ECLIPSE, EUROPA-45), so the name is also read by its first word; a pointing that is not an object is never one. */
export function matchTarget(target: string, objects: readonly ShippedObject[]): string | null {
  if (!target.trim() || isNotAnObject(target)) return null;
  const byName = nameIndex(objects);
  const whole = byName.get(normalise(target)) ?? byName.get(normalise(withoutNumber(target)));
  if (whole) return whole;
  const first = withoutNumber(target).split(/[-_\s+]/u)[0];
  return first ? byName.get(normalise(first)) ?? null : null;
}

const readJson = async (path: string): Promise<unknown> =>
  JSON.parse(await readFile(path, 'utf8').catch(error => { if (hasErrorCode(error, 'ENOENT')) return 'null'; throw error; }));
const firstSkyPosition = (value: unknown): { raDeg: number; decDeg: number } | undefined => {
  if (Array.isArray(value)) { for (const item of value) { const found = firstSkyPosition(item); if (found) return found; } return undefined; }
  if (!isRecord(value)) return undefined;
  if (typeof value.raDeg === 'number' && typeof value.decDeg === 'number') return { raDeg: value.raDeg, decDeg: value.decDeg };
  for (const item of Object.values(value)) { const found = firstSkyPosition(item); if (found) return found; }
  return undefined;
};

/** Every object package, with the names a proposer might have used and, for what does not move, where it is on the sky: a star
 * within half an arcminute, a nebula within a sixth of a degree of the centre its own recipe records. */
export async function shippedObjects(repository = REPOSITORY): Promise<ShippedObject[]> {
  const ids = (await readdir(resolve(repository, 'src/objects'), { withFileTypes: true })).filter(entry => entry.isDirectory()).map(entry => entry.name);
  return Promise.all(ids.map(async id => {
    const body = await readJson(resolve(repository, 'packages/astronomy/data/bodies', `${id}.json`));
    const names = [id], physical = isRecord(body) && isRecord(body.physical) ? body.physical : undefined;
    if (physical && typeof physical.name === 'string') names.push(physical.name);
    if (isRecord(body) && isRecord(body.star))
      return { id, names, position: { raDeg: requireFiniteNumber(body.star.rightAscensionDegrees), decDeg: requireFiniteNumber(body.star.declinationDegrees), radiusDeg: 0.5 / 60 } };
    const nebula = firstSkyPosition(await readJson(resolve(repository, 'src/objects', id, 'source/nebula.json')));
    return nebula ? { id, names, position: { ...nebula, radiusDeg: 1 / 6 } } : { id, names };
  }));
}

const PUBLIC_HST = [{ paramName: 'obs_collection', values: ['HST'] }, { paramName: 'dataRights', values: ['PUBLIC'] }];
const only = (data: readonly Record<string, unknown>[]) => requireFiniteNumber(Object.values(data[0] ?? {})[0], 'COUNT_BIG');
const DEADLINE_MS = 240_000, ATTEMPTS = 3;

/** One MAST request, abandoned and asked again if it does not answer within its deadline. With `optional`, a request that never
 * answers gives null instead of stopping the pass. */
async function asked(label: string, request: Record<string, unknown>): Promise<Record<string, unknown>[]>;
async function asked(label: string, request: Record<string, unknown>, optional: true): Promise<Record<string, unknown>[] | null>;
async function asked(label: string, request: Record<string, unknown>, optional = false): Promise<Record<string, unknown>[] | null> {
  for (let attempt = 1; ; attempt++) {
    let timer: NodeJS.Timeout | undefined;
    try {
      return await Promise.race([mastRequest(request),
        new Promise<never>((_, fail) => { timer = setTimeout(() => fail(new Error(`${label} did not answer within ${DEADLINE_MS / 1000} s.`)), DEADLINE_MS); })]);
    } catch (error) {
      const said = error instanceof Error ? error.message : String(error);
      if (attempt < ATTEMPTS) { console.warn(`${label}: attempt ${attempt} failed (${said}); asking again.`); continue; }
      if (!optional) throw error;
      console.warn(`${label}: unanswered after ${ATTEMPTS} attempts (${said}).`);
      return null;
    } finally { clearTimeout(timer); }
  }
}

/** How many public HST observations match, counted by the archive itself. */
export async function archiveCount(extra: readonly Record<string, unknown>[] = []) {
  return only(await asked('count', { service: 'Mast.Caom.Filtered', format: 'json', params: { columns: 'COUNT_BIG(*)', filters: [...PUBLIC_HST, ...extra] } }));
}

const PAGE = 50_000;
/** Every public moving-target observation: the Solar System, which is small enough to list. */
export async function movingRows(): Promise<ArchiveRow[]> {
  const rows: ArchiveRow[] = [];
  for (let page = 1, more = true; more; page++) {
    const data = await asked(`moving targets, page ${page}`, { service: 'Mast.Caom.Filtered', format: 'json', pagesize: PAGE, page,
      params: { columns: 'obs_id,target_name,proposal_id,instrument_name', filters: [...PUBLIC_HST, { paramName: 'mtFlag', values: [true] }] } });
    for (const row of data) rows.push({ observation: requireString(row.obs_id), target: String(row.target_name ?? ''), programme: String(row.proposal_id), configuration: String(row.instrument_name ?? '') });
    more = data.length === PAGE;
    if (page > 40) throw new RangeError('The moving-target listing did not end.');
  }
  return rows;
}

/** What the archive holds within one object's own radius on the sky, or null if it would not answer. A target the object's
 * package would not claim by name is still counted: a pointing at a star is a pointing at that star. */
export async function fixedRows(object: ShippedObject): Promise<ArchiveRow[] | null> {
  const { raDeg, decDeg, radiusDeg } = object.position!;
  const data = await asked(object.id, { service: 'Mast.Caom.Filtered.Position', format: 'json', pagesize: PAGE,
    params: { columns: 'obs_id,target_name,proposal_id,instrument_name', filters: PUBLIC_HST, position: `${raDeg}, ${decDeg}, ${radiusDeg}` } }, true);
  if (!data) return null;
  if (data.length === PAGE) throw new RangeError(`${object.id}: the position listing is cut at its page size.`);
  return data.map(row => ({ observation: requireString(row.obs_id), target: String(row.target_name ?? ''), programme: String(row.proposal_id), configuration: String(row.instrument_name ?? '') }));
}

/** What this repository holds for each configuration: the programs pinned, and those a reproduction receipt was written for. */
export async function repositoryState(repository = REPOSITORY) {
  const directory = resolve(repository, 'tools/objects/hst/programs'), files = await readdir(directory);
  const state = new Map<string, { programs: Set<string>; checked: Set<string> }>();
  for (const file of files.filter(name => name.endsWith('.json') && !name.endsWith('.reproduction.json'))) {
    const program = parseHstProgram(await readJson(resolve(directory, file)));
    for (const observation of program.observations) {
      const configuration = `${observation.instrument}/${observation.detector}`;
      const held = state.get(configuration) ?? { programs: new Set(), checked: new Set() };
      state.set(configuration, held);
      held.programs.add(program.id);
      // A receipt is named for the product it checked, and an association's products carry its own rootname or a member's, not
      // the observation's (europa-11085.j9xe05011_sfl). Any rootname of the observation counts.
      const rootnames = [observation.observation, ...observation.association ? [observation.association.product, ...observation.association.members.map(member => member.rootname)] : []];
      if (files.some(name => name.endsWith('.reproduction.json') && rootnames.some(rootname => name.startsWith(`${program.id}.${rootname}_`)))) held.checked.add(program.id);
    }
  }
  return state;
}

export interface Ledger {
  readonly schema: 'cssearth-hst-ledger@1';
  readonly archiveDate: string;
  readonly observations: { readonly collection: number; readonly counted: number; readonly other: number; readonly moving: number };
  readonly configurations: readonly { readonly configuration: string; readonly records: string; readonly draws: string; readonly tool: string | null; readonly note?: string;
    readonly observations: number; readonly movingObservations: number; readonly shippedObjects: number; readonly programs: readonly string[]; readonly checked: readonly string[] }[];
  readonly movingTargets: readonly { readonly object: string; readonly observations: number; readonly configurations: readonly string[] }[];
  readonly fixedTargets: readonly { readonly object: string; readonly radiusDeg: number; readonly observations: number; readonly configurations: readonly string[] }[];
  /** Positioned objects MAST would not answer a cone search for in this pass. */
  readonly unansweredTargets: readonly string[];
}

export function buildLedger(counts: ReadonlyMap<string, number>, collection: number, moving: readonly ArchiveRow[],
  fixed: ReadonlyMap<string, readonly ArchiveRow[] | null>, objects: readonly ShippedObject[], held: Awaited<ReturnType<typeof repositoryState>>, archiveDate: string): Ledger {
  const matched = moving.map(row => ({ row, object: matchTarget(row.target, objects) }));
  const perObject = new Map<string, ArchiveRow[]>();
  for (const { row, object } of matched) if (object) (perObject.get(object) ?? perObject.set(object, []).get(object)!).push(row);
  const configurations = HST_CONFIGURATIONS.map(entry => {
    const rows = matched.filter(({ row }) => row.configuration === entry.configuration);
    const state = held.get(entry.configuration);
    return { ...entry, observations: counts.get(entry.configuration) ?? 0, movingObservations: rows.length,
      shippedObjects: new Set(rows.map(({ object }) => object).filter((id): id is string => id !== null)).size,
      programs: [...state?.programs ?? []].sort(), checked: [...state?.checked ?? []].sort() };
  });
  const counted = [...counts.values()].reduce((sum, value) => sum + value, 0);
  const listOf = (rows: readonly ArchiveRow[]) => [...new Set(rows.map(row => row.configuration))].sort();
  return {
    schema: 'cssearth-hst-ledger@1', archiveDate,
    observations: { collection, counted, other: collection - counted, moving: moving.length },
    configurations,
    movingTargets: [...perObject].map(([object, rows]) => ({ object, observations: rows.length, configurations: listOf(rows) }))
      .sort((a, b) => b.observations - a.observations || a.object.localeCompare(b.object, 'en')),
    fixedTargets: [...fixed].flatMap(([object, rows]) => rows === null ? [] :
      [{ object, radiusDeg: objects.find(entry => entry.id === object)!.position!.radiusDeg, observations: rows.length, configurations: listOf(rows) }])
      .filter(entry => entry.observations > 0).sort((a, b) => b.observations - a.observations || a.object.localeCompare(b.object, 'en')),
    unansweredTargets: [...fixed].flatMap(([object, rows]) => rows === null ? [object] : []).sort(),
  };
}

export function parseLedger(value: unknown): Ledger {
  const row = requireRecord(value, 'HST ledger');
  if (row.schema !== 'cssearth-hst-ledger@1') throw new TypeError('Unsupported HST ledger.');
  const counts = requireRecord(row.observations, 'Observation counts');
  const observations = Object.fromEntries((['collection', 'counted', 'other', 'moving'] as const)
    .map(key => [key, requireFiniteNumber(counts[key], key)])) as Ledger['observations'];
  const names = (list: unknown, label: string) => requireArray(list, label).map(name => requireString(name, label));
  const configurations = requireArray(row.configurations, 'Configurations').map(raw => {
    const entry = requireRecord(raw, 'Configuration');
    return { ...entry, configuration: requireString(entry.configuration, 'Configuration name'), records: requireString(entry.records, 'Records'),
      draws: requireString(entry.draws, 'Draws'), tool: entry.tool === null ? null : requireString(entry.tool, 'Tool'),
      observations: requireFiniteNumber(entry.observations, 'Observations'), movingObservations: requireFiniteNumber(entry.movingObservations, 'Moving observations'),
      shippedObjects: requireFiniteNumber(entry.shippedObjects, 'Shipped objects'),
      programs: names(entry.programs, 'Programs'), checked: names(entry.checked, 'Checked') };
  }) as Ledger['configurations'];
  const targets = (list: unknown, label: string, radius: boolean) => requireArray(list, label).map(raw => {
    const entry = requireRecord(raw, label);
    return { ...entry, object: requireString(entry.object, 'Object'), observations: requireFiniteNumber(entry.observations, 'Observations'),
      configurations: names(entry.configurations, 'Configurations'), ...(radius ? { radiusDeg: requireFiniteNumber(entry.radiusDeg, 'Radius') } : {}) };
  });
  return { schema: row.schema, archiveDate: requireString(row.archiveDate, 'Archive date'), observations, configurations,
    movingTargets: targets(row.movingTargets, 'Moving targets', false) as Ledger['movingTargets'],
    fixedTargets: targets(row.fixedTargets, 'Fixed targets', true) as Ledger['fixedTargets'],
    unansweredTargets: names(row.unansweredTargets, 'Unanswered targets') };
}

const thousands = (value: number) => value.toLocaleString('en-US');

export function ledgerGuide(ledger: Ledger): string {
  const reduced = ledger.configurations.filter(entry => entry.checked.length);
  const lines = [
    '# Hubble ledger',
    '',
    `What Hubble's public archive holds, what this repository can re-calibrate from raw, and which of the objects it ships Hubble has observed. Written by [\`archive-ledger.mts\`](../tools/objects/hst/archive-ledger.mts) from MAST on ${ledger.archiveDate}; the route it checks is [Hubble](hubble.md).`,
    '',
    `The collection holds ${thousands(ledger.observations.collection)} public observations. The configurations below account for ${thousands(ledger.observations.counted)}; ${thousands(ledger.observations.other)} are in configurations this file does not name. ${thousands(ledger.observations.moving)} observations are of moving targets, which is the Solar System.`,
    '',
    '## Configurations',
    '',
    '| Configuration | Observations | Of moving targets | Records | Re-calibrated here |',
    '| --- | ---: | ---: | --- | --- |',
    ...ledger.configurations.map(entry => `| ${entry.configuration} | ${thousands(entry.observations)} | ${thousands(entry.movingObservations)} | ${entry.records} | ${
      entry.checked.length ? entry.checked.join(', ') : entry.programs.length ? `pinned: ${entry.programs.join(', ')}` : entry.note ?? 'no'} |`),
    '',
    reduced.length
      ? `Re-calibrated and checked against the archive's own product: ${reduced.map(entry => `${entry.configuration} (${entry.checked.join(', ')})`).join('; ')}. Every other configuration is counted here and nothing more.`
      : 'Nothing has been re-calibrated yet.',
    '',
    '## Moving targets',
    '',
    'Every public moving-target observation, matched to a shipped object by name. A pointing at the sky beside a body, at a guide star or at a calibration lamp is not an object.',
    '',
    '| Object | Observations | Configurations |',
    '| --- | ---: | --- |',
    ...ledger.movingTargets.map(entry => `| ${entry.object} | ${thousands(entry.observations)} | ${entry.configurations.join(', ')} |`),
    '',
    '## Objects that do not move',
    '',
    "What the archive holds within each positioned object's own radius on the sky.",
    '',
    '| Object | Radius | Observations | Configurations |',
    '| --- | ---: | ---: | --- |',
    ...ledger.fixedTargets.map(entry => `| ${entry.object} | ${(entry.radiusDeg * 60).toFixed(1)}′ | ${thousands(entry.observations)} | ${entry.configurations.join(', ')} |`),
    '',
    '## Limits',
    '',
    "- Counts are the archive's own, by configuration. Nothing outside a moving target or a positioned object's radius is listed, because the fixed-target archive is far too large to pull.",
    '- A moving target is matched by its name alone. A body a proposer named in some other way is missed, and a name shared with a body this repository does not ship is not matched.',
    "- An object that does not move and has no position in its package (no star record, no nebula recipe) is not searched for.",
    ledger.unansweredTargets.length
      ? `- MAST would not answer a cone search for ${ledger.unansweredTargets.join(', ')} in this pass, after three attempts each. Those objects are missing from the table above, not empty.`
      : '- Every positioned object was asked for and answered.',
    '- The counts are of observations as the catalogue groups them, which for HST is one exposure or one association, not one file.',
    '',
  ];
  return `${lines.join('\n')}`;
}

/** The ledger on disk with each configuration's pinned and checked programs taken again from this repository. */
export async function withRepositoryState(ledger: Ledger, held: Awaited<ReturnType<typeof repositoryState>>): Promise<Ledger> {
  return { ...ledger, configurations: ledger.configurations.map(entry => ({ ...entry,
    programs: [...held.get(entry.configuration)?.programs ?? []].sort(), checked: [...held.get(entry.configuration)?.checked ?? []].sort() })) };
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const write = process.argv.includes('--write');
  if (process.argv.includes('--local')) {
    const ledger = await withRepositoryState(parseLedger(await readJson(LEDGER)), await repositoryState());
    await writeFile(LEDGER, `${JSON.stringify(ledger, null, 2)}\n`);
    await writeFile(GUIDE, ledgerGuide(ledger));
    console.log(`HST_LEDGER ${LEDGER} ${GUIDE} (repository state only)`);
    process.exit(0);
  }
  const objects = await shippedObjects();
  const collection = await archiveCount();
  const counts = new Map<string, number>();
  for (const { configuration } of HST_CONFIGURATIONS) {
    counts.set(configuration, await archiveCount([{ paramName: 'instrument_name', values: [configuration] }]));
    console.log(`${configuration}: ${counts.get(configuration)}`);
  }
  const moving = await movingRows();
  console.log(`moving-target observations: ${moving.length}`);
  const fixed = new Map<string, ArchiveRow[] | null>();
  for (const object of objects.filter(entry => entry.position)) {
    const rows = await fixedRows(object);
    fixed.set(object.id, rows);
    console.log(`${object.id}: ${rows === null ? 'unanswered' : `${rows.length} within ${(object.position!.radiusDeg * 60).toFixed(1)} arcmin`}`);
  }
  const ledger = buildLedger(counts, collection, moving, fixed, objects, await repositoryState(), new Date().toISOString().slice(0, 10));
  if (!write) console.log(JSON.stringify(ledger.observations));
  else {
    await mkdir(resolve(LEDGER, '..'), { recursive: true });
    await writeFile(LEDGER, `${JSON.stringify(ledger, null, 2)}\n`);
    await writeFile(GUIDE, ledgerGuide(ledger));
    console.log(`HST_LEDGER ${LEDGER} ${GUIDE}`);
  }
}
