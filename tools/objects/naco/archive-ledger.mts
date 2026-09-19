#!/usr/bin/env node
/** What the NACO archive holds, for this project's bodies, derived rather than declared.
 *
 *   node tools/objects/naco/archive-ledger.mts        writes data/naco/ledger.json and docs/naco-ledger.md
 *
 * Every count comes from the ESO archive, counted server-side by an ADQL `GROUP BY` rather than by downloading rows and
 * counting them here. Every mode's state comes from the pinned programs and the receipts beside them: a mode is "reduced"
 * because a program of that mode exists and a receipt was written for it, never because a constant says so.
 *
 * The object matcher is the part that has to be careful. NACO's target names are what the observer typed, and they collide:
 * `EUROPA` is Jupiter's moon, `52_EUROPA` is the asteroid this project ships as `europa-52`, and `195EURYKLEIA-26T0400` is a
 * third body with an ephemeris stamp glued to its name. Acquisition, sky and offset frames are never counted as an
 * observation of the object, because they are pointing and background exposures. */
import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { requireRecord, requireString } from '../../source-values.mts';
import { INSTRUMENT, MODES, PROGRAMS, rawQuery, REFUSED_TECHNIQUES, type NacoMode } from './archive.mts';

const repository = resolve(import.meta.dirname, '../../..');
export const LEDGER = resolve(repository, 'data/naco/ledger.json');
export const GUIDE = resolve(repository, 'docs/naco-ledger.md');
export const SCHEMA = 'cssearth-naco-ledger@1';

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
}

export interface ModeState {
  readonly mode: string;
  readonly frames: number;
  /** The pinned programs of this mode, and the receipts written beside them. */
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

/** The archive's CSV for an aggregate query, as rows keyed by column name. `parseRawTable` cannot be used here: it is for
 * frame tables and requires a `dp_id` column, which a `GROUP BY` result has none of. Quoted fields may hold commas, which is
 * why a NACO technique like `"IMAGE,JITTER"` needs the quoting rule and not a split on commas. */
export function parseCsv(text: string): Record<string, string>[] {
  const lines = text.split('\n').filter(line => line.trim());
  if (!lines.length) return [];
  const split = (line: string) => [...line.matchAll(/("([^"]*)"|[^,]*)(,|$)/gu)].slice(0, -1).map(match => match[2] ?? match[1] ?? '');
  const header = split(lines[0]!);
  return lines.slice(1).map(line => { const cells = split(line); return Object.fromEntries(header.map((name, index) => [name, cells[index] ?? ''])); });
}

const csv = (text: string) => parseCsv(text);

/** Counts by category and by technique, grouped by the archive and not here. */
export async function frameCounts(today: string) {
  const byCategory = csv(await rawQuery(`SELECT dp_cat, count(*) AS n FROM dbo.raw WHERE instrument = '${INSTRUMENT}'`
    + ` AND release_date < '${today}' GROUP BY dp_cat`));
  const byTechnique = csv(await rawQuery(`SELECT dp_tech, count(*) AS n FROM dbo.raw WHERE instrument = '${INSTRUMENT}'`
    + ` AND release_date < '${today}' AND dp_cat = 'SCIENCE' GROUP BY dp_tech`));
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
  return csv(await rawQuery(query));
}

/** The shipped object ids: the directories of src/objects. */
export async function shippedObjects() {
  const entries = await readdir(resolve(repository, 'src/objects'), { withFileTypes: true });
  return new Set(entries.filter(entry => entry.isDirectory()).map(entry => entry.name));
}

/** Group the archive's science rows by the shipped object they name. */
export function observationsOf(rows: readonly Record<string, string>[], shipped: ReadonlySet<string>): ObjectObservation[] {
  const byId = new Map<string, { targets: Set<string>; frames: number; programmes: Set<string>; modes: Set<string> }>();
  for (const row of rows) {
    const id = matchShippedObject(row.object ?? '', shipped);
    if (!id) continue;
    const entry = byId.get(id) ?? { targets: new Set(), frames: 0, programmes: new Set(), modes: new Set() };
    entry.targets.add(row.object!); entry.frames += Number(row.n); entry.programmes.add(row.prog_id!);
    entry.modes.add(bucketOf(row.dp_tech ?? ''));
    byId.set(id, entry);
  }
  return [...byId].map(([id, entry]) => ({
    id, targets: [...entry.targets].sort(), frames: entry.frames,
    programmes: [...entry.programmes].sort(), modes: [...entry.modes].sort(),
  })).sort((a, b) => b.frames - a.frames || a.id.localeCompare(b.id));
}

/** Each mode's state, read from the pinned programs and the receipts beside them. */
export async function modeStates(byMode: Readonly<Record<string, number>>): Promise<ModeState[]> {
  const files = await readdir(PROGRAMS).catch(() => [] as string[]);
  const programs = files.filter(name => name.endsWith('.json') && !name.includes('.reproduction.'));
  const receipts = files.filter(name => name.includes('.reproduction.'));
  const pinned = new Map<string, string[]>();
  for (const name of programs) {
    const record = requireRecord(JSON.parse(await readFile(resolve(PROGRAMS, name), 'utf8')) as unknown, name);
    const mode = requireString(record.mode, 'mode');
    pinned.set(mode, [...pinned.get(mode) ?? [], name.replace(/\.json$/u, '')]);
  }
  const states: ModeState[] = [];
  for (const mode of Object.keys(byMode).sort()) {
    const ours = pinned.get(mode) ?? [];
    const theirs = receipts.filter(name => ours.some(program => name.startsWith(`${program}.`)));
    const refused = (REFUSED_TECHNIQUES as readonly string[]).includes(mode.toUpperCase());
    states.push({
      mode, frames: byMode[mode]!, programs: ours.sort(), receipts: theirs.sort(),
      state: theirs.length ? 'reduced' : ours.length ? 'pinned' : refused ? 'refused' : 'not reduced',
      reason: theirs.length ? `${theirs.length} receipt(s) beside ${ours.length} pinned program(s).`
        : ours.length ? 'A program is pinned and no receipt has been written for it.'
        : refused ? 'This route refuses the mode: the technique changes what a frame means and these recipes do not undo it.'
        : 'No program of this mode is pinned.',
    });
  }
  return states;
}

export async function buildLedger(today = new Date().toISOString().slice(0, 10)): Promise<Ledger> {
  const frames = await frameCounts(today);
  const rows = await scienceTargets(today);
  const objects = observationsOf(rows, await shippedObjects());
  return { schema: SCHEMA, instrument: INSTRUMENT, measured: today, frames, objects, modes: await modeStates(frames.byMode) };
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

| object | frames | modes | programmes | archive target names |
| --- | ---: | --- | --- | --- |
${objects.join('\n')}
`;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const ledger = await buildLedger();
  await mkdir(resolve(repository, 'data/naco'), { recursive: true });
  await writeFile(LEDGER, `${JSON.stringify(ledger, null, 2)}\n`);
  await writeFile(GUIDE, ledgerGuide(ledger));
  console.log(`${LEDGER}: ${thousands(ledger.frames.total)} frames, ${ledger.objects.length} shipped objects, ${ledger.modes.length} modes.`);
}

export type { NacoMode };
export { MODES };
