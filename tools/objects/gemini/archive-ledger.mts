#!/usr/bin/env node
/** What the Gemini archive holds for this project's bodies, and what this toolkit has actually proven, derived rather than
 * declared.
 *
 *   node tools/objects/gemini/archive-ledger.mts        writes data/gemini/ledger.json and docs/gemini-ledger.md
 *
 * Every count comes from the archive, counted server-side by an ADQL `GROUP BY` rather than by downloading rows and counting
 * them here. Every capability's state comes from the pinned programs and the receipts beside them: an instrument counts as
 * reduced because a program of that instrument is pinned **and** a receipt exists that parses, names that exact program and
 * that exact product, and is backed by a product record beside the product it names. A constant never says so.
 *
 * Three things the counting has to be careful about.
 *
 * - **Proprietary data.** CAOM records each plane's `dataRelease`. Everything here is counted with that date in the past, so
 *   the ledger is a census of what anyone can download without an account, which is the only thing this toolkit could use.
 * - **Acquisition frames are not observations.** A Gemini imaging acquisition is the pointing exposure taken before the real
 *   observation. It is real data of the target and it is never science, so it is counted apart and never as an observation.
 * - **Target names are what the observer typed.** They collide: `Europa` is Jupiter's moon and a main-belt asteroid carries
 *   the same name, so a numbered target only matches a shipped id that carries the same number.
 *
 * The Galilean moons get a census of their own, because Europa is this project's showcase body and the answer for it is a
 * negative one that a summary line would hide. Its three neighbours are asked for beside it so that "is there anything here
 * for the Galilean moons" is answered from the archive rather than from one moon and a guess. */
import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { requireArray, requireRecord, requireString } from '@cssearth/core';
import { parseProductRecord, type EvidenceKind } from '../product-record.mts';
import { PROGRAMS, parseGeminiProgram, type GeminiProgram } from './archive.mts';
import { query } from './cadc.mts';

const repository = resolve(import.meta.dirname, '../../..');
export const LEDGER = resolve(repository, 'data/gemini/ledger.json');
export const GUIDE = resolve(repository, 'docs/gemini-ledger.md');
export const SCHEMA = 'cssearth-gemini-ledger@1';
export const COLLECTION = 'GEMINI';

/** Frame types that are never an observation of the object: a pointing exposure and the calibration frames. */
export const NON_OBSERVING_TYPES = ['ACQUISITION', 'BIAS', 'DARK', 'FLAT', 'ARC'] as const;

/** What this toolkit can reduce, and what it cannot, each said once with its reason.
 *
 * DRAGONS 4.2 supports imaging from GMOS, NIRI, Flamingos-2 and GSAOI, and longslit spectroscopy from GMOS, GNIRS and
 * Flamingos-2. Everything else Gemini has flown either has no DRAGONS support at all or has support this toolkit has never
 * run and therefore cannot vouch for. The distinction matters: `unsupported` is a fact about DRAGONS, `unproven` is a fact
 * about this toolkit, and only the second can be fixed here. */
