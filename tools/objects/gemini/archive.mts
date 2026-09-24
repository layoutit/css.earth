#!/usr/bin/env node
/** Pin a Gemini programme's raw science frames and the calibrations the archive associates with them, as a
 * cssearth-gemini-program@1.
 *
 *   node tools/objects/gemini/archive.mts <program id> <proposal id> <filter> [--days 15] [--start YYYY-MM-DD]
 *
 * Every file is pinned by its CAOM artifact URI, its byte count and the archive's own md5, with our sha256 added the first
 * time it is downloaded. Beside them the pin records what the frame is: the CAOM observation, its type (OBJECT, BIAS, FLAT),
 * its intent, its filter, its exposure, when it started and the date CAOM says it became public. A frame whose release date
 * has not passed is refused, so nothing proprietary is ever pinned.
 *
 * The science frames are the programme's `OBJECT`/`science` frames in one filter. An `ACQUISITION` frame is a pointing
 * exposure, not science, and is never pinned as one.
 *
 * **The calibration association is the archive's own, not ours.** Gemini's calibration manager (`/calmgr/`) is behind the
 * login that refuses this machine, but the archive serves the processed master calibrations its nightly pipeline made, and
 * each one names its own inputs in the `IMCMB00n` cards of its first extension header. So a calibration set here is one
 * archive master plus exactly the raw frames that master says went into it, read from the master's own header over a range
 * request. That is a stronger pin than a query of our own would be: the master states which frames it combined, so a re-run
 * of those frames has the archive's own product to be checked against, and the master is pinned beside them for it.
 *
 * Two sets are pinned, both of them masters DRAGONS can be asked to reproduce: a `BIAS` and a `FLAT`. A master is only taken
 * when its detector configuration matches the science frames': the same detector, amplifier count, amplifier integration
 * time and read-out region, all read from the primary headers. That is what makes a calibration applicable. A flat
 * must also be the science frames' own filter; a bias carries none, being taken with the shutter closed. How far the master
 * is from the science frames in days is recorded rather than bounded, so a reader sees the gap instead of trusting a window.
 *
 * Each pinned science frame's primary header is also checked against CAOM (instrument, object, exposure), and a
 * disagreement stops the pin.
 *
 * The program is written to tools/objects/gemini/programs/<program id>.json. */
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { readFitsHeader, type FitsHeader } from '../../fits/fits.mts';
import { requireArray, requireFiniteNumber, requireRecord, requireString } from '@cssearth/core';
import { flagValue, positionalArguments } from '../../cli/cli-arguments.mts';
import { artifactName, isRawName, primaryHeaderBytes, query, requireMd5, ARTIFACT_URI, type GeminiFile } from './cadc.mts';
import { sha256File } from '@cssearth/core/node';

export const PROGRAMS = resolve(import.meta.dirname, 'programs');
/** What a raw Gemini frame can be. `ACQUISITION` is a pointing exposure: real data, never a science frame. */
export const FRAME_TYPES = ['OBJECT', 'BIAS', 'DARK', 'FLAT', 'ARC', 'ACQUISITION'] as const;
export const CALIBRATION_KINDS = ['BIAS', 'DARK', 'FLAT'] as const;
export type CalibrationKind = (typeof CALIBRATION_KINDS)[number];
/** What makes a calibration applicable to a science frame: the detector, how it was read out, and the region read. */
export const CONFIG_KEYS = ['DETECTOR', 'NAMPS', 'AMPINTEG', 'DETRO1XS', 'DETRO1YS'] as const;
export type Configuration = Readonly<Record<(typeof CONFIG_KEYS)[number], string>>;

export interface GeminiFrame extends GeminiFile {
  /** The CAOM observation this artifact belongs to (`GS-2025B-DD-102-45-003`). */
  readonly observation: string;
  readonly type: string;
  readonly intent: string;
  /** CAOM's `energy_bandpassName`: the filter for an image, the order-sorting filter for a spectrum, empty for a bias. */
  readonly filter: string;
  readonly exposureSeconds: number;
  readonly startMjd: number;
  /** The date CAOM records the plane as public. A pin refuses a date in the future. */
  readonly dataRelease: string;
}

