#!/usr/bin/env node
/** What the NACO archive holds, for this project's bodies, derived rather than declared.
 *
 *   node tools/objects/naco/archive-ledger.mts            writes data/naco/ledger.json and docs/naco-ledger.md
 *   node tools/objects/naco/archive-ledger.mts --local    rewrites only the part the pinned programs and receipts own
 *
 * Every count comes from the ESO archive, counted server-side by an ADQL `GROUP BY` rather than by downloading rows and
 * counting them here. Every mode's state comes from the pinned programs and the receipts beside them: a mode is "reduced"
 * because a program of that mode exists and a receipt beside it parses, names that program and its night, and pins the two
 * disjoint reductions it compared, never because a file of about the right name sits there. A receipt that cannot be read,
 * states another schema or names something else is reported as a problem and proves nothing. --local takes the programs and
 * their receipts again from disk and leaves the dated archive counts alone.
 *
 * The object matcher is the part that has to be careful. NACO's target names are what the observer typed, and they collide:
 * `EUROPA` is Jupiter's moon, `52_EUROPA` is the asteroid this project ships as `europa-52`, and `195EURYKLEIA-26T0400` is a
 * third body with an ephemeris stamp glued to its name. Acquisition, sky and offset frames are never counted as an
 * observation of the object, because they are pointing and background exposures. */
import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { requireArray, requireFiniteNumber, requireRecord, requireString } from '@cssearth/core';
import { INSTRUMENT, MODES, PROGRAMS, rawQuery, REFUSED_TECHNIQUES, type NacoMode } from './archive.mts';

const repository = resolve(import.meta.dirname, '../../..');
export const LEDGER = resolve(repository, 'data/naco/ledger.json');
export const GUIDE = resolve(repository, 'docs/naco-ledger.md');
export const SCHEMA = 'cssearth-naco-ledger@2';

/** Frame categories that are never an observation of the object: pointing exposures, background exposures and tests. */
export const NON_OBSERVING_CATEGORIES = ['ACQUISITION', 'TEST'] as const;
export const NON_OBSERVING_TYPES = ['SKY', 'DARK', 'FLAT', 'STD', 'OBJECT,SKY'] as const;

/** A target name reduced to letters and digits, so `52_EUROPA` and `52EUROPA` are one name. */
export const normalise = (name: string) => name.toUpperCase().replace(/[^A-Z0-9]/gu, '');

/** An observer's target name split into the parts that identify a body.
 *
 * NACO target names carry three things beyond the name: a minor-planet number in front (`52_EUROPA`), an ephemeris stamp
 * behind (`-26T0400`, `-3H40`, `-25`), and separators the observer chose. All three are stripped, and the number is kept
 * because it is what tells the asteroid from the moon. */
export function parseTargetName(name: string) {
  const stamp = /[-_](?:\d{1,2}[TH]\d{2,4}|\d{1,2}H\d{2}|\d{1,3})$/u;
  const trimmed = name.trim().replace(stamp, '');
  const compact = normalise(trimmed);
  const numbered = /^(\d{1,6})([A-Z].*)$/u.exec(compact);
  return numbered ? { number: Number(numbered[1]), name: numbered[2]! } : { number: null, name: compact };
}

/** The shipped object id a NACO target name refers to, or null.
 *
 * A numbered target prefers the id that carries the same number (`52_EUROPA` is `europa-52`, never `europa`), and is refused
 * outright when no such id exists, because the bare name belongs to a different body. An unnumbered target takes the bare
 * id. Nothing is matched by prefix: `195EURYKLEIA` is not `eurykleia` unless the numbers agree. */
export function matchShippedObject(target: string, shipped: ReadonlySet<string>) {
  const { number, name } = parseTargetName(target);
  if (!name) return null;
  const bare = [...shipped].find(id => normalise(id) === name) ?? null;
  if (number === null) return bare;
  const numbered = [...shipped].find(id => normalise(id) === `${name}${number}`) ?? null;
  // A numbered target that matches no numbered id is not the bare body: 52 Europa is not Europa.
  return numbered;
}