export const SUPPORT: Readonly<Record<string, { support: 'supported' | 'unsupported'; note: string }>> = {
  'GMOS-N': { support: 'supported', note: 'imaging and longslit spectroscopy in DRAGONS 4.2' },
  'GMOS-S': { support: 'supported', note: 'imaging and longslit spectroscopy in DRAGONS 4.2' },
  GMOS: { support: 'supported', note: 'imaging and longslit spectroscopy in DRAGONS 4.2' },
  NIRI: { support: 'supported', note: 'imaging in DRAGONS 4.2' },
  F2: { support: 'supported', note: 'imaging and longslit spectroscopy in DRAGONS 4.2' },
  GSAOI: { support: 'supported', note: 'imaging in DRAGONS 4.2' },
  GNIRS: { support: 'supported', note: 'longslit and cross-dispersed spectroscopy in DRAGONS 4.2' },
  NIFS: { support: 'unsupported', note: 'no DRAGONS support; its reduction path is the legacy Gemini IRAF stack' },
  GPI: { support: 'unsupported', note: 'its pipeline is IDL, which is proprietary and is not installed here' },
  TEXES: { support: 'unsupported', note: 'a visiting instrument with its own reduction, not in DRAGONS' },
  michelle: { support: 'unsupported', note: 'retired mid-infrared imager and spectrometer, not in DRAGONS' },
  TReCS: { support: 'unsupported', note: 'retired mid-infrared imager, not in DRAGONS' },
  NICI: { support: 'unsupported', note: 'retired coronagraphic imager, not in DRAGONS' },
  PHOENIX: { support: 'unsupported', note: 'visiting high-resolution spectrograph, not in DRAGONS' },
  'IGRINS': { support: 'unsupported', note: 'visiting spectrograph with its own pipeline, not in DRAGONS' },
  'IGRINS-2': { support: 'unsupported', note: 'visiting spectrograph with its own pipeline, not in DRAGONS' },
  GRACES: { support: 'unsupported', note: 'fibre-fed spectrograph reduced by OPERA, not in DRAGONS' },
  GHOST: { support: 'unsupported', note: 'reduced by its own GHOSTDR package, not the DRAGONS recipes pinned here' },
  'MAROON-X': { support: 'unsupported', note: 'visiting spectrograph with its own pipeline, not in DRAGONS' },
  Zorro: { support: 'unsupported', note: 'speckle imager; its products come from its own speckle pipeline, not DRAGONS' },
  Alopeke: { support: 'unsupported', note: 'speckle imager; its products come from its own speckle pipeline, not DRAGONS' },
};

/** A target name reduced to letters and digits, so `52_EUROPA` and `52 Europa` are one name. */
export const normalise = (name: string) => name.toUpperCase().replace(/[^A-Z0-9]/gu, '');

/** An observer's target name split into the parts that identify a body: a minor-planet number in front, and an ephemeris
 * suffix behind (`Europa.eph`, `-26T0400`), both of which observers add and neither of which is part of the name. */
export function parseTargetName(name: string) {
  const trimmed = name.trim().replace(/\.eph$/iu, '').replace(/[-_](?:\d{1,2}[TH]\d{2,4}|\d{1,3})$/u, '');
  const compact = normalise(trimmed);
  const numbered = /^(\d{1,6})([A-Z].*)$/u.exec(compact);
  return numbered ? { number: Number(numbered[1]), name: numbered[2]! } : { number: null, name: compact };
}

/** The shipped object id a Gemini target name refers to, or null.
 *
 * A numbered target takes the id that carries the same number and nothing else: `52 Europa` is `europa-52`, never `europa`.
 * An unnumbered target takes the bare id. Nothing is matched by prefix. */
export function matchShippedObject(target: string, shipped: ReadonlySet<string>) {
  const { number, name } = parseTargetName(target);
  if (!name) return null;
  if (number === null) return [...shipped].find(id => normalise(id) === name) ?? null;
  return [...shipped].find(id => normalise(id) === `${name}${number}`) ?? null;
}

/** The shipped object ids: the directories of src/objects. */
export async function shippedObjects() {
  const entries = await readdir(resolve(repository, 'src/objects'), { withFileTypes: true });
  return new Set(entries.filter(entry => entry.isDirectory()).map(entry => entry.name));
}

export interface InstrumentCount { readonly instrument: string; readonly frames: number; readonly science: number }
export interface ObjectObservation {
  readonly id: string; readonly targets: readonly string[]; readonly science: number;
  readonly acquisition: number; readonly instruments: readonly string[]; readonly programmes: number;
}
export interface MoonRow {
  readonly moon: string;
  readonly instrument: string; readonly type: string; readonly intent: string;
  readonly filter: string; readonly frames: number; readonly programmes: readonly string[];
}

