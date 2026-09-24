#!/usr/bin/env node
/** Pin a Keck observation in the Keck Observatory Archive as a Keck program.
 *
 *   node tools/objects/keck/archive.mts <program id> <instrument> <koaid> [<koaid> ...] [--nights <n>]
 *
 * For each science frame the program records three things, each file by its KOA download URL, byte count and sha256, all of
 * them fetched under .local/keck/<program id> so a re-run reads what the pin names:
 *
 *   the raw frame itself (KOA level 0), with what the archive's own catalogue says it is: instrument, image type, target,
 *     date and exposure, the observing programme, and the instrument settings that decide which calibrations apply;
 *   the calibration frames the archive associates with it (KoaAPI/nph-getCaliblist). KOA's association is already matched on
 *     the instrument state, so nothing here re-groups it; only the kinds a pipeline reads and the nights within `--nights`
 *     (0 by default: the observation's own night) are kept, and the program records how many the archive named in all;
 *   the archive's own reduced products for the frame (KoaAPI/nph-getL1list), where KOA made any. These are the oracle a
 *     re-run is compared against, and for an instrument whose pipeline does not run here they are all there is.
 *
 * Nothing about the observation is stated here that the archive does not: every recorded field is a KOA catalogue column or a
 * card of the file's own header, and a program that names a file the archive does not list is refused when it is read.
 *
 * The program is written to tools/objects/keck/programs/<program id>.json. */
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { flagValue, positionalArguments, requireArray, requireFiniteNumber, requireRecord, requireString } from '@cssearth/core';
import { readFitsFileHdus } from '@cssearth/fits/node';
import { INSTRUMENT_TABLES, instrumentTable, koaCalibrations, koaDownload, koaProducts, koaQuery, lev0Url, lev1Url,
  type InstrumentTable } from './koa.mts';

export const PROGRAMS = resolve(import.meta.dirname, 'programs');
export const DOWNLOADS = resolve(import.meta.dirname, '../../../.local/keck');
const NAME = /^[A-Za-z0-9._-]+$/u;
/** A KOA file name: the instrument's two characters, the UT date, the second of the night, and for some instruments a
 * sequence. The second character can be a digit: NIRC2 writes `N2.`, KCWI `KB.` and `KR.`, OSIRIS `OS.`. */
export const KOAID = /^[A-Z][A-Z0-9]\.\d{8}\.\d+(?:\.\d+)?\.fits$/u;

/** What KOA calls a frame that is not science. `object` is the science frame itself and is never pinned as a calibration. */
export const CALIBRATION_TYPES = ['bias', 'dark', 'contbars', 'arclamp', 'flatlamp', 'flatlampoff', 'domeflat', 'twiflat', 'trace', 'flat', 'lamp'] as const;
/** The catalogue columns every instrument table carries, which is what an observation is recorded from. */
const SHARED_COLUMNS = ['koaid', 'ofname', 'koaimtyp', 'targname', 'date_obs', 'ut', 'elaptime', 'progid', 'semid', 'progpi', 'progtitl', 'filehand', 'propint'] as const;
/** The settings that decide which calibrations apply to a frame, per instrument, as that instrument's table names them. A
 * table with no entry records no settings rather than settings from another instrument's columns. */
const CONFIGURATION_COLUMNS: Partial<Record<InstrumentTable, readonly string[]>> = {
  koa_kcwi: ['camera', 'bgratnam', 'bcwave', 'bfiltnam', 'ifunam', 'binning', 'ampmode', 'gainmul'],
  koa_osiris: ['instr', 'sfilter', 'ifilter', 'sscale', 'itime', 'coadds'],
  koa_nirc2: ['camname', 'filter', 'slitname', 'itime', 'coadds'],
  koa_nirspec: ['filter', 'slitname', 'slitwidt', 'echlpos', 'disppos', 'dispers', 'itime', 'coadds'],
};