export interface ObjectObservation {
  readonly id: string;
  readonly targets: readonly string[];
  readonly frames: number;
  readonly programmes: readonly string[];
  readonly modes: readonly string[];
  /** Runnable archive identities, one per programme, target spelling, mode and observing night. */
  readonly records: readonly NacoObservationRecord[];
}

export interface NacoObservationRecord {
  readonly id: string;
  readonly programme: string;
  readonly archiveTarget: string;
  readonly mode: string;
  readonly night: string;
  readonly startIso: string;
  readonly endIso: string;
  readonly frames: number;
}

/** What a mode can be: reduced by an accepted receipt, pinned and unproved, refused by this route, or untouched. */
const MODE_STATES = ['reduced', 'pinned', 'refused', 'not reduced'] as const;
const isModeState = (value: string): value is ModeState['state'] => (MODE_STATES as readonly string[]).includes(value);
export interface ModeState {
  readonly mode: string;
  readonly frames: number;
  /** The pinned programs of this mode, and the receipts accepted beside them. */
  readonly programs: readonly string[];
  readonly receipts: readonly string[];
  readonly state: 'reduced' | 'pinned' | 'refused' | 'not reduced';
  readonly reason: string;
}

export interface Ledger {
  readonly schema: typeof SCHEMA;
  readonly instrument: typeof INSTRUMENT;
  readonly measured: string;
  readonly frames: { readonly total: number; readonly byCategory: Readonly<Record<string, number>>; readonly byMode: Readonly<Record<string, number>> };
  readonly objects: readonly ObjectObservation[];
  readonly modes: readonly ModeState[];
  /** Receipts that could not be accepted, and so proved nothing. An empty list is the only passing state. */
  readonly receiptProblems: readonly string[];
}

/** Which of this route's buckets a technique falls in, for counting. Unlike `modeOf` this never throws: the ledger has to
 * account for every frame NACO took, including the modes this route refuses. */
export function bucketOf(technique: string): string {
  const words = technique.split(',');
  const refused = REFUSED_TECHNIQUES.find(word => words.includes(word));
  if (refused) return refused.toLowerCase();
  if (words.includes('JITTER') && (words.includes('IMAGE') || words.includes('POLARIMETRY'))) return 'imaging';
  if (words.includes('SPECTRUM') && words.includes('NODDING')) return 'spectroscopy';
  return 'other';
}

/** Counts by category and by technique, grouped by the archive and not here. */
export async function frameCounts(today: string) {
  const byCategory = await rawQuery(`SELECT dp_cat, count(*) AS n FROM dbo.raw WHERE instrument = '${INSTRUMENT}'`
    + ` AND release_date < '${today}' GROUP BY dp_cat`);
  const byTechnique = await rawQuery(`SELECT dp_tech, count(*) AS n FROM dbo.raw WHERE instrument = '${INSTRUMENT}'`
    + ` AND release_date < '${today}' AND dp_cat = 'SCIENCE' GROUP BY dp_tech`);
  const categories: Record<string, number> = {}, modes: Record<string, number> = {};
  for (const row of byCategory) categories[row.dp_cat!] = Number(row.n);
  for (const row of byTechnique) { const bucket = bucketOf(row.dp_tech!); modes[bucket] = (modes[bucket] ?? 0) + Number(row.n); }
  return { total: Object.values(categories).reduce((sum, value) => sum + value, 0), byCategory: categories, byMode: modes };
}

/** Every NACO science target and what was taken on it, counted by the archive. Acquisition, sky and test frames are excluded
 * in the query, so they can never become an observation. */
export async function scienceTargets(today: string) {
  const query = `SELECT object, prog_id, dp_tech, count(*) AS n FROM dbo.raw WHERE instrument = '${INSTRUMENT}'`
    + ` AND release_date < '${today}' AND dp_cat = 'SCIENCE'`
    + ` AND dp_type NOT IN (${NON_OBSERVING_TYPES.map(type => `'${type}'`).join(', ')})`
    + ' GROUP BY object, prog_id, dp_tech';
  return rawQuery(query);
}