/** What CAOM calls the raw frames each kind of master combines.
 *
 * A GMOS twilight flat is recorded as an `OBJECT` frame of target `Twilight`, not as a `FLAT`: `FLAT` in this instrument's
 * raw table is the GCAL lamp flat a spectrum needs, and it is taken through a different aperture. So a set's kind is the
 * master's kind, and what the archive calls its raw frames is a separate fact, checked against this list rather than assumed
 * to be the same word. */
export const RAW_TYPES: Readonly<Record<CalibrationKind, readonly string[]>> = {
  BIAS: ['BIAS'], DARK: ['DARK'], FLAT: ['FLAT', 'OBJECT'],
};

export interface GeminiCalibrationSet {
  /** What this set is for, and the name of the stage that reduces it: `bias` and `flat` are the science frames' own
   * calibrations, and `flat-bias` is the bias the flat needs before it can be combined. */
  readonly id: string;
  readonly kind: CalibrationKind;
  /** The archive's processed master: what a re-run of these raw frames is compared against. */
  readonly product: GeminiFrame;
  /** What the master's own header says made it, in words, with the cards it was read from. */
  readonly association: string;
  /** How far the master's frames are from the science frames, in days. Recorded rather than bounded: a bias is taken nightly
   * and a twilight flat is not, so the gap is a fact about the night that a reader has to see. */
  readonly daysFromScience: number;
  /** The id of the set whose master this one needs before it can be reduced, where it needs one.
   *
   * A flat is bias-subtracted before it is combined, and the archive's flat names the bias it used in its `BIASIM` card. That
   * named master cannot be handed to DRAGONS: the archive's masters are Gemini IRAF products trimmed to a different detector
   * section, and DRAGONS refuses one that does not cover the section it is correcting rather than mis-applying it. So what is
   * pinned is that master's **own raw frames**, as a set of its own, and the flat is reduced with the bias this toolkit makes
   * from them. The chain is then DRAGONS from the raw frames down, which is the only way it can be. */
  readonly requiresBias?: string;
  /** Exactly the raw frames the master names, in the order it names them. */
  readonly frames: readonly GeminiFrame[];
}

export interface GeminiProgram {
  readonly schema: 'cssearth-gemini-program@1';
  readonly id: string;
  /** The Gemini proposal id, as CAOM records it (`GS-2025B-DD-102`). */
  readonly programme: string;
  readonly principalInvestigator: string;
  readonly target: string;
  readonly instrument: string;
  readonly filter: string;
  /** When the pinned sequence's first exposure began, in UTC. One pin holds one commanded sequence. */
  readonly sequenceStart: string;
  /** The detector configuration the science frames and every pinned calibration share. */
  readonly configuration: Configuration;
  /** Where the bytes come from. Gemini's own archive refuses anonymous requests; CADC mirrors the same raw collection. */
  readonly archive: 'CADC/GEMINI';
  readonly science: readonly GeminiFrame[];
  readonly calibrations: readonly GeminiCalibrationSet[];
}

const frame = (value: unknown): GeminiFrame => {
  const row = requireRecord(value, 'Gemini frame'), uri = requireString(row.uri, 'Frame URI');
  const name = requireString(row.name, 'Frame name'), bytes = requireFiniteNumber(row.bytes, 'Frame bytes');
  if (!ARTIFACT_URI.test(uri) || artifactName(uri) !== name) throw new TypeError(`${name} does not match its artifact URI.`);
  if (!Number.isSafeInteger(bytes) || bytes < 2880) throw new TypeError(`${name} has no plausible byte count.`);
  const type = requireString(row.type, 'Frame type'), intent = requireString(row.intent, 'Frame intent');
  if (!(FRAME_TYPES as readonly string[]).includes(type)) throw new TypeError(`${name}: ${type} is not a Gemini frame type.`);
  if (intent !== 'science' && intent !== 'calibration') throw new TypeError(`${name}: ${intent} is not a Gemini intent.`);
  const release = requireString(row.dataRelease, 'Data release');
  if (Number.isNaN(Date.parse(release))) throw new TypeError(`${name} has no release date.`);
  if (Date.parse(release) > Date.now()) throw new TypeError(`${name} is proprietary until ${release}; it is not pinned.`);
  if (row.sha256 !== undefined && !/^[0-9a-f]{64}$/u.test(requireString(row.sha256, 'Frame sha256'))) throw new TypeError(`${name} has an invalid sha256.`);
  return { name, uri, bytes, md5: requireMd5(row.md5, `${name} md5`), ...(row.sha256 === undefined ? {} : { sha256: row.sha256 as string }),
    observation: requireString(row.observation, 'Observation'), type, intent, filter: requireString(row.filter, 'Filter'),
    exposureSeconds: requireFiniteNumber(row.exposureSeconds, 'Exposure'), startMjd: requireFiniteNumber(row.startMjd, 'Start MJD'),
    dataRelease: release };
};