/** The calibrations KOA's own association does not cover.
 *
 * `nph-getCaliblist` matches a science frame's calibrations on `stateid`, the spectrograph state: grating, central wavelength,
 * IFU. A bias has no spectrograph state (it is a property of the detector and its readout), so the association names only the
 * handful of bias frames that happen to carry the science frame's state id, not the night's bias set. For the M42 observation
 * pinned here it named two of the night's eight, and the KCWI DRP, which needs `bias_min_nframes` = 7 of them to build a master
 * bias, could not reduce anything at all.
 *
 * So for these kinds the night's own rows of the instrument table are pinned instead: every frame of the same UT night whose
 * detector columns all read the same as the science frame's. That is still the archive's own statement: the columns are
 * catalogue columns, and the header card the instrument writes for the same thing (`CCDCFG` for KCWI) is read back off the
 * downloaded file and checked against the science frame's. Nothing here groups frames by anything the catalogue does not say. */
const DETECTOR_CALIBRATIONS: Partial<Record<InstrumentTable, { readonly kinds: readonly string[]; readonly columns: readonly string[]; readonly card: string }>> = {
  koa_kcwi: { kinds: ['bias', 'dark'], columns: ['camera', 'binning', 'ampmode'], card: 'CCDCFG' },
};

export interface KeckFile {
  readonly koaid: string;
  /** The file's own name, which for a level 1 product is not the science frame's. */
  readonly name: string;
  /** The name the observatory wrote the frame under (`kb231209_00085.fits`). A pipeline that reads a night by its own naming
   * convention is given the file under this name; absent for an archive product, which the observatory never wrote. */
  readonly observatoryName?: string;
  /** The archive's path to the file, which its download URL is built from. */
  readonly filehand: string;
  readonly url: string;
  readonly bytes: number;
  /** What KOA calls the frame: `object` for science, `bias`, `arclamp` and the rest for calibrations, absent for a product. */
  readonly imageType?: string;
  /** For an archive product, the level KOA ingested it at (`lev1`, `lev2`) and how KOA describes the stage. */
  readonly level?: string;
  readonly description?: string;
  /** For a calibration, how it reached this program: `association` is what KOA associated with the science frame,
   * `detector` is a frame of the science frame's own night and detector configuration (see DETECTOR_CALIBRATIONS). */
  readonly selection?: CalibrationSelection;
}

export const CALIBRATION_SELECTIONS = ['association', 'detector'] as const;
export type CalibrationSelection = (typeof CALIBRATION_SELECTIONS)[number];

export interface KeckObservation {
  readonly koaid: string;
  readonly targetName: string;
  /** UT date of the night, and the start time within it, as the catalogue states them. */
  readonly dateObs: string;
  readonly ut: string;
  readonly elapsedSeconds: number;
  /** Months the frame was proprietary. An anonymous query returns it only once that period has run out. */
  readonly proprietaryMonths: number;
  readonly configuration: Readonly<Record<string, string>>;
  readonly science: KeckFile;
  /** How many frames the archive associated, how many of them this program pins, and how many more were pinned from the
   * night's own detector configuration because the association does not cover them. */
  readonly association: { readonly frames: number; readonly pinned: number; readonly nights: number; readonly detector: number };
  readonly calibrations: readonly KeckFile[];
  /** The archive's own reduced products, empty where KOA made none for this instrument. */
  readonly archiveProducts: readonly KeckFile[];
}

export interface KeckProgram {
  readonly schema: 'cssearth-keck-program@1';
  readonly id: string;
  readonly instrument: string;
  readonly table: InstrumentTable;
  readonly target: string;
  /** The observatory's own programme id and semester, and who held the time. */
  readonly programme: string;
  readonly semester: string;
  readonly principalInvestigator: string;
  readonly title: string;
  readonly observations: readonly KeckObservation[];
}

const digest = (value: unknown, label: string) => {
  const text = requireString(value, label);
  if (!/^[0-9a-f]{64}$/u.test(text)) throw new TypeError(`${label} is not a sha256.`);
  return text;
};

