#!/usr/bin/env node
/** What the Keck Observatory Archive holds, for this project's objects, derived rather than declared.
 *
 *   node tools/objects/keck/archive-ledger.mts      writes data/keck/ledger.json and docs/keck-ledger.md
 *
 * Every count comes from KOA, counted server-side by an ADQL `GROUP BY` rather than by downloading rows and counting them
 * here. Every mode's state comes from the pinned programs and the product records and receipts beside them:
 *
 *   `reduced`: a program of that instrument is pinned AND a receipt exists that parses, names that exact observation and
 *     names a product of it. Nothing is `reduced` because a constant says so.
 *   `pinned`: a program of that instrument exists and no such receipt does.
 *   `held, not reducible`: KOA holds frames of that instrument and no open, scriptable pipeline for it runs here. The reason
 *     is recorded per instrument in REDUCTION_STATE, each one a fact that was checked, with where it was checked.
 *   `held`: frames, no program, and a pipeline that could reduce them.
 *
 * The object matcher is the careful part. A KOA `targname` is what the observer typed: `Europa___ 05-47`, `EUROPA`,
 * `52 Europa`. It is reduced to letters and digits, and a name carrying a minor-planet number matches only an id that carries
 * the same number, so 52 Europa is never Jupiter's moon. Only `koaimtyp='object'` rows count: a pointing, bias or flat frame
 * is not an observation of the object. */
import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { isRecord, requireRecord } from '../../sources/source-values.mts';
import { readProductRecord } from '../product-record.mts';
import { PROGRAMS, parseKeckProgram, type KeckProgram } from './archive.mts';
import { INSTRUMENT_TABLES, koaQuery, type InstrumentTable } from './koa.mts';
import { REDUCIBLE } from './reduce.mts';

const REPOSITORY = resolve(import.meta.dirname, '../../..');
export const OBJECTS = resolve(REPOSITORY, 'src/objects');
export const LEDGER = resolve(REPOSITORY, 'data/keck/ledger.json');
export const GUIDE = resolve(REPOSITORY, 'docs/keck-ledger.md');
export const SCHEMA = 'cssearth-keck-ledger@1';

/** Why an instrument's frames can or cannot be re-reduced here, and where that was checked. An entry is a statement about
 * software, not about this toolkit's progress: whether a pipeline exists, is open, and runs without commercial software. The
 * state a mode ends up in is worked out from the programs and receipts, never from this table. */