/** The timestamps behind the shipped targets' aggregate counts. Kept separate so the archive still does every global count. */
export async function scienceObservationRows(today: string, targets: readonly string[]) {
  if (!targets.length) return [];
  const literal = (value: string) => `'${value.replaceAll("'", "''")}'`;
  const query = 'SELECT object, prog_id, dp_tech, exp_start FROM dbo.raw'
    + ` WHERE instrument = '${INSTRUMENT}' AND release_date < '${today}' AND dp_cat = 'SCIENCE'`
    + ` AND dp_type NOT IN (${NON_OBSERVING_TYPES.map(type => `'${type}'`).join(', ')})`
    + ` AND object IN (${targets.map(literal).join(', ')}) ORDER BY object, prog_id, dp_tech, exp_start`;
  return rawQuery(query);
}

/** The shipped object ids: the directories of src/objects. */
export async function shippedObjects() {
  const entries = await readdir(resolve(repository, 'src/objects'), { withFileTypes: true });
  return new Set(entries.filter(entry => entry.isDirectory()).map(entry => entry.name));
}

/** Group the archive's science rows by the shipped object they name. */
export function observationsOf(rows: readonly Record<string, string>[], shipped: ReadonlySet<string>,
  observationRows: readonly Record<string, string>[] = []): ObjectObservation[] {
  const byId = new Map<string, { targets: Set<string>; frames: number; programmes: Set<string>; modes: Set<string> }>();
  for (const row of rows) {
    const id = matchShippedObject(row.object ?? '', shipped);
    if (!id) continue;
    const entry = byId.get(id) ?? { targets: new Set(), frames: 0, programmes: new Set(), modes: new Set() };
    entry.targets.add(row.object!); entry.frames += Number(row.n); entry.programmes.add(row.prog_id!);
    entry.modes.add(bucketOf(row.dp_tech ?? ''));
    byId.set(id, entry);
  }
  const records = new Map<string, Map<string, { programme: string; archiveTarget: string; mode: string; night: string; starts: string[] }>>();
  for (const row of observationRows) {
    const id = matchShippedObject(row.object ?? '', shipped), start = row.exp_start ?? '';
    if (!id || !/^\d{4}-\d{2}-\d{2}T/u.test(start)) continue;
    const programme = row.prog_id ?? '', archiveTarget = row.object ?? '', mode = bucketOf(row.dp_tech ?? ''), night = start.slice(0, 10);
    const key = `${programme}\u0000${archiveTarget}\u0000${mode}\u0000${night}`, objectRecords = records.get(id) ?? new Map();
    const record = objectRecords.get(key) ?? { programme, archiveTarget, mode, night, starts: [] };
    record.starts.push(start); objectRecords.set(key, record); records.set(id, objectRecords);
  }
  return [...byId].map(([id, entry]) => ({
    id, targets: [...entry.targets].sort(), frames: entry.frames,
    programmes: [...entry.programmes].sort(), modes: [...entry.modes].sort(),
    records: [...records.get(id)?.values() ?? []].map(record => ({
      id: `${record.programme.replace(/[^A-Za-z0-9._-]+/gu, '-').replace(/^-|-$/gu, '')}`
        + `-${record.archiveTarget.replace(/[^A-Za-z0-9._-]+/gu, '-').replace(/^-|-$/gu, '')}-${record.night}-${record.mode}`,
      programme: record.programme, archiveTarget: record.archiveTarget, mode: record.mode, night: record.night,
      startIso: record.starts[0]!, endIso: record.starts.at(-1)!, frames: record.starts.length,
    })).sort((a, b) => a.startIso.localeCompare(b.startIso) || a.id.localeCompare(b.id)),
  })).sort((a, b) => b.frames - a.frames || a.id.localeCompare(b.id));
}

/** What went wrong with one receipt, always said of the file it was in: a JSON parser names a position, not a file. */
const receiptProblem = (file: string, error: unknown) => { const said = error instanceof Error ? error.message : String(error); return said.startsWith(`${file}:`) ? said : `${file}: ${said}`; };

/** The schemas this route's checks write. `reproduction` compares two object templates or two nod halves of one night;
 * `spectrum` is the extracted spectrum's own check of the same night's two halves. */
export const NACO_RECEIPT_SCHEMAS = ['cssearth-naco-reproduction@1', 'cssearth-naco-spectrum@1'] as const;
const TEMPLATE = /^\d{4}-\d{2}-\d{2}T/u;

