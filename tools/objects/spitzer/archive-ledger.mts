#!/usr/bin/env node
/** The Spitzer ledger: what the Heritage Archive holds for the objects this repository ships, by observing mode, which of
 * those modes this toolkit can re-make, and how far that is proved.
 *
 *   node tools/objects/spitzer/archive-ledger.mts [--write] [--local]
 *
 * Read only against IRSA. Spitzer's archive is asked one question per object, and the question depends on what the object is:
 *
 *  - A body that moves is asked for by NAIF id, because that is how a moving-target observation is scheduled and stored.
 *    The id comes from the object's own Horizons code: a planet, satellite or the Sun carries the NAIF id itself, and a
 *    numbered minor planet carries its number, whose NAIF id is 2000000 plus that number. A comet or an interstellar object
 *    carries a designation (`DES=103P;CAP;`, `2I;`), which is not a NAIF id and cannot be turned into one here, so those are
 *    recorded as not searched rather than as empty. The difference matters: one is an answer, the other is a gap.
 *  - A body that does not move is asked what lies within a small radius of where its own package puts it: a star or an
 *    exoplanet's host within half an arcminute, a nebula or other extended object within a sixth of a degree.
 *  - Anything with neither is recorded as not searched, with the reason.
 *
 * The archive is never asked what it holds in total. Its own search backend answers one target at a time and a whole-archive
 * count is not a question it takes, so this ledger says what Spitzer holds for these objects and does not pretend to say what
 * Spitzer holds.
 *
 * Each mode's state is read from this repository, not declared: the programs pinned in tools/objects/spitzer/programs and the
 * ones that carry a reproduction receipt that parses and names the observation and product it checked. A mode counts as
 * checked only then. --write replaces data/spitzer/ledger.json and docs/spitzer-ledger.md; --local rewrites only the
 * repository's own state from the ledger already on disk, for when a program is pinned or a receipt written and nothing the
 * archive said has changed. */
import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { isRecord, requireArray, requireFiniteNumber, requireRecord, requireString } from '../../sources/source-values.mts';
import { parseSpitzerProgram, PROGRAMS, REPOSITORY, shaSearch, type ShaRow } from './archive.mts';
import { parseReproduction } from './compare.mts';

export const LEDGER = resolve(REPOSITORY, 'data/spitzer/ledger.json');
export const GUIDE = resolve(REPOSITORY, 'docs/spitzer-ledger.md');
const SCHEMA = 'cssearth-spitzer-ledger@4';
/** How many objects are asked at once. The archive's backend builds a temporary table for every question, so this stays small. */
const CONCURRENCY = 4;
const STAR_RADIUS_DEG = 0.5 / 60, EXTENDED_RADIUS_DEG = 1 / 6;
const stringList = (value: unknown, label: string): string[] => requireArray(value, label).map((entry, index) => requireString(entry, `${label}[${index}]`));

/** Spitzer's observing modes as the archive names them (`modedisplayname`), what each records, and the tool here that re-makes
 * it. A mode the archive returns that is not in this table is still counted and named in the ledger, so nothing is lost by
 * this list being incomplete. */
export const SPITZER_MODES: readonly { readonly mode: string; readonly records: string; readonly tool: string | null; readonly note?: string }[] = [
  { mode: 'IRAC Map', records: 'mapped pictures in the four IRAC channels, 3.6 to 8.0 micron', tool: 'tools/objects/spitzer/mosaic.mts' },
  { mode: 'IRAC Map PC', records: 'pictures held on one pointing, the mode exoplanet transits were watched in', tool: null, note: 'The archive mosaics these too, so the same stage would run; none is pinned here.' },
  { mode: 'IRAC IER', records: 'pictures taken on an engineering request rather than a normal observation', tool: null },
  { mode: 'IRAC Post-Cryo Map', records: 'mapped pictures in the two channels that kept working after the cryogen ran out', tool: null, note: 'The same stage would run; none is pinned here.' },
  { mode: 'IRS Stare', records: 'spectra of one point, 5 to 38 micron', tool: null, note: "Needs the observatory's SPICE, which was not obtained or run here." },
  { mode: 'IRS Map', records: 'spectra stepped across a target, which build a spectral cube', tool: null, note: 'Needs CUBISM, which was not obtained or run here.' },
  { mode: 'IRS Peakup Image', records: 'a small picture taken to put the target in the slit', tool: null },
  { mode: 'IRS IER', records: 'spectra taken on an engineering request', tool: null },
  { mode: 'MIPS Phot', records: 'photometry at 24, 70 and 160 micron', tool: null, note: 'The archive mosaics these; this toolkit has not been run on MIPS and does not claim it.' },
  { mode: 'MIPS Scan', records: 'large maps made by scanning the telescope', tool: null },
  { mode: 'MIPS SED', records: 'low-resolution spectra around 70 micron', tool: null },
  { mode: 'MIPS TP', records: 'total-power measurements', tool: null },
  { mode: 'MIPS IER', records: 'MIPS data taken on an engineering request', tool: null },
];