export const REDUCTION_STATE: Readonly<Record<InstrumentTable, { readonly pipeline: string; readonly open: boolean; readonly reason: string }>> = {
  koa_kcwi: { pipeline: 'KCWI DRP (kcwidrp)', open: true, reason: 'BSD-3-Clause, pure Python, installed here by toolchain.json; KOA publishes its own products of the same pipeline to check against.' },
  koa_deimos: { pipeline: 'PypeIt keck_deimos', open: true, reason: 'PypeIt supports it, but it is not installed here, and KOA publishes only JPEG quick-looks for DEIMOS, so a re-run would have no archive product to be checked against.' },
  koa_esi: { pipeline: 'PypeIt keck_esi', open: true, reason: 'PypeIt supports it; not installed here and KOA publishes no reduced product for it.' },
  koa_lris: { pipeline: 'PypeIt keck_lris_blue/_red', open: true, reason: 'PypeIt supports it; not installed here and KOA publishes no reduced product for it.' },
  koa_mosfire: { pipeline: 'PypeIt keck_mosfire', open: true, reason: 'PypeIt supports it; not installed here and KOA publishes no reduced product for it.' },
  koa_nires: { pipeline: 'PypeIt keck_nires', open: true, reason: 'PypeIt supports it; not installed here and KOA publishes no reduced product for it.' },
  koa_nirspec: { pipeline: 'PypeIt keck_nirspec_high_old', open: true, reason: "PypeIt 2.0.1 supports keck_nirspec_high, keck_nirspec_high_old (pre-2018 upgrade) and keck_nirspec_low (post-upgrade only), all BSD-3-Clause; it is not installed here. An archive product to check against exists for two Europa nights only: of thirteen Europa frames asked of nph-getL1list across eleven programmes, only 2006A returned any, and those are 1-D extracted spectra written by KOA's own NSDRP 0.9.16, a different pipeline from PypeIt, so agreement with them would be agreement between two pipelines and not a re-run of the archive's. Every other Europa programme, Paganini's water-vapour campaign included, has no archive product at all." },
  koa_hires: { pipeline: 'none', open: false, reason: "PypeIt 2.0.1 lists keck_hires as not supported in its own spectrographs table, and no other open HIRES pipeline was found." },
  koa_osiris: { pipeline: 'OSIRIS DRP', open: false, reason: "The OSIRIS DRP is written in IDL, which is commercial and is not on this machine. KOA publishes its own OSIRIS level-1 cubes, and each states its whole recipe in DRF comment cards, so they can be pinned and read but not remade." },
  koa_nirc2: { pipeline: 'KAI (Keck AO Imaging)', open: true, reason: "KAI 2.0.1 (2026-08-18) is BSD-3-Clause by its own licences/LICENSE.rst and setup.cfg, and needs only numpy, scipy, matplotlib, astropy, photutils, ccdproc and drizzle, with no IRAF or PyRAF; it is not installed here and that it runs was not verified. There is nothing to check a re-run against: of nine Europa frames asked of nph-getL1list across nine programmes, seven returned a log file and nothing else, two returned no file at all, and the two frames anywhere in NIRC2 that did return a reduced image state no pipeline, version or recipe in their headers at all (one says only that IDL wrote it). KOA's calibration association for a NIRC2 Europa frame is flats alone, with no darks and no sky frames, so even a consistency run would have to choose its own calibrations." },
  koa_nirc: { pipeline: 'none', open: false, reason: 'NIRC was retired in 2010 and no open pipeline for it was found.' },
  koa_lws: { pipeline: 'none', open: false, reason: 'LWS was retired and no open pipeline for it was found.' },
  koa_kpf: { pipeline: 'KPF DRP', open: true, reason: 'The KPF DRP is open; it is not installed here and KPF observes no Solar System body this project ships.' },
  koa_guider: { pipeline: 'none', open: false, reason: 'Guider frames are pointing exposures, not observations. KOA\'s own count query for the table fails server-side (ORA-12899 on KOAID_ALLOWED), so its rows are not counted here.' },
};

/** The one table KOA cannot count for an anonymous caller; its rows are reported as uncounted rather than as zero. */
export const UNCOUNTABLE: readonly InstrumentTable[] = ['koa_guider'];

/** A target name reduced to letters and digits, so `Europa___ 05-47` and `EUROPA` are one name. */
export const normalise = (name: string) => name.toUpperCase().replace(/[^A-Z0-9]/gu, '');

/** What a KOA observer's target name may be, longest first.
 *
 * Observers glue the time of the exposure onto the name they type, and they do it in as many ways as there are observers.
 * These are all real KOA target names for one moon: `Europa 06:30UT`, `Europa UT 11-05`, `europa 04 15:00`, `Europa___ 05-47`,
 * `Europa 21 13`, `Europa 270900`, `titan_3H40`, `195EURYKLEIA-26T0400`.
 *
 * Two things are dropped from the END of a name, repeatedly: a group that begins with a digit (with an optional `UT` in front
 * of it), and a bare `UT`. Nothing is dropped from the middle or the front, and nothing is dropped that would leave no letter
 * behind. Each step is offered as a candidate, longest first, so an id that ends in a digit is matched whole before a digit is
 * ever taken off it: `M 42` is `m42`, `WASP-43` is `wasp-43`, and only then is a stamp considered. */