/** One receipt read against the program it claims: another schema, another night, a missing pin or fewer than two disjoint
 * reductions is an error, never a silent skip. The receipt has no archive product to name (ESO publishes none for NACO), so
 * what it must pin is the two reductions it compared, each by path, size and digest. */
export function checkReceipt(value: unknown, file: string, program: Record<string, unknown>): void {
  const row = requireRecord(value, file), schema = requireString(row.schema, `${file}: schema`);
  if (!(NACO_RECEIPT_SCHEMAS as readonly string[]).includes(schema)) throw new TypeError(`${file}: ${schema} is not a NACO receipt.`);
  const id = requireString(program.program, `${file}: pinned program id`);
  if (requireString(row.program, `${file}: program`) !== id) throw new TypeError(`${file}: it is the receipt of ${String(row.program)}.`);
  const spectrum = schema === 'cssearth-naco-spectrum@1';
  const expected = spectrum ? `${id}.spectrum.reproduction.json` : `${id}.${requireString(row.product, `${file}: product`)}.reproduction.json`;
  if (file !== expected) throw new TypeError(`${file}: it is the receipt named ${expected}.`);
  if (spectrum) {
    if (requireString(row.object, `${file}: object`) !== requireString(program.object, `${id}: object`)) throw new TypeError(`${file}: it names the object ${String(row.object)}.`);
    if (requireString(row.night, `${file}: night`) !== requireString(program.night, `${id}: night`)) throw new TypeError(`${file}: it names the night ${String(row.night)}.`);
  }
  const sides = requireArray(spectrum ? row.halves : row.sequences, `${file}: the two sides it compared`).map(entry => {
    const side = requireRecord(entry, `${file}: side`), path = requireString(side.path, `${file}: side path`);
    requireFiniteNumber(side.bytes, `${file}: side bytes`);
    // An imaging receipt compares two of the night's own object templates; a nodded night's halves carry their own labels.
    const template = requireString(side[spectrum ? 'half' : 'template'], `${file}: side label`);
    if (TEMPLATE.test(template) && !requireArray(program.objectTemplates, `${id}: object templates`).includes(template))
      throw new TypeError(`${file}: it reduced the template ${template}, which ${id} does not pin.`);
    return path;
  });
  if (sides.length < 2) throw new TypeError(`${file}: it compares ${sides.length} reduction(s), not two.`);
  if (new Set(sides).size !== sides.length) throw new TypeError(`${file}: the sides it compared are the same file.`);
}

/** Each mode's state, read from the pinned programs and the receipts beside them, with every receipt that could not be
 * accepted reported rather than counted or dropped. */
export async function modeStates(byMode: Readonly<Record<string, number>>, directory = PROGRAMS): Promise<{ modes: ModeState[]; problems: string[] }> {
  const files = (await readdir(directory).catch(() => [] as string[])).sort();
  const pinned = new Map<string, string[]>(), programs = new Map<string, Record<string, unknown>>();
  for (const name of files.filter(name => name.endsWith('.json') && !name.includes('.reproduction.'))) {
    const record = requireRecord(JSON.parse(await readFile(resolve(directory, name), 'utf8')) as unknown, name);
    const mode = requireString(record.mode, 'mode'), id = name.replace(/\.json$/u, '');
    pinned.set(mode, [...pinned.get(mode) ?? [], id]); programs.set(id, record);
  }
  const accepted = new Set<string>(), problems: string[] = [];
  // A receipt of a pinned program is `<program>.<product>.reproduction.json`; anything else here belongs to no program.
  for (const name of files.filter(name => name.includes('.reproduction.') && programs.has(name.slice(0, name.indexOf('.'))))) {
    try { checkReceipt(JSON.parse(await readFile(resolve(directory, name), 'utf8')) as unknown, name, programs.get(name.slice(0, name.indexOf('.')))!); accepted.add(name); }
    catch (error) { problems.push(receiptProblem(name, error)); }
  }
  const modes: ModeState[] = [];
  for (const mode of Object.keys(byMode).sort()) {
    const ours = pinned.get(mode) ?? [];
    const theirs = [...accepted].filter(name => ours.some(program => name.startsWith(`${program}.`)));
    const refused = (REFUSED_TECHNIQUES as readonly string[]).includes(mode.toUpperCase());
    modes.push({
      mode, frames: byMode[mode]!, programs: ours.sort(), receipts: theirs.sort(),
      state: theirs.length ? 'reduced' : ours.length ? 'pinned' : refused ? 'refused' : 'not reduced',
      reason: theirs.length ? `${theirs.length} receipt(s) beside ${ours.length} pinned program(s).`
        : ours.length ? 'A program is pinned and no receipt has been written for it.'
        : refused ? 'This route refuses the mode: the technique changes what a frame means and these recipes do not undo it.'
        : 'No program of this mode is pinned.',
    });
  }
  return { modes, problems: problems.sort((a, b) => a.localeCompare(b, 'en')) };
}