function parseFile(value: unknown, label: string): KeckFile {
  const row = requireRecord(value, label);
  const koaid = requireString(row.koaid, 'File koaid'), name = requireString(row.name, 'File name');
  const filehand = requireString(row.filehand, 'File path'), url = requireString(row.url, 'File URL');
  const bytes = requireFiniteNumber(row.bytes, 'File bytes');
  if (!KOAID.test(koaid)) throw new TypeError(`${koaid} is not a KOA id.`);
  if (!NAME.test(name) || !filehand.endsWith(`/${name}`)) throw new TypeError(`${name} is not the file at ${filehand}.`);
  if (!url.startsWith('https://koa.ipac.caltech.edu/cgi-bin/') || !url.includes(filehand)) throw new TypeError(`${name} is not downloaded from KOA.`);
  if (!Number.isSafeInteger(bytes) || bytes < 1) throw new TypeError(`${name} has no byte count.`);
  const imageType = row.imageType === undefined ? undefined : requireString(row.imageType, 'Image type');
  const observatoryName = row.observatoryName === undefined ? undefined : requireString(row.observatoryName, 'Observatory name');
  if (observatoryName !== undefined && !NAME.test(observatoryName)) throw new TypeError(`${observatoryName} is not a file name.`);
  const level = row.level === undefined ? undefined : requireString(row.level, 'Product level');
  if (level !== undefined && !/^lev[12]$/u.test(level)) throw new TypeError(`${level} is not a KOA data level.`);
  const description = row.description === undefined ? undefined : requireString(row.description, 'Product description');
  const selection = row.selection === undefined ? undefined : requireString(row.selection, 'Calibration selection');
  if (selection !== undefined && !(CALIBRATION_SELECTIONS as readonly string[]).includes(selection)) throw new TypeError(`${name} was selected by no known rule (${selection}).`);
  return { koaid, name, filehand, url, bytes,
    ...(observatoryName ? { observatoryName } : {}), ...(imageType ? { imageType } : {}),
    ...(level ? { level } : {}), ...(description ? { description } : {}),
    ...(selection ? { selection: selection as CalibrationSelection } : {}) };
}