export function nameCandidates(target: string): string[] {
  const STAMP = /[-_\s.]+(?:UT[-_\s.]*)?\d[\dA-Za-z:.\-]*$/iu, TRAILING_UT = /[-_\s.]+UT$/iu;
  const candidates: string[] = [];
  let text = target.trim();
  for (;;) {
    const compact = normalise(text);
    if (compact && !candidates.includes(compact)) candidates.push(compact);
    const shorter = text.replace(STAMP, '').replace(TRAILING_UT, '');
    if (shorter === text || !/[A-Za-z]/u.test(shorter)) return candidates;
    text = shorter;
  }
}

/** The shipped object id a KOA target name refers to, or null.
 *
 * A name that starts with a minor-planet number takes the id carrying that same number and nothing else, so `52 Europa` is
 * `europa-52` or no object at all, never Jupiter's moon. Any other name takes the first of its candidates that is a shipped
 * id: the whole name where the whole name is one, and otherwise the name with the observer's time stamp dropped. Nothing is
 * matched by prefix, and nothing is matched by a name that is only digits. */
export function matchShippedObject(target: string, shipped: ReadonlySet<string>) {
  const candidates = nameCandidates(target);
  const numbered = /^(\d{1,6})([A-Z].*)$/u.exec(candidates[0] ?? '');
  if (numbered) return [...shipped].find(id => normalise(id) === `${numbered[2]!}${numbered[1]!}`) ?? null;
  for (const candidate of candidates) {
    const id = [...shipped].find(entry => normalise(entry) === candidate);
    if (id) return id;
  }
  return null;
}

export interface ObjectObservation { readonly id: string; readonly frames: number; readonly targets: readonly string[]; readonly instruments: Readonly<Record<string, number>> }
export interface ModeState {
  readonly table: InstrumentTable; readonly instrument: string;
  readonly frames: number | null;
  /** Rows the archive's own CSV could not express, left out of `frames` (see targetCounts). */
  readonly unreadableRows: number;
  readonly objectFrames: number; readonly objects: number;
  readonly pipeline: string; readonly openPipeline: boolean;
  /** Whether that pipeline is one this toolkit installs and runs, from REDUCIBLE in reduce.mts. */
  readonly installedHere: boolean;
  readonly programs: readonly string[]; readonly receipts: readonly string[];
  readonly state: 'reduced' | 'pinned' | 'held, not reducible' | 'held'; readonly reason: string;
}
export interface Ledger {
  readonly schema: typeof SCHEMA; readonly archive: string; readonly measured: string;
  readonly shippedObjects: number;
  /** Receipts that did not stand up, with the reason. A mode is never `reduced` on the strength of one of these. */
  readonly receiptProblems: readonly ReceiptProblem[];
  readonly modes: readonly ModeState[];
  readonly objects: readonly ObjectObservation[];
}

export interface ReceiptCheck { readonly file: string; readonly instrument: string; readonly koaid: string; readonly product: string }
export interface ReceiptProblem { readonly file: string; readonly problem: string }

const HEX64 = /^[0-9a-f]{64}$/u;
const finite = (value: unknown) => typeof value === 'number' && Number.isFinite(value);

/** What one receipt has to say before it counts as evidence that an instrument was reduced.
 *
 * A receipt naming a schema, an instrument, a koaid and a stage says only that a file with those four fields exists. It says
 * nothing about a comparison having been made, about which bytes were compared, or about that still being true of what the
 * programs pin now. All three are checked here, against `programs` as they are on disk at this moment:
 *
 *   the comparison itself: at least one extension, each with the sample counts and the two cuts a comparison writes;
 *   the archive side: the exact product the current program pins for this observation, by archive path, byte count and
 *     sha256, and the bytes the comparison read equal to that pin;
 *   our side: a product record beside the file it names, written by a run of this observation, pinning that file at the
 *     digest the receipt states.
 *
 * Anything short of that is a problem with a reason, not evidence. A receipt written before a pin changed fails here, which
 * is the point: it was evidence about other bytes. */