/** The four Galilean moons, as this project ships them. Europa is the showcase body and the other three are asked for
 * beside it, because "does Gemini hold anything usable for the Galilean moons" is one question and answering it for one moon
 * would leave the other three to a guess. */
export const GALILEAN = ['io', 'europa', 'ganymede', 'callisto'] as const;
export interface CapabilityState {
  readonly instrument: string;
  readonly science: number;
  readonly support: 'supported' | 'unsupported';
  readonly state: 'reduced' | 'pinned' | 'unproven' | 'unsupported';
  readonly programs: readonly string[];
  /** Receipts accepted for this instrument, with the kind of evidence each establishes. */
  readonly evidence: readonly { readonly receipt: string; readonly product: string; readonly kind: EvidenceKind }[];
  readonly reason: string;
}

export interface Ledger {
  readonly schema: typeof SCHEMA;
  readonly collection: typeof COLLECTION;
  readonly archive: string;
  readonly measured: string;
  readonly publicOnly: string;
  readonly instruments: readonly InstrumentCount[];
  readonly objects: readonly ObjectObservation[];
  readonly galileanMoons: { readonly note: string; readonly rows: readonly MoonRow[] };
  readonly capabilities: readonly CapabilityState[];
  /** Receipts that could not be accepted, and so proved nothing. An empty list is the only passing state. */
  readonly receiptProblems: readonly string[];
}

const quote = (value: string) => `'${value.replace(/'/gu, "''")}'`;
const PUBLIC = (today: string) => `o.collection=${quote(COLLECTION)} AND p.dataRelease < ${quote(`${today}T00:00:00.000`)}`;
const JOIN = 'caom2.Observation o JOIN caom2.Plane p ON o.obsID=p.obsID';

/** Frames by instrument, counted by the archive: everything public, and the part of it that is science. */
export async function instrumentCounts(today: string): Promise<InstrumentCount[]> {
  const rows = await query(`SELECT o.instrument_name, o.intent, COUNT(*) AS n FROM ${JOIN} WHERE ${PUBLIC(today)} ` +
    `GROUP BY o.instrument_name, o.intent`);
  const totals = new Map<string, { frames: number; science: number }>();
  for (const row of rows) {
    const name = row.instrument_name ?? '', count = Number(row.n);
    if (!name || !Number.isFinite(count)) continue;
    const entry = totals.get(name) ?? { frames: 0, science: 0 };
    entry.frames += count;
    if (row.intent === 'science') entry.science += count;
    totals.set(name, entry);
  }
  return [...totals].map(([instrument, entry]) => ({ instrument, ...entry })).sort((a, b) => b.frames - a.frames);
}

/** Every public target name with what was taken on it, counted by the archive, for the shipped bodies only.
 *
 * Two queries rather than one. Grouping the whole collection by target name, instrument, type, intent and programme at once
 * asks the archive to build millions of groups, nearly all of them for objects this project does not ship, and it does not
 * return in any useful time. So the names are asked for first, matched here, and only the matching ones are counted. The
 * counting is still the archive's; what is done locally is deciding which names to ask about.
 *
 * Science and acquisition are counted apart, so a body whose only Gemini frames are pointing exposures cannot look like an
 * observed one. */