export async function buildLedger(today = new Date().toISOString().slice(0, 10)): Promise<Ledger> {
  const frames = await frameCounts(today);
  const rows = await scienceTargets(today), shipped = await shippedObjects();
  const targets = [...new Set(rows.filter(row => matchShippedObject(row.object ?? '', shipped)).map(row => row.object!))].sort();
  const objects = observationsOf(rows, shipped, await scienceObservationRows(today, targets));
  const { modes, problems } = await modeStates(frames.byMode);
  return { schema: SCHEMA, instrument: INSTRUMENT, measured: today, frames, objects, modes, receiptProblems: problems };
}

/** The ledger on disk, read back as the external value it is, so --local rewrites a file it has checked. */
export function parseLedger(value: unknown): Ledger {
  const row = requireRecord(value, 'NACO ledger');
  if (row.schema !== SCHEMA) throw new TypeError('Unsupported NACO ledger.');
  if (row.instrument !== INSTRUMENT) throw new TypeError(`The ledger counts ${String(row.instrument)}, not ${INSTRUMENT}.`);
  const frames = requireRecord(row.frames, 'Frame counts');
  const counts = (value: unknown, label: string) => Object.fromEntries(Object.entries(requireRecord(value, label)).map(([key, n]) => [key, requireFiniteNumber(n, label)]));
  const names = (list: unknown, label: string) => requireArray(list, label).map(name => requireString(name, label));
  return { schema: SCHEMA, instrument: INSTRUMENT, measured: requireString(row.measured, 'Measured date'),
    frames: { total: requireFiniteNumber(frames.total, 'Total frames'), byCategory: counts(frames.byCategory, 'Frames by category'), byMode: counts(frames.byMode, 'Frames by mode') },
    objects: requireArray(row.objects, 'Objects').map(raw => { const entry = requireRecord(raw, 'Object');
      return { id: requireString(entry.id, 'Object id'), targets: names(entry.targets, 'Archive target names'), frames: requireFiniteNumber(entry.frames, 'Frames'),
        programmes: names(entry.programmes, 'Programmes'), modes: names(entry.modes, 'Modes'),
        records: requireArray(entry.records, 'Observation records').map(rawRecord => { const record = requireRecord(rawRecord, 'Observation record');
          return { id: requireString(record.id, 'Observation id'), programme: requireString(record.programme, 'Observation programme'),
            archiveTarget: requireString(record.archiveTarget, 'Observation archive target'), mode: requireString(record.mode, 'Observation mode'),
            night: requireString(record.night, 'Observation night'), startIso: requireString(record.startIso, 'Observation start'),
            endIso: requireString(record.endIso, 'Observation end'), frames: requireFiniteNumber(record.frames, 'Observation frames') }; }) }; }),
    modes: requireArray(row.modes, 'Modes').map(raw => { const entry = requireRecord(raw, 'Mode'), state = requireString(entry.state, 'State');
      if (!isModeState(state)) throw new TypeError(`${state} is not a mode state.`);
      return { mode: requireString(entry.mode, 'Mode name'), frames: requireFiniteNumber(entry.frames, 'Frames'), programs: names(entry.programs, 'Programs'),
        receipts: names(entry.receipts, 'Receipts'), state, reason: requireString(entry.reason, 'Reason') }; }),
    // A ledger written before receipts were checked states no problems; the next run gives it the field.
    receiptProblems: names(row.receiptProblems ?? [], 'Receipt problems') };
}

const thousands = (value: number) => value.toLocaleString('en-GB');