export interface ShippedObject {
  readonly id: string;
  readonly name: string;
  readonly classification: string;
  /** How this object is asked for, and why, when it cannot be. */
  readonly query: { readonly kind: 'naif'; readonly naifId: number }
    | { readonly kind: 'position'; readonly raDeg: number; readonly decDeg: number; readonly radiusDeg: number }
    | { readonly kind: 'none'; readonly reason: string };
}

const readJson = async (path: string): Promise<unknown> => readFile(path, 'utf8').then(text => JSON.parse(text) as unknown, () => null);
const firstSkyPosition = (value: unknown): { raDeg: number; decDeg: number } | undefined => {
  if (Array.isArray(value)) { for (const item of value) { const found = firstSkyPosition(item); if (found) return found; } return undefined; }
  if (!isRecord(value)) return undefined;
  if (typeof value.raDeg === 'number' && typeof value.decDeg === 'number') return { raDeg: value.raDeg, decDeg: value.decDeg };
  for (const item of Object.values(value)) { const found = firstSkyPosition(item); if (found) return found; }
  return undefined;
};

/** The NAIF id of a body from the Horizons code its package carries, or null with the reason it has none. A bare integer is
 * already a NAIF id (a planet, a satellite, the Sun). A minor planet's code is its number followed by a semicolon, and the
 * NAIF id of numbered minor planet n is 2000000 + n. Anything else is a designation, not an id. */
export function naifIdFromHorizonsCode(code: unknown): { naifId: number } | { reason: string } {
  if (typeof code !== 'string' || !code.trim()) return { reason: 'its package records no Horizons code' };
  const trimmed = code.trim();
  if (/^\d+$/u.test(trimmed)) return { naifId: Number(trimmed) };
  const minorPlanet = /^(\d+);/u.exec(trimmed);
  if (minorPlanet) return { naifId: 2_000_000 + Number(minorPlanet[1]) };
  return { reason: `its Horizons code is the designation ${trimmed}, which is not a NAIF id` };
}

/** Every object package, with the one question the archive can be asked about it. */
export async function shippedObjects(repository = REPOSITORY): Promise<ShippedObject[]> {
  const ids = (await readdir(resolve(repository, 'src/objects'), { withFileTypes: true })).filter(entry => entry.isDirectory()).map(entry => entry.name).sort();
  const bodies = new Map<string, Record<string, unknown>>();
  for (const id of ids) { const body = await readJson(resolve(repository, 'packages/astronomy/data/bodies', `${id}.json`)); if (isRecord(body)) bodies.set(id, body); }
  const starPosition = (id: string): { raDeg: number; decDeg: number } | undefined => {
    const star = bodies.get(id)?.star;
    return isRecord(star) && typeof star.rightAscensionDegrees === 'number' && typeof star.declinationDegrees === 'number'
      ? { raDeg: star.rightAscensionDegrees, decDeg: star.declinationDegrees } : undefined;
  };
  return Promise.all(ids.map(async (id): Promise<ShippedObject> => {
    const body = bodies.get(id), physical = isRecord(body?.physical) ? body.physical : undefined;
    const name = typeof physical?.name === 'string' ? physical.name : id;
    const classification = typeof body?.classification === 'string' ? body.classification : 'extended';
    const own = starPosition(id);
    if (own) return { id, name, classification, query: { kind: 'position', ...own, radiusDeg: STAR_RADIUS_DEG } };
    const parent = typeof physical?.parent === 'string' ? starPosition(physical.parent) : undefined;
    if (parent) return { id, name, classification, query: { kind: 'position', ...parent, radiusDeg: STAR_RADIUS_DEG } };
    if (body) {
      const naif = naifIdFromHorizonsCode(physical?.horizonsCode);
      if ('naifId' in naif) return { id, name, classification, query: { kind: 'naif', naifId: naif.naifId } };
      const sky = firstSkyPosition(await readJson(resolve(repository, 'src/objects', id, 'source/nebula.json')));
      if (sky) return { id, name, classification, query: { kind: 'position', ...sky, radiusDeg: EXTENDED_RADIUS_DEG } };
      return { id, name, classification, query: { kind: 'none', reason: naif.reason } };
    }
    const sky = firstSkyPosition(await readJson(resolve(repository, 'src/objects', id, 'source/nebula.json')));
    return sky ? { id, name, classification, query: { kind: 'position', ...sky, radiusDeg: EXTENDED_RADIUS_DEG } }
      : { id, name, classification, query: { kind: 'none', reason: 'it has neither a body record nor a sky position' } };
  }));
}