export async function targetCounts(today: string, shipped: ReadonlySet<string>) {
  // The candidate names come from `Observation` alone, with no join and no release filter: joining `Plane` for the release
  // date turns this into a scan of every plane in the collection and it does not return. Letting a proprietary name into the
  // candidate list costs nothing, because the counting query below applies the release filter properly and a name with no
  // public frames simply counts zero.
  const names = await query(`SELECT DISTINCT o.target_name FROM caom2.Observation o WHERE o.collection=${quote(COLLECTION)} ` +
    `AND o.target_name IS NOT NULL AND o.target_name <> ''`);
  const matched = names.map(row => row.target_name ?? '').filter(name => name && matchShippedObject(name, shipped));
  if (!matched.length) return [];
  const rows: Record<string, string>[] = [];
  // In batches, because a name list of thousands is longer than a query may be.
  for (let index = 0; index < matched.length; index += 200) {
    const batch = matched.slice(index, index + 200).map(quote).join(',');
    rows.push(...await query(`SELECT o.target_name, o.instrument_name, o.type, o.intent, o.proposal_id, COUNT(*) AS n ` +
      `FROM ${JOIN} WHERE ${PUBLIC(today)} AND o.target_name IN (${batch}) ` +
      `GROUP BY o.target_name, o.instrument_name, o.type, o.intent, o.proposal_id`));
  }
  return rows;
}

/** Group the archive's rows by the shipped object they name. */
export function observationsOf(rows: readonly Record<string, string>[], shipped: ReadonlySet<string>): ObjectObservation[] {
  const byId = new Map<string, { targets: Set<string>; science: number; acquisition: number; instruments: Set<string>; programmes: Set<string> }>();
  for (const row of rows) {
    const id = matchShippedObject(row.target_name ?? '', shipped);
    if (!id) continue;
    const entry = byId.get(id) ?? { targets: new Set(), science: 0, acquisition: 0, instruments: new Set(), programmes: new Set() };
    const count = Number(row.n);
    if (!Number.isFinite(count)) continue;
    if (row.intent === 'science' && !(NON_OBSERVING_TYPES as readonly string[]).includes(row.type ?? '')) entry.science += count;
    else if (row.type === 'ACQUISITION') entry.acquisition += count;
    else continue;
    entry.targets.add(row.target_name!); entry.instruments.add(row.instrument_name ?? ''); entry.programmes.add(row.proposal_id ?? '');
    byId.set(id, entry);
  }
  return [...byId].map(([id, entry]) => ({ id, targets: [...entry.targets].sort(), science: entry.science,
    acquisition: entry.acquisition, instruments: [...entry.instruments].filter(Boolean).sort(), programmes: entry.programmes.size }))
    .sort((a, b) => b.science - a.science || b.acquisition - a.acquisition || a.id.localeCompare(b.id));
}

/** Every public Gemini frame of the Galilean moons, by instrument, frame type, intent and filter.
 *
 * `Europa` and `Europa.eph` are both the moon: the second is the name an observer gives a non-sidereal target tracked on an
 * ephemeris. A numbered target such as `52 Europa` is a different body and carries its number, so it cannot reach a query
 * that asks for these names exactly. */
export async function galileanRows(today: string): Promise<MoonRow[]> {
  const names = GALILEAN.flatMap(moon => {
    const capitalised = `${moon[0]!.toUpperCase()}${moon.slice(1)}`;
    return [capitalised, `${capitalised}.eph`];
  });
  const rows = await query(`SELECT o.target_name, o.instrument_name, o.type, o.intent, p.energy_bandpassName, o.proposal_id, ` +
    `COUNT(*) AS n FROM ${JOIN} WHERE ${PUBLIC(today)} AND o.target_name IN (${names.map(quote).join(',')}) ` +
    `GROUP BY o.target_name, o.instrument_name, o.type, o.intent, p.energy_bandpassName, o.proposal_id`);
  const byKey = new Map<string, { row: Omit<MoonRow, 'frames' | 'programmes'>; frames: number; programmes: Set<string> }>();
  for (const row of rows) {
    const moon = (row.target_name ?? '').replace(/\.eph$/iu, '').toLowerCase();
    const key = [moon, row.instrument_name, row.type, row.intent, row.energy_bandpassName].join('|');
    const entry = byKey.get(key) ?? { frames: 0, programmes: new Set<string>(),
      row: { moon, instrument: row.instrument_name ?? '', type: row.type ?? '', intent: row.intent ?? '',
        filter: row.energy_bandpassName ?? '' } };
    entry.frames += Number(row.n); entry.programmes.add(row.proposal_id ?? '');
    byKey.set(key, entry);
  }
  return [...byKey.values()].map(entry => ({ ...entry.row, frames: entry.frames, programmes: [...entry.programmes].filter(Boolean).sort() }))
    .sort((a, b) => a.moon.localeCompare(b.moon) || a.instrument.localeCompare(b.instrument)
      || a.type.localeCompare(b.type) || a.filter.localeCompare(b.filter));
}