/** The guide, written from the ledger so the two cannot disagree. */
export function ledgerGuide(ledger: Ledger) {
  const modes = ledger.modes.map(mode => `| ${mode.mode} | ${thousands(mode.frames)} | ${mode.state} | ${mode.reason} |`);
  const objects = ledger.objects.map(object =>
    `| ${object.id} | ${thousands(object.frames)} | ${object.modes.join(', ')} | ${object.programmes.slice(0, 3).join(', ')}${object.programmes.length > 3 ? ` (+${object.programmes.length - 3})` : ''} | ${object.targets.join(', ')} |`);
  return `# NACO archive ledger

Generated by \`node tools/objects/naco/archive-ledger.mts\` from [data/naco/ledger.json](../data/naco/ledger.json). Do not
edit it by hand: every number here is counted by the ESO archive and every state is read from the pinned programs and the
receipts beside them. See [VLT/NACO](naco.md) for what the toolkit does.

Counted on ${ledger.measured}. ${thousands(ledger.frames.total)} public ${ledger.instrument} frames:
${Object.entries(ledger.frames.byCategory).sort((a, b) => b[1] - a[1]).map(([name, count]) => `${name} ${thousands(count)}`).join(', ')}.

## Modes

Science frames by mode. A mode counts as reduced only when a program of that mode is pinned and a receipt sits beside it.

| mode | science frames | state | why |
| --- | ---: | --- | --- |
${modes.join('\n')}

## Shipped objects NACO observed

${ledger.objects.length} of this project's objects appear as a NACO science target. Acquisition, sky and test frames are
excluded, so these are exposures on the body. A target name carrying a minor-planet number matches only the id that carries
the same number, which is why 52 Europa and Europa are two rows and not one.

Each object also retains one machine-readable record per programme, archive target spelling, mode and observing night. Those
records are the identities the telescope query passes back to the NACO qualification route; the table stays an aggregate.

| object | frames | modes | programmes | archive target names |
| --- | ---: | --- | --- | --- |
${objects.join('\n')}

## Receipts

A receipt counts only when it parses, states one of the schemas this route writes (${NACO_RECEIPT_SCHEMAS.map(schema => `\`${schema}\``).join(', ')}), names the program it sits beside and the night that program pins, and pins both of the disjoint reductions it compared by path, size and digest. A receipt that says anything else is reported here and proves nothing.

${ledger.receiptProblems.length ? `${ledger.receiptProblems.length} receipt${ledger.receiptProblems.length === 1 ? '' : 's'} could not be accepted:\n\n${ledger.receiptProblems.map(problem => `- ${problem}`).join('\n')}` : 'None: every receipt beside a pinned program was accepted.'}
`;
}

/** Every receipt problem, said once and counted against the run: a ledger that reports one has not proved what it lists. */
const reportProblems = (problems: readonly string[]) => {
  for (const problem of problems) console.error(`RECEIPT ${problem}`);
  if (problems.length) process.exitCode = 1;
};

/** Refresh only receipt-derived state after a qualification run; archive holdings remain the measured snapshot on disk. */
export async function refreshLocalLedger() {
  const held = parseLedger(JSON.parse(await readFile(LEDGER, 'utf8')) as unknown), { modes, problems } = await modeStates(held.frames.byMode);
  const ledger = { ...held, modes, receiptProblems: problems };
  await writeFile(LEDGER, `${JSON.stringify(ledger, null, 2)}\n`);
  await writeFile(GUIDE, ledgerGuide(ledger));
  return ledger;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const local = process.argv.includes('--local');
  let ledger: Ledger;
  if (local) ledger = await refreshLocalLedger();
  else ledger = await buildLedger();
  await mkdir(resolve(repository, 'data/naco'), { recursive: true });
  if (!local) {
    await writeFile(LEDGER, `${JSON.stringify(ledger, null, 2)}\n`);
    await writeFile(GUIDE, ledgerGuide(ledger));
  }
  console.log(`${LEDGER}: ${thousands(ledger.frames.total)} frames, ${ledger.objects.length} shipped objects, ${ledger.modes.length} modes${local ? ' (pinned state only)' : ''}.`);
  reportProblems(ledger.receiptProblems);
}

export type { NacoMode };
export { MODES };