const configuration = (value: unknown): Configuration => {
  const row = requireRecord(value, 'Configuration');
  return Object.fromEntries(CONFIG_KEYS.map(key => [key, requireString(row[key], key)])) as unknown as Configuration;
};

export function parseGeminiProgram(value: unknown): GeminiProgram {
  const row = requireRecord(value, 'Gemini program');
  if (row.schema !== 'cssearth-gemini-program@1') throw new TypeError('Unsupported Gemini program.');
  if (row.archive !== 'CADC/GEMINI') throw new TypeError('A Gemini program is pinned against CADC/GEMINI.');
  const science = requireArray(row.science, 'science').map(frame);
  if (!science.length) throw new TypeError('A Gemini program pins at least one science frame.');
  if (!science.every(entry => entry.type === 'OBJECT' && entry.intent === 'science'))
    throw new TypeError('A science frame is an OBJECT frame of science intent; an acquisition frame is not one.');
  if (!science.every(entry => isRawName(entry.name))) throw new TypeError('A science frame is a raw archive frame.');
  const calibrations = requireArray(row.calibrations, 'calibrations').map(value => {
    const set = requireRecord(value, 'Calibration set'), kind = requireString(set.kind, 'Calibration kind');
    if (!(CALIBRATION_KINDS as readonly string[]).includes(kind)) throw new TypeError(`${kind} is not a calibration kind.`);
    const frames = requireArray(set.frames, 'Calibration frames').map(frame), product = frame(set.product);
    if (!frames.length) throw new TypeError(`The ${kind} set pins no raw frames.`);
    const allowed = RAW_TYPES[kind as CalibrationKind];
    if (!frames.every(entry => allowed.includes(entry.type) && isRawName(entry.name)))
      throw new TypeError(`The ${kind} set pins a frame that is not a raw ${allowed.join(' or ')} frame.`);
    if (isRawName(product.name)) throw new TypeError(`The ${kind} set's product is a raw frame, not the archive's master.`);
    const association = requireString(set.association, 'Association');
    if (!association.includes('IMCMB')) throw new TypeError(`The ${kind} set does not say which cards associated its frames.`);
    const id = requireString(set.id, 'Calibration set id');
    if (!/^[a-z][a-z-]*$/u.test(id)) throw new TypeError(`${id} is not a calibration set id.`);
    return { id, kind: kind as CalibrationKind, product, association,
      daysFromScience: requireFiniteNumber(set.daysFromScience, 'daysFromScience'),
      ...(set.requiresBias === undefined ? {} : { requiresBias: requireString(set.requiresBias, 'requiresBias') }), frames };
  });
  const all = [...science, ...calibrations.flatMap(set => [set.product, ...set.frames])];
  if (new Set(all.map(entry => entry.name)).size !== all.length) throw new TypeError('A file is pinned twice.');
  const ids = new Set(calibrations.map(set => set.id));
  if (ids.size !== calibrations.length) throw new TypeError('Two calibration sets share an id.');
  for (const set of calibrations) {
    if (set.requiresBias === undefined) continue;
    const needed = calibrations.find(entry => entry.id === set.requiresBias);
    if (!needed) throw new TypeError(`The ${set.id} set needs the ${set.requiresBias} set, which is not pinned.`);
    if (needed.kind !== 'BIAS') throw new TypeError(`The ${set.id} set names ${set.requiresBias} as its bias, but that set is a ${needed.kind}.`);
  }
  return { schema: row.schema, id: requireString(row.id, 'Program id'), programme: requireString(row.programme, 'Programme'),
    principalInvestigator: requireString(row.principalInvestigator, 'PI'), target: requireString(row.target, 'Target'),
    instrument: requireString(row.instrument, 'Instrument'), filter: requireString(row.filter, 'Filter'),
    sequenceStart: requireString(row.sequenceStart, 'Sequence start'),
    configuration: configuration(row.configuration), archive: 'CADC/GEMINI', science, calibrations };
}