/** Whether a moon has any science frame of its own, as against pointing exposures. This is the whole question for Europa and
 * it is asked of the rows rather than written down. */
export const hasScience = (rows: readonly MoonRow[], moon: string) =>
  rows.some(row => row.moon === moon && row.intent === 'science' && !(NON_OBSERVING_TYPES as readonly string[]).includes(row.type));

/** What went wrong with one receipt, always said of the file it was in: a JSON parser names a position, not a file. */
const receiptProblem = (file: string, error: unknown) => {
  const said = error instanceof Error ? error.message : String(error);
  return said.startsWith(`${file}:`) ? said : `${file}: ${said}`;
};

export const RECEIPT_SCHEMA = 'cssearth-gemini-reproduction@1';
export const EVIDENCE_OF_RECEIPT = ['archive-agreement', 'internal-consistency'] as const;

/** One receipt read against the program it claims and the product record it rests on.
 *
 * A receipt is accepted only when all of this holds, and the reason is reported rather than swallowed when it does not: it
 * carries this route's schema, it names a pinned program, it is filed under that program's own name, it states which kind of
 * evidence it is, and the product it is about has a product record beside it that parses and names that same product. A
 * receipt that merely exists proves nothing, which is the whole point of checking it here. */
export function checkReceipt(value: unknown, file: string, program: GeminiProgram, records: ReadonlyMap<string, unknown>) {
  const row = requireRecord(value, file);
  const schema = requireString(row.schema, `${file}: schema`);
  if (schema !== RECEIPT_SCHEMA) throw new TypeError(`${file}: ${schema} is not a Gemini receipt.`);
  if (requireString(row.program, `${file}: program`) !== program.id) throw new TypeError(`${file}: it is the receipt of ${String(row.program)}.`);
  if (requireString(row.programme, `${file}: programme`) !== program.programme)
    throw new TypeError(`${file}: it names the programme ${String(row.programme)}, not ${program.programme}.`);
  const kind = requireString(row.evidence, `${file}: evidence`);
  if (!(EVIDENCE_OF_RECEIPT as readonly string[]).includes(kind)) throw new TypeError(`${file}: ${kind} is not a kind of evidence this route writes.`);
  const product = kind === 'archive-agreement'
    ? requireString(requireRecord(row.ours, `${file}: ours`).product, `${file}: our product`)
    : requireString(requireRecord(requireArray(row.halves, `${file}: halves`)[0], `${file}: first half`).product, `${file}: first half product`);
  const record = records.get(product);
  if (record === undefined) throw new TypeError(`${file}: it is about ${product}, which has no product record beside it.`);
  const parsed = parseProductRecord(record);
  if (!parsed.outputs.some(output => output.path === product)) throw new TypeError(`${file}: the record beside ${product} did not produce it.`);
  if (!parsed.evidence.some(entry => entry.kind === kind && entry.product === product))
    throw new TypeError(`${file}: the record beside ${product} carries no ${kind} evidence for it.`);
  return { product, kind: kind as EvidenceKind, instrument: program.instrument };
}

/** Product records found in a work directory, keyed by the product each is about. A ledger run has no work directory of its
 * own, so an absent one simply means nothing has been reduced on this machine and the receipts cannot be accepted. */