export async function checkReceipt(file: string, value: Record<string, unknown>, programs: readonly KeckProgram[]): Promise<ReceiptCheck | ReceiptProblem> {
  const problem = (text: string): ReceiptProblem => ({ file, problem: text });
  const instrument = typeof value.instrument === 'string' ? value.instrument : '';
  const koaid = typeof value.koaid === 'string' ? value.koaid : '';
  const stage = typeof value.product === 'string' ? value.product : '';
  const id = typeof value.program === 'string' ? value.program : '';
  if (!instrument || !koaid || !stage || !id) return problem('it does not name a program, an instrument, an observation and a stage.');
  const program = programs.find(entry => entry.id === id);
  if (!program) return problem(`no program ${id} is pinned.`);
  if (program.instrument !== instrument) return problem(`${id} is a ${program.instrument} program and the receipt says ${instrument}.`);
  const observation = program.observations.find(entry => entry.koaid === koaid);
  if (!observation) return problem(`${id} pins no observation ${koaid}.`);

  const extensions = Array.isArray(value.extensions) ? value.extensions : null;
  if (!extensions?.length) return problem('it holds no compared extension, so no comparison is recorded in it.');
  for (const raw of extensions) {
    if (!isRecord(raw)) return problem('an extension is not a record.');
    if (typeof raw.extname !== 'string' || !finite(raw.samples) || !finite(raw.both)) return problem(`extension ${String(raw.extname)} states no sample counts.`);
    for (const cut of ['aboveMedian', 'aboveBrightestPercent']) {
      const entry = raw[cut];
      if (!isRecord(entry) || !finite(entry.samples) || !('correlation' in entry)) return problem(`extension ${String(raw.extname)} states no ${cut} cut.`);
    }
  }

  const archive = isRecord(value.archive) ? value.archive : null;
  if (!archive) return problem('it states nothing about the archive product it compared against.');
  const pinned = observation.archiveProducts.find(entry => entry.filehand === archive.filehand);
  if (!pinned) return problem(`${id} no longer pins an archive product at ${String(archive.filehand)}.`);
  if (archive.bytes !== pinned.bytes || archive.sha256 !== pinned.sha256)
    return problem(`the archive product it compared (${String(archive.bytes)} bytes, sha256 ${String(archive.sha256)}) is not the one ${id} pins now (${pinned.bytes} bytes, ${pinned.sha256}).`);
  const read = isRecord(archive.read) ? archive.read : null;
  if (!read || read.bytes !== pinned.bytes || read.sha256 !== pinned.sha256)
    return problem('it does not state that the bytes it read were the pinned bytes.');

  const ours = isRecord(value.local) ? value.local : null;
  if (!ours || typeof ours.record !== 'string' || typeof ours.name !== 'string' || !HEX64.test(String(ours.sha256)))
    return problem('it does not name our own product, its digest and the product record beside it.');
  const record = await readProductRecord(resolve(REPOSITORY, ours.record)).catch(() => null);
  if (!record) return problem(`the product record it names (${ours.record}) is not on this machine; run outputs are not committed, so re-run reduce.mts and compare.mts to restore the evidence.`);
  if ((record.parameters as { koaid?: unknown }).koaid !== koaid) return problem(`${ours.record} was written by a run of ${String((record.parameters as { koaid?: unknown }).koaid)}, not of ${koaid}.`);
  const route = REDUCIBLE[program.instrument];
  if (!route) return problem(`${program.instrument} has no reduction route here.`);
  const channel = route.channel(observation.science.name);
  const expected = [...observation.calibrations.filter(entry => route.channel(entry.name) === channel), observation.science];
  if (record.inputs.length !== expected.length || expected.some(pin => !record.inputs.some(input =>
    input.identity === pin.name && input.role === (pin.imageType ?? 'frame') && input.bytes === pin.bytes && input.sha256 === pin.sha256)))
    return problem(`${ours.record} was not made from the raw science and calibration frames this program pins now.`);
  const output = record.outputs.find(entry => entry.path === ours.name);
  if (!output) return problem(`${ours.record} does not name the product ${ours.name}.`);
  if (output.sha256 !== ours.sha256 || output.bytes !== ours.bytes) return problem(`${ours.record} pins ${ours.name} at ${output.sha256} and the receipt compared ${String(ours.sha256)}.`);
  return { file, instrument, koaid, product: stage };
}