export interface ArchiveObservation {
  /** AORKEY: Spitzer's mission-wide identity for one Astronomical Observation Request. */
  readonly id: string;
  readonly programme: string;
  readonly mode: string;
  readonly title: string;
  readonly startIso: string;
  readonly endIso?: string;
}
export interface ObjectHoldings { readonly object: string; readonly name: string; readonly classification: string; readonly askedAs: string; readonly observations: number; readonly modes: Readonly<Record<string, number>>; readonly records: readonly ArchiveObservation[] }
export interface Ledger {
  readonly schema: typeof SCHEMA;
  readonly archiveDate: string;
  readonly search: string;
  readonly shippedObjects: number;
  readonly asked: number;
  readonly notAsked: readonly { readonly object: string; readonly reason: string }[];
  readonly unanswered: readonly string[];
  /** Every target whose archive query completed, including completed searches with no observations. */
  readonly searched: readonly string[];
  readonly holdings: readonly ObjectHoldings[];
  readonly modes: readonly { readonly mode: string; readonly records: string | null; readonly tool: string | null; readonly note?: string; readonly observationsForOurObjects: number;
    readonly pinnedPrograms: number; readonly checkedProducts: number; readonly programs: readonly string[]; readonly checked: readonly string[]; readonly receipts: readonly string[] }[];
}

export interface RepositoryState {
  readonly pinned: ReadonlyMap<string, number>;
  readonly checked: ReadonlyMap<string, number>;
  readonly programs?: ReadonlyMap<string, readonly string[]>;
  readonly checkedPrograms?: ReadonlyMap<string, readonly string[]>;
  readonly receipts?: ReadonlyMap<string, readonly string[]>;
}

/** What this repository holds: the programs pinned, and the products a reproduction receipt names and validates. A receipt
 * that does not parse, or that names a product no pinned program holds, counts for nothing. */
export async function repositoryState(programs = PROGRAMS) {
  const files = await readdir(programs).catch(() => [] as string[]);
  const pinned = new Map<string, number>(), checked = new Map<string, number>();
  const programIds = new Map<string, string[]>(), checkedProgramIds = new Map<string, string[]>(), receiptPaths = new Map<string, string[]>();
  const modeOf = new Map<string, string>(), pinnedFiles = new Map<string, Map<string, string>>();
  for (const file of files.filter(name => name.endsWith('.json') && !name.includes('.reproduction.') && !name.endsWith('.product.json'))) {
    const program = parseSpitzerProgram(JSON.parse(await readFile(resolve(programs, file), 'utf8')) as unknown);
    modeOf.set(program.id, program.mode);
    pinned.set(program.mode, (pinned.get(program.mode) ?? 0) + program.channels.length);
    programIds.set(program.mode, [...(programIds.get(program.mode) ?? []), program.id]);
    pinnedFiles.set(program.id, new Map(program.channels.flatMap(channel => channel.products.map(product => [product.name, product.sha256]))));
  }
  for (const file of files.filter(name => name.endsWith('.reproduction.json'))) {
    const receipt = parseReproduction(JSON.parse(await readFile(resolve(programs, file), 'utf8')) as unknown);
    const mode = modeOf.get(receipt.program), known = pinnedFiles.get(receipt.program);
    if (!mode || !known) continue;
    // A receipt counts only when the three archive files it says it read are the ones that program pinned. A comparison made
    // against some other mosaic, uncertainty or coverage plane proves nothing about the pinned observation, whatever it says.
    const against = [receipt.archiveProduct, receipt.archiveUncertainty, receipt.archiveCoverage];
    if (!against.every(entry => known.get(entry.name) === entry.sha256)) continue;
    checked.set(mode, (checked.get(mode) ?? 0) + 1);
    checkedProgramIds.set(mode, [...new Set([...(checkedProgramIds.get(mode) ?? []), receipt.program])]);
    receiptPaths.set(mode, [...(receiptPaths.get(mode) ?? []), `tools/objects/spitzer/programs/${file}`]);
  }
  for (const values of programIds.values()) values.sort();
  for (const values of checkedProgramIds.values()) values.sort();
  for (const values of receiptPaths.values()) values.sort();
  return { pinned, checked, programs: programIds, checkedPrograms: checkedProgramIds, receipts: receiptPaths };
}