/** A program id is lowercase letters, digits and hyphens: it is a file name and a receipt name, and both are read back by
 * the same pattern. Checked when a program is written as well as when it is read, so a pin cannot make a file its own reader
 * would refuse. */
export const PROGRAM_ID = /^[a-z0-9-]+$/u;
export const requireProgramId = (id: string) => { if (!PROGRAM_ID.test(id)) throw new TypeError(`${id} is not a program id.`); return id; };

/** Every file a program pins, in one list: the science frames, each calibration set's raw frames, its archive master and the
 * processed bias that master declares. One place decides what a program's files are, so a downloader, a digester and a
 * ledger cannot disagree about it. */
export const programFiles = (program: GeminiProgram): GeminiFrame[] => [...program.science,
  ...program.calibrations.flatMap(set => [...set.frames, set.product])];

export async function writeGeminiProgram(program: GeminiProgram): Promise<GeminiProgram> {
  const checked = parseGeminiProgram(program);
  await mkdir(PROGRAMS, { recursive: true });
  await writeFile(resolve(PROGRAMS, `${checked.id}.json`), `${JSON.stringify(checked, null, 2)}\n`);
  return checked;
}

/** Add our own sha256 to every pinned file that is on disk and has none yet, and check the ones that have one.
 *
 * The archive states a byte count and an md5, and `geminiFile` refuses a download that misses either. The sha256 is ours: it
 * is what `assertInputPins` checks before a reduction runs, so a frame that changed under us stops the pipeline instead of
 * quietly reducing into a product. A file that is not on disk is left alone rather than guessed at. */
export async function digestProgram(program: GeminiProgram, directory: string): Promise<GeminiProgram> {
  const digests = new Map<string, string>();
  for (const entry of programFiles(program)) {
    const path = resolve(directory, entry.name);
    const found = await sha256File(path).catch(() => null);
    if (!found) continue;
    if (found.bytes !== entry.bytes) throw new Error(`${entry.name} on disk is ${found.bytes} bytes, not the pinned ${entry.bytes}.`);
    if (entry.sha256 !== undefined && entry.sha256 !== found.sha256) throw new Error(`${entry.name} on disk differs from its pinned sha256.`);
    digests.set(entry.name, found.sha256);
  }
  const withDigest = (entry: GeminiFrame): GeminiFrame => digests.has(entry.name) ? { ...entry, sha256: digests.get(entry.name)! } : entry;
  return writeGeminiProgram({ ...program, science: program.science.map(withDigest),
    calibrations: program.calibrations.map(set => ({ ...set, product: withDigest(set.product), frames: set.frames.map(withDigest) })) });
}

export async function readGeminiProgram(id: string): Promise<GeminiProgram> {
  requireProgramId(id);
  return parseGeminiProgram(JSON.parse(await readFile(resolve(PROGRAMS, `${id}.json`), 'utf8')) as unknown);
}

export const FRAME_COLUMNS = 'o.observationID, o.type, o.intent, o.instrument_name, o.proposal_id, o.proposal_pi, o.target_name, ' +
  'p.energy_bandpassName, p.time_exposure, p.time_bounds_lower, p.dataRelease, a.uri, a.contentLength, a.contentChecksum';
export const FRAME_JOIN = 'caom2.Observation o JOIN caom2.Plane p ON o.obsID=p.obsID JOIN caom2.Artifact a ON p.planeID=a.planeID';
const JOIN = FRAME_JOIN;
const quote = (value: string) => `'${value.replace(/'/gu, "''")}'`;

const toFrame = (row: Record<string, string>): GeminiFrame => {
  const uri = row.uri ?? '';
  return { name: artifactName(uri), uri, bytes: Number(row.contentLength), md5: requireMd5(row.contentChecksum, `${uri} checksum`),
    observation: row.observationID ?? '', type: row.type ?? '', intent: row.intent ?? '', filter: row.energy_bandpassName ?? '',
    exposureSeconds: Number(row.time_exposure), startMjd: Number(row.time_bounds_lower), dataRelease: row.dataRelease ?? '' };
};
/** Validate one CADC artifact with the same rules used when a Gemini reduction is pinned. */
export const cadcFrame = (row: Record<string, string>): GeminiFrame => frame(toFrame(row));