/** Every pinned program, every receipt that stands up to `checkReceipt`, and, for each that does not, why. A receipt only
 * counts when a pinned program holds the exact observation it names AND everything else above still holds. */
export async function pinnedEvidence() {
  const names = await readdir(PROGRAMS).catch(() => [] as string[]);
  const entries = names.filter(entry => entry.endsWith('.json')).sort();
  const programs: KeckProgram[] = [], candidates: { file: string; value: Record<string, unknown> }[] = [];
  const problems: ReceiptProblem[] = [];
  for (const name of entries) {
    const value = requireRecord(JSON.parse(await readFile(resolve(PROGRAMS, name), 'utf8')) as unknown, name);
    if (value.schema === 'cssearth-keck-program@1') programs.push(parseKeckProgram(value));
    else if (value.schema === 'cssearth-keck-reproduction@1') candidates.push({ file: name, value });
    else problems.push({ file: name, problem: `it is neither a program nor a receipt (${String(value.schema)}).` });
  }
  const receipts: ReceiptCheck[] = [];
  for (const candidate of candidates) {
    const checked = await checkReceipt(candidate.file, candidate.value, programs);
    if ('problem' in checked) problems.push(checked); else receipts.push(checked);
  }
  return { programs: programs.map(program => ({ file: `${program.id}.json`, instrument: program.instrument, koaids: program.observations.map(entry => entry.koaid) })),
    receipts, receiptProblems: problems };
}

/** One instrument's science frames by target name, counted by the archive, and how many rows could not be read.
 *
 * KOA's CSV does not escape a quotation mark inside a target name: an observer who typed `SN 01fe 15"W` produces a row the
 * service writes as `"SN 01fe 15"W,1""`, which no CSV reader can take apart. Five such rows exist across ESI and LRIS. They
 * are counted as unreadable and left out of the totals rather than turned into a NaN that spreads through every sum. */
export async function targetCounts(table: InstrumentTable) {
  if (UNCOUNTABLE.includes(table)) return null;
  const rows = await koaQuery(`SELECT targname, count(*) AS frames FROM ${table} WHERE koaimtyp='object' GROUP BY targname`);
  const readable = rows.filter(row => /^\d+$/u.test((row.frames ?? '').trim()));
  return { rows: readable, unreadableRows: rows.length - readable.length };
}

export async function buildLedger(measured: string): Promise<Ledger> {
  const shipped = new Set((await readdir(OBJECTS, { withFileTypes: true })).filter(entry => entry.isDirectory()).map(entry => entry.name));
  const { programs, receipts, receiptProblems } = await pinnedEvidence();
  const found = new Map<string, { frames: number; targets: Set<string>; instruments: Record<string, number> }>();
  const modes: ModeState[] = [];
  for (const table of INSTRUMENT_TABLES) {
    const instrument = table.slice(4).toUpperCase();
    const counted = await targetCounts(table);
    let frames: number | null = counted === null ? null : 0, objectFrames = 0;
    const objects = new Set<string>();
    for (const row of counted?.rows ?? []) {
      const count = Number(row.frames ?? 0);
      frames = (frames ?? 0) + count;
      const id = matchShippedObject(row.targname ?? '', shipped);
      if (!id) continue;
      objects.add(id);
      objectFrames += count;
      const entry = found.get(id) ?? { frames: 0, targets: new Set<string>(), instruments: {} };
      entry.frames += count; entry.targets.add((row.targname ?? '').trim());
      entry.instruments[instrument] = (entry.instruments[instrument] ?? 0) + count;
      found.set(id, entry);
    }
    const rule = REDUCTION_STATE[table];
    const ours = programs.filter(program => program.instrument === instrument);
    const theirs = receipts.filter(receipt => receipt.instrument === instrument);
    const state: ModeState['state'] = ours.length && theirs.length ? 'reduced' : ours.length ? 'pinned' : rule.open ? 'held' : 'held, not reducible';
    modes.push({ table, instrument, frames, unreadableRows: counted?.unreadableRows ?? 0, objectFrames, objects: objects.size, pipeline: rule.pipeline, openPipeline: rule.open,
      installedHere: Boolean(REDUCIBLE[instrument]), programs: ours.map(program => program.file), receipts: theirs.map(receipt => receipt.file), state, reason: rule.reason });
  }
  const objects = [...found].map(([id, entry]) => ({ id, frames: entry.frames, targets: [...entry.targets].sort(),
    instruments: Object.fromEntries(Object.entries(entry.instruments).sort(([, a], [, b]) => b - a)) }))
    .sort((a, b) => b.frames - a.frames || (a.id < b.id ? -1 : 1));
  return { schema: SCHEMA, archive: 'https://koa.ipac.caltech.edu', measured, shippedObjects: shipped.size, receiptProblems, modes, objects };
}