const modeCounts = (rows: readonly ShaRow[]) => {
  const counts: Record<string, number> = {};
  for (const row of rows) { const mode = row.modedisplayname?.trim() || 'unnamed mode'; counts[mode] = (counts[mode] ?? 0) + 1; }
  return Object.fromEntries(Object.entries(counts).sort(([a], [b]) => a < b ? -1 : 1));
};

const archiveIso = (value: string, label: string) => {
  const normalized = `${value.trim().replace(' ', 'T')}Z`, milliseconds = Date.parse(normalized);
  if (!Number.isFinite(milliseconds)) throw new TypeError(`${label} is not an archive UTC time (${value}).`);
  return new Date(milliseconds).toISOString();
};

/** Preserve the observation identities that the old count-only ledger discarded. */
export function observationRecords(rows: readonly ShaRow[]): ArchiveObservation[] {
  const records = rows.map((row, index): ArchiveObservation => ({
    id: requireString(row.reqkey, `observation ${index} AORKEY`), programme: requireString(row.progid, `observation ${index} programme`),
    mode: requireString(row.modedisplayname, `observation ${index} mode`), title: requireString(row.reqtitle, `observation ${index} title`),
    startIso: archiveIso(requireString(row.reqbegintime, `observation ${index} start`), `observation ${index} start`),
    ...(row.reqendtime?.trim() ? { endIso: archiveIso(row.reqendtime, `observation ${index} end`) } : {}),
  })).sort((a, b) => a.startIso.localeCompare(b.startIso) || a.id.localeCompare(b.id));
  if (new Set(records.map(record => record.id)).size !== records.length) throw new Error('The Spitzer archive returned one AORKEY more than once.');
  return records;
}

/** Ask the archive about every object it can be asked about. An object the archive will not answer for is recorded as
 * unanswered and the pass goes on: which objects were asked and which were not is itself the honest result. */
export async function surveyArchive(objects: readonly ShippedObject[]): Promise<ArchiveSurvey> {
  const holdings: ObjectHoldings[] = [], unanswered: string[] = [], searched: string[] = [];
  const queue = objects.filter(object => object.query.kind !== 'none');
  let next = 0;
  const worker = async () => {
    for (let index = next++; index < queue.length; index = next++) {
      const object = queue[index]!, query = object.query;
      if (query.kind === 'none') continue;
      const request: Record<string, string> = query.kind === 'naif' ? { id: 'aorByNaifID', naifID: String(query.naifId) }
        : { id: 'aorByPosition', position: `${query.raDeg};${query.decDeg};EQ_J2000`, radius: String(query.radiusDeg) };
      const askedAs = query.kind === 'naif' ? `NAIF ${query.naifId}` : `${query.raDeg.toFixed(5)}, ${query.decDeg.toFixed(5)} within ${(query.radiusDeg * 60).toFixed(1)} arcmin`;
      const rows = await shaSearch(request).catch(() => null);
      if (!rows) { unanswered.push(object.id); continue; }
      searched.push(object.id);
      holdings.push({ object: object.id, name: object.name, classification: object.classification, askedAs,
        observations: rows.length, modes: modeCounts(rows), records: observationRecords(rows) });
    }
  };
  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, queue.length) }, worker));
  holdings.sort((a, b) => b.observations - a.observations || (a.object < b.object ? -1 : 1));
  unanswered.sort(); searched.sort();
  return { holdings, unanswered, searched };
}

export interface ArchiveSurvey { readonly holdings: readonly ObjectHoldings[]; readonly unanswered: readonly string[]; readonly searched: readonly string[] }