/** The configuration keywords of a primary header, as text, so two headers are compared by what they say and not by how the
 * reader typed it. */
export const configurationOf = (header: FitsHeader): Configuration =>
  Object.fromEntries(CONFIG_KEYS.map(key => [key, String(header[key] ?? '').trim()])) as unknown as Configuration;
export const sameConfiguration = (a: Configuration, b: Configuration) => CONFIG_KEYS.every(key => a[key] === b[key] && a[key] !== '');
/** A header that states every configuration keyword. A frame missing one cannot be matched against a calibration at all, and
 * an empty string would compare equal to another empty string and quietly match everything. */
export const configurationComplete = (config: Configuration) => CONFIG_KEYS.every(key => config[key] !== '');

/** The names an archive master says went into it.
 *
 * Gemini's nightly pipeline writes them as `IMCMB00n` in the master's **first extension** header, not its primary. A master's
 * primary carries no data (`NAXIS = 0`) and the extension header begins exactly where the primary header ends, so it is read
 * there rather than by hunting for cards at record boundaries.
 *
 * Each value is the file the pipeline was holding at that step, so it carries whatever prefix that step had left on it and
 * may have no `.fits` at all: a real GMOS flat master names its first input `rgS20250917S0126[SCI,1]` and the rest
 * `rgS20250917S0127.fits[SCI,1]`. Requiring `.fits` silently drops the first frame, so the extension is optional here and
 * what is kept is the raw archive name. The order is the order the master states. */