export async function productRecords(work: string | null): Promise<Map<string, unknown>> {
  const found = new Map<string, unknown>();
  if (!work) return found;
  const walk = async (directory: string, depth: number): Promise<void> => {
    if (depth > 3) return;
    for (const entry of await readdir(directory, { withFileTypes: true }).catch(() => [])) {
      const path = resolve(directory, entry.name);
      if (entry.isDirectory()) { await walk(path, depth + 1); continue; }
      if (!entry.name.endsWith('.product.json')) continue;
      found.set(entry.name.replace(/\.product\.json$/u, ''), JSON.parse(await readFile(path, 'utf8')) as unknown);
    }
  };
  await walk(work, 0);
  return found;
}

/** Each instrument's state, read from the pinned programs and the receipts beside them. */
export async function capabilityStates(instruments: readonly InstrumentCount[], work: string | null,
  directory = PROGRAMS): Promise<{ capabilities: CapabilityState[]; problems: string[] }> {
  const files = (await readdir(directory).catch(() => [] as string[])).sort();
  const programs = new Map<string, GeminiProgram>();
  const problems: string[] = [];
  for (const name of files.filter(name => name.endsWith('.json') && !name.includes('.reproduction.'))) {
    try { const program = parseGeminiProgram(JSON.parse(await readFile(resolve(directory, name), 'utf8')) as unknown);
      programs.set(program.id, program); }
    catch (error) { problems.push(receiptProblem(name, error)); }
  }
  const records = await productRecords(work);
  const accepted = new Map<string, { receipt: string; product: string; kind: EvidenceKind }[]>();
  for (const name of files.filter(name => name.includes('.reproduction.'))) {
    const id = name.slice(0, name.indexOf('.'));
    const program = programs.get(id);
    if (!program) { problems.push(`${name}: it belongs to no pinned program.`); continue; }
    try {
      const { product, kind, instrument } = checkReceipt(JSON.parse(await readFile(resolve(directory, name), 'utf8')) as unknown, name, program, records);
      accepted.set(instrument, [...accepted.get(instrument) ?? [], { receipt: name, product, kind }]);
    } catch (error) { problems.push(receiptProblem(name, error)); }
  }
  const capabilities = instruments.map(({ instrument, science }): CapabilityState => {
    const known = SUPPORT[instrument];
    const ours = [...programs.values()].filter(program => program.instrument === instrument).map(program => program.id).sort();
    const evidence = (accepted.get(instrument) ?? []).sort((a, b) => a.receipt.localeCompare(b.receipt));
    const support = known?.support ?? 'unsupported';
    const state = evidence.length ? 'reduced' as const : ours.length ? 'pinned' as const
      : support === 'supported' ? 'unproven' as const : 'unsupported' as const;
    return { instrument, science, support, state, programs: ours, evidence,
      reason: evidence.length ? `${evidence.length} accepted receipt(s) beside ${ours.length} pinned program(s).`
        : ours.length ? 'A program is pinned and no receipt has been accepted for it.'
        : support === 'supported' ? `DRAGONS supports it (${known!.note}) and nothing here has been reduced through it yet.`
        : known?.note ?? 'No DRAGONS support is pinned here for this instrument.' };
  });
  return { capabilities, problems: problems.sort((a, b) => a.localeCompare(b, 'en')) };
}

export async function buildLedger(work: string | null, today = new Date().toISOString().slice(0, 10)): Promise<Ledger> {
  const instruments = await instrumentCounts(today);
  const shipped = await shippedObjects();
  const objects = observationsOf(await targetCounts(today, shipped), shipped);
  const galilean = await galileanRows(today);
  const { capabilities, problems } = await capabilityStates(instruments, work);
  return { schema: SCHEMA, collection: COLLECTION,
    archive: 'CADC, which mirrors the Gemini raw archive as CAOM-2 collection GEMINI and answers anonymously. ' +
      'archive.gemini.edu refuses anonymous requests from this machine.',
    measured: today,
    publicOnly: 'Every count here is of planes whose dataRelease has passed, so it is a census of what anyone can download without an account.',
    instruments, objects,
    galileanMoons: { note: galileanNote(galilean, capabilities), rows: galilean },
    capabilities, receiptProblems: problems };
}