export function parseKeckProgram(value: unknown): KeckProgram {
  const row = requireRecord(value, 'Keck program');
  if (row.schema !== 'cssearth-keck-program@1') throw new TypeError('Unsupported Keck program.');
  const table = requireString(row.table, 'Instrument table');
  if (!(INSTRUMENT_TABLES as readonly string[]).includes(table)) throw new TypeError(`KOA has no table ${table}.`);
  const observations = requireArray(row.observations, 'Observations').map(raw => {
    const entry = requireRecord(raw, 'Keck observation'), koaid = requireString(entry.koaid, 'Observation koaid');
    if (!KOAID.test(koaid)) throw new TypeError(`${koaid} is not a KOA id.`);
    const science = parseFile(entry.science, 'Science frame');
    if (science.koaid !== koaid) throw new TypeError(`${koaid}: its science frame is ${science.koaid}.`);
    if (science.imageType !== 'object') throw new TypeError(`${koaid} is a ${String(science.imageType)} frame, not a science frame.`);
    const calibrations = requireArray(entry.calibrations, 'Calibrations').map(value => parseFile(value, 'Calibration'));
    for (const calibration of calibrations) {
      if (!(CALIBRATION_TYPES as readonly string[]).includes(calibration.imageType ?? '')) throw new TypeError(`${calibration.name} is a ${String(calibration.imageType)} frame, which is not a calibration.`);
      if (calibration.koaid === koaid) throw new TypeError(`${koaid} is pinned as its own calibration.`);
    }
    const archiveProducts = requireArray(entry.archiveProducts, 'Archive products').map(value => parseFile(value, 'Archive product'));
    for (const product of archiveProducts) if (product.koaid !== koaid) throw new TypeError(`${product.name} is a product of ${product.koaid}, not ${koaid}.`);
    // Two products of one frame can share a name at different levels (KOA keeps `_icubed` under both lev1 and lev2), so a file
    // is the archive's path to it, not its base name.
    for (const list of [calibrations, archiveProducts]) if (new Set(list.map(file => file.filehand)).size !== list.length) throw new TypeError(`${koaid}: a file appears twice.`);
    const association = requireRecord(entry.association, 'Association');
    const frames = requireFiniteNumber(association.frames, 'Associated frames'), pinned = requireFiniteNumber(association.pinned, 'Pinned frames');
    const detector = requireFiniteNumber(association.detector, 'Detector frames');
    if (pinned + detector !== calibrations.length) throw new TypeError(`${koaid}: it says ${pinned} associated and ${detector} detector calibrations are pinned and pins ${calibrations.length}.`);
    if (pinned > frames) throw new TypeError(`${koaid}: it pins more calibrations than the archive associated.`);
    if (calibrations.filter(file => file.selection === 'detector').length !== detector) throw new TypeError(`${koaid}: ${detector} calibrations are said to come from the night's detector configuration and ${calibrations.filter(file => file.selection === 'detector').length} say so.`);
    const configuration = Object.fromEntries(Object.entries(requireRecord(entry.configuration, 'Configuration'))
      .map(([key, cell]) => [key, requireString(cell, key)]));
    const proprietaryMonths = requireFiniteNumber(entry.proprietaryMonths, 'Proprietary months');
    if (proprietaryMonths < 0) throw new TypeError(`${koaid} has a negative proprietary period.`);
    return { koaid, targetName: requireString(entry.targetName, 'Target name'), dateObs: requireString(entry.dateObs, 'Date'),
      ut: requireString(entry.ut, 'UT'), elapsedSeconds: requireFiniteNumber(entry.elapsedSeconds, 'Elapsed time'),
      proprietaryMonths, configuration, science, calibrations,
      association: { frames, pinned, nights: requireFiniteNumber(association.nights, 'Association nights'), detector }, archiveProducts };
  });
  if (!observations.length) throw new TypeError('A Keck program pins at least one observation.');
  if (new Set(observations.map(entry => entry.koaid)).size !== observations.length) throw new TypeError('An observation appears twice in the program.');
  return { schema: row.schema, id: requireString(row.id, 'Program id'), instrument: requireString(row.instrument, 'Instrument'),
    table: table as InstrumentTable, target: requireString(row.target, 'Target'), programme: requireString(row.programme, 'Programme'),
    semester: requireString(row.semester, 'Semester'), principalInvestigator: requireString(row.principalInvestigator, 'Principal investigator'),
    title: requireString(row.title, 'Title'), observations };
}

export async function readKeckProgram(id: string): Promise<KeckProgram> {
  return parseKeckProgram(JSON.parse(await readFile(resolve(PROGRAMS, `${id}.json`), 'utf8')) as unknown);
}

const nameOf = (filehand: string) => filehand.slice(filehand.lastIndexOf('/') + 1);

/** One science frame's catalogue row, from the instrument's own KOA table. The anonymous service returns the row only if the
 * frame is public, so a frame still within its proprietary period is simply absent, and that is what the error says. */
export async function koaFrame(table: InstrumentTable, koaid: string) {
  const columns = [...SHARED_COLUMNS, ...CONFIGURATION_COLUMNS[table] ?? []];
  const [row] = await koaQuery(`SELECT ${columns.join(',')} FROM ${table} WHERE koaid='${koaid}'`);
  if (!row) throw new Error(`KOA has no public ${table} frame ${koaid}. A frame within its proprietary period is not served anonymously.`);
  return row;
}

/** What the instrument itself wrote about the detector, read from the downloaded frames rather than taken from the catalogue.
 * Refuses a detector calibration whose card differs from the science frame's: the catalogue's columns and the instrument's
 * card have to agree about the same thing, or one of them is not what was thought. */