export function combinedNames(bytes: Buffer): string[] {
  const primary = readFitsHeader(bytes);
  if (primary.header.NAXIS !== 0) throw new Error('An archive master carries no primary data; this file is not one.');
  const extension = readFitsHeader(bytes, primary.dataOffset).header;
  const names: string[] = [];
  for (let index = 1; ; index++) {
    const value = extension[`IMCMB${String(index).padStart(3, '0')}`];
    if (value === undefined) break;
    if (typeof value !== 'string') throw new TypeError(`IMCMB${index} is not a file name.`);
    const match = /([NS]\d{8}S\d{4})(?:\.fits)?\[/u.exec(value);
    if (!match) throw new TypeError(`IMCMB${index} (${value}) does not name a raw Gemini frame.`);
    const name = `${match[1]!}.fits`;
    if (!names.includes(name)) names.push(name);
  }
  return names;
}

/** MJD as an ISO instant. MJD 40587 is 1970-01-01, which is what makes the conversion exact rather than fitted. */
export const mjdToIso = (mjd: number) => new Date(Math.round((mjd - 40587) * 86_400_000)).toISOString().replace(/\.\d{3}Z$/u, 'Z');

/** Frames more than this far apart were not commanded as one thing. A GMOS imaging sequence of a few dozen exposures runs
 * inside an hour; six hours is longer than any single sequence and shorter than the gap to the next night. */
export const SEQUENCE_GAP_HOURS = 6;

/** The programme's science frames split into the runs the telescope was actually commanded to take, each ordered in time.
 *
 * Grouping is by gap, not by the UT date in the file name. Gemini names a frame for the UT date of its own exposure, so an
 * observing night that crosses UT midnight is filed under two dates: the 3I/ATLAS sequence of GS-2025B-DD-102 began at
 * 23:26 UT on 2025-09-05 and ran on into 2025-09-06, and splitting it on the name would cut one dither sequence in half. A
 * gap is what separates two observations. */
export function scienceSequences<T extends { startMjd: number }>(frames: readonly T[]): T[][] {
  const ordered = [...frames].sort((a, b) => a.startMjd - b.startMjd), runs: T[][] = [];
  for (const entry of ordered) {
    const run = runs.at(-1), previous = run?.at(-1);
    if (run && previous && (entry.startMjd - previous.startMjd) * 24 <= SEQUENCE_GAP_HOURS) run.push(entry);
    else runs.push([entry]);
  }
  return runs;
}

/** The programme's science frames in one filter, with the CAOM row each came from.
 *
 * `start` keeps one sequence: the one whose first frame falls on that UT date. A programme is not one observation.
 * GS-2025B-DD-102 took nine 25 s r frames of 3I/ATLAS across the UT midnight of 2025-09-05 and two 30 s r frames eight
 * nights later, and stacking the eleven together would combine two nights of a moving comet into one picture. */
export async function scienceFrames(proposal: string, filter: string, start?: string) {
  const rows = await query(`SELECT ${FRAME_COLUMNS} FROM ${JOIN} WHERE o.collection='GEMINI' AND o.proposal_id=${quote(proposal)} ` +
    `AND o.type='OBJECT' AND o.intent='science' AND p.energy_bandpassName=${quote(filter)} AND a.uri LIKE '%.fits' ORDER BY p.time_bounds_lower`);
  const frames = rows.map(toFrame), byUri = new Map(rows.map(row => [row.uri ?? '', row]));
  const runs = scienceSequences(frames);
  if (start === undefined) {
    if (runs.length !== 1) throw new Error(`${proposal} took ${filter} science frames in ${runs.length} separate sequences, ` +
      `beginning ${runs.map(run => mjdToIso(run[0]!.startMjd)).join(', ')}; pin one with --start YYYY-MM-DD.`);
    return { frames: runs[0]!, rows: runs[0]!.map(entry => byUri.get(entry.uri)!) };
  }
  const chosen = runs.filter(run => mjdToIso(run[0]!.startMjd).startsWith(start));
  if (chosen.length !== 1) throw new Error(`${proposal} has ${chosen.length} ${filter} sequences beginning on ${start}. ` +
    `It begins sequences at ${runs.map(run => mjdToIso(run[0]!.startMjd)).join(', ') || 'no time at all'}.`);
  return { frames: chosen[0]!, rows: chosen[0]!.map(entry => byUri.get(entry.uri)!) };
}

/** The archive's processed masters of one kind for an instrument, in a window.
 *
 * Found by the name the pipeline gave the product (`…_bias.fits`, `…_flat.fits`) and its `calibrationLevel 2`, **not** by
 * CAOM's `type`: the archive files a twilight-flat master under `type = 'OBJECT'` because its raw frames are OBJECT frames of
 * target `Twilight`, so a query on `type = 'FLAT'` returns none of them. A flat also has to be the science frames' own
 * filter, which is why `filter` is asked for; a bias has none and is taken with the shutter closed. */
export async function archiveMasters(instrument: string, kind: CalibrationKind, filter: string | null, from: number, to: number): Promise<GeminiFrame[]> {
  const rows = await query(`SELECT ${FRAME_COLUMNS} FROM ${JOIN} WHERE o.collection='GEMINI' AND o.instrument_name=${quote(instrument)} ` +
    `AND p.calibrationLevel=2 AND a.uri LIKE ${quote(`%_${kind.toLowerCase()}.fits`)} ` +
    `${filter === null ? '' : `AND p.energy_bandpassName=${quote(filter)} `}` +
    `AND p.time_bounds_lower BETWEEN ${from} AND ${to} ORDER BY p.time_bounds_lower`);
  return rows.map(toFrame);
}

/** The processed bias an archive master says it was reduced with, from the `BIASIM` card Gemini's pipeline writes
 * (`BIASIM = 'gS20250917S0156_bias'`, without the extension). A master that names none returns null: a bias master is not
 * itself bias-subtracted, so its absence is ordinary and not a fault. */
export function declaredBias(header: FitsHeader): string | null {
  const value = header.BIASIM;
  if (value === undefined) return null;
  if (typeof value !== 'string') throw new TypeError('BIASIM is not a file name.');
  const name = value.trim().replace(/\.fits$/u, '');
  if (!/^[a-z]{0,4}[NS]\d{8}S\d{4}_bias$/u.test(name)) throw new TypeError(`BIASIM (${value}) does not name a Gemini bias master.`);
  return `${name}.fits`;
}

/** Processed products by file name. Separate from `framesByName` only in what it refuses: a product is never a raw frame. */
export async function productsByName(names: readonly string[]): Promise<Map<string, GeminiFrame>> {
  const found = await framesByName(names);
  for (const [name, entry] of found) if (isRawName(entry.name)) throw new TypeError(`${name} is a raw frame, not a processed product.`);
  return found;
}

/** The raw frames of an instrument by file name, as CAOM holds them. */
export async function framesByName(names: readonly string[]): Promise<Map<string, GeminiFrame>> {
  if (!names.length) return new Map();
  const list = names.map(name => quote(`gemini:GEMINI/${name}`)).join(',');
  const rows = await query(`SELECT ${FRAME_COLUMNS} FROM ${JOIN} WHERE o.collection='GEMINI' AND a.uri IN (${list})`);
  return new Map(rows.map(toFrame).map(entry => [entry.name, entry]));
}

/** A science frame's own primary header against CAOM. The header is the observation's first account of itself; CAOM is the
 * archive's. A pin that cannot make the two agree is wrong about which file it pinned. */
export function checkAgainstHeader(header: FitsHeader, entry: GeminiFrame, target: string, instrument: string): void {
  const text = (key: string) => String(header[key] ?? '').trim();
  const instrume = text('INSTRUME'), object = text('OBJECT'), exposure = Number(header.EXPTIME);
  if (instrume.toUpperCase() !== instrument.toUpperCase())
    throw new Error(`${entry.name}: the header says INSTRUME=${instrume}, CAOM says ${instrument}.`);
  if (object.toLowerCase() !== target.toLowerCase())
    throw new Error(`${entry.name}: the header says OBJECT=${object}, CAOM says ${target}.`);
  if (Number.isFinite(exposure) && Math.abs(exposure - entry.exposureSeconds) > 0.05 * Math.max(1, entry.exposureSeconds))
    throw new Error(`${entry.name}: the header says EXPTIME=${exposure}, CAOM says ${entry.exposureSeconds}.`);
}

/** One archive master's own account of itself: the raw frames it names, and the processed bias it says it used.
 *
 * Read from the master's header over a range request of 24 records, which reaches its primary header and the extension
 * header holding the `IMCMB` cards; nothing is downloaded whole to be examined. Returns null when CAOM cannot resolve every
 * frame the master names, because a set missing one of its inputs would not reproduce that master. */
type MasterReading = { readonly skipped: string } | { readonly frames: readonly GeminiFrame[]; readonly declaredBias: string | null };
async function readMaster(master: GeminiFrame, config: Configuration): Promise<MasterReading> {
  const bytes = await primaryHeaderBytes(master.uri, 24);
  const header = readFitsHeader(bytes).header, found = configurationOf(header);
  if (!sameConfiguration(found, config))
    return { skipped: `${master.name} (${CONFIG_KEYS.map(key => `${key}=${found[key] || '?'}`).join(' ')})` };
  const names = combinedNames(bytes);
  if (!names.length) return { skipped: `${master.name} (names no frames)` };
  const rows = await framesByName(names);
  const frames = names.map(name => rows.get(name)).filter((entry): entry is GeminiFrame => entry !== undefined);
  if (frames.length !== names.length)
    return { skipped: `${master.name} (${names.length - frames.length} of its ${names.length} frames are not in CAOM)` };
  return { frames, declaredBias: declaredBias(header) };
}

const associationText = (master: GeminiFrame, count: number) =>
  `The archive's own association, read from the master rather than made here: ${master.name} names these ${count} frames in ` +
  `the IMCMB001-IMCMB${String(count).padStart(3, '0')} cards of its first extension header, and its primary header carries ` +
  `the same ${CONFIG_KEYS.join(', ')} as the science frames.`;

/** The master of one kind this programme's science frames can actually use, with the raw frames it says made it.
 *
 * Candidates are taken nearest-in-time first and each is accepted only when its own primary header carries the science
 * frames' detector configuration: the detector, the amplifier count, the amplifier integration time and the read-out
 * region. That is what makes a calibration applicable; a master of another binning is a different picture of a different
 * detector read-out and is skipped, not resampled. */
async function associateMaster(id: string, instrument: string, kind: CalibrationKind, filter: string | null,
  config: Configuration, from: number, to: number, days: number): Promise<{ set: GeminiCalibrationSet; declaredBias: string | null }> {
  const masters = await archiveMasters(instrument, kind, filter, from - days, to + days);
  const ordered = [...masters].sort((a, b) => Math.abs(a.startMjd - from) - Math.abs(b.startMjd - from));
  const skipped: string[] = [];
  for (const master of ordered) {
    const read = await readMaster(master, config);
    if ('skipped' in read) { skipped.push(read.skipped); continue; }
    return { declaredBias: read.declaredBias,
      set: { id, kind, product: master, frames: read.frames, daysFromScience: Number((master.startMjd - from).toFixed(4)),
        association: associationText(master, read.frames.length) } };
  }
  throw new Error(`No archive ${kind} master of this configuration within ${days} days of the science frames.` +
    (skipped.length ? ` ${skipped.length} were skipped: ${skipped.slice(0, 5).join('; ')}.` : ' The archive published none in that window.'));
}

/** One named archive master, pinned as a set of its own. Used for the bias a flat declares: that master is not chosen, it is
 * the one the flat states it used, so it is looked up by name and its own raw frames are pinned with it. */
async function associateNamedMaster(id: string, name: string, kind: CalibrationKind, config: Configuration,
  from: number): Promise<GeminiCalibrationSet> {
  const master = (await productsByName([name])).get(name);
  if (!master) throw new Error(`The archive names ${name} as a calibration but CAOM does not hold it.`);
  const read = await readMaster(master, config);
  if ('skipped' in read) throw new Error(`${name} cannot be reduced here: ${read.skipped}.`);
  return { id, kind, product: master, frames: read.frames, daysFromScience: Number((master.startMjd - from).toFixed(4)),
    association: associationText(master, read.frames.length) };
}

export async function pinProgram(id: string, proposal: string, filter: string, days: number, start?: string): Promise<GeminiProgram> {
  requireProgramId(id);
  const { frames: science, rows } = await scienceFrames(proposal, filter, start);
  if (!science.length) throw new Error(`${proposal} has no science frames in ${filter}.`);
  const first = rows[0]!, instrument = first.instrument_name ?? '', target = first.target_name ?? '';
  const header = readFitsHeader(await primaryHeaderBytes(science[0]!.uri)).header;
  checkAgainstHeader(header, science[0]!, target, instrument);
  const config = configurationOf(header);
  if (!configurationComplete(config)) throw new Error(`${science[0]!.name} does not carry a full detector configuration (${CONFIG_KEYS.join(', ')}).`);
  const from = Math.min(...science.map(entry => entry.startMjd)), to = Math.max(...science.map(entry => entry.startMjd));
  // A bias carries no filter and a flat is only a flat for the band it was taken in.
  const bias = await associateMaster('bias', instrument, 'BIAS', null, config, from, to, days);
  const flat = await associateMaster('flat', instrument, 'FLAT', filter, config, from, to, days);
  const calibrations: GeminiCalibrationSet[] = [bias.set];
  if (flat.declaredBias === null) calibrations.push(flat.set);
  else {
    calibrations.push(await associateNamedMaster('flat-bias', flat.declaredBias, 'BIAS', config, from));
    calibrations.push({ ...flat.set, requiresBias: 'flat-bias' });
  }
  const program = parseGeminiProgram({ schema: 'cssearth-gemini-program@1', id, programme: proposal,
    principalInvestigator: first.proposal_pi ?? '', target, instrument, filter, configuration: config,
    sequenceStart: mjdToIso(science[0]!.startMjd), archive: 'CADC/GEMINI', science, calibrations });
  return writeGeminiProgram(program);
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const argv = process.argv.slice(2);
  const [id, proposal, filter] = positionalArguments(argv, ['--days', '--start']);
  const days = Number(flagValue(argv, '--days') ?? 15), start = flagValue(argv, '--start');
  if (!id || !proposal || !filter || !Number.isFinite(days) || days <= 0)
    throw new TypeError('Usage: archive <program id> <proposal id> <filter> [--days 15] [--start YYYY-MM-DD]');
  const program = await pinProgram(id, proposal, filter, days, start);
  const mib = (frames: readonly GeminiFrame[]) => (frames.reduce((total, entry) => total + entry.bytes, 0) / 2 ** 20).toFixed(1);
  console.log(`${program.id}: ${program.science.length} ${program.instrument} ${program.filter} science frames (${mib(program.science)} MiB) ` +
    `of ${program.target} from ${program.sequenceStart}, programme ${program.programme} (${program.principalInvestigator}).`);
  for (const set of program.calibrations)
    console.log(`  ${set.id} (${set.kind}): ${set.frames.length} raw frames (${mib(set.frames)} MiB) and the archive's ${set.product.name} ` +
      `(${mib([set.product])} MiB), ${set.daysFromScience.toFixed(2)} days from the science frames` +
      (set.requiresBias ? `, which the archive made with the ${set.requiresBias} master` : ''));
}