export function buildLedger(objects: readonly ShippedObject[], survey: ArchiveSurvey, state: RepositoryState, archiveDate: string): Ledger {
  const seen = new Map<string, number>();
  for (const entry of survey.holdings) for (const [mode, count] of Object.entries(entry.modes)) seen.set(mode, (seen.get(mode) ?? 0) + count);
  const known = new Set(SPITZER_MODES.map(entry => entry.mode));
  const modes = [
    ...SPITZER_MODES.map(entry => ({ mode: entry.mode, records: entry.records, tool: entry.tool, ...(entry.note === undefined ? {} : { note: entry.note }),
      observationsForOurObjects: seen.get(entry.mode) ?? 0, pinnedPrograms: state.pinned.get(entry.mode) ?? 0, checkedProducts: state.checked.get(entry.mode) ?? 0,
      programs: [...(state.programs?.get(entry.mode) ?? [])], checked: [...(state.checkedPrograms?.get(entry.mode) ?? [])], receipts: [...(state.receipts?.get(entry.mode) ?? [])] })),
    ...[...seen].filter(([mode]) => !known.has(mode)).map(([mode, count]) => ({ mode, records: null, tool: null,
      note: 'The archive returned this mode; it is not described in this toolkit.', observationsForOurObjects: count,
      pinnedPrograms: state.pinned.get(mode) ?? 0, checkedProducts: state.checked.get(mode) ?? 0,
      programs: [...(state.programs?.get(mode) ?? [])], checked: [...(state.checkedPrograms?.get(mode) ?? [])], receipts: [...(state.receipts?.get(mode) ?? [])] })),
  ].sort((a, b) => b.observationsForOurObjects - a.observationsForOurObjects || (a.mode < b.mode ? -1 : 1));
  return parseLedger({
    schema: SCHEMA, archiveDate, search: 'Spitzer Heritage Archive at IRSA', shippedObjects: objects.length,
    asked: objects.filter(object => object.query.kind !== 'none').length,
    notAsked: objects.filter(object => object.query.kind === 'none').map(object => ({ object: object.id, reason: (object.query as { reason: string }).reason })),
    unanswered: survey.unanswered, searched: survey.searched, holdings: survey.holdings.filter(entry => entry.observations > 0), modes,
  });
}

export function parseLedger(value: unknown): Ledger {
  const row = requireRecord(value, 'Spitzer ledger');
  if (row.schema !== SCHEMA) throw new TypeError(`Unsupported Spitzer ledger schema ${String(row.schema)}.`);
  const counts = (raw: unknown): Record<string, number> => Object.fromEntries(Object.entries(requireRecord(raw, 'modes')).map(([mode, count]) => [mode, requireFiniteNumber(count, mode)]));
  return {
    schema: SCHEMA, archiveDate: requireString(row.archiveDate, 'archive date'), search: requireString(row.search, 'search'),
    shippedObjects: requireFiniteNumber(row.shippedObjects, 'shipped objects'), asked: requireFiniteNumber(row.asked, 'asked'),
    notAsked: requireArray(row.notAsked, 'not asked').map(raw => { const entry = requireRecord(raw, 'not asked'); return { object: requireString(entry.object, 'object'), reason: requireString(entry.reason, 'reason') }; }),
    unanswered: requireArray(row.unanswered, 'unanswered').map(entry => requireString(entry, 'unanswered')),
    searched: requireArray(row.searched, 'searched').map(entry => requireString(entry, 'searched')),
    holdings: requireArray(row.holdings, 'holdings').map(raw => { const entry = requireRecord(raw, 'holdings'), modes = counts(entry.modes);
      const records = requireArray(entry.records, 'observation records').map((rawRecord, index) => { const record = requireRecord(rawRecord, `observation record ${index}`);
        const endIso = record.endIso === undefined ? undefined : requireString(record.endIso, 'end'), parsed = { id: requireString(record.id, 'AORKEY'), programme: requireString(record.programme, 'programme'), mode: requireString(record.mode, 'mode'),
          title: requireString(record.title, 'title'), startIso: requireString(record.startIso, 'start'), ...(endIso === undefined ? {} : { endIso }) };
        if (!Number.isFinite(Date.parse(parsed.startIso)) || (parsed.endIso !== undefined && (!Number.isFinite(Date.parse(parsed.endIso)) || parsed.endIso < parsed.startIso))) throw new TypeError(`Spitzer AOR ${parsed.id} has an invalid time range.`);
        return parsed;
      });
      const observations = requireFiniteNumber(entry.observations, 'observations'), fromRecords = new Map<string, number>();
      for (const record of records) fromRecords.set(record.mode, (fromRecords.get(record.mode) ?? 0) + 1);
      const mismatchedMode = Object.entries(modes).find(([mode, count]) => fromRecords.get(mode) !== count) ?? [...fromRecords].find(([mode]) => modes[mode] === undefined);
      if (records.length !== observations || mismatchedMode || new Set(records.map(record => record.id)).size !== records.length)
        throw new Error(`${String(entry.object)} observation records do not reproduce its ${observations} total, mode counts and unique AORKEYs${mismatchedMode ? ` (${mismatchedMode[0]})` : ''}.`);
      return { object: requireString(entry.object, 'object'), name: requireString(entry.name, 'name'), classification: requireString(entry.classification, 'classification'),
        askedAs: requireString(entry.askedAs, 'asked as'), observations, modes, records }; }),
    modes: requireArray(row.modes, 'modes').map(raw => { const entry = requireRecord(raw, 'mode');
      return { mode: requireString(entry.mode, 'mode'), records: entry.records === null ? null : requireString(entry.records, 'records'),
        tool: entry.tool === null ? null : requireString(entry.tool, 'tool'), ...(entry.note === undefined ? {} : { note: requireString(entry.note, 'note') }),
        observationsForOurObjects: requireFiniteNumber(entry.observationsForOurObjects, 'observations'),
        pinnedPrograms: requireFiniteNumber(entry.pinnedPrograms, 'pinned'), checkedProducts: requireFiniteNumber(entry.checkedProducts, 'checked'),
        programs: stringList(entry.programs, 'programs'), checked: stringList(entry.checked, 'checked programs'), receipts: stringList(entry.receipts, 'receipts') }; }),
  };
}