const number = (value: number | null) => value === null ? 'not counted' : value.toLocaleString('en-US');

export function ledgerGuide(ledger: Ledger) {
  const lines = ['# What Keck holds', '',
    `Written by \`tools/objects/keck/archive-ledger.mts\` from the [Keck Observatory Archive](${ledger.archive}) on ${ledger.measured}.`,
    'Every count is the archive\'s own, taken with one grouped query per instrument. Every state is worked out from the pinned',
    `programs and the receipts beside them in \`tools/objects/keck/programs\`, not declared. ${ledger.shippedObjects} objects are shipped by this project.`,
    '', '## By instrument', '',
    '| instrument | science frames | on shipped objects | objects | pipeline | state |', '|---|---|---|---|---|---|'];
  for (const mode of ledger.modes) lines.push(`| ${mode.instrument} | ${number(mode.frames)} | ${mode.objectFrames.toLocaleString('en-US')} | ${mode.objects} | ${mode.pipeline} | ${mode.state} |`);
  lines.push('', '## Why each instrument is where it is', '');
  for (const mode of ledger.modes) lines.push(`- **${mode.instrument}**: ${mode.reason}${mode.programs.length ? ` Pinned: ${mode.programs.join(', ')}.` : ''}${mode.receipts.length ? ` Receipts: ${mode.receipts.join(', ')}.` : ''}`);
  if (ledger.receiptProblems.length) {
    lines.push('', '## Receipts that do not count', '',
      'A receipt counts only where it records a whole comparison, against the archive product the program pins now, with a',
      'product record beside our own product written by a run of that observation. These did not, and no instrument is',
      '`reduced` on the strength of them.', '');
    for (const problem of ledger.receiptProblems) lines.push(`- \`${problem.file}\`: ${problem.problem}`);
  }
  lines.push('', '## Shipped objects Keck observed', '',
    'Science frames only, matched from the observer\'s own target name. A name carrying a minor-planet number matches only an id',
    'carrying the same number, so 52 Europa is not Jupiter\'s moon.', '',
    '| object | frames | instruments |', '|---|---|---|');
  for (const object of ledger.objects.slice(0, 40))
    lines.push(`| ${object.id} | ${object.frames.toLocaleString('en-US')} | ${Object.entries(object.instruments).map(([name, count]) => `${name} ${count.toLocaleString('en-US')}`).join(', ')} |`);
  if (ledger.objects.length > 40) lines.push('', `${ledger.objects.length} objects matched in all; the rest are in [the ledger](../data/keck/ledger.json).`);
  return `${lines.join('\n')}\n`;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const measured = new Date().toISOString().slice(0, 10);
  const ledger = await buildLedger(measured);
  await mkdir(resolve(REPOSITORY, 'data/keck'), { recursive: true });
  await writeFile(LEDGER, `${JSON.stringify(ledger, null, 2)}\n`);
  await writeFile(GUIDE, ledgerGuide(ledger));
  console.log(`KECK_LEDGER ${LEDGER} (${ledger.objects.length} objects, ${ledger.modes.filter(mode => mode.state === 'reduced').length} of ${ledger.modes.length} instruments reduced)`);
}