export async function assertDetectorCard(table: InstrumentTable, directory: string, science: KeckFile, detector: readonly KeckFile[]) {
  const rule = DETECTOR_CALIBRATIONS[table];
  if (!rule || !detector.length) return null;
  const card = async (file: KeckFile) => {
    const [primary] = await readFitsFileHdus(resolve(directory, file.name));
    const value = primary?.header[rule.card];
    if (value === undefined) throw new Error(`${file.name} has no ${rule.card} card, so its detector configuration cannot be checked.`);
    return String(value).trim();
  };
  const wanted = await card(science);
  for (const file of detector) {
    const found = await card(file);
    if (found !== wanted) throw new Error(`${file.name} says ${rule.card} ${found}; the science frame says ${wanted}. The catalogue columns and the header disagree, so it is not pinned.`);
  }
  return wanted;
}

/** Fetch a file and record it as the program pins it. */
async function pin(directory: string, koaid: string, filehand: string, url: string, extra: Partial<KeckFile> = {}): Promise<KeckFile> {
  const name = nameOf(filehand);
  const { bytes } = await koaDownload(url, resolve(directory, name));
  return { koaid, name, filehand, url, bytes, ...extra };
}

/** The nights a KOA id can be on: the science frame's own UT date, and `nights` days either side of it. KOA files a frame
 * under the UT date in its id, which is what `diff_date` in the association counts from. */
export function nightsAround(koaid: string, nights: number): string[] {
  const date = /^[A-Z][A-Z0-9]\.(\d{4})(\d{2})(\d{2})\./u.exec(koaid);
  if (!date) throw new TypeError(`${koaid} carries no night.`);
  const start = Date.UTC(Number(date[1]), Number(date[2]) - 1, Number(date[3]));
  const days: string[] = [];
  for (let offset = -nights; offset <= nights; offset++) days.push(new Date(start + offset * 86_400_000).toISOString().slice(0, 10).replace(/-/gu, ''));
  return days;
}

/** The frames of the science frame's own night and detector configuration, for the kinds KOA's association cannot cover.
 * Every row comes from the instrument's own catalogue table and is kept only when every detector column reads what the
 * science frame's row reads. Returns nothing for an instrument with no such rule. */
export async function detectorCalibrations(table: InstrumentTable, science: Record<string, string>, koaid: string, nights: number) {
  const rule = DETECTOR_CALIBRATIONS[table];
  if (!rule) return [];
  const kinds = rule.kinds.map(kind => `'${kind}'`).join(','), where = nightsAround(koaid, nights).map(night => `koaid LIKE '__.${night}.%'`).join(' OR ');
  const rows = await koaQuery(`SELECT koaid,ofname,koaimtyp,filehand,${rule.columns.join(',')} FROM ${table} WHERE koaimtyp IN (${kinds}) AND (${where}) ORDER BY koaid`);
  return rows.filter(row => rule.columns.every(column => (row[column] ?? '') === (science[column] ?? '')));
}

/** Everything one science frame needs pinned: itself, the calibrations the archive associates with it within `nights` nights,
 * the night's own detector calibrations for the kinds that association does not cover, and the archive's own reduced products. */