/** The instruments that took a moon's science frames, each with what this toolkit can do about it.
 *
 * This is the question the ledger exists to answer, and it is answered by crossing the archive's own counts with the state
 * this run derived for each instrument. Nothing is written down twice. */
export function scienceInstruments(rows: readonly MoonRow[], moon: string, capabilities: readonly CapabilityState[]) {
  const byInstrument = new Map<string, number>();
  for (const row of rows) {
    if (row.moon !== moon || row.intent !== 'science' || (NON_OBSERVING_TYPES as readonly string[]).includes(row.type)) continue;
    byInstrument.set(row.instrument, (byInstrument.get(row.instrument) ?? 0) + row.frames);
  }
  return [...byInstrument].map(([instrument, frames]) => ({ instrument, frames,
    state: capabilities.find(entry => entry.instrument === instrument)?.state ?? 'unsupported' }))
    .sort((a, b) => b.frames - a.frames);
}

/** What the Galilean rows add up to, said from the rows themselves and from what this run proved.
 *
 * The distinction this has to keep is the one a summary destroys. Europa **does** have Gemini science frames; every one of
 * them is a spectrum, and every image of it is an `ACQUISITION` exposure taken to point the telescope. Saying only "Europa
 * has science frames" would invite reducing one, and saying only "Europa has no science images" would be a different claim
 * from the one the archive supports. Both are stated, and then the only question that decides anything: whether any of the
 * instruments that took those frames is one this toolkit has actually proven. */
export function galileanNote(rows: readonly MoonRow[], capabilities: readonly CapabilityState[] = []): string {
  const said: string[] = [];
  for (const moon of GALILEAN) {
    const instruments = scienceInstruments(rows, moon, capabilities);
    if (!rows.some(row => row.moon === moon)) { said.push(`${moon}: nothing public at all.`); continue; }
    if (!instruments.length) { said.push(`${moon}: pointing exposures only, and no science frame of any kind.`); continue; }
    const proven = instruments.filter(entry => entry.state === 'reduced');
    said.push(`${moon}: ${instruments.map(entry => `${entry.instrument} ${entry.frames} (${entry.state})`).join(', ')}. ` +
      `${proven.length ? `Reducible here through ${proven.map(entry => entry.instrument).join(', ')}.`
        : 'No instrument that observed it has been proven by this toolkit, so nothing here can be reduced for it.'}`);
  }
  const withScience = GALILEAN.filter(moon => hasScience(rows, moon));
  const reducible = GALILEAN.filter(moon => scienceInstruments(rows, moon, capabilities).some(entry => entry.state === 'reduced'));
  const count = (many: readonly string[]) => many.length === GALILEAN.length ? 'all four' : many.length ? String(many.length) : 'none';
  return [`Of the four Galilean moons, ${count(withScience)} have public Gemini science frames` +
    `${withScience.length ? ` (${withScience.join(', ')})` : ''}, and ${count(reducible)}` +
    `${reducible.length && reducible.length < GALILEAN.length ? ` (${reducible.join(', ')})` : ''} ` +
    'were taken on an instrument this toolkit has proven.',
    'What decides whether anything can be done with a moon is not whether frames exist but whether the instrument that took ' +
    'them is one this toolkit has proven, so each moon is listed with the state of every instrument that observed it.',
    ...said].join(' ');
}

const table = (header: readonly string[], rows: readonly (readonly string[])[]) =>
  [`| ${header.join(' | ')} |`, `|${header.map(() => '---').join('|')}|`, ...rows.map(row => `| ${row.join(' | ')} |`)].join('\n');