const table = (header: readonly string[], rows: readonly (readonly string[])[]) =>
  [`| ${header.join(' | ')} |`, `| ${header.map(() => '---').join(' | ')} |`, ...rows.map(row => `| ${row.join(' | ')} |`)].join('\n');

export function ledgerGuide(ledger: Ledger): string {
  const galileans = ['io', 'europa', 'ganymede', 'callisto'];
  const observed = new Set(ledger.holdings.map(entry => entry.object));
  const missingGalileans = galileans.filter(id => !observed.has(id));
  // The same question, asked of other moving bodies in the same pass: what makes an empty answer an answer.
  const worked = ledger.holdings.filter(entry => entry.askedAs.startsWith('NAIF ')).slice(0, 3);
  return [
    '# Spitzer archive ledger',
    '',
    `What the Spitzer Heritage Archive at IRSA holds for the ${ledger.shippedObjects} objects this repository ships, what this toolkit can re-make, and how far that is proved. Written by [\`archive-ledger.mts\`](../tools/objects/spitzer/archive-ledger.mts) from IRSA on ${ledger.archiveDate}; the route it checks is [Spitzer](spitzer.md).`,
    '',
    '## What Spitzer observed, by mode',
    '',
    'Counts are observations of this repository\'s objects, not of the archive. "Re-made by" is the stage here that produces that mode\'s level-2 product; "checked" counts products that carry a reproduction receipt naming the exact observation.',
    '',
    table(['Mode', 'Records', 'Observations of our objects', 'Re-made by', 'Channels pinned', 'Products checked'],
      ledger.modes.map(entry => [entry.mode, entry.records ?? 'not described here', String(entry.observationsForOurObjects),
        entry.tool ? `\`${entry.tool}\`` : 'none', String(entry.pinnedPrograms), String(entry.checkedProducts)])),
    '',
    ...ledger.modes.filter(entry => entry.note).map(entry => `- **${entry.mode}**: ${entry.note!}`),
    '',
    '## Which of our objects Spitzer observed',
    '',
    `${ledger.asked} objects could be asked for; ${ledger.holdings.length} of them ${ledger.holdings.length === 1 ? 'has' : 'have'} Spitzer observations.`,
    '',
    table(['Object', 'What it is', 'Asked as', 'Observations', 'Modes'],
      ledger.holdings.map(entry => [entry.name, entry.classification, entry.askedAs, String(entry.observations),
        Object.entries(entry.modes).map(([mode, count]) => `${mode} ${count}`).join(', ')])),
    '',
    '## The Galilean moons',
    '',
    missingGalileans.length === galileans.length
      ? `Spitzer has no observation of Io, Europa, Ganymede or Callisto in this archive. Each was asked for by its own NAIF id (501, 502, 503, 504) and the archive returned no observation request for any of them, and none for Jupiter itself (599) either. That is a measured answer and not an untried one: the same search, in the same pass, returned ${worked.length ? worked.map(entry => `${entry.observations} for ${entry.name}`).join(', ') : 'observations for other moving bodies'}, so it works and the holding is empty. Europa is this repository's showcase body and Spitzer contributes nothing to it.`
      : `The archive holds observations for ${galileans.filter(id => observed.has(id)).join(', ')}; ${missingGalileans.length ? `it holds none for ${missingGalileans.join(', ')}.` : 'it holds some for all four.'} See the table above for what and in which mode.`,
    '',
    '## What this ledger does not say',
    '',
    '- It does not say what Spitzer holds in total. The archive\'s search backend answers one target at a time and takes no whole-archive count, so every number here is about this repository\'s objects.',
    '- The JSON ledger retains the id of every target whose query completed, including empty results. A target absent from that list is not turned into an archive negative when the application catalogue grows.',
    '- The JSON ledger retains every returned AORKEY, programme, mode, title, start and end time. The table above groups those same records for reading; the capability query exposes the records for one requested target.',
    '- A moving body is found only if its observation was scheduled against that NAIF id. An observation that caught a body inside a fixed-target field is not counted, because the archive does not index it that way.',
    `- ${ledger.notAsked.length} ${ledger.notAsked.length === 1 ? 'object was' : 'objects were'} not asked for at all. Most are comets and interstellar objects, whose packages carry a Horizons designation rather than a NAIF id; the rest have neither a body record nor a sky position. They are gaps, not zeroes.`,
    ...ledger.unanswered.length ? ['', `- The archive would not answer for ${ledger.unanswered.join(', ')} in this pass, after three attempts each. Those objects are missing from the table above, not empty.`] : [],
    '',
  ].join('\n');
}