export async function keckObservation(instrument: string, koaid: string, directory: string, nights: number): Promise<KeckObservation & { programme: string; semester: string; principalInvestigator: string; title: string }> {
  const table = instrumentTable(instrument), row = await koaFrame(table, koaid);
  if (row.koaimtyp !== 'object') throw new Error(`${koaid} is a ${row.koaimtyp} frame, not a science frame.`);
  const science = await pin(resolve(directory, 'lev0'), koaid, row.filehand!, lev0Url(row.filehand!), { imageType: 'object', observatoryName: row.ofname });
  const associated = await koaCalibrations(instrument, koaid);
  const wanted = associated.filter(entry => (CALIBRATION_TYPES as readonly string[]).includes(entry.koaimtyp ?? '')
    && Math.abs(Number(entry.diff_date ?? 0)) <= nights);
  const calibrations: KeckFile[] = [];
  for (const entry of wanted) calibrations.push(await pin(resolve(directory, 'lev0'), entry.koaid!, entry.filehand!, lev0Url(entry.filehand!),
    { imageType: entry.koaimtyp, observatoryName: entry.ofname, selection: 'association' }));
  const held = new Set(calibrations.map(file => file.koaid));
  const detector: KeckFile[] = [];
  for (const entry of await detectorCalibrations(table, row, koaid, nights)) {
    if (held.has(entry.koaid!) || entry.koaid === koaid) continue;
    held.add(entry.koaid!);
    detector.push(await pin(resolve(directory, 'lev0'), entry.koaid!, entry.filehand!, lev0Url(entry.filehand!),
      { imageType: entry.koaimtyp, observatoryName: entry.ofname, selection: 'detector' }));
  }
  // The catalogue said these frames share the science frame's detector configuration; the instrument's own card says whether
  // they do. A frame whose card disagrees is not pinned, because the pipeline would group it with the science frame anyway.
  await assertDetectorCard(table, resolve(directory, 'lev0'), science, detector);
  calibrations.push(...detector);
  const archiveProducts: KeckFile[] = [];
  for (const product of await koaProducts(instrument, koaid, row.filehand!)) {
    // A product list names files beside the products: logs and preview images are not products and are not pinned.
    if (!/\.fits(?:\.gz)?$/u.test(product.filehand)) continue;
    archiveProducts.push(await pin(resolve(directory, 'products', product.level), koaid, product.filehand, lev1Url(instrument, koaid, product.filehand),
      { level: product.level, description: product.description }));
  }
  const configuration = Object.fromEntries((CONFIGURATION_COLUMNS[table] ?? []).map(column => [column, row[column] ?? '']));
  return { koaid, targetName: row.targname ?? '', dateObs: row.date_obs ?? '', ut: row.ut ?? '',
    elapsedSeconds: Number(row.elaptime ?? 0), proprietaryMonths: Number(row.propint ?? 0), configuration, science,
    association: { frames: associated.length, pinned: calibrations.length - detector.length, nights, detector: detector.length }, calibrations, archiveProducts,
    programme: row.progid ?? '', semester: row.semid ?? '', principalInvestigator: row.progpi ?? '', title: (row.progtitl ?? '').trim() };
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const args = process.argv.slice(2);
  const nights = Number(flagValue(args, '--nights') ?? 0);
  const [id, instrument, ...frames] = positionalArguments(args, ['--nights']);
  if (!id || !NAME.test(id) || !instrument || !frames.length || !Number.isInteger(nights) || nights < 0)
    throw new TypeError('Usage: archive <program id> <instrument> <koaid> [...] [--nights <n>]');
  const path = resolve(PROGRAMS, `${id}.json`), directory = resolve(DOWNLOADS, id);
  const existing = await readKeckProgram(id).catch(() => null);
  const entries = [...existing?.observations ?? []];
  let programme = existing?.programme, semester = existing?.semester, pi = existing?.principalInvestigator, title = existing?.title, target = existing?.target;
  for (const koaid of frames) {
    const found = await keckObservation(instrument, koaid, directory, nights);
    if (programme !== undefined && programme !== found.programme) throw new Error(`${koaid} is programme ${found.programme}, not ${programme}.`);
    programme = found.programme; semester ??= found.semester; pi ??= found.principalInvestigator; title ??= found.title; target ??= found.targetName;
    const { programme: _p, semester: _s, principalInvestigator: _i, title: _t, ...entry } = found;
    const index = entries.findIndex(other => other.koaid === entry.koaid);
    if (index >= 0) entries[index] = entry; else entries.push(entry);
    console.log(`${koaid}: ${entry.targetName} ${Object.values(entry.configuration).join(' ')}, ${entry.association.pinned} of ${entry.association.frames} associated calibrations plus ${entry.association.detector} of the night's own detector configuration, ${entry.archiveProducts.length} archive products`);
  }
  const program = parseKeckProgram({ schema: 'cssearth-keck-program@1', id, instrument: instrument.toUpperCase(),
    table: instrumentTable(instrument), target, programme, semester, principalInvestigator: pi, title, observations: entries });
  await mkdir(PROGRAMS, { recursive: true });
  await writeFile(path, `${JSON.stringify(program, null, 2)}\n`);
  console.log(`KECK_PROGRAM ${path}`);
}