export function ledgerMarkdown(ledger: Ledger): string {
  const supported = ledger.capabilities.filter(entry => entry.support === 'supported');
  return [
    '# What the Gemini archive holds for cssEarth',
    '',
    `Written by \`tools/objects/gemini/archive-ledger.mts\` from the archive itself on ${ledger.measured}. Nothing here is`,
    'typed in by hand: the counts are the archive\'s own `GROUP BY` results and each capability\'s state is read from the',
    'pinned programs and the receipts beside them. Re-run the command to bring it up to date.',
    '',
    ledger.publicOnly,
    '',
    `Where the bytes come from: ${ledger.archive}`,
    '',
    '## What this toolkit has proven',
    '',
    'A capability is `reduced` only when a receipt exists that parses, names a pinned program and names a product that has a',
    'product record carrying that same evidence. `pinned` means an observation is pinned and nothing has been checked yet.',
    '`unproven` means DRAGONS supports the instrument and nothing here has run it. `unsupported` means DRAGONS does not',
    'reduce it at all, which is a fact about DRAGONS and not something this toolkit can fix.',
    '',
    table(['instrument', 'public science frames', 'DRAGONS', 'state', 'why'],
      supported.map(entry => [entry.instrument, String(entry.science), entry.support, entry.state, entry.reason])),
    '',
    ledger.capabilities.filter(entry => entry.support === 'unsupported').length
      ? ['Instruments DRAGONS does not reduce, with their public science frames:', '',
          table(['instrument', 'public science frames', 'why'],
            ledger.capabilities.filter(entry => entry.support === 'unsupported')
              .map(entry => [entry.instrument, String(entry.science), entry.reason]))].join('\n')
      : '',
    '',
    '## Every public Gemini frame of the Galilean moons',
    '',
    ledger.galileanMoons.note,
    '',
    table(['moon', 'instrument', 'type', 'intent', 'filter or band', 'frames', 'programmes'],
      ledger.galileanMoons.rows.map(row => [row.moon, row.instrument, row.type, row.intent, row.filter || 'none',
        String(row.frames), row.programmes.join(', ') || 'none'])),
    '',
    '## cssEarth objects Gemini observed',
    '',
    'Science frames and acquisition frames counted apart, because an acquisition frame is a pointing exposure and never an',
    'observation. A body whose only Gemini frames are acquisitions has no Gemini observation at all.',
    '',
    table(['object', 'science frames', 'acquisition frames', 'programmes', 'instruments'],
      ledger.objects.slice(0, 60).map(row => [row.id, String(row.science), String(row.acquisition), String(row.programmes),
        row.instruments.join(', ')])),
    '',
    ledger.objects.length > 60 ? `${ledger.objects.length - 60} further objects have fewer frames.` : '',
    '',
    '## Every instrument in the public collection',
    '',
    table(['instrument', 'public frames', 'of which science'],
      ledger.instruments.map(row => [row.instrument, String(row.frames), String(row.science)])),
    '',
    '## Receipts that could not be accepted',
    '',
    ledger.receiptProblems.length ? ledger.receiptProblems.map(problem => `- ${problem}`).join('\n')
      : 'None. Every receipt beside a pinned program parses, names that program, and is backed by a product record.',
    '',
  ].filter(line => line !== '').join('\n');
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const work = process.argv[2] ? resolve(process.argv[2]) : null;
  const ledger = await buildLedger(work);
  await mkdir(resolve(LEDGER, '..'), { recursive: true });
  await writeFile(LEDGER, `${JSON.stringify(ledger, null, 2)}\n`);
  await writeFile(GUIDE, `${ledgerMarkdown(ledger)}\n`);
  console.log(`${ledger.instruments.length} instruments, ${ledger.objects.length} shipped objects, ` +
    `${ledger.galileanMoons.rows.length} Galilean rows, ${ledger.capabilities.filter(entry => entry.state === 'reduced').length} reduced. ` +
    `${ledger.receiptProblems.length} receipt problem(s).`);
}