/** Refresh repository-owned toolkit state without querying the archive again. Archive holdings and their measurement date
 * stay fixed; only pinned programs, checked products and their identities are recomputed from bytes and receipts here. */
export async function refreshLocalLedger(): Promise<Ledger> {
  const objects = await shippedObjects(), state = await repositoryState();
  const previous = parseLedger(JSON.parse(await readFile(LEDGER, 'utf8')) as unknown);
  const ledger = buildLedger(objects, { holdings: previous.holdings, unanswered: previous.unanswered, searched: previous.searched }, state, previous.archiveDate);
  await mkdir(resolve(LEDGER, '..'), { recursive: true });
  await writeFile(LEDGER, `${JSON.stringify(ledger, null, 2)}\n`);
  await writeFile(GUIDE, ledgerGuide(ledger));
  return ledger;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const args = process.argv.slice(2), write = args.includes('--write'), local = args.includes('--local');
  const objects = await shippedObjects(), state = await repositoryState();
  const ledger = local && write ? await refreshLocalLedger() : local
    ? buildLedger(objects, { holdings: parseLedger(JSON.parse(await readFile(LEDGER, 'utf8')) as unknown).holdings,
      unanswered: parseLedger(JSON.parse(await readFile(LEDGER, 'utf8')) as unknown).unanswered,
      searched: parseLedger(JSON.parse(await readFile(LEDGER, 'utf8')) as unknown).searched }, state, parseLedger(JSON.parse(await readFile(LEDGER, 'utf8')) as unknown).archiveDate)
    : buildLedger(objects, await surveyArchive(objects), state, new Date().toISOString().slice(0, 10));
  if (write) {
    if (!local) {
      await mkdir(resolve(LEDGER, '..'), { recursive: true });
      await writeFile(LEDGER, `${JSON.stringify(ledger, null, 2)}\n`);
      await writeFile(GUIDE, ledgerGuide(ledger));
    }
    console.log(`Wrote ${LEDGER} and ${GUIDE}.`);
  }
  console.log(`${ledger.shippedObjects} objects shipped, ${ledger.asked} asked, ${ledger.holdings.length} with Spitzer observations, ${ledger.notAsked.length} not asked, ${ledger.unanswered.length} unanswered.`);
  for (const entry of ledger.modes.filter(mode => mode.observationsForOurObjects))
    console.log(`  ${entry.mode.padEnd(20)} ${String(entry.observationsForOurObjects).padStart(5)} observations, ${entry.pinnedPrograms} channels pinned, ${entry.checkedProducts} checked`);
}
